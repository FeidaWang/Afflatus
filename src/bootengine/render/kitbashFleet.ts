/* ============================================================
   KITBASH FLEET — U29 P2: procedural fleet assembly reusing the EXISTING
   hull part-generator library (main site's capital-ship kitbash geometry —
   see src/scene/carrierHull.js / odinHull.js / wedgeCruiserHull.js). Per
   the U29 downscope table: "程序化 kitbash 优先...模块化部件库已有基础" —
   these hull generators ARE the modular part library; this module is the
   piece that was still missing, assembling several hull instances into one
   seeded fleet formation and exposing their mount points as live Object3D
   markers (children of each ship, so .getWorldPosition() tracks them
   correctly if a ship ever moves/rotates) for the render pieces (thruster
   particles, laser beams) to attach to.

   Owner feedback (2026-07-16): the original mixed carrierHull+odinHull
   fleet "all looked ugly" — swapped the whole fleet (flagship AND escorts)
   to wedgeCruiserHull.js, a new broad flat-decked "dagger" silhouette hull
   (twin command towers, dorsal trench, wide stern engine row) built
   specifically to read as a striking capital-ship silhouette at a glance,
   at two scales (full-size flagship + smaller escorts of the same class —
   a real fleet composition, not three unrelated hull styles competing for
   attention in one shot). carrierHull.js/odinHull.js are untouched and
   still used by capitalShip3D.js/shipHologram.js elsewhere on the site;
   this file just no longer imports them.

   All three hull generators are already DOM/WebGL-free part generators —
   THREE is passed in as a parameter, they import nothing themselves —
   confirmed zero coupling back onto topdownCombat.js/main.js, so reusing
   them from src/bootengine/render/ pulls in only `three` itself.

   Determinism is PARTIAL, and that's a real tradeoff, not an oversight:
   fleet COMPOSITION (escort count/formation slot) flows through the seeded
   rng below, so the same seed always produces the same layout. Each hull's
   own internal greeble scatter (rivets/panel clutter) does NOT —
   wedgeCruiserHull.js calls bare Math.random() internally (same as its two
   siblings), and this module deliberately does not modify that file
   (surgical-changes discipline) to force it through.
   ============================================================ */

import * as THREE from 'three';
import { createWedgeCruiserHull } from '../../scene/wedgeCruiserHull.js';
import type { HullMats } from '../../scene/carrierHull';
import {
  analyzeProceduralResourceSharing,
  applyProceduralLod,
  projectedDiameterPx,
  selectProceduralLod,
} from '../../lib/proceduralLod.js';

export interface FormationSlot {
  x: number;
  y: number;
  z: number;
  yaw: number; // radians, rotation around Y
}

// Pure + testable: escort positions in a loose flanking wedge trailing the
// carrier (ships share the carrier's +Z-forward heading — see header — so
// negative Z is "behind/trailing", the standard escort-screen read), seeded
// so the same rng sequence reproduces the same layout and a different seed
// visibly reshuffles it (same determinism contract style as P1's HBT/
// maneuvers, applied here to fleet composition instead of flight paths).
export function computeFormation(rng: () => number, escortCount: number): FormationSlot[] {
  const slots: FormationSlot[] = [];
  for (let i = 0; i < escortCount; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const rank = Math.floor(i / 2);
    // Base offset pushed out from -6 to -9.5 (wedgeCruiserHull.js's own
    // hull already extends back to local z=-7, so escorts need more
    // clearance behind the flagship's stern than the old, shorter carrier
    // hull did — otherwise the formation reads as overlapping hulls).
    const x = side * (6.5 + rank * 2.6 + (rng() - 0.5) * 1.2);
    const z = -9.5 - rank * 3.8 + (rng() - 0.5) * 2.0;
    const y = (rng() - 0.5) * 1.2;
    const yaw = (rng() - 0.5) * 0.3;
    slots.push({ x, y, z, yaw });
  }
  return slots;
}

export interface KitbashFleet {
  group: THREE.Group;
  engineMarkers: THREE.Object3D[]; // world-trackable, one per engine mount across every ship
  muzzleMarkers: THREE.Object3D[]; // one per ship's main gun muzzle
  updateLod(camera: THREE.PerspectiveCamera, viewportHeight: number, qualityTier: 'low' | 'balanced' | 'high'): void;
  getLodDiagnostics(): {
    tiers: Record<'high' | 'medium' | 'silhouette', number>;
    meshInstances: number;
    uniqueGeometries: number;
    uniqueMaterials: number;
    geometryReuseRatio: number;
    materialReuseRatio: number;
  };
}

