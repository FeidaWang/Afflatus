import { describe, expect, it } from 'vitest';
import {
  finalizeArenaPostmarketCandidates,
  planCurrentTPostmarketSettlement,
  selectCurrentTProposalIntents,
} from '../src/lib/arenaPostmarketCandidates.js';
import { planHistoryRequestBatches } from '../scripts/build-arena-postmarket-candidates.mjs';
import { validateArenaDigest } from '../src/lib/validateArenaDigest.js';
import { validateArenaPredlog } from '../src/lib/validateArenaPredlog.js';
import { validateArenaRunlog } from '../src/lib/validateArenaRunlog.js';

const DATE = '2026-08-12';
const POST_NOW = '2026-08-12T20:35:00.000Z';

describe('shared history request budget', () => {
  it('waits before prediction history when catch-up consumed a full safe batch', () => {
    expect(planHistoryRequestBatches(['NVDA', 'AMD', 'MU'], {
      requestsAlreadyUsed: 18,
    })).toEqual([{
      waitBefore: true,
      symbols: ['NVDA', 'AMD', 'MU'],
    }]);
  });

  it('uses the remaining catch-up budget then splits large prediction sets into safe batches', () => {
    const symbols = Array.from({ length: 40 }, (_, index) => `SYM${index}`);
    const batches = planHistoryRequestBatches(symbols, { requestsAlreadyUsed: 16 });
    expect(batches.map((batch) => batch.symbols.length)).toEqual([2, 18, 18, 2]);
    expect(batches.map((batch) => batch.waitBefore)).toEqual([false, true, true, true]);
    expect(16 + batches[0].symbols.length).toBeLessThanOrEqual(18);
    expect(batches.slice(1).every((batch) => batch.symbols.length <= 18)).toBe(true);
  });
});

function pick(overrides = {}) {
  return {
    proposalId: 'arena:2026-08-12:T:sealed',
    sessionDate: DATE,
    decidedAt: '2026-08-12T12:45:00.000Z',
    expiresAt: '2026-08-12T21:00:00.000Z',
    allowedExecutionWindows: ['post-market'],
    ...overrides,
  };
}

function picks(tPicks = [pick()], overrides = {}) {
  return {
    date: DATE,
    decisionStatus: 'sealed',
    executable: true,
    models: { S: [], P: [], T: tPicks },
    ...overrides,
  };
}

function model(equity = 10_000, trades = []) {
  return { equity, trades };
}

function ledger(overrides = {}) {
  return {
    models: { S: model(), P: model(), T: model() },
    ...overrides,
  };
}

function settlementRuns() {
  return [
    { date: DATE, window: 'post-market', model: 'S', status: 'done', ordersProposed: 0, ordersFilled: 0, valuationOnly: true },
    { date: DATE, window: 'post-market', model: 'P', status: 'done', ordersProposed: 0, ordersFilled: 0, valuationOnly: true },
    { date: DATE, window: 'post-market', model: 'T', status: 'done', ordersProposed: 0, ordersFilled: 0, proposalIds: [] },
  ];
}

describe('post-market T intent selection', () => {
  it('selects only live same-session sealed post-market proposals', () => {
    const snapshot = picks([
      pick(),
      pick({ proposalId: 'expired', expiresAt: '2026-08-12T20:30:00.000Z' }),
      pick({ proposalId: 'late-only', allowedExecutionWindows: ['late-window'] }),
      pick({ proposalId: 'other-session', sessionDate: '2026-08-11' }),
    ]);
    expect(selectCurrentTProposalIntents(snapshot, DATE, POST_NOW)).toEqual([
      { proposalId: 'arena:2026-08-12:T:sealed' },
    ]);
  });

  it('returns a truthful empty intent list for missed, non-executable, stale, or empty snapshots', () => {
    expect(selectCurrentTProposalIntents(picks([]), DATE, POST_NOW)).toEqual([]);
    expect(selectCurrentTProposalIntents(picks([pick()], { decisionStatus: 'missed', executable: false }), DATE, POST_NOW)).toEqual([]);
    expect(selectCurrentTProposalIntents(picks([pick()], { date: '2026-08-11' }), DATE, POST_NOW)).toEqual([]);
  });

  it('turns a stale snapshot into a zero-order T valuation with an immutable missed decision identity', () => {
    const stale = picks([pick({ sessionDate: '2026-08-11' })], {
      date: '2026-08-11', decisionStatus: undefined, executable: undefined,
    });
    expect(planCurrentTPostmarketSettlement(stale, DATE, POST_NOW)).toEqual({
      book: 'T',
      window: 'post-market',
      etDateStr: DATE,
      proposedOrders: [],
      valuationOnly: true,
      decisionMissed: true,
    });
  });

  it('keeps a current sealed but empty T decision as a zero-order done execution, not missed', () => {
    expect(planCurrentTPostmarketSettlement(picks([]), DATE, POST_NOW)).toEqual({
      book: 'T', window: 'post-market', etDateStr: DATE, proposedOrders: [],
    });
  });

  it('permits T to remain missed while current-session valuation and review complete', () => {
    const runs = settlementRuns();
    runs[2] = {
      ...runs[2], status: 'missed', valuationOnly: true, decisionMissed: true,
    };
    expect(() => finalizeArenaPostmarketCandidates({
      beforeLedger: ledger(),
      settledLedger: ledger(),
      settledRunlog: { runs },
      predlog: { version: 1, updated: '2026-08-11T20:35:00.000Z', checkedThrough: '2026-08-11', days: [] },
      news: { date: '2026-08-11' },
      picks: picks([], { date: '2026-08-11', decisionStatus: 'missed', executable: false }),
      sessionDate: DATE,
      nowIso: POST_NOW,
    })).not.toThrow();
  });
});

