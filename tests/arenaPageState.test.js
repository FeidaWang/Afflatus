import { describe, expect, it, vi } from 'vitest';
import {
  ARENA_PAGE_STATUS,
  createLatestSelectionPipeline,
  initialArenaPageState,
  reduceArenaPageState,
} from '../src/lib/arenaPageState.js';

const result = (historySource = 'network', quote = { c: 10 }) => ({
  history: { source: historySource, session: '2026-07-24', candles: [] },
  quote,
  quoteError: quote ? null : new Error('quote unavailable'),
});

describe('Arena page state', () => {
  it('maps complete, degraded and gated outcomes to explicit states', () => {
    const loading = reduceArenaPageState(initialArenaPageState(), {
      type: 'select', requestId: 1, sym: 'NVDA',
    });
    expect(loading.status).toBe(ARENA_PAGE_STATUS.LOADING);
    expect(reduceArenaPageState(loading, {
      type: 'resolve', requestId: 1, result: result(),
    }).status).toBe(ARENA_PAGE_STATUS.READY);
    expect(reduceArenaPageState(loading, {
      type: 'resolve', requestId: 1, result: result('cache', null),
    }).status).toBe(ARENA_PAGE_STATUS.PARTIAL);
    expect(reduceArenaPageState(loading, {
      type: 'resolve', requestId: 1, result: result('stale-cache'),
    }).status).toBe(ARENA_PAGE_STATUS.STALE);
    expect(reduceArenaPageState(loading, {
      type: 'gated', requestId: 1, keyRejected: true,
    })).toMatchObject({ status: ARENA_PAGE_STATUS.GATED, keyRejected: true });
    expect(reduceArenaPageState(loading, {
      type: 'error', requestId: 1, error: new Error('history unavailable'),
    })).toMatchObject({ status: ARENA_PAGE_STATUS.ERROR, data: null });
  });

  it('ignores terminal events from an older selection generation', () => {
    const current = reduceArenaPageState(initialArenaPageState(), {
      type: 'select', requestId: 2, sym: 'AMD',
    });
    expect(reduceArenaPageState(current, {
      type: 'resolve', requestId: 1, result: result(),
    })).toBe(current);
  });
});

describe('latest Arena selection pipeline', () => {
  it('aborts the previous generation and only resolves the newest selection', async () => {
    const releases = new Map();
    const onResolve = vi.fn();
    const pipeline = createLatestSelectionPipeline(
      (sym, { signal }) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(
          new DOMException('aborted', 'AbortError'),
        ), { once: true });
        releases.set(sym, resolve);
      }),
      { onResolve },
    );

    const first = pipeline.run('NVDA');
    const second = pipeline.run('AMD');
    releases.get('AMD')({ sym: 'AMD' });

    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await expect(second).resolves.toEqual({ sym: 'AMD' });
    expect(onResolve).toHaveBeenCalledOnce();
    expect(onResolve).toHaveBeenCalledWith({ sym: 'AMD' }, 'AMD', 2);
  });

  it('cancels active work during page teardown', async () => {
    const pipeline = createLatestSelectionPipeline(
      (_sym, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(
          new DOMException('aborted', 'AbortError'),
        ), { once: true });
      }),
    );
    const pending = pipeline.run('NVDA');
    expect(pipeline.active).toBe(true);
    pipeline.cancel();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(pipeline.active).toBe(false);
  });
});
