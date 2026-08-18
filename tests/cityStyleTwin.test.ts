import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { MELBOURNE_ENVIRONMENT_CLOCK } from '../src/city/environmentClock.ts';
import {
  CITY_STYLE_TWINS,
  applyCityStyleTwin,
  cityStyleTwinForEnvironment,
  cityStyleTwinForSnapshot,
} from '../src/scene/cityStyleTwin.ts';

describe('Melbourne city style twin', () => {
  it('defines four immutable styles and keeps Analysis on fixed neutral light', () => {
    expect(Object.keys(CITY_STYLE_TWINS)).toEqual(['analysis', 'day', 'sunset', 'night']);
    expect(cityStyleTwinForEnvironment('analysis')).toMatchObject({
      id: 'melbourne-analysis-v1',
      environment: 'analysis',
      sun: { followsEnvironmentClock: false },
    });
    expect(cityStyleTwinForEnvironment('night')).toMatchObject({
      id: 'melbourne-night-v1',
      environment: 'night',
      sun: { followsEnvironmentClock: true },
    });
    expect(Object.isFrozen(CITY_STYLE_TWINS.night.materials)).toBe(true);
  });

  it('mutates owned materials in place and restores their exact Analysis baseline', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const building = new THREE.MeshStandardMaterial({
      color: 0xcbd0cb,
      emissive: 0x050607,
      emissiveIntensity: 0.07,
      roughness: 0.91,
      metalness: 0.01,
    });
    building.name = 'buildings-analysis';
    const unknown = new THREE.MeshStandardMaterial({ color: 0xabcdef });
    unknown.name = 'candidate-private-role';
    const buildingDispose = vi.spyOn(building, 'dispose');
    const unknownDispose = vi.spyOn(unknown, 'dispose');
    const root = new THREE.Group();
    root.add(new THREE.Mesh(geometry, building), new THREE.Mesh(geometry, unknown));
    const original = Object.freeze({
      color: building.color.clone(),
      emissive: building.emissive.clone(),
      emissiveIntensity: building.emissiveIntensity,
      roughness: building.roughness,
      metalness: building.metalness,
      unknownColor: unknown.color.clone(),
    });

    const night = applyCityStyleTwin(root, MELBOURNE_ENVIRONMENT_CLOCK.resolve('night'));
    expect(night).toEqual({
      styleId: 'melbourne-night-v1',
      materialCount: 2,
      windowLightingMaterials: 1,
      physicalWaterMaterials: 0,
      authoredNightLightMaterials: 0,
      streetLightMaterials: 0,
      aviationLightMaterials: 0,
      landmarkLightMaterials: 0,
      roles: ['buildings', 'other'],
    });
    expect(root.children[0].material).toBe(building);
    expect(building.emissive.getHex()).toBe(0x000000);
    expect(building.emissiveIntensity).toBe(0);
    expect(unknown.color.equals(original.unknownColor)).toBe(true);

    applyCityStyleTwin(root, MELBOURNE_ENVIRONMENT_CLOCK.resolve('analysis'));
    expect(building.color.equals(original.color)).toBe(true);
    expect(building.emissive.equals(original.emissive)).toBe(true);
    expect(building.emissiveIntensity).toBe(original.emissiveIntensity);
    expect(building.roughness).toBe(original.roughness);
    expect(building.metalness).toBe(original.metalness);
    expect(buildingDispose).not.toHaveBeenCalled();
    expect(unknownDispose).not.toHaveBeenCalled();

    geometry.dispose();
    building.dispose();
    unknown.dispose();
  });

  it('de-duplicates shared material identities during a switch', () => {
    const shared = new THREE.LineBasicMaterial({ color: 0x222222 });
    shared.name = 'roads-analysis';
    const root = new THREE.Group();
    root.add(
      new THREE.LineSegments(new THREE.BufferGeometry(), shared),
      new THREE.LineSegments(new THREE.BufferGeometry(), shared),
    );
    expect(applyCityStyleTwin(root, 'sunset').materialCount).toBe(1);
  });

  it('reports city-specific style identity while sharing the renderer contract', () => {
    expect(cityStyleTwinForEnvironment('night', 'shanghai').id).toBe('shanghai-night-v1');
    expect(cityStyleTwinForEnvironment('sunset', 'hong-kong').id).toBe('hong-kong-sunset-v1');
    expect(cityStyleTwinForEnvironment('day', 'melbourne').id).toBe('melbourne-day-v1');
  });

  it('blends light, IBL, water and window values continuously across solar boundaries', () => {
    const base = MELBOURNE_ENVIRONMENT_CLOCK.resolve('day');
    const snapshotAt = (altitudeDegrees: number) => ({
      ...base,
      environment: 'day' as const,
      sun: { ...base.sun, altitudeDegrees },
    });
    const before = cityStyleTwinForSnapshot(snapshotAt(7.999));
    const after = cityStyleTwinForSnapshot(snapshotAt(8));
    expect(Math.abs(after.exposure - before.exposure)).toBeLessThan(0.001);
    expect(Math.abs(after.iblIntensity - before.iblIntensity)).toBeLessThan(0.001);
    expect(Math.abs(
      after.waterSurface.reflectionIntensity - before.waterSurface.reflectionIntensity,
    )).toBeLessThan(0.001);
    expect(cityStyleTwinForSnapshot(snapshotAt(0)).windowLighting.intensity).toBeGreaterThan(0);
    expect(cityStyleTwinForSnapshot(snapshotAt(30)).windowLighting.intensity).toBe(0);
  });
});
