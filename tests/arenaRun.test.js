import { describe, it, expect } from 'vitest';
import { runArenaLedger, bootstrapSeason2 } from '../src/lib/arenaRun.js';

// arenaRun.js orchestrates arenaRules.js for one scheduled-task run (V4,
// ROADMAP §7.1). Ledger math is the project's one "silently-wrong is
// unforgivable" bug class (see CLAUDE.md), so this file exists specifically
// to exercise the orchestration layer end to end — arenaRules.test.js already
// covers each primitive in isolation.

const UNIVERSE = ['NVDA', 'MU', 'AVGO', 'SPY', 'SMH'];

function freshLedger(overrides = {}) {
  const model = (over = {}) => ({
    promptVersion: 'A-v1', startEquity: 10000, cash: 10000, equity: 10000,
    dayStartEquity: 10000,
    equityHistory: [{ day: 0, equity: 10000 }],
    positions: [], trades: [], rejections: [],
    metrics: { cumPct: 0, maxDD: 0, hitRate: null, exposure: 0 },
    review: { zh: '尚未开仓', en: 'No trades yet' },
    ...over,
  });
  return {
    updated: '2026-07-04', version: 1, day: 0, season: 1, lastRunDate: null,
    bench: { spyPct: 0, smhPct: 0 },
    models: { A: model({ promptVersion: 'A-v1' }), B: model({ promptVersion: 'B-v1' }) },
    ...overrides,
  };
}

