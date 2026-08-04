import { describe, expect, it } from 'vitest';
import {
  buildPortfolioModel,
  computeFactorRows,
  maxDrawdown,
  resolveRegime,
  robustZScores,
  runQuantExperiment,
  walkForwardBacktest,
} from '../src/lib/arenaQuantModel.js';

function sessions(count = 250) {
  const start = Date.UTC(2025, 0, 2);
  return Array.from({ length: count }, (_, index) => new Date(start + (index * 86400000)).toISOString().slice(0, 10));
}

function history({ drift = 0.001, wave = 0.004, phase = 0, count = 250 } = {}) {
  let price = 100;
  return sessions(count).map((t, index) => {
    const move = drift + (Math.sin(index * 0.23 + phase) * wave);
    const open = price;
    price *= 1 + move;
    return { t, o: open, h: Math.max(open, price) * 1.004, l: Math.min(open, price) * 0.996, c: price, v: 1_000_000 + index * 1000 };
  });
}

const config = {
  benchmark: 'SPY',
  universe: [
    { sym: 'AAA', name: 'Alpha', sector: 'Compute' },
    { sym: 'BBB', name: 'Beta', sector: 'Compute' },
    { sym: 'CCC', name: 'Gamma', sector: 'Cloud' },
    { sym: 'DDD', name: 'Delta', sector: 'Power' },
  ],
  weights: { momentum: 0.38, trend: 0.27, resilience: 0.2, lowVol: 0.15 },
  settings: { maxNames: 4, maxWeight: 0.34, sectorCap: 0.45, rebalanceDays: 20, transactionCostBps: 10 },
};

function histories() {
  return {
    SPY: history({ drift: 0.0007, wave: 0.002 }),
    AAA: history({ drift: 0.0015, wave: 0.003, phase: 0.2 }),
    BBB: history({ drift: 0.0011, wave: 0.005, phase: 1.1 }),
    CCC: history({ drift: 0.0008, wave: 0.002, phase: 2.2 }),
    DDD: history({ drift: 0.0004, wave: 0.0015, phase: 0.8 }),
  };
}

describe('Arena QF-01 factor engine', () => {
  it('winsorizes cross-sectional z-scores and handles a flat cross-section', () => {
    expect(robustZScores([1, 1, 1])).toEqual([0, 0, 0]);
    expect(Math.max(...robustZScores([0, 1, 100]))).toBeLessThanOrEqual(3);
  });

  it('computes ranked, finite factor rows from completed histories', () => {
    const rows = computeFactorRows(histories(), config);
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => Number.isFinite(row.score) && Number.isFinite(row.beta))).toBe(true);
    expect(rows[0].score).toBeGreaterThanOrEqual(rows.at(-1).score);
  });

  it('detects an orderly rising benchmark as expansion', () => {
    expect(resolveRegime(history({ drift: 0.001, wave: 0.0002 })).id).toBe('expansion');
  });

  it('enforces single-name and sector caps before exposing a portfolio', () => {
    const model = buildPortfolioModel(histories(), config);
    expect(model.positions.length).toBeGreaterThan(1);
    expect(Math.max(...model.positions.map((position) => position.weight))).toBeLessThanOrEqual(0.340001);
    const computeSector = model.positions.filter((position) => position.sector === 'Compute').reduce((sum, position) => sum + position.weight, 0);
    expect(computeSector).toBeLessThanOrEqual(0.450001);
    expect(model.invested).toBeLessThanOrEqual(model.regime.grossTarget + 0.000001);
  });
});
describe('Arena QF-01 walk-forward engine', () => {
  it('produces a costed out-of-sample curve and diagnostics', () => {
    const result = runQuantExperiment(histories(), config);
    expect(result.backtest.curve.length).toBe(149);
    expect(result.backtest.metrics.observations).toBe(149);
    expect(result.backtest.metrics.rebalances).toBeGreaterThan(1);
    expect(Number.isFinite(result.backtest.metrics.sharpe)).toBe(true);
    expect(result.backtest.metrics.maxDrawdown).toBeLessThanOrEqual(0);
  });

  it('never lets the final bar change an earlier walk-forward observation', () => {
    const original = histories();
    const revised = structuredClone(original);
    revised.AAA.at(-1).c *= 1.8;
    const first = walkForwardBacktest(original, config);
    const second = walkForwardBacktest(revised, config);
    expect(second.curve.slice(0, -1)).toEqual(first.curve.slice(0, -1));
  });

  it('deducts configured transaction costs', () => {
    const tape = histories();
    const free = walkForwardBacktest(tape, { ...config, settings: { ...config.settings, transactionCostBps: 0 } });
    const costed = walkForwardBacktest(tape, { ...config, settings: { ...config.settings, transactionCostBps: 100 } });
    expect(costed.metrics.totalReturn).toBeLessThan(free.metrics.totalReturn);
  });

  it('reports drawdown from the running peak', () => {
    expect(maxDrawdown([1, 1.2, 0.9, 1.1])).toBeCloseTo(-0.25);
  });
});
