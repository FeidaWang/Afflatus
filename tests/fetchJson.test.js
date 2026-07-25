import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearJsonCacheForTests, fetchJson, JsonDataError } from '../src/lib/fetchJson.js';

const validIndex = {
  novels: [{ id: 'demo', novel: { title: 'Demo' }, chapterCount: 1 }],
};

describe('fetchJson', () => {
  beforeEach(() => {
    clearJsonCacheForTests();
    vi.stubGlobal('caches', undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('deduplicates concurrent requests and validates the payload', async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const network = vi.fn(async () => {
      await gate;
      return new Response(JSON.stringify(validIndex), { status: 200 });
    });
    vi.stubGlobal('fetch', network);

    const first = fetchJson('novels-index');
    const second = fetchJson('novels-index');
    release();

    await expect(first).resolves.toEqual(validIndex);
    await expect(second).resolves.toEqual(validIndex);
    expect(network).toHaveBeenCalledTimes(1);
  });

  it('returns a typed schema error for an invalid resource', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"novels":[]}', { status: 200 })));
    await expect(fetchJson('novel:demo')).rejects.toMatchObject({
      name: 'JsonDataError',
      code: 'SCHEMA',
      key: 'novel:demo',
      retriable: false,
    });
  });

  it('allows one caller to abort without cancelling shared work', async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const network = vi.fn(async () => {
      await gate;
      return new Response(JSON.stringify(validIndex), { status: 200 });
    });
    vi.stubGlobal('fetch', network);
    const controller = new AbortController();

    const cancelled = fetchJson('novels-index', { signal: controller.signal });
    const continuing = fetchJson('novels-index');
    controller.abort();
    release();

    await expect(cancelled).rejects.toMatchObject({ code: 'ABORTED' });
    await expect(continuing).resolves.toEqual(validIndex);
    expect(network).toHaveBeenCalledTimes(1);
  });

  it('returns stale data immediately and revalidates once in the background', async () => {
    let now = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const network = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(validIndex), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        novels: [{ id: 'next', novel: { title: 'Next' }, chapterCount: 2 }],
      }), { status: 200 }));
    vi.stubGlobal('fetch', network);

    await fetchJson('novels-index', { freshness: 10 });
    now = 2000;
    await expect(fetchJson('novels-index', { freshness: 10 })).resolves.toEqual(validIndex);
    await vi.waitFor(() => expect(network).toHaveBeenCalledTimes(2));
  });

  it('preserves HTTP status in a typed error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 403 })));
    let error;
    try {
      await fetchJson('quote:NVDA');
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(JsonDataError);
    expect(error).toMatchObject({ code: 'HTTP', status: 403, retriable: false });
  });
});
