import { describe, expect, it } from 'vitest';
import { generateSandboxCity } from '../src/city/generate.ts';
import { createCityRooftopPlan } from '../src/city/rooftops.ts';

describe('city rooftop asset plan', () => {
  it.each(['sandbox', 'shanghai', 'melbourne', 'hong-kong'])('is deterministic and bounded for %s', (profile) => {
    const city = generateSandboxCity('rooftop-contract', profile);
    const first = createCityRooftopPlan(city.buildings);
    const second = createCityRooftopPlan(city.buildings);
    const buildings = new Map(city.buildings.map((building) => [building.id, building]));

    expect(first).toEqual(second);
    expect(new Set(first.assets.map((asset) => asset.id)).size).toBe(first.assets.length);
    expect(first.assets.length).toBeLessThanOrEqual(city.buildings.length * 6);
    for (const rooftop of first.assets) {
      const building = buildings.get(rooftop.buildingId);
      expect(building).toBeDefined();
      expect(rooftop.position.y).toBeGreaterThan(building.bounds.height);
      expect(rooftop.bounds.width).toBeGreaterThan(0);
      expect(rooftop.bounds.depth).toBeGreaterThan(0);
      expect(rooftop.bounds.width).toBeLessThanOrEqual(building.bounds.width);
      expect(rooftop.bounds.depth).toBeLessThanOrEqual(building.bounds.depth);
      expect(rooftop.revealStart).toBeGreaterThanOrEqual(0);
      expect(rooftop.revealStart).toBeLessThan(1);
    }
  });

  it('covers the complete detail grammar across all profile fixtures', () => {
    const kinds = new Set(['sandbox', 'shanghai', 'melbourne', 'hong-kong'].flatMap((profile) => (
      createCityRooftopPlan(generateSandboxCity('rooftop-contract', profile).buildings)
        .assets.map((asset) => asset.kind)
    )));
    expect(kinds).toEqual(new Set([
      'antenna-mast',
      'crown-tier',
      'equipment-room',
      'equipment-vent',
      'garden-lawn',
      'garden-planter',
      'garden-pergola',
      'helipad-deck',
      'helipad-mark',
    ]));
  });

  it('uses green lawns and visible white planters only on garden roofs', () => {
    const city = generateSandboxCity('rooftop-garden-contract', 'sandbox');
    const rooftops = createCityRooftopPlan(city.buildings).assets;
    const buildings = new Map(city.buildings.map((building) => [building.id, building]));
    const lawns = rooftops.filter((asset) => asset.kind === 'garden-lawn');
    const planters = rooftops.filter((asset) => asset.kind === 'garden-planter');

    expect(lawns.length).toBeGreaterThan(0);
    expect(planters.length).toBe(lawns.length * 2);
    expect(lawns.every((asset) => asset.tone === 'green')).toBe(true);
    expect(planters.every((asset) => asset.tone === 'white')).toBe(true);
    expect([...lawns, ...planters].every((asset) => (
      buildings.get(asset.buildingId)?.roofKind === 'garden'
    ))).toBe(true);
  });
});
