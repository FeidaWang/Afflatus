/* ============================================================
   Election result semantics, shared by the collector and the page.
   Coverage, counting and decision stay three separate states. Unknown is null,
   a lead is never a call, and a call needs a named authority and a time.
   ============================================================ */
import { sourceById } from '../config/electionSources.js';
import { seatCatalogue } from './electionCatalogue.js';
import { eventById } from './electionRules.js';

const COVERAGE = new Set(['not_covered', 'available', 'stale', 'source_error']);
const COUNTING = new Set(['no_votes', 'counting', 'rcv_pending', 'runoff', 'recount', 'count_complete']);
const DECISION = new Set(['uncalled', 'provider_called', 'certified', 'call_rescinded']);
const MODES = new Set(['preview', 'live']);

const isTime = (value) => value === null || (typeof value === 'string' && !Number.isNaN(Date.parse(value)));
const isCount = (value) => value === null || (Number.isInteger(value) && value >= 0);
const isUrl = (value) => typeof value === 'string' && /^https?:\/\//.test(value);
const CHANGE_TYPES = new Set(['new_batch', 'correction', 'rcv_transition', 'count_basis_change', 'call', 'call_rescinded', 'decision_changed', 'certification', 'source_switch', 'tcp_pair_change']);

function decisionErrors(race, ids) {
  const name = race.raceId;
  const decision = race.decision;
  if (!DECISION.has(decision?.status)) return [`${name}: decision`];
  const when = decision.decidedAt || decision.firstObservedAt;
  if (decision.status === 'uncalled') return decision.candidateIds?.length ? [`${name}: an uncalled race names a winner`] : [];
  if (!decision.authority || !when || !isTime(when)) return [`${name}: a decision needs an authority and a time`];
  if (decision.status === 'call_rescinded') return [];
  const errors = [];
  if (!isUrl(decision.evidenceUrl)) errors.push(`${name}: a decision needs evidence`);
  if (decision.candidateIds?.some((id) => !ids.has(id))) errors.push(`${name}: decision names an unknown candidate`);
  // A region can be declared before its members are known. Any other seat needs exactly one winner.
  if (race.seatIds.length === 1 && decision.candidateIds?.length !== 1) errors.push(`${name}: a decision needs one candidate`);
  if (decision.candidateIds?.length > race.seatIds.length) errors.push(`${name}: more winners than seats`);
  return errors;
}

function raceErrors(race) {
  const errors = [];
  const name = race?.raceId || 'race';
  if (!race?.raceId || !Array.isArray(race.seatIds) || !race.seatIds.length) return [`${name}: missing identity`];
  if (!COVERAGE.has(race.coverage)) errors.push(`${name}: coverage`);
  if (!COUNTING.has(race.counting?.status)) errors.push(`${name}: counting`);
  // Votes from different RCV rounds are not comparable, so a round must be named.
  if (race.counting?.method === 'rcv' && !(Number.isInteger(race.counting.round) && race.counting.round >= 1)) errors.push(`${name}: an RCV count needs a round`);
  if (!Array.isArray(race.candidates)) return [...errors, `${name}: candidates`];
  const ids = new Set(race.candidates.map((candidate) => candidate.candidateId));
  if (ids.size !== race.candidates.length) errors.push(`${name}: duplicate candidate`);
  if (!race.candidates.every((candidate) => isCount(candidate.votes))) errors.push(`${name}: votes`);
  if (!(race.twoCandidate?.candidates || []).every((candidate) => isCount(candidate.votes))) errors.push(`${name}: two-candidate votes`);
  if (!isCount(race.progress?.reported ?? null) || !isCount(race.progress?.total ?? null)) errors.push(`${name}: progress`);
  // A multi-member contest fills its whole region, so part of one cannot count towards a chamber.
  if (Number.isInteger(race.positions) && race.seatIds.length !== race.positions) errors.push(`${name}: seats do not match positions`);
  errors.push(...decisionErrors(race, ids));
  for (const key of ['sourceUpdatedAt', 'fetchedAt', 'publishedAt']) {
    if (!isTime(race.provenance?.[key] ?? null)) errors.push(`${name}: ${key}`);
  }
  return errors;
}

// A runoff or a postponed contest has its own later date, but still belongs to this cycle:
// it must fall after polling day and before the term it fills begins.
const LATER_CONTESTS = new Set(['runoff', 'postponed']);
const isLaterContest = (race, event) => Boolean(event.termStarts)
  && LATER_CONTESTS.has(race?.contestKind)
  && /^\d{4}-\d{2}-\d{2}$/.test(race.electionDate ?? '')
  && race.electionDate > event.pollDate
  && race.electionDate < event.termStarts;

