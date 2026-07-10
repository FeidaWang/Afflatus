import { describe, it, expect } from 'vitest';
import { CHINA_CITIES, GLOBAL_CITIES } from '../src/lib/cities.js';
import { allRegions, citiesInRegion, findCityInRegion } from '../src/lib/cityPicker.js';

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
  it('every CHINA_CITIES entry has a non-empty province, every GLOBAL_CITIES entry has a non-empty country+countryZh', () => {
    for (const c of CHINA_CITIES) expect(c.province, c.zh).toBeTruthy();
    for (const c of GLOBAL_CITIES) { expect(c.country, c.en).toBeTruthy(); expect(c.countryZh, c.en).toBeTruthy(); }
  });
  it('China has exactly the 34 real province-level divisions', () => {
    expect(new Set(CHINA_CITIES.map((c) => c.province)).size).toBe(34);
  });
});

describe('allRegions', () => {
  it('provinces: every CHINA_CITIES province appears exactly once, all isChina:true', () => {
    const { provinces } = allRegions();
    expect(provinces.length).toBe(new Set(CHINA_CITIES.map((c) => c.province)).size);
    for (const p of provinces) expect(p.isChina).toBe(true);
    expect(new Set(provinces.map((p) => p.key)).size).toBe(provinces.length);
  });
  it('countries: every GLOBAL_CITIES country appears exactly once, all isChina:false, carries zh+en', () => {
    const { countries } = allRegions();
    expect(countries.length).toBe(new Set(GLOBAL_CITIES.map((c) => c.country)).size);
    for (const c of countries) { expect(c.isChina).toBe(false); expect(c.zh).toBeTruthy(); expect(c.en).toBeTruthy(); }
    expect(new Set(countries.map((c) => c.key)).size).toBe(countries.length);
  });
});

describe('citiesInRegion / findCityInRegion', () => {
  it('a China province returns only that province\'s cities, isChina:true, no utcOffset', () => {
    const list = citiesInRegion('上海市', true);
    expect(list.length).toBe(1);
    expect(list[0].zh).toBe('上海');
    expect(list[0].isChina).toBe(true);
    expect(list[0].utcOffset).toBeUndefined();
  });
  it('a country returns only that country\'s cities, isChina:false, with utcOffset', () => {
    const list = citiesInRegion('Japan', false);
    expect(list.map((c) => c.en).sort()).toEqual(['Osaka', 'Tokyo']);
    for (const c of list) { expect(c.isChina).toBe(false); expect(typeof c.utcOffset).toBe('number'); }
  });
  it('findCityInRegion looks up one city by zh name inside a resolved region', () => {
    const hit = findCityInRegion('Japan', false, '东京');
    expect(hit).toBeTruthy();
    expect(hit.en).toBe('Tokyo');
    expect(hit.utcOffset).toBe(9);
  });
  it('returns null/empty for unknown region or city', () => {
    expect(citiesInRegion('Atlantis', false)).toEqual([]);
    expect(findCityInRegion('Japan', false, 'Nowhere')).toBeNull();
  });
});
