import { describe, expect, it, vi } from 'vitest';
import { ELECTION_FEED_BASE, ELECTION_SOURCES } from '../src/config/electionSources.js';
import { PARTIES } from '../src/lib/electionRules.js';
import { seatCatalogue } from '../src/lib/electionCatalogue.js';
import { seatMark, tallySeats } from '../src/lib/chamberLayout.js';
import {
  ageSeconds, contestLeader, coveredSeats, feedAllowed, isLocalHost, partyTally, pointerErrors, primaryLeader, raceChanges, raceFreshness, raceIndex, resolveRaces, seatStates, snapshotErrors, snapshotProblems,
} from '../src/lib/electionResults.js';
import { HIDDEN_CHECK_MS, VISIBLE_CHECK_MS, createFeedController } from '../src/lib/electionFeed.js';

const candidate = (id, votes, partyId = 'dem') => ({ candidateId: id, name: id, party: partyId, partyId, votes });
const race = (overrides = {}) => ({
  raceId: 'us-2026/house/NC-01',
  eventId: 'us-2026',
  electionDate: '2026-11-03',
  office: 'house',
  seatIds: ['NC-01'],
  candidates: [candidate('a', 100, 'dem'), candidate('b', 90, 'rep')],
  totals: { formal: 190, informal: null, total: null },
  twoCandidate: null,
  leaderBasis: 'votes',
  coverage: 'available',
  counting: { method: 'plurality', status: 'counting', round: null },
  decision: { status: 'uncalled', candidateIds: [], authority: null, evidenceUrl: null, decidedAt: null, firstObservedAt: null },
  progress: { unit: 'precincts', reported: 10, total: 20, isEstimate: false },
  provenance: { sourceId: 'test', sourceUrl: null, sourceUpdatedAt: '2026-11-04T01:00:00.000Z', fetchedAt: '2026-11-04T01:01:00.000Z', publishedAt: null },
  ...overrides,
});
const called = (candidateId = 'a') => ({ status: 'provider_called', candidateIds: [candidateId], authority: 'Provider X', evidenceUrl: 'https://example.org', decidedAt: '2026-11-04T02:00:00.000Z', firstObservedAt: null });
const certified = (candidateId = 'a') => ({ status: 'certified', candidateIds: [candidateId], authority: 'State board', evidenceUrl: 'https://example.org', decidedAt: null, firstObservedAt: '2026-11-20T02:00:00.000Z' });
const senateRace = (seatId, targetTerm) => race({ raceId: `us-2026/senate/${seatId}`, office: 'senate', seatIds: [seatId], targetTerm });
const snapshot = (overrides = {}) => ({ schemaVersion: 1, snapshotId: 's1', eventId: 'us-2026', mode: 'preview', isSynthetic: true, sourceIds: ['vec-sample'], races: [race()], ...overrides });

