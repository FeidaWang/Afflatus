import { describe, it, expect } from 'vitest';
import { computeDayun, dayunDirection, liunianPillar, taisuiRelation, pairRelations, TAISUI_ZH } from '../src/lib/dayun.js';

// Reference birth (same chart verified against a professional app in
// tests/ziping.test.js): 1992-02-23 23:26, 乾造 (male) → 壬申/壬寅/庚午/丙子.
const birth = { y: 1992, m: 2, d: 23, hour: 23 };

describe('dayunDirection (阳男阴女顺排)', () => {
  it('yang year + male → forward; yang year + female → backward', () => {
    expect(dayunDirection(8, 'M')).toBe(1);  // 壬 (yang)
    expect(dayunDirection(8, 'F')).toBe(-1);
  });
  it('yin year flips both', () => {
    expect(dayunDirection(9, 'M')).toBe(-1); // 癸 (yin)
    expect(dayunDirection(9, 'F')).toBe(1);
  });
});

describe('computeDayun (reference chart, male)', () => {
  const dy = computeDayun(birth, 'M');
  it('壬申 year + male → forward from month pillar 壬寅: 癸卯, 甲辰, 乙巳...', () => {
    expect(dy.direction).toBe(1);
    expect(dy.pillars.slice(0, 4).map((p) => p.gz)).toEqual(['癸卯', '甲辰', '乙巳', '丙午']);
  });
  it('起运 age ≈ 3y7m (birth Feb 23 23:26 → 惊蛰 Mar 5 ≈ 10.9 days, ÷3)', () => {
    // hand-checked: 1992 惊蛰 fell on Mar 5 (CST); gap ≈ 10.9 days → 3.6y
    expect(dy.startAge.years).toBe(3);
    expect(dy.startAge.months).toBeGreaterThanOrEqual(6);
    expect(dy.startAge.months).toBeLessThanOrEqual(8);
    expect(dy.startYear).toBe(1995);
  });
  it('each pillar spans 10 years and steps +1 through the cycle', () => {
    for (let i = 0; i < dy.pillars.length; i++) {
      expect(dy.pillars[i].toAge - dy.pillars[i].fromAge).toBe(9);
      if (i) expect(dy.pillars[i].fromYear - dy.pillars[i - 1].fromYear).toBe(10);
    }
  });
  it('female flips to 辛丑, 庚子, ... (backward)', () => {
    const f = computeDayun(birth, 'F');
    expect(f.direction).toBe(-1);
    expect(f.pillars.slice(0, 2).map((p) => p.gz)).toEqual(['辛丑', '庚子']);
  });
  it('missing gender → null (direction undefined)', () => {
    expect(computeDayun(birth, null)).toBeNull();
  });
});

describe('liunianPillar', () => {
  it('anchors: 2026 = 丙午 (马年), 1992 = 壬申, 1984 = 甲子', () => {
    expect(liunianPillar(2026).gz).toBe('丙午');
    expect(liunianPillar(1992).gz).toBe('壬申');
    expect(liunianPillar(1984).gz).toBe('甲子');
  });
});

describe('taisuiRelation (犯太岁)', () => {
  it('same branch → 值太岁', () => {
    expect(taisuiRelation(6, 6)).toContain('zhi');
  });
  it('natal 子 in a 午 year → 冲太岁 (also 破: 卯午 is the break pair, 子午 is not)', () => {
    const r = taisuiRelation(6, 0);
    expect(r).toContain('chong');
    expect(r).not.toContain('po');
  });
  it('natal 申 in a 午 year → none of the five', () => {
    expect(taisuiRelation(6, 8)).toEqual([]);
  });
  it('natal 丑 in a 戌 year → 刑太岁 (丑戌 punishment cycle)', () => {
    expect(taisuiRelation(10, 1)).toContain('xing');
  });
  it('all keys have display labels', () => {
    for (const k of ['zhi', 'chong', 'xing', 'hai', 'po']) expect(TAISUI_ZH[k]).toBeTruthy();
  });
});

describe('pairRelations (incoming branch vs natal branches)', () => {
  it('午 year against natal 申寅午子: 子午相冲 + 寅午半合火', () => {
    const rel = pairRelations(6, [8, 2, 6, 0]);
    expect(rel).toContain('子午相冲');
    expect(rel).toContain('寅午半合火');
  });
  it('equal branches produce no pair relation (值 handled separately)', () => {
    expect(pairRelations(6, [6])).toEqual([]);
  });
});
