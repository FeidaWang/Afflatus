/* ============================================================
   civicAPI, read straight from the visitor's browser. Nothing is stored or
   re-served by this site. Each read of the House and Senate races becomes one
   snapshot in the shared contract, so the same validation, publication gate and
   refresh rules apply as for any other source. Known gaps (docs/elections/M9.md):
   no per-race time, no call time, and "winner" is civicAPI's own call.
   ============================================================ */
import { sourceById } from '../config/electionSources.js';
import { seatCatalogue } from './electionCatalogue.js';
import { eventById } from './electionRules.js';
import { raceChanges, snapshotProblems } from './electionResults.js';

export const CIVIC_BASE = 'civicapi:';
const API = 'https://civicapi.org/api/v2/race/';
const EVENT_ID = 'us-2026';
// Both statewide contests in Alaska and Maine are counted by ranked choice.
const RCV_STATES = new Set(['AK', 'ME']);

const partyId = (party) => (/^democrat/i.test(party || '') ? 'dem' : /^republican/i.test(party || '') ? 'rep' : 'other');

/** One civicAPI region (a district or a state) as a race in the shared contract, or null if it has no seat on this ballot. */
function regionRace({ office, seat, region, raceUrl, fetchedAt, round }) {
  const candidates = (region.candidates || []).map((candidate) => ({
    candidateId: `c${candidate.candidate_id}`,
    name: candidate.name,
    party: candidate.party || null,
    partyId: partyId(candidate.party),
    votes: Number.isInteger(candidate.votes) && candidate.votes >= 0 ? candidate.votes : null,
    ballotPosition: null,
  }));
  const winners = (region.candidates || []).filter((candidate) => candidate.winner).map((candidate) => `c${candidate.candidate_id}`);
  const advanced = (region.candidates || []).some((candidate) => candidate.advanced);
  const known = candidates.every((candidate) => candidate.votes !== null);
  const sum = known ? candidates.reduce((total, candidate) => total + candidate.votes, 0) : null;
  const rcv = RCV_STATES.has(seat.group);
  const percent = typeof region.percent_reporting === 'number' && region.percent_reporting >= 0 ? Math.round(region.percent_reporting) : null;
  return {
    raceId: `${EVENT_ID}/${office}/${seat.seatId}`,
    eventId: EVENT_ID,
    electionDate: eventById(EVENT_ID).pollDate,
    office,
    seatIds: [seat.seatId],
    contestName: region.name || seat.label.en,
    ...(seat.contest ? { contestKind: seat.contest } : {}),
    ...(seat.term ? { targetTerm: seat.term } : {}),
    candidates,
    totals: { formal: sum, informal: null, total: null },
    twoCandidate: null,
    leaderBasis: 'votes',
    coverage: 'available',
    counting: {
      method: rcv ? 'rcv' : 'plurality',
      status: advanced && !winners.length ? 'runoff' : sum === 0 ? 'no_votes' : 'counting',
      round: rcv ? round : null,
    },
    decision: winners.length
      // civicAPI publishes no call time, so the time is when this page first read the call, and the page says so.
      ? { status: 'provider_called', candidateIds: winners, authority: 'civicAPI', evidenceUrl: raceUrl, decidedAt: null, firstObservedAt: fetchedAt, callTimeUnpublished: true }
      : { status: 'uncalled', candidateIds: [], authority: null, evidenceUrl: null, decidedAt: null, firstObservedAt: null },
    progress: { unit: 'percent', reported: percent, total: percent === null ? null : 100, isEstimate: true },
    // civicAPI dates the whole race, never one district, so no contest has a time of its own.
    provenance: { sourceId: 'civicapi', sourceUrl: raceUrl, sourceUpdatedAt: null, fetchedAt, publishedAt: null },
  };
}

