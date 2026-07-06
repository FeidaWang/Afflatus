import { describe, it, expect } from 'vitest';
import { moonLongitude, elongation, ascendant, sunLongitude, signOf, degInSign, aspectBetween, ASPECT_T } from '../src/lib/astro.js';
import { solarToLunar } from '../src/lib/lunar.js';
import { julianDayUTC } from '../src/lib/bazi.js';

const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

describe('moonLongitude — structural verification against the lunar calendar', () => {
  // The lunar table was independently verified over 10,815 days (Phase 3).
  // A lunar 初一 is by definition the CST day containing the sun-moon
  // conjunction, so the elongation must cross 0° within that day. Any sign
  // or coefficient error in the truncated series breaks this immediately.
  it('elongation crosses 0° on every lunar 初一 of 1992 and 2026', () => {
    let months = 0;
    for (const y of [1992, 2026]) {
      for (let m = 1; m <= 12; m++) for (let d = 1; d <= dim(y, m); d++) {
        const l = solarToLunar(y, m, d);
        if (!l || l.lDay !== 1) continue;
        months++;
        expect(elongation(julianDayUTC(y, m, d, -8)), `${y}-${m}-${d} start`).toBeLessThanOrEqual(0);
        expect(elongation(julianDayUTC(y, m, d, 16)), `${y}-${m}-${d} end`).toBeGreaterThanOrEqual(0);
      }
    }
    expect(months).toBeGreaterThanOrEqual(24);
  });
  it('elongation is large near every 十五 (full moon falls 十四–十七, so ≥145°)', () => {
    for (const y of [1992, 2026]) {
      for (let m = 1; m <= 12; m++) for (let d = 1; d <= dim(y, m); d++) {
        const l = solarToLunar(y, m, d);
        if (!l || l.lDay !== 15) continue;
        expect(Math.abs(elongation(julianDayUTC(y, m, d, 4))), `${y}-${m}-${d}`).toBeGreaterThanOrEqual(145);
      }
    }
  });
  it('moon moves ~13°/day', () => {
    const jd = julianDayUTC(2026, 7, 6, 0);
    const move = ((moonLongitude(jd + 1) - moonLongitude(jd)) + 360) % 360;
    expect(move).toBeGreaterThan(11);
    expect(move).toBeLessThan(16);
  });
});

describe('ascendant — physical invariants', () => {
  it('sweeps all 12 signs within 24 hours', () => {
    const seen = new Set();
    for (let h = 0; h < 24; h += 0.25) seen.add(signOf(ascendant(julianDayUTC(2026, 3, 20, h), 30, 120)));
    expect(seen.size).toBe(12);
  });
  it('at equinox sunrise on the equator, ascendant ≈ sun longitude (eastern horizon)', () => {
    const jd = julianDayUTC(2026, 3, 20, 6); // ≈06:00 UT local sunrise at 0°N 0°E
    const diff = Math.abs(ascendant(jd, 0, 0) - sunLongitude(jd));
    expect(Math.min(diff, 360 - diff)).toBeLessThan(5);
  });
});

describe('signOf / aspects', () => {
  it('signOf: 0°=Aries(0), 45°=Taurus(1), 359°=Pisces(11)', () => {
    expect(signOf(0)).toBe(0);
    expect(signOf(45)).toBe(1);
    expect(signOf(359)).toBe(11);
    expect(Math.round(degInSign(45))).toBe(15);
  });
  it('aspectBetween: exact and orb-edge matches', () => {
    expect(aspectBetween(10, 10).key).toBe('conj');
    expect(aspectBetween(10, 17).key).toBe('conj');   // orb 7 ≤ 8
    expect(aspectBetween(10, 70).key).toBe('sextile');
    expect(aspectBetween(10, 100).key).toBe('square');
    expect(aspectBetween(10, 130).key).toBe('trine');
    expect(aspectBetween(10, 190).key).toBe('opp');
    expect(aspectBetween(10, 45)).toBeNull();          // 35° — no aspect
  });
  it('wraps across 0°', () => {
    expect(aspectBetween(356, 4).key).toBe('conj'); // 8° apart across the wrap
    expect(aspectBetween(350, 172).key).toBe('opp'); // 178° apart
  });
  it('all aspect keys have labels', () => {
    for (const k of ['conj', 'sextile', 'square', 'trine', 'opp']) expect(ASPECT_T[k].zh).toBeTruthy();
  });
});
