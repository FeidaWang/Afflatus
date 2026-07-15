/**
 * Wedge Cruiser hull — a long flat-decked "dagger" capital-ship silhouette:
 * broad flat stern tapering sharply to a narrow bow point, twin command
 * towers on the aft dorsal spine, a centerline dorsal trench, a wide
 * stern-spanning engine row. This is the same archetype popularized by
 * Star Wars' Star Destroyers — an ORIGINAL execution of that general
 * silhouette (proportions/greeble/naming all this file's own), not a copy
 * of any specific studio asset or insignia, same "reference silhouette,
 * original build" posture carrierHull.js/odinHull.js already take toward
 * their own real-ship/screenshot references.
 *
 * Same DOM/WebGL-free contract as its two siblings: never creates a
 * THREE.Group/Mesh/texture itself, only calls the caller-supplied
 * `add(geo, mat, t, r, s)` callback — so this shape can feed any consumer
 * the same way carrierHull.js/odinHull.js already do. Being pure/DOM-free
 * also means its proportions are unit-testable headlessly (see
 * tests/wedgeCruiserHull.test.js), same rationale as odinHull.test.js.
 *
 *   const info = createWedgeCruiserHull(THREE, { add, mats, detail: 'full' });
 *   // info = { length, height, width, engineMounts, muzzleAnchor,
 *   //          turretMounts, towerTips }
 *
 * Forward = +Z (matches carrierHull.js/odinHull.js/capitalShip3D.js).
 * mats: { hull, arm, dark, trim, glass, red, blue } — same key set as the
 * two sibling hull files.
 */

