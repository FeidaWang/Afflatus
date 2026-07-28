import { describe, expect, it } from 'vitest';
import {
  progressiveBatchEnd,
  progressiveObserverDecision,
} from '../src/lib/progressiveCollection.js';

describe('progressive collection batching', () => {
  it('advances in bounded batches and clamps to the total', () => {
    expect(progressiveBatchEnd(10, 0, 4)).toBe(4);
    expect(progressiveBatchEnd(10, 4, 3)).toBe(7);
    expect(progressiveBatchEnd(10, 7, 99)).toBe(10);
  });

  it('normalizes invalid counts without exceeding the collection', () => {
    expect(progressiveBatchEnd(3, -5, 0)).toBe(1);
    expect(progressiveBatchEnd(0, 8, 4)).toBe(0);
  });

  it('does not double-reveal after a button scroll intersects the sentinel', () => {
    expect(progressiveObserverDecision([{ isIntersecting: true }], true)).toEqual({
      blocked: true,
      reveal: false,
    });
    expect(progressiveObserverDecision([{ isIntersecting: false }], true)).toEqual({
      blocked: false,
      reveal: false,
    });
    expect(progressiveObserverDecision([{ isIntersecting: true }], false)).toEqual({
      blocked: false,
      reveal: true,
    });
  });
});
