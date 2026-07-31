/**
 * AFFLATUS VANGUARD — shared, procedural hard-surface capital ship.
 *
 * The previous Odin mesh was a long stack of boxes with a needle nose.  This
 * rebuild uses a low, broad lifting-body silhouette: a continuous faceted
 * pressure hull, structural shoulder plates, a recessed dorsal service trench,
 * paired drive nacelles and a compact bridge/canopy.  It is deliberately an
 * original Afflatus design; the supplied space-sim references inform its
 * material hierarchy and readable plan-view proportions, not its exact shape.
 *
 * Forward is +Z.  Callers own materials and the `add` function, so the same
 * geometry feeds the live PBR model, the hologram and the generated GLB.
 */

export function buildPrismGeometry(THREE, points, bottomY, topY) {
  const vertices = [];
  const push = (x, y, z) => vertices.push(x, y, z);
  const n = points.length;
  // top / bottom fans. Winding is explicit so exterior normals remain stable.
  for (let i = 1; i < n - 1; i += 1) {
    push(points[0][0], topY, points[0][1]);
    push(points[i][0], topY, points[i][1]);
    push(points[i + 1][0], topY, points[i + 1][1]);
    push(points[0][0], bottomY, points[0][1]);
    push(points[i + 1][0], bottomY, points[i + 1][1]);
    push(points[i][0], bottomY, points[i][1]);
  }
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    const a = points[i], b = points[j];
    push(a[0], bottomY, a[1]); push(b[0], topY, b[1]); push(a[0], topY, a[1]);
    push(a[0], bottomY, a[1]); push(b[0], bottomY, b[1]); push(b[0], topY, b[1]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.computeVertexNormals();
  return geo;
}

function buildLiftingBodyGeometry(THREE, stations) {
  const ring = ({ halfW, topY, bottomY, z }) => ([
    [0, topY + 0.11, z],
    [halfW * 0.58, topY, z],
    [halfW, topY * 0.24, z],
    [halfW * 0.76, bottomY, z],
    [0, bottomY - 0.08, z],
    [-halfW * 0.76, bottomY, z],
    [-halfW, topY * 0.24, z],
    [-halfW * 0.58, topY, z],
  ]);
  const rings = stations.map(ring);
  const vertices = [];
  const push = (p) => vertices.push(p[0], p[1], p[2]);
  for (let i = 0; i < rings.length - 1; i += 1) {
    const a = rings[i], b = rings[i + 1];
    for (let k = 0; k < a.length; k += 1) {
      const j = (k + 1) % a.length;
      push(a[k]); push(b[j]); push(a[j]);
      push(a[k]); push(b[k]); push(b[j]);
    }
  }
  // Close aft end; nose station is nearly a point and closes itself visually.
  const aft = rings[0];
  const center = [0, (stations[0].topY + stations[0].bottomY) * 0.5, stations[0].z];
  for (let i = 0; i < aft.length; i += 1) {
    push(center); push(aft[i]); push(aft[(i + 1) % aft.length]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.computeVertexNormals();
  return geo;
}

function seeded(index) {
  const x = Math.sin(index * 91.733 + 17.31) * 43758.5453;
  return x - Math.floor(x);
}

export function createOdinHull(THREE, { add, mats, detail = 'full' }) {
  const full = detail === 'full';
  const M = mats;
  const part = (name, geo, mat, t, r, s) => {
    const mesh = add(geo, mat, t, r, s);
    if (mesh) mesh.name = name;
    return mesh;
  };

  const STERN = -5.25;
  const NOSE = 6.85;
  const LEN = NOSE - STERN;
  const HEIGHT = 1.55;
  const BOW_ROOT = 1.75;
  const BOW_LEN = NOSE - BOW_ROOT;

  const stations = [
    { z: STERN, halfW: 3.15, topY: 0.54, bottomY: -0.58 },
    { z: -4.35, halfW: 4.15, topY: 0.58, bottomY: -0.6 },
    { z: -1.8, halfW: 4.0, topY: 0.54, bottomY: -0.53 },
    { z: 1.0, halfW: 3.05, topY: 0.44, bottomY: -0.44 },
    { z: 3.7, halfW: 1.45, topY: 0.28, bottomY: -0.29 },
    { z: 5.7, halfW: 0.46, topY: 0.15, bottomY: -0.17 },
    { z: NOSE, halfW: 0.025, topY: 0.025, bottomY: -0.025 },
  ];
  part('PressureHull', buildLiftingBodyGeometry(THREE, stations), M.hull, [0, 0, 0]);

  // Overlapping shoulder armour: large quiet plates establish scale; smaller
  // recesses and rails break them up without turning the silhouette noisy.
  for (const side of [-1, 1]) {
    const shoulder = side < 0
      ? [[-3.82, -4.0], [-1.12, -3.92], [-0.74, 1.62], [-2.7, 0.86]]
      : [[1.12, -3.92], [3.82, -4.0], [2.7, 0.86], [0.74, 1.62]];
    part(`ShoulderArmor_${side < 0 ? 'Port' : 'Starboard'}`, buildPrismGeometry(THREE, shoulder, 0.43, 0.63), M.arm);
    const outer = side < 0
      ? [[-4.05, -3.76], [-3.16, -3.8], [-2.58, 0.45], [-3.02, -0.1]]
      : [[3.16, -3.8], [4.05, -3.76], [3.02, -0.1], [2.58, 0.45]];
    part(`OuterArmor_${side}`, buildPrismGeometry(THREE, outer, 0.26, 0.49), M.dark);
    const forward = side < 0
      ? [[-2.55, 0.72], [-0.7, 1.46], [-0.35, 4.55], [-1.18, 3.3]]
      : [[0.7, 1.46], [2.55, 0.72], [1.18, 3.3], [0.35, 4.55]];
    part(`ForwardArmor_${side}`, buildPrismGeometry(THREE, forward, 0.31, 0.5), M.arm);
    // recessed VLS / heat exchanger banks
    for (let i = 0; i < 4; i += 1) {
      const z = -2.9 + i * 0.74;
      part(`Bay_${side}_${i}`, new THREE.BoxGeometry(0.52, 0.06, 0.42), M.dark, [side * (2.15 + i * 0.08), 0.64, z], [0, -side * 0.04, 0]);
      part(`BayRim_${side}_${i}`, new THREE.BoxGeometry(0.62, 0.035, 0.52), M.trim, [side * (2.15 + i * 0.08), 0.625, z], [0, -side * 0.04, 0]);
    }
    // wing-tip threat receiver / stabiliser
    part(`Winglet_${side}`, new THREE.BoxGeometry(0.18, 1.28, 1.72), M.arm, [side * 3.82, 0.82, -2.65], [0.08, 0, side * 0.2]);
    part(`WingtipSensor_${side}`, new THREE.BoxGeometry(0.11, 0.18, 0.82), M.blue, [side * 3.96, 1.2, -2.58], [0.08, 0, side * 0.2]);
  }

  // The recessed dorsal trench is a real negative level between raised rails.
  part('ServiceTrench', new THREE.BoxGeometry(1.12, 0.06, 6.8), M.dark, [0, 0.56, -0.78]);
  for (const x of [-0.64, 0.64]) part(`TrenchRail_${x}`, new THREE.BoxGeometry(0.1, 0.18, 6.9), M.trim, [x, 0.64, -0.78]);
  for (let i = 0; i < 16; i += 1) {
    const z = -3.75 + i * 0.42;
    const x = (seeded(i) - 0.5) * 0.72;
    part(`TrenchMachine_${i}`, new THREE.BoxGeometry(0.09 + seeded(i + 3) * 0.12, 0.08 + seeded(i + 8) * 0.1, 0.08 + seeded(i + 11) * 0.16), i % 3 ? M.trim : M.dark, [x, 0.68, z]);
  }

  // Compact command citadel/canopy.  Its wedge is set into armour rather than
  // sitting on the hull like a separate toy canopy.
  part('CitadelBase', buildPrismGeometry(THREE, [[-1.0, -2.55], [1.0, -2.55], [0.76, 0.2], [-0.76, 0.2]], 0.55, 0.84), M.arm);
  part('BridgeCanopy', buildPrismGeometry(THREE, [[-0.56, -1.72], [0.56, -1.72], [0.4, -0.08], [-0.4, -0.08]], 0.83, 1.1), M.glass);
  part('BridgeBrow', new THREE.BoxGeometry(1.35, 0.13, 0.32), M.trim, [0, 1.03, -1.6], [-0.1, 0, 0]);
  part('SensorSpine', new THREE.BoxGeometry(0.34, 0.34, 2.55), M.dark, [0, 0.88, -3.12]);
  part('DorsalArray', new THREE.CylinderGeometry(0.22, 0.31, 0.26, 10), M.trim, [0, 1.08, -3.35]);
  part('DorsalArrayGlow', new THREE.TorusGeometry(0.24, 0.035, 6, 18), M.blue, [0, 1.22, -3.35], [Math.PI / 2, 0, 0]);

  // Forward spinal gun and paired close-in batteries.
  const muzzleAnchor = { x: 0, y: 0.06, z: NOSE + 0.18 };
  part('MainGunChannel', new THREE.BoxGeometry(0.46, 0.2, 4.35), M.dark, [0, 0.05, 4.28]);
  part('MainGunEmitter', new THREE.CylinderGeometry(0.09, 0.13, 2.4, 12), M.trim, [0, 0.05, 5.56], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 4; i += 1) part(`Coil_${i}`, new THREE.TorusGeometry(0.18, 0.027, 6, 14), i === 3 ? M.blue : M.trim, [0, 0.05, 4.58 + i * 0.5]);

  const turretMounts = [];
  const lateralTurretMounts = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i += 1) {
      const x = side * (1.02 + i * 0.43);
      const z = 2.55 - i * 1.55;
      part(`PDTurret_${side}_${i}`, new THREE.CylinderGeometry(0.18, 0.24, 0.18, 8), M.dark, [x, 0.63, z]);
      for (const dx of [-0.055, 0.055]) part(`PDBarrel_${side}_${i}_${dx}`, new THREE.CylinderGeometry(0.025, 0.035, 0.64, 8), M.trim, [x + dx, 0.66, z + 0.36], [Math.PI / 2, 0, 0]);
      const mount = { x, y: 0.63, z, side };
      turretMounts.push(mount);
      lateralTurretMounts.push(mount);
    }
  }

  // Twin drive modules and four auxiliary vectoring nozzles.
  const engineMounts = [];
  for (const side of [-1, 1]) {
    const x = side * 1.7;
    part(`DriveHousing_${side}`, new THREE.BoxGeometry(1.35, 0.92, 2.25), M.dark, [x, -0.02, -4.45]);
    part(`DriveCowling_${side}`, new THREE.CylinderGeometry(0.6, 0.72, 1.45, 14), M.arm, [x, -0.02, -5.0], [Math.PI / 2, 0, 0]);
    part(`DriveNozzle_${side}`, new THREE.TorusGeometry(0.56, 0.11, 8, 20), M.trim, [x, -0.02, STERN - 0.5]);
    part(`DrivePlasma_${side}`, new THREE.CircleGeometry(0.48, 20), M.blue, [x, -0.02, STERN - 0.62], [0, Math.PI, 0]);
    engineMounts.push({ x, y: -0.02, z: STERN - 0.62 });
    for (const y of [-0.34, 0.34]) {
      part(`VectorNozzle_${side}_${y}`, new THREE.CylinderGeometry(0.18, 0.24, 0.62, 10), M.dark, [side * 3.04, y, -4.9], [Math.PI / 2, 0, 0]);
      part(`VectorGlow_${side}_${y}`, new THREE.CircleGeometry(0.16, 12), M.blue, [side * 3.04, y, -5.23], [0, Math.PI, 0]);
      engineMounts.push({ x: side * 3.04, y, z: -5.23 });
    }
  }

  // Ventral hangar/landing aperture and modular flank bays.
  part('VentralHangar', new THREE.BoxGeometry(2.15, 0.08, 2.65), M.dark, [0, -0.65, -1.05]);
  part('HangarGuide', new THREE.BoxGeometry(0.16, 0.04, 2.35), M.amber || M.red, [0, -0.7, -0.92]);
  const sideBayMounts = [];
  for (const side of [-1, 1]) for (let i = 0; i < 4; i += 1) {
    const z = -2.75 + i * 0.92;
    const x = side * (3.28 - i * 0.22);
    part(`FlankBay_${side}_${i}`, new THREE.BoxGeometry(0.12, 0.34, 0.58), M.dark, [x, -0.02, z], [0, 0, side * 0.1]);
    part(`FlankBayLight_${side}_${i}`, new THREE.BoxGeometry(0.05, 0.05, 0.32), i === 1 ? M.amber || M.red : M.blue, [x + side * 0.08, 0.08, z], [0, 0, side * 0.1]);
    sideBayMounts.push({ x, y: -0.02, z, side });
  }

  // Long emissive strips make attitude and scale legible in darkness.
  for (const side of [-1, 1]) {
    part(`ShoulderSignal_${side}`, new THREE.BoxGeometry(0.08, 0.035, 2.45), M.blue, [side * 1.78, 0.66, 0.18], [0, side * 0.16, 0]);
    part(`AftWarning_${side}`, new THREE.BoxGeometry(0.34, 0.04, 0.09), M.amber || M.red, [side * 2.62, 0.59, -3.52]);
  }

  // Deterministic panel strips and maintenance blocks. No random-on-load
  // shimmer: the GLB, live model and visual tests now receive one silhouette.
  const panelCount = full ? 34 : 12;
  for (let i = 0; i < panelCount; i += 1) {
    const side = i % 2 ? -1 : 1;
    const z = -3.7 + seeded(i + 30) * 6.65;
    const taper = Math.max(0.8, 3.45 - Math.max(0, z) * 0.48);
    const x = side * (0.86 + seeded(i + 60) * Math.max(0.2, taper - 0.92));
    part(`SurfaceDetail_${i}`, new THREE.BoxGeometry(0.08 + seeded(i + 90) * 0.2, 0.025, 0.12 + seeded(i + 120) * 0.34), i % 4 ? M.trim : M.dark, [x, 0.61, z], [0, side * 0.08, 0]);
  }

  const bellyPodMounts = [
    { x: -1.1, y: -0.62, z: 1.15 },
    { x: 1.1, y: -0.62, z: 1.15 },
  ];
  for (const [i, p] of bellyPodMounts.entries()) {
    part(`VentralPod_${i}`, new THREE.BoxGeometry(0.58, 0.32, 1.35), M.arm, [p.x, p.y, p.z]);
    part(`VentralPodPort_${i}`, new THREE.BoxGeometry(0.32, 0.16, 0.28), M.dark, [p.x, p.y - 0.12, p.z + 0.7]);
  }

  const mastTips = [
    { x: -0.32, y: 1.58, z: -2.6 },
    { x: 0.32, y: 1.44, z: -2.9 },
    { x: 0, y: 1.68, z: -3.3 },
  ];
  for (const [i, p] of mastTips.entries()) {
    part(`Mast_${i}`, new THREE.CylinderGeometry(0.018, 0.03, p.y - 1.05, 6), M.trim, [p.x, (p.y + 1.05) * 0.5, p.z], [i === 1 ? 0.18 : -0.08, 0, i === 0 ? -0.14 : 0.12]);
    part(`MastTip_${i}`, new THREE.SphereGeometry(0.04, 8, 6), i === 2 ? M.red : M.blue, [p.x, p.y, p.z]);
  }

  return {
    length: LEN,
    height: HEIGHT,
    width: 8.3,
    bowLen: BOW_LEN,
    bowRoot: BOW_ROOT,
    engineMounts,
    turretMounts,
    bellyPodMounts,
    mastTips,
    muzzleAnchor,
    missileBayAnchor: { x: 0, y: -0.72, z: -0.25 },
    ciwsPortAnchor: { x: -1.06, y: 0.68, z: 2.92 },
    ciwsStarboardAnchor: { x: 1.06, y: 0.68, z: 2.92 },
    sideBayMounts,
    lateralTurretMounts,
  };
}
