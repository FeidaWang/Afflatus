// westernPro.js vs external references: Swiss Ephemeris (pyswisseph 2.10,
// Moshier) for planets / true node / Placidus cusps, and JPL Horizons for
// Juno. Fixtures generated once and committed (tests/fixtures/).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as W from '../src/lib/westernPro.js';

const SWE = JSON.parse(readFileSync(new URL('./fixtures/swisseph-natal.json', import.meta.url)));
const off = (a, b) => Math.abs(W.diff180(a, b));

describe('positions & houses vs Swiss Ephemeris', () => {
  it('planets and true node within 0.03°, Placidus cusps within 0.01°', () => {
    for (const [jd, lat, lon, pos, cusps] of SWE) {
      const c = W.chartAt(jd, { lat, lon });
      for (const [k, v] of Object.entries(pos)) expect(off(c.points[k].lon, v), `${k} @${jd}`).toBeLessThan(0.03);
      if (c.houses.system === 'placidus') cusps.forEach((v, i) => expect(off(c.houses.cusps[i], v), `cusp ${i + 1}`).toBeLessThan(0.01));
    }
  });
});

describe('Juno (婚神星) vs JPL Horizons apparent ecliptic longitude', () => {
  const HORIZONS = [[2415020.5, 292.3480228], [2433282.5, 182.6394646], [2440587.5, 304.6770741], [2446431.5, 239.1554388], [2451544.5, 277.8099165], [2455197.5, 4.4290425], [2469807.5, 152.7406321], [2488069.5, 265.2664572]];
  it('stays within 0.1° from 1900 to 2100', () => {
    for (const [jd, ref] of HORIZONS) expect(off(W.junoLon(jd), ref)).toBeLessThan(0.1);
  });
});

describe('predictive techniques', () => {
  const natal = W.natalChart({ y: 1990, m: 6, d: 15, hour: 14, lat: 31.23, lon: 121.47 });
  it('solar return hits the natal Sun exactly, near the birthday', () => {
    const sr = W.solarReturn(natal, 2026, { lat: -37.81, lon: 144.96 });
    expect(off(sr.points.Sun.lon, natal.points.Sun.lon)).toBeLessThan(1e-4);
    expect(sr.date.toISOString().slice(0, 10)).toBe('2026-06-14'); // Swiss: 2026-06-14 23:23:56 UT
  });
  it('lunar return is the latest one before now', () => {
    const now = W.jdOf(new Date('2026-09-27T00:00:00Z'));
    const lr = W.currentLunarReturn(natal, now, null);
    expect(off(lr.points.Moon.lon, natal.points.Moon.lon)).toBeLessThan(1e-3);
    expect(lr.jd).toBeLessThanOrEqual(now);
    expect(now - lr.jd).toBeLessThan(27.6);
  });
  it('secondary progression: 1 day per year; solar arc equals progressed Sun − natal Sun', () => {
    const jd = natal.jd + 30 * 365.24219;
    const sp = W.secondaryProgression(natal, jd);
    expect(sp.progressedJD - natal.jd).toBeCloseTo(30, 6);
    const sa = W.solarArc(natal, jd);
    expect(sa.arc).toBeCloseTo(W.diff180(sp.points.Sun.lon, natal.points.Sun.lon), 6);
  });
  it('firdaria: day chart sequence and Chaldean sub-periods', () => {
    const f = W.firdaria(natal, natal.jd + 36.3 * 365.24219);
    expect(f.sect).toBe('day');
    expect(f.periods.map((p) => p.lord)).toEqual(['Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars', 'Node', 'SouthNode']);
    expect(f.current.lord).toBe('Moon'); // 31–40
    expect(f.sub.lord).toBe('Sun');       // Moon, Saturn, Jupiter, Mars, Sun…
    const night = W.firdaria({ ...natal, sect: 'night' }, natal.jd + 1);
    expect(night.periods.map((p) => p.lord).slice(0, 2)).toEqual(['Moon', 'Saturn']);
  });
  it('profection moves one whole sign per year', () => {
    const p = W.profection(natal, natal.jd + 36.3 * 365.24219);
    expect(p.age).toBe(36);
    expect(p.sign).toBe(Math.floor(natal.houses.asc / 30));
    expect(p.lord).toBe(W.DOMICILE[p.sign]);
  });
  it('relocation keeps planets, changes angles', () => {
    const r = W.relocation(natal, { lat: -37.81, lon: 144.96 });
    expect(r.points.Venus.lon).toBeCloseTo(natal.points.Venus.lon, 9);
    expect(off(r.houses.asc, natal.houses.asc)).toBeGreaterThan(1);
  });
  it('polar latitude falls back to Porphyry', () => {
    expect(W.chartAt(natal.jd, { lat: 70, lon: 20 }).houses.system).toBe('porphyry');
  });
});
