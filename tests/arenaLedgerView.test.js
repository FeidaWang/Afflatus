import { describe, it, expect } from 'vitest';
import { unrealizedPnl, benchmarkEndpoints, equityDomain, scalePoint } from '../src/lib/arenaLedgerView.js';

describe('unrealizedPnl', () => {
  it('computes positive P&L', () => {
    expect(unrealizedPnl({ qty: 10, avgPx: 100, mkPx: 110 })).toEqual({ pnl: 100, pnlPct: 10 });
  });
  it('computes negative P&L', () => {
    expect(unrealizedPnl({ qty: 4, avgPx: 200, mkPx: 180 })).toEqual({ pnl: -80, pnlPct: -10 });
  });
  it('handles zero avgPx without dividing by zero', () => {
    expect(unrealizedPnl({ qty: 1, avgPx: 0, mkPx: 5 })).toEqual({ pnl: 0, pnlPct: 0 });
  });
});

describe('benchmarkEndpoints', () => {
  it('returns empty for no history', () => {
    expect(benchmarkEndpoints([], 10000, 1)).toEqual([]);
    expect(benchmarkEndpoints(null, 10000, 1)).toEqual([]);
  });
  it('collapses to a single point when only day 0 exists', () => {
    expect(benchmarkEndpoints([{ day: 0, equity: 10000 }], 10000, 2.5)).toEqual([{ day: 0, equity: 10000 }]);
  });
  it('draws a two-point start->now line scaled by the cumulative bench %', () => {
    const hist = [{ day: 0, equity: 10000 }, { day: 1, equity: 10120 }, { day: 3, equity: 10300 }];
    expect(benchmarkEndpoints(hist, 10000, 1.5)).toEqual([{ day: 0, equity: 10000 }, { day: 3, equity: 10150 }]);
  });
  it('treats a missing bench pct as flat (0%)', () => {
    const hist = [{ day: 0, equity: 10000 }, { day: 2, equity: 9800 }];
    expect(benchmarkEndpoints(hist, 10000, undefined)).toEqual([{ day: 0, equity: 10000 }, { day: 2, equity: 10000 }]);
  });
});

describe('equityDomain', () => {
  it('spans across multiple series', () => {
    const a = [{ day: 0, equity: 9000 }, { day: 2, equity: 11000 }];
    const b = [{ day: 0, equity: 10000 }, { day: 2, equity: 10500 }];
    expect(equityDomain([a, b])).toEqual({ minDay: 0, maxDay: 2, minEq: 9000, maxEq: 11000 });
  });
  it('falls back to a safe default domain when every series is empty', () => {
    expect(equityDomain([[], []])).toEqual({ minDay: 0, maxDay: 1, minEq: 0, maxEq: 1 });
  });
  it('pads a single degenerate day so the axis is not zero-width', () => {
    const flat = [{ day: 0, equity: 10000 }];
    const d = equityDomain([flat]);
    expect(d.minDay).toBe(0);
    expect(d.maxDay).toBe(1);
    expect(d.minEq).toBeLessThan(10000);
    expect(d.maxEq).toBeGreaterThan(10000);
  });
});

describe('scalePoint', () => {
  it('maps the domain corners to the canvas corners (y flipped)', () => {
    const domain = { minDay: 0, maxDay: 10, minEq: 100, maxEq: 200 };
    expect(scalePoint({ day: 0, equity: 100 }, domain, 100, 50, 0)).toEqual({ x: 0, y: 50 });
    expect(scalePoint({ day: 10, equity: 200 }, domain, 100, 50, 0)).toEqual({ x: 100, y: 0 });
  });
  it('respects padding on all sides', () => {
    const domain = { minDay: 0, maxDay: 10, minEq: 0, maxEq: 10 };
    const p = scalePoint({ day: 0, equity: 0 }, domain, 100, 100, 10);
    expect(p).toEqual({ x: 10, y: 90 });
  });
  it('maps the midpoint to the canvas centre', () => {
    const domain = { minDay: 0, maxDay: 2, minEq: 0, maxEq: 2 };
    expect(scalePoint({ day: 1, equity: 1 }, domain, 200, 200, 0)).toEqual({ x: 100, y: 100 });
  });
});
