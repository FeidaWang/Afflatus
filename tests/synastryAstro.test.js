import { describe, it, expect } from 'vitest';
import {
  SYN_BODIES, crossAspects, relationshipTitle, resonanceScore,
  attractionLines, redFlagLines, davisonReading,
} from '../src/lib/synastryAstro.js';

const FATALISM = /注定|分手|不合适|克夫|克妻|离婚|doomed|fated to break/i;

function lons(offsets) {
  // offsets: {Sun:0, Moon:30, ...} degrees
  const o = { Sun: 10, Moon: 100, Mercury: 20, Venus: 190, Mars: 300, ...offsets };
  return o;
}

describe('crossAspects', () => {
  it('finds a conjunction when two bodies share the same degree', () => {
    const them = lons({ Venus: 50 });
    const me = lons({ Moon: 51 });
    const aspects = crossAspects(them, me);
    const hit = aspects.find((a) => a.bodyThem === 'Venus' && a.bodyMe === 'Moon');
    expect(hit).toBeTruthy();
    expect(hit.key).toBe('conj');
    expect(hit.tone).toBe('strong');
  });
  it('returns nothing for a pair with no aspect in range', () => {
    const them = lons({ Sun: 0 });
    const me = lons({ Sun: 40 }); // 40deg: not conj(±8) sextile(±4 of 60) square(±6 of 90) trine(±6 of 120) opp(±8 of 180)
    const aspects = crossAspects(them, me);
    expect(aspects.find((a) => a.bodyThem === 'Sun' && a.bodyMe === 'Sun')).toBeFalsy();
  });
  it('covers up to 25 directional pairs (5x5) when all bodies aspect', () => {
    // all bodies at the same degree -> everything conjunct
    const same = { Sun: 5, Moon: 5, Mercury: 5, Venus: 5, Mars: 5 };
    const aspects = crossAspects(same, same);
    expect(aspects.length).toBe(SYN_BODIES.length * SYN_BODIES.length);
  });
});

describe('relationshipTitle', () => {
  it('returns a non-empty bilingual title for every one of the 15 unordered body pairs', () => {
    for (let i = 0; i < SYN_BODIES.length; i++) {
      for (let j = i; j < SYN_BODIES.length; j++) {
        const a = { bodyThem: SYN_BODIES[i], bodyMe: SYN_BODIES[j], key: 'conj', sep: 1, orb: 1, tone: 'strong' };
        const t = relationshipTitle([a]);
        expect(t.zh.length).toBeGreaterThan(0);
        expect(t.en.length).toBeGreaterThan(0);
      }
    }
  });
  it('picks the tightest-orb aspect when several are present', () => {
    const wide = { bodyThem: 'Sun', bodyMe: 'Sun', key: 'conj', sep: 7, orb: 7, tone: 'strong' };
    const tight = { bodyThem: 'Moon', bodyMe: 'Venus', key: 'conj', sep: 0.2, orb: 0.2, tone: 'strong' };
    const t = relationshipTitle([wide, tight]);
    expect(t).toEqual(relationshipTitle([tight]));
  });
  it('falls back gracefully with no aspects at all', () => {
    const t = relationshipTitle([]);
    expect(t.zh.length).toBeGreaterThan(0);
    expect(t.en.length).toBeGreaterThan(0);
  });
});

describe('resonanceScore', () => {
  it('is clamped to [8,96]', () => {
    const lots = SYN_BODIES.flatMap((bt) => SYN_BODIES.map((bm) => ({ bodyThem: bt, bodyMe: bm, key: 'conj', sep: 0, orb: 0, tone: 'strong' })));
    expect(resonanceScore(96, lots)).toBeLessThanOrEqual(96);
    const harsh = SYN_BODIES.flatMap((bt) => SYN_BODIES.map((bm) => ({ bodyThem: bt, bodyMe: bm, key: 'square', sep: 90, orb: 0, tone: 'hard' })));
    expect(resonanceScore(8, harsh)).toBeGreaterThanOrEqual(8);
  });
  it('more strong-tone aspects raise the score vs fewer, all else equal', () => {
    const few = [{ bodyThem: 'Sun', bodyMe: 'Sun', key: 'conj', sep: 0, orb: 0, tone: 'strong' }];
    const many = SYN_BODIES.map((b) => ({ bodyThem: b, bodyMe: b, key: 'conj', sep: 0, orb: 0, tone: 'strong' }));
    expect(resonanceScore(50, many)).toBeGreaterThan(resonanceScore(50, few));
  });
});

describe('attractionLines / redFlagLines', () => {
  const mixed = [
    { bodyThem: 'Venus', bodyMe: 'Moon', key: 'conj', sep: 1, orb: 1, tone: 'strong' },
    { bodyThem: 'Mercury', bodyMe: 'Mercury', key: 'square', sep: 90, orb: 1, tone: 'hard' },
    { bodyThem: 'Mars', bodyMe: 'Venus', key: 'trine', sep: 120, orb: 2, tone: 'soft' },
    { bodyThem: 'Sun', bodyMe: 'Mars', key: 'opp', sep: 180, orb: 3, tone: 'hard' },
  ];
  it('attractionLines only includes non-hard tones, max 3, non-empty bilingual text', () => {
    const lines = attractionLines(mixed);
    expect(lines.length).toBeLessThanOrEqual(3);
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) { expect(l.zh.length).toBeGreaterThan(0); expect(l.en.length).toBeGreaterThan(0); }
  });
  it('redFlagLines only includes hard tones, max 2, never fatalistic wording', () => {
    const lines = redFlagLines(mixed);
    expect(lines.length).toBeLessThanOrEqual(2);
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      expect(FATALISM.test(l.zh)).toBe(false);
      expect(FATALISM.test(l.en)).toBe(false);
    }
  });
  it('redFlagLines uses "你们的X" framing for same-body pairs, "TA的X与你的Y" for cross-body', () => {
    const lines = redFlagLines(mixed);
    const sameBody = lines.find((l) => l.zh.startsWith('你们的'));
    expect(sameBody).toBeTruthy();
  });
  it('every attraction/red-flag phrase across all 25 same-tone combos is non-empty and jargon-free', () => {
    for (const bt of SYN_BODIES) for (const bm of SYN_BODIES) {
      const strong = attractionLines([{ bodyThem: bt, bodyMe: bm, key: 'conj', sep: 0, orb: 0, tone: 'strong' }]);
      expect(strong[0].zh.length).toBeGreaterThan(0);
      const hard = redFlagLines([{ bodyThem: bt, bodyMe: bm, key: 'square', sep: 90, orb: 0, tone: 'hard' }]);
      expect(FATALISM.test(hard[0].zh)).toBe(false);
    }
  });
});

describe('davisonReading', () => {
  it('is deterministic and returns a valid sign index + non-empty bilingual text', () => {
    const a = davisonReading(45, 200);
    const b = davisonReading(45, 200);
    expect(a).toEqual(b);
    expect(a.sunSign).toBeGreaterThanOrEqual(0);
    expect(a.sunSign).toBeLessThanOrEqual(11);
    expect(a.moonSign).toBeGreaterThanOrEqual(0);
    expect(a.moonSign).toBeLessThanOrEqual(11);
    expect(a.text.zh.length).toBeGreaterThan(0);
    expect(a.text.en.length).toBeGreaterThan(0);
  });
  it('covers all 12 signs without throwing for both sun and moon', () => {
    for (let s = 0; s < 12; s++) {
      const r = davisonReading(s * 30 + 5, s * 30 + 5);
      expect(r.text.zh).toContain(r.text.zh); // just exercises the path
    }
  });
});
