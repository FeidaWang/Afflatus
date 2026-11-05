// @vitest-environment node
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sourceById } from '../src/config/electionSources.js';
import { assertPrivateStore, collectOnce, directoryTransport, urlTransport } from '../scripts/elections/collector.mjs';
import { FeedError, boundedFetch } from '../scripts/elections/bounded-fetch.mjs';
import { child, parseXml } from '../scripts/elections/safe-xml.mjs';
import { readSingleFile } from '../scripts/elections/safe-zip.mjs';
import { melbourneToUtc, parseVecFeed, partyIdFor } from '../scripts/elections/vec-adapter.mjs';
import { snapshotErrors } from '../src/lib/electionResults.js';
import { contestXml, feedXml, lowerName, regionXml, upperName, zipOf } from './helpers/electionFixtures.js';

const source = sourceById('vec-sample');
const lowerFeed = source.feeds[0];
// Most cases exercise one house. A missing second file is itself a failure, covered on its own below.
const lowerOnly = { ...source, feeds: [lowerFeed] };
const NOW = Date.parse('2026-11-28T09:10:00Z');
const parse = (xml, feed = lowerFeed) => parseVecFeed(xml, { feed, source, fetchedAt: '2026-11-28T09:10:00.000Z', payloadHash: 'h', fileName: 'f' });
const albert = (extra) => contestXml({ name: 'Albert Park', votes: { a: 10, b: 5 }, ...extra });

let dir;
let store;
let feedDir;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'el-collector-'));
  store = join(dir, 'store');
  feedDir = join(dir, 'feed');
  mkdirSync(feedDir);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const drop = (name, xml) => writeFileSync(join(feedDir, name), zipOf(name.replace('.zip', '.xml'), xml));
const dropLower = (stamp, contests, extra) => drop(lowerName(stamp), feedXml({ contests, ...extra }));
const dropUpper = (stamp, contests, extra) => drop(upperName(stamp), feedXml({ contests, category: 'UpperHouse', ...extra }));
const run = (at = NOW, extra = {}) => collectOnce({ source: lowerOnly, store, now: at, force: true, transport: directoryTransport(feedDir), ...extra });
const pointer = () => JSON.parse(readFileSync(join(store, 'vic-2026', 'latest.json'), 'utf8'));
const latest = () => JSON.parse(readFileSync(join(store, 'vic-2026', 'snapshots', `${pointer().snapshotId}.json`), 'utf8'));
const race = (id) => latest().races.find((item) => item.raceId === `vic-2026/assembly/${id}`);
const snapshotFiles = () => readdirSync(join(store, 'vic-2026', 'snapshots'));

describe('safe XML', () => {
  it('reads namespaced elements and predefined entities', () => {
    const root = parseXml('<?xml version="1.0"?><a xmlns:e="u"><e:b Id="1">x &amp; y</e:b></a>');
    expect(child(root, 'b').text).toBe('x & y');
    expect(child(root, 'b').attributes.Id).toBe('1');
  });

  it.each([
    ['external entity', '<!DOCTYPE a [<!ENTITY x SYSTEM "file:///etc/passwd">]><a>&x;</a>'],
    ['entity expansion', '<!DOCTYPE a [<!ENTITY x "y">]><a>&x;</a>'],
    ['unknown entity', '<a>&nope;</a>'],
    ['mismatched tag', '<a><b></a></b>'],
    ['unclosed tag', '<a><b>'],
    ['two roots', '<a/><b/>'],
    ['text outside the root', 'hello<a/>'],
    ['truncated tag', '<a><b'],
    ['empty document', ''],
  ])('refuses %s', (_name, xml) => {
    expect(() => parseXml(xml)).toThrow();
  });
});

