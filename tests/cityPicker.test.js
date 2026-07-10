import { describe, it, expect } from 'vitest';
import { CHINA_CITIES, GLOBAL_CITIES } from '../src/lib/cities.js';
import { allCityOptions, findCityByLabel } from '../src/lib/cityPicker.js';

describe('cities.js data integrity', () => {
  it('CHINA_CITIES: every entry has a name and lat/lon inside China\'s bounding box, no duplicate names or coordinates', () => {
    expect(CHINA_CITIES.length).toBeGreaterThan(300);
    const names = new Set();
    const coords = new Set();
    for (const c of CHINA_CITIES) {
      expect(c.zh.length).toBeGreaterThan(0);
      expect(c.lat).toBeGreaterThanOrEqual(17);
      expect(c.lat).toBeLessThanOrEqual(54);
      expect(c.lon).toBeGreaterThanOrEqual(72);
      expect(c.lon).toBeLessThanOrEqual(136);
      expect(names.has(c.zh)).toBe(false);
      names.add(c.zh);
      const key = `${c.lat},${c.lon}`;
      expect(coords.has(key)).toBe(false); // the exact bug class caught during sourcing (兴安/资阳 duplicates)
      coords.add(key);
    }
  });
  it('the 5 previously-known-wrong China entries now have corrected, sane coordinates', () => {
    const byName = Object.fromEntries(CHINA_CITIES.map((c) => [c.zh, c]));
    // 中山 (Guangdong) must NOT be up near Liaoning any more
    expect(byName['中山'].lat).toBeLessThan(30);
    // 大同 (Shanxi) must NOT be up near the Northeast any more
    expect(byName['大同'].lat).toBeLessThan(42);
    expect(byName['大同'].lon).toBeLessThan(120);
    // 兴安 must differ from 大兴安岭 now (was a duplicate)
    expect(`${byName['兴安'].lat},${byName['兴安'].lon}`).not.toBe(`${byName['大兴安岭'].lat},${byName['大兴安岭'].lon}`);
    // 甘南 (Gansu) must NOT be up near the Northeast any more
    expect(byName['甘南'].lat).toBeLessThan(40);
    // 资阳 (Sichuan) must differ from 益阳 (Hunan) now (was a duplicate)
    expect(`${byName['资阳'].lat},${byName['资阳'].lon}`).not.toBe(`${byName['益阳'].lat},${byName['益阳'].lon}`);
  });

  it('GLOBAL_CITIES: every entry has zh+en names, valid lat/lon, and a plausible UTC offset', () => {
    expect(GLOBAL_CITIES.length).toBeGreaterThan(100);
    for (const c of GLOBAL_CITIES) {
      expect(c.zh.length).toBeGreaterThan(0);
      expect(c.en.length).toBeGreaterThan(0);
      expect(c.lat).toBeGreaterThanOrEqual(-90);
      expect(c.lat).toBeLessThanOrEqual(90);
      expect(c.lon).toBeGreaterThanOrEqual(-180);
      expect(c.lon).toBeLessThanOrEqual(180);
      expect(c.utcOffset).toBeGreaterThanOrEqual(-12);
      expect(c.utcOffset).toBeLessThanOrEqual(14);
    }
  });
  it('GLOBAL_CITIES has no China mainland cities (that is CHINA_CITIES\' job)', () => {
    const names = GLOBAL_CITIES.map((c) => c.en.toLowerCase());
    for (const banned of ['beijing', 'shanghai', 'guangzhou', 'shenzhen']) {
      expect(names).not.toContain(banned);
    }
  });
});

describe('allCityOptions / findCityByLabel', () => {
  it('returns the combined list with the right length and shape', () => {
    const opts = allCityOptions();
    expect(opts.length).toBe(CHINA_CITIES.length + GLOBAL_CITIES.length);
    for (const o of opts) {
      expect(o.label.length).toBeGreaterThan(0);
      expect(typeof o.lat).toBe('number');
      expect(typeof o.lon).toBe('number');
      if (o.isChina) expect(o.utcOffset).toBeUndefined();
      else expect(typeof o.utcOffset).toBe('number');
    }
  });
  it('finds a China city by its exact zh label', () => {
    const hit = findCityByLabel('北京');
    expect(hit).toBeTruthy();
    expect(hit.isChina).toBe(true);
    expect(hit.lat).toBeCloseTo(39.9, 0);
  });
  it('finds a global city by its combined "zh en" label', () => {
    const hit = findCityByLabel('东京 Tokyo');
    expect(hit).toBeTruthy();
    expect(hit.isChina).toBe(false);
    expect(hit.utcOffset).toBe(9);
  });
  it('finds a global city by English name alone (case-insensitive)', () => {
    const hit = findCityByLabel('tokyo');
    expect(hit).toBeTruthy();
    expect(hit.en).toBe('Tokyo');
  });
  it('returns null for unknown/empty input', () => {
    expect(findCityByLabel('Atlantis')).toBeNull();
    expect(findCityByLabel('')).toBeNull();
    expect(findCityByLabel(null)).toBeNull();
  });
});
