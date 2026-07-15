import { describe, it, expect } from 'vitest';
import { nextSlot, lifePhase, isAlive } from '../src/bootengine/render/particles';

describe('nextSlot (ring-buffer index)', () => {
  it('cycles 0..poolSize-1 and wraps', () => {
    const poolSize = 4;
    const slots = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => nextSlot(n, poolSize));
    expect(slots).toEqual([0, 1, 2, 3, 0, 1, 2, 3]);
  });

  it('never returns an out-of-range index for a large spawn count', () => {
    const poolSize = 250;
    for (const n of [0, 1, 249, 250, 251, 10000, 999999]) {
      const slot = nextSlot(n, poolSize);
      expect(slot).toBeGreaterThanOrEqual(0);
      expect(slot).toBeLessThan(poolSize);
    }
  });

  it('degenerate poolSize=0 does not divide by zero (clamped to 1)', () => {
    expect(Number.isFinite(nextSlot(5, 0))).toBe(true);
  });
});

describe('lifePhase', () => {
  it('is 0 at birth and 1 at death', () => {
    expect(lifePhase(0, 1)).toBe(0);
    expect(lifePhase(1, 1)).toBe(1);
  });

  it('is linear in between', () => {
    expect(lifePhase(0.25, 1)).toBeCloseTo(0.25);
    expect(lifePhase(0.5, 2)).toBeCloseTo(0.25);
  });

  it('clamps outside [0, lifetime] instead of going negative or >1', () => {
    expect(lifePhase(-5, 1)).toBe(0);
    expect(lifePhase(10, 1)).toBe(1);
  });

  it('degenerate lifetime<=0 returns 1 (already dead) rather than NaN/Infinity', () => {
    expect(lifePhase(0.5, 0)).toBe(1);
    expect(lifePhase(0.5, -1)).toBe(1);
  });
});

describe('isAlive', () => {
  it('is false before spawn (negative age)', () => {
    expect(isAlive(-0.001, 1)).toBe(false);
  });
  it('is true across the lifetime span, inclusive of both ends', () => {
    expect(isAlive(0, 1)).toBe(true);
    expect(isAlive(0.5, 1)).toBe(true);
    expect(isAlive(1, 1)).toBe(true);
  });
  it('is false once age exceeds lifetime', () => {
    expect(isAlive(1.001, 1)).toBe(false);
  });
});
