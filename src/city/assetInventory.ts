import { createCityCranePlans } from './cranes';
import { createCityFacadePlan } from './facades';
import { createCityLeisurePlan } from './leisure';
import { createCityRooftopPlan } from './rooftops';
import type { CityAssetCategoryKey } from './assetVisibility';
import type { CityPlan } from './model';

export type CityAssetInventory = Readonly<Record<CityAssetCategoryKey, number>>;

/** Derived once with the lazy Three scene so detailed asset planning stays off the shell path. */
export function createCityAssetInventory(plan: CityPlan): CityAssetInventory {
  const facades = createCityFacadePlan(plan.buildings);
  const leisure = createCityLeisurePlan(plan);
  const rooftops = createCityRooftopPlan(plan.buildings);
  return Object.freeze({
    structures: plan.buildings.length + plan.heroLandmarks.length + rooftops.assets.length,
    facades: facades.strips.length + facades.balconies.length,
    infrastructure: plan.roads.length + plan.water.length,
    landscape: plan.trees.length + leisure.assets.length,
    mobility: plan.vehicles.length + 1,
    cranes: createCityCranePlans(plan).length,
  });
}
