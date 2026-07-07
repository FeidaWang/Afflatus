/**
 * "Wraith" carrier hull — procedural geometry approximating the user-supplied
 * reference wireframe render (assets/hud/ship-hologram.jpeg, 2026-07-08):
 * a wide, flat, low-profile hull (NOT a slender blade like odinHull.js's
 * ship) with a forked twin-blade bow, a stepped central tower tapering to a
 * spire + secondary mast, swept hammerhead-style wing extensions on both
 * flanks, and a large ventral cylinder (docking tube / main engine housing).
 * Honest scope note: this is a hand-built approximation of the reference
 * image's KEY silhouette features (wide flat hull, twin bow prongs, tiered
 * tower+spire, swept wings, central cylinder, dense greeble) — not a
 * geometric reconstruction of it. There is no way to derive precise 3D
 * geometry from a single 2D image; see ROADMAP for the fuller discussion.
 *
 * Same DOM/WebGL-free contract as odinHull.js: only calls the caller-supplied
 * `add(geo, mat, t, r, s)`, so proportions are unit-testable headlessly
 * (tests/carrierHull.test.js) even though the actual render can't be
 * visually verified in this sandbox.
 *
 * Forward = +Z (matches odinHull.js / capitalShip3D.js / shipHologram.js).
 * mats: { hull, arm, dark, trim, glass, red, blue } — caller-owned materials.
 *
 *   const info = createCarrierHull(THREE, { add, mats, detail: 'full' });
 *   // info = { length, height, width, engineMounts, muzzleAnchor, prongTips }
 */

// Reuses the same lofted-hull-skin technique as odinHull.js (continuous
// tapering body instead of stacked boxes with visible seams) — see that
// file's buildHullLoftGeometry header comment for the winding/normal
// verification rationale, which applies identically here.
function buildHullLoftGeometry(THREE, stations) {
  const ring = (halfW, halfH, yCenter, z) => ([
    [0, yCenter + halfH, z], [halfW, yCenter, z], [0, yCenter - halfH, z], [-halfW, yCenter, z],
  ]);
  const rings = stations.map(s => ring(s.halfW, s.halfH, s.yCenter || 0, s.z));
  const pos = [];
  const push = p => pos.push(p[0], p[1], p[2]);
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i], b = rings[i + 1];
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4;
      push(a[k]); push(b[k2]); push(a[k2]);
      push(a[k]); push(b[k]); push(b[k2]);
    }
  }
  // stern cap (closes the aft-most ring)
  const first = rings[0], center = [0, stations[0].yCenter || 0, stations[0].z];
  for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4; push(center); push(first[k]); push(first[k2]); }
  // bow-root cap (closes the forward-most ring of the MAIN hull loft — the
  // twin prongs attach here as separate parts, not a continuation of the loft)
  const last = rings[rings.length - 1], centerB = [0, stations[stations.length - 1].yCenter || 0, stations[stations.length - 1].z];
  for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4; push(centerB); push(last[k2]); push(last[k]); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