describe('snapshot validation', () => {
  it('accepts a coherent snapshot', () => {
    expect(snapshotErrors(snapshot())).toEqual([]);
  });

  it('accepts a runoff or postponed contest on its own later date in the same cycle (synthetic)', () => {
    const runoff = race({ raceId: 'us-2026/house/LA-01', seatIds: ['LA-01'], contestKind: 'runoff', electionDate: '2026-12-05', counting: { method: 'plurality', status: 'counting', round: null } });
    const postponed = race({ raceId: 'us-2026/house/LA-02', seatIds: ['LA-02'], contestKind: 'postponed', electionDate: '2026-11-17' });
    expect(snapshotErrors(snapshot({ races: [race(), runoff, postponed] }))).toEqual([]);
    // Australian events have no runoff date window.
    const vic = race({ raceId: 'vic-2026/assembly/kew', eventId: 'vic-2026', office: 'assembly', seatIds: ['kew'], contestKind: 'runoff', electionDate: '2026-12-05' });
    expect(snapshotErrors(snapshot({ eventId: 'vic-2026', races: [vic] }))).toContain('vic-2026/assembly/kew: wrong election date');
  });

  it('attributes each problem to its own race, and an unidentified race to the whole snapshot', () => {
    const good = race();
    const bad = race({ raceId: 'us-2026/house/NC-02', seatIds: ['NC-02'], electionDate: '2024-11-05' });
    const { errors, races } = snapshotProblems(snapshot({ races: [good, bad] }));
    expect(errors).toEqual([]);
    expect([...races.keys()]).toEqual(['us-2026/house/NC-02']);
    expect(snapshotProblems(snapshot({ races: [good, { ...bad, raceId: null }] })).errors.length).toBeGreaterThan(0);
  });

  it.each([
    ['synthetic data marked live', { mode: 'live' }],
    ['an unknown schema', { schemaVersion: 2 }],
    ['no identity', { snapshotId: null }],
    ['a duplicate race', { races: [race(), race()] }],
    ['a zero-for-missing type', { races: [race({ candidates: [candidate('a', '100')] })] }],
    ['negative votes', { races: [race({ candidates: [candidate('a', -1)] })] }],
    ['a duplicate candidate', { races: [race({ candidates: [candidate('a', 1), candidate('a', 2)] })] }],
    ['a call with no authority', { races: [race({ decision: { ...called(), authority: null } })] }],
    ['a call with no time', { races: [race({ decision: { ...called(), decidedAt: null } })] }],
    ['a call for nobody', { races: [race({ decision: { ...called(), candidateIds: [] } })] }],
    ['a call for a stranger', { races: [race({ decision: called('z') })] }],
    ['an impossible coverage state', { races: [race({ coverage: 'final' })] }],
    ['a bad source time', { races: [race({ provenance: { ...race().provenance, sourceUpdatedAt: 'yesterday' } })] }],
    ['a call with no evidence', { races: [race({ decision: { ...called(), evidenceUrl: null } })] }],
    ['two winners for one seat', { races: [race({ decision: { ...called(), candidateIds: ['a', 'b'] } })] }],
    ['an uncalled race with a winner', { races: [race({ decision: { ...race().decision, candidateIds: ['a'] } })] }],
    ['a rescission with no authority', { races: [race({ decision: { ...race().decision, status: 'call_rescinded', firstObservedAt: '2026-11-04T03:00:00.000Z' } })] }],
    ['a rescission with no time', { races: [race({ decision: { ...race().decision, status: 'call_rescinded', authority: 'Provider X' } })] }],
    ['votes as a numeric string', { races: [race({ candidates: [candidate('a', '1,200')] })] }],
    ['fractional votes', { races: [race({ candidates: [candidate('a', 1.5)] })] }],
    ['a numeric string in progress', { races: [race({ progress: { ...race().progress, reported: '10' } })] }],
    ['an RCV count with no round', { races: [race({ counting: { method: 'rcv', status: 'counting', round: null } })] }],
    ['last cycle returned for this one', { races: [race({ electionDate: '2024-11-05' })] }],
    ['a regular contest dated after polling day', { races: [race({ electionDate: '2026-12-12' })] }],
    ['a runoff before polling day', { races: [race({ contestKind: 'runoff', electionDate: '2026-10-01' })] }],
    ['a runoff after the new term begins', { races: [race({ contestKind: 'runoff', electionDate: '2027-01-05' })] }],
    ['a runoff with a time instead of a date', { races: [race({ contestKind: 'runoff', electionDate: '2026-12-12T00:00:00Z' })] }],
    ['another event in this snapshot', { races: [race({ eventId: 'us-2028' })] }],
    ['an event that does not exist', { eventId: 'us-2024' }],
    ['a seat from outside the catalogue', { races: [race({ seatIds: ['NC-15'] })] }],
    ['one seat in two races', { races: [race(), race({ raceId: 'us-2026/house/NC-01-copy' })] }],
    ['a Senate seat not on this ballot', { races: [senateRace('NC-S2', '2027-2033')] }],
    ['a regular contest with the special term', { races: [senateRace('NC-S1', 'to-2029-01-03')] }],
    ['a special contest with the regular term', { races: [senateRace('OH-S1', '2027-2033')] }],
  ])('rejects %s', (_name, overrides) => {
    expect(snapshotErrors(snapshot(overrides)).length).toBeGreaterThan(0);
  });

  it.each([
    ['part of a multi-member region', { raceId: 'vic-2026/council/x', eventId: 'vic-2026', electionDate: '2026-11-28', office: 'council', seatIds: ['eastern-victoria-1'], positions: 5 }],
    ['a declaration by a media outlet', { raceId: 'vic-2026/assembly/kew', eventId: 'vic-2026', electionDate: '2026-11-28', office: 'assembly', seatIds: ['kew'], decision: { ...certified(), authority: 'A News Desk' } }],
    ['evidence that is not a link', { decision: { ...called(), evidenceUrl: 'TBC' } }],
  ])('rejects %s', (_name, overrides) => {
    const eventId = overrides.eventId || 'us-2026';
    expect(snapshotErrors(snapshot({ eventId, races: [race(overrides)] })).length).toBeGreaterThan(0);
  });

  it.each([
    ['markup in a two-candidate count', { races: [race({ twoCandidate: { status: 'available', candidates: [{ candidateId: 'a', votes: '<img>' }, { candidateId: 'b', votes: 1 }] } })] }],
    ['an unknown change type', { changes: [{ type: 'mystery', raceId: 'x' }] }],
    ['markup in a change delta', { changes: [{ type: 'new_batch', raceId: 'x', delta: '<img>' }] }],
  ])('rejects %s', (_name, overrides) => {
    expect(snapshotErrors(snapshot(overrides)).length).toBeGreaterThan(0);
  });

  it('rejects a pointer with an unreadable time', () => {
    const pointer = { schemaVersion: 1, eventId: 'x', revision: 1, snapshotId: 's1', history: [], sources: [{ lastCheckedAt: 'soon' }] };
    expect(pointerErrors(pointer)).toContain('source time');
  });

  it('accepts a declaration by the commission that runs the election', () => {
    const declared = race({ raceId: 'vic-2026/assembly/kew', eventId: 'vic-2026', electionDate: '2026-11-28', office: 'assembly', seatIds: ['kew'], decision: { ...certified(), authority: 'VEC' } });
    expect(snapshotErrors(snapshot({ eventId: 'vic-2026', races: [declared] }))).toEqual([]);
  });

  it('accepts regular and special contests on their own terms', () => {
    expect(snapshotErrors(snapshot({ races: [senateRace('NC-S1', '2027-2033'), senateRace('OH-S1', 'to-2029-01-03')] }))).toEqual([]);
  });

  it('accepts an unopposed winner with no votes reported', () => {
    const unopposed = race({ candidates: [candidate('a', 0)], counting: { method: 'plurality', status: 'no_votes', round: null }, decision: called() });
    expect(snapshotErrors(snapshot({ races: [unopposed] }))).toEqual([]);
  });

  it('allows null for every unknown', () => {
    const unknown = race({ candidates: [candidate('a', null)], provenance: { sourceId: 'x', sourceUpdatedAt: null, fetchedAt: null, publishedAt: null } });
    expect(snapshotErrors(snapshot({ races: [unknown] }))).toEqual([]);
  });

  it('rejects a path in a replay history id', () => {
    expect(pointerErrors({ schemaVersion: 1, eventId: 'x', revision: 1, snapshotId: 's1', history: [{ snapshotId: '../secret' }], sources: [] })).toContain('history id');
  });

  it('rejects a pointer with a path in its snapshot id', () => {
    expect(pointerErrors({ schemaVersion: 1, eventId: 'x', revision: 1, snapshotId: '../../etc/passwd', history: [], sources: [] })).toContain('snapshot id');
  });
});