/** The races in one civicAPI race document, joined to this cycle's catalogue. */
export function civicRaces(document, office, { raceUrl, fetchedAt }) {
  const expected = office === 'house' ? 'House of Representatives' : 'US Senate';
  if (document?.test_data !== false) throw new Error('civicAPI returned test data');
  if (document.election_type !== expected || document.country !== 'US') throw new Error(`civicAPI ${office}: wrong race`);
  if (!String(document.election_date || '').startsWith(eventById(EVENT_ID).pollDate)) throw new Error(`civicAPI ${office}: wrong election date`);
  const seats = seatCatalogue(EVENT_ID, office).filter((seat) => seat.onBallot);
  // House regions are named like "ca-01"; Senate regions by state, with one contest per state this cycle.
  const seatFor = office === 'house'
    ? (key) => seats.find((seat) => seat.seatId === key.toUpperCase())
    : (key) => seats.find((seat) => seat.group === key.toUpperCase());
  const round = Number.isInteger(document.round) && document.round >= 1 ? document.round : 1;
  return Object.entries(document.region_results || {}).flatMap(([key, region]) => {
    const seat = seatFor(key);
    return seat ? [regionRace({ office, seat, region, raceUrl, fetchedAt, round })] : [];
  });
}

/**
 * A fetchJson for the feed controller. It answers the controller's pointer read by
 * reading civicAPI, and its snapshot read from what that produced, so the
 * controller's checks run unchanged. A race that fails validation is left out on its own.
 */
export function createCivicReader({ fetchJson, now = Date.now, raceIds = sourceById('civicapi').raceIds }) {
  const snapshots = new Map();
  let revision = 0;
  let previous = null;
  let lastSuccessAt = null;
  const seen = new Map();

  async function read() {
    const fetchedAt = new Date(now()).toISOString();
    const offices = await Promise.all(Object.entries(raceIds).map(async ([office, id]) => {
      const raceUrl = `${API}${id}`;
      const document = await fetchJson(raceUrl);
      if (document === null) throw new Error(`civicAPI ${office}: not found`);
      return { races: civicRaces(document, office, { raceUrl, fetchedAt }), updated: document.last_updated };
    }));
    const races = offices.flatMap((item) => item.races).map((race) => {
      // A call keeps the time this page first read it, not the time of each later read.
      if (race.decision.status !== 'provider_called') return race;
      const key = `${race.raceId} ${race.decision.candidateIds.join(' ')}`;
      if (!seen.has(key)) seen.set(key, fetchedAt);
      return { ...race, decision: { ...race.decision, firstObservedAt: seen.get(key) } };
    });
    revision += 1;
    const snapshotId = `civicapi-${revision}`;
    const draft = { schemaVersion: 1, snapshotId, eventId: EVENT_ID, mode: 'live', isSynthetic: false, sourceIds: ['civicapi'], publishedAt: fetchedAt, races, changes: [] };
    const { errors, races: rejected } = snapshotProblems(draft);
    if (errors.length) throw new Error(`civicAPI: ${errors[0]}`);
    const kept = races.filter((race) => !rejected.has(race.raceId));
    const before = new Map((previous?.races || []).map((race) => [race.raceId, race]));
    const snapshot = { ...draft, races: kept, changes: kept.flatMap((race) => raceChanges(before.get(race.raceId), race, fetchedAt)), rejected: [...rejected.keys()] };
    snapshots.clear();
    snapshots.set(snapshotId, snapshot);
    previous = snapshot;
    lastSuccessAt = fetchedAt;
    const times = offices.map((item) => item.updated).filter((time) => !Number.isNaN(Date.parse(time ?? ''))).sort();
    return {
      schemaVersion: 1,
      eventId: EVENT_ID,
      revision,
      snapshotId,
      publishedAt: fetchedAt,
      isSynthetic: false,
      sourceIds: ['civicapi'],
      // Nothing is recorded between reads, so there is nothing to replay.
      history: [],
      sources: [{ sourceId: 'civicapi', name: 'civicAPI', url: 'https://civicapi.org', status: 'ok', lastCheckedAt: fetchedAt, lastSuccessAt, sourceUpdatedAt: times.at(-1) || null }],
    };
  }

  return (url) => {
    if (url === `${CIVIC_BASE}${EVENT_ID}/latest.json`) return read();
    const match = url.match(/^civicapi:us-2026\/snapshots\/([\w.-]+)\.json$/);
    if (match && snapshots.has(match[1])) return Promise.resolve(snapshots.get(match[1]));
    return Promise.resolve(null);
  };
}
