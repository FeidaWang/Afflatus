// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import handler from '../api/election-feed.js';
import { sourceById } from '../src/config/electionSources.js';
import { collectOnce, directoryTransport } from '../scripts/elections/collector.mjs';
import { publishVecLatest } from '../scripts/elections/publish.mjs';
import { vecAzureTransport } from '../scripts/elections/vec-azure-transport.mjs';
import { contestXml, feedXml, zipOf } from './helpers/electionFixtures.js';

const source = sourceById('vec-2026');
const assembly = source.feeds[0];
const SAS = 'https://example.blob.core.windows.net/results?sig=fixture%2Bvalue';
const SNAPSHOTS = 'https://example.blob.core.windows.net/afflatus-elections?sig=fixture';
const NOW = new Date('2026-11-28T09:10:00Z');
const LOWER = 'State2026mediafileverboselhv2_20261128_200500.zip';
const xml = (eventName = 'Fixture Victorian election') => feedXml({
  eventName, contests: [contestXml({ name: 'Albert Park', votes: { a: 10, b: 5 } })],
});
const archive = (contents) => zipOf('result.xml', contents);
let temporary;

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  if (temporary) await rm(temporary, { recursive: true, force: true });
  temporary = null;
});

it('lists across Azure pages, selects only the newest official ZIP, and reuses the ETag', async () => {
  const calls = [];
  const entry = (name) => `<Blob><Name>${name}</Name><Properties><Etag>"v1"</Etag></Properties></Blob>`;
  const fetchImpl = vi.fn(async (url, options) => {
    calls.push({ path: url.pathname, marker: url.searchParams.get('marker'), options });
    expect(url.searchParams.get('sig')).toBe('fixture+value');
    if (url.searchParams.has('comp')) {
      const second = url.searchParams.has('marker');
      const rows = second ? entry(LOWER) : entry('State2026mediafileverboselhv2_20261110_100505.zip') + entry(`Test${LOWER}`);
      return new Response(`<EnumerationResults><Blobs>${rows}</Blobs><NextMarker>${second ? '' : 'next+/='}</NextMarker></EnumerationResults>`);
    }
    return new Response(archive(xml()), { headers: { etag: '"v1"' } });
  });
  const transport = vecAzureTransport(SAS, { fetchImpl });
  const result = await transport(assembly);
  expect(result.fileName).toBe(LOWER);
  expect(await transport(assembly, result)).toEqual({ status: 304 });
  expect(calls.map(({ path, marker }) => [path, marker])).toEqual([
    ['/results', null], ['/results', 'next+/='], [`/results/${LOWER}`, null],
  ]);
  expect(calls.every(({ options }) => options.redirect === 'manual')).toBe(true);
});

it('scrubs Azure connection errors that contain the SAS URL', async () => {
  const transport = vecAzureTransport(SAS, { fetchImpl: async () => { throw new Error(SAS); } });
  await expect(transport(assembly)).rejects.toMatchObject({ kind: 'network', message: 'Upstream connection failed' });
});

it('separates test identity, election-day collection, and explicitly enabled publication', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  temporary = await mkdtemp(join(tmpdir(), 'vec-pub-'));
  const store = join(temporary, 'store');
  const sourceConfig = {
    ...source, enabled: true, expectedEventName: 'Fixture Victorian election', expectedEventId: '1', feeds: [assembly],
  };
  await writeFile(join(temporary, LOWER), archive(xml('Test State Election 2026')));
  const run = () => collectOnce({ source: sourceConfig, store, transport: directoryTransport(temporary), force: true });
  expect(await run()).toMatchObject({ outcome: 'failed', kinds: ['wrong_identity'] });
  await writeFile(join(temporary, LOWER), archive(xml()));
  const collected = await run();
  expect(collected.outcome).toBe('published');

  const blobs = new Map();
  const uploaded = [];
  let refusePointer = true;
  const fetchImpl = vi.fn(async (url, options) => {
    const path = url.pathname;
    const record = blobs.get(path);
    if (options.method === 'PUT') {
      if (path.endsWith('/latest.json') && refusePointer) return new Response(null, { status: 503 });
      if (record && options.headers['If-None-Match'] === '*') return new Response(null, { status: 412 });
      uploaded.push(path);
      blobs.set(path, { body: options.body, etag: `"${uploaded.length}"` });
      return new Response(null, { status: 201 });
    }
    return record ? new Response(record.body, { headers: { etag: record.etag } }) : new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchImpl);
  const env = { VEC_PUBLIC_RESULTS: '1', ELECTION_SNAPSHOT_WRITER_URL: SNAPSHOTS };
  await expect(publishVecLatest(store, { env: {}, fetchImpl })).rejects.toThrow('disabled');
  expect(fetchImpl).not.toHaveBeenCalled();
  await expect(publishVecLatest(store, { env, fetchImpl })).rejects.toThrow('503');
  expect(uploaded).toEqual([`/afflatus-elections/vic-2026/snapshots/${collected.snapshotId}.json`]);
  refusePointer = false;
  await expect(publishVecLatest(store, { env, fetchImpl })).resolves.toBe('published');
  await expect(publishVecLatest(store, { env, fetchImpl })).resolves.toBe('unchanged');
  expect(uploaded).toHaveLength(2);

  const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), setHeader: vi.fn() };
  const request = (file) => handler({ method: 'GET', query: { event: 'vic-2026', file } }, res);
  vi.stubEnv('VEC_PUBLIC_RESULTS', '');
  vi.stubEnv('ELECTION_SNAPSHOT_READER_URL', SNAPSHOTS);
  await request('latest.json');
  expect(res.status).toHaveBeenLastCalledWith(404);
  vi.stubEnv('VEC_PUBLIC_RESULTS', '1');
  vi.setSystemTime(new Date('2026-11-28T06:59:59Z'));
  await request('latest.json');
  expect(res.status).toHaveBeenLastCalledWith(404);
  vi.setSystemTime(NOW);
  await request('latest.json');
  expect(res.status).toHaveBeenLastCalledWith(200);
  expect(res.json).toHaveBeenLastCalledWith(expect.objectContaining({ snapshotId: collected.snapshotId }));
  await request(`snapshots/${collected.snapshotId}.json`);
  expect(res.status).toHaveBeenLastCalledWith(200);
  expect(res.json).toHaveBeenLastCalledWith(expect.objectContaining({
    races: [expect.objectContaining({ totals: expect.objectContaining({ formal: 15 }) })],
  }));
  await request('private/vec-2026.json');
  expect(res.status).toHaveBeenLastCalledWith(404);
});