describe('publication gate', () => {
  it('has no feed URL and no source cleared for the public', () => {
    expect(ELECTION_FEED_BASE).toBeNull();
    for (const source of ELECTION_SOURCES) {
      expect(source.publicRedistributionAllowed, source.id).toBe(false);
      expect(source.enabled, source.id).toBe(false);
    }
  });

  it('shows synthetic data only on this computer', () => {
    expect(isLocalHost('127.0.0.1')).toBe(true);
    expect(feedAllowed({ isSynthetic: true, sourceIds: ['vec-sample'] }, '127.0.0.1')).toBe(true);
    expect(feedAllowed({ isSynthetic: true, sourceIds: ['vec-sample'] }, 'feida.au')).toBe(false);
  });

  it('refuses every real source until it has a written yes', () => {
    for (const hostname of ['feida.au', '127.0.0.1']) {
      for (const id of ['vec-2026', 'civicapi', 'vec-sample', 'unknown']) {
        expect(feedAllowed({ isSynthetic: false, sourceIds: [id] }, hostname), `${id} on ${hostname}`).toBe(false);
      }
      expect(feedAllowed({ isSynthetic: false, sourceIds: [] }, hostname)).toBe(false);
    }
  });
});

describe('leaders and calls stay separate', () => {
  it('keeps same-party candidates apart', () => {
    const contest = race({ candidates: [candidate('a', 100, 'dem'), candidate('b', 90, 'dem')] });
    expect(contestLeader(contest).candidateId).toBe('a');
    const states = seatStates({ races: [{ ...contest, decision: called('b') }] });
    expect(states['NC-01']).toEqual({ status: 'called', party: 'dem' });
  });

  it('colours nothing for a write-in with no party, and still draws the seat', () => {
    const writeIn = { candidateId: 'w', name: 'Write-in', party: null, partyId: null, votes: 200 };
    const contest = race({ candidates: [writeIn, candidate('b', 90, 'dem')] });
    const states = seatStates({ races: [contest] });
    const seat = seatCatalogue('us-2026', 'house').find((item) => item.seatId === 'NC-01');
    expect(states['NC-01']).toEqual({ status: 'leading', party: null });
    expect(() => seatMark(seat, states['NC-01'], PARTIES.us)).not.toThrow();
    expect(seatMark(seat, states['NC-01'], PARTIES.us).party).toBeFalsy();
    expect(partyTally([seat], states, PARTIES.us).dem).toEqual({ decided: 0, leading: 0 });
  });

  it.each([
    ['a ranked-choice count pending', { method: 'rcv', status: 'rcv_pending', round: 1 }],
    ['a ranked-choice first round', { method: 'rcv', status: 'counting', round: 1 }],
    ['a race going to a runoff', { method: 'plurality', status: 'runoff', round: null }],
  ])('names no leader with %s', (_name, counting) => {
    const contest = race({ counting });
    expect(contestLeader(contest)).toBeNull();
    expect(seatStates({ races: [contest] })).toEqual({});
  });

  it('names no leader while any candidate is unknown', () => {
    expect(primaryLeader(race({ candidates: [candidate('a', null), candidate('b', 1, 'rep')] }))).toBeNull();
  });

  it('marks a seat stale when its source has failed, so the mark cannot look fresh', () => {
    const pointer = { sources: [{ sourceId: 'test', status: 'error' }] };
    const states = seatStates({ races: [race()] }, pointer);
    expect(states['NC-01']).toMatchObject({ status: 'leading', stale: true });
    const seat = seatCatalogue('us-2026', 'house').find((item) => item.seatId === 'NC-01');
    expect(seatMark(seat, states['NC-01'], PARTIES.us).stale).toBe(true);
    expect(seatStates({ races: [race()] })['NC-01'].stale).toBeUndefined();
  });

  it('does not count a failed source as covered', () => {
    const seats = seatCatalogue('us-2026', 'house').filter((seat) => seat.seatId === 'NC-01');
    expect(coveredSeats(seats, new Map([['NC-01', race({ coverage: 'source_error' })]]))).toBe(0);
    expect(coveredSeats(seats, new Map([['NC-01', race({ coverage: 'stale' })]]))).toBe(1);
  });

  it('does not name a leader on a tie or with nothing counted', () => {
    expect(primaryLeader(race({ candidates: [candidate('a', 5), candidate('b', 5)] }))).toBeNull();
    expect(primaryLeader(race({ candidates: [candidate('a', null), candidate('b', null)] }))).toBeNull();
    expect(primaryLeader(race({ candidates: [candidate('a', 0), candidate('b', 0)] }))).toBeNull();
  });

  it('turns a votes lead into "leading", never a call', () => {
    expect(seatStates(snapshot())['NC-01']).toEqual({ status: 'leading', party: 'dem' });
  });

  it('uses only the published 2CP where that is the basis, not the first-preference leader', () => {
    const tcp = (status, votes = [40, 60]) => race({
      leaderBasis: 'tcp',
      twoCandidate: { status, candidates: status === 'available' ? [{ candidateId: 'a', votes: votes[0] }, { candidateId: 'b', votes: votes[1] }] : [] },
    });
    expect(contestLeader(tcp('available')).candidateId).toBe('b');
    expect(seatStates(snapshot({ races: [tcp('available')] }))['NC-01']).toEqual({ status: 'leading', party: 'rep' });
    expect(seatStates(snapshot({ races: [tcp('withheld')] }))['NC-01']).toBeUndefined();
    expect(seatStates(snapshot({ races: [tcp('absent')] }))['NC-01']).toBeUndefined();
    expect(seatStates(snapshot({ races: [tcp('available', [50, 50])] }))['NC-01']).toBeUndefined();
  });

  it('marks a provider call and a certification differently, for the named winner', () => {
    expect(seatStates(snapshot({ races: [race({ decision: called('b') })] }))['NC-01']).toEqual({ status: 'called', party: 'rep' });
    expect(seatStates(snapshot({ races: [race({ decision: certified('a') })] }))['NC-01']).toMatchObject({ status: 'final', party: 'dem' });
  });

  it('falls back to the lead after a rescission, without any solid mark', () => {
    const rescinded = race({ decision: { status: 'call_rescinded', candidateIds: [], authority: null, evidenceUrl: null, decidedAt: null, firstObservedAt: null } });
    expect(seatStates(snapshot({ races: [rescinded] }))['NC-01'].status).toBe('leading');
  });

  it('never gives a multi-member region a per-seat result', () => {
    const region = race({ raceId: 'r', office: 'council', seatIds: ['r-1', 'r-2'], leaderBasis: null, decision: { ...certified(), candidateIds: ['a'] } });
    expect(seatStates(snapshot({ races: [region] }))).toEqual({});
    expect(raceIndex(snapshot({ races: [region] })).get('r-2')).toBe(region);
  });

  it('marks missing coverage unavailable, not zero', () => {
    const missing = race({ coverage: 'not_covered', candidates: [] });
    expect(seatStates(snapshot({ races: [missing] }))['NC-01']).toEqual({ status: 'unavailable' });
    expect(coveredSeats([{ seatId: 'NC-01', onBallot: true }], raceIndex(snapshot({ races: [missing] })))).toBe(0);
  });

  it('keeps a stale result visible', () => {
    const stale = race({ coverage: 'stale' });
    expect(seatStates(snapshot({ races: [stale] }))['NC-01'].status).toBe('leading');
    expect(raceFreshness(stale, null)).toBe('stale');
    expect(coveredSeats([{ seatId: 'NC-01', onBallot: true }], raceIndex(snapshot({ races: [stale] })))).toBe(1);
  });
});

