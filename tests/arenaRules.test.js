import { describe, it, expect } from 'vitest';
import {
  LIMITS,
  validateOrder,
  simulateFill,
  applyFill,
  rejectOrder,
  markToMarket,
  checkStopLoss,
  checkDailyCircuitBreaker,
  checkSeasonReset,
  resetSeason,
  computeMetrics,
} from '../src/lib/arenaRules.js';

function freshModel(overrides = {}) {
  return {
    promptVersion: 'A-v1',
    startEquity: 10000,
    cash: 10000,
    equity: 10000,
    equityHistory: [{ day: 0, equity: 10000 }],
    positions: [],
    trades: [],
    rejections: [],
    metrics: { cumPct: 0, maxDD: 0, hitRate: null, exposure: 0 },
    ...overrides,
  };
}

const UNIVERSE = ['NVDA', 'MU', 'AVGO', 'SPY'];

describe('validateOrder — malformed input', () => {
  it('rejects missing side', () => {
    const r = validateOrder({ sym: 'NVDA', qty: 1, refPx: 100 }, freshModel(), { model: 'A', universe: UNIVERSE });
    expect(r.ok).toBe(false);
  });
  it('rejects non-positive qty/refPx', () => {
    expect(validateOrder({ sym: 'NVDA', side: 'buy', qty: 0, refPx: 100, confidence: 0.9 }, freshModel(), { model: 'A', universe: UNIVERSE }).ok).toBe(false);
    expect(validateOrder({ sym: 'NVDA', side: 'buy', qty: 1, refPx: 0, confidence: 0.9 }, freshModel(), { model: 'A', universe: UNIVERSE }).ok).toBe(false);
  });
});

describe('validateOrder — no shorting / cash-account / long-only', () => {
  it('rejects a sell with no existing position (would be a short)', () => {
    const r = validateOrder({ sym: 'NVDA', side: 'sell', qty: 5, refPx: 100 }, freshModel(), { model: 'A', universe: UNIVERSE });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/shorting/);
  });
  it('rejects selling more than the held quantity', () => {
    const m = freshModel({ positions: [{ sym: 'NVDA', qty: 5, avgPx: 100, mkPx: 100 }] });
    const r = validateOrder({ sym: 'NVDA', side: 'sell', qty: 10, refPx: 100 }, m, { model: 'A', universe: UNIVERSE });
    expect(r.ok).toBe(false);
  });
  it('allows a sell that reduces/closes an existing long', () => {
    const m = freshModel({ positions: [{ sym: 'NVDA', qty: 5, avgPx: 100, mkPx: 100 }] });
    const r = validateOrder({ sym: 'NVDA', side: 'sell', qty: 5, refPx: 100 }, m, { model: 'A', universe: UNIVERSE });
    expect(r.ok).toBe(true);
  });
});

describe('validateOrder — fixed universe', () => {
  it('rejects a symbol outside the universe', () => {
    const r = validateOrder({ sym: 'GME', side: 'buy', qty: 1, refPx: 20, confidence: 0.9 }, freshModel(), { model: 'A', universe: UNIVERSE });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/universe/);
  });
});

describe('validateOrder — confidence floor', () => {
  it('rejects a new-position buy below the confidence floor', () => {
    const r = validateOrder({ sym: 'NVDA', side: 'buy', qty: 1, refPx: 100, confidence: 0.5 }, freshModel(), { model: 'A', universe: UNIVERSE });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/confidence/);
  });
  it('accepts a buy right at the confidence floor', () => {
    const r = validateOrder({ sym: 'NVDA', side: 'buy', qty: 1, refPx: 100, confidence: LIMITS.CONFIDENCE_FLOOR }, freshModel(), { model: 'A', universe: UNIVERSE });
    expect(r.ok).toBe(true);
  });
  it('risk-reducing sells are never gated by confidence', () => {
    const m = freshModel({ positions: [{ sym: 'NVDA', qty: 5, avgPx: 100, mkPx: 100 }] });
    const r = validateOrder({ sym: 'NVDA', side: 'sell', qty: 5, refPx: 100, confidence: 0.1 }, m, { model: 'A', universe: UNIVERSE });
    expect(r.ok).toBe(true);
  });
});