function buildMats(): HullMats {
  // Same "space gray" family as armorMaterial.ts's darkened FS 595C
  // direction (#4e5257) — keeps this P2 slice visually consistent with the
  // armor material slice instead of introducing a third unrelated palette.
  //
  // BUG FIX (owner: "只能看到一片亮光" — just a patch of bright light):
  // every material here left envMapIntensity at MeshStandardMaterial's
  // default (1.0) with metalness up to 0.6, reflecting p2FleetDemoScene.ts's
  // procedural sky (a bright, near-white zenith) at full strength across
  // the ENTIRE hull surface — armorMaterial.ts hit this exact class of
  // problem earlier this session and fixed it by dialing envMapIntensity
  // down to 0.5; these materials never got the same treatment. Combined
  // with the newly-added bloom pass (which blurs anything above its
  // brightness threshold), a large, mostly-uniform over-bright reflective
  // surface reads as one blown-out bright mass instead of a shaded,
  // detailed ship. envMapIntensity 0.4 here — slightly more conservative
  // than armorMaterial.ts's 0.5 since this hull has many more distinct
  // reflective parts (hull/arm/dark/trim all metallic) all catching the
  // same sky at once, not one plate.
  return {
    hull: new THREE.MeshStandardMaterial({ color: 0x4e5257, metalness: 0.5, roughness: 0.55, envMapIntensity: 0.4 }),
    arm: new THREE.MeshStandardMaterial({ color: 0x3c4045, metalness: 0.5, roughness: 0.6, envMapIntensity: 0.4 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x22262a, metalness: 0.55, roughness: 0.6, envMapIntensity: 0.4 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x8a939c, metalness: 0.6, roughness: 0.4, envMapIntensity: 0.4 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x1a1410, metalness: 0.3, roughness: 0.2, envMapIntensity: 0.4, emissive: 0xcc7a22, emissiveIntensity: 0.6 }),
    red: new THREE.MeshStandardMaterial({ color: 0xff4030, envMapIntensity: 0.4, emissive: 0xff2010, emissiveIntensity: 0.6 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x60c0ff, envMapIntensity: 0.4, emissive: 0x3090ff, emissiveIntensity: 0.6 }),
  };
}

type Mount = { x: number; y: number; z: number };
type AddFn = (geo: THREE.BufferGeometry, mat: THREE.Material, t?: number[], r?: number[], s?: number[]) => THREE.Mesh;
type InstanceTransform = { t: number[]; r?: number[]; s?: number[] };
type AddInstancedFn = (geo: THREE.BufferGeometry, mat: THREE.Material, transforms: InstanceTransform[]) => THREE.InstancedMesh;

function makeAdd(ship: THREE.Group): AddFn {
  return (geo, mat, t, r, s) => {
    const mesh = new THREE.Mesh(geo, mat);
    if (t) mesh.position.set(t[0], t[1], t[2]);
    if (r) mesh.rotation.set(r[0], r[1], r[2]);
    if (s) mesh.scale.set(s[0], s[1], s[2]);
    ship.add(mesh);
    return mesh;
  };
}

// wedgeCruiserHull.js's second callback (see that file's header for why):
// batches repeated small parts (turrets/panel greeble/window lights) into
// one InstancedMesh draw call each, instead of one Mesh per part.
function makeAddInstanced(ship: THREE.Group): AddInstancedFn {
  const tmpPos = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpEuler = new THREE.Euler();
  const tmpScale = new THREE.Vector3(1, 1, 1);
  const tmpMat = new THREE.Matrix4();
  return (geo, mat, transforms) => {
    const mesh = new THREE.InstancedMesh(geo, mat, transforms.length);
    transforms.forEach((tr, i) => {
      tmpPos.set(tr.t[0], tr.t[1], tr.t[2]);
      if (tr.r) { tmpEuler.set(tr.r[0], tr.r[1], tr.r[2]); tmpQuat.setFromEuler(tmpEuler); } else { tmpQuat.identity(); }
      if (tr.s) tmpScale.set(tr.s[0], tr.s[1], tr.s[2]); else tmpScale.set(1, 1, 1);
      tmpMat.compose(tmpPos, tmpQuat, tmpScale);
      mesh.setMatrixAt(i, tmpMat);
    });
    mesh.instanceMatrix.needsUpdate = true;
    ship.add(mesh);
    return mesh;
  };
}

function addMarkers(ship: THREE.Group, mounts: Mount[], into: THREE.Object3D[]): void {
  for (const m of mounts) {
    const marker = new THREE.Object3D();
    marker.position.set(m.x, m.y, m.z);
    ship.add(marker);
    into.push(marker);
  }
}

type LodTier = 'high' | 'medium' | 'silhouette';
type LodLevels = Record<LodTier, THREE.Group>;
type LodShip = {
  root: THREE.Group;
  levels: LodLevels;
  radius: number;
  tier: LodTier;
};

function createHullPrototype(detail: 'full' | 'wire', mats: HullMats) {
  const group = new THREE.Group();
  const info = createWedgeCruiserHull(THREE, {
    add: makeAdd(group),
    addInstanced: makeAddInstanced(group),
    mats,
    detail,
  });
  return { group, info };
}

