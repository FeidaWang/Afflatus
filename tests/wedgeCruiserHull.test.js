import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createWedgeCruiserHull } from '../src/scene/wedgeCruiserHull.js';

// Same headless-verification rationale as tests/odinHull.test.js: the hull
// generator is DOM/WebGL-free (only calls the injected `add`/`addInstanced`
// callbacks), so its proportions/mount metadata/instancing counts can be
// checked via a real Box3 + InstancedMesh without a renderer — the one part
// of this shape a no-WebGL sandbox can verify.
function buildForBBox(detail) {
  const group = new THREE.Group();
  const mats = { hull: {}, arm: {}, dark: {}, trim: {}, glass: {}, red: {}, blue: {} };
  const meshes = [];
  let instancedTransformCount = 0;
  let instancedCallCount = 0;

  const add = (geo, mat, t, r, s) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
    if (t) m.position.set(t[0], t[1], t[2]);
    if (r) m.rotation.set(r[0], r[1], r[2]);
    if (s) m.scale.set(s[0], s[1], s[2]);
    group.add(m);
    meshes.push(m);
    return m;
  };

  const addInstanced = (geo, mat, transforms) => {
    const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial(), transforms.length);
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scale = new THREE.Vector3(1, 1, 1);
    const euler = new THREE.Euler(), m4 = new THREE.Matrix4();
    transforms.forEach((tr, i) => {
      pos.set(tr.t[0], tr.t[1], tr.t[2]);
      if (tr.r) { euler.set(tr.r[0], tr.r[1], tr.r[2]); quat.setFromEuler(euler); } else quat.identity();
      if (tr.s) scale.set(tr.s[0], tr.s[1], tr.s[2]); else scale.set(1, 1, 1);
      m4.compose(pos, quat, scale);
      im.setMatrixAt(i, m4);
    });
    im.instanceMatrix.needsUpdate = true;
    group.add(im);
    instancedTransformCount += transforms.length;
    instancedCallCount += 1;
    return im;
  };

  const info = createWedgeCruiserHull(THREE, { add, addInstanced, mats, detail });
  group.updateMatrixWorld(true);
  const box = new THREE.Box3();
  for (const m of meshes) box.expandByObject(m);
  return { info, box, meshCount: meshes.length, meshes, instancedTransformCount, instancedCallCount };
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

  it('exposes 5 engine mounts, 12 dorsal turrets (6 pairs), 2 tower tips, 2 shield mounts, 1 muzzle anchor', () => {
    const { info } = buildForBBox('full');
    expect(info.engineMounts.length).toBe(5);
    expect(info.turretMounts.length).toBe(12);
    expect(info.towerTips.length).toBe(2);
    expect(info.shieldMounts.length).toBe(2);
    expect(info.muzzleAnchor).toBeTruthy();
  });

  it('tower tips are mirrored left/right at the same y and z', () => {
    const { info } = buildForBBox('full');
    const [a, b] = info.towerTips;
    expect(a.x).toBeCloseTo(-b.x, 6);
    expect(a.y).toBeCloseTo(b.y, 6);
    expect(a.z).toBeCloseTo(b.z, 6);
  });

  it('shield mounts are mirrored left/right and sit near the towers (aft deck, not off in open space)', () => {
    const { info } = buildForBBox('full');
    const [a, b] = info.shieldMounts;
    expect(a.x).toBeCloseTo(-b.x, 6);
    expect(a.y).toBeCloseTo(b.y, 6);
    expect(a.z).toBeCloseTo(b.z, 6);
    const towerZ = info.towerTips[0].z;
    expect(Math.abs(a.z - towerZ)).toBeLessThan(2);
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

  it('"wire" has fewer total parts (meshes + instanced transforms) than "full", but the same number of instanced draw calls', () => {
    // Detail level should thin instance DENSITY (fewer transforms per
    // addInstanced call), not add or remove draw calls — that's the whole
    // point of routing repeated greeble through InstancedMesh.
    const wire = buildForBBox('wire');
    const fullD = buildForBBox('full');
    const wireTotal = wire.meshCount + wire.instancedTransformCount;
    const fullTotal = fullD.meshCount + fullD.instancedTransformCount;
    expect(wireTotal).toBeLessThan(fullTotal);
    expect(wire.instancedCallCount).toBe(fullD.instancedCallCount);
    expect(wire.info.length).toBe(fullD.info.length);
  });

  it('uses InstancedMesh for the turret row and hull greeble (a handful of draw calls, not one per part)', () => {
    const { instancedCallCount, instancedTransformCount } = buildForBBox('full');
    expect(instancedCallCount).toBeLessThanOrEqual(6);
    // turrets (12 bodies + 24 barrels) + trench clutter + hull greeble +
    // window lights adds up to well over 100 individual parts, all folded
    // into instancedCallCount draw calls instead of one add() each.
    expect(instancedTransformCount).toBeGreaterThan(100);
  });

  it('never produces NaN/Infinity coordinates', () => {
    const { box } = buildForBBox('full');
    for (const v of [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z]) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('the lofted hull skin (first part added) has consistent outward-facing normals in X/Y', () => {
    const { meshes } = buildForBBox('full');
    const hull = meshes[0];
    const geo = hull.geometry;
    const pos = geo.attributes.position, norm = geo.attributes.normal;
    let checked = 0;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const r = Math.hypot(x, y);
      if (r < 0.05) continue;
      const nx = norm.getX(i), ny = norm.getY(i);
      const outwardDot = (x * nx + y * ny) / r;
      expect(outwardDot).toBeGreaterThanOrEqual(-0.05);
      checked++;
    }
    expect(checked).toBeGreaterThan(20);
  });
});