describe('tallies', () => {
  const seats = seatCatalogue('vic-2026', 'assembly');
  const parties = PARTIES.au;

  it('counts decided and leading apart, and leaves everything else neutral', () => {
    const states = {
      [seats[0].seatId]: { status: 'final', party: 'labor', record: {} },
      [seats[1].seatId]: { status: 'called', party: 'labor' },
      [seats[2].seatId]: { status: 'leading', party: 'labor' },
      [seats[3].seatId]: { status: 'leading', party: 'greens' },
      [seats[4].seatId]: { status: 'unavailable' },
    };
    const tally = partyTally(seats, states, parties);
    expect(tally.labor).toEqual({ decided: 2, leading: 1 });
    expect(tally.greens).toEqual({ decided: 0, leading: 1 });
    expect(tally.coalition).toEqual({ decided: 0, leading: 0 });
    expect(tallySeats(seats, states, parties)).toMatchObject({ final: 1, called: 1, leading: 2, unavailable: 1, neutral: 83 });
  });

  it('holds a final mark to needing a record', () => {
    const [seat] = seats;
    expect(seatMark(seat, { status: 'final', party: 'labor' }, parties).status).toBe('called');
    expect(seatMark(seat, { status: 'final', party: 'labor', record: {} }, parties).status).toBe('final');
  });
});

