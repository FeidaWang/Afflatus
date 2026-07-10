import { describe, it, expect } from 'vitest';
import { EQ_QUESTIONS, EQ_DIMENSIONS, scoreEQ } from '../src/lib/eqQuiz.js';

describe('question bank shape', () => {
  it('15 questions, exactly 3 per dimension, 4 bilingual options each', () => {
    expect(EQ_QUESTIONS.length).toBe(15);
    for (let dim = 0; dim < 5; dim++) {
      expect(EQ_QUESTIONS.filter((q) => q.dim === dim).length).toBe(3);
    }
    for (const q of EQ_QUESTIONS) {
      expect(q.q[0] && q.q[1]).toBeTruthy();
      expect(q.opts.length).toBe(4);
      for (const o of q.opts) expect(o[0] && o[1]).toBeTruthy();
    }
  });
  it('5 dimensions, all bilingual', () => {
    expect(EQ_DIMENSIONS.length).toBe(5);
    for (const d of EQ_DIMENSIONS) expect(d.key && d.en && d.zh).toBeTruthy();
  });
});

describe('scoreEQ', () => {
  it('all-max (index 3) → every dimension 100, overall 100', () => {
    const r = scoreEQ(new Array(15).fill(3));
    for (const d of r.dims) expect(d.value).toBe(100);
    expect(r.overall).toBe(100);
  });
  it('all-min (index 0) → every dimension 0, overall 0', () => {
    const r = scoreEQ(new Array(15).fill(0));
    for (const d of r.dims) expect(d.value).toBe(0);
    expect(r.overall).toBe(0);
  });
  it('dims come back in EQ_DIMENSIONS order with matching keys', () => {
    const r = scoreEQ(new Array(15).fill(2));
    expect(r.dims.map((d) => d.key)).toEqual(EQ_DIMENSIONS.map((d) => d.key));
  });
  it('wrong-length input → null', () => {
    expect(scoreEQ([0, 1])).toBeNull();
    expect(scoreEQ(null)).toBeNull();
  });
  it('deterministic', () => {
    const ans = EQ_QUESTIONS.map((q, i) => i % 4);
    expect(scoreEQ(ans)).toEqual(scoreEQ(ans));
  });
});
