import { describe, it, expect } from 'vitest';
import { erf, normalPercentile, iqPercentile, eqPercentile } from '../src/lib/quizNorm.js';
import { LOGIC_QUESTIONS, scoreLogic } from '../src/lib/logicQuiz.js';
import { PERSONA_FREQ } from '../src/lib/persona.js';

describe('normal model (U3 percentiles)', () => {
  it('erf matches known values within the approximation error', () => {
    expect(Math.abs(erf(0))).toBeLessThan(1e-7);
    expect(erf(1)).toBeCloseTo(0.8427, 3);
    expect(erf(-1)).toBeCloseTo(-0.8427, 3);
  });
  it('percentile at the mean is 50, symmetric around it, clamped at the tails', () => {
    expect(normalPercentile(100, 100, 15)).toBeCloseTo(50, 1);
    expect(normalPercentile(115, 100, 15)).toBeCloseTo(84.1, 0);
    expect(normalPercentile(85, 100, 15)).toBeCloseTo(15.9, 0);
    expect(normalPercentile(400, 100, 15)).toBe(99.9);
    expect(normalPercentile(-400, 100, 15)).toBe(0.1);
  });
  it('iq/eq wrappers are monotonic', () => {
    expect(iqPercentile(130)).toBeGreaterThan(iqPercentile(100));
    expect(eqPercentile(90)).toBeGreaterThan(eqPercentile(60));
  });
});

describe('timed logic quiz (U3)', () => {
  it('every question carries a positive per-question time limit', () => {
    for (const q of LOGIC_QUESTIONS) {
      expect(q.t).toBeGreaterThan(0);
      expect(q.t).toBeLessThanOrEqual(60);
    }
  });
  it('null answers (timeouts) count as wrong and are reported', () => {
    const answers = LOGIC_QUESTIONS.map((q) => q.correct);
    answers[0] = null; answers[1] = null;
    const r = scoreLogic(answers);
    expect(r.correct).toBe(LOGIC_QUESTIONS.length - 2);
    expect(r.timeouts).toBe(2);
  });
});

describe('persona type frequencies (U3)', () => {
  it('covers all 16 types and sums to ~100%', () => {
    const vals = Object.values(PERSONA_FREQ);
    expect(vals.length).toBe(16);
    const sum = vals.reduce((a, b) => a + b, 0);
    expect(sum).toBeGreaterThan(97);
    expect(sum).toBeLessThan(103);
  });
});