describe('validateOrder — turnover cap (Model A) / trade-day gate (Model B)', () => {
  it('rejects a Model A buy once the weekly cap is reached', () => {
    const r = validateOrder({ sym: 'NVDA', side: 'buy', qty: 1, refPx: 100, confidence: 0.9 }, freshModel(), { model: 'A', universe: UNIVERSE, weeklyTradeCount: LIMITS.MAX_WEEKLY_TRADES.A });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/turnover/);
  });
  it('allows a Model A buy just under the weekly cap', () => {
    const r = validateOrder({ sym: 'NVDA', side: 'buy', qty: 1, refPx: 100, confidence: 0.9 }, freshModel(), { model: 'A', universe: UNIVERSE, weeklyTradeCount: LIMITS.MAX_WEEKLY_TRADES.A - 1 });
    expect(r.ok).toBe(true);
  });
  it('rejects a Model B buy on a non Tue/Thu run', () => {
    const r = validateOrder({ sym: 'NVDA', side: 'buy', qty: 1, refPx: 100, confidence: 0.9 }, freshModel(), { model: 'B', universe: UNIVERSE, weekday: 3 }); // Wednesday
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Tue\/Thu/);
  });
  it('allows a Model B buy on Tuesday and Thursday', () => {
    expect(validateOrder({ sym: 'NVDA', side: 'buy', qty: 1, refPx: 100, confidence: 0.9 }, freshModel(), { model: 'B', universe: UNIVERSE, weekday: 2 }).ok).toBe(true);
    expect(validateOrder({ sym: 'NVDA', side: 'buy', qty: 1, refPx: 100, confidence: 0.9 }, freshModel(), { model: 'B', universe: UNIVERSE, weekday: 4 }).ok).toBe(true);
  });
  it('a Model B sell (risk reduction) is allowed on any day', () => {
    const m = freshModel({ positions: [{ sym: 'NVDA', qty: 5, avgPx: 100, mkPx: 100 }] });
    const r = validateOrder({ sym: 'NVDA', side: 'sell', qty: 5, refPx: 100 }, m, { model: 'B', universe: UNIVERSE, weekday: 3 });
    expect(r.ok).toBe(true);
  });
});

describe('validateOrder — single-position cap (20% of equity)', () => {
  it('rejects an order that would push a position over 20% of equity', () => {
    // 25 shares * $100 = $2500 = 25% of $10,000 equity
    const r = validateOrder({ sym: 'NVDA', side: 'buy', qty: 25, refPx: 100, confidence: 0.9 }, freshModel(), { model: 'A', universe: UNIVERSE });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/20/);
  });
  it('accepts an order right at the 20% boundary', () => {
    // 20 shares * $100 = $2000 = exactly 20% of $10,000
    const r = validateOrder({ sym: 'NVDA', side: 'buy', qty: 20, refPx: 100, confidence: 0.9 }, freshModel(), { model: 'A', universe: UNIVERSE });
    expect(r.ok).toBe(true);
  });
  it('accounts for an existing position when checking the cap (adds are cumulative)', () => {
    const m = freshModel({ positions: [{ sym: 'NVDA', qty: 15, avgPx: 100, mkPx: 100 }] });
    // existing 15 + new 10 = 25 shares * $100 = $2500 = 25% > 20%
    const r = validateOrder({ sym: 'NVDA', side: 'buy', qty: 10, refPx: 100, confidence: 0.9 }, m, { model: 'A', universe: UNIVERSE });
    expect(r.ok).toBe(false);
  });
});

