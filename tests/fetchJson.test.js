import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { clearJsonCacheForTests, fetchJson, JsonDataError } from '../src/lib/fetchJson.js';

const validIndex = {
  novels: [{ id: 'demo', novel: { title: 'Demo' }, chapterCount: 1 }],
};
const currentSignal = JSON.parse(readFileSync('public/signal-events.json', 'utf8'));
const currentArenaPicks = JSON.parse(readFileSync('public/arena-picks.json', 'utf8'));
const currentArenaDigest = JSON.parse(readFileSync('public/arena-daily-digest.json', 'utf8'));
const currentArenaNews = JSON.parse(readFileSync('public/arena-news.json', 'utf8'));
const currentArenaLedger = JSON.parse(readFileSync('public/arena-ledger.json', 'utf8'));
const currentArenaQuantModel = JSON.parse(readFileSync('public/arena-quant-model.json', 'utf8'));
const currentTransits = JSON.parse(readFileSync('public/transits-daily.json', 'utf8'));

const scheduledNetworkFirstCases = [
  ['arena-picks', { ...currentArenaPicks, date: '2026-08-06' }, currentArenaPicks, 'date'],
  ['arena-digest', { ...currentArenaDigest, date: '2026-08-06' }, currentArenaDigest, 'date'],
  ['arena-news', { ...currentArenaNews, date: '2026-08-06' }, currentArenaNews, 'date'],
  ['arena-ledger', { ...currentArenaLedger, updated: '2026-08-06' }, currentArenaLedger, 'updated'],
  ['arena-quant-model', { ...currentArenaQuantModel, updated: '2026-08-04' }, currentArenaQuantModel, 'updated'],
  ['transits', { ...currentTransits, date: '2026-08-07' }, currentTransits, 'date'],
];

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

  it('revalidates Signal before returning a fresh browser cache entry', async () => {
    const newestEvent = [...currentSignal.events].sort((a, b) => b.date.localeCompare(a.date))[0];
    const previousDate = new Date(Date.parse(newestEvent.date) - 86_400_000).toISOString().slice(0, 10);
    const previousEvents = currentSignal.events.filter(event => event.date <= previousDate);
    const previousDecision = [...previousEvents].filter(event => event.rate).sort((a, b) => b.date.localeCompare(a.date))[0];
    const staleSignal = {
      ...currentSignal,
      updated: previousDate,
      checked_at: previousDate,
      as_of: `${previousDate}T12:00:00Z`,
      overview: { ...currentSignal.overview, policyRate: { ...previousDecision.rate, date: previousDecision.date, source: previousDecision.source } },
      events: previousEvents,
    };
    const network = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(staleSignal), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(currentSignal), { status: 200 }));
    vi.stubGlobal('fetch', network);

    await expect(fetchJson('signal')).resolves.toMatchObject({ updated: previousDate });
    await expect(fetchJson('signal')).resolves.toMatchObject({
      updated: currentSignal.updated,
      events: expect.arrayContaining([expect.objectContaining({ id: newestEvent.id })]),
    });

    expect(network).toHaveBeenCalledTimes(2);
    expect(network.mock.calls[1][1]).toMatchObject({ cache: 'no-cache' });
  });

  it.each(scheduledNetworkFirstCases)(
    'revalidates %s before returning a fresh browser cache entry',
    async (key, previous, current, marker) => {
      const network = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(previous), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(current), { status: 200 }));
      vi.stubGlobal('fetch', network);

      await expect(fetchJson(key)).resolves.toMatchObject({ [marker]: previous[marker] });
      await expect(fetchJson(key)).resolves.toMatchObject({ [marker]: current[marker] });

      expect(network).toHaveBeenCalledTimes(2);
      expect(network.mock.calls[1][1]).toMatchObject({ cache: 'no-cache' });
    },
  );

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
