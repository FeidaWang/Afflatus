import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createCityEnvironmentClock } from '../src/city/environmentClock.ts';
import {
  cityLandmarkLightColor,
  configureAuthoredCityNightLighting,
  getAuthoredCityNightLightState,
  updateAuthoredCityNightLightTime,
} from '../src/scene/cityNightLighting.ts';

describe('authored city night lighting', () => {
  it('never attaches landmark or beacon lighting to an ordinary building envelope', () => {
    const material = new THREE.MeshStandardMaterial();
    material.name = 'buildings-office-v1';
    expect(configureAuthoredCityNightLighting(material, 'shanghai', 'night')).toBeNull();
    expect(getAuthoredCityNightLightState(material)).toBeNull();
    material.dispose();
  });

  it('rejects plural or approximate material prefixes outside the frozen grammar', () => {
    for (const name of ['street-lights-road', 'aviation-lights-tower', 'landmark-lights-crown']) {
      const material = new THREE.MeshStandardMaterial();
      material.name = name;
      expect(configureAuthoredCityNightLighting(material, 'shanghai', 'night')).toBeNull();
      material.dispose();
    }
  });

  it('defines recognizable authored landmark light colours for Shanghai identity assets', () => {
    expect(cityLandmarkLightColor('shanghai', 'landmark-light-oriental-pearl')).toBe(0xff416c);
    expect(cityLandmarkLightColor('shanghai', 'landmark-light-shanghai-tower-crown')).toBe(0xbfe9ff);
    expect(cityLandmarkLightColor('shanghai', 'landmark-light-jin-mao-crown')).toBe(0xffd39a);
    expect(cityLandmarkLightColor('shanghai', 'landmark-light-swfc-crown')).toBe(0xc5e4ff);
    expect(cityLandmarkLightColor('shanghai', 'landmark-light-bund-facade')).toBe(0xffb45a);
  });

  it('pulses only an explicitly authored aviation-light material with a stable phase', () => {
    const material = new THREE.PointsMaterial();
    material.name = 'aviation-light-fixturex';
    const night = createCityEnvironmentClock('melbourne').resolve('night');
    expect(configureAuthoredCityNightLighting(material, 'melbourne', night)).toBe('aviation');
    const first = getAuthoredCityNightLightState(material);
    const shader = {
      uniforms: {},
      vertexShader: '#include <common>',
      fragmentShader: '#include <common>\n#include <color_fragment>',
    };
    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    expect(shader.fragmentShader).toContain('cityAuthoredLightPulse');
    expect(updateAuthoredCityNightLightTime(material, 4.25)).toBe(true);
    expect(shader.uniforms.cityAuthoredLightTime.value).toBe(4.25);
    expect(getAuthoredCityNightLightState(material)).toMatchObject({
      kind: 'aviation',
      seed: first?.seed,
      pulseEnabled: true,
      compiled: true,
      basis: 'authored-light-geometry-only',
    });
    material.dispose();
  });
});
