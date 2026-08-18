import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  collectCityWaterSurfaceMaterials,
  configureCityWaterSurface,
  getCityWaterSurfaceState,
  updateCityWaterSurfaceTime,
} from '../src/scene/cityWaterSurface.ts';

describe('city PBR water surface', () => {
  it('adds deterministic moving specular breakup to a dielectric PBR material', () => {
    const material = new THREE.MeshStandardMaterial({
      roughness: 0.18,
      metalness: 0,
    });
    material.name = 'water-huangpu-v1';
    expect(configureCityWaterSurface(material, {
      reflectionIntensity: 1.25,
      rippleStrength: 0.12,
      rippleScale: 0.045,
      flowSpeed: 0.7,
      flowDirection: { x: 0.35, z: -0.94 },
    })).toBe(true);
    expect(material.envMapIntensity).toBe(1.25);
    expect(getCityWaterSurfaceState(material)).toMatchObject({
      reflectionIntensity: 1.25,
      rippleStrength: 0.12,
      compiled: false,
    });

    const shader = {
      uniforms: {},
      vertexShader: '#include <common>\n#include <begin_vertex>',
      fragmentShader: '#include <common>\n#include <roughnessmap_fragment>',
    };
    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    expect(shader.fragmentShader).toContain('roughnessFactor + cityWaterRipple');
    expect(shader.fragmentShader).toContain('cityWaterTime * cityWaterFlowSpeed');
    expect(shader.fragmentShader).toContain('dot(vCityWaterPosition.xz, cityWaterDirection)');
    expect(updateCityWaterSurfaceTime(material, 12.5)).toBe(true);
    expect(shader.uniforms.cityWaterTime.value).toBe(12.5);
    expect(getCityWaterSurfaceState(material)).toMatchObject({
      timeSeconds: 12.5,
      compiled: true,
    });

    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material));
    expect(collectCityWaterSurfaceMaterials(root)).toEqual([material]);
    root.children[0].geometry.dispose();
    material.dispose();
  });

  it('does not attach water behavior to non-PBR materials', () => {
    expect(configureCityWaterSurface(
      new THREE.MeshBasicMaterial(),
      {
        reflectionIntensity: 1,
        rippleStrength: 0.1,
        rippleScale: 0.04,
        flowSpeed: 0.5,
        flowDirection: { x: 1, z: 0 },
      },
    )).toBe(false);
  });
});