describe('runArenaLedger — single-run orchestration (V4)', () => {
  it('first-ever run: day 0 -> 1, dayStartEquity seeded, lastRunDate stamped', () => {
    const { ledger, summary } = runArenaLedger(freshLedger(), 'A', {
      etDateStr: '2026-07-06', nowIso: '2026-07-06T14:35:00Z',
      priceMap: { NVDA: 195 }, universe: UNIVERSE, proposedOrders: [],
    });
    expect(summary.day).toBe(1);
    expect(ledger.day).toBe(1);
    expect(ledger.lastRunDate).toBe('2026-07-06');
    expect(ledger.models.A.dayStartEquity).toBe(10000);
  });

  it('a valid buy order fills and updates cash/positions/equityHistory', () => {
    const { ledger, summary } = runArenaLedger(freshLedger(), 'A', {
      etDateStr: '2026-07-06', nowIso: '2026-07-06T14:35:00Z',
      priceMap: { NVDA: 100 }, universe: UNIVERSE,
      proposedOrders: [{ sym: 'NVDA', side: 'buy', qty: 10, refPx: 100, confidence: 0.8 }],
    });
    expect(summary.filled.length).toBe(1);
    expect(summary.rejected.length).toBe(0);
    const a = ledger.models.A;
    expect(a.positions).toHaveLength(1);
    expect(a.positions[0].sym).toBe('NVDA');
    expect(a.cash).toBeLessThan(10000);
    expect(a.equityHistory.find((h) => h.day === 1)).toBeTruthy();
  });

  it('an order outside the fixed universe is rejected, not silently dropped', () => {
    const { summary, ledger } = runArenaLedger(freshLedger(), 'A', {
      etDateStr: '2026-07-06', nowIso: '2026-07-06T14:35:00Z',
      priceMap: { XYZ: 50 }, universe: UNIVERSE,
      proposedOrders: [{ sym: 'XYZ', side: 'buy', qty: 5, refPx: 50, confidence: 0.9 }],
    });
    expect(summary.filled.length).toBe(0);
    expect(summary.rejected.length).toBe(1);
    expect(summary.rejected[0].reason).toMatch(/fixed trading universe/);
    expect(ledger.models.A.rejections.length).toBe(1);
  });

  it('below-confidence-floor new-position order is rejected', () => {
    const { summary } = runArenaLedger(freshLedger(), 'A', {
      etDateStr: '2026-07-06', nowIso: '2026-07-06T14:35:00Z',
      priceMap: { NVDA: 100 }, universe: UNIVERSE,
      proposedOrders: [{ sym: 'NVDA', side: 'buy', qty: 5, refPx: 100, confidence: 0.4 }],
    });
    expect(summary.rejected.length).toBe(1);
    expect(summary.rejected[0].reason).toMatch(/confidence/);
  });

  it('same-day second run (e.g. Model A late window) does not increment day or reset dayStartEquity', () => {
    const first = runArenaLedger(freshLedger(), 'A', {
      etDateStr: '2026-07-06', nowIso: '2026-07-06T14:35:00Z',
      priceMap: { NVDA: 100 }, universe: UNIVERSE, proposedOrders: [],
    });
    const second = runArenaLedger(first.ledger, 'A', {
      etDateStr: '2026-07-06', nowIso: '2026-07-06T19:45:00Z',
      priceMap: { NVDA: 102 }, universe: UNIVERSE, proposedOrders: [],
    });
    expect(second.summary.day).toBe(1); // still day 1, not 2
    expect(second.ledger.models.A.dayStartEquity).toBe(first.ledger.models.A.dayStartEquity);
  });

  it('a new calendar trading day increments day and resets dayStartEquity to that day\'s opening equity', () => {
    const day1 = runArenaLedger(freshLedger(), 'A', {
      etDateStr: '2026-07-06', nowIso: '2026-07-06T14:35:00Z',
      priceMap: { NVDA: 100 }, universe: UNIVERSE,
      proposedOrders: [{ sym: 'NVDA', side: 'buy', qty: 10, refPx: 100, confidence: 0.8 }],
    });
    const day2 = runArenaLedger(day1.ledger, 'A', {
      etDateStr: '2026-07-07', nowIso: '2026-07-07T14:35:00Z',
      priceMap: { NVDA: 105 }, universe: UNIVERSE, proposedOrders: [],
    });
    expect(day2.summary.day).toBe(2);
    // dayStartEquity for day 2 is marked at day 2's OWN opening quotes (105), not a
    // carried-over number priced with yesterday's quotes — that's the correct
    // "day P&L vs today's open" semantics the circuit breaker needs.
    const posValueAtDay2Open = day1.ledger.models.A.positions.reduce((s, p) => s + p.qty * 105, 0);
    const expectedDayStart = Number((day1.ledger.models.A.cash + posValueAtDay2Open).toFixed(4));
    expect(day2.ledger.models.A.dayStartEquity).toBeCloseTo(expectedDayStart, 2);
  });

  it('daily circuit breaker blocks new buys once day P&L <= -3%, but sells still pass', () => {
    const ledgerWithDrop = freshLedger({
      models: {
        A: {
          promptVersion: 'A-v1', startEquity: 10000, cash: 9600, equity: 9600, dayStartEquity: 10000,
          equityHistory: [{ day: 1, equity: 9600 }], positions: [], trades: [], rejections: [],
          metrics: { cumPct: 0, maxDD: 0, hitRate: null, exposure: 0 }, review: { zh: '', en: '' },
        },
        B: freshLedger().models.B,
      },
      lastRunDate: '2026-07-06', day: 1,
    });
    const { summary } = runArenaLedger(ledgerWithDrop, 'A', {
      etDateStr: '2026-07-06', nowIso: '2026-07-06T19:00:00Z',
      priceMap: { NVDA: 90 }, universe: UNIVERSE,
      proposedOrders: [{ sym: 'NVDA', side: 'buy', qty: 5, refPx: 90, confidence: 0.9 }],
    });
    expect(summary.riskLockdown).toBe(true);
    expect(summary.rejected[0].reason).toMatch(/circuit breaker/);
  });

  it('stop-loss sweep force-sells a position breaching the per-model stop, ahead of any proposed orders', () => {
    const ledgerWithLoser = freshLedger({
      models: {
        A: {
          promptVersion: 'A-v1', startEquity: 10000, cash: 5000, equity: 9000, dayStartEquity: 10000,
          equityHistory: [{ day: 1, equity: 9000 }],
          positions: [{ sym: 'MU', qty: 10, avgPx: 100, mkPx: 100 }],
          trades: [], rejections: [],
          metrics: { cumPct: 0, maxDD: 0, hitRate: null, exposure: 0 }, review: { zh: '', en: '' },
        },
        B: freshLedger().models.B,
      },
      lastRunDate: '2026-07-06', day: 1,
    });
    // MU drops to 90 -> -10% drawdown from avgPx 100, breaches Model A's -8% stop
    const { summary, ledger } = runArenaLedger(ledgerWithLoser, 'A', {
      etDateStr: '2026-07-06', nowIso: '2026-07-06T19:00:00Z',
      priceMap: { MU: 90 }, universe: UNIVERSE, proposedOrders: [],
    });
    expect(summary.filled.some((f) => f.forced === 'stop-loss' && f.order.sym === 'MU')).toBe(true);
    expect(ledger.models.A.positions.find((p) => p.sym === 'MU')).toBeUndefined();
  });

  it('Model B may only open new positions on Tue/Thu ET trading days', () => {
    // 2026-07-06 is a Monday (weekday 1) — Model B open should be rejected
    const monday = runArenaLedger(freshLedger(), 'B', {
      etDateStr: '2026-07-06', nowIso: '2026-07-06T21:30:00Z',
      priceMap: { NVDA: 100 }, universe: UNIVERSE,
      proposedOrders: [{ sym: 'NVDA', side: 'buy', qty: 5, refPx: 100, confidence: 0.9 }],
    });
    expect(monday.summary.rejected[0].reason).toMatch(/Tue\/Thu/);

    // 2026-07-07 is a Tuesday (weekday 2) — should be allowed
    const tuesday = runArenaLedger(freshLedger(), 'B', {
      etDateStr: '2026-07-07', nowIso: '2026-07-07T21:30:00Z',
      priceMap: { NVDA: 100 }, universe: UNIVERSE,
      proposedOrders: [{ sym: 'NVDA', side: 'buy', qty: 5, refPx: 100, confidence: 0.9 }],
    });
    expect(tuesday.summary.filled.length).toBe(1);
  });

  it('season reset fires at -20% cumulative and bumps promptVersion, clearing positions but keeping trade history', () => {
    const wrecked = freshLedger({
      models: {
        A: {
          promptVersion: 'A-v1', startEquity: 10000, cash: 7900, equity: 7900, dayStartEquity: 8000,
          equityHistory: [{ day: 5, equity: 7900 }],
          positions: [],
          trades: [{ ts: '2026-07-01T14:00:00Z', sym: 'NVDA', side: 'sell', qty: 5, px: 90, fee: 1, slipBps: 5, realizedPnl: -500 }],
          rejections: [],
          metrics: { cumPct: -21, maxDD: -21, hitRate: 0, exposure: 0 }, review: { zh: '', en: '' },
        },
        B: freshLedger().models.B,
      },
      lastRunDate: '2026-07-06', day: 5,
    });
    const { summary, ledger } = runArenaLedger(wrecked, 'A', {
      etDateStr: '2026-07-07', nowIso: '2026-07-07T14:00:00Z',
      priceMap: {}, universe: UNIVERSE, proposedOrders: [],
    });
    expect(summary.seasonReset).toBe(true);
    expect(ledger.models.A.equity).toBe(10000);
    expect(ledger.models.A.promptVersion).toBe('A-v2');
    expect(ledger.models.A.trades.length).toBe(1); // history kept for the post-mortem
  });

  it('review text is only overwritten when the caller supplies it', () => {
    const { ledger } = runArenaLedger(freshLedger(), 'A', {
      etDateStr: '2026-07-06', nowIso: '2026-07-06T14:35:00Z',
      priceMap: {}, universe: UNIVERSE, proposedOrders: [],
    });
    expect(ledger.models.A.review.en).toBe('No trades yet');

    const { ledger: ledger2 } = runArenaLedger(freshLedger(), 'A', {
      etDateStr: '2026-07-06', nowIso: '2026-07-06T14:35:00Z',
      priceMap: {}, universe: UNIVERSE, proposedOrders: [],
      reviewZh: '今日观望', reviewEn: 'Sat on hands today',
    });
    expect(ledger2.models.A.review.en).toBe('Sat on hands today');
  });

  it('bench percentages update only when the caller supplies benchPct', () => {
    const { ledger } = runArenaLedger(freshLedger(), 'A', {
      etDateStr: '2026-07-06', nowIso: '2026-07-06T14:35:00Z',
      priceMap: {}, universe: UNIVERSE, proposedOrders: [],
      benchPct: { spyPct: 0.6, smhPct: 1.1 },
    });
    expect(ledger.bench).toEqual({ spyPct: 0.6, smhPct: 1.1 });
  });

  it('never mutates the input ledger object (pure function)', () => {
    const input = freshLedger();
    const snapshot = JSON.parse(JSON.stringify(input));
    runArenaLedger(input, 'A', {
      etDateStr: '2026-07-06', nowIso: '2026-07-06T14:35:00Z',
      priceMap: { NVDA: 100 }, universe: UNIVERSE,
      proposedOrders: [{ sym: 'NVDA', side: 'buy', qty: 10, refPx: 100, confidence: 0.8 }],
    });
    expect(input).toEqual(snapshot);
  });

  it('throws on an invalid book instead of silently no-op-ing', () => {
    expect(() => runArenaLedger(freshLedger(), 'C', {
      etDateStr: '2026-07-06', nowIso: '2026-07-06T14:35:00Z', priceMap: {}, universe: UNIVERSE,
    })).toThrow();
  });
});

