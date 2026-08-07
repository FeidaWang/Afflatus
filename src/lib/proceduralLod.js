/**
 * Shared three-tier contract for procedural Three.js assets.
 *
 * Selection is based on projected screen diameter, never raw camera distance:
 * the same ship therefore keeps the same detail when viewport/FOV/scale change.
 * Hysteresis prevents a model near a boundary from swapping every frame, while
 * the renderer quality tier acts only as a maximum-detail ceiling.
 */
export const PROCEDURAL_LOD_TIERS = Object.freeze(['high', 'medium', 'silhouette']);

export const PROCEDURAL_LOD_THRESHOLDS = Object.freeze({
  high: 180,
  medium: 64,
  hysteresis: 0.15,
});

const QUALITY_DETAIL_FLOOR = Object.freeze({
  high: 0,
  balanced: 1,
  low: 2,
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function projectedDiameterPx({
  radius,
  distance,
  verticalFovDegrees,
  viewportHeight,
} = {}) {
  const r = Math.max(0, Number(radius) || 0);
  const d = Math.max(0.0001, Number(distance) || 0.0001);
  const height = Math.max(1, Number(viewportHeight) || 1);
  const fov = clamp(Number(verticalFovDegrees) || 50, 1, 179) * Math.PI / 180;
  return (r * height) / (d * Math.tan(fov / 2));
}

function rawTierIndex(projectedPixels, thresholds) {
  if (projectedPixels >= thresholds.high) return 0;
  if (projectedPixels >= thresholds.medium) return 1;
  return 2;
}

/**
 * Return high | medium | silhouette for a projected diameter in CSS pixels.
 * `previousTier` is optional on first selection. Unknown quality values use the
 * balanced ceiling, which is the coordinator's conservative default too.
 */
export function selectProceduralLod({
  projectedPixels = 0,
  previousTier,
  qualityTier = 'balanced',
  thresholds = PROCEDURAL_LOD_THRESHOLDS,
} = {}) {
  const pixels = Math.max(0, Number(projectedPixels) || 0);
  const hysteresis = clamp(Number(thresholds.hysteresis) || 0, 0, 0.45);
  const previousIndex = PROCEDURAL_LOD_TIERS.indexOf(previousTier);
  let selected = rawTierIndex(pixels, thresholds);

  if (previousIndex === 0 && pixels >= thresholds.high * (1 - hysteresis)) {
    selected = 0;
  } else if (previousIndex === 1) {
    if (pixels < thresholds.medium * (1 - hysteresis)) selected = 2;
    else if (pixels < thresholds.high * (1 + hysteresis)) selected = 1;
  } else if (previousIndex === 2 && pixels < thresholds.medium * (1 + hysteresis)) {
    selected = 2;
  }

  const qualityFloor = QUALITY_DETAIL_FLOOR[qualityTier] ?? QUALITY_DETAIL_FLOOR.balanced;
  return PROCEDURAL_LOD_TIERS[Math.max(selected, qualityFloor)];
}

/** Set exactly one object visible and return the selected tier. */
export function applyProceduralLod(levels, tier) {
  const selected = PROCEDURAL_LOD_TIERS.includes(tier) ? tier : 'silhouette';
  for (const name of PROCEDURAL_LOD_TIERS) {
    if (levels[name]) levels[name].visible = name === selected;
  }
  return selected;
}

/**
 * Development/acceptance diagnostic for cloned procedural assets. A healthy
 * fleet has many mesh instances but far fewer unique geometry/material objects.
 */
export function analyzeProceduralResourceSharing(roots = []) {
  const geometries = new Set();
  const materials = new Set();
  let meshInstances = 0;
  for (const root of roots) {
    root?.traverse?.((object) => {
      if (!object.isMesh && !object.isPoints && !object.isLine) return;
      meshInstances += 1;
      if (object.geometry) geometries.add(object.geometry);
      const list = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of list) if (material) materials.add(material);
    });
  }
  return Object.freeze({
    meshInstances,
    uniqueGeometries: geometries.size,
    uniqueMaterials: materials.size,
    geometryReuseRatio: geometries.size ? meshInstances / geometries.size : 0,
    materialReuseRatio: materials.size ? meshInstances / materials.size : 0,
  });
}