describe('change events', () => {
  const at = '2026-11-04T03:00:00.000Z';
  const types = (before, after) => raceChanges(before, after, at).map((change) => change.type);

  it('reports nothing for the first snapshot or when nothing changed', () => {
    expect(raceChanges(undefined, race(), at)).toEqual([]);
    expect(raceChanges(race(), race(), at)).toEqual([]);
  });

  it('calls a higher total a new batch and a lower one a correction', () => {
    const more = race({ totals: { formal: 200, informal: null, total: null }, candidates: [candidate('a', 105), candidate('b', 95, 'rep')] });
    expect(raceChanges(race(), more, at)[0]).toMatchObject({ type: 'new_batch', delta: 10 });
    const less = race({ totals: { formal: 180, informal: null, total: null }, candidates: [candidate('a', 90), candidate('b', 90, 'rep')] });
    expect(raceChanges(race(), less, at)[0]).toMatchObject({ type: 'correction', delta: -10 });
  });

  it('treats one candidate falling as a correction even when the total rises', () => {
    const shifted = race({ totals: { formal: 195, informal: null, total: null }, candidates: [candidate('a', 95), candidate('b', 100, 'rep')] });
    expect(types(race(), shifted)).toEqual(['correction']);
  });

  it('resets the baseline on a source switch instead of inventing a vote dump', () => {
    const other = race({ totals: { formal: 900, informal: null, total: null }, provenance: { ...race().provenance, sourceId: 'other' } });
    const changes = raceChanges(race(), other, at);
    expect(changes).toEqual([{ raceId: other.raceId, at, type: 'source_switch', from: 'test', to: 'other' }]);
  });

  it('does not compare across RCV rounds', () => {
    const before = race({ counting: { method: 'rcv', status: 'rcv_pending', round: 1 } });
    const after = race({ counting: { method: 'rcv', status: 'counting', round: 2 }, totals: { formal: 50, informal: null, total: null } });
    expect(types(before, after)).toEqual(['rcv_transition']);
  });

  it('separates call, rescission and certification', () => {
    expect(types(race(), race({ decision: called() }))).toEqual(['call']);
    expect(types(race({ decision: called() }), race())).toEqual(['call_rescinded']);
    expect(types(race({ decision: called() }), race({ decision: certified() }))).toEqual(['certification']);
    expect(types(race({ decision: certified() }), race({ decision: { ...race().decision, status: 'call_rescinded' } }))).toEqual(['call_rescinded']);
  });

  it('reports a declared winner changing, even with the same status', () => {
    const before = race({ decision: certified('a') });
    const after = race({ decision: certified('b') });
    expect(raceChanges(before, after, 'now').map((change) => change.type)).toEqual(['decision_changed']);
  });

  it.each([
    ['a recount', { counting: { method: 'plurality', status: 'recount', round: null }, totals: { formal: 200, informal: null, total: null } }],
    ['a runoff', { counting: { method: 'plurality', status: 'runoff', round: null }, totals: { formal: 50, informal: null, total: null } }],
    ['another method', { counting: { method: 'rcv', status: 'counting', round: null }, totals: { formal: 50, informal: null, total: null } }],
    ['another term', { targetTerm: 'to-2029-01-03', totals: { formal: 50, informal: null, total: null } }],
  ])('invents no batch or correction across %s', (_name, overrides) => {
    const types = raceChanges(race(), race(overrides), 'now').map((change) => change.type);
    expect(types).toEqual(['count_basis_change']);
  });

  it('reports nothing when a total can no longer be known', () => {
    const before = race({ candidates: [candidate('a', 10), candidate('b', 5, 'rep')], totals: null });
    const after = race({ candidates: [candidate('a', null), candidate('b', 6, 'rep')], totals: null });
    expect(raceChanges(before, after, 'now')).toEqual([]);
  });

  it('compares totals on one basis only', () => {
    const before = race({ totals: { formal: 190, informal: null, total: null } });
    const after = race({ candidates: [candidate('a', 105), candidate('b', 90, 'rep')], totals: { formal: 195, informal: 5, total: 200 } });
    expect(raceChanges(before, after, 'now')[0]).toMatchObject({ type: 'new_batch', delta: 5 });
  });

  it('does not treat a new source without the call as a withdrawal', () => {
    const before = race({ decision: called() });
    const after = race({ provenance: { ...race().provenance, sourceId: 'other' } });
    expect(raceChanges(before, after, 'now').map((change) => change.type)).toEqual(['source_switch']);
  });

  it('flags a changed 2CP pair', () => {
    const pair = (ids) => race({ twoCandidate: { status: 'available', candidates: ids.map((id) => ({ candidateId: id, votes: 1 })) } });
    expect(types(pair(['a', 'b']), pair(['a', 'c']))).toEqual(['tcp_pair_change']);
  });
});