describe('safe ZIP', () => {
  const xml = '<a>hello</a>';

  it('reads the one file', () => {
    expect(readSingleFile(zipOf('a.xml', xml), { maxBytes: 100 }).bytes.toString()).toBe(xml);
  });

  it('stops at the unpacked size limit', () => {
    expect(() => readSingleFile(zipOf('a.xml', xml), { maxBytes: 3 })).toThrow(/limit/);
  });

  it('detects a corrupted body and a non-ZIP', () => {
    const zip = zipOf('a.xml', xml);
    zip[35] ^= 0xff;
    expect(() => readSingleFile(zip, { maxBytes: 100 })).toThrow(/checksum/);
    expect(() => readSingleFile(Buffer.from('<html>nope</html>'), { maxBytes: 100 })).toThrow(/Not a ZIP/);
  });
});

describe('VEC adapter', () => {
  it('normalises a contest with all candidates and three separate states', () => {
    const { races } = parse(feedXml({ contests: [contestXml({ name: 'Albert Park', votes: { a: 10, b: 5, c: 0, d: 2 } })] }));
    const [item] = races;
    expect(item.raceId).toBe('vic-2026/assembly/albert-park');
    expect(item.seatIds).toEqual(['albert-park']);
    expect(item.candidates.map((candidate) => candidate.votes)).toEqual([10, 5, 0, 2]);
    expect(item.candidates.map((candidate) => candidate.partyId)).toEqual(['labor', 'coalition', 'greens', 'teal']);
    expect(item.coverage).toBe('available');
    expect(item.counting.status).toBe('counting');
    expect(item.decision.status).toBe('uncalled');
    expect(item.progress).toEqual({ unit: 'polling_places', reported: 3, total: 10, isEstimate: false });
  });

  it('keeps a counted zero but makes an unreported zero unknown', () => {
    const counted = parse(feedXml({ contests: [contestXml({ name: 'Albert Park', votes: { a: 10, b: 0 } })] })).races[0];
    expect(counted.candidates[1].votes).toBe(0);
    const unreported = parse(feedXml({ contests: [contestXml({ name: 'Albert Park', returned: 0, updated: '', votes: { a: 0, b: 0 } })] })).races[0];
    expect(unreported.candidates.map((candidate) => candidate.votes)).toEqual([null, null]);
    expect(unreported.totals.formal).toBeNull();
    expect(unreported.counting.status).toBe('no_votes');
  });

  it('leaves an empty source time null instead of borrowing the file time', () => {
    const { races } = parse(feedXml({ contests: [albert({ updated: '', returned: 0, votes: { a: 0, b: 0 } })] }));
    expect(races[0].provenance.sourceUpdatedAt).toBeNull();
    expect(races[0].provenance.publishedAt).not.toBeNull();
  });

  it('reads a recount, where places returned falls to 0 but the votes stay', () => {
    const { races } = parse(feedXml({ contests: [contestXml({ name: 'Albert Park', returned: 0, votes: { a: 10, b: 5 } })] }));
    expect(races[0].counting.status).toBe('recount');
    expect(races[0].candidates[0].votes).toBe(10);
    expect(races[0].progress.reported).toBeNull();
  });

  it('treats a declaration as VEC certification, with the time it was first seen', () => {
    const { races, publishedAt } = parse(feedXml({ contests: [albert({ declared: true, elected: 'b' })] }));
    expect(races[0].decision).toMatchObject({ status: 'certified', authority: 'VEC', candidateIds: ['vec-2'], decidedAt: null, firstObservedAt: publishedAt });
  });

  it('keeps a withheld 2CP distinct from one not reported yet', () => {
    const withheld = parse(feedXml({ contests: [albert({ tcp: 'withheld' })] })).races[0];
    expect(withheld.twoCandidate.status).toBe('withheld');
    expect(withheld.candidates[0].votes).toBe(10);
    expect(parse(feedXml({ contests: [albert()] })).races[0].twoCandidate.status).toBe('absent');
  });

  it('does not sum a region into five seats and keeps groups apart from candidates', () => {
    const { races } = parse(feedXml({ category: 'UpperHouse', contests: [regionXml({ name: 'Eastern Victoria' })] }), source.feeds[1]);
    expect(races[0].seatIds).toHaveLength(5);
    expect(races[0].candidates.map((candidate) => candidate.name)).toEqual(['Group Alpha', 'Group Beta', 'SYNTHETIC, Solo']);
    expect(races[0].twoCandidate).toBeNull();
    expect(races[0].leaderBasis).toBeNull();
  });

  it.each([
    ['wrong event', () => feedXml({ contests: [albert()], eventName: 'State Election 2022' }), 'wrong_identity'],
    ['wrong year', () => feedXml({ contests: [albert()], electionName: 'Lower House election for the State of Victoria 2022' }), 'wrong_identity'],
    ['wrong house', () => feedXml({ contests: [albert()], category: 'UpperHouse' }), 'wrong_identity'],
    ['unknown contest', () => feedXml({ contests: [contestXml({ name: 'Atlantis', votes: { a: 1 } })] }), 'wrong_identity'],
    ['missing FirstPreferences', () => feedXml({ contests: ['<Contest Updated=""><eml:ContestIdentifier Id="1"><eml:ContestName>Albert Park District</eml:ContestName></eml:ContestIdentifier></Contest>'] }), 'schema_drift'],
    ['no contests', () => feedXml({ contests: [] }), 'schema_drift'],
    ['non-numeric votes', () => feedXml({ contests: [albert()] }).replace('<Votes>10</Votes>', '<Votes>ten</Votes>'), 'schema_drift'],
    ['negative votes', () => feedXml({ contests: [albert()] }).replace('<Votes>10</Votes>', '<Votes>-10</Votes>'), 'schema_drift'],
    ['duplicate candidate', () => feedXml({ contests: [albert()] }).replaceAll('Id="2"', 'Id="1"'), 'schema_drift'],
    ['duplicate contest', () => feedXml({ contests: [albert(), albert()] }), 'schema_drift'],
    ['candidates that disagree with Formal', () => feedXml({ contests: [contestXml({ name: 'Albert Park', votes: { a: 10, b: 5 }, formal: 99 })] }), 'schema_drift'],
    ['2CP with one candidate', () => feedXml({ contests: [albert({ tcp: { a: 5 } })] }), 'schema_drift'],
    ['2CP naming a stranger', () => feedXml({ contests: [albert({ tcp: { a: 5, d: 4 } })] }), 'schema_drift'],
    ['a time with no offset', () => feedXml({ contests: [albert({ updated: '2026-11-28T20:00:00' })] }), 'schema_drift'],
    ['another root', () => '<Other/>', 'schema_drift'],
    ['malformed XML', () => '<MediaFeed><Oops>', 'malformed'],
  ])('rejects %s', (_name, xml, kind) => {
    let thrown = null;
    try {
      parse(xml());
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(FeedError);
    expect(thrown.kind).toBe(kind);
  });

  it('maps only exact party names', () => {
    expect(partyIdFor('The Australian Greens - Victoria', false)).toBe('greens');
    expect(partyIdFor('Liberal Democrats', false)).toBe('other');
    expect(partyIdFor('Democratic Labour Party', false)).toBe('other');
    expect(partyIdFor('Pauline Hanson\'s One Nation', false)).toBe('other');
    expect(partyIdFor('National Party of Australia - Victoria', false)).toBe('coalition');
    expect(partyIdFor(null, true)).toBe('teal');
    expect(partyIdFor(null, false)).toBeNull();
  });

  it('reads Melbourne wall-clock time across daylight saving', () => {
    expect(melbourneToUtc('2026-11-28T20:05:00')).toBe('2026-11-28T09:05:00.000Z');
    expect(melbourneToUtc('2026-07-01T20:05:00')).toBe('2026-07-01T10:05:00.000Z');
    expect(melbourneToUtc('nonsense')).toBeNull();
  });
});

describe('VEC adapter, zero files and declarations', () => {
  it('reads a zero file as unknown, including its two-candidate count', () => {
    const [zero] = parse(feedXml({ contests: [contestXml({ name: 'Albert Park', votes: { a: 0, b: 0 }, returned: 0, tcp: { a: 0, b: 0 } })] })).races;
    expect(zero.candidates.every((item) => item.votes === null)).toBe(true);
    expect(zero.twoCandidate.candidates.every((item) => item.votes === null)).toBe(true);
    expect(zero.counting.status).toBe('no_votes');
  });

  it('keeps a recount two-candidate count that has votes', () => {
    const [recount] = parse(feedXml({ contests: [contestXml({ name: 'Albert Park', votes: { a: 7, b: 8 }, returned: 0, tcp: { a: 7, b: 8 } })] })).races;
    expect(recount.counting.status).toBe('recount');
    expect(recount.twoCandidate.candidates.map((item) => item.votes)).toEqual([7, 8]);
  });

  it('refuses a declared seat with nobody elected, rather than reading it as a withdrawal', () => {
    expect(() => parse(feedXml({ contests: [contestXml({ name: 'Albert Park', votes: { a: 7, b: 8 }, declared: true })] }))).toThrow(/declared with 0 elected/);
  });

  it('refuses a blank candidate count beside a known total', () => {
    expect(() => parse(feedXml({ contests: [contestXml({ name: 'Albert Park', votes: { a: null, b: 8 }, formal: 8 })] }))).toThrow(/no votes while Formal/);
  });

  it('does not read a missing returned count as a recount', () => {
    const xml = feedXml({ contests: [contestXml({ name: 'Albert Park', votes: { a: 7, b: 8 } })] }).replace(/PollingPlacesReturned="\d+" /, '');
    const [contest] = parse(xml).races;
    expect(contest.counting.status).toBe('counting');
    expect(contest.progress.reported).toBeNull();
  });
});

describe('collector', () => {
  it('refuses a disabled real source', async () => {
    await expect(collectOnce({ source: sourceById('vec-2026'), store, transport: directoryTransport(feedDir) })).rejects.toThrow(/disabled/);
    await expect(collectOnce({ source: sourceById('civicapi'), store, transport: directoryTransport(feedDir) })).rejects.toThrow(/disabled/);
  });

  it('refuses to write inside public/ or dist/', () => {
    expect(() => assertPrivateStore('public/data/elections')).toThrow(/public/);
    expect(() => assertPrivateStore('dist')).toThrow(/dist/);
    expect(assertPrivateStore(store)).toBe(store);
  });

  it('never publishes real-looking fixture data as live', async () => {
    dropLower('20261128_200500', [albert()]);
    await run();
    expect(pointer().isSynthetic).toBe(true);
    expect(latest()).toMatchObject({ mode: 'preview', isSynthetic: true, sourceIds: ['vec-sample'] });
    expect(snapshotErrors(latest())).toEqual([]);
  });

  it('publishes the snapshot before the pointer, and the pointer names a real file', async () => {
    dropLower('20261128_200500', [albert()]);
    expect(await run()).toMatchObject({ outcome: 'published' });
    expect(snapshotFiles()).toEqual([`${pointer().snapshotId}.json`]);
    expect(pointer().history).toHaveLength(1);
    expect(pointer().revision).toBe(1);
    expect(existsSync(join(store, 'vic-2026', 'private', 'vec-sample.json'))).toBe(true);
  });

  it('treats an unchanged file as no news: only lastCheckedAt moves', async () => {
    dropLower('20261128_200500', [albert()]);
    await run(NOW);
    const before = pointer();
    expect(await run(NOW + 300000)).toMatchObject({ outcome: 'unchanged' });
    const after = pointer();
    expect(after.snapshotId).toBe(before.snapshotId);
    expect(after.sources[0].lastCheckedAt).not.toBe(before.sources[0].lastCheckedAt);
    expect(after.sources[0].sourceUpdatedAt).toBe(before.sources[0].sourceUpdatedAt);
    expect(after.publishedAt).toBe(before.publishedAt);
    expect(snapshotFiles()).toHaveLength(1);
  });

  it('does not publish a new file whose content is identical', async () => {
    dropLower('20261128_200500', [albert()]);
    await run(NOW);
    dropLower('20261128_201000', [albert()], { created: '2026-11-28T20:10:00' });
    expect(await run(NOW + 300000)).toMatchObject({ outcome: 'unchanged' });
    expect(snapshotFiles()).toHaveLength(1);
  });

  it('replaces cumulative totals rather than adding them', async () => {
    dropLower('20261128_200500', [albert()]);
    await run(NOW);
    dropLower('20261128_201000', [contestXml({ name: 'Albert Park', votes: { a: 25, b: 15 } })]);
    await run(NOW + 300000);
    expect(race('albert-park').candidates[0].votes).toBe(25);
    expect(race('albert-park').totals.formal).toBe(40);
    expect(latest().changes).toEqual([expect.objectContaining({ type: 'new_batch', delta: 25 })]);
  });

  it('records a negative correction as a correction', async () => {
    dropLower('20261128_200500', [contestXml({ name: 'Albert Park', votes: { a: 20, b: 5 } })]);
    await run(NOW);
    dropLower('20261128_201000', [contestXml({ name: 'Albert Park', votes: { a: 12, b: 5 } })]);
    await run(NOW + 300000);
    expect(race('albert-park').candidates[0].votes).toBe(12);
    expect(latest().changes).toEqual([expect.objectContaining({ type: 'correction', delta: -8 })]);
  });

  it('ignores an older file served by a cache, and rolls nothing back', async () => {
    dropLower('20261128_200500', [albert({ declared: true, elected: 'a' })]);
    await run(NOW);
    const before = race('albert-park');
    const older = lowerName('20261128_190500');
    const stale = async () => ({ status: 200, bytes: zipOf(older.replace('.zip', '.xml'), feedXml({ contests: [contestXml({ name: 'Albert Park', votes: { a: 2, b: 1 }, updated: '2026-11-28T19:05:00+11:00' })], created: '2026-11-28T19:05:00' })), fileName: older });
    await collectOnce({ source: lowerOnly, store, transport: stale, now: NOW + 300000, force: true });
    expect(race('albert-park')).toEqual(before);
    expect(race('albert-park').decision.status).toBe('certified');
  });

  it('keeps no first-seen time when the declared winner changes', async () => {
    dropLower('20261128_200500', [albert({ declared: true, elected: 'a' })]);
    await run(NOW);
    const firstSeen = race('albert-park').decision.firstObservedAt;
    dropLower('20261128_201000', [contestXml({ name: 'Albert Park', votes: { a: 5, b: 11 }, declared: true, elected: 'b' })], { created: '2026-11-28T20:10:00' });
    await run(NOW + 300000);
    expect(race('albert-park').decision.candidateIds).toEqual(['vec-2']);
    expect(race('albert-park').decision.firstObservedAt).not.toBe(firstSeen);
    expect(latest().changes.map((change) => change.type)).toContain('decision_changed');
  });

  it('records a call being withdrawn and keeps the page honest afterwards', async () => {
    dropLower('20261128_200500', [albert({ declared: true, elected: 'a' })]);
    await run(NOW);
    const firstSeen = race('albert-park').decision.firstObservedAt;
    dropLower('20261128_201000', [contestXml({ name: 'Albert Park', votes: { a: 11, b: 5 }, declared: true, elected: 'a' })], { created: '2026-11-28T20:10:00' });
    await run(NOW + 300000);
    expect(race('albert-park').decision.firstObservedAt).toBe(firstSeen);
    dropLower('20261128_201500', [contestXml({ name: 'Albert Park', votes: { a: 12, b: 5 } })], { created: '2026-11-28T20:15:00' });
    await run(NOW + 600000);
    const withdrawn = race('albert-park').decision;
    expect(withdrawn).toMatchObject({ status: 'call_rescinded', authority: 'VEC', candidateIds: [] });
    expect(withdrawn.firstObservedAt).not.toBe(firstSeen);
    expect(latest().changes.map((change) => change.type)).toContain('call_rescinded');
    dropLower('20261128_202000', [contestXml({ name: 'Albert Park', votes: { a: 13, b: 5 } })], { created: '2026-11-28T20:20:00' });
    await run(NOW + 900000);
    expect(race('albert-park').decision).toEqual(withdrawn);
    expect(latest().changes.map((change) => change.type)).not.toContain('call_rescinded');
  });

  it.each([
    ['malformed XML', () => writeFileSync(join(feedDir, lowerName('20261128_201000')), zipOf('x.xml', '<MediaFeed><Oops>')), 'malformed'],
    ['a corrupt ZIP', () => writeFileSync(join(feedDir, lowerName('20261128_201000')), Buffer.from('not a zip')), 'malformed'],
    ['schema drift', () => dropLower('20261128_201000', [albert()], { eventName: 'Test State Election 2026' }) || writeFileSync(join(feedDir, lowerName('20261128_201000')), zipOf('x.xml', feedXml({ contests: [] }))), 'schema_drift'],
    ['a wrong-year response', () => dropLower('20261128_201000', [albert()], { electionName: 'Lower House election for the State of Victoria 2022' }), 'wrong_identity'],
  ])('keeps the previous snapshot on %s, and restores when a good file arrives', async (_name, breakIt, kind) => {
    dropLower('20261128_200500', [albert()]);
    await run(NOW);
    const before = pointer();
    const sourceTime = before.sources[0].sourceUpdatedAt;

    breakIt();
    expect(await run(NOW + 300000)).toMatchObject({ outcome: 'failed', kinds: [kind] });
    const failed = pointer();
    expect(failed.snapshotId).toBe(before.snapshotId);
    expect(failed.sources[0].status).toBe('error');
    expect(failed.sources[0].lastError.kind).toBe(kind);
    expect(failed.sources[0].sourceUpdatedAt).toBe(sourceTime);
    expect(failed.sources[0].lastSuccessAt).toBe(before.sources[0].lastSuccessAt);
    expect(snapshotFiles()).toHaveLength(1);
    expect(readdirSync(join(store, 'vic-2026', 'private', 'quarantine'))).toHaveLength(1);

    dropLower('20261128_201500', [contestXml({ name: 'Albert Park', votes: { a: 30, b: 5 } })], { created: '2026-11-28T20:15:00' });
    expect(await run(NOW + 600000)).toMatchObject({ outcome: 'published' });
    expect(pointer().sources[0].status).toBe('ok');
    expect(race('albert-park').candidates[0].votes).toBe(30);
  });

  it('reports a source that has gone, without erasing anything', async () => {
    dropLower('20261128_200500', [albert()]);
    await run(NOW);
    const before = pointer();
    rmSync(join(feedDir, lowerName('20261128_200500')));
    expect(await run(NOW + 300000)).toMatchObject({ outcome: 'failed', kinds: ['gone'] });
    expect(pointer().snapshotId).toBe(before.snapshotId);
    expect(pointer().sources[0].lastError.kind).toBe('gone');
  });

  it('marks a contest a new file omits as stale, keeping its real values and time', async () => {
    dropLower('20261128_200500', [albert(), contestXml({ name: 'Bass', id: 101, votes: { a: 3, b: 4 }, updated: '2026-11-28T19:00:00+11:00' })]);
    await run(NOW);
    const bass = race('bass');
    dropLower('20261128_201000', [contestXml({ name: 'Albert Park', votes: { a: 40, b: 5 } })]);
    await run(NOW + 300000);
    expect(race('bass').coverage).toBe('stale');
    expect(race('bass').candidates).toEqual(bass.candidates);
    expect(race('bass').provenance.sourceUpdatedAt).toBe(bass.provenance.sourceUpdatedAt);
    expect(race('albert-park').coverage).toBe('available');
  });

  it('reports partial coverage honestly: only the failed house goes stale', async () => {
    dropLower('20261128_200500', [albert()]);
    dropUpper('20261128_200500', [regionXml({ name: 'Eastern Victoria' })]);
    await run(NOW, { source });
    dropLower('20261128_201000', [contestXml({ name: 'Albert Park', votes: { a: 40, b: 5 } })]);
    writeFileSync(join(feedDir, upperName('20261128_201000')), zipOf('x.xml', '<Broken'));
    expect(await run(NOW + 300000, { source })).toMatchObject({ outcome: 'partial', kinds: ['malformed'] });
    const feeds = pointer().sources[0].feeds;
    expect(feeds.find((feed) => feed.office === 'assembly').status).toBe('ok');
    expect(feeds.find((feed) => feed.office === 'council').status).toBe('error');
    expect(race('albert-park').candidates[0].votes).toBe(40);
    expect(latest().races.find((item) => item.office === 'council').totals.formal).toBe(75);
  });

  it('counts a house whose file is missing as a failure, not as empty', async () => {
    dropLower('20261128_200500', [albert()]);
    expect(await run(NOW, { source })).toMatchObject({ outcome: 'partial', kinds: ['gone'] });
    expect(pointer().sources[0].feeds.find((feed) => feed.office === 'council').status).toBe('error');
    expect(latest().races).toHaveLength(1);
  });

  it('keeps every snapshot immutable', async () => {
    dropLower('20261128_200500', [albert()]);
    await run(NOW);
    const firstId = pointer().snapshotId;
    const firstBody = readFileSync(join(store, 'vic-2026', 'snapshots', `${firstId}.json`), 'utf8');
    dropLower('20261128_201000', [contestXml({ name: 'Albert Park', votes: { a: 50, b: 5 } })]);
    await run(NOW + 300000);
    expect(readFileSync(join(store, 'vic-2026', 'snapshots', `${firstId}.json`), 'utf8')).toBe(firstBody);
    expect(pointer().history.map((item) => item.snapshotId)).toEqual([firstId, pointer().snapshotId]);
  });

  it('does not run over itself', async () => {
    dropLower('20261128_200500', [albert()]);
    mkdirSync(join(store), { recursive: true });
    mkdirSync(join(store, '.lock'));
    expect(await run(Date.now())).toEqual({ outcome: 'locked' });
    expect(existsSync(join(store, 'vic-2026'))).toBe(false);
  });

  it('takes over a lock left by a dead run', async () => {
    dropLower('20261128_200500', [albert()]);
    mkdirSync(store, { recursive: true });
    mkdirSync(join(store, '.lock'));
    expect(await run(Date.now() + 11 * 60 * 1000)).toMatchObject({ outcome: 'published' });
    expect(existsSync(join(store, '.lock'))).toBe(false);
  });

  it('backs off after a failure and honours it on the next scheduled run', async () => {
    dropLower('20261128_200500', [albert()]);
    await run(NOW);
    writeFileSync(join(feedDir, lowerName('20261128_201000')), zipOf('x.xml', '<Oops'));
    const failed = await collectOnce({ source: lowerOnly, store, now: NOW + 300000, transport: directoryTransport(feedDir) });
    expect(failed.outcome).toBe('failed');
    const scheduled = await collectOnce({ source: lowerOnly, store, now: NOW + 301000, transport: directoryTransport(feedDir) });
    expect(scheduled.outcome).toBe('backoff');
  });

  it('refuses files dated before polls closed when a source sets liveNotBefore', async () => {
    dropLower('20261125_200500', [albert()], { created: '2026-11-25T20:05:00' });
    const guarded = { ...lowerOnly, liveNotBefore: '2026-11-28T07:00:00Z' };
    expect(await collectOnce({ source: guarded, store, now: NOW, transport: directoryTransport(feedDir) })).toMatchObject({ outcome: 'failed', kinds: ['wrong_identity'] });
    expect(existsSync(join(store, 'vic-2026', 'latest.json'))).toBe(false);
  });
});

describe('bounded fetch and the URL transport', () => {
  let server;
  let host;
  let handler;

  beforeEach(async () => {
    server = createServer((request, response) => handler(request, response));
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    host = `127.0.0.1:${server.address().port}`;
  });
  afterEach(() => new Promise((resolve) => {
    server.closeAllConnections();
    server.close(resolve);
  }));

  const get = (options = {}) => boundedFetch(`http://${host}/feed.zip`, { allowedHosts: [host], timeoutMs: 500, maxBytes: 1000, ...options });
  const kindOf = async (promise) => {
    try {
      await promise;
    } catch (error) {
      return error.kind;
    }
    return null;
  };

  it('blocks a host that is not on the allowlist before any request', async () => {
    handler = () => {
      throw new Error('should not be reached');
    };
    expect(await kindOf(get({ allowedHosts: ['vec.example'] }))).toBe('host_blocked');
  });

  it('does not follow a redirect off the allowlist', async () => {
    handler = (request, response) => response.writeHead(302, { location: 'http://evil.example/' }).end();
    expect(await kindOf(get())).toBe('http_error');
  });

  it('times out', async () => {
    handler = () => {};
    expect(await kindOf(get({ timeoutMs: 40 }))).toBe('timeout');
  });

  it('honours Retry-After on 429', async () => {
    handler = (request, response) => response.writeHead(429, { 'retry-after': '120' }).end();
    let thrown;
    try {
      await get();
    } catch (error) {
      thrown = error;
    }
    expect(thrown.kind).toBe('rate_limited');
    expect(thrown.retryAfterSeconds).toBe(120);
  });

  it.each([[410, 'gone'], [404, 'gone'], [500, 'http_error'], [503, 'rate_limited']])('maps HTTP %i', async (status, kind) => {
    handler = (request, response) => response.writeHead(status).end();
    expect(await kindOf(get())).toBe(kind);
  });

  it('stops an oversized body, declared or not', async () => {
    handler = (request, response) => response.writeHead(200, { 'content-length': '5000' }).end('x'.repeat(5000));
    expect(await kindOf(get())).toBe('too_large');
    handler = (request, response) => {
      response.writeHead(200);
      response.write('x'.repeat(800));
      response.end('x'.repeat(800));
    };
    expect(await kindOf(get())).toBe('too_large');
  });

  it('sends conditional headers and reports 304', async () => {
    let seen;
    handler = (request, response) => {
      seen = request.headers;
      response.writeHead(304).end();
    };
    const result = await get({ etag: '"abc"', lastModified: 'Sat, 28 Nov 2026 09:00:00 GMT' });
    expect(result.status).toBe(304);
    expect(result.bytes).toBeNull();
    expect(seen['if-none-match']).toBe('"abc"');
    expect(seen['if-modified-since']).toBe('Sat, 28 Nov 2026 09:00:00 GMT');
  });

  it('runs a full collector round through HTTP: 200, then 304, then 429 with backoff', async () => {
    const body = (feed) => zipOf('x.xml', feedXml({ contests: feed.key === 'assembly' ? [albert()] : [regionXml({ name: 'Eastern Victoria' })], category: feed.category }));
    let mode = 'ok';
    handler = (request, response) => {
      const feed = source.feeds.find((item) => request.url.includes(item.key));
      if (mode === '429') response.writeHead(429, { 'retry-after': '900' }).end();
      else if (request.headers['if-none-match'] === `"${feed.key}"`) response.writeHead(304).end();
      else response.writeHead(200, { etag: `"${feed.key}"` }).end(body(feed));
    };
    const transport = (now) => urlTransport((feed) => `http://${host}/${feed.key}.zip`, { allowedHosts: [host], now });

    expect(await collectOnce({ source, store, now: NOW, transport: transport(NOW) })).toMatchObject({ outcome: 'published' });
    const first = pointer();
    expect(await collectOnce({ source, store, now: NOW + 300000, transport: transport(NOW + 300000) })).toMatchObject({ outcome: 'unchanged' });
    expect(pointer().snapshotId).toBe(first.snapshotId);
    expect(pointer().sources[0].sourceUpdatedAt).toBe(first.sources[0].sourceUpdatedAt);

    mode = '429';
    const limited = await collectOnce({ source, store, now: NOW + 600000, transport: transport(NOW + 600000) });
    expect(limited.outcome).toBe('failed');
    expect(Date.parse(limited.backoffUntil) - (NOW + 600000)).toBe(900000);
    expect(pointer().snapshotId).toBe(first.snapshotId);
    expect(await collectOnce({ source, store, now: NOW + 601000, transport: transport(NOW + 601000) })).toMatchObject({ outcome: 'backoff' });
  });
});
