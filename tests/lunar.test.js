import { describe, it, expect } from 'vitest';
import { solarToLunar, lunarDayZh, leapMonthOf, LUNAR_INFO } from '../src/lib/lunar.js';

// Anchors below were double-checked two ways before being frozen here:
// (a) publicly well-known dates (spring festivals), (b) a full sweep
// against an independent lunar library — 10,815 days across 16 years
// (incl. every leap-month layout and the tricky 2033) + 5,000 random
// days, zero mismatches (see RELEASE_NOTES V21 Phase 3).

describe('solarToLunar — spring festival anchors (正月初一)', () => {
  it.each([
    [1900, 1, 31], [2000, 2, 5], [2024, 2, 10], [2025, 1, 29], [2026, 2, 17],
  ])('%i-%i-%i is 正月初一', (y, m, d) => {
    const r = solarToLunar(y, m, d);
    expect([r.lMonth, r.lDay, r.isLeap]).toEqual([1, 1, false]);
    expect(r.lYear).toBe(m === 1 ? y : y); // festival always lands in its own lunar year
  });
});

describe('solarToLunar — mid-month & leap-month anchors', () => {
  it('1992-02-23 = 正月二十 (the reference birth date)', () => {
    const r = solarToLunar(1992, 2, 23);
    expect(r.monthZh + r.dayZh).toBe('正月二十');
  });
  it('2023-03-22 = 闰二月初一 / 2023-04-19 = 闰二月廿九', () => {
    expect(solarToLunar(2023, 3, 22)).toMatchObject({ lMonth: 2, lDay: 1, isLeap: true });
    const r = solarToLunar(2023, 4, 19);
    expect(r.monthZh + r.dayZh).toBe('闰二月廿九');
  });
  it('2033 has the famously tricky 闰冬月: 2033-12-22 = 闰冬月初一, 2034-01-20 = 腊月初一', () => {
    expect(solarToLunar(2033, 12, 22)).toMatchObject({ lYear: 2033, lMonth: 11, lDay: 1, isLeap: true });
    expect(solarToLunar(2034, 1, 20)).toMatchObject({ lYear: 2033, lMonth: 12, lDay: 1, isLeap: false });
  });
  it('1995-10-01 = 闰八月初七', () => {
    expect(solarToLunar(1995, 10, 1)).toMatchObject({ lMonth: 8, lDay: 7, isLeap: true });
  });
});

describe('table / formatting sanity', () => {
  it('table covers 1900–2100 (201 entries), first entry is the canonical 0x04bd8', () => {
    expect(LUNAR_INFO.length).toBe(201);
    expect(LUNAR_INFO[0]).toBe(0x04bd8);
  });
  it('leapMonthOf: 2023→2, 2033→11, 2026→none', () => {
    expect(leapMonthOf(2023)).toBe(2);
    expect(leapMonthOf(2033)).toBe(11);
    expect(leapMonthOf(2026)).toBe(0);
  });
  it('lunarDayZh formatting', () => {
    expect(lunarDayZh(1)).toBe('初一');
    expect(lunarDayZh(10)).toBe('初十');
    expect(lunarDayZh(20)).toBe('二十');
    expect(lunarDayZh(21)).toBe('廿一');
    expect(lunarDayZh(30)).toBe('三十');
  });
  it('out of range returns null', () => {
    expect(solarToLunar(1900, 1, 30)).toBeNull();
    expect(solarToLunar(2101, 1, 1)).toBeNull();
  });
});
