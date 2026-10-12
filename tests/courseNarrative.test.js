import { describe, expect, it } from 'vitest';
import { courseStageForProgress } from '../src/lib/courseNarrative.js';

describe('course narrative progression', () => {
  it('maps reading progress to five monotonic stages', () => {
    expect([0, .2, .5, .7, 1].map(courseStageForProgress)).toEqual([0, 1, 2, 3, 4]);
    expect(courseStageForProgress(-1)).toBe(0);
    expect(courseStageForProgress(9)).toBe(4);
  });
});
