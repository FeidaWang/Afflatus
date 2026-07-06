import { describe, it, expect } from 'vitest';
import { PERSONA_QUESTIONS, scorePersona, PERSONA_TYPES, AXIS_LETTERS } from '../src/lib/persona.js';

describe('question bank shape', () => {
  it('24 questions, exactly 6 per axis, all bilingual', () => {
    expect(PERSONA_QUESTIONS.length).toBe(24);
    for (let axis = 0; axis < 4; axis++) {
      expect(PERSONA_QUESTIONS.filter((q) => q.axis === axis).length).toBe(6);
    }
    for (const q of PERSONA_QUESTIONS) {
      expect(q.q[0] && q.q[1] && q.a[0] && q.a[1] && q.b[0] && q.b[1]).toBeTruthy();
    }
  });
  it('all 16 types have zh/en names and descriptions', () => {
    const types = [];
    for (const [e, i] of [AXIS_LETTERS[0]]) for (const [s, n] of [AXIS_LETTERS[1]])
      for (const [t, f] of [AXIS_LETTERS[2]]) for (const [j, p] of [AXIS_LETTERS[3]])
        for (const w of [e, i]) for (const x of [s, n]) for (const y of [t, f]) for (const z of [j, p])
          types.push(w + x + y + z);
    expect(new Set(types).size).toBe(16);
    for (const t of new Set(types)) {
      expect(PERSONA_TYPES[t], t).toBeTruthy();
      expect(PERSONA_TYPES[t].dZh.length).toBeGreaterThan(10);
      expect(PERSONA_TYPES[t].dEn.length).toBeGreaterThan(10);
    }
  });
});

describe('scorePersona', () => {
  it('all-a → ESTJ, all-b → INFP', () => {
    expect(scorePersona(new Array(24).fill('a')).type).toBe('ESTJ');
    expect(scorePersona(new Array(24).fill('b')).type).toBe('INFP');
  });
  it('ties (3-3) break toward the second pole (I/N/F/P)', () => {
    const answers = PERSONA_QUESTIONS.map((q, i) => {
      // first 3 of each axis 'a', rest 'b' → 3-3 on every axis
      const nthOfAxis = PERSONA_QUESTIONS.slice(0, i).filter((x) => x.axis === q.axis).length;
      return nthOfAxis < 3 ? 'a' : 'b';
    });
    expect(scorePersona(answers).type).toBe('INFP');
  });
  it('axes report counts that sum to 6', () => {
    const r = scorePersona(new Array(24).fill('a'));
    for (const ax of r.axes) expect(ax.a + ax.b).toBe(6);
  });
  it('wrong-length input → null', () => {
    expect(scorePersona(['a', 'b'])).toBeNull();
    expect(scorePersona(null)).toBeNull();
  });
  it('deterministic', () => {
    const ans = new Array(24).fill('a').map((v, i) => (i % 3 === 0 ? 'b' : 'a'));
    expect(scorePersona(ans)).toEqual(scorePersona(ans));
  });
});
