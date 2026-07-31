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
  return { info, box, meshCount: meshes.length, meshes };
}

describe('createOdinHull — Afflatus Vanguard lifting-body proportions', () => {
  it('declares the new low lifting-body length:height ratio of ~7.8:1', () => {
    const { info } = buildForBBox('full');
    expect(info.length / info.height).toBeCloseTo(7.8, 1);
  });

  it('the spear bow occupies roughly 40-44% of total declared length', () => {
    const { info } = buildForBBox('full');
    const frac = info.bowLen / info.length;
    expect(frac).toBeGreaterThanOrEqual(0.4);
    expect(frac).toBeLessThanOrEqual(0.44);
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

  it('exposes paired main/vector drives, six dorsal turrets, two belly pods and three mast tips', () => {
    const { info } = buildForBBox('full');
    expect(info.engineMounts.length).toBe(6);
    expect(info.turretMounts.length).toBe(6);
    expect(info.bellyPodMounts.length).toBe(2);
    expect(info.mastTips.length).toBe(3);
  });

  it('exposes 8 side modular-bay mounts and 6 lateral point-defense turrets, mirrored across the keel', () => {
    // added per the user's detailed reference breakdown: category 2 ("Mid-
    // Section Modular Bays" — a repeating row on the hull FLANKS, called out
    // as a scale/detail visual anchor) and category 4 ("Ventral and Lateral
    // Defenses" — point-defense distributed across both bottom AND sides).
    const { info } = buildForBBox('full');
    expect(info.sideBayMounts.length).toBe(8);
    expect(info.lateralTurretMounts.length).toBe(6);
    const left = info.sideBayMounts.filter(m => m.side === -1).length;
    const right = info.sideBayMounts.filter(m => m.side === 1).length;
    expect(left).toBe(4);
    expect(right).toBe(4);
  });

  it('side modular bays and lateral turrets sit within the midship z-span, mirrored left/right', () => {
    const { info } = buildForBBox('full');
    for (const m of info.sideBayMounts) {
      expect(Number.isFinite(m.z)).toBe(true);
      expect(Math.abs(m.x)).toBeGreaterThan(2.4); // real flank bays on the broad lifting body
      expect(Math.abs(m.x)).toBeLessThan(3.5);    // still attached inside the 4.15 half-span
    }
    for (const m of info.lateralTurretMounts) {
      expect(Math.abs(m.x)).toBeGreaterThan(0.9);
      expect(Math.abs(m.x)).toBeLessThan(2.0);
    }
    // mirror symmetry: every left mount has a matching right mount at the same z
    const leftZs = info.sideBayMounts.filter(m => m.side === -1).map(m => m.z).sort((a, b) => a - b);
    const rightZs = info.sideBayMounts.filter(m => m.side === 1).map(m => m.z).sort((a, b) => a - b);
    for (let i = 0; i < leftZs.length; i++) expect(leftZs[i]).toBeCloseTo(rightZs[i], 6);
  });

  it('"wire" keeps the side bays and lateral turrets too (structured accents, not random greeble)', () => {
    const wire = buildForBBox('wire');
    expect(wire.info.sideBayMounts.length).toBe(8);
    expect(wire.info.lateralTurretMounts.length).toBe(6);
  });

  it('engine mounts sit at the stern (negative Z, past the turret row)', () => {
    const { info } = buildForBBox('full');
    const turretMinZ = Math.min(...info.turretMounts.map(t => t.z));
    for (const em of info.engineMounts) expect(em.z).toBeLessThan(turretMinZ);
  });

  it('"wire" detail has a thinner greeble scatter than "full" (fewer parts, same silhouette metadata)', () => {
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

  it('keeps all drive mounts aft and arranges them in exact port/starboard pairs', () => {
    const { info } = buildForBBox('full');
    for (const em of info.engineMounts) expect(em.z).toBeLessThan(-5);
    const left = info.engineMounts.filter((mount) => mount.x < 0);
    const right = info.engineMounts.filter((mount) => mount.x > 0);
    expect(left).toHaveLength(3);
    expect(right).toHaveLength(3);
    for (const mount of left) {
      expect(right.some((peer) => Math.abs(peer.x + mount.x) < 1e-6 && Math.abs(peer.y - mount.y) < 1e-6 && Math.abs(peer.z - mount.z) < 1e-6)).toBe(true);
    }
  });

  it('regression: the hull is ONE continuous tapered skin, not stacked boxes with visible seams ("toy block" report)', () => {
    // First version: a bow cone (buggy proportions, see below) + a separate
    // midship box + a separate stern box, bolted together with no shared
    // surface — read as disconnected rectangular chunks in both the
    // wireframe hologram and the solid PBR render ("画的和积木玩具一样").
    // Second version fixed the cone's own proportions but kept the 3-piece
    // construction. This version replaces all three with buildHullLoftGeometry
    // — ONE BufferGeometry (mesh[0], the first part createOdinHull adds)
    // whose own bounding box should span almost the FULL declared ship length
    // (not just the old bow-cone's ~37%), and taper from a wide stern to a
    // near-zero-width bow tip.
    const { info, meshes } = buildForBBox('full');
    const hull = meshes[0];
    const geo = hull.geometry;
    geo.computeBoundingBox();
    const b = geo.boundingBox;
    const spanX = b.max.x - b.min.x, spanY = b.max.y - b.min.y, spanZ = b.max.z - b.min.z;
    expect(spanZ).toBeGreaterThan(info.length * 0.95); // spans (almost) the whole ship, not just the old bow stub
    expect(spanX).toBeGreaterThan(2.0);                // reaches the midship's full width somewhere along its length
    expect(spanY).toBeGreaterThan(0.5);                // reaches the midship's full height somewhere along its length
    expect(spanX).toBeLessThan(spanZ);                 // still much longer than it is wide (elongated, not a blob)
    // no NaN/degenerate vertices from the near-zero-radius nose station
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      expect(Number.isFinite(pos.getX(i)) && Number.isFinite(pos.getY(i)) && Number.isFinite(pos.getZ(i))).toBe(true);
    }
  });

  it('regression: the lofted hull skin has consistent outward-facing normals (winding verified, not assumed)', () => {
    // Rotation/scale axis-mapping mistakes are easy to make and easy to miss
    // (see the bow-cone bug above) — for a hand-built BufferGeometry the
    // equivalent risk is backwards triangle winding, which would make the
    // hull's normals point INTO the ship instead of outward, so PBR lighting
    // would shade it as if lit from inside (looks wrong/dark from outside).
    // This checks every non-axis vertex's normal has a positive outward
    // radial component — verified the same way this was checked by hand in
    // Node before the fix shipped.
    const { meshes } = buildForBBox('full');
    const hull = meshes[0];
    const geo = hull.geometry;
    const pos = geo.attributes.position, norm = geo.attributes.normal;
    let checked = 0;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const r = Math.hypot(x, y);
      if (r < 0.05) continue; // skip near-axis vertices (nose tip / stern-cap centre)
      const nx = norm.getX(i), ny = norm.getY(i);
      const outwardDot = (x * nx + y * ny) / r;
      // tiny negative tolerance: a vertex shared between a side quad and the
      // stern cap gets an AVERAGED normal, which can land almost exactly on
      // the boundary for some symmetric vertices — genuinely backwards
      // winding would show up as strongly negative (close to -1), not ~0.
      expect(outwardDot).toBeGreaterThanOrEqual(-0.05);
      checked++;
    }
    expect(checked).toBeGreaterThan(20); // sanity: actually checked a meaningful number of vertices
  });

  it('"wire" keeps the same structured detail as "full" (turrets/masts/pods) — only the random greeble scatter is thinned', () => {
    // Earlier this session, 'wire' dropped the turret row/most masts/pods
    // entirely to avoid a cluttered wireframe — but with the hull-shape bug
    // fixed (the loft, not the old boxes-and-a-broken-cone), the user's
    // actual complaint became "no detail at all", not "too cluttered". So
    // now both detail levels keep the same STRUCTURED accents (turrets,
    // all 4 masts, belly pods, panel seams) and only the random fine-greeble
    // density differs (wire: ~40% of full's count).
    const wire = buildForBBox('wire');
    const fullD = buildForBBox('full');
    expect(wire.info.mastTips.length).toBe(3);
    expect(wire.info.turretMounts.length).toBe(6);
    expect(wire.info.bellyPodMounts.length).toBe(2);
    expect(wire.meshCount).toBeLessThan(fullD.meshCount); // still fewer parts overall (thinner greeble scatter)
  });
});