// Generic N-point ring loft. odinHull.js's own buildHullLoftGeometry
// hardcodes a 4-point diamond ring (right for a slender blade-bow hull);
// this hull needs a flatter 6-point hexagonal ring for a proper flat-decked
// wedge cross-section, so this is a local, generalized copy rather than an
// edit to that file (surgical-changes discipline — odinHull.js is untouched).
function buildWedgeLoftGeometry(THREE, stations, ringFn) {
  const rings = stations.map((s) => ringFn(s.halfW, s.halfH, s.z));
  const n = rings[0].length;
  const pos = [];
  const push = (p) => pos.push(p[0], p[1], p[2]);
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i], b = rings[i + 1];
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      push(a[k]); push(b[k2]); push(a[k2]);
      push(a[k]); push(b[k]); push(b[k2]);
    }
  }
  // stern cap: fan-triangulate the aft-most ring from its own center point
  // (same technique odinHull.js uses for its 4-point ring, generalized to N).
  const first = rings[0];
  const center = [0, stations[0].yCenter || 0, stations[0].z];
  for (let k = 0; k < n; k++) { const k2 = (k + 1) % n; push(center); push(first[k]); push(first[k2]); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

// Flat-decked hexagonal ring: a flat top edge + a flat-ish belly + sloped
// shoulders connecting them on both sides — reads as a broad wedge deck,
// distinctly different from odinHull.js's single-ridge diamond.
function wedgeRing(halfW, halfH, z) {
  return [
    [-halfW * 0.55, halfH, z], [halfW * 0.55, halfH, z], // flat top edge
    [halfW, halfH * 0.1, z],                              // right shoulder
    [halfW * 0.45, -halfH, z], [-halfW * 0.45, -halfH, z], // flat belly
    [-halfW, halfH * 0.1, z],                             // left shoulder
  ];
}

export function createWedgeCruiserHull(THREE, { add, mats, detail = 'full' }) {
  const full = detail === 'full';
  const M = mats;

  const STERN = -7.0, NOSE = 7.4;
  const LEN = NOSE - STERN;

  // Width/height taper: broad through midship, committing to a sharp taper
  // only in the front third — same "stay wide, then commit to a fast bow
  // taper" shape odinHull.js's own BOW_LEN comment describes, applied here
  // to a much broader, flatter cross-section instead of a slender blade.
  const stations = [
    { z: STERN, halfW: 4.0, halfH: 1.05 },
    { z: STERN + 2.4, halfW: 3.9, halfH: 1.02 },
    { z: -1.0, halfW: 3.0, halfH: 0.85 },
    { z: 2.2, halfW: 1.55, halfH: 0.55 },
    { z: 5.2, halfW: 0.55, halfH: 0.26 },
    { z: NOSE - 0.35, halfW: 0.08, halfH: 0.08 },
    { z: NOSE, halfW: 0.01, halfH: 0.01 },
  ];
  add(buildWedgeLoftGeometry(THREE, stations, wedgeRing), M.hull, [0, 0, 0]);

  // ===== dorsal centerline trench — the archetype's other unmistakable
  // silhouette cue besides the twin towers. This project doesn't do
  // boolean subtraction, so a true cut isn't available; a darker recessed-
  // reading strip flanked by raised trim rails is the honest procedural
  // equivalent (same "read as recessed via material/height contrast, not
  // an actual cut" technique odinHull.js uses for its own panel details). =====
  const trenchLen = LEN * 0.66, trenchZ = STERN + trenchLen / 2 + 1.6;
  add(new THREE.BoxGeometry(0.5, 0.05, trenchLen), M.dark, [0, 0.98, trenchZ]);
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.08, 0.1, trenchLen), M.trim, [sx * 0.3, 1.0, trenchZ]);

  // ===== twin command towers — the OTHER unmistakable silhouette cue,
  // mirrored off the aft dorsal deck near the stern. =====
  const towerBaseZ = STERN + 2.6, towerBaseY = 1.0;
  const towerTips = [];
  for (const sx of [-1, 1]) {
    const tx = sx * 0.85;
    add(new THREE.BoxGeometry(0.5, 0.4, 0.7), M.arm, [tx, towerBaseY + 0.2, towerBaseZ]);
    add(new THREE.BoxGeometry(0.4, 0.5, 0.55), M.hull, [tx, towerBaseY + 0.65, towerBaseZ]);
    add(new THREE.BoxGeometry(0.3, 0.32, 0.4), M.trim, [tx, towerBaseY + 1.06, towerBaseZ]);
    add(new THREE.BoxGeometry(0.24, 0.14, 0.3), M.glass, [tx, towerBaseY + 1.28, towerBaseZ + 0.08]);
    add(new THREE.CylinderGeometry(0.012, 0.02, 0.5, 6), M.trim, [tx, towerBaseY + 1.6, towerBaseZ]);
    towerTips.push({ x: tx, y: towerBaseY + 1.85, z: towerBaseZ });
  }
  // bridge deck plinth connecting the two towers at their base
  add(new THREE.BoxGeometry(2.0, 0.16, 1.0), M.arm, [0, towerBaseY + 0.02, towerBaseZ]);

  // ===== dorsal turret row (spine, midship, flush on the flat deck) =====
  const turretMounts = [];
  const TURRET_N = 6, tz0 = STERN + 3.6, tz1 = 4.6;
  for (let i = 0; i < TURRET_N; i++) {
    const z = tz0 + (tz1 - tz0) * (i / (TURRET_N - 1));
    for (const tx of [0.9, -0.9]) {
      add(new THREE.BoxGeometry(0.3, 0.14, 0.3), M.dark, [tx, 0.98, z]);
      for (const bx of [-0.06, 0.06]) {
        add(new THREE.CylinderGeometry(0.02, 0.028, 0.3, 8), M.trim, [tx + bx, 1.0, z + 0.16], [Math.PI / 2, 0, 0]);
      }
      turretMounts.push({ x: tx, y: 0.98, z });
    }
  }

  // ===== wide stern engine row — the whole broad stern face reads as an
  // engine bank (this hull's stern is much wider than odinHull.js's, so a
  // single-column cluster like that file's would look sparse here). =====
  const engineMounts = [];
  const EN = 5, ex0 = -2.8, ex1 = 2.8;
  for (let i = 0; i < EN; i++) {
    const x = ex0 + (ex1 - ex0) * (i / (EN - 1));
    const y = -0.15;
    add(new THREE.CylinderGeometry(0.42, 0.5, 0.6, 14), M.dark, [x, y, STERN + 0.1], [Math.PI / 2, 0, 0]);
    add(new THREE.TorusGeometry(0.44, 0.06, 6, 16), M.arm, [x, y, STERN - 0.15]);
    engineMounts.push({ x, y, z: STERN - 0.2 });
  }

  // ===== panel seams / light greeble — kept modest on purpose. The
  // silhouette (broad flat deck + twin towers + wide stern) is the point
  // here, not clutter; same "bow stays clean" discipline odinHull.js
  // documents for its own greeble gradient. =====
  {
    const density = full ? 1 : 0.4;
    const n = Math.round(26 * density);
    for (let i = 0; i < n; i++) {
      const z = STERN + 1.5 + Math.random() * (LEN * 0.55);
      const x = (Math.random() - 0.5) * 5.5;
      add(new THREE.BoxGeometry(0.06 + Math.random() * 0.16, 0.02, 0.1 + Math.random() * 0.3), Math.random() < 0.5 ? M.trim : M.dark, [x, 0.99, z]);
    }
  }

  // ===== forward spinal weapon (bow-forward fire, existing gameplay hook
  // convention shared with odinHull.js/capitalShip3D.js) =====
  const gunZ0 = 3.6, gunLen = 2.4;
  add(new THREE.CylinderGeometry(0.09, 0.13, gunLen, 12), M.trim, [0, -0.1, gunZ0], [Math.PI / 2, 0, 0]);
  const muzzleAnchor = { x: 0, y: -0.1, z: gunZ0 + gunLen / 2 + 0.2 };

  return {
    length: LEN, height: stations[0].halfH * 2, width: stations[0].halfW * 2,
    engineMounts, muzzleAnchor, turretMounts, towerTips,
  };
}
