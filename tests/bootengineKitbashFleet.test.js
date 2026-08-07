import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { computeFormation, createKitbashFleet } from '../src/bootengine/render/kitbashFleet';
import { createRng } from '../src/bootengine/seed';

const finite = (v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z) && Number.isFinite(v.yaw);

describe('computeFormation', () => {
  it('returns exactly escortCount slots, all finite', () => {
    const slots = computeFormation(createRng(42), 6);
    expect(slots.length).toBe(6);
    for (const s of slots) expect(finite(s)).toBe(true);
  });

  it('same seed -> identical formation (golden-set determinism, P1 convention)', () => {
    const a = computeFormation(createRng(1234), 5);
    const b = computeFormation(createRng(1234), 5);
    expect(a).toEqual(b);
  });

  it('different seeds produce different formations', () => {
    const a = computeFormation(createRng(1), 5);
    const b = computeFormation(createRng(2), 5);
    expect(a).not.toEqual(b);
  });

  it('alternates sides (even index right, odd index left) so escorts flank both sides', () => {
    const slots = computeFormation(createRng(7), 4);
    expect(slots[0].x).toBeGreaterThan(0);
    expect(slots[1].x).toBeLessThan(0);
    expect(slots[2].x).toBeGreaterThan(0);
    expect(slots[3].x).toBeLessThan(0);
  });

  it('every slot trails behind the formation origin (negative z), matching the +Z-forward heading', () => {
    const slots = computeFormation(createRng(99), 6);
    for (const s of slots) expect(s.z).toBeLessThan(0);
  });

  it('escortCount=0 returns an empty array without throwing', () => {
    expect(computeFormation(createRng(1), 0)).toEqual([]);
  });
});

describe('kitbash fleet procedural LOD + pooling', () => {
  it('builds three explicit levels per ship and shares clone resources', () => {
    const fleet = createKitbashFleet({ rng: createRng(42), escortCount: 2 });
    const ships = fleet.group.children;
    expect(ships).toHaveLength(3);
    for (const ship of ships) {
      expect(ship.getObjectByName('LOD_HIGH')).toBeTruthy();
      expect(ship.getObjectByName('LOD_MEDIUM')).toBeTruthy();
      expect(ship.getObjectByName('LOD_SILHOUETTE')).toBeTruthy();
    }
    const firstHull = ships[0].getObjectByName('LOD_HIGH').children.find((child) => child.isMesh);
    const secondHull = ships[1].getObjectByName('LOD_HIGH').children.find((child) => child.isMesh);
    expect(secondHull.geometry).toBe(firstHull.geometry);
    expect(secondHull.material).toBe(firstHull.material);

    const diagnostics = fleet.getLodDiagnostics();
    expect(diagnostics.meshInstances).toBeGreaterThan(diagnostics.uniqueGeometries * 2);
    expect(diagnostics.meshInstances).toBeGreaterThan(diagnostics.uniqueMaterials * 2);
  });

  it('uses renderer quality as a hard ceiling across the whole fleet', () => {
    const fleet = createKitbashFleet({ rng: createRng(7), escortCount: 3 });
    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 220);
    camera.position.set(20, 13, 27);
    fleet.updateLod(camera, 900, 'low');
    expect(fleet.getLodDiagnostics().tiers).toEqual({ high: 0, medium: 0, silhouette: 4 });
  });
});
