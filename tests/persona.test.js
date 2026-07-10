import { describe, it, expect } from 'vitest';
import { PERSONA_QUESTIONS, scorePersona, PERSONA_TYPES, PERSONA_MATCH, AXIS_LETTERS } from '../src/lib/persona.js';

describe('question bank shape', () => {
  it('32 questions, exactly 8 per axis, all bilingual', () => {
    expect(PERSONA_QUESTIONS.length).toBe(32);
    for (let axis = 0; axis < 4; axis++) {
      expect(PERSONA_QUESTIONS.filter((q) => q.axis === axis).length).toBe(8);
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
  it('all 16 types have a match/friction entry pointing at real types', () => {
    for (const t of Object.keys(PERSONA_TYPES)) {
      const m = PERSONA_MATCH[t];
      expect(m, t).toBeTruthy();
      expect(m.match.length).toBe(2);
      for (const x of [...m.match, m.friction]) expect(PERSONA_TYPES[x], `${t} -> ${x}`).toBeTruthy();
    }
  });
});

describe('scorePersona', () => {
  it('all-a → ESTJ, all-b → INFP', () => {
    expect(scorePersona(new Array(32).fill('a')).type).toBe('ESTJ');
    expect(scorePersona(new Array(32).fill('b')).type).toBe('INFP');
  });
  it('ties (4-4) break toward the second pole (I/N/F/P)', () => {
    const answers = PERSONA_QUESTIONS.map((q, i) => {
      // first 4 of each axis 'a', rest 'b' → 4-4 on every axis
      const nthOfAxis = PERSONA_QUESTIONS.slice(0, i).filter((x) => x.axis === q.axis).length;
      return nthOfAxis < 4 ? 'a' : 'b';
    });
    expect(scorePersona(answers).type).toBe('INFP');
  });
  it('axes report counts that sum to 8', () => {
    const r = scorePersona(new Array(32).fill('a'));
    for (const ax of r.axes) expect(ax.a + ax.b).toBe(8);
  });
  it('wrong-length input → null', () => {
    expect(scorePersona(['a', 'b'])).toBeNull();
    expect(scorePersona(null)).toBeNull();
  });
  it('deterministic', () => {
    const ans = new Array(32).fill('a').map((v, i) => (i % 3 === 0 ? 'b' : 'a'));
    expect(scorePersona(ans)).toEqual(scorePersona(ans));
  });
});