describe('one authoritative race per contest', () => {
  const official = race({ provenance: { ...race().provenance, sourceId: 'official' } });
  const copy = race({ totals: { formal: 190, informal: null, total: null }, provenance: { ...race().provenance, sourceId: 'aggregator' } });

  it('takes the first source and never adds the copy', () => {
    const resolved = resolveRaces(['official', 'aggregator'], { official: [official], aggregator: [copy] });
    expect(resolved).toEqual([official]);
    expect(resolved[0].totals.formal).toBe(190);
  });

  it('never adds a source total to its method subtotals or to county rows', () => {
    const before = race({ candidates: [candidate('a', 100), candidate('b', 90)], totals: { formal: 190, informal: null, total: 190 } });
    const after = race({ candidates: [candidate('a', 110), candidate('b', 90)], totals: { formal: 200, informal: null, total: 200, byMethod: { early: 120, day: 80 }, byCounty: { one: 200 } } });
    expect(raceChanges(before, after, 'now')).toEqual([{ raceId: before.raceId, at: 'now', type: 'new_batch', delta: 10 }]);
  });

  it('falls to the next source as a whole when the first has no such contest', () => {
    expect(resolveRaces(['official', 'aggregator'], { official: [], aggregator: [copy] })).toEqual([copy]);
  });
});

