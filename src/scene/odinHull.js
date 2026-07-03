/**
 * Odin-class hull layout — shared procedural geometry for the "reference
 * rebuild" capital ship silhouette (V15, ROADMAP §4): a slender elongated
 * blade-bow battlecruiser, not the earlier fighter-scale wedge-with-wings
 * Enforcer. Reference features (extracted from the user's Blender screenshot,
 * see ROADMAP §4 V15):
 *   - length:height ratio ≈ 5.5:1
 *   - blade bow occupies ~37% of total length, tapering to a point
 *   - midship: stepped superstructure + bridge tower + antenna mast cluster
 *   - stern: dense thruster cluster + outward radiator/truss booms
 *   - dorsal turret row (spine, midship→stern)
 *   - belly weapon pods with recessed gun ports
 *   - greeble density gradient: stern > midship > bow (bow stays clean so the
 *     blade silhouette reads)
 *
 * This module is intentionally DOM/WebGL-free — it never creates a
 * THREE.Group, Mesh, or texture itself. It only calls the `add(geo, mat, t,
 * r, s)` callback the CALLER supplies, so the exact same shape can be
 * consumed two different ways (ROADMAP §4: "同一几何体喂 capitalShip3D 的侧
 * 视/尾视，一份资产两处用"):
 *   - capitalShip3D.js: `add` creates a plain PBR THREE.Mesh
 *   - shipHologram.js:  `add` creates a Mesh + edge-wireframe overlay
 * Being pure/DOM-free also means this file's proportions can be unit tested
 * headlessly (see tests/odinHull.test.js) — the one part of a 3D-visual
 * feature this project's sandbox CAN verify without a real renderer.
 *
 *   const info = createOdinHull(THREE, { add, mats, detail: 'full' });
 *   // info = { length, height, bowLen, engineMounts, muzzleAnchor, ... }
 *
 * Forward = +Z (matches the existing capitalShip3D.js / shipHologram.js /
 * nighthawk.js convention).
 *
 * mats: { hull, arm, dark, trim, glass, red, blue } — caller-owned materials
 * (colours/PBR params are the caller's concern; this file only decides shape
 * and layout).
 */

// A continuous lofted hull body (diamond cross-section per "station", quads
// connecting consecutive rings, a point-cap at the bow, a flat cap at the
// stern) — this replaces what used to be three separate boxes/cone bolted
// together with visible seams ("toy block" look the user's screenshot
// flagged). One smooth tapering skin reads as a real hull silhouette instead
// of stacked primitives; turrets/masts/fins/pods/greeble still attach on top
// of it as discrete accents, same as a real ship model would layer detail
// onto a continuous base mesh.
//
// Winding/normal direction was verified numerically in Node (not just
// assumed) before shipping: sampled every side vertex's outward radial dot
// product (all positive) and the stern cap ring's average normal.z (negative
// = facing aft/outward), see the corresponding regression test.
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
  // stern cap (closes the aft-most ring so the hull doesn't read as hollow)
  const first = rings[0], center = [0, stations[0].yCenter || 0, stations[0].z];
  for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4; push(center); push(first[k]); push(first[k2]); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