/* ============================================================
   PART 4 — Season 2 books (S/P/T) run through the same orchestration
   (urgent.md §17-21). Season-2-shaped ledger fixture for these tests.
   ============================================================ */

function freshSeason2Ledger(overrides = {}) {
  const model = (over = {}) => ({
    promptVersion: 'S-v1', startEquity: 10000, cash: 10000, equity: 10000,
    dayStartEquity: 10000,
    equityHistory: [{ day: 0, equity: 10000 }],
    positions: [], trades: [], rejections: [],
    metrics: { cumPct: 0, maxDD: 0, hitRate: null, exposure: 0 },
    review: { zh: '尚未开仓', en: 'No trades yet' },
    ...over,
  });
  return {
    updated: '2026-07-23', version: 2, day: 0, season: 2, lastRunDate: null,
    bench: { spyPct: 0, smhPct: 0 },
    models: {
      S: model({ promptVersion: 'S-v1' }),
      P: model({ promptVersion: 'P-v1' }),
      T: model({ promptVersion: 'T-v1' }),
    },
    ...overrides,
  };
}

describe('runArenaLedger — Season 2 books S/P/T', () => {
  it('accepts book S/P/T and settles a valid order the same way A/B do', () => {
    const { ledger, summary } = runArenaLedger(freshSeason2Ledger(), 'S', {
      etDateStr: '2026-07-23', nowIso: '2026-07-23T14:35:00Z',
      priceMap: { NVDA: 100 }, universe: UNIVERSE,
      proposedOrders: [{ sym: 'NVDA', side: 'buy', qty: 10, refPx: 100, confidence: 0.75, signals: ['sentiment', 'event'] }],
    });
    expect(summary.filled.length).toBe(1);
    expect(ledger.models.S.positions).toHaveLength(1);
  });

  it('Model T requires >=2 signals — a single-signal order is rejected end to end', () => {
    const { summary } = runArenaLedger(freshSeason2Ledger(), 'T', {
      etDateStr: '2026-07-23', nowIso: '2026-07-23T21:00:00Z', // Thursday
      priceMap: { NVDA: 100 }, universe: UNIVERSE,
      proposedOrders: [{ sym: 'NVDA', side: 'buy', qty: 5, refPx: 100, confidence: 0.9, signals: ['insider-buy'] }],
    });
    expect(summary.rejected.length).toBe(1);
    expect(summary.rejected[0].reason).toMatch(/signal/);
  });

  it('Model P exitBy sweep force-closes a position on schedule, ahead of any new proposal', () => {
    const withOpenPosition = freshSeason2Ledger({
      models: {
        S: freshSeason2Ledger().models.S,
        T: freshSeason2Ledger().models.T,
        P: {
          promptVersion: 'P-v1', startEquity: 10000, cash: 9000, equity: 10000, dayStartEquity: 10000,
          equityHistory: [{ day: 1, equity: 10000 }],
          positions: [{ sym: 'NVDA', qty: 10, avgPx: 100, mkPx: 100, exitBy: '2026-07-23' }],
          trades: [], rejections: [],
          metrics: { cumPct: 0, maxDD: 0, hitRate: null, exposure: 0 }, review: { zh: '', en: '' },
        },
      },
      lastRunDate: '2026-07-22', day: 1,
    });
    const { summary, ledger } = runArenaLedger(withOpenPosition, 'P', {
      etDateStr: '2026-07-23', nowIso: '2026-07-23T14:35:00Z',
      priceMap: { NVDA: 105 }, universe: UNIVERSE, proposedOrders: [],
    });
    expect(summary.filled.some((f) => f.forced === 'exitBy' && f.order.sym === 'NVDA')).toBe(true);
    expect(ledger.models.P.positions).toHaveLength(0);
  });
});

