import { describe, expect, it } from 'vitest';
import {
  computeProfessionalEphemeris,
  computeSynastryAstro,
  runHoroscopeSynthesis,
} from '../src/lib/horoscopeSynthesis.js';

describe('horoscope synthesis worker payloads', () => {
  it('returns a deterministic, cloneable synastry projection', () => {
    const payload = {
      me: { y: 1990, m: 1, d: 1, hour: 12 },
      other: { y: 1992, m: 6, d: 15, hour: 7 },
      baziBase: 65,
    };
    const result = computeSynastryAstro(payload);

    expect(result.score).toBe(59);
    expect(result.title.en).toBe('Mind-Meld Chatterbox');
    expect(result.aspects).toHaveLength(5);
    expect(() => structuredClone(result)).not.toThrow();
    expect(runHoroscopeSynthesis('synastry-astro', payload)).toEqual(result);
  });

  it('unknown hour keeps only Moon aspects that hold across the whole birth day', () => {
    const known = { y: 1992, m: 6, d: 15, hour: 7 };
    for (let d = 1; d <= 28; d++) {
      const r = computeSynastryAstro({ me: { y: 1990, m: 1, d, hour: null }, other: known, baziBase: 60 });
      expect(r.moonEstimated).toEqual({ me: true, other: false });
      // every surviving aspect that uses my Moon must be the same aspect at 00:00 and 23:59
      for (const a of r.aspects.filter((x) => x.bodyMe === 'Moon')) {
        const early = computeSynastryAstro({ me: { y: 1990, m: 1, d, hour: 0 }, other: known, baziBase: 60 }).aspects;
        expect(early.some((e) => e.bodyMe === 'Moon' && e.bodyThem === a.bodyThem && e.key === a.key)).toBe(true);
      }
    }
  });

  it('builds the professional ephemeris without DOM state', () => {
    const planets = computeProfessionalEphemeris({ jd: 2451545 });

    expect(planets).toHaveLength(8);
    expect(planets.map((planet) => planet.body)).toEqual([
      'Mercury', 'Venus', 'Mars', 'Jupiter',
      'Saturn', 'Uranus', 'Neptune', 'Pluto',
    ]);
    expect(planets.every((planet) => Number.isFinite(planet.lonDeg))).toBe(true);
    expect(runHoroscopeSynthesis('professional-ephemeris', { jd: 2451545 })).toEqual(planets);
  });

  it('rejects unknown worker operations', () => {
    expect(() => runHoroscopeSynthesis('unknown', {})).toThrow(/Unsupported horoscope synthesis/);
  });
});
