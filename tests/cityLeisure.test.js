import { describe, expect, it } from 'vitest';
import { generateSandboxCity } from '../src/city/generate.ts';
import { createCityLeisurePlan } from '../src/city/leisure.ts';

describe('city leisure asset plan', () => {
  it.each(['sandbox', 'shanghai', 'melbourne', 'hong-kong'])('is deterministic, unique and park-bound for %s', (profile) => {
    const city = generateSandboxCity('leisure-contract', profile);
    const first = createCityLeisurePlan(city);
    const second = createCityLeisurePlan(city);
    const blocks = new Map(city.blocks.map((block) => [block.id, block]));

    expect(first).toEqual(second);
    expect(first.assets.length).toBeGreaterThan(0);
    expect(new Set(first.assets.map((asset) => asset.id)).size).toBe(first.assets.length);
    expect(first.assets.length).toBeLessThanOrEqual(
      city.blocks.filter((block) => block.zone === 'park').length * 22,
    );

    for (const asset of first.assets) {
      const block = blocks.get(asset.blockId);
      expect(block?.zone).toBe('park');
      expect(Math.abs(asset.position.x - block.center.x)).toBeLessThan(city.profile.blockSize / 2);
      expect(Math.abs(asset.position.z - block.center.z)).toBeLessThan(city.profile.blockSize / 2);
      expect(asset.availableDay).toBeGreaterThanOrEqual(0);
      expect(asset.availableDay).toBeLessThan(city.profile.totalDays);
    }
  });

  it('creates complete seating, lighting and cycle-rack component sets per park', () => {
    const city = generateSandboxCity('leisure-components', 'sandbox');
    const plan = createCityLeisurePlan(city);
    const parks = city.blocks.filter((block) => block.zone === 'park');
    const kinds = new Set(plan.assets.map((asset) => asset.kind));

    expect(plan.assets).toHaveLength(parks.length * 22);
    expect(kinds).toEqual(new Set([
      'bench-seat',
      'bench-back',
      'bench-leg',
      'bike-rack-base',
      'bike-rack-beam',
      'bike-rack-post',
      'lamp-arm',
      'lamp-head',
      'lamp-post',
      'table-top',
      'table-leg',
    ]));
  });
});