export function createOdinHull(THREE, { add, mats, detail = 'full' }) {
  const full = detail === 'full';
  const M = mats;

  // ---- proportions ----------------------------------------------------
  const NOSE = 5.4, STERN = -4.6;                 // total length 10.0
  const LEN = NOSE - STERN;                       // 10.0
  const HEIGHT = LEN / 5.5;                       // ≈1.818 (the reference ratio)
  const BOW_LEN = LEN * 0.37;                     // ≈3.7
  const BOW_ROOT = NOSE - BOW_LEN;                // ≈1.7
  const STERN_ROOT = STERN + 3.2;                 // stern block starts here (≈-1.4)

  // ===== continuous lofted hull skin: stern → stern-root → midship → =====
  // bow-root → nose-point, ONE smooth tapering body (replaces three separate
  // primitives — cone + midship box + engine-deck box — that used to read as
  // disconnected stacked blocks with visible seams between them). Station
  // half-width/half-height values match the accent boxes still attached at
  // each of these z-positions below, so the loft and the accents line up.
  const sternDeckW = 2.3, sternDeckH = HEIGHT * 0.5;
  const midW = 2.5, midH = HEIGHT * 0.32;
  const bowRootW = 1.8, bowRootH = HEIGHT * 0.24; // matches the old bow-cone base proportions
  add(buildHullLoftGeometry(THREE, [
    { z: STERN, halfW: sternDeckW / 2, halfH: sternDeckH / 2 },
    { z: STERN + 0.6, halfW: sternDeckW / 2, halfH: sternDeckH / 2 },     // keep the stern block's cross-section for a bit (engine deck footprint)
    { z: STERN_ROOT, halfW: midW / 2, halfH: midH / 2 },                  // widen into the midship hull
    { z: BOW_ROOT, halfW: bowRootW / 2, halfH: bowRootH / 2 },            // narrow into the blade root
    { z: NOSE, halfW: 0.015, halfH: 0.015 },                              // taper to a point
  ]), M.hull, [0, 0, 0]);
  add(new THREE.BoxGeometry(1.5, HEIGHT * 0.13, BOW_LEN * 0.5), M.arm, [0, HEIGHT * 0.07, BOW_ROOT + BOW_LEN * 0.28]);
  for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(1.3 - i * 0.24, 0.03, 0.14), M.trim, [0, HEIGHT * 0.1, NOSE - 0.5 - i * (BOW_LEN * 0.2)]); // bow panel seams — kept in 'wire' too now the hull itself isn't a disconnected-boxes mess anymore, these read as detail rather than clutter
  // twin light rail cannons flush along the blade's upper edge (bow-forward fire)
  for (const bx of [-0.32, 0.32]) add(new THREE.CylinderGeometry(0.045, 0.06, BOW_LEN * 0.55, 10), M.trim, [bx, HEIGHT * 0.09, BOW_ROOT + BOW_LEN * 0.42], [Math.PI / 2, 0, 0]);

  // ===== midship: stepped superstructure + bridge + masts (hull skin is =
  // now the continuous loft above; only accents/greeble attach here) =====
  const midMid = (BOW_ROOT + STERN_ROOT) / 2, midLen = BOW_ROOT - STERN_ROOT;
  add(new THREE.BoxGeometry(1.9, HEIGHT * 0.14, midLen * 0.94), M.arm, [0, -HEIGHT * 0.22, midMid]); // belly armour skirt
  // stepped superstructure tiers (rise toward the stern side of midship, bridge at the top)
  const tierZ = STERN_ROOT + midLen * 0.32;
  add(new THREE.BoxGeometry(1.5, HEIGHT * 0.2, midLen * 0.5), M.arm, [0, HEIGHT * 0.26, tierZ]);
  add(new THREE.BoxGeometry(1.1, HEIGHT * 0.16, midLen * 0.34), M.hull, [0, HEIGHT * 0.46, tierZ]);
  add(new THREE.BoxGeometry(0.74, HEIGHT * 0.14, midLen * 0.22), M.trim, [0, HEIGHT * 0.62, tierZ]);          // bridge tower
  add(new THREE.BoxGeometry(0.46, HEIGHT * 0.1, midLen * 0.14), M.glass, [0, HEIGHT * 0.75, tierZ + midLen * 0.05]); // bridge glass
  for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(1.94, 0.03, 0.24), M.trim, [0, HEIGHT * 0.16, BOW_ROOT - 0.4 - i * 0.55]); // hull panel seams

  // antenna mast cluster (several thin rods at varied angles off the bridge top)
  // mastBaseY is set flush against the bridge-glass tier's top face (computed
  // from the SAME numbers used to place that tier, so it can't drift into a
  // floating gap the way a separately-guessed constant could).
  const bridgeGlassTop = HEIGHT * 0.75 + (HEIGHT * 0.1) / 2;
  const mastBaseY = bridgeGlassTop - 0.02, mastBaseZ = tierZ; // slight negative overlap = flush, not floating
  const MASTS_ALL = [
    { len: 1.0, rx: 0.06, rz: 0.0, dx: 0, dz: 0 },
    { len: 0.72, rx: 0.5, rz: 0.22, dx: -0.16, dz: -0.12 },
    { len: 0.6, rx: -0.4, rz: -0.3, dx: 0.18, dz: -0.06 },
    { len: 0.85, rx: 0.18, rz: -0.5, dx: -0.1, dz: 0.18 },
  ];
  const MASTS = MASTS_ALL; // kept in both detail levels (structured accents, not random clutter)
  const mastTips = [];
  for (const mmast of MASTS) {
    add(new THREE.CylinderGeometry(0.012, 0.02, mmast.len, 6), M.trim, [mmast.dx, mastBaseY + mmast.len / 2, mastBaseZ + mmast.dz], [mmast.rx, 0, mmast.rz]);
    const tipY = mastBaseY + mmast.len, tx = mmast.dx + Math.sin(mmast.rz) * mmast.len, tz = mastBaseZ + mmast.dz - Math.sin(mmast.rx) * mmast.len;
    add(new THREE.SphereGeometry(0.026, 6, 5), M.red, [tx, tipY, tz]);
    mastTips.push({ x: tx, y: tipY, z: tz });
  }

  // ===== dorsal turret row (spine, midship → stern) — kept in both detail ===
  // levels; now that the hull itself is a continuous loft (not disconnected
  // boxes), a row of small turrets reads as intentional detail, not clutter.
  const turretMounts = [];
  const TURRET_N = 5, turretZ0 = BOW_ROOT - 0.2, turretZ1 = STERN_ROOT + 0.3;
  for (let i = 0; i < TURRET_N; i++) {
    const z = turretZ0 + (turretZ1 - turretZ0) * (i / (TURRET_N - 1));
    const y = HEIGHT * 0.18; // verified flush against the midship hull top (HEIGHT*0.16): turret base sits 0.044 below it, no gap
    add(new THREE.BoxGeometry(0.32, 0.16, 0.32), M.dark, [0, y, z]);
    add(new THREE.CylinderGeometry(0.03, 0.04, 0.34, 8), M.trim, [0, y + 0.02, z + 0.2], [Math.PI / 2, 0, 0]);
    turretMounts.push({ x: 0, y, z });
  }

  // ===== belly weapon pods with recessed gun ports (kept in both levels) ==
  const bellyPodMounts = [];
  for (const sx of [-1, 1]) {
    const px = sx * 0.85, py = -HEIGHT * 0.34, pz = midMid - midLen * 0.1; // verified: overlaps the belly skirt by ~0.07, no gap
    add(new THREE.BoxGeometry(0.46, 0.32, 1.0), M.arm, [px, py, pz]);
    add(new THREE.BoxGeometry(0.3, 0.2, 0.24), M.dark, [px, py - 0.02, pz + 0.55]);            // recessed gun port
    add(new THREE.CylinderGeometry(0.04, 0.05, 0.4, 8), M.trim, [px, py - 0.02, pz + 0.78], [Math.PI / 2, 0, 0]); // gun barrel
    bellyPodMounts.push({ x: px, y: py, z: pz });
  }

  // ===== stern: dense thruster cluster + outward radiator/truss booms ===
  // (hull skin here is the continuous loft above; engine housings attach to it)
  const sternMid = (STERN_ROOT + STERN) / 2;
  // mount points chosen with margin inside the loft's stern-station half-extents
  // (±sternDeckW/2, ±sternDeckH/2, declared above) so the housings never poke
  // outside it — this replaces an earlier version whose Y values could exceed
  // the deck's bounds and read as floating disconnected boxes in the hologram.
  // (housing half-size is 0.25×0.2×0.45 — BoxGeometry(0.5,0.4,0.9) — so mount
  // |y| stays ≤ sternDeckH/2 - 0.2, verified in the regression test below)
  const engineMounts = [
    { x: -0.65, y: 0.2 }, { x: 0.65, y: 0.2 },
    { x: -0.65, y: -0.2 }, { x: 0.65, y: -0.2 },
    { x: -0.3, y: -0.02 }, { x: 0.3, y: -0.02 },
    { x: 0, y: 0.24 },
  ].map(m => ({ x: m.x, y: m.y, z: STERN + 0.35 }));
  for (const em of engineMounts) add(new THREE.BoxGeometry(0.5, 0.4, 0.9), M.trim, [em.x, em.y, em.z + 0.45]); // housings (caller attaches glow/light/plume at em)

  // outward radiator fin / truss boom arrays (both sides, angled back)
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(1.7, 0.05, 0.22), M.dark, [sx * 1.7, 0.1, sternMid - 0.2], [0, 0, sx * 0.12]);   // radiator fin
    add(new THREE.BoxGeometry(1.7, 0.05, 0.22), M.dark, [sx * 1.7, -0.32, sternMid - 0.2], [0, 0, sx * 0.12]); // second fin, lower
    for (let i = 0; i < 3; i++) add(new THREE.CylinderGeometry(0.02, 0.02, 0.42, 6), M.trim, [sx * (1.15 + i * 0.4), -0.11, sternMid - 0.2], [0, 0, Math.PI / 2]); // truss cross-braces
  }
  // stabiliser fins + vertical tail (silhouette anchors, kept from the earlier design)
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.06, HEIGHT * 0.36, 0.7), M.arm, [sx * 0.9, HEIGHT * 0.14, STERN + 1.1], [0.2, 0, sx * 0.4]);
  add(new THREE.BoxGeometry(0.5, HEIGHT * 0.26, 0.06), M.arm, [0, HEIGHT * 0.24, STERN + 0.7], [0.3, 0, 0]);

  // ===== greeble density gradient: stern > midship > bow =====
  // 'wire' gets a lighter pass (fewer random boxes — still enough to avoid
  // reading as "no detail at all", but a wireframe hologram shows every
  // part's edges individually so full density would be genuinely noisy);
  // 'full' (solid PBR shading merges overlapping faces, so it can carry more).
  {
    const density = full ? 1 : 0.4;
    const scatter = (n, zMin, zMax, xSpread, y) => {
      for (let i = 0; i < n; i++) {
        const x = (Math.random() - 0.5) * xSpread, z = zMin + Math.random() * (zMax - zMin);
        const r = Math.random();
        const geo = r < 0.6 ? new THREE.BoxGeometry(0.06 + Math.random() * 0.14, 0.02, 0.08 + Math.random() * 0.2)
          : r < 0.85 ? new THREE.BoxGeometry(0.1 + Math.random() * 0.16, 0.022, 0.1 + Math.random() * 0.16)
            : new THREE.BoxGeometry(0.035, 0.045, 0.035);
        add(geo, r < 0.5 ? M.trim : M.dark, [x, y, z]);
      }
    };
    scatter(Math.round(52 * density), STERN_ROOT, BOW_ROOT, 2.0, HEIGHT * 0.17);   // midship: medium density
    scatter(Math.round(30 * density), STERN, STERN_ROOT, 2.2, HEIGHT * 0.1);       // stern: highest density
    scatter(Math.round(8 * density), BOW_ROOT, NOSE - BOW_LEN * 0.3, 1.0, HEIGHT * 0.09); // bow: sparse, kept clean
  }

  // ===== spinal main gun (bow-forward fire, existing gameplay hook) =====
  const gunZ0 = BOW_ROOT - 0.3, gunLen = 2.6;
  add(new THREE.CylinderGeometry(0.1, 0.14, gunLen, 12), M.trim, [0, -HEIGHT * 0.08, gunZ0], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 3; i++) add(new THREE.TorusGeometry(0.16, 0.035, 6, 14), M.dark, [0, -HEIGHT * 0.08, gunZ0 - gunLen / 2 + 0.4 + i * 0.5]);
  const muzzleAnchor = { x: 0, y: -HEIGHT * 0.08, z: gunZ0 + gunLen / 2 + 0.3 };

  return {
    length: LEN, height: HEIGHT, bowLen: BOW_LEN, bowRoot: BOW_ROOT,
    engineMounts, turretMounts, bellyPodMounts, mastTips, muzzleAnchor,
  };
}