describe('validateOrder — max distinct positions (<=8)', () => {
  it('rejects opening a 9th distinct symbol', () => {
    const positions = Array.from({ length: 8 }, (_, i) => ({ sym: `S${i}`, qty: 1, avgPx: 10, mkPx: 10 }));
    const m = freshModel({ positions, cash: 9900, equity: 9990 });
    const r = validateOrder({ sym: 'NVDA', side: 'buy', qty: 1, refPx: 50, confidence: 0.9 }, m, { model: 'A', universe: [...UNIVERSE, ...positions.map((p) => p.sym)] });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/8/);
  });
  it('allows adding to an already-held symbol even at 8 positions', () => {
    const positions = Array.from({ length: 8 }, (_, i) => ({ sym: `S${i}`, qty: 1, avgPx: 10, mkPx: 10 }));
    const m = freshModel({ positions, cash: 9900, equity: 9990 });
    const r = validateOrder({ sym: 'S0', side: 'buy', qty: 1, refPx: 10, confidence: 0.9 }, m, { model: 'A', universe: [...UNIVERSE, ...positions.map((p) => p.sym)] });
    expect(r.ok).toBe(true);
  });
});

describe('validateOrder — minimum cash buffer (>=5%)', () => {
  it('rejects a buy that would drop cash below 5% of equity', () => {
    const m = freshModel({ cash: 600, equity: 10000 }); // only 6% cash headroom before the trade
    const r = validateOrder({ sym: 'NVDA', side: 'buy', qty: 2, refPx: 100, confidence: 0.9 }, m, { model: 'A', universe: UNIVERSE }); // $200 notional -> cash 400 -> 4% < 5%
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/cash/);
  });
  it('accepts a buy that keeps cash at/above the 5% buffer', () => {
    const m = freshModel({ cash: 9000, equity: 10000 });
    const r = validateOrder({ sym: 'NVDA', side: 'buy', qty: 1, refPx: 100, confidence: 0.9 }, m, { model: 'A', universe: UNIVERSE });
    expect(r.ok).toBe(true);
  });
});

describe('simulateFill — slippage & fees', () => {
  it('Model A buys pay up (slippage adds to price) and Model B pays less slippage', () => {
    const order = { sym: 'NVDA', side: 'buy', qty: 10, refPx: 100 };
    const a = simulateFill(order, 'A');
    const b = simulateFill(order, 'B');
    expect(a.execPx).toBeGreaterThan(100);
    expect(b.execPx).toBeGreaterThan(100);
    expect(a.execPx).toBeGreaterThan(b.execPx); // A has wider slippage (5bp) than B (2bp)
    expect(a.slipBps).toBe(LIMITS.SLIPPAGE_BPS.A);
    expect(b.slipBps).toBe(LIMITS.SLIPPAGE_BPS.B);
  });
  it('sells receive less than the reference price', () => {
    const fill = simulateFill({ sym: 'NVDA', side: 'sell', qty: 10, refPx: 100 }, 'A');
    expect(fill.execPx).toBeLessThan(100);
  });
  it('charges a nonzero fee proportional to notional', () => {
    const fill = simulateFill({ sym: 'NVDA', side: 'buy', qty: 100, refPx: 100 }, 'A');
    expect(fill.fee).toBeGreaterThan(0);
    expect(fill.fee).toBeCloseTo(fill.notional * (LIMITS.FEE_BPS / 10000), 4);
  });
});