function createLodLevels(
  highPrototype: THREE.Group,
  mediumPrototype: THREE.Group,
): LodLevels {
  const high = highPrototype.clone(true);
  const medium = mediumPrototype.clone(true);
  // The continuous first hull mesh owns the primary dagger silhouette. The
  // lowest tier deliberately keeps only that mesh: one draw call, no greeble,
  // while reusing (not recreating) the high-tier geometry and material.
  const silhouette = new THREE.Group();
  const hullSkin = highPrototype.children.find((child) => child instanceof THREE.Mesh);
  if (!hullSkin) throw new Error('wedge cruiser prototype is missing its primary hull mesh');
  silhouette.add(hullSkin.clone(true));
  high.name = 'LOD_HIGH';
  medium.name = 'LOD_MEDIUM';
  silhouette.name = 'LOD_SILHOUETTE';
  return { high, medium, silhouette };
}

export function createKitbashFleet(opts: { rng: () => number; escortCount?: number }): KitbashFleet {
  const { rng } = opts;
  const escortCount = opts.escortCount ?? 4;
  const group = new THREE.Group();
  const engineMarkers: THREE.Object3D[] = [];
  const muzzleMarkers: THREE.Object3D[] = [];
  const lodShips: LodShip[] = [];
  const sharedMats = buildMats();
  // Build each detail tier once. Every fleet member below is a deep Object3D
  // clone whose geometries/materials retain these prototype identities.
  const highPrototype = createHullPrototype('full', sharedMats);
  const mediumPrototype = createHullPrototype('wire', sharedMats);
  const prototypeSphere = new THREE.Box3()
    .setFromObject(highPrototype.group)
    .getBoundingSphere(new THREE.Sphere());

  const makeShip = (): THREE.Group => {
    const root = new THREE.Group();
    const levels = createLodLevels(highPrototype.group, mediumPrototype.group);
    root.add(levels.high, levels.medium, levels.silhouette);
    const tier: LodTier = 'medium';
    applyProceduralLod(levels, tier);
    lodShips.push({ root, levels, radius: prototypeSphere.radius, tier });
    return root;
  };

  // ---- flagship: the fleet's centerpiece, stationary at the formation origin ----
  const flagship = makeShip();
  const flagshipInfo = highPrototype.info;
  group.add(flagship);
  addMarkers(flagship, flagshipInfo.engineMounts, engineMarkers);
  const flagshipMuzzle = new THREE.Object3D();
  flagshipMuzzle.position.set(flagshipInfo.muzzleAnchor.x, flagshipInfo.muzzleAnchor.y, flagshipInfo.muzzleAnchor.z);
  flagship.add(flagshipMuzzle);
  muzzleMarkers.push(flagshipMuzzle);

  // ---- escorts: seeded formation, same hull class at a smaller scale —
  // a real fleet composition (one striking silhouette at two sizes) rather
  // than mixing unrelated hull styles in one shot. ----
  const formation = computeFormation(rng, escortCount);
  for (const slot of formation) {
    const escortShip = makeShip();
    const escortInfo = highPrototype.info;
    escortShip.scale.setScalar(0.42); // escorts read as smaller hulls of the same class next to the flagship
    escortShip.position.set(slot.x, slot.y, slot.z);
    escortShip.rotation.y = slot.yaw; // same +Z forward heading as the flagship, formation-flying
    group.add(escortShip);
    addMarkers(escortShip, escortInfo.engineMounts, engineMarkers);
    const muzzle = new THREE.Object3D();
    muzzle.position.set(escortInfo.muzzleAnchor.x, escortInfo.muzzleAnchor.y, escortInfo.muzzleAnchor.z);
    escortShip.add(muzzle);
    muzzleMarkers.push(muzzle);
  }

  const cameraPosition = new THREE.Vector3();
  const shipPosition = new THREE.Vector3();
  const shipScale = new THREE.Vector3();

  function updateLod(
    camera: THREE.PerspectiveCamera,
    viewportHeight: number,
    qualityTier: 'low' | 'balanced' | 'high',
  ): void {
    group.updateMatrixWorld(true);
    camera.getWorldPosition(cameraPosition);
    for (const ship of lodShips) {
      ship.root.getWorldPosition(shipPosition);
      ship.root.getWorldScale(shipScale);
      const projectedPixels = projectedDiameterPx({
        radius: ship.radius * Math.max(shipScale.x, shipScale.y, shipScale.z),
        distance: cameraPosition.distanceTo(shipPosition),
        verticalFovDegrees: camera.fov,
        viewportHeight,
      });
      ship.tier = selectProceduralLod({
        projectedPixels,
        previousTier: ship.tier,
        qualityTier,
      }) as LodTier;
      applyProceduralLod(ship.levels, ship.tier);
    }
  }

  function getLodDiagnostics() {
    const tiers: Record<LodTier, number> = { high: 0, medium: 0, silhouette: 0 };
    for (const ship of lodShips) tiers[ship.tier] += 1;
    return {
      tiers,
      ...analyzeProceduralResourceSharing(lodShips.map((ship) => ship.root)),
    };
  }

  return { group, engineMarkers, muzzleMarkers, updateLod, getLodDiagnostics };
}
