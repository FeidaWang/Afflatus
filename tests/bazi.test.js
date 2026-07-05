import { describe, it, expect } from 'vitest';
import {
  jdn, dayPillar, yearPillar, monthBranch, monthPillar, hourPillar, hourBranchOf,
  computeBazi, pillarName, zodiacIndex, STEMS, BRANCHES,
} from '../src/lib/bazi.js';

describe('day pillar (sexagenary cycle)', () => {
  it('anchor 1: 1949-10-01 was a 甲子 day', () => {
    const p = dayPillar(1949, 10, 1);
    expect(STEMS[p.stem] + BRANCHES[p.branch]).toBe('甲子');
  });
  it('anchor 2 (independent source): 1970-01-01 was a 辛巳 day', () => {
    const p = dayPillar(1970, 1, 1);
    expect(STEMS[p.stem] + BRANCHES[p.branch]).toBe('辛巳');
  });
  it('cycle advances by exactly 1 per day, wrapping at 60', () => {
    const a = dayPillar(2026, 7, 5), b = dayPillar(2026, 7, 6);
    expect(b.idx).toBe((a.idx + 1) % 60);
  });
  it('jdn handles month/year rollover', () => {
    expect(jdn(2024, 3, 1) - jdn(2024, 2, 29)).toBe(1); // leap year
    expect(jdn(2025, 1, 1) - jdn(2024, 12, 31)).toBe(1);
  });
});

describe('year pillar (立春 boundary)', () => {
  it('2024 after 立春 is 甲辰', () => {
    const p = yearPillar(2024, 6, 1);
    expect(STEMS[p.stem] + BRANCHES[p.branch]).toBe('甲辰');
  });
  it('January belongs to the previous bazi year', () => {
    const p = yearPillar(2024, 1, 20);
    expect(STEMS[p.stem] + BRANCHES[p.branch]).toBe('癸卯'); // 2023's pillar
    expect(p.baziYear).toBe(2023);
  });
  it('Feb 4 flips the year', () => {
    expect(yearPillar(2024, 2, 3).baziYear).toBe(2023);
    expect(yearPillar(2024, 2, 4).baziYear).toBe(2024);
  });
});

describe('month pillar', () => {
  it('branch boundaries: 立春 opens 寅月, early Jan is 子月', () => {
    expect(monthBranch(2, 4)).toBe(2);   // 寅
    expect(monthBranch(1, 3)).toBe(0);   // 子 (started previous Dec 7)
    expect(monthBranch(1, 6)).toBe(1);   // 丑 (小寒)
    expect(monthBranch(12, 7)).toBe(0);  // 子 (大雪)
  });
  it('五虎遁: 甲年寅月起丙寅', () => {
    const p = monthPillar(2024, 2, 10);  // 甲辰年寅月
    expect(STEMS[p.stem] + BRANCHES[p.branch]).toBe('丙寅');
  });
});

describe('hour pillar (五鼠遁)', () => {
  it('甲日 00:30 → 甲子时', () => {
    const p = hourPillar(0, 0);
    expect(STEMS[p.stem] + BRANCHES[p.branch]).toBe('甲子');
  });
  it('戊日子时起壬子', () => {
    const p = hourPillar(4, 23);
    expect(STEMS[p.stem] + BRANCHES[p.branch]).toBe('壬子');
  });
  it('hour branch mapping: 23:00 and 00:59 are both 子, 11:00 is 午', () => {
    expect(hourBranchOf(23)).toBe(0);
    expect(hourBranchOf(0)).toBe(0);
    expect(hourBranchOf(11)).toBe(6);
  });
});

describe('computeBazi', () => {
  it('with hour → 4 pillars, 8 element slots counted', () => {
    const c = computeBazi({ y: 1990, m: 6, d: 15, hour: 10 });
    expect(c.hour).not.toBeNull();
    expect(c.elements.reduce((a, b) => a + b, 0)).toBe(8);
  });
  it('hour unknown → 3 pillars, 6 element slots', () => {
    const c = computeBazi({ y: 1990, m: 6, d: 15 });
    expect(c.hour).toBeNull();
    expect(c.elements.reduce((a, b) => a + b, 0)).toBe(6);
  });
  it('day master equals the day pillar stem', () => {
    const c = computeBazi({ y: 1970, m: 1, d: 1, hour: 12 });
    expect(STEMS[c.dayMaster]).toBe('辛');
  });
  it('pillarName renders 干支 text', () => {
    expect(pillarName(dayPillar(1949, 10, 1))).toBe('甲子');
  });
});

describe('western zodiac', () => {
  it('boundary dates', () => {
    expect(zodiacIndex(3, 21)).toBe(0);   // Aries starts
    expect(zodiacIndex(3, 20)).toBe(11);  // still Pisces
    expect(zodiacIndex(12, 22)).toBe(9);  // Capricorn starts
    expect(zodiacIndex(1, 19)).toBe(9);   // Capricorn wraps into January
    expect(zodiacIndex(1, 20)).toBe(10);  // Aquarius
    expect(zodiacIndex(8, 1)).toBe(4);    // Leo
  });
});
