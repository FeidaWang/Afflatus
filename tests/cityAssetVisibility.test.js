import { describe, expect, it } from 'vitest';
import {
  CITY_ASSET_CATEGORIES,
  countVisibleCityAssetCategories,
  createCityAssetVisibility,
  setCityAssetCategoryVisibility,
} from '../src/city/assetVisibility.ts';
import { createCityAssetInventory } from '../src/city/assetInventory.ts';
import { generateSandboxCity } from '../src/city/generate.ts';
import { cityMetricsAt } from '../src/city/schedule.ts';
import { createCityRooftopPlan } from '../src/city/rooftops.ts';
import { createCityLeisurePlan } from '../src/city/leisure.ts';

describe('city asset visibility contract', () => {
  it('normalizes six render-only categories and changes one category immutably', () => {
    const initial = createCityAssetVisibility();
    expect(CITY_ASSET_CATEGORIES.map((category) => category.key)).toEqual([
      'structures',
      'facades',
      'infrastructure',
      'landscape',
      'mobility',
      'cranes',
    ]);
    expect(countVisibleCityAssetCategories(initial)).toBe(6);

    const changed = setCityAssetCategoryVisibility(initial, 'mobility', false);
    expect(changed).not.toBe(initial);
    expect(changed).toEqual({ ...initial, mobility: false });
    expect(countVisibleCityAssetCategories(changed)).toBe(5);
    expect(setCityAssetCategoryVisibility(changed, 'mobility', false)).toBe(changed);
  });

  it('reports deterministic inventory without changing simulation truth', () => {
    const plan = generateSandboxCity('asset-inventory-contract', 'melbourne');
    const metrics = cityMetricsAt(plan, 147);
    const first = createCityAssetInventory(plan);
    const second = createCityAssetInventory(plan);
    const rooftopAssets = createCityRooftopPlan(plan.buildings).assets;
    const leisureAssets = createCityLeisurePlan(plan).assets;

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      structures: plan.buildings.length + plan.heroLandmarks.length + rooftopAssets.length,
      infrastructure: plan.roads.length + plan.water.length,
      landscape: plan.trees.length + leisureAssets.length,
      mobility: plan.vehicles.length + 1,
    });
    expect(first.facades).toBeGreaterThan(plan.buildings.length);
    expect(first.cranes).toBeGreaterThan(0);
    createCityAssetVisibility({ structures: false, mobility: false });
    expect(cityMetricsAt(plan, 147)).toEqual(metrics);
  });
});
