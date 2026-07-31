import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  createAfflatusInterceptorPrototype,
  createAfflatusVanguard,
} from '../src/scene/afflatusVanguard.js';

describe('Afflatus Vanguard combat assets', () => {
  it('merges the command ship into a bounded surface-family draw budget', () => {
    const { group } = createAfflatusVanguard(THREE, { detail: 'full', forwardNegativeZ: true });
    const meshes = [];
    group.traverse((child) => { if (child.isMesh) meshes.push(child); });
    expect(meshes.length).toBeGreaterThanOrEqual(6);
    expect(meshes.length).toBeLessThanOrEqual(8);
    expect(group.getObjectByName('Muzzle_Main')).toBeTruthy();
    expect(group.getObjectByName('Muzzle_CIWS_Port')).toBeTruthy();
    expect(group.getObjectByName('Muzzle_CIWS_Starboard')).toBeTruthy();
    expect(group.getObjectByName('MissileBay')).toBeTruthy();
  });

  it('is a low, broad lifting body rather than a cylindrical placeholder', () => {
    const { group } = createAfflatusVanguard(THREE, { detail: 'full' });
    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    expect(size.x).toBeGreaterThan(size.y * 3);
    expect(size.z).toBeGreaterThan(size.y * 4.5);
    expect(size.x / size.z).toBeGreaterThan(0.6);
  });

  it('builds a volumetric six-surface-family interceptor with shared clone buffers', () => {
    const { group } = createAfflatusInterceptorPrototype(THREE);
    const meshes = group.children.filter((child) => child.isMesh);
    expect(meshes).toHaveLength(6);
    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    expect(size.y).toBeGreaterThan(0.8);
    expect(size.x).toBeGreaterThan(6);
    expect(size.z).toBeGreaterThan(7);
    const clone = group.clone(true);
    expect(clone.children[0].geometry).toBe(group.children[0].geometry);
  });
});
