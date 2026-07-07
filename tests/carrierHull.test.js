import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createCarrierHull } from '../src/scene/carrierHull.js';

// Same headless verification approach as tests/odinHull.test.js (see that
// file's header comment): carrierHull.js is DOM/WebGL-free, only calling the
// injected `add(geo, mat, t, r, s)`, so proportions/mount layout can be
// checked with a real THREE.Box3 without a renderer — even though the actual
// visual match to the reference image (assets/hud/ship-hologram.jpeg) can't
// be checked in this sandbox.
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
  const info = createCarrierHull(THREE, { add, mats, detail });
  group.updateMatrixWorld(true);
  const box = new THREE.Box3();
  for (const m of meshes) box.expandByObject(m);
  return { info, box, meshCount: meshes.length, meshes };
}

describe('createCarrierHull — reference silhouette (wide flat hull, forked bow)', () => {
  it('is wide and flat, not slender like the Odin blade hull (width:height >> odin\'s ~1:1)', () => {
    const { info } = buildForBBox('full');
    expect(info.width / info.height).toBeGreaterThan(3);
  });

  it('declares a length:height ratio in the 8-10:1 range (low profile carrier, not a tall ship)', () => {
    const { info } = buildForBBox('full');
    expect(info.length / info.height).toBeGreaterThan(7);
    expect(info.length / info.height).toBeLessThan(11);
  });

  it('the rendered bounding box spans roughly the declared length along Z', () => {
    const { info, box } = buildForBBox('full');
    const spanZ = box.max.z - box.min.z;
    expect(spanZ).toBeGreaterThanOrEqual(info.length * 0.85);
    expect(spanZ).toBeLessThanOrEqual(info.length * 1.35);
  });

  it('the bounding box width reaches roughly the declared hull width', () => {
    const { info, box } = buildForBBox('full');
    const spanX = box.max.x - box.min.x;
    expect(spanX).toBeGreaterThanOrEqual(info.width * 0.9);
  });

  it('the tower + spire rise above the main hull without being a runaway multiple', () => {
    const { info, box } = buildForBBox('full');
    const spanY = box.max.y - box.min.y;
    expect(spanY).toBeGreaterThan(info.height * 2); // spire clears the flat hull by design
    expect(spanY).toBeLessThan(info.height * 5);     // but isn't blown out of proportion
  });

  it('exposes 2 forked bow prong tips, mirrored left/right of the centreline', () => {
    const { info } = buildForBBox('full');
    expect(info.prongTips.length).toBe(2);
    const [a, b] = info.prongTips;
    expect(a.x).toBeCloseTo(-b.x, 5);
    expect(a.z).toBeCloseTo(b.z, 5);
    expect(Math.abs(a.x)).toBeGreaterThan(0.5); // genuinely splayed apart, not touching
  });

  it('the prong tips sit ahead of the main hull\'s bow root (forward of the loft body)', () => {
    const { info } = buildForBBox('full');
    for (const tip of info.prongTips) expect(tip.z).toBeGreaterThan(2.0);
  });

  it('exposes 2 swept wing mounts, mirrored left/right, outboard of the hull width', () => {
    const { info } = buildForBBox('full');
    expect(info.wingMounts.length).toBe(2);
    const [a, b] = info.wingMounts;
    expect(a.x).toBeCloseTo(-b.x, 5);
    expect(a.z).toBeCloseTo(b.z, 5);
    expect(Math.abs(a.x)).toBeGreaterThan(info.width / 2); // clears the hull's own half-width
  });

  it('exposes 6 stern engine mounts, symmetric about the centreline', () => {
    const { info } = buildForBBox('full');
    expect(info.engineMounts.length).toBe(6);
    const xs = info.engineMounts.map(m => m.x).sort((a, b) => a - b);
    for (let i = 0; i < xs.length; i++) expect(xs[i]).toBeCloseTo(-xs[xs.length - 1 - i], 5);
  });

  it('the muzzle anchor sits between the two bow prongs, ahead of the main hull', () => {
    const { info } = buildForBBox('full');
    expect(info.muzzleAnchor.x).toBeCloseTo(0, 5);
    expect(info.muzzleAnchor.z).toBeGreaterThan(2.0);
  });

  it('"wire" detail has a thinner greeble scatter than "full" but keeps the same declared proportions', () => {
    const wire = buildForBBox('wire');
    const fullD = buildForBBox('full');
    expect(wire.meshCount).toBeLessThan(fullD.meshCount);
    expect(wire.info.length).toBe(fullD.info.length);
    expect(wire.info.width).toBe(fullD.info.width);
    expect(wire.info.prongTips.length).toBe(fullD.info.prongTips.length);
  });

  it('exposes 8 turret mounts (3 multi-turreted platforms x2 + 2 single turrets) across the upper decks', () => {
    const { info } = buildForBBox('full');
    expect(info.turretMounts.length).toBe(8);
    for (const t of info.turretMounts) {
      expect(t.y).toBeGreaterThan(0); // sit on the dorsal (upper) deck, not the belly
      expect(t.z).toBeGreaterThan(-6.5);
      expect(t.z).toBeLessThan(3);
    }
  });

  it('exposes a ventral bay mount below the hull centreline, distinct from the ventral cylinder', () => {
    const { info } = buildForBBox('full');
    expect(info.bayMount).toBeDefined();
    expect(info.bayMount.y).toBeLessThan(0); // ventral (below the hull's own centreline)
    expect(Number.isFinite(info.bayMount.x) && Number.isFinite(info.bayMount.z)).toBe(true);
  });

  it('never produces NaN/Infinity coordinates', () => {
    const { box } = buildForBBox('full');
    for (const v of [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z]) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('the main hull is one continuous lofted skin spanning most of the main-body length (not disconnected boxes)', () => {
    const { info, meshes } = buildForBBox('full');
    const hull = meshes[0];
    const geo = hull.geometry;
    geo.computeBoundingBox();
    const b = geo.boundingBox;
    const spanX = b.max.x - b.min.x, spanZ = b.max.z - b.min.z;
    expect(spanX).toBeGreaterThan(1.5);   // reaches midship's full width somewhere along its length
    expect(spanZ).toBeGreaterThan(6);     // spans most of the main hull (stern -> bow root), prongs are separate parts
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      expect(Number.isFinite(pos.getX(i)) && Number.isFinite(pos.getY(i)) && Number.isFinite(pos.getZ(i))).toBe(true);
    }
  });
});
