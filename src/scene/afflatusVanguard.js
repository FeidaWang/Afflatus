import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildPrismGeometry, createOdinHull } from './odinHull.js';

function transformGeometry(THREE, geometry, position, rotation, scale) {
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...(position || [0, 0, 0])),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rotation || [0, 0, 0]))),
    new THREE.Vector3(...(scale || [1, 1, 1])),
  );
  const clone = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  clone.applyMatrix4(matrix);
  // Primitive families do not all expose UVs/tangents.  This model uses
  // geometry/material layering rather than texture atlases, so keeping only
  // position/normal makes every bucket merge-compatible and smaller.
  for (const name of Object.keys(clone.attributes)) {
    if (name !== 'position' && name !== 'normal') clone.deleteAttribute(name);
  }
  return clone;
}

function mergePartBuckets(THREE, buckets, materials, names) {
  const group = new THREE.Group();
  for (const [key, geometries] of buckets) {
    if (!geometries.length) continue;
    const geometry = mergeGeometries(geometries, false);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, materials[key]);
    mesh.name = names?.[key] || key;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
  }
  return group;
}

export function createVanguardMaterials(THREE) {
  return {
    hull: new THREE.MeshPhysicalMaterial({
      name: 'basalt_ceramic', color: 0x56616d, metalness: 0.78, roughness: 0.32,
      clearcoat: 0.32, clearcoatRoughness: 0.4,
    }),
    arm: new THREE.MeshPhysicalMaterial({
      name: 'graphite_armour', color: 0x252c34, metalness: 0.86, roughness: 0.25,
      clearcoat: 0.2, clearcoatRoughness: 0.48,
    }),
    dark: new THREE.MeshStandardMaterial({
      name: 'recesses', color: 0x090e13, metalness: 0.7, roughness: 0.62,
    }),
    trim: new THREE.MeshStandardMaterial({
      name: 'machined_edges', color: 0x8a98a5, metalness: 0.95, roughness: 0.2,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      name: 'polarized_canopy', color: 0x07151e, metalness: 0.28, roughness: 0.08,
      transmission: 0.12, transparent: true, opacity: 0.92,
      emissive: 0x0b4d68, emissiveIntensity: 0.62,
    }),
    red: new THREE.MeshStandardMaterial({
      name: 'threat_marker', color: 0xff4f4f, emissive: 0xff192f, emissiveIntensity: 2.5,
    }),
    blue: new THREE.MeshStandardMaterial({
      name: 'drive_emissive', color: 0xc9f5ff, emissive: 0x22bce9, emissiveIntensity: 5.2,
      metalness: 0.18, roughness: 0.16,
    }),
    amber: new THREE.MeshStandardMaterial({
      name: 'deck_warning', color: 0xffcf78, emissive: 0xff7b20, emissiveIntensity: 3.4,
      metalness: 0.2, roughness: 0.22,
    }),
  };
}

/** Build a seven-draw-call capital model from the shared procedural parts. */
export function createAfflatusVanguard(THREE, {
  detail = 'full',
  forwardNegativeZ = false,
  materials = createVanguardMaterials(THREE),
} = {}) {
  const buckets = new Map(Object.keys(materials).map((key) => [key, []]));
  const materialKey = new Map(Object.entries(materials).map(([key, mat]) => [mat, key]));
  const add = (geometry, material, position, rotation, scale) => {
    const key = materialKey.get(material) || 'hull';
    buckets.get(key).push(transformGeometry(THREE, geometry, position, rotation, scale));
    return { name: '' };
  };
  const info = createOdinHull(THREE, { add, mats: materials, detail });
  const root = mergePartBuckets(THREE, buckets, materials, {
    hull: 'CommandHull', arm: 'ArmorPlates', dark: 'MechanicalRecesses',
    trim: 'MachinedEdges', glass: 'BridgeCanopy', red: 'ThreatMarkers',
    blue: 'DriveGlow', amber: 'DeckSignals',
  });
  root.name = 'AFFLATUS_VANGUARD';
  if (forwardNegativeZ) root.rotation.y = Math.PI;

  const anchors = [
    ['Muzzle_Main', info.muzzleAnchor],
    ['Muzzle_CIWS_Port', info.ciwsPortAnchor],
    ['Muzzle_CIWS_Starboard', info.ciwsStarboardAnchor],
    ['MissileBay', info.missileBayAnchor],
  ];
  for (const [name, point] of anchors) {
    const anchor = new THREE.Object3D();
    anchor.name = name;
    anchor.position.set(point.x, point.y, point.z);
    root.add(anchor);
  }
  root.userData.hullInfo = info;
  return { group: root, info, materials };
}

function collectFighterPart(THREE, buckets, key, geometry, position, rotation, scale) {
  buckets.get(key).push(transformGeometry(THREE, geometry, position, rotation, scale));
}

/**
 * A compact interceptor with a complete underside, wing roots, canopy,
 * weapons and vectoring engines. Geometry/materials are merged by surface
 * family so clones share buffers and the three-aircraft formation remains
 * affordable on mobile.
 */