describe('applyFill — buys, adds, sells, weighted average cost', () => {
  it('opens a new position on a buy and deducts cash + fee', () => {
    const m = freshModel();
    const order = { sym: 'NVDA', side: 'buy', qty: 10, refPx: 100 };
    const fill = simulateFill(order, 'A');
    const next = applyFill(m, order, fill, 'T1');
    expect(next.positions).toHaveLength(1);
    expect(next.positions[0].qty).toBe(10);
    expect(next.cash).toBeCloseTo(m.cash - fill.execPx * 10 - fill.fee, 3);
    expect(next.trades).toHaveLength(1);
    // input untouched (pure function)
    expect(m.positions).toHaveLength(0);
  });
  it('computes a weighted-average cost basis when adding to an existing position', () => {
    const m = freshModel({ positions: [{ sym: 'NVDA', qty: 10, avgPx: 100, mkPx: 100 }], cash: 9000 });
    const order = { sym: 'NVDA', side: 'buy', qty: 10, refPx: 120 };
    const fill = simulateFill(order, 'A');
    const next = applyFill(m, order, fill, 'T2');
    const p = next.positions.find((x) => x.sym === 'NVDA');
    expect(p.qty).toBe(20);
    // avg should sit between 100 and fill.execPx (~120.06), weighted evenly
    expect(p.avgPx).toBeGreaterThan(100);
    expect(p.avgPx).toBeLessThan(fill.execPx);
  });
  it('fully closes a position on a matching sell and tags realized P&L', () => {
    const m = freshModel({ positions: [{ sym: 'NVDA', qty: 10, avgPx: 100, mkPx: 110 }], cash: 8900 });
    const order = { sym: 'NVDA', side: 'sell', qty: 10, refPx: 110 };
    const fill = simulateFill(order, 'A');
    const next = applyFill(m, order, fill, 'T3');
    expect(next.positions).toHaveLength(0);
    expect(next.trades[0].realizedPnl).not.toBeNull();
    expect(next.trades[0].realizedPnl).toBeGreaterThan(0); // sold above cost basis
  });
  it('partially closes a position and keeps the remainder at the same avg cost', () => {
    const m = freshModel({ positions: [{ sym: 'NVDA', qty: 10, avgPx: 100, mkPx: 110 }], cash: 8900 });
    const order = { sym: 'NVDA', side: 'sell', qty: 4, refPx: 110 };
    const fill = simulateFill(order, 'A');
    const next = applyFill(m, order, fill, 'T4');
    const p = next.positions.find((x) => x.sym === 'NVDA');
    expect(p.qty).toBe(6);
    expect(p.avgPx).toBe(100);
  });
});

describe('rejectOrder', () => {
  it('appends a rejection record without touching balances', () => {
    const m = freshModel();
    const next = rejectOrder(m, { sym: 'GME', side: 'buy', qty: 1, refPx: 20 }, 'outside universe', 'T1');
    expect(next.rejections).toHaveLength(1);
    expect(next.cash).toBe(m.cash);
  });
});

describe('markToMarket', () => {
  it('updates position mkPx and recomputes equity', () => {
    const m = freshModel({ positions: [{ sym: 'NVDA', qty: 10, avgPx: 100, mkPx: 100 }], cash: 9000, equity: 10000 });
    const next = markToMarket(m, { NVDA: 120 });
    expect(next.positions[0].mkPx).toBe(120);
    expect(next.equity).toBe(9000 + 10 * 120);
  });
  it('leaves a position mkPx unchanged if no new price is supplied', () => {
    const m = freshModel({ positions: [{ sym: 'NVDA', qty: 10, avgPx: 100, mkPx: 100 }], cash: 9000 });
    const next = markToMarket(m, {});
    expect(next.positions[0].mkPx).toBe(100);
  });
});

describe('checkStopLoss', () => {
  it('flags a Model A position down 8% or more from cost as a forced sell', () => {
    const m = freshModel({ positions: [{ sym: 'NVDA', qty: 10, avgPx: 100, mkPx: 91 }] }); // -9%
    const orders = checkStopLoss(m, 'A');
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ sym: 'NVDA', side: 'sell', qty: 10, reduceOnly: true });
  });
  it('does not flag a position within the stop for its model (B allows deeper drawdown)', () => {
    const m = freshModel({ positions: [{ sym: 'NVDA', qty: 10, avgPx: 100, mkPx: 91 }] }); // -9%, fine for B (-15% stop)
    expect(checkStopLoss(m, 'B')).toHaveLength(0);
  });
  it('flags a Model B position down 15% or more', () => {
    const m = freshModel({ positions: [{ sym: 'NVDA', qty: 10, avgPx: 100, mkPx: 84 }] }); // -16%
    expect(checkStopLoss(m, 'B')).toHaveLength(1);
  });
});

