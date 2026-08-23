import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  CINEMATIC_LIGHT_MATRIX,
  createCinematicLighting,
  markSelectiveBloomObjects,
  POST_PROCESSING_MATRIX,
  SELECTIVE_BLOOM_LAYER,
} from '../src/showcase/experience/cinematicPipeline.js';
import { createCarrierProxy } from '../src/showcase/experience/createCarrierProxy.js';

const pipelineSource = readFileSync('src/showcase/experience/cinematicPipeline.js', 'utf8');
const sceneSource = readFileSync('src/showcase/experience/SignatureScene.jsx', 'utf8');

describe('M10 restrained cinematic pipeline', () => {
  it('keeps ACES in the renderer and post-processing profile-gated', () => {
    expect(sceneSource).toContain('THREE.ACESFilmicToneMapping');
    expect(POST_PROCESSING_MATRIX.high.selectiveBloom).toBe(true);
    expect(POST_PROCESSING_MATRIX.medium.selectiveBloom).toBe(false);
    expect(POST_PROCESSING_MATRIX.mobile.selectiveBloom).toBe(false);
    expect(POST_PROCESSING_MATRIX.high.strength).toBeLessThan(0.6);
  });

  it('defines one cold rim, one weak warm reflection and bounded engine points', () => {
    const scene = new THREE.Scene();
    const carrier = createCarrierProxy(THREE, 'high');
    scene.add(carrier.group);
    const lighting = createCinematicLighting(THREE, { carrier, profile: 'high', scene });
    expect(lighting.group.getObjectByName('PrimaryColdRim')).toBeTruthy();
    expect(lighting.group.getObjectByName('WeakWarmCelestialReflection')).toBeTruthy();
    expect(lighting.engineLights).toHaveLength(2);
    expect(CINEMATIC_LIGHT_MATRIX.high.warm).toBeLessThan(CINEMATIC_LIGHT_MATRIX.high.cold / 8);
    lighting.update(0.2);
    const beforeWake = lighting.engineLights[0].intensity;
    lighting.update(0.84);
    expect(lighting.engineLights[0].intensity).toBeGreaterThan(beforeWake);
  });

  it('marks only named engine and navigation surfaces for bloom', () => {
    const carrier = createCarrierProxy(THREE, 'high');
    const marked = markSelectiveBloomObjects(carrier.group);
    expect(marked).toBeGreaterThanOrEqual(2);
    const bloomNames = [];
    carrier.group.traverse((object) => {
      if (object.layers?.isEnabled(SELECTIVE_BLOOM_LAYER)) bloomNames.push(object.name);
    });
    expect(bloomNames).toEqual(expect.arrayContaining(['DriveGlow', 'DeckSignals']));
    expect(bloomNames).not.toContain('CommandHull');
    expect(bloomNames).not.toContain('ArmorPlates');
  });

  it('composites bloom inside WebGL without touching DOM text', () => {
    expect(pipelineSource).toContain("camera.layers.set(SELECTIVE_BLOOM_LAYER)");
    expect(pipelineSource).toContain('base.rgb + bloom.rgb');
    expect(pipelineSource).not.toMatch(/document|querySelector|classList/);
    expect(sceneSource).toContain('postProcessing.render()');
  });
});
