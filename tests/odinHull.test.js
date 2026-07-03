import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createOdinHull } from '../src/scene/odinHull.js';

// odinHull.js is intentionally DOM/WebGL-free (see file header) — it only
// calls the injected `add(geo, mat, t, r, s)` callback, so its proportions
// can be verified headlessly by recording every part into a THREE.Group and
// computing a real Box3. This is the one part of the V15 hull rebuild this
// sandbox CAN check without a real renderer (see ROADMAP §4 V15 scope notes
// on why the rest is build-verified only, not visually verified).
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
  const info = createOdinHull(THREE, { add, mats, detail });
  group.updateMatrixWorld(true);
  const box = new THREE.Box3();
  for (const m of meshes) box.expandByObject(m);
  return { info, box, meshCount: meshes.length };
}

describe('createOdinHull — reference proportions (ROADMAP §4 V15)', () => {
  it('declares a length:height ratio of ~5.5:1', () => {
    const { info } = buildForBBox('full');
    expect(info.length / info.height).toBeCloseTo(5.5, 1);
  });

  it('the blade bow occupies 35-40% of total declared length', () => {
    const { info } = buildForBBox('full');
    const frac = info.bowLen / info.length;
    expect(frac).toBeGreaterThanOrEqual(0.35);
    expect(frac).toBeLessThanOrEqual(0.4);
  });

  it('the actual rendered bounding box spans roughly the declared length along Z', () => {
    const { info, box } = buildForBBox('full');
    const spanZ = box.max.z - box.min.z;
    // some overshoot is expected (gun barrel ahead of the bow, engine housings
    // behind the stern block) but it should stay in the same ballpark, not
    // balloon or shrink to a different silhouette entirely
    expect(spanZ).toBeGreaterThanOrEqual(info.length * 0.9);
    expect(spanZ).toBeLessThanOrEqual(info.length * 1.4);
  });

  it('the bounding box height is not a runaway multiple of the declared hull height', () => {
    // masts are intentionally thin spikes that rise ABOVE the main hull
    // silhouette (that's the reference look — "天线桅杆簇"), so some overshoot
    // past `height` (which describes the main hull block) is expected; this
    // just guards against a genuine bug making something blow up to 5x+.
    const { info, box } = buildForBBox('full');
    const spanY = box.max.y - box.min.y;
    expect(spanY).toBeLessThanOrEqual(info.height * 2.5);
  });

  it('exposes 7 engine mounts, 5 dorsal turrets, 2 belly pods, 4 mast tips', () => {
    const { info } = buildForBBox('full');
    expect(info.engineMounts.length).toBe(7);
    expect(info.turretMounts.length).toBe(5);
    expect(info.bellyPodMounts.length).toBe(2);
    expect(info.mastTips.length).toBe(4);
  });

  it('engine mounts sit at the stern (negative Z, past the turret row)', () => {
    const { info } = buildForBBox('full');
    const turretMinZ = Math.min(...info.turretMounts.map(t => t.z));
    for (const em of info.engineMounts) expect(em.z).toBeLessThan(turretMinZ);
  });

  it('"wire" detail skips the greeble scatter (fewer parts than "full", same silhouette metadata)', () => {
    const wire = buildForBBox('wire');
    const fullD = buildForBBox('full');
    expect(wire.meshCount).toBeLessThan(fullD.meshCount);
    expect(wire.info.length).toBe(fullD.info.length);
    expect(wire.info.bowLen).toBe(fullD.info.bowLen);
  });

  it('never produces NaN/Infinity coordinates', () => {
    const { box } = buildForBBox('full');
    for (const v of [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z]) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });
});
