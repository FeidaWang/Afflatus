import { describe, expect, it, vi } from 'vitest';
import {
  assessArenaExecutionInvocation,
  collectArenaExecutionSymbols,
  consumedArenaProposalIdsFromLedger,
  fetchArenaExecutionQuotes,
} from '../src/lib/arenaExecution.js';

const OPEN_NOW = new Date('2026-08-12T14:06:00.000Z'); // 10:06 America/New_York

function runlog(status) {
  return status ? {
    runs: [{ date: '2026-08-12', window: 'open-window', model: 'S', status }],
  } : { runs: [] };
}

describe('Arena live execution invocation gate', () => {
  it('accepts only the canonical model/window at the current real ET session', () => {
    const allowed = assessArenaExecutionInvocation({
      book: 'S', window: 'open-window', etDateStr: '2026-08-12', runlog: runlog(), wallNow: OPEN_NOW,
    });
    expect(allowed.nowIso).toBe(OPEN_NOW.toISOString());
    expect(allowed.gate.due).toBe(true);

    expect(() => assessArenaExecutionInvocation({
      book: 'S', window: 'post-market', etDateStr: '2026-08-12', runlog: runlog(), wallNow: OPEN_NOW,
    })).toThrow(/cannot execute/);
    expect(() => assessArenaExecutionInvocation({
      book: 'T', window: 'open-window', etDateStr: '2026-08-12', runlog: runlog(), wallNow: OPEN_NOW,
    })).toThrow(/cannot execute/);
    expect(() => assessArenaExecutionInvocation({
      book: 'S', window: 'open-window', etDateStr: '2026-08-11', runlog: runlog(), wallNow: OPEN_NOW,
    })).toThrow(/current America\/New_York date/);
    expect(() => assessArenaExecutionInvocation({
      book: 'S', window: 'open-window', etDateStr: '2026-08-12', runlog: runlog(),
      wallNow: new Date('2026-08-12T14:04:59.000Z'),
    })).toThrow(/before-window/);
  });

  it('permits S/P current post-market valuation as a zero-trade exception', () => {
    const postNow = new Date('2026-08-12T20:35:00.000Z');
    for (const book of ['S', 'P']) {
      expect(assessArenaExecutionInvocation({
        book, window: 'post-market', etDateStr: '2026-08-12', runlog: { runs: [] },
        wallNow: postNow, valuationOnly: true,
      }).mode).toBe('current-postmarket-valuation');
    }
    expect(() => assessArenaExecutionInvocation({
      book: 'S', window: 'open-window', etDateStr: '2026-08-12', runlog: { runs: [] },
      wallNow: OPEN_NOW, valuationOnly: true,
    })).toThrow(/current post-market or witnessed missed/);
  });

  it('never overwrites done/missed and advances queued only inside the live window', () => {
    for (const status of ['done', 'missed']) {
      expect(() => assessArenaExecutionInvocation({
        book: 'S', window: 'open-window', etDateStr: '2026-08-12', runlog: runlog(status), wallNow: OPEN_NOW,
      })).toThrow(new RegExp(`terminal \\(${status}\\)`));
    }
    expect(assessArenaExecutionInvocation({
      book: 'S', window: 'open-window', etDateStr: '2026-08-12', runlog: runlog('queued'), wallNow: OPEN_NOW,
    }).existingStatus).toBe('queued');
    expect(() => assessArenaExecutionInvocation({
      book: 'S', window: 'open-window', etDateStr: '2026-08-12', runlog: runlog('queued'),
      wallNow: new Date('2026-08-12T18:00:00.000Z'),
    })).toThrow(/after-window/);
  });
});

describe('Arena execution quote collection', () => {
  it('consumes only proposal ids proven by immutable ledger trades, not skipped runlog intents', () => {
    const ledger = {
      models: {
        S: { trades: [{ proposalId: 'filled-S' }, { sym: 'legacy' }] },
        P: { trades: [] },
        T: { trades: [{ proposalId: 'filled-T' }] },
      },
    };
    expect(consumedArenaProposalIdsFromLedger(ledger)).toEqual(['filled-S', 'filled-T']);
  });

  it('collects every held symbol and resolves submitted symbols from the sealed snapshot', () => {
    const ledger = {
      models: {
        S: { positions: [{ sym: 'WAB' }] },
        P: { positions: [] },
        T: { positions: [{ sym: 'T' }] },
      },
    };
    const snapshot = { models: { S: [{ proposalId: 'p-1', sym: 'NVDA' }] } };
    expect(collectArenaExecutionSymbols(ledger, snapshot, 'S', [{ proposalId: 'p-1' }]))
      .toEqual(['NVDA', 'WAB']);
    expect(() => collectArenaExecutionSymbols(ledger, snapshot, 'S', [{ proposalId: 'unknown' }]))
      .toThrow(/published Model S proposal/);
  });

  it('fetches production-shaped quotes and preserves source, request and time receipts', async () => {
    const observedAt = new Date('2026-08-12T14:06:00.000Z');
    const fetchImpl = vi.fn(async (url, options) => ({
      ok: true,
      status: 200,
      headers: { get: (name) => name.toLowerCase() === 'x-request-id' ? `req-${new URL(url).searchParams.get('symbol')}` : null },
      json: async () => ({ c: url.includes('NVDA') ? 181.25 : 24.5, t: observedAt.getTime() / 1000 - 10 }),
      options,
    }));
    const result = await fetchArenaExecutionQuotes({
      symbols: ['NVDA', 'T', 'NVDA'], window: 'open-window', baseUrl: 'https://feida.au/',
      fetchImpl, now: () => observedAt,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.priceMap).toEqual({ NVDA: 181.25, T: 24.5 });
    expect(result.receipts.NVDA).toEqual({
      sourceUrl: 'https://feida.au/api/quote?symbol=NVDA',
      requestId: 'req-NVDA',
      observedAt: observedAt.toISOString(),
      providerTimestamp: '2026-08-12T14:05:50.000Z',
      refPx: 181.25,
    });
    expect(fetchImpl.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('fails the entire batch for missing, malformed, anonymous or stale quotes', async () => {
    const observedAt = new Date('2026-08-12T14:06:00.000Z');
    const response = (symbol) => ({
      ok: true,
      status: 200,
      headers: { get: () => symbol === 'MU' ? null : `req-${symbol}` },
      json: async () => ({
        c: symbol === 'NVDA' ? 0 : 100,
        t: symbol === 'WAB' ? observedAt.getTime() / 1000 - 6 * 60 : observedAt.getTime() / 1000,
      }),
    });
    const fetchImpl = async (url) => response(new URL(url).searchParams.get('symbol'));
    await expect(fetchArenaExecutionQuotes({
      symbols: ['NVDA', 'MU', 'WAB'], window: 'open-window', fetchImpl, now: () => observedAt,
    })).rejects.toThrow(/MU: response is missing.*NVDA: response c.*WAB: provider quote is stale/);
  });

  it('enforces the 12-second-capable abort path without returning a partial batch', async () => {
    const fetchImpl = (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    });
    await expect(fetchArenaExecutionQuotes({
      symbols: ['NVDA'], window: 'open-window', fetchImpl, timeoutMs: 5,
    })).rejects.toThrow(/exceeded 5ms/);
  });
});
