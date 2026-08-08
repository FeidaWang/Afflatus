import { describe, expect, it } from 'vitest';
import {
  AXIS_LETTERS,
  FACET_META,
  PERSONA_QUESTIONS,
  PERSONA_TYPES,
  RESPONSE_OPTIONS,
  scorePersona,
} from '../src/lib/quizPersona.js';

describe('sixteen-type preference explorer', () => {
  function answersForAxisTotals(targets) {
    const answers = new Array(PERSONA_QUESTIONS.length).fill(3);
    targets.forEach((target, axis) => {
      let remaining = target;
      PERSONA_QUESTIONS.forEach((item, index) => {
        if (item.axis !== axis || remaining === 0) return;
        const contribution = Math.sign(remaining) * Math.min(2, Math.abs(remaining));
        answers[index] = 3 + contribution * item.dir;
        remaining -= contribution;
      });
      expect(remaining).toBe(0);
    });
    return answers;
  }

  it('uses 48 bilingual, balanced and reverse-keyed statements', () => {
    expect(PERSONA_QUESTIONS).toHaveLength(48);
    expect(RESPONSE_OPTIONS.map((option) => option.value)).toEqual([1, 2, 3, 4, 5]);

    for (let axis = 0; axis < 4; axis += 1) {
      const items = PERSONA_QUESTIONS.filter((item) => item.axis === axis);
      expect(items).toHaveLength(12);
      expect(items.filter((item) => item.dir === 1)).toHaveLength(6);
      expect(items.filter((item) => item.dir === -1)).toHaveLength(6);
    }

    for (const [facet] of Object.entries(FACET_META)) {
      const items = PERSONA_QUESTIONS.filter((item) => item.facet === facet);
      expect(items).toHaveLength(4);
      expect(items.filter((item) => item.dir === 1)).toHaveLength(2);
      expect(items.filter((item) => item.dir === -1)).toHaveLength(2);
    }

    for (const item of PERSONA_QUESTIONS) {
      expect(item.q[0].length).toBeGreaterThan(12);
      expect(item.q[1].length).toBeGreaterThan(8);
    }
  });

  it('scores strong first-pole and second-pole response patterns', () => {
    const firstPole = PERSONA_QUESTIONS.map((item) => (item.dir === 1 ? 5 : 1));
    const secondPole = PERSONA_QUESTIONS.map((item) => (item.dir === 1 ? 1 : 5));

    const first = scorePersona(firstPole);
    const second = scorePersona(secondPole);
    expect(first.type).toBe('ESTJ');
    expect(second.type).toBe('INFP');
    expect(first.axes.every((axis) => axis.pctA === 100 && axis.band === 'pronounced')).toBe(true);
    expect(second.axes.every((axis) => axis.pctB === 100 && axis.band === 'pronounced')).toBe(true);
  });

  it('keeps neutral answers visible as context-balanced instead of inventing certainty', () => {
    const result = scorePersona(new Array(PERSONA_QUESTIONS.length).fill(3));
    expect(result.type).toBe('XXXX');
    expect(result.axes.every((axis) => axis.pctA === 50 && axis.pctB === 50)).toBe(true);
    expect(result.axes.every((axis) => axis.balanced && axis.band === 'balanced')).toBe(true);
    expect(result.facets.every((facet) => facet.leaning === 'balanced')).toBe(true);
  });

  it('keeps band thresholds stable immediately before and at each boundary', () => {
    const before = scorePersona(answersForAxisTotals([2, 6, 13, -2]));
    const at = scorePersona(answersForAxisTotals([3, 7, 14, -3]));

    expect(before.axes.map((axis) => axis.band)).toEqual(['balanced', 'slight', 'clear', 'balanced']);
    expect(at.axes.map((axis) => axis.band)).toEqual(['slight', 'clear', 'pronounced', 'slight']);
    expect(at.axes.map((axis) => axis.letter)).toEqual(['E', 'S', 'T', 'P']);
  });

  it('supports a single tied axis without erasing the other three preferences', () => {
    const result = scorePersona(answersForAxisTotals([0, -3, 7, 14]));

    expect(result.type).toBe('XNTJ');
    expect(result.axes[0]).toMatchObject({ letter: 'X', balanced: true, pctA: 50, pctB: 50 });
    expect(result.axes.slice(1).map((axis) => axis.letter)).toEqual(['N', 'T', 'J']);
  });

  it('scores mixed direct and reverse-keyed responses by contribution rather than raw button value', () => {
    const result = scorePersona(answersForAxisTotals([5, -5, 9, -9]));

    expect(result.type).toBe('ENTP');
    expect(result.axes.map((axis) => axis.clarity)).toEqual([20, 20, 38, 38]);
  });

  it('returns a complete best-fit profile without persisting raw answers', () => {
    const answers = PERSONA_QUESTIONS.map((item, index) => {
      const base = index % 5 + 1;
      return Math.max(1, Math.min(5, base));
    });
    const result = scorePersona(answers);
    expect(PERSONA_TYPES[result.type]).toBeTruthy();
    expect(result.axes).toHaveLength(AXIS_LETTERS.length);
    expect(result.facets).toHaveLength(Object.keys(FACET_META).length);
    expect(result.answered).toBe(48);
    expect(result).not.toHaveProperty('answers');
  });

  it('rejects incomplete or out-of-range responses', () => {
    expect(scorePersona(null)).toBeNull();
    expect(scorePersona([1, 2, 3])).toBeNull();
    expect(scorePersona(new Array(48).fill(0))).toBeNull();
    expect(scorePersona(new Array(48).fill(6))).toBeNull();
    expect(scorePersona(new Array(48).fill(3.5))).toBeNull();
  });

  it('has bilingual profiles for all 16 possible codes', () => {
    const types = [];
    for (const e of AXIS_LETTERS[0]) for (const s of AXIS_LETTERS[1])
      for (const t of AXIS_LETTERS[2]) for (const j of AXIS_LETTERS[3]) types.push(e + s + t + j);

    expect(new Set(types).size).toBe(16);
    for (const type of types) {
      expect(PERSONA_TYPES[type]?.en.length).toBeGreaterThan(4);
      expect(PERSONA_TYPES[type]?.zh.length).toBeGreaterThan(3);
      expect(PERSONA_TYPES[type]?.dEn.length).toBeGreaterThan(40);
      expect(PERSONA_TYPES[type]?.dZh.length).toBeGreaterThan(20);
    }
  });
});
