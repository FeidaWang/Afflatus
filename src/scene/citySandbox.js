// Compatibility bridge for historical imports. New production code imports
// cityScene.js and passes a source-neutral renderPlan.
import {
  createCitySceneAssetInventory,
  createCitySceneRenderer,
} from './cityScene.js';

export { createCitySceneAssetInventory, createCitySceneRenderer };

export function createCitySandbox(options = {}) {
  const { plan, renderPlan = plan, ...rest } = options;
  return createCitySceneRenderer({ ...rest, renderPlan });
}
