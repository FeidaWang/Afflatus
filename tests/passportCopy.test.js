import { describe, expect, it } from 'vitest';
import { MOON_PHASE_COPY, SOLAR_TERM_COPY, DAY_RELATION_COPY, moonPhaseIndex } from '../src/lib/passportCopy.js';
import { elementRelation } from '../src/lib/horoscopeEngine.js';

const all = [...MOON_PHASE_COPY, ...SOLAR_TERM_COPY, ...Object.values(DAY_RELATION_COPY)];

describe('passport copy library', () => {
  it('has 8 phases, 24 solar terms and 5 day-master relations', () => {
    expect(MOON_PHASE_COPY).toHaveLength(8);
    expect(SOLAR_TERM_COPY).toHaveLength(24);
    expect(Object.keys(DAY_RELATION_COPY)).toHaveLength(5);
  });

  it('every entry has a unique ruleId, a bilingual reading and a bilingual source', () => {
    const ids = all.map((e) => e.ruleId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of all) {
      expect(e.ruleId).toMatch(/^[a-z_]+(\.[a-z_]+)+$/);
      expect(e.reading.en && e.reading.zh).toBeTruthy();
      expect(e.source.en && e.source.zh).toBeTruthy();
    }
  });

  it('solar terms sit every 15° and the twelve jie are the month boundaries', () => {
    const lons = SOLAR_TERM_COPY.map((t) => t.sunLongitude);
    expect(new Set(lons).size).toBe(24);
    expect(lons.every((l) => l % 15 === 0)).toBe(true);
    expect(SOLAR_TERM_COPY.filter((t) => t.kind === 'jie').map((t) => t.sunLongitude).sort((a, b) => a - b))
      .toEqual([15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345]);
  });

  it('phase bins are centred on 0°, 45° … and cover the full circle', () => {
    expect(moonPhaseIndex(0)).toBe(0);
    expect(moonPhaseIndex(22.4)).toBe(0);
    expect(moonPhaseIndex(22.6)).toBe(1);
    expect(moonPhaseIndex(90)).toBe(2);
    expect(moonPhaseIndex(180)).toBe(4);
    expect(moonPhaseIndex(-90)).toBe(6);
    expect(moonPhaseIndex(-10)).toBe(0);
  });

  it('relation keys are exactly what elementRelation returns', () => {
    const seen = new Set();
    for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) seen.add(elementRelation(a, b));
    expect([...seen].sort()).toEqual(Object.keys(DAY_RELATION_COPY).sort());
  });
});
