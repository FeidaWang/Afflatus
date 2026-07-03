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

  it('regression: engine mounts stay inside the stern deck block (previously some overshot the deck\'s own bounds and floated disconnected)', () => {
    // the stern engine-deck block is BoxGeometry(2.3, height*0.5, ...), and
    // each housing is BoxGeometry(0.5, 0.4, 0.9) — half-height 0.2 — centred
    // at the mount point, so a mount sitting further than (deck half-height -
    // housing half-height) from the centreline means the housing pokes
    // outside the deck block and reads as a floating box in the hologram.
    const { info } = buildForBBox('full');
    const deckHalfHeight = info.height * 0.5 / 2;
    const housingHalfHeight = 0.2;
    const safeY = deckHalfHeight - housingHalfHeight;
    for (const em of info.engineMounts) expect(Math.abs(em.y)).toBeLessThanOrEqual(safeY + 1e-6);
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
    expect(wire.info.mastTips.length).toBe(4);
    expect(wire.info.turretMounts.length).toBe(5);
    expect(wire.info.bellyPodMounts.length).toBe(2);
    expect(wire.meshCount).toBeLessThan(fullD.meshCount); // still fewer parts overall (thinner greeble scatter)
  });
});