describe('bootstrapSeason2', () => {
  it('seeds three fresh $10,000 books keyed S/P/T', () => {
    const s1 = freshLedger(); // Season 1 A/B ledger
    const s2 = bootstrapSeason2(s1, { day: 0 });
    expect(Object.keys(s2.models).sort()).toEqual(['P', 'S', 'T']);
    for (const key of ['S', 'P', 'T']) {
      expect(s2.models[key].equity).toBe(10000);
      expect(s2.models[key].cash).toBe(10000);
      expect(s2.models[key].positions).toHaveLength(0);
    }
  });
  it('bumps version and season, resets day/lastRunDate', () => {
    const s1 = freshLedger({ version: 1, season: 1 });
    const s2 = bootstrapSeason2(s1);
    expect(s2.version).toBe(2);
    expect(s2.season).toBe(2);
    expect(s2.day).toBe(0);
    expect(s2.lastRunDate).toBeNull();
  });
  it('does not mutate the Season 1 input (pure function)', () => {
    const s1 = freshLedger();
    const snapshot = JSON.parse(JSON.stringify(s1));
    bootstrapSeason2(s1);
    expect(s1).toEqual(snapshot);
  });
  it('accepts custom starting prompt versions', () => {
    const s2 = bootstrapSeason2(freshLedger(), { promptVersions: { S: 'S-v2', P: 'P-v2', T: 'T-v2' } });
    expect(s2.models.S.promptVersion).toBe('S-v2');
  });
  it('overrides note_en/note_zh when supplied, otherwise leaves Season 1 copy untouched', () => {
    const s1 = freshLedger({ note_en: 'Season 1 text', note_zh: 'S1 文案' });
    const withOverride = bootstrapSeason2(s1, { note_en: 'Season 2 text', note_zh: 'S2 文案' });
    expect(withOverride.note_en).toBe('Season 2 text');
    expect(withOverride.note_zh).toBe('S2 文案');
    const withoutOverride = bootstrapSeason2(s1);
    expect(withoutOverride.note_en).toBe('Season 1 text'); // carried over -- caller's responsibility to supply new copy
  });
});
