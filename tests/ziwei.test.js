import { describe, it, expect } from 'vitest';
import { computeZiwei, ziweiBranch, ZW_STARS_ZH, ZW_PALACES_ZH, ZW_STAR_READS, JU_ZH } from '../src/lib/ziwei.js';
import { BRANCHES, STEMS } from '../src/lib/bazi.js';

// Anchor chart cross-checked against iztro (an independent 紫微 library):
// 1992-02-23, 午时 (hour 12), male → 命宫戊申, 土五局, 紫微在巳, 天府在亥,
// 太阳+巨门在寅, 天机+天梁在辰, 武曲+贪狼在丑, 天同+太阴在子, 廉贞+破军在酉,
// 天相在卯, 七杀同紫微在巳. The full implementation matched iztro over 400
// random charts (RELEASE_NOTES V21 Phase 6); these frozen anchors pin it.
const chart = computeZiwei({ y: 1992, m: 2, d: 23, hour: 12 });

describe('computeZiwei — anchor chart vs independent library', () => {
  it('命宫戊申, 土五局', () => {
    expect(BRANCHES[chart.ming]).toBe('申');
    expect(STEMS[chart.mingStem]).toBe('戊');
    expect(JU_ZH[chart.ju]).toBe('土五局');
  });
  it('all 14 major-star branches', () => {
    const expected = { 紫微: '巳', 天机: '辰', 太阳: '寅', 武曲: '丑', 天同: '子', 廉贞: '酉', 天府: '亥', 太阴: '子', 贪狼: '丑', 巨门: '寅', 天相: '卯', 天梁: '辰', 七杀: '巳', 破军: '酉' };
    ZW_STARS_ZH.forEach((name, i) => {
      expect(BRANCHES[chart.starBranch[i]], name).toBe(expected[name]);
    });
  });
  it('palace names run backward from 命宫 (父母 in 酉, 兄弟 in 未)', () => {
    expect(chart.palaces[9].name).toBe('父母'); // 酉
    expect(chart.palaces[7].name).toBe('兄弟'); // 未
    expect(chart.palaces[8].name).toBe('命宫'); // 申
  });
  it('every branch hosts exactly one palace; all 12 names used once', () => {
    const names = chart.palaces.map((p) => p.name).sort();
    expect(names).toEqual([...ZW_PALACES_ZH].sort());
  });
  it('every star lands in exactly one palace', () => {
    const placed = chart.palaces.flatMap((p) => p.stars);
    expect(placed.length).toBe(14);
    expect(new Set(placed).size).toBe(14);
  });
});

describe('ziweiBranch (局数 × 日 rule)', () => {
  it('土五局 day 20: q=4, r=0 (even) → 4th from 寅 = 巳', () => {
    expect(BRANCHES[ziweiBranch(5, 20)]).toBe('巳');
  });
  it('odd remainder steps back: 水二局 day 1: q=1, r=1 → 1-1=0 → 丑', () => {
    expect(BRANCHES[ziweiBranch(2, 1)]).toBe('丑');
  });
});

describe('guards & content', () => {
  it('missing hour → null (life palace needs the hour branch)', () => {
    expect(computeZiwei({ y: 1992, m: 2, d: 23, hour: null })).toBeNull();
  });
  it('out-of-range date → null', () => {
    expect(computeZiwei({ y: 1899, m: 6, d: 1, hour: 12 })).toBeNull();
  });
  it('all 14 stars have bilingual one-line reads', () => {
    for (const name of ZW_STARS_ZH) {
      expect(ZW_STAR_READS[name].zh.length).toBeGreaterThan(5);
      expect(ZW_STAR_READS[name].en.length).toBeGreaterThan(5);
    }
  });
});