describe('complete post-market group finalization', () => {
  it('adds the deterministic reviewer, digest, and scored predlog without inventing trades', () => {
    const before = ledger();
    const settled = ledger({
      models: {
        S: model(10_100),
        P: model(9_950),
        T: model(10_020, [{ ts: POST_NOW, sym: 'NVDA', side: 'buy' }]),
      },
    });
    const result = finalizeArenaPostmarketCandidates({
      beforeLedger: before,
      settledLedger: settled,
      settledRunlog: { runs: settlementRuns() },
      predlog: { version: 1, updated: '2026-08-11T20:35:00.000Z', checkedThrough: '2026-08-11', days: [] },
      news: {
        date: DATE,
        prices: { NVDA: { prevClose: 100 } },
        aiPredictions: { NVDA: { direction: 'UP', predOpenPct: 0.5, predClosePct: 1 } },
      },
      picks: picks(),
      sessionDate: DATE,
      nowIso: POST_NOW,
      actuals: { NVDA: { open: 101, close: 102 } },
      predictionEvidence: { NVDA: { sourceUrl: 'https://feida.au/api/history?symbol=NVDA' } },
    });

    expect(result.ledger).toBe(settled);
    expect(result.runlog.runs.at(-1)).toMatchObject({
      date: DATE, window: 'post-market', model: 'reviewer', status: 'done', ordersFilled: 0,
    });
    expect(result.digest.books).toEqual([
      expect.objectContaining({ model: 'S', pnlPct: 1, tradesCount: 0 }),
      expect.objectContaining({ model: 'P', pnlPct: -0.5, tradesCount: 0 }),
      expect.objectContaining({ model: 'T', pnlPct: 0.2, tradesCount: 1 }),
    ]);
    expect(result.predlog.checkedThrough).toBe(DATE);
    expect(result.predlog.days.at(-1)).toMatchObject({
      date: DATE,
      entries: { NVDA: { actualOpenPct: 1, actualClosePct: 2, dirHit: true } },
      audit: { status: 'scored' },
    });
    expect(validateArenaRunlog(result.runlog).ok).toBe(true);
    expect(validateArenaDigest(result.digest).ok).toBe(true);
    expect(validateArenaPredlog(result.predlog).ok).toBe(true);
  });

  it('records missed-source honestly and refuses to rewrite a reviewer identity', () => {
    const common = {
      beforeLedger: ledger(),
      settledLedger: ledger(),
      predlog: { version: 1, updated: '2026-08-11T20:35:00.000Z', checkedThrough: '2026-08-11', days: [] },
      news: { date: '2026-08-11' },
      picks: picks([]),
      sessionDate: DATE,
      nowIso: POST_NOW,
    };
    const result = finalizeArenaPostmarketCandidates({
      ...common,
      settledRunlog: { runs: settlementRuns() },
    });
    expect(result.predlog.days.at(-1).audit.status).toBe('missed-source');
    expect(result.predlog.checkedThrough).toBe(DATE);

    expect(() => finalizeArenaPostmarketCandidates({
      ...common,
      settledRunlog: {
        runs: [...settlementRuns(), {
          date: DATE, window: 'post-market', model: 'reviewer', status: 'done',
        }],
      },
    })).toThrow(/refusing to rewrite/);
  });
});