describe('source age', () => {
  const now = Date.parse('2026-11-04T01:10:00.000Z');

  it('measures from the source time and leaves unknown null', () => {
    expect(ageSeconds('2026-11-04T01:00:00.000Z', now)).toBe(600);
    expect(ageSeconds(null, now)).toBeNull();
    expect(ageSeconds('2026-11-04T02:00:00.000Z', now)).toBeNull();
  });

  it('a fresh national time does not hide one stale race', () => {
    const pointer = { sources: [{ sourceId: 'test', status: 'ok', lastCheckedAt: '2026-11-04T01:09:00.000Z', feeds: [{ office: 'house', status: 'ok' }, { office: 'senate', status: 'error' }] }] };
    expect(raceFreshness(race(), pointer)).toBe('fresh');
    expect(raceFreshness(race({ office: 'senate' }), pointer)).toBe('stale');
    expect(raceFreshness(race({ coverage: 'stale' }), pointer)).toBe('stale');
  });
});

describe('feed controller', () => {
  const pointer = (revision, snapshotId = `s${revision}`) => ({ schemaVersion: 1, eventId: 'us-2026', revision, snapshotId, isSynthetic: true, sourceIds: ['vec-sample'], history: [], sources: [] });
  const body = (snapshotId) => snapshot({ snapshotId });

  function harness(routes, { hidden = false, hostname = '127.0.0.1' } = {}) {
    const timers = [];
    let isHidden = hidden;
    const fetchJson = vi.fn(async (url) => {
      const route = routes.get(url.replace('/feed/us-2026/', ''));
      if (route === undefined) throw new Error(`404 ${url}`);
      if (route instanceof Error) throw route;
      return route;
    });
    const onChange = vi.fn();
    const controller = createFeedController({
      base: '/feed/', eventId: 'us-2026', hostname, fetchJson, onChange,
      isHidden: () => isHidden,
      schedule: (fn, ms) => {
        const timer = { fn, ms };
        timers.push(timer);
        return timer;
      },
      cancel: (timer) => {
        const index = timers.indexOf(timer);
        if (index >= 0) timers.splice(index, 1);
      },
    });
    return { controller, fetchJson, onChange, timers, setHidden: (value) => { isHidden = value; } };
  }

  it('applies a coherent pair and does not download the same snapshot twice', async () => {
    const routes = new Map([['latest.json', pointer(1)], ['snapshots/s1.json', body('s1')]]);
    const { controller, fetchJson } = harness(routes);
    await controller.start();
    expect(controller.state.snapshot.snapshotId).toBe('s1');
    expect(controller.state.status).toBe('ok');
    routes.set('latest.json', pointer(2, 's1'));
    await controller.check();
    expect(controller.state.pointer.revision).toBe(2);
    expect(fetchJson.mock.calls.filter(([url]) => url.includes('snapshots/'))).toHaveLength(1);
  });

  it('keeps the last good data through a failure and through a bad pointer', async () => {
    const routes = new Map([['latest.json', pointer(1)], ['snapshots/s1.json', body('s1')]]);
    const { controller, timers } = harness(routes);
    await controller.start();
    routes.set('latest.json', new Error('offline'));
    await controller.check();
    expect(controller.state.status).toBe('error');
    expect(controller.state.snapshot.snapshotId).toBe('s1');
    expect(timers.at(-1).ms).toBeGreaterThan(VISIBLE_CHECK_MS);
    routes.set('latest.json', { schemaVersion: 9 });
    await controller.check();
    expect(controller.state.snapshot.snapshotId).toBe('s1');
    routes.set('latest.json', pointer(2));
    routes.set('snapshots/s2.json', body('s2'));
    await controller.check();
    expect(controller.state.status).toBe('ok');
    expect(controller.state.snapshot.snapshotId).toBe('s2');
    expect(timers.at(-1).ms).toBe(VISIBLE_CHECK_MS);
  });

  it('refuses a pointer whose snapshot does not match or is invalid', async () => {
    const routes = new Map([['latest.json', pointer(1)], ['snapshots/s1.json', body('other')]]);
    const { controller } = harness(routes);
    await controller.start();
    expect(controller.state.snapshot).toBeNull();
    expect(controller.state.status).toBe('error');
    routes.set('snapshots/s1.json', snapshot({ snapshotId: 's1', mode: 'live' }));
    await controller.check();
    expect(controller.state.snapshot).toBeNull();
  });

  it('never moves backwards to an older cached pointer', async () => {
    const routes = new Map([['latest.json', pointer(5)], ['snapshots/s5.json', body('s5')]]);
    const { controller } = harness(routes);
    await controller.start();
    routes.set('latest.json', pointer(4));
    routes.set('snapshots/s4.json', body('s4'));
    await controller.check();
    expect(controller.state.snapshot.snapshotId).toBe('s5');
  });

  it('shows nothing on a public host, even if a synthetic feed were reachable', async () => {
    const routes = new Map([['latest.json', pointer(1)], ['snapshots/s1.json', body('s1')]]);
    const { controller } = harness(routes, { hostname: 'feida.au' });
    await controller.start();
    expect(controller.state.snapshot).toBeNull();
    expect(controller.state.pointer).toBeNull();
  });

  it('checks less often in a hidden tab, and at once on return', async () => {
    const routes = new Map([['latest.json', pointer(1)], ['snapshots/s1.json', body('s1')]]);
    const { controller, timers, fetchJson, setHidden } = harness(routes);
    await controller.start();
    expect(timers.at(-1).ms).toBe(VISIBLE_CHECK_MS);
    setHidden(true);
    controller.visibilityChanged();
    expect(timers).toHaveLength(1);
    expect(timers[0].ms).toBe(HIDDEN_CHECK_MS);
    const calls = fetchJson.mock.calls.length;
    setHidden(false);
    controller.visibilityChanged();
    await vi.waitFor(() => expect(fetchJson.mock.calls.length).toBeGreaterThan(calls));
  });

  it('stops checking while paused, and resumes with a check', async () => {
    const routes = new Map([['latest.json', pointer(1)], ['snapshots/s1.json', body('s1')]]);
    const { controller, timers, fetchJson } = harness(routes);
    await controller.start();
    controller.pause();
    expect(timers).toHaveLength(0);
    const calls = fetchJson.mock.calls.length;
    controller.visibilityChanged();
    expect(fetchJson.mock.calls.length).toBe(calls);
    await controller.resume();
    expect(fetchJson.mock.calls.length).toBeGreaterThan(calls);
    expect(timers).toHaveLength(1);
  });
});
