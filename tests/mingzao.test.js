import { describe, it, expect } from 'vitest';
import { computeBazi } from '../src/lib/bazi.js';
import { mingzaoRank, percentileOf, elementTally, flowChainLength } from '../src/lib/mingzao.js';
import { MINGZAO_DIST, MINGZAO_DIST_TOTAL } from '../src/lib/mingzaoDist.js';

const pillarsOf = (b) => { const c = computeBazi(b); return [c.year, c.month, c.day, c.hour].filter(Boolean); };

describe('mingzaoRank — composite structure', () => {
  it('returns all four axes + core/total in [0,100]', () => {
    const r = mingzaoRank(pillarsOf({ y: 1990, m: 6, d: 15, hour: 9 }));
    for (const k of ['zhonghe', 'geju', 'yongshen']) {
      expect(r[k].value).toBeGreaterThanOrEqual(0);
      expect(r[k].value).toBeLessThanOrEqual(100);
    }
    expect(r.suiyun).toBeNull(); // no dayun pillar passed
    expect(r.core).toBeGreaterThanOrEqual(0);
    expect(r.core).toBeLessThanOrEqual(100);
    expect(r.total).toBe(r.core); // no suiyun -> total == core
  });
  it('core is the documented 40/30/30 weighting', () => {
    const r = mingzaoRank(pillarsOf({ y: 1985, m: 3, d: 3, hour: 15 }));
    const expected = Math.round(0.4 * r.zhonghe.value + 0.3 * r.geju.value + 0.3 * r.yongshen.value);
    expect(Math.abs(r.core - expected)).toBeLessThanOrEqual(1);
  });
  it('a favorable current luck pillar raises total; an unfavorable one lowers it', () => {
    const pillars = pillarsOf({ y: 1990, m: 6, d: 15, hour: 9 });
    const base = mingzaoRank(pillars);
    // find one favorable-element and one unfavorable-element stem/branch combo
    const fav = base.yongshen.favorable[0].el;
    const STEM_OF_EL = [0, 2, 4, 6, 8]; // 甲(wood) 丙(fire) 戊(earth) 庚(metal) 壬(water)
    const BRANCH_OF_EL = [2, 5, 4, 8, 11]; // 寅 巳 辰 申 亥 (primary qi of that element)
    const favPillar = { stem: STEM_OF_EL[fav], branch: BRANCH_OF_EL[fav] };
    const withFav = mingzaoRank(pillars, favPillar);
    expect(withFav.suiyun.value).toBeGreaterThan(50);
    expect(withFav.total).toBeGreaterThanOrEqual(Math.min(base.core, withFav.total));
  });
  it('is deterministic', () => {
    const a = mingzaoRank(pillarsOf({ y: 2000, m: 12, d: 31, hour: 23 }));
    const b = mingzaoRank(pillarsOf({ y: 2000, m: 12, d: 31, hour: 23 }));
    expect(a).toEqual(b);
  });
  it('works without an hour pillar (3-pillar chart)', () => {
    const r = mingzaoRank(pillarsOf({ y: 1975, m: 8, d: 20, hour: null }));
    expect(r.core).toBeGreaterThanOrEqual(0);
    expect(r.core).toBeLessThanOrEqual(100);
  });
});

describe('element tally + flow chain', () => {
  it('tally covers stems and weighted hidden stems', () => {
    const t = elementTally(pillarsOf({ y: 1990, m: 6, d: 15, hour: 9 }));
    expect(t.length).toBe(5);
    expect(t.reduce((a, b) => a + b, 0)).toBeGreaterThan(4); // 4 stems + hidden weights
  });
  it('flowChainLength: full presence = 5, single element = 1, none = 0', () => {
    expect(flowChainLength([1, 1, 1, 1, 1])).toBe(5);
    expect(flowChainLength([2, 0, 0, 0, 0])).toBe(1);
    expect(flowChainLength([0, 0, 0, 0, 0])).toBe(0);
    // wood+fire adjacent (generation link) = 2
    expect(flowChainLength([1, 1, 0, 0, 0])).toBe(2);
  });
});

describe('percentile against the generated distribution', () => {
  it('distribution sums to its declared total and covers a sane range', () => {
    expect(MINGZAO_DIST.reduce((a, b) => a + b, 0)).toBe(MINGZAO_DIST_TOTAL);
    expect(MINGZAO_DIST.length).toBe(101);
  });
  it('percentile is monotonic and bounded', () => {
    const p30 = percentileOf(30, MINGZAO_DIST);
    const p60 = percentileOf(60, MINGZAO_DIST);
    const p90 = percentileOf(90, MINGZAO_DIST);
    expect(p30).toBeLessThan(p60);
    expect(p60).toBeLessThan(p90);
    expect(percentileOf(0, MINGZAO_DIST)).toBeGreaterThanOrEqual(0);
    expect(percentileOf(100, MINGZAO_DIST)).toBeLessThanOrEqual(100);
  });
  it('a real chart lands somewhere strictly inside the distribution', () => {
    const r = mingzaoRank(pillarsOf({ y: 1993, m: 4, d: 18, hour: 7 }));
    const p = percentileOf(r.core, MINGZAO_DIST);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(100);
  });
});
