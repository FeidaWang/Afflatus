import { describe, it, expect } from 'vitest';
import { relationshipScores, synastryZiwei } from '../src/lib/synastryModes.js';
import { computeZiwei } from '../src/lib/ziwei.js';

const baziSyn = {
  base: 70,
  pillars: [
    { id: 'romance', score: 80 }, { id: 'marriage', score: 60 },
    { id: 'career', score: 75 }, { id: 'wealth', score: 55 }, { id: 'health', score: 65 },
  ],
};

describe('relationshipScores — five lenses over one chart pair', () => {
  it('returns exactly the five relationship types, each bounded with a line', () => {
    const out = relationshipScores(baziSyn, []);
    expect(out.map((o) => o.key)).toEqual(['friend', 'colleague', 'crush', 'couple', 'spouse']);
    for (const o of out) {
      expect(o.score).toBeGreaterThanOrEqual(0);
      expect(o.score).toBeLessThanOrEqual(100);
      expect(o.line.zh.length).toBeGreaterThan(0);
      expect(o.line.en.length).toBeGreaterThan(0);
    }
  });
  it('venus-mars chemistry lifts the crush lens more than the colleague lens', () => {
    const sparkAspects = [
      { bodyThem: 'Venus', bodyMe: 'Mars', key: 'conj', tone: 'strong' },
      { bodyThem: 'Venus', bodyMe: 'Venus', key: 'trine', tone: 'soft' },
    ];
    const withSpark = relationshipScores(baziSyn, sparkAspects);
    const without = relationshipScores(baziSyn, []);
    const d = (arr, k) => arr.find((o) => o.key === k).score;
    expect(d(withSpark, 'crush') - d(without, 'crush')).toBeGreaterThan(d(withSpark, 'colleague') - d(without, 'colleague'));
  });
  it('mercury squares drag the colleague lens down', () => {
    const gridlock = [
      { bodyThem: 'Mercury', bodyMe: 'Mercury', key: 'square', tone: 'hard' },
      { bodyThem: 'Mars', bodyMe: 'Mercury', key: 'opp', tone: 'hard' },
    ];
    const a = relationshipScores(baziSyn, gridlock).find((o) => o.key === 'colleague').score;
    const b = relationshipScores(baziSyn, []).find((o) => o.key === 'colleague').score;
    expect(a).toBeLessThan(b);
  });
  it('missing pillars fall back to 50 without throwing', () => {
    const out = relationshipScores({ base: 60, pillars: [] }, []);
    expect(out.length).toBe(5);
  });
  it('is deterministic', () => {
    expect(relationshipScores(baziSyn, [])).toEqual(relationshipScores(baziSyn, []));
  });
});

describe('synastryZiwei — life-palace comparison', () => {
  const zA = computeZiwei({ y: 1990, m: 6, d: 15, hour: 9 });
  const zB = computeZiwei({ y: 1992, m: 3, d: 8, hour: 15 });
  it('produces a bounded score, branch labels and both temperament/relation lines', () => {
    const s = synastryZiwei(zA, zB);
    expect(s.score).toBeGreaterThanOrEqual(0);
    expect(s.score).toBeLessThanOrEqual(100);
    expect(s.mingA.branch.length).toBe(1);
    expect(s.mingB.branch.length).toBe(1);
    expect(s.relation.zh).toContain('命宫');
    expect(s.temperament.zh.length).toBeGreaterThan(0);
  });
  it('same life palace reads as 同宫', () => {
    const s = synastryZiwei(zA, zA);
    expect(s.relKey).toBe('same');
    expect(s.score).toBe(72);
  });
  it('harmony relations outscore clash relations across a birth sample', () => {
    // sweep some pairs; whenever relKey differs, the defined ordering holds
    const order = { liuhe: 6, sanhe: 5, banhe: 4, same: 3, none: 2, hai: 1, xing: 1, chong: 0 };
    const zs = [];
    for (let m = 1; m <= 12; m += 2) zs.push(computeZiwei({ y: 1995, m, d: 10, hour: 9 }));
    for (let i = 0; i < zs.length; i++) for (let j = i + 1; j < zs.length; j++) {
      const s = synastryZiwei(zs[i], zs[j]);
      const t = synastryZiwei(zs[j], zs[i]);
      expect(s.score).toBe(t.score); // symmetric
      if (order[s.relKey] > order['none']) expect(s.score).toBeGreaterThan(60);
      if (order[s.relKey] < order['none']) expect(s.score).toBeLessThan(60);
    }
  });
  it('empty life palace does not throw (borrows the quiet temperament)', () => {
    // find a chart with an empty life palace by sweeping; if none found in
    // the sample, the group function's empty-array branch is still covered
    // by direct construction:
    const fake = { ming: 0, palaces: Array.from({ length: 12 }, () => ({ stars: [] })) };
    const s = synastryZiwei(fake, zA);
    expect(s.score).toBeGreaterThanOrEqual(0);
  });
});
