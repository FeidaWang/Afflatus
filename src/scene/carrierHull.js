/**
 * "Wraith" carrier hull — procedural geometry for the login-screen ship
 * hologram (shipHologram.js's default hull).
 *
 * 2026-07-08, redesign pass 5: the user pointed at Anvil Aerospace's real
 * Odin battlecruiser (RSI comm-link 21133 + the Star Citizen wiki spec
 * page) as "the standard" to model this hull against, superseding the
 * earlier passes' basis (a hand-drawn/pasted wireframe reference image).
 * Facts pulled from that spec and encoded here:
 *   - Hull proportions: length 752 m / width 222 m / height 213 m, i.e.
 *     length:height ~= 3.53:1 and width:height ~= 1.04:1 — a chunky,
 *     nearly-square-cross-section block, NOT the wide flat pancake shape
 *     the earlier passes used (that was ~8-10:1 length:height, ~3.7:1
 *     width:height — both wrong once the real numbers were known).
 *   - "The entire front section of the Odin is dedicated to a fixed beam
 *     weapon that extends large and heavily armored radiators... and
 *     terminates in twelve emitters around the nose of the hull" -> the
 *     bow is now a tapering beam-cannon housing with a 12-emitter ring and
 *     flanking radiator fins, replacing the earlier twin forked prongs
 *     (which had no basis in the real ship).
 *   - "Internal hangar complex... large rear bay door... openly exposed to
 *     the upper level" -> kept/reframed the existing ventral open
 *     spaceframe + rover as a stylised exterior cutaway of this hangar,
 *     with an added rear bay-door outline.
 *   - "Twenty [VLS] tubes" -> new dorsal vertical-launch tube grid.
 *   - "Axial tram... supports rapid transport through the length of the
 *     ship" -> new thin dorsal spine + cross-ties suggesting the tram rail.
 *   - "23 STS turrets + 10 ASA turrets + 42 point-defense clusters" -> far
 *     too many to model individually in a small hologram; kept the
 *     existing dense-but-representative turret layout (16 mounts) rather
 *     than literally placing 75.
 * Honest scope note (still true): this is a stylised hologram, not a
 * geometric reconstruction of the real ship — proportions and the bow beam
 * housing now match the spec, but exact turret counts, the full hangar
 * interior, and fine hull plating are hand-approximated. There is no CSG
 * available in this sandbox to cut real openings in the hull skin either.
 * NOTE: this is unrelated to the separate, older `odinHull.js` (used via
 * `?ship=odin`), which models a different, earlier hand-drawn slender
 * blade-bow silhouette that predates this spec-accurate pass and is kept
 * only as a legacy preview variant.
 *
 * Same DOM/WebGL-free contract as odinHull.js: only calls the
 * caller-supplied `add(geo, mat, t, r, s)`, so proportions are
 * unit-testable headlessly (tests/carrierHull.test.js) even though the
 * actual render can't be visually verified in this sandbox.
 *
 * Forward = +Z (matches odinHull.js / capitalShip3D.js / shipHologram.js).
 * mats: { hull, arm, dark, trim, glass, red, blue } — caller-owned materials.
 *
 *   const info = createCarrierHull(THREE, { add, mats, detail: 'full' });
 *   // info = { length, height, width, engineMounts, muzzleAnchor,
 *   //          emitterMounts, wingMounts, towerTip, turretMounts,
 *   //          bayMount, vlsMounts }
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
  // beam-nose housing attaches here as a separate part, not a continuation
  // of the loft)
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

  // ---- proportions: real Odin length:width:height = 752:222:213, i.e.
  // length:height ~3.53:1, width:height ~1.04:1 — a chunky near-square
  // cross-section block, not a wide flat pancake. ----
  const STERN = -4.6, BOW_ROOT = 4.0;              // main-hull loft span
  const LEN_MAIN = BOW_ROOT - STERN;                // 8.6
  const HEIGHT = 2.6;
  const WIDTH = 2.7;                                // WIDTH/HEIGHT ~= 1.04
  const NOSE_LEN = 0.6;                             // beam-housing length past BOW_ROOT
  const LENGTH = LEN_MAIN + NOSE_LEN;                // 9.2 -> LENGTH/HEIGHT ~= 3.54

  // ===== main hull: one continuous lofted skin, stern -> midship -> bow root =====
  add(buildHullLoftGeometry(THREE, [
    { z: STERN, halfW: WIDTH * 0.34, halfH: HEIGHT * 0.36 },
    { z: STERN + LEN_MAIN * 0.15, halfW: WIDTH * 0.46, halfH: HEIGHT * 0.46 },
    { z: STERN + LEN_MAIN * 0.5, halfW: WIDTH * 0.5, halfH: HEIGHT * 0.5 },   // widest/tallest point, midship
    { z: BOW_ROOT - LEN_MAIN * 0.12, halfW: WIDTH * 0.42, halfH: HEIGHT * 0.44 },
    { z: BOW_ROOT, halfW: WIDTH * 0.24, halfH: HEIGHT * 0.3 },
  ]), M.hull, [0, 0, 0]);

  // ===== bow beam-cannon housing: "the entire front section is dedicated =====
  // to a fixed beam weapon" — a tapering nose block, two large flanking
  // radiator fin panels, and a ring of 12 emitters around the tip.
  const noseZ = BOW_ROOT + NOSE_LEN;
  add(new THREE.CylinderGeometry(0.1, WIDTH * 0.24, NOSE_LEN, 12), M.hull, [0, 0, BOW_ROOT + NOSE_LEN / 2], [Math.PI / 2, 0, 0]); // tapering nose block
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.05, HEIGHT * 0.6, NOSE_LEN * 1.4), M.arm, [sx * (WIDTH * 0.3), 0, BOW_ROOT + NOSE_LEN * 0.35]); // radiator fin panel
    for (let f = 0; f < 4; f++) add(new THREE.BoxGeometry(0.32, 0.025, 0.025), M.trim, [sx * (WIDTH * 0.3 + 0.16), -HEIGHT * 0.22 + f * (HEIGHT * 0.15), BOW_ROOT + NOSE_LEN * 0.35]); // radiator fin ridges
  }
  const emitterMounts = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, ex = Math.cos(a) * 0.13, ey = Math.sin(a) * 0.13;
    add(new THREE.CylinderGeometry(0.028, 0.032, 0.14, 6), M.dark, [ex, ey, noseZ], [Math.PI / 2, 0, 0]); // emitter nozzle
    emitterMounts.push({ x: ex, y: ey, z: noseZ });
  }

  // ===== central stepped tower: wide base -> narrower tiers -> spire + =====
  // secondary mast
  const towerZ = STERN + LEN_MAIN * 0.42;
  add(new THREE.BoxGeometry(1.1, HEIGHT * 0.5, 1.25), M.arm, [0, HEIGHT * 0.62, towerZ]);
  add(new THREE.BoxGeometry(0.8, HEIGHT * 0.5, 0.9), M.hull, [0, HEIGHT * 1.02, towerZ + 0.03]);
  add(new THREE.BoxGeometry(0.5, HEIGHT * 0.4, 0.6), M.trim, [0, HEIGHT * 1.36, towerZ + 0.07]);
  add(new THREE.BoxGeometry(0.28, HEIGHT * 0.26, 0.34), M.dark, [0, HEIGHT * 1.62, towerZ + 0.07]);
  add(new THREE.ConeGeometry(0.19, HEIGHT * 0.75, 6), M.trim, [0, HEIGHT * 1.95, towerZ + 0.03]);     // main spire
  add(new THREE.CylinderGeometry(0.03, 0.055, HEIGHT * 0.55, 6), M.trim, [0.24, HEIGHT * 1.45, towerZ - 0.16]); // secondary mast
  add(new THREE.SphereGeometry(0.035, 6, 5), M.red, [0.24, HEIGHT * 1.45 + HEIGHT * 0.28, towerZ - 0.16]);      // mast tip beacon
  const towerTip = { x: 0, y: HEIGHT * 1.95 + HEIGHT * 0.38, z: towerZ + 0.03 };

  // ===== bridge detail: radar drum, forward sensor dish arms, window strip =====
  add(new THREE.CylinderGeometry(0.4, 0.4, 0.11, 10), M.dark, [0, HEIGHT * 0.88, towerZ - 0.1]);           // radar drum
  add(new THREE.TorusGeometry(0.4, 0.017, 6, 16), M.trim, [0, HEIGHT * 0.88, towerZ - 0.1]);                // drum rim
  for (const sx of [-1, 1]) {
    const armLen = 0.36, armZ = towerZ + 0.3;
    add(new THREE.CylinderGeometry(0.014, 0.014, armLen, 5), M.arm, [sx * 0.32, HEIGHT * 0.68, armZ], [Math.PI / 2, 0, 0]);         // sensor arm
    add(new THREE.CylinderGeometry(0.08, 0.014, 0.07, 8), M.trim, [sx * 0.32, HEIGHT * 0.68, armZ + armLen / 2], [Math.PI / 2, 0, 0]); // dish
  }
  for (let i = -2; i <= 2; i++) add(new THREE.BoxGeometry(0.08, 0.035, 0.015), M.dark, [i * 0.13, HEIGHT * 0.55, towerZ + 0.58]); // bridge window strip

  // comms antenna cluster around the spire base (varying-height thin rods +
  // beacon tips) and one extra scattered radar dish on the aft upper deck.
  for (const [ax, az, ah] of [[0.16, 0.1, 0.4], [-0.11, 0.16, 0.28], [0.07, -0.16, 0.34]]) {
    add(new THREE.CylinderGeometry(0.009, 0.009, ah, 4), M.trim, [ax, HEIGHT * 1.95 + ah / 2, towerZ + 0.03 + az]);
    add(new THREE.SphereGeometry(0.02, 5, 4), M.red, [ax, HEIGHT * 1.95 + ah, towerZ + 0.03 + az]);
  }
  add(new THREE.CylinderGeometry(0.15, 0.15, 0.035, 10), M.dark, [-0.75, HEIGHT * 0.24, STERN + LEN_MAIN * 0.5]);
  add(new THREE.CylinderGeometry(0.014, 0.014, 0.22, 4), M.arm, [-0.75, HEIGHT * 0.24 + 0.11, STERN + LEN_MAIN * 0.5]);

  // ===== exposed lattice/girder sensor mast beside the tower — visible open =====
  // truss framework, distinct from the solid tower tiers.
  {
    const latX = -0.34, latZ = towerZ - 0.65, latH = HEIGHT * 1.1, halfSpan = 0.09;
    for (const dx of [-halfSpan, halfSpan]) add(new THREE.CylinderGeometry(0.016, 0.016, latH, 5), M.arm, [latX + dx, latH / 2, latZ]);
    for (let i = 0; i < 4; i++) {
      const y0 = (latH / 4) * i, y1 = (latH / 4) * (i + 1);
      const dy = y1 - y0, dx = halfSpan * 2, len = Math.hypot(dx, dy), angle = Math.atan2(dy, dx);
      add(new THREE.BoxGeometry(len, 0.016, 0.016), M.trim, [latX, (y0 + y1) / 2, latZ], [0, 0, angle]);
    }
    add(new THREE.SphereGeometry(0.035, 6, 5), M.red, [latX, latH + 0.03, latZ]); // lattice mast tip beacon
  }

  // ===== multi-faceted swept wings (both flanks, aft of the tower), with =====
  // truss cross-braces and a railed side-loading platform. Carried over from
  // the earlier hand-drawn reference silhouette — the real Odin spec doesn't
  // call these out specifically, but doesn't contradict them either, so
  // they're kept as a stylistic flourish (footprint tightened to the new,
  // narrower hull width).
  const wingMounts = [];
  for (const sx of [-1, 1]) {
    const wx = sx * (WIDTH * 0.5 + 0.5), wz = STERN + LEN_MAIN * 0.62;
    add(new THREE.BoxGeometry(1.35, HEIGHT * 0.16, 1.05), M.arm, [wx, HEIGHT * 0.1, wz], [0, 0, sx * 0.16]);
    add(new THREE.BoxGeometry(0.35, HEIGHT * 0.14, 0.65), M.trim, [wx + sx * 0.62, HEIGHT * 0.1, wz - 0.22], [0, 0, sx * 0.1]); // outer tip fin
    add(new THREE.BoxGeometry(0.65, HEIGHT * 0.12, 0.8), M.hull, [wx - sx * 0.28, HEIGHT * 0.18, wz + 0.26], [0, 0, sx * 0.24]); // upper facet panel, different tilt
    // tiered stepped sub-decks stacked on the wing root (decreasing size)
    for (let t = 0; t < 2; t++) {
      const sc = 1 - t * 0.35;
      add(new THREE.BoxGeometry(0.8 * sc, HEIGHT * 0.09, 0.58 * sc), M.trim, [wx - sx * 0.07, HEIGHT * (0.24 + t * 0.1), wz + 0.08], [0, 0, sx * 0.1]);
    }
    // fine panel-line grid across the main wing panel
    for (let gi = -2; gi <= 2; gi++) add(new THREE.BoxGeometry(0.016, 0.016, 0.95), M.trim, [wx + gi * 0.23, HEIGHT * 0.11, wz], [0, 0, sx * 0.16]);
    // truss cross-braces under the wing
    for (let k = 0; k < 3; k++) {
      add(new THREE.CylinderGeometry(0.011, 0.011, 0.44, 4), M.arm, [wx + sx * (0.14 + k * 0.36), -HEIGHT * 0.02, wz - 0.44 + k * 0.07], [0, 0, sx * (0.5 + k * 0.15)]);
    }
    // side-loading platform with railing
    const platX = sx * (WIDTH * 0.5 + 0.1), platZ = wz + 0.65;
    add(new THREE.BoxGeometry(0.35, 0.025, 0.42), M.trim, [platX, -HEIGHT * 0.02, platZ]); // platform deck
    for (const rz of [-0.2, 0, 0.2]) add(new THREE.CylinderGeometry(0.009, 0.009, 0.1, 4), M.arm, [platX + sx * 0.17, HEIGHT * 0.04, platZ + rz]); // railing posts
    add(new THREE.BoxGeometry(0.015, 0.015, 0.4), M.trim, [platX + sx * 0.17, HEIGHT * 0.09, platZ]); // top rail bar
    wingMounts.push({ x: wx, y: HEIGHT * 0.1, z: wz, side: sx });
  }

  // ===== dorsal turret row: representative sample of the real ship's dense =====
  // turret battery (23 STS + 10 ASA + 42 point-defense — far too many to
  // model individually here) — 8 clusters / 13 mounts across the upper decks.
  const turretMounts = [];
  const turretPlatforms = [
    { z: STERN + LEN_MAIN * 0.08, n: 2 },
    { z: STERN + LEN_MAIN * 0.20, n: 1 },
    { z: STERN + LEN_MAIN * 0.34, n: 3 },
    { z: STERN + LEN_MAIN * 0.48, n: 1 },
    { z: STERN + LEN_MAIN * 0.60, n: 2 },
    { z: STERN + LEN_MAIN * 0.74, n: 1 },
    { z: STERN + LEN_MAIN * 0.86, n: 2 },
    { z: BOW_ROOT - LEN_MAIN * 0.06, n: 1 },
  ];
  for (const p of turretPlatforms) {
    const n = p.n;
    const xs = n === 1 ? [0] : n === 2 ? [-0.32, 0.32] : [-0.42, 0, 0.42];
    if (n > 1) add(new THREE.BoxGeometry(0.5 + n * 0.35, HEIGHT * 0.16, 0.55), M.arm, [0, HEIGHT * 0.26, p.z]); // shared platform base
    const domeY = HEIGHT * (n > 1 ? 0.4 : 0.3);
    for (const x of xs) {
      add(new THREE.CylinderGeometry(0.13, 0.15, HEIGHT * 0.18, 8), M.trim, [x, domeY, p.z]); // turret dome
      for (const bx of [x - 0.055, x + 0.055]) add(new THREE.CylinderGeometry(0.018, 0.022, 0.34, 6), M.arm, [bx, domeY + HEIGHT * 0.05, p.z + 0.16], [Math.PI / 2, 0, 0]); // twin barrels
      turretMounts.push({ x, y: domeY, z: p.z });
    }
  }

  // ===== bow turret battery (STS/ASA representative) — positioned well aft =====
  // of the beam-cannon nose ("the entire front section is dedicated to the
  // beam weapon"), not at the very tip.
  const bowTurretZ = BOW_ROOT - LEN_MAIN * 0.1;
  add(new THREE.CylinderGeometry(0.2, 0.24, HEIGHT * 0.22, 10), M.trim, [0, HEIGHT * 0.34, bowTurretZ]);               // main turret dome
  add(new THREE.CylinderGeometry(0.028, 0.032, 0.5, 6), M.arm, [0, HEIGHT * 0.4, bowTurretZ + 0.26], [Math.PI / 2, 0, 0]); // main barrel
  turretMounts.push({ x: 0, y: HEIGHT * 0.34, z: bowTurretZ });
  for (const sx of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.13, 0.16, HEIGHT * 0.17, 8), M.trim, [sx * 0.5, HEIGHT * 0.27, bowTurretZ - 0.14]); // secondary turret dome
    for (const bx of [-0.045, 0.045]) add(new THREE.CylinderGeometry(0.018, 0.022, 0.28, 6), M.arm, [sx * 0.5 + bx, HEIGHT * 0.32, bowTurretZ], [Math.PI / 2, 0, 0]); // secondary barrels
    turretMounts.push({ x: sx * 0.5, y: HEIGHT * 0.27, z: bowTurretZ - 0.14 });
  }
  for (const [sax, saz] of [[-0.75, -0.26], [0.75, -0.26], [0, -0.42]]) {
    add(new THREE.CylinderGeometry(0.08, 0.08, 0.026, 8), M.dark, [sax, HEIGHT * 0.14, bowTurretZ + saz]);             // sensor dish base
    add(new THREE.CylinderGeometry(0.007, 0.007, 0.1, 4), M.arm, [sax, HEIGHT * 0.14 + 0.05, bowTurretZ + saz]);       // sensor stalk
  }

  // ===== dorsal vertical-launch system: "twenty tubes... size 12 =====
  // torpedoes" — a 4x5 grid of tube caps on the upper deck.
  const vlsMounts = [];
  const vlsZ0 = STERN + LEN_MAIN * 0.56, VLS_ROWS = 4, VLS_COLS = 5;
  for (let r = 0; r < VLS_ROWS; r++) {
    for (let c = 0; c < VLS_COLS; c++) {
      const vx = (c - (VLS_COLS - 1) / 2) * 0.22, vz = vlsZ0 + r * 0.22;
      add(new THREE.CylinderGeometry(0.05, 0.058, 0.04, 8), M.dark, [vx, HEIGHT * 0.31, vz]);
      add(new THREE.TorusGeometry(0.054, 0.01, 5, 10), M.trim, [vx, HEIGHT * 0.31, vz]);
      vlsMounts.push({ x: vx, y: HEIGHT * 0.31, z: vz });
    }
  }

  // ===== axial tram spine: "a parallel tram system supports rapid =====
  // transport through the length of the ship" — a thin dorsal rail + cross-ties.
  add(new THREE.BoxGeometry(0.045, 0.035, LEN_MAIN * 0.85), M.trim, [0, HEIGHT * 0.05, STERN + LEN_MAIN * 0.5]);
  for (let i = 0; i < 10; i++) add(new THREE.BoxGeometry(0.12, 0.018, 0.018), M.arm, [0, HEIGHT * 0.075, STERN + LEN_MAIN * (0.1 + i * 0.08)]);

  // ===== large ventral cylinder (cargo-lift / main hangar shaft accent) =====
  const cylZ = STERN + LEN_MAIN * 0.3;
  add(new THREE.CylinderGeometry(0.42, 0.45, 1.25, 14), M.dark, [0, -HEIGHT * 0.2, cylZ], [Math.PI / 2, 0, 0]);
  add(new THREE.TorusGeometry(0.45, 0.045, 6, 16), M.trim, [0, -HEIGHT * 0.2, cylZ - 0.62]); // forward collar ring

  // ===== ventral open spaceframe with a small multi-wheeled rover — a =====
  // stylised exterior cutaway of the spec's "internal hangar complex...
  // openly exposed to the upper level", with a rear bay-door outline. No
  // CSG available to cut a literal hole in the lofted hull skin, so the
  // opening is approximated as a grid of thin structural bars (not a solid
  // floor) recessed into the belly, with a tiny rounded-cab vehicle
  // (ground support tug) resting inside.
  const bayX = 1.0, bayZ = cylZ + 0.12, bayY = -HEIGHT * 0.42, bayW = 1.0, bayD = 0.85, bayDepth = 0.26;
  const bgx = 4, bgz = 3; // grid divisions
  for (let i = 0; i <= bgx; i++) {
    const x = bayX - bayW / 2 + (bayW / bgx) * i;
    add(new THREE.BoxGeometry(0.016, bayDepth, bayD), M.trim, [x, bayY - bayDepth / 2, bayZ]); // longitudinal grid bar
  }
  for (let i = 0; i <= bgz; i++) {
    const z = bayZ - bayD / 2 + (bayD / bgz) * i;
    add(new THREE.BoxGeometry(bayW, bayDepth, 0.016), M.trim, [bayX, bayY - bayDepth / 2, z]); // lateral grid bar
  }
  for (const cx of [-bayW / 2, bayW / 2]) for (const cz of [-bayD / 2, bayD / 2]) {
    add(new THREE.CylinderGeometry(0.016, 0.016, bayDepth, 5), M.arm, [bayX + cx, bayY - bayDepth / 2, bayZ + cz]); // corner support post
  }
  // diagonal cross-bracing (X pattern) — support trusses reinforcing the open grid
  {
    const braceLen = Math.hypot(bayW, bayD), braceAngle = Math.atan2(bayD, bayW);
    add(new THREE.BoxGeometry(braceLen, 0.016, 0.016), M.arm, [bayX, bayY - bayDepth, bayZ], [0, braceAngle, 0]);
    add(new THREE.BoxGeometry(braceLen, 0.016, 0.016), M.arm, [bayX, bayY - bayDepth, bayZ], [0, -braceAngle, 0]);
  }
  // rear bay-door outline ("a large rear bay door")
  add(new THREE.BoxGeometry(0.95, 0.025, 0.025), M.trim, [0, -HEIGHT * 0.08, STERN + 0.42]);
  add(new THREE.BoxGeometry(0.025, HEIGHT * 0.42, 0.025), M.trim, [-0.475, -HEIGHT * 0.08 + HEIGHT * 0.21, STERN + 0.42]);
  add(new THREE.BoxGeometry(0.025, HEIGHT * 0.42, 0.025), M.trim, [0.475, -HEIGHT * 0.08 + HEIGHT * 0.21, STERN + 0.42]);
  // second, smaller lattice patch aft of the cylinder — broadens the exposed
  // undercarriage beyond the single bay above.
  {
    const bay2X = -0.7, bay2Z = cylZ - 0.7, bay2W = 0.7, bay2D = 0.55, bay2Depth = bayDepth * 0.75;
    for (let i = 0; i <= 2; i++) { const x = bay2X - bay2W / 2 + (bay2W / 2) * i; add(new THREE.BoxGeometry(0.014, bay2Depth, bay2D), M.trim, [x, bayY - bay2Depth / 2, bay2Z]); }
    for (let i = 0; i <= 2; i++) { const z = bay2Z - bay2D / 2 + (bay2D / 2) * i; add(new THREE.BoxGeometry(bay2W, bay2Depth, 0.014), M.trim, [bay2X, bayY - bay2Depth / 2, z]); }
  }
  const roverY = bayY - bayDepth + 0.05;
  add(new THREE.BoxGeometry(0.14, 0.055, 0.09), M.glass, [bayX, roverY, bayZ]);                                          // rover body
  add(new THREE.SphereGeometry(0.036, 8, 6), M.glass, [bayX + 0.056, roverY + 0.016, bayZ]);                             // rounded cab front
  for (const rx of [-0.056, 0.056]) for (const rz of [-0.028, 0, 0.028]) {
    add(new THREE.CylinderGeometry(0.016, 0.016, 0.018, 6), M.dark, [bayX + rx, roverY - 0.036, bayZ + rz], [Math.PI / 2, 0, 0]); // 6 wheels
  }
  const bayMount = { x: bayX, y: bayY, z: bayZ };

  // ===== exposed longitudinal keel truss under the main hull — a second, =====
  // broader truss network (distinct from the ventral spaceframe bay above)
  // running most of the belly length.
  {
    const keelY = -HEIGHT * 0.38;
    add(new THREE.BoxGeometry(0.04, 0.04, LEN_MAIN * 0.7), M.arm, [0, keelY, STERN + LEN_MAIN * 0.5]); // longitudinal keel beam
    for (let k = 0; k < 6; k++) {
      const kz = STERN + LEN_MAIN * (0.15 + k * 0.12);
      for (const sx of [-1, 1]) add(new THREE.CylinderGeometry(0.01, 0.01, 0.4, 4), M.trim, [sx * 0.18, keelY, kz], [0, 0, sx * 0.5]);
    }
  }

  // ===== rear-section detail: stern panel lines, rear-facing gun =====
  // emplacements, and a stern comms array platform.
  for (let i = -2; i <= 2; i++) add(new THREE.BoxGeometry(0.018, HEIGHT * 0.5, 0.018), M.trim, [i * (WIDTH * 0.14), -HEIGHT * 0.05, STERN + 0.02]); // panel-line ribs
  for (const sx of [-1, 1]) {
    const rgx = sx * WIDTH * 0.32, rgz = STERN + 0.05;
    add(new THREE.CylinderGeometry(0.1, 0.12, HEIGHT * 0.15, 8), M.trim, [rgx, HEIGHT * 0.34, rgz]); // rear turret dome
    add(new THREE.CylinderGeometry(0.014, 0.018, 0.26, 6), M.arm, [rgx, HEIGHT * 0.37, rgz - 0.13], [Math.PI / 2, 0, 0]); // rear-facing barrel
  }
  add(new THREE.BoxGeometry(0.26, 0.035, 0.26), M.trim, [0, HEIGHT * 0.38, STERN + 0.18]);                                // comms platform deck
  add(new THREE.CylinderGeometry(0.011, 0.011, 0.3, 4), M.arm, [0, HEIGHT * 0.54, STERN + 0.18]);                        // comms mast
  add(new THREE.CylinderGeometry(0.09, 0.018, 0.07, 8), M.trim, [0, HEIGHT * 0.7, STERN + 0.18], [Math.PI / 2, 0, 0]);   // comms dish

  // ===== dorsal panel-seam lines + hull greeble, plus external piping runs =====
  // along the hull surface.
  for (let i = 0; i < 5; i++) add(new THREE.BoxGeometry(WIDTH * 0.7, 0.03, 0.2), M.trim, [0, HEIGHT * 0.22, STERN + LEN_MAIN * (0.15 + i * 0.16)]);
  for (const lx of [-0.9, -0.45, 0, 0.45, 0.9]) add(new THREE.BoxGeometry(0.02, 0.02, LEN_MAIN * 0.75), M.trim, [lx, HEIGHT * 0.22, STERN + LEN_MAIN * 0.52]); // longitudinal lines crossing the lateral seams above -> panel-line grid
  for (const px of [-1.0, -0.55, 0.55, 1.0]) add(new THREE.CylinderGeometry(0.016, 0.016, LEN_MAIN * 0.55, 6), M.arm, [px, HEIGHT * 0.2, STERN + LEN_MAIN * 0.55], [Math.PI / 2, 0, 0]);
  // 2 more scattered radar dishes (structured accents, distinct from the random greeble below)
  add(new THREE.CylinderGeometry(0.13, 0.13, 0.032, 8), M.dark, [0.9, HEIGHT * 0.27, STERN + LEN_MAIN * 0.2]);
  add(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 4), M.arm, [0.9, HEIGHT * 0.27 + 0.09, STERN + LEN_MAIN * 0.2]);
  add(new THREE.CylinderGeometry(0.11, 0.11, 0.028, 8), M.dark, [0.5, HEIGHT * 0.29, BOW_ROOT - LEN_MAIN * 0.24]);
  add(new THREE.CylinderGeometry(0.01, 0.01, 0.16, 4), M.arm, [0.5, HEIGHT * 0.29 + 0.08, BOW_ROOT - LEN_MAIN * 0.24]);
  {
    const density = full ? 1 : 0.45;
    const scatter = (n, zMin, zMax, xSpread, y) => {
      for (let i = 0; i < n; i++) {
        const x = (Math.random() - 0.5) * xSpread, z = zMin + Math.random() * (zMax - zMin);
        const r = Math.random();
        const geo = r < 0.55 ? new THREE.BoxGeometry(0.06 + Math.random() * 0.14, 0.02, 0.08 + Math.random() * 0.2)
          : r < 0.82 ? new THREE.BoxGeometry(0.1 + Math.random() * 0.16, 0.022, 0.1 + Math.random() * 0.16)
            : new THREE.BoxGeometry(0.035, 0.045, 0.035);
        add(geo, r < 0.5 ? M.trim : M.dark, [x, y, z]);
      }
    };
    scatter(Math.round(140 * density), STERN + LEN_MAIN * 0.1, BOW_ROOT - LEN_MAIN * 0.06, WIDTH * 0.78, HEIGHT * 0.24);
    scatter(Math.round(70 * density), STERN, STERN + LEN_MAIN * 0.3, WIDTH * 0.6, HEIGHT * 0.1);
  }

  // ===== stern engine mounts: ribbed nozzle bells (flat row across the =====
  // stern face) — representative sample of the spec's 13 main + 13 retro +
  // 32 maneuvering thrusters.
  const engineMounts = [];
  const EN_N = 6;
  for (let i = 0; i < EN_N; i++) {
    const x = (i - (EN_N - 1) / 2) * (WIDTH * 0.16);
    add(new THREE.BoxGeometry(0.32, HEIGHT * 0.26, 0.46), M.trim, [x, -HEIGHT * 0.05, STERN + 0.24]); // housing
    add(new THREE.CylinderGeometry(0.15, 0.19, 0.34, 10), M.dark, [x, -HEIGHT * 0.05, STERN - 0.02], [Math.PI / 2, 0, 0]); // nozzle bell
    for (let j = 0; j < 4; j++) {
      const t = j / 3, r = 0.14 + t * 0.06;
      add(new THREE.TorusGeometry(r, 0.012, 5, 12), M.arm, [x, -HEIGHT * 0.05, STERN - 0.02 - t * 0.3]); // rib
    }
    engineMounts.push({ x, y: -HEIGHT * 0.05, z: STERN });
  }

  // ===== bow-centre muzzle: the twelve-emitter beam's focal point, at the =====
  // nose tip (preserves the existing main-gun-fire gameplay hook
  // shipHologram.js's frame() loop expects).
  const muzzleAnchor = { x: 0, y: 0, z: noseZ + 0.07 };

  return {
    length: LENGTH, height: HEIGHT, width: WIDTH,
    engineMounts, muzzleAnchor, emitterMounts, wingMounts, towerTip, turretMounts, bayMount, vlsMounts,
  };
}
