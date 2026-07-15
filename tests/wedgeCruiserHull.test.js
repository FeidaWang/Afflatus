import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createWedgeCruiserHull } from '../src/scene/wedgeCruiserHull.js';

// Same headless-verification rationale as tests/odinHull.test.js: the hull
// generator is DOM/WebGL-free (only calls the injected `add` callback), so
// its proportions/mount metadata can be checked via a real Box3 without a
// renderer — the one part of this shape a no-WebGL sandbox can verify.
function buildForBBox(detail) {
  const group = new THREE.Group();
  const mats = { hull: {}, arm: {}, dark: {}, trim: {}, glass: {}, red: {}, blue: {} };
  const meshes = [];
  const add = (geo, mat, t, r, s) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
    if (t) m.position.set(t[0], t[1], t[2]);
    if (r) m.rotation.set(r[0], r[1], r[2]);
    if (s) m.scale.set(s[0], s[1], s[2]);
    group.add(m);
    meshes.push(m);
    return m;
  };
  const info = createWedgeCruiserHull(THREE, { add, mats, detail });
  group.updateMatrixWorld(true);
  const box = new THREE.Box3();
  for (const m of meshes) box.expandByObject(m);
  return { info, box, meshCount: meshes.length, meshes };
}

describe('createWedgeCruiserHull — silhouette + mount metadata', () => {
  it('is long, flat, and broad — width and length both exceed height by a wide margin (a wedge deck, not a slender blade)', () => {
    const { info } = buildForBBox('full');
    expect(info.length).toBeGreaterThan(info.width);
    expect(info.width / info.height).toBeGreaterThan(2.5);
    expect(info.length / info.height).toBeGreaterThan(5);
  });

  it('the actual rendered bounding box spans roughly the declared length along Z', () => {
    const { info, box } = buildForBBox('full');
    const spanZ = box.max.z - box.min.z;
    expect(spanZ).toBeGreaterThanOrEqual(info.length * 0.9);
    expect(spanZ).toBeLessThanOrEqual(info.length * 1.3);
  });

  it('exposes 5 engine mounts, 12 dorsal turrets (6 pairs), 2 tower tips, 1 muzzle anchor', () => {
    const { info } = buildForBBox('full');
    expect(info.engineMounts.length).toBe(5);
    expect(info.turretMounts.length).toBe(12);
    expect(info.towerTips.length).toBe(2);
    expect(info.muzzleAnchor).toBeTruthy();
  });

  it('tower tips are mirrored left/right at the same y and z', () => {
    const { info } = buildForBBox('full');
    const [a, b] = info.towerTips;
    expect(a.x).toBeCloseTo(-b.x, 6);
    expect(a.y).toBeCloseTo(b.y, 6);
    expect(a.z).toBeCloseTo(b.z, 6);
  });

  it('engine mounts sit at the stern (negative Z, past the turret row)', () => {
    const { info } = buildForBBox('full');
    const turretMinZ = Math.min(...info.turretMounts.map((t) => t.z));
    for (const em of info.engineMounts) expect(em.z).toBeLessThan(turretMinZ);
  });

  it('the muzzle anchor sits forward of the whole turret row (bow-forward fire)', () => {
    const { info } = buildForBBox('full');
    const turretMaxZ = Math.max(...info.turretMounts.map((t) => t.z));
    expect(info.muzzleAnchor.z).toBeGreaterThan(turretMaxZ);
  });

  it('"wire" has fewer parts than "full" but keeps the same declared silhouette metadata', () => {
    const wire = buildForBBox('wire');
    const fullD = buildForBBox('full');
    expect(wire.meshCount).toBeLessThan(fullD.meshCount);
    expect(wire.info.length).toBe(fullD.info.length);
    expect(wire.info.engineMounts.length).toBe(fullD.info.engineMounts.length);
    expect(wire.info.turretMounts.length).toBe(fullD.info.turretMounts.length);
  });

  it('never produces NaN/Infinity coordinates', () => {
    const { box } = buildForBBox('full');
    for (const v of [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z]) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('the lofted hull skin (first part added) has consistent outward-facing normals in X/Y', () => {
    // Same winding-verification rationale as odinHull.test.js's equivalent
    // check: a hand-built BufferGeometry can easily end up with backwards
    // triangle winding, which would shade the hull as if lit from inside.
    const { meshes } = buildForBBox('full');
    const hull = meshes[0];
    const geo = hull.geometry;
    const pos = geo.attributes.position, norm = geo.attributes.normal;
    let checked = 0;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const r = Math.hypot(x, y);
      if (r < 0.05) continue; // skip near-axis vertices (nose tip / stern-cap center)
      const nx = norm.getX(i), ny = norm.getY(i);
      const outwardDot = (x * nx + y * ny) / r;
      expect(outwardDot).toBeGreaterThanOrEqual(-0.05);
      checked++;
    }
    expect(checked).toBeGreaterThan(20);
  });
});
