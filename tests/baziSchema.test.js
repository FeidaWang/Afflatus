import { describe, it, expect } from 'vitest';
import { computeBazi } from '../src/lib/bazi.js';
import { toBirthPillars, validateBirthPillars, todayPillars } from '../src/lib/baziSchema.js';

const P1 = { y: 1994, m: 4, d: 18, hour: 8 };
const P2 = { y: 1996, m: 11, d: 2, hour: null };

describe('toBirthPillars', () => {
  it('matches the spec §1.1 regex for every field', () => {
    const re = /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/;
    const bp = toBirthPillars(computeBazi(P1));
    expect(bp.year).toMatch(re);
    expect(bp.month).toMatch(re);
    expect(bp.day).toMatch(re);
    expect(bp.hour).toMatch(re);
  });
  it('hour is null when birth hour is unknown', () => {
    const bp = toBirthPillars(computeBazi(P2));
    expect(bp.hour).toBeNull();
  });
  it('matches P1\'s hand-verified chart (甲戌 戊辰 甲戌 戊辰)', () => {
    const bp = toBirthPillars(computeBazi(P1));
    expect(bp).toEqual({ year: '甲戌', month: '戊辰', day: '甲戌', hour: '戊辰' });
  });
});

describe('validateBirthPillars', () => {
  it('accepts a valid object (with and without hour)', () => {
    expect(validateBirthPillars({ year: '甲子', month: '乙丑', day: '丙寅', hour: '丁卯' })).toBe(true);
    expect(validateBirthPillars({ year: '甲子', month: '乙丑', day: '丙寅', hour: null })).toBe(true);
  });
  it('rejects missing/malformed required fields', () => {
    expect(() => validateBirthPillars(null)).toThrow();
    expect(() => validateBirthPillars({})).toThrow();
    expect(() => validateBirthPillars({ year: '甲子', month: '乙丑', day: 'XX' })).toThrow();
    expect(() => validateBirthPillars({ year: '子甲', month: '乙丑', day: '丙寅' })).toThrow(); // reversed stem/branch
  });
  it('rejects a malformed hour', () => {
    expect(() => validateBirthPillars({ year: '甲子', month: '乙丑', day: '丙寅', hour: 'nope' })).toThrow();
  });
});

describe('todayPillars', () => {
  it('is the real day pillar (matches dayPillar/computeBazi), no randomness', () => {
    expect(todayPillars('2026-07-05')).toEqual({ day: '庚辰', stem: 6, branch: 4 });
  });
  it('is deterministic across calls', () => {
    expect(todayPillars('2026-01-05')).toEqual(todayPillars('2026-01-05'));
  });
});
