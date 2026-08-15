import { fnv1aHash } from '../bootengine/seed';
import type { CityPlan } from './model';

export type CityEnvironmentTier = 'high' | 'medium' | 'silhouette';

export interface CityEnvironmentDensityPolicy {
  vehicleRatio: number;
  treeRatio: number;
  helicopterVisible: boolean;
}

export interface CityEnvironmentVisibility {
  tier: CityEnvironmentTier;
  policy: Readonly<CityEnvironmentDensityPolicy>;
  vehicleIds: readonly string[];
  treeIds: readonly string[];
  helicopterVisible: boolean;
}

export const CITY_ENVIRONMENT_DENSITY: Readonly<Record<CityEnvironmentTier, Readonly<CityEnvironmentDensityPolicy>>> = Object.freeze({
  high: Object.freeze({ vehicleRatio: 1, treeRatio: 1, helicopterVisible: true }),
  medium: Object.freeze({ vehicleRatio: 0.62, treeRatio: 0.72, helicopterVisible: true }),
  silhouette: Object.freeze({ vehicleRatio: 0.22, treeRatio: 0.38, helicopterVisible: false }),
});

function stablePrefix(
  seed: string,
  kind: 'vehicle' | 'tree',
  ids: readonly string[],
  ratio: number,
): readonly string[] {
  const count = Math.max(0, Math.min(ids.length, Math.round(ids.length * ratio)));
  return Object.freeze([...ids]
    .sort((left, right) => (
      fnv1aHash(`${seed}:environment:${kind}:${left}`)
      - fnv1aHash(`${seed}:environment:${kind}:${right}`)
      || left.localeCompare(right)
    ))
    .slice(0, count));
}

/** Render-only sampling; metrics continue to use the complete CityPlan. */
export function createCityEnvironmentVisibility(
  plan: CityPlan,
  tier: CityEnvironmentTier,
): Readonly<CityEnvironmentVisibility> {
  const policy = CITY_ENVIRONMENT_DENSITY[tier];
  return Object.freeze({
    tier,
    policy,
    vehicleIds: stablePrefix(plan.seed, 'vehicle', plan.vehicles.map((vehicle) => vehicle.id), policy.vehicleRatio),
    treeIds: stablePrefix(plan.seed, 'tree', plan.trees.map((tree) => tree.id), policy.treeRatio),
    helicopterVisible: policy.helicopterVisible,
  });
}