/** Joins each race to the catalogue, so a wrong cycle, seat or term cannot count towards a chamber. Calls add(race, errors). */
function catalogueErrors(snapshot, add) {
  const event = eventById(snapshot.eventId);
  if (!event) return ['unknown event'];
  const taken = new Set();
  for (const race of snapshot.races) {
    const name = race?.raceId || 'race';
    const errors = [];
    if (race?.eventId !== event.id) errors.push(`${name}: wrong event`);
    if (race?.electionDate !== event.pollDate && !isLaterContest(race, event)) errors.push(`${name}: wrong election date`);
    // An Australian seat is declared by one commission. A US race is certified state by state.
    if (event.family === 'au' && race?.decision?.status === 'certified' && race.decision.authority !== event.authority) errors.push(`${name}: wrong declaring authority`);
    const seats = new Map(seatCatalogue(event.id, race?.office).map((seat) => [seat.seatId, seat]));
    for (const seatId of race?.seatIds || []) {
      const seat = seats.get(seatId);
      if (!seat) errors.push(`${name}: ${seatId} is not in the catalogue`);
      else if (seat.onBallot === false) errors.push(`${name}: ${seatId} is not on this ballot`);
      else if (seat.term && race.targetTerm !== seat.term) errors.push(`${name}: wrong term`);
      if (taken.has(seatId)) errors.push(`${name}: ${seatId} is in two races`);
      taken.add(seatId);
    }
    add(race, errors);
  }
  return [];
}

/**
 * What is wrong with a snapshot: `errors` for the whole of it, and `races` for each
 * contest by id, so one bad contest can be held back on its own. A race with no id
 * cannot be told apart, so its errors count against the whole snapshot.
 */
export function snapshotProblems(snapshot) {
  const races = new Map();
  if (!snapshot || snapshot.schemaVersion !== 1) return { errors: ['schema version'], races };
  const errors = [];
  const add = (race, list) => {
    if (!list.length) return;
    if (!race?.raceId) errors.push(...list);
    else races.set(race.raceId, [...(races.get(race.raceId) || []), ...list]);
  };
  if (!snapshot.snapshotId || !snapshot.eventId) errors.push('identity');
  if (!MODES.has(snapshot.mode)) errors.push('mode');
  if (typeof snapshot.isSynthetic !== 'boolean') errors.push('isSynthetic');
  if (snapshot.mode === 'live' && snapshot.isSynthetic) errors.push('synthetic data cannot be live');
  if (!Array.isArray(snapshot.races)) return { errors: [...errors, 'races'], races };
  for (const change of snapshot.changes || []) {
    if (!CHANGE_TYPES.has(change.type)) errors.push('unknown change');
    if (change.delta !== undefined && change.delta !== null && !Number.isInteger(change.delta)) errors.push('change delta');
  }
  const ids = new Set(snapshot.races.map((race) => race.raceId));
  if (ids.size !== snapshot.races.length) errors.push('duplicate race');
  for (const race of snapshot.races) add(race, raceErrors(race));
  errors.push(...catalogueErrors(snapshot, add));
  return { errors, races };
}

export function snapshotErrors(snapshot) {
  const { errors, races } = snapshotProblems(snapshot);
  return [...errors, ...[...races.values()].flat()];
}

