import { describe, expect, it } from 'vitest';
import {
  CITY_ENVIRONMENT_DENSITY,
  createCityEnvironmentVisibility,
} from '../src/city/environment.ts';
import { generateSandboxCity } from '../src/city/generate.ts';
import { cityMetricsAt } from '../src/city/schedule.ts';

describe('city environment density', () => {
  it('creates deterministic nested visibility sets for every profile', () => {
    for (const profile of ['sandbox', 'shanghai', 'melbourne', 'hong-kong']) {
      const plan = generateSandboxCity('environment-density', profile);
      const high = createCityEnvironmentVisibility(plan, 'high');
      const medium = createCityEnvironmentVisibility(plan, 'medium');
      const silhouette = createCityEnvironmentVisibility(plan, 'silhouette');

      expect(high).toEqual(createCityEnvironmentVisibility(plan, 'high'));
      expect(high.vehicleIds).toHaveLength(plan.vehicles.length);
      expect(high.treeIds).toHaveLength(plan.trees.length);
      expect(new Set(high.vehicleIds)).toEqual(new Set(plan.vehicles.map((vehicle) => vehicle.id)));
      expect(new Set(high.treeIds)).toEqual(new Set(plan.trees.map((tree) => tree.id)));
      expect(medium.vehicleIds.every((id) => high.vehicleIds.includes(id))).toBe(true);
      expect(silhouette.vehicleIds.every((id) => medium.vehicleIds.includes(id))).toBe(true);
      expect(medium.treeIds.every((id) => high.treeIds.includes(id))).toBe(true);
      expect(silhouette.treeIds.every((id) => medium.treeIds.includes(id))).toBe(true);
      expect(silhouette.helicopterVisible).toBe(false);
    }
  });

  it('matches the declared ratios without changing source plan arrays', () => {
    const plan = generateSandboxCity('environment-ratios', 'shanghai');
    const sourceVehicleIds = plan.vehicles.map((vehicle) => vehicle.id);
    const sourceTreeIds = plan.trees.map((tree) => tree.id);
    const sourceMetrics = cityMetricsAt(plan, 147);

    for (const tier of ['high', 'medium', 'silhouette']) {
      const visibility = createCityEnvironmentVisibility(plan, tier);
      const policy = CITY_ENVIRONMENT_DENSITY[tier];
      expect(visibility.vehicleIds).toHaveLength(Math.round(plan.vehicles.length * policy.vehicleRatio));
      expect(visibility.treeIds).toHaveLength(Math.round(plan.trees.length * policy.treeRatio));
    }
    expect(plan.vehicles.map((vehicle) => vehicle.id)).toEqual(sourceVehicleIds);
    expect(plan.trees.map((tree) => tree.id)).toEqual(sourceTreeIds);
    expect(cityMetricsAt(plan, 147)).toEqual(sourceMetrics);
  });

  it('changes the stable sample when the generation seed changes', () => {
    const first = createCityEnvironmentVisibility(
      generateSandboxCity('environment-seed-a', 'melbourne'),
      'medium',
    );
    const second = createCityEnvironmentVisibility(
      generateSandboxCity('environment-seed-b', 'melbourne'),
      'medium',
    );
    expect(first.vehicleIds).not.toEqual(second.vehicleIds);
    expect(first.treeIds).not.toEqual(second.treeIds);
  });
});
