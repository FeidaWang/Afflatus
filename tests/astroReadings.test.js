import { describe, it, expect } from 'vitest';
import { personalityTags, dimensionScores } from '../src/lib/astroReadings.js';

const JARGON = /四分相|宫头|三角|四大元素|triplicity|house cusp|square aspect/i;

describe('personalityTags — L1', () => {
  it('returns 3-5 bilingual tags for every sun/moon combo (144 combos), never empty, never jargon', () => {
    for (let sun = 0; sun < 12; sun++) {
      for (let moon = 0; moon < 12; moon++) {
        const tags = personalityTags({ sunSign: sun, moonSign: moon, elements: [2, 1, 3, 1, 1] });
        expect(tags.length).toBeGreaterThanOrEqual(3);
        expect(tags.length).toBeLessThanOrEqual(5);
        for (const t of tags) {
          expect(t.zh.length).toBeGreaterThan(0);
          expect(t.en.length).toBeGreaterThan(0);
          expect(JARGON.test(t.zh)).toBe(false);
          expect(JARGON.test(t.en)).toBe(false);
        }
      }
    }
  });
  it('adds a rising-sign tag only when ascSign is provided', () => {
    const without = personalityTags({ sunSign: 0, moonSign: 1 });
    const withAsc = personalityTags({ sunSign: 0, moonSign: 1, ascSign: 4 });
    expect(without.some((t) => t.key === 'first-impression')).toBe(false);
    expect(withAsc.some((t) => t.key === 'first-impression')).toBe(true);
  });
  it('is deterministic — same input, same output', () => {
    const a = personalityTags({ sunSign: 4, moonSign: 7, ascSign: 2, elements: [1, 4, 1, 1, 1] });
    const b = personalityTags({ sunSign: 4, moonSign: 7, ascSign: 2, elements: [1, 4, 1, 1, 1] });
    expect(a).toEqual(b);
  });
  it('flags the "unified" tag exactly when sun and moon share a triplicity', () => {
    // Aries(0, fire) + Leo(4, fire) -> same triplicity
    const same = personalityTags({ sunSign: 0, moonSign: 4 });
    expect(same.some((t) => t.key === 'unified')).toBe(true);
    // Aries(0, fire) + Taurus(1, earth) -> different
    const diff = personalityTags({ sunSign: 0, moonSign: 1 });
    expect(diff.some((t) => t.key === 'unified')).toBe(false);
  });
});

describe('dimensionScores — L2', () => {
  it('returns exactly the 5 dimensions in roadmap order (love, career, communication, energy, growth)', () => {
    const dims = dimensionScores({ sunSign: 0, moonSign: 1 });
    expect(dims.map((d) => d.key)).toEqual(['love', 'career', 'communication', 'energy', 'growth']);
  });
  it('every value is clamped into [5,96] and every blurb is <=80 characters (roadmap L2 length rule)', () => {
    for (let sun = 0; sun < 12; sun++) {
      for (let moon = 0; moon < 12; moon++) {
        const dims = dimensionScores({ sunSign: sun, moonSign: moon, ascSign: (sun + 6) % 12, elements: [0, 8, 0, 0, 0] });
        for (const d of dims) {
          expect(d.value).toBeGreaterThanOrEqual(5);
          expect(d.value).toBeLessThanOrEqual(96);
          expect(d.text.zh.length).toBeLessThanOrEqual(80);
          expect(JARGON.test(d.text.zh)).toBe(false);
        }
      }
    }
  });
  it('a fire sun (Aries) measurably boosts energy vs an earth sun (Taurus), all else equal', () => {
    const fire = dimensionScores({ sunSign: 0, moonSign: 0 }); // Aries/Aries, pure fire
    const earth = dimensionScores({ sunSign: 1, moonSign: 1 }); // Taurus/Taurus, pure earth
    const val = (dims, k) => dims.find((d) => d.key === k).value;
    expect(val(fire, 'energy')).toBeGreaterThan(val(earth, 'energy'));
    expect(val(earth, 'career')).toBeGreaterThan(val(fire, 'career'));
  });
  it('bazi element tally shifts the matching dimension (heavy Fire tally -> higher energy)', () => {
    const base = dimensionScores({ sunSign: 6, moonSign: 6, elements: [1.6, 1.6, 1.6, 1.6, 1.6] }); // Libra/Libra, even elements
    const fireHeavy = dimensionScores({ sunSign: 6, moonSign: 6, elements: [0, 8, 0, 0, 0] });
    const val = (dims, k) => dims.find((d) => d.key === k).value;
    expect(val(fireHeavy, 'energy')).toBeGreaterThan(val(base, 'energy'));
  });
  it('is deterministic', () => {
    const a = dimensionScores({ sunSign: 3, moonSign: 9, ascSign: 5, elements: [1, 2, 3, 1, 1] });
    const b = dimensionScores({ sunSign: 3, moonSign: 9, ascSign: 5, elements: [1, 2, 3, 1, 1] });
    expect(a).toEqual(b);
  });
});
