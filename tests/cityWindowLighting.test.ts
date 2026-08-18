import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  configureCityWindowLighting,
  getCityWindowLightingState,
} from '../src/scene/cityWindowLighting.ts';

describe('deterministic city window lighting', () => {
  it('installs one stable façade-window shader without whole-envelope emission', () => {
    const material = new THREE.MeshStandardMaterial({ emissive: 0x000000 });
    material.name = 'buildings-office-v1';
    expect(configureCityWindowLighting(material, { color: 0xffc982, intensity: 1.45 })).toBe(true);
    const first = getCityWindowLightingState(material);
    expect(first).toMatchObject({ color: 0xffc982, intensity: 1.45, compiled: false });
    expect(material.emissive.getHex()).toBe(0x000000);

    const shader = {
      uniforms: {},
      vertexShader: '#include <common>\n#include <begin_vertex>',
      fragmentShader: '#include <common>\n#include <emissivemap_fragment>',
    };
    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    expect(shader.fragmentShader).toContain('cityPane * cityOccupied');
    expect(shader.fragmentShader).toContain('1.0 - step(0.58, abs(normal.y))');
    expect(getCityWindowLightingState(material)).toMatchObject({
      seed: first?.seed,
      compiled: true,
    });

    configureCityWindowLighting(material, { color: 0xffd7a0, intensity: 0 });
    expect(shader.uniforms.cityWindowIntensity.value).toBe(0);
    expect(getCityWindowLightingState(material)?.seed).toBe(first?.seed);
    material.dispose();
  });

  it('does not attach the window shader to line or basic materials', () => {
    expect(configureCityWindowLighting(
      new THREE.LineBasicMaterial(),
      { color: 0xffffff, intensity: 1 },
    )).toBe(false);
  });
});
