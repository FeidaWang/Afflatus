import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  createSpaceLayers,
  SCALE_REFERENCE_KINDS,
  SPACE_LAYER_IDS,
  SPACE_LAYER_PROFILE_MATRIX,
} from '../src/showcase/experience/spaceLayers.js';

const sceneSource = readFileSync('src/showcase/experience/SignatureScene.jsx', 'utf8');
const layerSource = readFileSync('src/showcase/experience/spaceLayers.js', 'utf8');

function buildLayers(profile) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  scene.add(camera);
  return { camera, layers: createSpaceLayers(THREE, { camera, profile, scene }), scene };
}

describe('M09 five-layer monumental scale system', () => {
  it('declares all five independently named depth layers', () => {
    expect(SPACE_LAYER_IDS).toEqual([
      'deep-stars',
      'distant-environment',
      'midfield-dust',
      'near-field-scale-references',
      'carrier',
    ]);
  });

  it('degrades stars, dust and instanced references by profile', () => {
    expect(SPACE_LAYER_PROFILE_MATRIX.high.deepStars).toBeGreaterThan(SPACE_LAYER_PROFILE_MATRIX.medium.deepStars);
    expect(SPACE_LAYER_PROFILE_MATRIX.medium.deepStars).toBeGreaterThan(SPACE_LAYER_PROFILE_MATRIX.mobile.deepStars);
    expect(SPACE_LAYER_PROFILE_MATRIX.high.dust).toBeGreaterThan(SPACE_LAYER_PROFILE_MATRIX.mobile.dust);
    expect(SPACE_LAYER_PROFILE_MATRIX.high.windows).toBeGreaterThan(SPACE_LAYER_PROFILE_MATRIX.mobile.windows);
    for (const profile of Object.values(SPACE_LAYER_PROFILE_MATRIX)) {
      expect(profile.distantEnvironment).toBe(true);
      expect(Object.isFrozen(profile)).toBe(true);
    }
  });

  it('uses four visible reference classes and instancing for repeated objects', () => {
    const { layers, scene } = buildLayers('high');
    expect(layers.diagnostics.scaleReferenceKinds).toEqual(SCALE_REFERENCE_KINDS);
    expect(layers.diagnostics.scaleReferenceKinds).toHaveLength(4);
    expect(layers.diagnostics.instancedReferenceCount).toBeGreaterThan(40);
    expect(layers.diagnostics.majorDistantBodies).toBe(1);
    const instances = [];
    scene.traverse((object) => { if (object.isInstancedMesh) instances.push(object); });
    expect(instances.map(({ name }) => name)).toEqual(expect.arrayContaining([
      'ScaleRef_InstancedHullWindows',
      'ScaleRef_InstancedEscortCraft',
      'ScaleRef_InstancedMaintenanceDrones',
    ]));
  });

  it('reveals one distant anchor late and dust only around the wake', () => {
    const { layers } = buildLayers('medium');
    const opening = layers.update({ progress: 0.2 }, { now: 100 });
    const aperture = layers.update({ progress: 0.58 }, { now: 200 });
    const wake = layers.update({ progress: 0.76 }, { now: 300 });
    const departure = layers.update({ progress: 1 }, { now: 400 });
    expect(opening.environmentOpacity).toBe(0);
    expect(aperture.environmentOpacity).toBeGreaterThan(0);
    expect(departure.environmentOpacity).toBe(0);
    expect(opening.dustOpacity).toBe(0);
    expect(wake.dustOpacity).toBeGreaterThan(0);
    expect(layers.update({ progress: 0.76 }, { dustEnabled: false, now: 500 }).dustOpacity).toBe(0);
  });

  it('links active system and short interaction pulses without adding a RAF', () => {
    const { layers } = buildLayers('high');
    const capital = layers.update({ progress: 0.3 }, { now: 0 });
    const intelligence = layers.update({ progress: 0.48 }, { now: 0 });
    layers.pulse('system:software', 100);
    const pulsed = layers.update({ progress: 0.38 }, { now: 200 });
    expect(capital.activeScaleReference).toBe('hull-windows');
    expect(intelligence.activeScaleReference).toBe('escort-craft');
    expect(pulsed.activeScaleReference).toBe('hangar-aperture');
    expect(layerSource).not.toContain('requestAnimationFrame');
    expect(sceneSource).toContain('spaceLayers.update(flight');
    expect(sceneSource).not.toMatch(/carrier\.group\.scale\.(?:set|setScalar)/);
  });
});
