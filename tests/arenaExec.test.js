import { describe, it, expect } from 'vitest';
import {
  orderEquityFraction,
  sliceOrder,
  capByParticipation,
  impactSlippageBps,
  planExecution,
} from '../src/lib/arenaExec.js';

describe('orderEquityFraction', () => {
  it('computes notional / equity', () => {
    expect(orderEquityFraction(2000, 10000)).toBeCloseTo(0.2, 6);
  });
  it('is 0 when equity is not positive (no divide-by-zero)', () => {
    expect(orderEquityFraction(2000, 0)).toBe(0);
  });
});

describe('sliceOrder', () => {
  it('returns the order unsplit when under the 10% threshold', () => {
    const order = { sym: 'NVDA', side: 'buy', qty: 5, refPx: 100 }; // $500 / $10,000 = 5%
    const slices = sliceOrder(order, 10000, { remainingWindows: 3 });
    expect(slices).toHaveLength(1);
    expect(slices[0].qty).toBe(5);
  });
  it('splits an order over 10% of equity across remaining windows', () => {
    const order = { sym: 'NVDA', side: 'buy', qty: 30, refPx: 100 }; // $3,000 / $10,000 = 30%
    const slices = sliceOrder(order, 10000, { remainingWindows: 3 });
    expect(slices.length).toBeGreaterThan(1);
    expect(slices.reduce((s, x) => s + x.qty, 0)).toBe(30); // whole qty preserved
  });
  it('never slices when only one window remains', () => {
    const order = { sym: 'NVDA', side: 'buy', qty: 30, refPx: 100 };
    const slices = sliceOrder(order, 10000, { remainingWindows: 1 });
    expect(slices).toHaveLength(1);
  });
  it('preserves other order fields on every slice', () => {
    const order = { sym: 'NVDA', side: 'buy', qty: 30, refPx: 100, confidence: 0.8 };
    const slices = sliceOrder(order, 10000, { remainingWindows: 2 });
    for (const s of slices) { expect(s.sym).toBe('NVDA'); expect(s.confidence).toBe(0.8); }
  });
});

describe('capByParticipation', () => {
  it('caps qty at maxParticipation of average volume', () => {
    // 5% of 1,000,000 = 50,000
    expect(capByParticipation(100000, 1000000, { maxParticipation: 0.05 })).toBe(50000);
  });
  it('leaves qty unchanged when already under the cap', () => {
    expect(capByParticipation(100, 1000000, { maxParticipation: 0.05 })).toBe(100);
  });
  it('leaves qty unchanged when no volume data is available (dormant until wired)', () => {
    expect(capByParticipation(100000, undefined)).toBe(100000);
    expect(capByParticipation(100000, 0)).toBe(100000);
  });
});

describe('impactSlippageBps', () => {
  it('falls back to baseBps when avgDollarVol is unavailable', () => {
    expect(impactSlippageBps(5000, undefined, 5)).toBe(5);
    expect(impactSlippageBps(5000, 0, 5)).toBe(5);
  });
  it('adds impact that grows with participation (bigger order vs same ADV = more slippage)', () => {
    const small = impactSlippageBps(10000, 10000000, 5);
    const big = impactSlippageBps(1000000, 10000000, 5);
    expect(big).toBeGreaterThan(small);
    expect(small).toBeGreaterThanOrEqual(5);
  });
  it('never returns less than baseBps for a positive order', () => {
    expect(impactSlippageBps(1, 10000000, 5)).toBeGreaterThanOrEqual(5);
  });
  it('clamps at maxBps for a pathologically large participation', () => {
    expect(impactSlippageBps(10000000, 1000, 5, { maxBps: 250 })).toBe(250);
  });
});

describe('planExecution', () => {
  it('combines slicing and participation cap into one plan', () => {
    const order = { sym: 'NVDA', side: 'buy', qty: 30, refPx: 100 };
    const plan = planExecution(order, { equity: 10000, avgVolume: 1000000, remainingWindows: 3 });
    expect(plan.sliced).toBe(true);
    expect(plan.totalQty).toBeLessThanOrEqual(30);
    expect(plan.slices.length).toBeGreaterThan(0);
  });
  it('reports an unsliced single-slice plan for a small order with no volume data', () => {
    const order = { sym: 'NVDA', side: 'buy', qty: 5, refPx: 100 };
    const plan = planExecution(order, { equity: 10000 });
    expect(plan.sliced).toBe(false);
    expect(plan.totalQty).toBe(5);
    expect(plan.estSlipBps).toBe(5);
  });
});