describe('checkDailyCircuitBreaker', () => {
  it('trips when the day is down 3% or more', () => {
    expect(checkDailyCircuitBreaker(10000, 9699)).toBe(true); // -3.01%
  });
  it('does not trip on a smaller drawdown', () => {
    expect(checkDailyCircuitBreaker(10000, 9750)).toBe(false); // -2.5%
  });
});

describe('checkSeasonReset / resetSeason', () => {
  it('trips when cumulative loss reaches 20%', () => {
    const m = freshModel({ startEquity: 10000, equity: 7999 });
    expect(checkSeasonReset(m)).toBe(true);
  });
  it('does not trip above the 20% threshold', () => {
    const m = freshModel({ startEquity: 10000, equity: 8500 });
    expect(checkSeasonReset(m)).toBe(false);
  });
  it('resetSeason gives a fresh $10,000 ledger but keeps trade/rejection history for the post-mortem', () => {
    const m = freshModel({ startEquity: 10000, equity: 7900, promptVersion: 'A-v1', trades: [{ ts: 'x' }], rejections: [{ ts: 'y' }] });
    const next = resetSeason(m, 'A-v2', 42);
    expect(next.equity).toBe(10000);
    expect(next.cash).toBe(10000);
    expect(next.positions).toHaveLength(0);
    expect(next.promptVersion).toBe('A-v2');
    expect(next.equityHistory).toEqual([{ day: 42, equity: 10000 }]);
    expect(next.trades).toHaveLength(1); // history preserved
    expect(next.rejections).toHaveLength(1);
  });
});

describe('computeMetrics', () => {
  it('computes cumPct relative to start equity', () => {
    const m = freshModel({ startEquity: 10000, equity: 10500, equityHistory: [{ day: 0, equity: 10000 }, { day: 1, equity: 10500 }] });
    expect(computeMetrics(m).cumPct).toBeCloseTo(5, 3);
  });
  it('computes maxDD from the equity curve, not just start-vs-now', () => {
    const m = freshModel({
      startEquity: 10000,
      equity: 10200,
      equityHistory: [{ day: 0, equity: 10000 }, { day: 1, equity: 11000 }, { day: 2, equity: 9900 }, { day: 3, equity: 10200 }],
    });
    // peak 11000 -> trough 9900 = -10% drawdown, even though "now" is +2% from start
    expect(computeMetrics(m).maxDD).toBeCloseTo(-10, 3);
  });
  it('hitRate is null with no closed trades, and computed correctly once there are some', () => {
    const empty = freshModel();
    expect(computeMetrics(empty).hitRate).toBeNull();
    const withTrades = freshModel({
      trades: [
        { side: 'buy', realizedPnl: null },
        { side: 'sell', realizedPnl: 50 },
        { side: 'sell', realizedPnl: -20 },
        { side: 'sell', realizedPnl: 10 },
      ],
    });
    expect(computeMetrics(withTrades).hitRate).toBeCloseTo((2 / 3) * 100, 1);
  });
  it('computes exposure as position value / equity', () => {
    const m = freshModel({ cash: 8000, equity: 10000, positions: [{ sym: 'NVDA', qty: 10, avgPx: 100, mkPx: 200 }] });
    expect(computeMetrics(m).exposure).toBeCloseTo(20, 1); // 2000/10000
  });
});

describe('never trust the model — end-to-end guardrail sanity', () => {
  it('a proposed order that violates any hard limit never reaches applyFill in a correct caller', () => {
    // simulate the intended calling pattern: validate first, only apply on ok
    const m = freshModel();
    const badOrder = { sym: 'NVDA', side: 'buy', qty: 1000, refPx: 100, confidence: 0.9 }; // wildly over position cap
    const check = validateOrder(badOrder, m, { model: 'A', universe: UNIVERSE });
    expect(check.ok).toBe(false);
    const next = check.ok ? applyFill(m, badOrder, simulateFill(badOrder, 'A'), 'T') : rejectOrder(m, badOrder, check.reason, 'T');
    expect(next.positions).toHaveLength(0);
    expect(next.rejections).toHaveLength(1);
  });
});
