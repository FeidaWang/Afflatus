// Invented civicAPI documents in the published shape. No real names or counts.
import { seatCatalogue } from '../../src/lib/electionCatalogue.js';

const person = (id, name, party, votes, extra = {}) => ({
  name, candidate_id: id, party, votes, percent: null, color: '#808080', winner: false, advanced: false, incumbent: false, major_candidate: true, ...extra,
});

/** One region. `winner` is 'd', 'r' or null; `votes` are [dem, rep]. */
export function civicRegion(key, { votes = [600, 400], winner = null, percent = 80, advanced = false } = {}) {
  const base = key.length * 1000 + key.charCodeAt(0) * 10 + key.charCodeAt(key.length - 1);
  return {
    name: `Test region ${key}`,
    type: 'Test region',
    fill: '#808080',
    election_id: base,
    percent_reporting: percent,
    candidates: [
      person(base * 10 + 1, `Test Dem ${key}`, 'Democratic', votes[0], { winner: winner === 'd', advanced }),
      person(base * 10 + 2, `Test Rep ${key}`, 'Republican', votes[1], { winner: winner === 'r', advanced }),
    ],
  };
}

const document = (type, regions) => ({
  election_name: `Test ${type}`,
  election_type: type,
  election_scope: 'General',
  election_date: '2026-11-03T05:00:00.000Z',
  country: 'US',
  province: 'US',
  test_data: false,
  last_updated: '2026-11-06T13:07:00.000Z',
  round: 1,
  candidates: [],
  region_results: regions,
});

/** Every House district and every Senate contest, with `overrides` by civicAPI key. */
export function civicHouse(overrides = {}) {
  const regions = Object.fromEntries(seatCatalogue('us-2026', 'house').map((seat) => [seat.seatId.toLowerCase(), civicRegion(seat.seatId.toLowerCase())]));
  return document('House of Representatives', { ...regions, ...overrides });
}

export function civicSenate(overrides = {}) {
  const states = seatCatalogue('us-2026', 'senate').filter((seat) => seat.onBallot).map((seat) => seat.group.toLowerCase());
  return document('US Senate', { ...Object.fromEntries(states.map((key) => [key, civicRegion(key)])), ...overrides });
}