export function createAfflatusInterceptorPrototype(THREE) {
  const materials = {
    hull: new THREE.MeshPhysicalMaterial({ color: 0x46525e, metalness: 0.8, roughness: 0.3, clearcoat: 0.22, clearcoatRoughness: 0.42 }),
    armor: new THREE.MeshStandardMaterial({ color: 0x171e25, metalness: 0.9, roughness: 0.26 }),
    recess: new THREE.MeshStandardMaterial({ color: 0x05090d, metalness: 0.62, roughness: 0.7 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x07141c, emissive: 0x0b5774, emissiveIntensity: 0.85, metalness: 0.3, roughness: 0.08, transparent: true, opacity: 0.94 }),
    signal: new THREE.MeshStandardMaterial({ color: 0xbdf5ff, emissive: 0x27c8ff, emissiveIntensity: 4.6, metalness: 0.2, roughness: 0.18 }),
    warning: new THREE.MeshStandardMaterial({ color: 0xffd36b, emissive: 0xff7b1d, emissiveIntensity: 2.8 }),
  };
  const buckets = new Map(Object.keys(materials).map((key) => [key, []]));
  const add = (key, geometry, position, rotation, scale) => collectFighterPart(THREE, buckets, key, geometry, position, rotation, scale);

  // Central lifting body and the pronounced spear nose.
  add('hull', buildPrismGeometry(THREE, [[-0.92, -2.3], [0.92, -2.3], [0.68, 2.65], [0, 4.25], [-0.68, 2.65]], -0.32, 0.34));
  add('armor', buildPrismGeometry(THREE, [[-0.68, -1.8], [0.68, -1.8], [0.48, 2.25], [0, 3.55], [-0.48, 2.25]], 0.32, 0.52));
  add('recess', new THREE.BoxGeometry(0.34, 0.18, 4.3), [0, -0.38, 0.1]);

  for (const side of [-1, 1]) {
    const wing = side < 0
      ? [[-0.8, -1.45], [-3.2, -0.55], [-2.72, 1.35], [-0.62, 2.15]]
      : [[0.8, -1.45], [0.62, 2.15], [2.72, 1.35], [3.2, -0.55]];
    add('hull', buildPrismGeometry(THREE, wing, -0.18, 0.2));
    const plate = side < 0
      ? [[-1.0, -1.05], [-2.72, -0.38], [-2.25, 0.72], [-0.78, 1.38]]
      : [[1.0, -1.05], [0.78, 1.38], [2.25, 0.72], [2.72, -0.38]];
    add('armor', buildPrismGeometry(THREE, plate, 0.19, 0.29));
    add('armor', new THREE.BoxGeometry(0.12, 0.86, 1.62), [side * 2.72, 0.48, -0.65], [0.04, 0, side * 0.22]);
    add('signal', new THREE.BoxGeometry(0.07, 0.035, 1.05), [side * 1.62, 0.32, 0.76], [0, side * 0.34, 0]);
    add('warning', new THREE.BoxGeometry(0.18, 0.04, 0.08), [side * 2.52, 0.3, -0.35]);
    // Forward gun rails integrated into the wing root.
    add('recess', new THREE.BoxGeometry(0.28, 0.22, 1.15), [side * 0.72, 0.14, 2.38]);
    add('armor', new THREE.CylinderGeometry(0.055, 0.075, 1.82, 8), [side * 0.72, 0.16, 3.22], [Math.PI / 2, 0, 0]);
    add('signal', new THREE.SphereGeometry(0.07, 8, 6), [side * 0.72, 0.16, 4.14]);
  }

  // Canopy, dorsal avionics and belly weapon well.
  add('recess', buildPrismGeometry(THREE, [[-0.47, 0.15], [0.47, 0.15], [0.32, 1.9], [-0.32, 1.9]], 0.5, 0.65));
  add('glass', buildPrismGeometry(THREE, [[-0.36, 0.3], [0.36, 0.3], [0.25, 1.62], [-0.25, 1.62]], 0.63, 0.88));
  add('armor', new THREE.BoxGeometry(0.42, 0.24, 1.32), [0, 0.66, -0.72]);
  add('recess', new THREE.BoxGeometry(0.68, 0.08, 1.58), [0, -0.42, 0.64]);

  // Paired vectoring drives with visible nozzle depth.
  for (const side of [-1, 1]) {
    add('armor', new THREE.BoxGeometry(0.72, 0.62, 1.68), [side * 0.58, 0.02, -2.08]);
    add('recess', new THREE.CylinderGeometry(0.26, 0.34, 0.72, 10), [side * 0.58, 0.02, -2.72], [Math.PI / 2, 0, 0]);
    add('signal', new THREE.CircleGeometry(0.24, 12), [side * 0.58, 0.02, -3.1], [0, Math.PI, 0]);
  }

  const group = mergePartBuckets(THREE, buckets, materials, {
    hull: 'InterceptorHull', armor: 'InterceptorArmor', recess: 'InterceptorRecesses',
    glass: 'InterceptorCanopy', signal: 'InterceptorEmission', warning: 'InterceptorWarnings',
  });
  group.name = 'AFFLATUS_LANCER';
  group.userData.forwardAxis = new THREE.Vector3(0, 0, 1);
  return { group, materials };
}
