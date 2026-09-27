import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { clearJsonCacheForTests, fetchJson } from '../src/lib/fetchJson.js';

const snapshot = JSON.parse(readFileSync('public/data/sectors-frontier/2026-09-23.json', 'utf8'));
afterEach(() => {
  clearJsonCacheForTests();
  vi.unstubAllGlobals();
});

it('loads the versioned frontier snapshot through the shared validated resource path', async () => {
  vi.stubGlobal('caches', undefined);
  const fetch = vi.fn(async () => new Response(JSON.stringify(snapshot)));
  vi.stubGlobal('fetch', fetch);
  await expect(fetchJson('sectors-frontier-2026-09-23')).resolves.toEqual(snapshot);
  expect(fetch).toHaveBeenCalledWith('/data/sectors-frontier/2026-09-23.json', expect.any(Object));
});

it('rejects benchmark observations with an unknown evidence source', async () => {
  vi.stubGlobal('caches', undefined);
  const invalid = structuredClone(snapshot);
  invalid.observations[0].source_ids = ['unverified-source'];
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(invalid))));
  await expect(fetchJson('sectors-frontier-2026-09-23')).rejects.toMatchObject({ code: 'SCHEMA' });
});
