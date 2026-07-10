import { describe, it, expect } from 'vitest';
import { LOGIC_QUESTIONS, LOGIC_BANDS, scoreLogic } from '../src/lib/logicQuiz.js';

describe('question bank shape', () => {
  it('16 questions, 4 bilingual options each, correct index in range', () => {
    expect(LOGIC_QUESTIONS.length).toBe(16);
    for (const q of LOGIC_QUESTIONS) {
      expect(q.q[0] && q.q[1]).toBeTruthy();
      expect(q.opts.length).toBe(4);
      for (const o of q.opts) expect(o[0] && o[1]).toBeTruthy();
      expect(q.correct).toBeGreaterThanOrEqual(0);
      expect(q.correct).toBeLessThan(4);
    }
  });
  it('bands are sorted descending by min and cover 0', () => {
    for (let i = 1; i < LOGIC_BANDS.length; i++) expect(LOGIC_BANDS[i].min).toBeLessThan(LOGIC_BANDS[i - 1].min);
    expect(LOGIC_BANDS[LOGIC_BANDS.length - 1].min).toBe(0);
  });
});

describe('scoreLogic', () => {
  it('all correct → 16/16, top band', () => {
    const answers = LOGIC_QUESTIONS.map((q) => q.correct);
    const r = scoreLogic(answers);
    expect(r.correct).toBe(16);
    expect(r.total).toBe(16);
    expect(r.band.key).toBe('blaze');
  });
  it('all wrong → 0/16, bottom band', () => {
    const answers = LOGIC_QUESTIONS.map((q) => (q.correct + 1) % 4);
    const r = scoreLogic(answers);
    expect(r.correct).toBe(0);
    expect(r.band.key).toBe('start');
  });
  it('funScore scales with correct count', () => {
    const zero = scoreLogic(LOGIC_QUESTIONS.map((q) => (q.correct + 1) % 4));
    const all = scoreLogic(LOGIC_QUESTIONS.map((q) => q.correct));
    expect(all.funScore).toBeGreaterThan(zero.funScore);
  });
  it('wrong-length input → null', () => {
    expect(scoreLogic([0, 1])).toBeNull();
    expect(scoreLogic(null)).toBeNull();
  });
  it('deterministic', () => {
    const ans = LOGIC_QUESTIONS.map((q, i) => (i % 2 === 0 ? q.correct : 0));
    expect(scoreLogic(ans)).toEqual(scoreLogic(ans));
  });
});
