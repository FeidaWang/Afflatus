import type { Object3D } from 'three';

export type ProceduralLodTier = 'high' | 'medium' | 'silhouette';
export type RenderQualityTier = 'low' | 'balanced' | 'high';

export const PROCEDURAL_LOD_TIERS: readonly ProceduralLodTier[];
export const PROCEDURAL_LOD_THRESHOLDS: Readonly<{
  high: number;
  medium: number;
  hysteresis: number;
}>;

export function projectedDiameterPx(options: {
  radius: number;
  distance: number;
  verticalFovDegrees: number;
  viewportHeight: number;
}): number;

export function selectProceduralLod(options: {
  projectedPixels?: number;
  previousTier?: ProceduralLodTier;
  qualityTier?: RenderQualityTier;
  thresholds?: typeof PROCEDURAL_LOD_THRESHOLDS;
}): ProceduralLodTier;

export function applyProceduralLod(
  levels: Partial<Record<ProceduralLodTier, { visible: boolean }>>,
  tier: ProceduralLodTier,
): ProceduralLodTier;

export function analyzeProceduralResourceSharing(roots?: Object3D[]): Readonly<{
  meshInstances: number;
  uniqueGeometries: number;
  uniqueMaterials: number;
  geometryReuseRatio: number;
  materialReuseRatio: number;
}>;
