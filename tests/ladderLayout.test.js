import { describe, it, expect } from 'vitest';
import { declutter1D, fitExtent } from '../src/lib/ladderLayout.js';

describe('declutter1D', () => {
  it('leaves already-spaced targets untouched', () => {
    const out = declutter1D([0, 20, 40, 60], { minGap: 15 });
    expect(out).toEqual([0, 20, 40, 60]);
  });

  it('reproduces the screenshot bug scenario: a dense cluster of near-identical prices', () => {
    // 8 levels all within a couple of px of each other (the exact failure mode
    // reported: "207.18 / 206.85", "199.14 / 199.11", "194.x / 194.x" overlapping)
    const targets = [100, 100.5, 101, 101.2, 101.4, 150, 150.3, 200];
    const out = declutter1D(targets, { minGap: 15 });
    const sorted = [...out].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(15 - 1e-9);
    }
  });

  it('preserves relative order (no crossing)', () => {
    const targets = [50, 10, 30, 10.1, 49.9, 5];
    const out = declutter1D(targets, { minGap: 12 });
    // for every pair, original ordering (by target) must match output ordering
    for (let i = 0; i < targets.length; i++) {
      for (let j = 0; j < targets.length; j++) {
        if (targets[i] < targets[j]) expect(out[i]).toBeLessThanOrEqual(out[j] + 1e-9);
      }
    }
  });

  it('handles all-identical targets by spreading them evenly', () => {
    const out = declutter1D([100, 100, 100, 100], { minGap: 10 });
    const sorted = [...out].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i] - sorted[i - 1]).toBeCloseTo(10);
  });

  it('is a no-op-safe on 0 or 1 items', () => {
    expect(declutter1D([], { minGap: 10 })).toEqual([]);
    expect(declutter1D([42], { minGap: 10 })).toEqual([42]);
  });
});

describe('fitExtent', () => {
  it('needs no offset or extra size when everything already fits', () => {
    const { offset, size } = fitExtent([10, 50, 90], 100);
    expect(offset).toBe(0);
    expect(size).toBe(100);
  });

  it('computes a positive offset when a label lands above zero', () => {
    const { offset, size } = fitExtent([-20, 10, 50], 100);
    expect(offset).toBe(20);
    expect(size).toBe(120);
  });

  it('grows size when a label lands below the extent', () => {
    const { offset, size } = fitExtent([10, 50, 140], 100);
    expect(offset).toBe(0);
    expect(size).toBe(140);
  });
});
