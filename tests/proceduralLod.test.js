import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  analyzeProceduralResourceSharing,
  applyProceduralLod,
  PROCEDURAL_LOD_TIERS,
  projectedDiameterPx,
  selectProceduralLod,
} from '../src/lib/proceduralLod.js';

describe('procedural three-tier LOD contract', () => {
  it('uses projected screen diameter, including viewport and FOV', () => {
    const baseline = projectedDiameterPx({ radius: 2, distance: 20, verticalFovDegrees: 50, viewportHeight: 800 });
    const taller = projectedDiameterPx({ radius: 2, distance: 20, verticalFovDegrees: 50, viewportHeight: 1200 });
    const widerFov = projectedDiameterPx({ radius: 2, distance: 20, verticalFovDegrees: 80, viewportHeight: 800 });
    expect(taller).toBeCloseTo(baseline * 1.5, 6);
    expect(widerFov).toBeLessThan(baseline);
  });

  it('selects all three levels and caps detail by renderer quality', () => {
    expect(selectProceduralLod({ projectedPixels: 260, qualityTier: 'high' })).toBe('high');
    expect(selectProceduralLod({ projectedPixels: 120, qualityTier: 'high' })).toBe('medium');
    expect(selectProceduralLod({ projectedPixels: 30, qualityTier: 'high' })).toBe('silhouette');
    expect(selectProceduralLod({ projectedPixels: 260, qualityTier: 'balanced' })).toBe('medium');
    expect(selectProceduralLod({ projectedPixels: 260, qualityTier: 'low' })).toBe('silhouette');
  });

  it('holds the previous level inside both hysteresis bands', () => {
    expect(selectProceduralLod({ projectedPixels: 165, previousTier: 'high', qualityTier: 'high' })).toBe('high');
    expect(selectProceduralLod({ projectedPixels: 190, previousTier: 'medium', qualityTier: 'high' })).toBe('medium');
    expect(selectProceduralLod({ projectedPixels: 68, previousTier: 'silhouette', qualityTier: 'high' })).toBe('silhouette');
    expect(selectProceduralLod({ projectedPixels: 210, previousTier: 'medium', qualityTier: 'high' })).toBe('high');
  });

  it('keeps exactly one tier visible', () => {
    const levels = Object.fromEntries(PROCEDURAL_LOD_TIERS.map((tier) => [tier, { visible: true }]));
    applyProceduralLod(levels, 'medium');
    expect(Object.fromEntries(PROCEDURAL_LOD_TIERS.map((tier) => [tier, levels[tier].visible]))).toEqual({
      high: false,
      medium: true,
      silhouette: false,
    });
  });

  it('reports shared clone geometry and materials as an acceptance gate', () => {
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial();
    const prototype = new THREE.Group();
    prototype.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material));
    const roots = [prototype.clone(true), prototype.clone(true), prototype.clone(true)];
    const result = analyzeProceduralResourceSharing(roots);
    expect(result.meshInstances).toBe(6);
    expect(result.uniqueGeometries).toBe(1);
    expect(result.uniqueMaterials).toBe(1);
    expect(result.geometryReuseRatio).toBe(6);
  });
});
