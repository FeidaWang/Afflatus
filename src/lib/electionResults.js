/* ============================================================
   Election result semantics, shared by the collector and the page.
   Coverage, counting and decision stay three separate states. Unknown is null,
   a lead is never a call, and a call needs a named authority and a time.
   ============================================================ */
import { sourceById } from '../config/electionSources.js';

const COVERAGE = new Set(['not_covered', 'available', 'stale', 'source_error']);
const COUNTING = new Set(['no_votes', 'counting', 'rcv_pending', 'runoff', 'recount', 'count_complete']);
const DECISION = new Set(['uncalled', 'provider_called', 'certified', 'call_rescinded']);
const MODES = new Set(['preview', 'live']);

const isTime = (value) => value === null || (typeof value === 'string' && !Number.isNaN(Date.parse(value)));
const isCount = (value) => value === null || (Number.isInteger(value) && value >= 0);

function raceErrors(race) {
  const errors = [];
  const name = race?.raceId || 'race';
  if (!race?.raceId || !Array.isArray(race.seatIds) || !race.seatIds.length) return [`${name}: missing identity`];
  if (!COVERAGE.has(race.coverage)) errors.push(`${name}: coverage`);
  if (!COUNTING.has(race.counting?.status)) errors.push(`${name}: counting`);
  if (!Array.isArray(race.candidates)) return [...errors, `${name}: candidates`];
  const ids = new Set(race.candidates.map((candidate) => candidate.candidateId));
  if (ids.size !== race.candidates.length) errors.push(`${name}: duplicate candidate`);
  if (!race.candidates.every((candidate) => isCount(candidate.votes))) errors.push(`${name}: votes`);
  const decision = race.decision;
  if (!DECISION.has(decision?.status)) errors.push(`${name}: decision`);
  if (decision?.status === 'provider_called' || decision?.status === 'certified') {
    const when = decision.decidedAt || decision.firstObservedAt;
    if (!decision.authority || !when || !isTime(when)) errors.push(`${name}: a decision needs an authority and a time`);
    if (race.office !== 'council' && !decision.candidateIds?.length) errors.push(`${name}: a decision needs a candidate`);
    if (decision.candidateIds?.some((id) => !ids.has(id))) errors.push(`${name}: decision names an unknown candidate`);
  }
  for (const key of ['sourceUpdatedAt', 'fetchedAt', 'publishedAt']) {
    if (!isTime(race.provenance?.[key] ?? null)) errors.push(`${name}: ${key}`);
  }
  return errors;
}

export function snapshotErrors(snapshot) {
  if (!snapshot || snapshot.schemaVersion !== 1) return ['schema version'];
  const errors = [];
  if (!snapshot.snapshotId || !snapshot.eventId) errors.push('identity');
  if (!MODES.has(snapshot.mode)) errors.push('mode');
  if (typeof snapshot.isSynthetic !== 'boolean') errors.push('isSynthetic');
  if (snapshot.mode === 'live' && snapshot.isSynthetic) errors.push('synthetic data cannot be live');
  if (!Array.isArray(snapshot.races)) return [...errors, 'races'];
  const ids = new Set(snapshot.races.map((race) => race.raceId));
  if (ids.size !== snapshot.races.length) errors.push('duplicate race');
  return [...errors, ...snapshot.races.flatMap(raceErrors)];
}

export function pointerErrors(pointer) {
  if (!pointer || pointer.schemaVersion !== 1) return ['schema version'];
  const errors = [];
  if (!pointer.eventId || !Number.isInteger(pointer.revision)) errors.push('identity');
  if (!pointer.snapshotId || !/^[\w.-]+$/.test(pointer.snapshotId)) errors.push('snapshot id');
  if (!Array.isArray(pointer.history) || !Array.isArray(pointer.sources)) errors.push('history');
  else if (!pointer.history.every((entry) => /^[\w.-]+$/.test(entry.snapshotId))) errors.push('history id');
  return errors;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
export const isLocalHost = (hostname) => LOCAL_HOSTS.has(hostname);

/**
 * The publication gate. On a public host a snapshot must be real and every source
 * in it must have a written yes. Synthetic data only ever renders on this computer.
 */
export function feedAllowed(document, hostname) {
  if (document.isSynthetic) return isLocalHost(hostname);
  return (document.sourceIds || []).length > 0 && document.sourceIds.every((id) => {
    const source = sourceById(id);
    return Boolean(source?.enabled && source.publicRedistributionAllowed && !source.synthetic);
  });
}

/* ---------- Change events ---------- */

const totalVotes = (race) => race.totals?.total ?? race.totals?.formal ?? (race.candidates.some((c) => c.votes !== null) ? race.candidates.reduce((sum, c) => sum + (c.votes ?? 0), 0) : null);
const isDecided = (decision) => decision?.status === 'provider_called' || decision?.status === 'certified';

/** Compares one race across two snapshots. A source switch resets the baseline, so no delta is reported. */
export function raceChanges(previous, next, at) {
  if (!previous) return [];
  const base = { raceId: next.raceId, at };
  const changes = [];
  if (previous.provenance.sourceId !== next.provenance.sourceId) {
    changes.push({ ...base, type: 'source_switch', from: previous.provenance.sourceId, to: next.provenance.sourceId });
  } else if ((previous.counting.round ?? null) !== (next.counting.round ?? null)) {
    changes.push({ ...base, type: 'rcv_transition', from: previous.counting.round ?? null, to: next.counting.round ?? null });
  } else {
    const [before, after] = [totalVotes(previous), totalVotes(next)];
    const lowered = next.candidates.some((candidate) => {
      const old = previous.candidates.find((item) => item.candidateId === candidate.candidateId);
      return old && old.votes !== null && candidate.votes !== null && candidate.votes < old.votes;
    });
    if (before !== null && after !== null && (after < before || lowered)) changes.push({ ...base, type: 'correction', delta: after - before });
    else if (before !== after && after !== null) changes.push({ ...base, type: 'new_batch', delta: before === null ? null : after - before });
  }
  const [was, is] = [previous.decision, next.decision];
  if (isDecided(was) && !isDecided(is)) changes.push({ ...base, type: 'call_rescinded', authority: was.authority });
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
  const counted = race.candidates.filter((candidate) => candidate.votes !== null && candidate.votes > 0);
  if (!counted.length) return null;
  const top = Math.max(...counted.map((candidate) => candidate.votes));
  const leaders = counted.filter((candidate) => candidate.votes === top);
  return leaders.length === 1 ? leaders[0] : null;
}

/** The named leader on the contest's published basis, or null on a tie or with no such count. */
export function contestLeader(race) {
  if (race.leaderBasis === 'votes') return primaryLeader(race);
  if (race.leaderBasis !== 'tcp' || race.twoCandidate?.status !== 'available') return null;
  const [first, second] = race.twoCandidate.candidates;
  if (first.votes === null || second.votes === null || first.votes === second.votes) return null;
  const id = first.votes > second.votes ? first.candidateId : second.candidateId;
  return race.candidates.find((candidate) => candidate.candidateId === id) || null;
}

/** seatId -> mark state for chamberSvg and mapSvg. A multi-member contest has no per-seat result, so stays neutral. */
export function seatStates(snapshot) {
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
  return seats.filter((seat) => seat.onBallot && races.has(seat.seatId) && races.get(seat.seatId).coverage !== 'not_covered').length;
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
