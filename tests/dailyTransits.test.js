import { describe, it, expect } from 'vitest';
import { dailyCoupleWeather } from '../src/lib/dailyTransits.js';

describe('dailyCoupleWeather', () => {
  it('finds a hit when a transiting body conjuncts a natal point', () => {
    const transit = { Sun: 50, Moon: 0, Mercury: 0, Venus: 0, Mars: 0, Jupiter: 0, Saturn: 0 };
    const me = { Sun: 51, Moon: 200 };
    const them = { Sun: 200, Moon: 200 };
    const r = dailyCoupleWeather(transit, me, them);
    const hit = r.hits.find((h) => h.tBody === 'Sun' && h.owner === 'me' && h.nBody === 'Sun');
    expect(hit).toBeTruthy();
    expect(hit.key).toBe('conj');
  });
  it('returns at most 2 lines, tightest orb first, non-empty bilingual', () => {
    const transit = { Sun: 10, Moon: 10.5, Mercury: 11, Venus: 40, Mars: 70, Jupiter: 100, Saturn: 130 };
    const me = { Sun: 10, Moon: 10 };
    const them = { Sun: 10, Moon: 10 };
    const r = dailyCoupleWeather(transit, me, them);
    expect(r.lines.length).toBeLessThanOrEqual(2);
    expect(r.lines.length).toBeGreaterThan(0);
    for (const l of r.lines) { expect(l.zh.length).toBeGreaterThan(0); expect(l.en.length).toBeGreaterThan(0); }
    // sorted tightest orb first
    if (r.hits.length > 1) expect(r.hits[0].orb).toBeLessThanOrEqual(r.hits[1].orb);
  });
  it('returns no hits/lines when nothing is in orb', () => {
    const transit = { Sun: 15 };
    const me = { Sun: 55, Moon: 55 }; // 40deg from transit Sun: not in any aspect orb
    const them = { Sun: 55, Moon: 55 };
    const r = dailyCoupleWeather(transit, me, them);
    expect(r.hits.length).toBe(0);
    expect(r.lines.length).toBe(0);
  });
  it('tolerates missing transit bodies or missing natal points without throwing', () => {
    expect(() => dailyCoupleWeather({ Sun: 10 }, { Sun: 10 }, { Sun: 10 })).not.toThrow();
    expect(() => dailyCoupleWeather({}, { Sun: 10, Moon: 20 }, { Sun: 10, Moon: 20 })).not.toThrow();
  });
});
