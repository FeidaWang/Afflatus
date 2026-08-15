import { describe, expect, it } from 'vitest';
import { generateSandboxCity } from '../src/city/generate.ts';
import {
  CITY_FACADE_STRIP_WIDTH,
  createCityFacadePlan,
} from '../src/city/facades.ts';

describe('city facade batching plan', () => {
  it('is deterministic, bounded and keeps every id unique', () => {
    const city = generateSandboxCity('facade-contract');
    const first = createCityFacadePlan(city.buildings);
    const second = createCityFacadePlan(city.buildings);
    const ids = [...first.strips, ...first.balconies].map((entry) => entry.id);

    expect(first).toEqual(second);
    expect(first.strips.length).toBeGreaterThan(city.buildings.length);
    expect(first.strips.length).toBeLessThan(1_000);
    expect(first.balconies.length).toBeLessThan(200);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses exactly one main face and equal bay spacing per building', () => {
    const city = generateSandboxCity('facade-spacing');
    const facade = createCityFacadePlan(city.buildings);

    for (const building of city.buildings.filter((entry) => entry.kind !== 'landmark')) {
      const strips = facade.strips.filter((strip) => strip.buildingId === building.id);
      const faces = new Set(strips.map((strip) => strip.faceIndex));
      const bayCenters = [...new Set(strips.map((strip) => strip.bayCenter))].sort((a, b) => a - b);

      expect(faces.size).toBe(1);
      expect(strips.every((strip) => strip.width === CITY_FACADE_STRIP_WIDTH[building.buildingKind])).toBe(true);
      if (bayCenters.length > 1) {
        const gaps = bayCenters.slice(1).map((center, index) => center - bayCenters[index]);
        for (const gap of gaps) expect(gap).toBeCloseTo(strips[0].edgeSpacing, 3);
      }
      if (building.buildingKind === 'residential') {
        expect(strips.length).toBe(bayCenters.length * 2);
      } else {
        expect(strips.length).toBe(bayCenters.length);
      }
    }
  });

  it('keeps landmark facades bespoke and balconies sparse on residential backs', () => {
    const city = generateSandboxCity('facade-balconies');
    const facade = createCityFacadePlan(city.buildings);
    const buildings = new Map(city.buildings.map((building) => [building.id, building]));

    expect(facade.strips.some((strip) => buildings.get(strip.buildingId)?.kind === 'landmark')).toBe(false);
    expect(facade.balconies.length).toBeGreaterThan(0);
    for (const balcony of facade.balconies) {
      expect(buildings.get(balcony.buildingId)?.buildingKind).toBe('residential');
      expect(Object.values(balcony.position).every(Number.isFinite)).toBe(true);
    }
  });
});
