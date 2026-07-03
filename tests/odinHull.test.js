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

  it('regression: the bow cone itself is a long tapered blade, not a small stub (the actual bug the user\'s screenshot caught)', () => {
    // A previous version scaled the cone's LOCAL Y axis to "flatten" it, not
    // realizing THREE applies scale before rotation and rotation.x=PI/2 maps
    // local Y (the cone's height/length parameter) to world Z — so the scale
    // was shrinking the ship's LENGTH, not its vertical thickness, and an
    // extra 45° Z-rotation further smeared the axes together. Net result: a
    // ~2×2×2 stub near the nose instead of a long 3.7-unit tapered blade —
    // exactly the "doesn't look like a blade, looks boxy" report. This test
    // pins the bow cone's own world-space bounding box (mesh[0], the first
    // part createOdinHull adds) to the intended long/thin/tapered shape.
    const { info, meshes } = buildForBBox('full');
    const bowCone = meshes[0];
    const box = new THREE.Box3().setFromObject(bowCone);
    const spanX = box.max.x - box.min.x, spanY = box.max.y - box.min.y, spanZ = box.max.z - box.min.z;
    expect(spanZ).toBeGreaterThan(info.bowLen * 0.9); // long: close to the full BOW_LEN, not a short stub
    expect(spanY).toBeLessThan(spanZ * 0.3);           // flattened: much thinner than it is long
    expect(spanX).toBeLessThan(spanZ * 0.7);           // narrower than it is long (tapered blade, not a cube)
    expect(spanX).toBeGreaterThan(spanY);              // wider than tall (blade cross-section, not a needle)
  });

  it('"wire" detail keeps only 1 mast (of 4) and drops the turret row / belly pods for a cleaner hologram silhouette', () => {
    const wire = buildForBBox('wire');
    expect(wire.info.mastTips.length).toBe(1);
    // metadata for turret/pod mount points is still returned (capitalShip3D's
    // 'full' branch and any future consumer can rely on the count), only the
    // extra geometry is skipped — verified indirectly via the lower meshCount
    // assertion above.
    expect(wire.info.turretMounts.length).toBe(5);
    expect(wire.info.bellyPodMounts.length).toBe(2);
  });
});