export function pointerErrors(pointer) {
  if (!pointer || pointer.schemaVersion !== 1) return ['schema version'];
  const errors = [];
  if (!pointer.eventId || !Number.isInteger(pointer.revision)) errors.push('identity');
  if (!pointer.snapshotId || !/^[\w.-]+$/.test(pointer.snapshotId)) errors.push('snapshot id');
  if (!Array.isArray(pointer.history) || !Array.isArray(pointer.sources)) errors.push('history');
  else if (!pointer.history.every((entry) => /^[\w.-]+$/.test(entry.snapshotId) && isTime(entry.publishedAt ?? null))) errors.push('history id');
  for (const source of Array.isArray(pointer.sources) ? pointer.sources : []) {
    if (!['lastCheckedAt', 'lastSuccessAt', 'sourceUpdatedAt'].every((key) => isTime(source[key] ?? null))) errors.push('source time');
  }
  if (!isTime(pointer.publishedAt ?? null)) errors.push('published time');
  return errors;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
export const isLocalHost = (hostname) => LOCAL_HOSTS.has(hostname);

/**
 * The publication gate. On a public host a snapshot must be real and every source
 * in it must have a written yes. Synthetic data only ever renders on this computer.
 */
export function feedAllowed(document, hostname, { serverApprovedSource } = {}) {
  if (document.isSynthetic) return isLocalHost(hostname);
  if (serverApprovedSource && sourceById(serverApprovedSource)?.serverGated &&
      document.sourceIds?.length === 1 && document.sourceIds[0] === serverApprovedSource) return true;
  return (document.sourceIds || []).length > 0 && document.sourceIds.every((id) => {
    const source = sourceById(id);
    return Boolean(source?.enabled && source.publicRedistributionAllowed && !source.synthetic);
  });
}

/* ---------- Change events ---------- */

const candidateSum = (race) => (race.candidates.some((c) => c.votes === null) ? null : race.candidates.reduce((sum, c) => sum + c.votes, 0));

/** Two totals on the same basis: source total, then formal, then a sum only when every candidate is known. */
function comparableTotals(previous, next) {
  for (const key of ['total', 'formal']) {
    const pair = [previous.totals?.[key] ?? null, next.totals?.[key] ?? null];
    if (pair[0] !== null && pair[1] !== null) return pair;
  }
  return [candidateSum(previous), candidateSum(next)];
}

const isDecided = (decision) => decision?.status === 'provider_called' || decision?.status === 'certified';
const winners = (decision) => (decision?.candidateIds || []).join(' ');
// A recount or runoff restates a different count, so its total is not a batch or a correction.
const RESTATED = new Set(['recount', 'runoff']);
const changesBasis = (previous, next) => previous.counting.method !== next.counting.method
  || previous.targetTerm !== next.targetTerm
  || RESTATED.has(previous.counting.status) !== RESTATED.has(next.counting.status);

/** Compares one race across two snapshots. A source switch resets the baseline, so no delta is reported. */
export function raceChanges(previous, next, at) {
  if (!previous) return [];
  const base = { raceId: next.raceId, at };
  const changes = [];
  if (previous.provenance.sourceId !== next.provenance.sourceId) {
    // Another source lacking a call has not withdrawn it, so decisions are not compared either.
    return [{ ...base, type: 'source_switch', from: previous.provenance.sourceId, to: next.provenance.sourceId }];
  }
  if ((previous.counting.round ?? null) !== (next.counting.round ?? null)) {
    changes.push({ ...base, type: 'rcv_transition', from: previous.counting.round ?? null, to: next.counting.round ?? null });
  } else if (changesBasis(previous, next)) {
    changes.push({ ...base, type: 'count_basis_change', from: previous.counting.status, to: next.counting.status });
  } else {
    const [before, after] = comparableTotals(previous, next);
    const lowered = next.candidates.some((candidate) => {
      const old = previous.candidates.find((item) => item.candidateId === candidate.candidateId);
      return old && old.votes !== null && candidate.votes !== null && candidate.votes < old.votes;
    });
    if (before !== null && after !== null && (after < before || lowered)) changes.push({ ...base, type: 'correction', delta: after - before });
    else if (before !== after && after !== null) changes.push({ ...base, type: 'new_batch', delta: before === null ? null : after - before });
  }
  const [was, is] = [previous.decision, next.decision];
  if (isDecided(was) && !isDecided(is)) changes.push({ ...base, type: 'call_rescinded', authority: was.authority });
  else if (isDecided(was) && winners(was) !== winners(is)) changes.push({ ...base, type: 'decision_changed', authority: is.authority });
  else if (is.status === 'certified' && was.status !== 'certified') changes.push({ ...base, type: 'certification', authority: is.authority });
  else if (is.status === 'provider_called' && was.status !== 'provider_called') changes.push({ ...base, type: 'call', authority: is.authority });
  const pair = (race) => (race.twoCandidate?.candidates || []).map((item) => item.candidateId).join(' ');
  if (previous.twoCandidate?.status === 'available' && next.twoCandidate?.status === 'available' && pair(previous) !== pair(next)) {
    changes.push({ ...base, type: 'tcp_pair_change' });
  }
  return changes;
}

/**
 * One authoritative race per contest: the first listed source that still has it,
 * as a whole. Copies from other sources are never added or merged.
 */
export function resolveRaces(sourceOrder, racesBySource) {
  const resolved = new Map();
  for (const sourceId of sourceOrder) {
    for (const race of racesBySource[sourceId] || []) {
      if (!resolved.has(race.raceId)) resolved.set(race.raceId, race);
    }
  }
  return [...resolved.values()];
}

/* ---------- What the page shows ---------- */

export function primaryLeader(race) {
  // With any candidate unknown, nobody can be said to lead.
  if (race.candidates.some((candidate) => candidate.votes === null)) return null;
  const counted = race.candidates.filter((candidate) => candidate.votes > 0);
  if (!counted.length) return null;
  const top = Math.max(...counted.map((candidate) => candidate.votes));
  const leaders = counted.filter((candidate) => candidate.votes === top);
  return leaders.length === 1 ? leaders[0] : null;
}

/** The named leader on the contest's published basis, or null on a tie or with no such count. */
export function contestLeader(race) {
  // A first-round lead says nothing about the ranked-choice count or runoff that decides the seat.
  if (race.counting?.method === 'rcv' || race.counting?.status === 'rcv_pending' || race.counting?.status === 'runoff') return null;
  if (race.leaderBasis === 'votes') return primaryLeader(race);
  if (race.leaderBasis !== 'tcp' || race.twoCandidate?.status !== 'available') return null;
  const [first, second] = race.twoCandidate.candidates;
  if (first.votes === null || second.votes === null || first.votes === second.votes) return null;
  const id = first.votes > second.votes ? first.candidateId : second.candidateId;
  return race.candidates.find((candidate) => candidate.candidateId === id) || null;
}

/** seatId -> mark state for chamberSvg and mapSvg. A multi-member contest has no per-seat result, so stays neutral. */
export function seatStates(snapshot, pointer = null) {
  const states = {};
  for (const race of snapshot?.races || []) {
    if (race.coverage === 'not_covered' || race.coverage === 'source_error') {
      for (const seatId of race.seatIds) states[seatId] = { status: 'unavailable' };
    } else if (race.seatIds.length === 1) {
      const decided = isDecided(race.decision);
      const winner = decided && race.candidates.find((candidate) => candidate.candidateId === race.decision.candidateIds[0]);
      if (winner) {
        states[race.seatIds[0]] = race.decision.status === 'certified'
          ? { status: 'final', party: winner.partyId, record: race.decision }
          : { status: 'called', party: winner.partyId };
      } else {
        const leader = contestLeader(race);
        if (leader) states[race.seatIds[0]] = { status: 'leading', party: leader.partyId };
      }
      // Marks must not look fresh when the data under them is not.
      const seatState = states[race.seatIds[0]];
      if (seatState && raceFreshness(race, pointer) === 'stale') seatState.stale = true;
    }
  }
  return states;
}

export function raceIndex(snapshot) {
  const index = new Map();
  for (const race of snapshot?.races || []) {
    for (const seatId of race.seatIds) index.set(seatId, race);
  }
  return index;
}

/** Seats per party, decided apart from leading. Never a statement about who controls a chamber. */
export function partyTally(seats, states, parties) {
  const tally = Object.fromEntries(parties.map((party) => [party.id, { decided: 0, leading: 0 }]));
  for (const seat of seats) {
    const state = states[seat.seatId];
    const entry = state && tally[state.party];
    if (!entry || !seat.onBallot) continue;
    if (state.status === 'leading') entry.leading += 1;
    else if (state.status === 'called' || state.status === 'final') entry.decided += 1;
  }
  return tally;
}

/** Seats with a race in the snapshot. A stale one counts: it says so itself. */
export function coveredSeats(seats, races) {
  return seats.filter((seat) => {
    const coverage = seat.onBallot ? races.get(seat.seatId)?.coverage : undefined;
    return coverage !== undefined && coverage !== 'not_covered' && coverage !== 'source_error';
  }).length;
}

/** A race is stale when it was carried over, or its source has failed since. Never just because time passed. */
export function raceFreshness(race, pointer) {
  if (race.coverage === 'stale' || race.coverage === 'source_error') return 'stale';
  const source = pointer?.sources?.find((item) => item.sourceId === race.provenance.sourceId);
  const feed = source?.feeds?.find((item) => item.office === race.office);
  return (feed || source)?.status === 'error' ? 'stale' : 'fresh';
}

/** Age in seconds, or null when the source gave no time or the time is ahead of the clock. */
export function ageSeconds(time, now) {
  if (!time) return null;
  const age = Math.round((now - Date.parse(time)) / 1000);
  return Number.isNaN(age) || age < 0 ? null : age;
}
