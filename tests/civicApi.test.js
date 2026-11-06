import { describe, expect, it } from 'vitest';
import { CIVIC_BASE, civicRaces, createCivicReader } from '../src/lib/civicApi.js';
import { feedAllowed, pointerErrors, seatStates, snapshotErrors } from '../src/lib/electionResults.js';
import { createFeedController } from '../src/lib/electionFeed.js';
import { civicHouse, civicRegion, civicSenate } from './helpers/civicFixture.js';

const AT = '2026-11-07T01:00:00.000Z';
const opts = { raceUrl: 'https://civicapi.org/api/v2/race/1', fetchedAt: AT };
const reader = (documents, now = () => Date.parse(AT)) => createCivicReader({
  now,
  raceIds: { house: 1, senate: 2 },
  fetchJson: async (url) => {
    const value = documents[url.endsWith('/1') ? 'house' : 'senate'];
    if (value instanceof Error) throw value;
    return typeof value === 'function' ? value() : value;
  },
});

describe('civicAPI races', () => {
  it('maps every House district and Senate contest onto its catalogue seat', () => {
    const house = civicRaces(civicHouse(), 'house', opts);
    const senate = civicRaces(civicSenate(), 'senate', opts);
    expect(house).toHaveLength(435);
    expect(senate).toHaveLength(35);
    expect(house.find((race) => race.seatIds[0] === 'AK-AL')).toBeTruthy();
    const florida = senate.find((race) => race.seatIds[0] === 'FL-S1');
    expect([florida.contestKind, florida.targetTerm]).toEqual(['special', 'to-2029-01-03']);
  });

  it('keeps a lead apart from a call, and names civicAPI as the caller', () => {
    const [leading] = civicRaces(civicHouse({ 'ca-12': civicRegion('ca-12') }), 'house', opts).filter((race) => race.seatIds[0] === 'CA-12');
    expect(leading.decision.status).toBe('uncalled');
    const [called] = civicRaces(civicHouse({ 'ca-12': civicRegion('ca-12', { winner: 'r' }) }), 'house', opts).filter((race) => race.seatIds[0] === 'CA-12');
    expect(called.decision).toMatchObject({ status: 'provider_called', authority: 'civicAPI', decidedAt: null, firstObservedAt: AT, callTimeUnpublished: true });
    expect(called.candidates.find((candidate) => called.decision.candidateIds.includes(candidate.candidateId)).partyId).toBe('rep');
  });

  it('gives no race a time of its own, and reports progress as the source estimate', () => {
    const race = civicRaces(civicHouse(), 'house', opts)[0];
    expect(race.provenance.sourceUpdatedAt).toBeNull();
    expect(race.progress).toEqual({ unit: 'percent', reported: 80, total: 100, isEstimate: true });
    expect(race.totals.formal).toBe(1000);
  });

  it('counts Alaska and Maine by ranked choice, so they show no lead', () => {
    const races = civicRaces(civicHouse(), 'house', opts);
    for (const seatId of ['AK-AL', 'ME-01']) expect(races.find((race) => race.seatIds[0] === seatId).counting).toEqual({ method: 'rcv', status: 'counting', round: 1 });
    const states = seatStates({ races });
    expect(states['AK-AL']).toBeUndefined();
    expect(states['CA-12']).toMatchObject({ status: 'leading', party: 'dem' });
  });

  it('treats candidates who advanced with no winner as a runoff', () => {
    const [race] = civicRaces(civicSenate({ ga: civicRegion('ga', { advanced: true }) }), 'senate', opts).filter((item) => item.seatIds[0] === 'GA-S1');
    expect(race.counting.status).toBe('runoff');
  });

  it('refuses test data, another race or another election', () => {
    expect(() => civicRaces({ ...civicHouse(), test_data: true }, 'house', opts)).toThrow(/test data/);
    expect(() => civicRaces(civicSenate(), 'house', opts)).toThrow(/wrong race/);
    expect(() => civicRaces({ ...civicHouse(), election_date: '2024-11-05T05:00:00.000Z' }, 'house', opts)).toThrow(/election date/);
  });

  it('drops a region with no seat on this ballot', () => {
    const races = civicRaces(civicSenate({ ca: civicRegion('ca') }), 'senate', opts);
    expect(races).toHaveLength(35);
  });
});

describe('civicAPI reader', () => {
  it('produces a pointer and snapshot that pass the shared checks on the public host', async () => {
    const read = reader({ house: civicHouse(), senate: civicSenate() });
    const pointer = await read(`${CIVIC_BASE}us-2026/latest.json`);
    expect(pointerErrors(pointer)).toEqual([]);
    expect(pointer.history).toEqual([]);
    expect(pointer.sources[0]).toMatchObject({ sourceId: 'civicapi', status: 'ok', sourceUpdatedAt: '2026-11-06T13:07:00.000Z' });
    const snapshot = await read(`${CIVIC_BASE}us-2026/snapshots/${pointer.snapshotId}.json`);
    expect(snapshotErrors(snapshot)).toEqual([]);
    expect([snapshot.mode, snapshot.isSynthetic, snapshot.races.length]).toEqual(['live', false, 470]);
    expect(feedAllowed(snapshot, 'feida.au')).toBe(true);
  });

  it('holds back one contest that breaks the rules, and keeps the rest', async () => {
    const both = civicRegion('nc-01');
    both.candidates.forEach((candidate) => { candidate.winner = true; });
    const read = reader({ house: civicHouse({ 'nc-01': both }), senate: civicSenate() });
    const pointer = await read(`${CIVIC_BASE}us-2026/latest.json`);
    const snapshot = await read(`${CIVIC_BASE}us-2026/snapshots/${pointer.snapshotId}.json`);
    expect(snapshot.rejected).toEqual(['us-2026/house/NC-01']);
    expect(snapshot.races).toHaveLength(469);
  });

  it('keeps the time a call was first read, and records vote changes between reads', async () => {
    let clock = Date.parse(AT);
    let votes = [600, 400];
    const read = reader({ house: () => civicHouse({ 'ca-12': civicRegion('ca-12', { winner: 'd', votes }) }), senate: civicSenate() }, () => clock);
    await read(`${CIVIC_BASE}us-2026/latest.json`);
    clock += 60_000;
    votes = [650, 400];
    const pointer = await read(`${CIVIC_BASE}us-2026/latest.json`);
    const snapshot = await read(`${CIVIC_BASE}us-2026/snapshots/${pointer.snapshotId}.json`);
    const race = snapshot.races.find((item) => item.seatIds[0] === 'CA-12');
    expect(race.decision.firstObservedAt).toBe(AT);
    expect(snapshot.changes).toContainEqual(expect.objectContaining({ raceId: 'us-2026/house/CA-12', type: 'new_batch', delta: 50 }));
  });

  it('keeps the last good data on screen when a read fails', async () => {
    const documents = { house: civicHouse(), senate: civicSenate() };
    const controller = createFeedController({
      base: CIVIC_BASE, eventId: 'us-2026', hostname: 'feida.au', fetchJson: reader(documents), onChange: () => {}, schedule: () => 0, cancel: () => {},
    });
    await controller.check();
    expect(controller.state.status).toBe('ok');
    documents.senate = new Error('HTTP 503');
    await controller.check();
    expect(controller.state.status).toBe('error');
    expect(controller.state.snapshot.races).toHaveLength(470);
  });
});