export function createCarrierHull(THREE, { add, mats, detail = 'full' }) {
  const full = detail === 'full';
  const M = mats;

  // ---- proportions (reference: wide flat hull, ~4.3:1 length:height, much
  // wider than odinHull's slender 5.5:1 length:height blade) ----
  const STERN = -5.2, BOW_ROOT = 2.4;             // main-hull loft span
  const LEN_MAIN = BOW_ROOT - STERN;               // 7.6
  const HEIGHT = 1.15;
  const WIDTH = 4.3;
  const PRONG_LEN = 3.0;                           // each bow prong extends this far past BOW_ROOT
  const PRONG_SPREAD = 1.5;                        // horizontal distance from centreline to a prong tip
  const LENGTH = LEN_MAIN + PRONG_LEN;             // declared total length (main hull + prongs)

  // ===== main hull: one continuous lofted skin, stern -> midship -> bow root =====
  add(buildHullLoftGeometry(THREE, [
    { z: STERN, halfW: WIDTH * 0.30, halfH: HEIGHT * 0.40 },
    { z: STERN + LEN_MAIN * 0.18, halfW: WIDTH * 0.44, halfH: HEIGHT * 0.48 },
    { z: STERN + LEN_MAIN * 0.5, halfW: WIDTH * 0.5, halfH: HEIGHT * 0.5 },   // widest point, midship
    { z: BOW_ROOT - LEN_MAIN * 0.16, halfW: WIDTH * 0.33, halfH: HEIGHT * 0.4 },
    { z: BOW_ROOT, halfW: WIDTH * 0.15, halfH: HEIGHT * 0.26 },
  ]), M.hull, [0, 0, 0]);

  // ===== twin bow prongs — thin tapering blades splaying outward (yaw =====
  // rotation around Y so they diverge in the horizontal XZ plane as they
  // extend forward), the reference image's most distinctive silhouette cue.
  const prongTips = [];
  for (const sx of [-1, 1]) {
    const angle = sx * 0.22; // yaw: mirrored since sin(sx*a) = sx*sin(a)
    const rootX = sx * WIDTH * 0.06;
    const tipX = rootX + Math.sin(angle) * PRONG_LEN, tipZ = BOW_ROOT + Math.cos(angle) * PRONG_LEN;
    const midX = (rootX + tipX) / 2, midZ = (BOW_ROOT + tipZ) / 2;
    add(new THREE.BoxGeometry(0.44, HEIGHT * 0.2, PRONG_LEN), M.hull, [midX, 0, midZ], [0, angle, 0]);
    add(new THREE.ConeGeometry(0.24, 0.7, 4), M.hull, [tipX, 0, tipZ + 0.3 * Math.cos(angle)], [Math.PI / 2, 0, Math.PI / 4]);
    prongTips.push({ x: tipX, y: 0, z: tipZ });
    // thin fin under each prong (reference shows a secondary blade edge below the main prong)
    add(new THREE.BoxGeometry(0.06, HEIGHT * 0.5, PRONG_LEN * 0.75), M.arm, [midX * 0.9, -HEIGHT * 0.15, BOW_ROOT + PRONG_LEN * 0.35], [0, angle, sx * 0.08]);
  }

  // ===== central stepped tower: wide base -> narrower tiers -> spire + =====
  // secondary mast (the reference's tallest/most eye-catching feature)
  const towerZ = STERN + LEN_MAIN * 0.42;
  add(new THREE.BoxGeometry(1.7, HEIGHT * 0.55, 1.9), M.arm, [0, HEIGHT * 0.68, towerZ]);
  add(new THREE.BoxGeometry(1.2, HEIGHT * 0.55, 1.35), M.hull, [0, HEIGHT * 1.1, towerZ + 0.05]);
  add(new THREE.BoxGeometry(0.75, HEIGHT * 0.45, 0.9), M.trim, [0, HEIGHT * 1.5, towerZ + 0.1]);
  add(new THREE.BoxGeometry(0.42, HEIGHT * 0.3, 0.5), M.dark, [0, HEIGHT * 1.82, towerZ + 0.1]);
  add(new THREE.ConeGeometry(0.28, HEIGHT * 0.85, 6), M.trim, [0, HEIGHT * 2.2, towerZ + 0.05]);     // main spire
  add(new THREE.CylinderGeometry(0.045, 0.08, HEIGHT * 0.62, 6), M.trim, [0.36, HEIGHT * 1.62, towerZ - 0.25]); // secondary mast
  add(new THREE.SphereGeometry(0.05, 6, 5), M.red, [0.36, HEIGHT * 1.62 + HEIGHT * 0.31, towerZ - 0.25]);       // mast tip beacon
  const towerTip = { x: 0, y: HEIGHT * 2.2 + HEIGHT * 0.42, z: towerZ + 0.05 };

  // ===== swept hammerhead wings (both flanks, aft of the tower) =====
  const wingMounts = [];
  for (const sx of [-1, 1]) {
    const wx = sx * (WIDTH * 0.5 + 0.75), wz = STERN + LEN_MAIN * 0.62;
    add(new THREE.BoxGeometry(1.9, HEIGHT * 0.2, 1.5), M.arm, [wx, HEIGHT * 0.12, wz], [0, 0, sx * 0.16]);
    add(new THREE.BoxGeometry(0.5, HEIGHT * 0.16, 0.9), M.trim, [wx + sx * 0.9, HEIGHT * 0.12, wz - 0.3], [0, 0, sx * 0.1]); // outer tip fin
    wingMounts.push({ x: wx, y: HEIGHT * 0.12, z: wz, side: sx });
  }

  // ===== large ventral cylinder (docking tube / main engine housing, the =====
  // reference's most prominent single accent besides the tower)
  const cylZ = STERN + LEN_MAIN * 0.3;
  add(new THREE.CylinderGeometry(0.58, 0.62, 1.7, 14), M.dark, [0, -HEIGHT * 0.2, cylZ], [Math.PI / 2, 0, 0]);
  add(new THREE.TorusGeometry(0.62, 0.06, 6, 16), M.trim, [0, -HEIGHT * 0.2, cylZ - 0.85]); // forward collar ring

  // ===== dorsal panel-seam lines + hull greeble (denser than odinHull's — =====
  // the reference is an unusually busy cutaway-style render)
  for (let i = 0; i < 5; i++) add(new THREE.BoxGeometry(WIDTH * 0.7, 0.03, 0.2), M.trim, [0, HEIGHT * 0.22, STERN + LEN_MAIN * (0.15 + i * 0.16)]);
  {
    const density = full ? 1 : 0.45;
    const scatter = (n, zMin, zMax, xSpread, y) => {
      for (let i = 0; i < n; i++) {
        const x = (Math.random() - 0.5) * xSpread, z = zMin + Math.random() * (zMax - zMin);
        const r = Math.random();
        const geo = r < 0.55 ? new THREE.BoxGeometry(0.07 + Math.random() * 0.16, 0.022, 0.09 + Math.random() * 0.22)
          : r < 0.82 ? new THREE.BoxGeometry(0.12 + Math.random() * 0.18, 0.024, 0.12 + Math.random() * 0.18)
            : new THREE.BoxGeometry(0.04, 0.05, 0.04);
        add(geo, r < 0.5 ? M.trim : M.dark, [x, y, z]);
      }
    };
    scatter(Math.round(70 * density), STERN + LEN_MAIN * 0.1, BOW_ROOT - LEN_MAIN * 0.1, WIDTH * 0.75, HEIGHT * 0.24);
    scatter(Math.round(34 * density), STERN, STERN + LEN_MAIN * 0.3, WIDTH * 0.55, HEIGHT * 0.1);
  }

  // ===== stern engine mounts (flat row across the wide stern face) =====
  const engineMounts = [];
  const EN_N = 6;
  for (let i = 0; i < EN_N; i++) {
    const x = (i - (EN_N - 1) / 2) * (WIDTH * 0.16);
    add(new THREE.BoxGeometry(0.42, HEIGHT * 0.32, 0.6), M.trim, [x, -HEIGHT * 0.05, STERN + 0.3]);
    add(new THREE.TorusGeometry(0.2, 0.04, 6, 12), M.arm, [x, -HEIGHT * 0.05, STERN + 0.02]);
    engineMounts.push({ x, y: -HEIGHT * 0.05, z: STERN });
  }

  // ===== bow-centre muzzle (between the two prongs — preserves the existing =====
  // main-gun-fire gameplay hook shipHologram.js's frame() loop expects)
  const muzzleAnchor = { x: 0, y: 0, z: BOW_ROOT + PRONG_LEN * 0.25 };

  return {
    length: LENGTH, height: HEIGHT, width: WIDTH,
    engineMounts, muzzleAnchor, prongTips, wingMounts, towerTip,
  };
}
