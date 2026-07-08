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
 * 2026-07-08 refinement pass (per updated reference prompt): added a dorsal
 * turret row / multi-turreted gun platforms across the upper decks, an
 * exposed lattice/girder sensor mast beside the tower, a cluster of faceted
 * forward nozzle details on the fore hull, and a small open ventral bay with
 * a tiny multi-wheeled rover for scale. Still an approximation, not a
 * reconstruction — see scope note above.
 *
 * 2026-07-08 detail pass 2 (per a full reference screenshot): raised overall
 * part density toward the reference's "high-poly" look — more turret
 * platforms (13 mounts across 8 clusters, up from 8/5), a radar drum +
 * forward-projecting sensor dish arms + bridge window strip on the tower,
 * ribbed (multi-rib) engine nozzle bells instead of a single collar ring,
 * and a larger open ventral spaceframe (grid of structural bars, not a
 * solid recessed box) with a slightly more detailed rounded-cab rover.
 *
 * 2026-07-08 detail pass 3 (side-by-side comparison against the actual
 * render vs. the reference): claw-like layered bow tip (intake vanes +
 * 3-finger fan instead of a single cone), a comms antenna cluster + extra
 * scattered radar dish, multi-faceted wings with truss cross-braces and a
 * railed side-loading platform, an exposed longitudinal keel truss under
 * the main hull, stern panel lines + rear-facing gun emplacements + a stern
 * comms platform, and external piping runs + denser greeble.
 *
 * 2026-07-08 detail pass 4 (another side-by-side comparison, "structural
 * changes only"): tiered stepped sub-decks + a panel-line grid on the wings,
 * a bow main turret + 2 flanking secondary turrets + a forward sensor dish
 * cluster + fairing plates around the nozzle cluster, diagonal cross-braces
 * and a second lattice patch in the ventral engineering bay, a longitudinal
 * panel-line grid crossing the existing lateral seams, 2 more scattered
 * radar dishes, and greeble bumped again.
 *
 * Forward = +Z (matches odinHull.js / capitalShip3D.js / shipHologram.js).
 * mats: { hull, arm, dark, trim, glass, red, blue } — caller-owned materials.
 *
 *   const info = createCarrierHull(THREE, { add, mats, detail: 'full' });
 *   // info = { length, height, width, engineMounts, muzzleAnchor, prongTips,
 *   //          wingMounts, towerTip, turretMounts, bayMount }
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
    // layered intake vanes along the prong (perpendicular cross-section
    // plates, tapering toward the tip) — "articulated claw-like engine
    // component" detail instead of a plain smooth blade.
    for (let k = 1; k <= 3; k++) {
      const tt = k / 4, sc = 1 - tt * 0.35;
      const px = rootX + Math.sin(angle) * PRONG_LEN * tt, pz = BOW_ROOT + Math.cos(angle) * PRONG_LEN * tt;
      add(new THREE.BoxGeometry(0.5 * sc, HEIGHT * 0.26 * sc, 0.035), M.trim, [px, 0, pz], [0, angle, 0]);
    }
    // claw-like 3-finger tip fanning out from the same tip point (replaces a
    // single smooth cone) — all three share the tip's position, only their
    // own yaw differs, so the fan reads correctly without extra position math.
    for (const fa of [-0.24, 0, 0.24]) {
      add(new THREE.ConeGeometry(0.09, 0.55, 4), M.hull, [tipX, 0, tipZ + 0.3 * Math.cos(angle)], [Math.PI / 2, angle + fa, Math.PI / 4]);
    }
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

  // ===== bridge detail: radar drum, forward sensor dish arms, window strip =====
  add(new THREE.CylinderGeometry(0.62, 0.62, 0.16, 10), M.dark, [0, HEIGHT * 0.98, towerZ - 0.15]);            // radar drum
  add(new THREE.TorusGeometry(0.62, 0.025, 6, 16), M.trim, [0, HEIGHT * 0.98, towerZ - 0.15]);                 // drum rim
  for (const sx of [-1, 1]) {
    const armLen = 0.55, armZ = towerZ + 0.4;
    add(new THREE.CylinderGeometry(0.02, 0.02, armLen, 5), M.arm, [sx * 0.5, HEIGHT * 0.75, armZ], [Math.PI / 2, 0, 0]);        // sensor arm
    add(new THREE.CylinderGeometry(0.12, 0.02, 0.1, 8), M.trim, [sx * 0.5, HEIGHT * 0.75, armZ + armLen / 2], [Math.PI / 2, 0, 0]); // dish
  }
  for (let i = -3; i <= 3; i++) add(new THREE.BoxGeometry(0.12, 0.05, 0.02), M.dark, [i * 0.2, HEIGHT * 0.62, towerZ + 0.96]); // bridge window strip

  // comms antenna cluster around the spire base (varying-height thin rods +
  // beacon tips) and one extra scattered radar dish on the aft upper deck,
  // distinct from the bridge's own radar drum.
  for (const [ax, az, ah] of [[0.22, 0.15, 0.5], [-0.15, 0.22, 0.35], [0.1, -0.22, 0.42]]) {
    add(new THREE.CylinderGeometry(0.012, 0.012, ah, 4), M.trim, [ax, HEIGHT * 2.2 + ah / 2, towerZ + 0.05 + az]);
    add(new THREE.SphereGeometry(0.025, 5, 4), M.red, [ax, HEIGHT * 2.2 + ah, towerZ + 0.05 + az]);
  }
  add(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 10), M.dark, [-1.1, HEIGHT * 0.3, STERN + LEN_MAIN * 0.5]);
  add(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4), M.arm, [-1.1, HEIGHT * 0.3 + 0.15, STERN + LEN_MAIN * 0.5]);

  // ===== exposed lattice/girder sensor mast beside the tower — visible open =====
  // truss framework (two verticals + diagonal cross-braces), distinct from
  // the solid tower tiers, reads as "internal girder structure" in wireframe.
  {
    const latX = -0.5, latZ = towerZ - 0.9, latH = HEIGHT * 1.4, halfSpan = 0.12;
    for (const dx of [-halfSpan, halfSpan]) add(new THREE.CylinderGeometry(0.02, 0.02, latH, 5), M.arm, [latX + dx, latH / 2, latZ]);
    for (let i = 0; i < 4; i++) {
      const y0 = (latH / 4) * i, y1 = (latH / 4) * (i + 1);
      const dy = y1 - y0, dx = halfSpan * 2, len = Math.hypot(dx, dy), angle = Math.atan2(dy, dx);
      add(new THREE.BoxGeometry(len, 0.02, 0.02), M.trim, [latX, (y0 + y1) / 2, latZ], [0, 0, angle]);
    }
    add(new THREE.SphereGeometry(0.045, 6, 5), M.red, [latX, latH + 0.04, latZ]); // lattice mast tip beacon
  }

  // ===== multi-faceted swept hammerhead wings (both flanks, aft of the =====
  // tower), with truss cross-braces and a railed side-loading platform.
  const wingMounts = [];
  for (const sx of [-1, 1]) {
    const wx = sx * (WIDTH * 0.5 + 0.75), wz = STERN + LEN_MAIN * 0.62;
    add(new THREE.BoxGeometry(1.9, HEIGHT * 0.2, 1.5), M.arm, [wx, HEIGHT * 0.12, wz], [0, 0, sx * 0.16]);
    add(new THREE.BoxGeometry(0.5, HEIGHT * 0.16, 0.9), M.trim, [wx + sx * 0.9, HEIGHT * 0.12, wz - 0.3], [0, 0, sx * 0.1]); // outer tip fin
    add(new THREE.BoxGeometry(0.9, HEIGHT * 0.14, 1.1), M.hull, [wx - sx * 0.4, HEIGHT * 0.22, wz + 0.35], [0, 0, sx * 0.24]); // upper facet panel, different tilt
    // tiered stepped sub-decks stacked on the wing root (decreasing size)
    for (let t = 0; t < 2; t++) {
      const sc = 1 - t * 0.35;
      add(new THREE.BoxGeometry(1.1 * sc, HEIGHT * 0.1, 0.8 * sc), M.trim, [wx - sx * 0.1, HEIGHT * (0.28 + t * 0.12), wz + 0.1], [0, 0, sx * 0.1]);
    }
    // fine panel-line grid across the main wing panel
    for (let gi = -2; gi <= 2; gi++) add(new THREE.BoxGeometry(0.02, 0.02, 1.3), M.trim, [wx + gi * 0.32, HEIGHT * 0.13, wz], [0, 0, sx * 0.16]);
    // truss cross-braces under the wing
    for (let k = 0; k < 3; k++) {
      add(new THREE.CylinderGeometry(0.014, 0.014, 0.6, 4), M.arm, [wx + sx * (0.2 + k * 0.5), -HEIGHT * 0.02, wz - 0.6 + k * 0.1], [0, 0, sx * (0.5 + k * 0.15)]);
    }
    // side-loading platform with railing
    const platX = sx * (WIDTH * 0.5 + 0.15), platZ = wz + 0.9;
    add(new THREE.BoxGeometry(0.5, 0.03, 0.6), M.trim, [platX, -HEIGHT * 0.02, platZ]); // platform deck
    for (const rz of [-0.28, 0, 0.28]) add(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 4), M.arm, [platX + sx * 0.24, HEIGHT * 0.06, platZ + rz]); // railing posts
    add(new THREE.BoxGeometry(0.02, 0.02, 0.58), M.trim, [platX + sx * 0.24, HEIGHT * 0.12, platZ]); // top rail bar
    wingMounts.push({ x: wx, y: HEIGHT * 0.12, z: wz, side: sx });
  }

  // ===== dorsal turret row: numerous gun turrets + multi-turreted platforms =====
  // arrayed across the upper decks (structured accents, distinct from the
  // random fine greeble scatter below). 8 clusters / 13 total mounts —
  // denser than the first pass's 5 clusters / 8 mounts, per the reference's
  // "numerous detailed gun turrets and multi-turreted platforms".
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

  // ===== faceted forward nozzle cluster (fore-hull detail, distinct from =====
  // the stern propulsion cluster below), with weapon fairing plates around it.
  const noseNozzleZ = BOW_ROOT - LEN_MAIN * 0.06;
  for (const x of [-0.7, 0, 0.7]) {
    add(new THREE.CylinderGeometry(0.09, 0.14, 0.3, 6), M.dark, [x, -HEIGHT * 0.1, noseNozzleZ], [Math.PI / 2, 0, 0]); // faceted (6-sided) nozzle body
    add(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 6), M.trim, [x, -HEIGHT * 0.1, noseNozzleZ - 0.16]);                // nozzle rim
    add(new THREE.BoxGeometry(0.28, HEIGHT * 0.22, 0.4), M.arm, [x, -HEIGHT * 0.08, noseNozzleZ + 0.18]);              // weapon fairing housing
  }

  // ===== bow main turret + 2 flanking secondary turrets + forward sensor =====
  // dish cluster ("articulated weapon fairings, main/secondary turrets, and
  // precise sensor arrays" on the fore hull).
  const bowTurretZ = BOW_ROOT - LEN_MAIN * 0.02;
  add(new THREE.CylinderGeometry(0.22, 0.26, HEIGHT * 0.24, 10), M.trim, [0, HEIGHT * 0.35, bowTurretZ]);              // main turret dome
  add(new THREE.CylinderGeometry(0.03, 0.035, 0.6, 6), M.arm, [0, HEIGHT * 0.42, bowTurretZ + 0.3], [Math.PI / 2, 0, 0]); // main barrel
  turretMounts.push({ x: 0, y: HEIGHT * 0.35, z: bowTurretZ });
  for (const sx of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.14, 0.17, HEIGHT * 0.18, 8), M.trim, [sx * 0.55, HEIGHT * 0.28, bowTurretZ - 0.15]); // secondary turret dome
    for (const bx of [-0.05, 0.05]) add(new THREE.CylinderGeometry(0.02, 0.024, 0.32, 6), M.arm, [sx * 0.55 + bx, HEIGHT * 0.33, bowTurretZ], [Math.PI / 2, 0, 0]); // secondary barrels
    turretMounts.push({ x: sx * 0.55, y: HEIGHT * 0.28, z: bowTurretZ - 0.15 });
  }
  for (const [sax, saz] of [[-0.9, -0.3], [0.9, -0.3], [0, -0.5]]) {
    add(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 8), M.dark, [sax, HEIGHT * 0.15, bowTurretZ + saz]);              // sensor dish base
    add(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 4), M.arm, [sax, HEIGHT * 0.15 + 0.06, bowTurretZ + saz]);      // sensor stalk
  }

  // ===== large ventral cylinder (docking tube / main engine housing, the =====
  // reference's most prominent single accent besides the tower)
  const cylZ = STERN + LEN_MAIN * 0.3;
  add(new THREE.CylinderGeometry(0.58, 0.62, 1.7, 14), M.dark, [0, -HEIGHT * 0.2, cylZ], [Math.PI / 2, 0, 0]);
  add(new THREE.TorusGeometry(0.62, 0.06, 6, 16), M.trim, [0, -HEIGHT * 0.2, cylZ - 0.85]); // forward collar ring

  // ===== ventral open spaceframe with a small multi-wheeled rover — a scale =====
  // cue and "exposed internal lattice" detail from the reference. No CSG
  // available to cut a literal hole in the lofted hull skin, so the opening
  // is approximated as a grid of thin structural bars (not a solid floor)
  // recessed into the belly, offset from the ventral cylinder, with a tiny
  // rounded-cab vehicle resting inside.
  const bayX = 1.3, bayZ = cylZ + 0.15, bayY = -HEIGHT * 0.42, bayW = 1.3, bayD = 1.1, bayDepth = 0.3;
  const gx = 4, gz = 3; // grid divisions
  for (let i = 0; i <= gx; i++) {
    const x = bayX - bayW / 2 + (bayW / gx) * i;
    add(new THREE.BoxGeometry(0.02, bayDepth, bayD), M.trim, [x, bayY - bayDepth / 2, bayZ]); // longitudinal grid bar
  }
  for (let i = 0; i <= gz; i++) {
    const z = bayZ - bayD / 2 + (bayD / gz) * i;
    add(new THREE.BoxGeometry(bayW, bayDepth, 0.02), M.trim, [bayX, bayY - bayDepth / 2, z]); // lateral grid bar
  }
  for (const cx of [-bayW / 2, bayW / 2]) for (const cz of [-bayD / 2, bayD / 2]) {
    add(new THREE.CylinderGeometry(0.02, 0.02, bayDepth, 5), M.arm, [bayX + cx, bayY - bayDepth / 2, bayZ + cz]); // corner support post
  }
  // diagonal cross-bracing (X pattern) — "support trusses" reinforcing the
  // open grid, not just a flat set of perpendicular bars.
  {
    const braceLen = Math.hypot(bayW, bayD), braceAngle = Math.atan2(bayD, bayW);
    add(new THREE.BoxGeometry(braceLen, 0.02, 0.02), M.arm, [bayX, bayY - bayDepth, bayZ], [0, braceAngle, 0]);
    add(new THREE.BoxGeometry(braceLen, 0.02, 0.02), M.arm, [bayX, bayY - bayDepth, bayZ], [0, -braceAngle, 0]);
  }
  // second, smaller engineering-bay patch aft of the cylinder — broadens the
  // exposed undercarriage lattice beyond the single bay above.
  {
    const bay2X = -0.9, bay2Z = cylZ - 0.9, bay2W = 0.9, bay2D = 0.7, bay2Depth = bayDepth * 0.75;
    for (let i = 0; i <= 2; i++) { const x = bay2X - bay2W / 2 + (bay2W / 2) * i; add(new THREE.BoxGeometry(0.018, bay2Depth, bay2D), M.trim, [x, bayY - bay2Depth / 2, bay2Z]); }
    for (let i = 0; i <= 2; i++) { const z = bay2Z - bay2D / 2 + (bay2D / 2) * i; add(new THREE.BoxGeometry(bay2W, bay2Depth, 0.018), M.trim, [bay2X, bayY - bay2Depth / 2, z]); }
  }
  const roverY = bayY - bayDepth + 0.06;
  add(new THREE.BoxGeometry(0.18, 0.07, 0.11), M.glass, [bayX, roverY, bayZ]);                                          // rover body
  add(new THREE.SphereGeometry(0.045, 8, 6), M.glass, [bayX + 0.07, roverY + 0.02, bayZ]);                              // rounded cab front
  for (const rx of [-0.07, 0.07]) for (const rz of [-0.035, 0, 0.035]) {
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.022, 6), M.dark, [bayX + rx, roverY - 0.045, bayZ + rz], [Math.PI / 2, 0, 0]); // 6 wheels
  }
  const bayMount = { x: bayX, y: bayY, z: bayZ };

  // ===== exposed longitudinal keel truss under the main hull — a second, =====
  // broader truss network (distinct from the ventral spaceframe bay above)
  // running most of the belly length, per "intricate exposed truss work
  // under the main hull".
  {
    const keelY = -HEIGHT * 0.38;
    add(new THREE.BoxGeometry(0.05, 0.05, LEN_MAIN * 0.7), M.arm, [0, keelY, STERN + LEN_MAIN * 0.5]); // longitudinal keel beam
    for (let k = 0; k < 6; k++) {
      const kz = STERN + LEN_MAIN * (0.15 + k * 0.12);
      for (const sx of [-1, 1]) add(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 4), M.trim, [sx * 0.22, keelY, kz], [0, 0, sx * 0.5]);
    }
  }

  // ===== rear-section detail: stern panel lines, rear-facing gun =====
  // emplacements, and a stern comms array platform.
  for (let i = -2; i <= 2; i++) add(new THREE.BoxGeometry(0.02, HEIGHT * 0.5, 0.02), M.trim, [i * (WIDTH * 0.14), -HEIGHT * 0.05, STERN + 0.02]); // panel-line ribs
  for (const sx of [-1, 1]) {
    const gx = sx * WIDTH * 0.32, gz = STERN + 0.05;
    add(new THREE.CylinderGeometry(0.12, 0.14, HEIGHT * 0.16, 8), M.trim, [gx, HEIGHT * 0.35, gz]); // rear turret dome
    add(new THREE.CylinderGeometry(0.016, 0.02, 0.3, 6), M.arm, [gx, HEIGHT * 0.38, gz - 0.15], [Math.PI / 2, 0, 0]); // rear-facing barrel
  }
  add(new THREE.BoxGeometry(0.3, 0.04, 0.3), M.trim, [0, HEIGHT * 0.4, STERN + 0.2]);                                    // comms platform deck
  add(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 4), M.arm, [0, HEIGHT * 0.58, STERN + 0.2]);                       // comms mast
  add(new THREE.CylinderGeometry(0.1, 0.02, 0.08, 8), M.trim, [0, HEIGHT * 0.76, STERN + 0.2], [Math.PI / 2, 0, 0]);    // comms dish

  // ===== dorsal panel-seam lines + hull greeble (denser than odinHull's — =====
  // the reference is an unusually busy cutaway-style render), plus external
  // piping runs along the hull surface.
  for (let i = 0; i < 5; i++) add(new THREE.BoxGeometry(WIDTH * 0.7, 0.03, 0.2), M.trim, [0, HEIGHT * 0.22, STERN + LEN_MAIN * (0.15 + i * 0.16)]);
  for (const lx of [-1.5, -0.75, 0, 0.75, 1.5]) add(new THREE.BoxGeometry(0.025, 0.025, LEN_MAIN * 0.75), M.trim, [lx, HEIGHT * 0.22, STERN + LEN_MAIN * 0.52]); // longitudinal lines crossing the lateral seams above -> panel-line grid
  for (const px of [-1.6, -0.9, 0.9, 1.6]) add(new THREE.CylinderGeometry(0.02, 0.02, LEN_MAIN * 0.55, 6), M.arm, [px, HEIGHT * 0.2, STERN + LEN_MAIN * 0.55], [Math.PI / 2, 0, 0]);
  // 2 more scattered radar dishes (structured accents, distinct from the random greeble below)
  add(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 8), M.dark, [1.3, HEIGHT * 0.28, STERN + LEN_MAIN * 0.2]);
  add(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 4), M.arm, [1.3, HEIGHT * 0.28 + 0.11, STERN + LEN_MAIN * 0.2]);
  add(new THREE.CylinderGeometry(0.14, 0.14, 0.035, 8), M.dark, [0.6, HEIGHT * 0.3, BOW_ROOT - LEN_MAIN * 0.2]);
  add(new THREE.CylinderGeometry(0.013, 0.013, 0.2, 4), M.arm, [0.6, HEIGHT * 0.3 + 0.1, BOW_ROOT - LEN_MAIN * 0.2]);
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
    scatter(Math.round(140 * density), STERN + LEN_MAIN * 0.1, BOW_ROOT - LEN_MAIN * 0.1, WIDTH * 0.75, HEIGHT * 0.24);
    scatter(Math.round(70 * density), STERN, STERN + LEN_MAIN * 0.3, WIDTH * 0.55, HEIGHT * 0.1);
  }

  // ===== stern engine mounts: ribbed nozzle bells (flat row across the =====
  // wide stern face) — stacked tapering torus rings around a tapering
  // cylinder read as "ribbed" in wireframe, replacing the earlier single
  // collar ring.
  const engineMounts = [];
  const EN_N = 6;
  for (let i = 0; i < EN_N; i++) {
    const x = (i - (EN_N - 1) / 2) * (WIDTH * 0.16);
    add(new THREE.BoxGeometry(0.42, HEIGHT * 0.32, 0.6), M.trim, [x, -HEIGHT * 0.05, STERN + 0.3]); // housing
    add(new THREE.CylinderGeometry(0.19, 0.24, 0.42, 10), M.dark, [x, -HEIGHT * 0.05, STERN - 0.02], [Math.PI / 2, 0, 0]); // nozzle bell
    for (let j = 0; j < 4; j++) {
      const t = j / 3, r = 0.18 + t * 0.075;
      add(new THREE.TorusGeometry(r, 0.015, 5, 12), M.arm, [x, -HEIGHT * 0.05, STERN - 0.02 - t * 0.38]); // rib
    }
    engineMounts.push({ x, y: -HEIGHT * 0.05, z: STERN });
  }

  // ===== bow-centre muzzle (between the two prongs — preserves the existing =====
  // main-gun-fire gameplay hook shipHologram.js's frame() loop expects)
  const muzzleAnchor = { x: 0, y: 0, z: BOW_ROOT + PRONG_LEN * 0.25 };

  return {
    length: LENGTH, height: HEIGHT, width: WIDTH,
    engineMounts, muzzleAnchor, prongTips, wingMounts, towerTip, turretMounts, bayMount,
  };
}
