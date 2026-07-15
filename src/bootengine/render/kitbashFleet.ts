/* ============================================================
   KITBASH FLEET — U29 P2: procedural fleet assembly reusing the EXISTING
   carrierHull.js / odinHull.js part-generator library (main site's capital-
   ship kitbash geometry — see src/scene/carrierHull.js / odinHull.js).
   Per the U29 downscope table: "程序化 kitbash 优先...模块化部件库已有基础"
   — the two hull generators ARE the modular part library; this module is
   the piece that was still missing, assembling several hull instances into
   one seeded fleet formation and exposing their mount points as live
   Object3D markers (children of each ship, so .getWorldPosition() tracks
   them correctly if a ship ever moves/rotates) for the render pieces
   (thruster particles, laser beams) to attach to.

   Both createCarrierHull/createOdinHull are already DOM/WebGL-free part
   generators — THREE is passed in as a parameter, they import nothing
   themselves — confirmed zero coupling back onto topdownCombat.js/main.js,
   so reusing them from src/bootengine/render/ pulls in only `three` itself.

   Determinism is PARTIAL, and that's a real tradeoff, not an oversight:
   fleet COMPOSITION (escort count/formation slot) flows through the seeded
   rng below, so the same seed always produces the same layout. Each hull's
   own internal greeble scatter (rivets/panel clutter) does NOT —
   carrierHull.js/odinHull.js call bare Math.random() internally, and this
   module deliberately does not modify those existing files (surgical-
   changes discipline) to force it through.
   ============================================================ */

import * as THREE from 'three';
import { createCarrierHull } from '../../scene/carrierHull.js';
import { createOdinHull } from '../../scene/odinHull.js';
import type { HullMats } from '../../scene/carrierHull';

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
    const x = side * (5.5 + rank * 2.2 + (rng() - 0.5) * 1.2);
    const z = -6 - rank * 3.4 + (rng() - 0.5) * 2.0;
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
}

function buildMats(): HullMats {
  // Same "space gray" family as armorMaterial.ts's darkened FS 595C
  // direction (#4e5257) — keeps this P2 slice visually consistent with the
  // armor material slice instead of introducing a third unrelated palette.
  return {
    hull: new THREE.MeshStandardMaterial({ color: 0x4e5257, metalness: 0.5, roughness: 0.55 }),
    arm: new THREE.MeshStandardMaterial({ color: 0x3c4045, metalness: 0.5, roughness: 0.6 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x22262a, metalness: 0.55, roughness: 0.6 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x8a939c, metalness: 0.6, roughness: 0.4 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x1a1410, metalness: 0.3, roughness: 0.2, emissive: 0xcc7a22, emissiveIntensity: 0.6 }),
    red: new THREE.MeshStandardMaterial({ color: 0xff4030, emissive: 0xff2010, emissiveIntensity: 0.6 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x60c0ff, emissive: 0x3090ff, emissiveIntensity: 0.6 }),
  };
}

type Mount = { x: number; y: number; z: number };
type AddFn = (geo: THREE.BufferGeometry, mat: THREE.Material, t?: number[], r?: number[], s?: number[]) => THREE.Mesh;

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

function addMarkers(ship: THREE.Group, mounts: Mount[], into: THREE.Object3D[]): void {
  for (const m of mounts) {
    const marker = new THREE.Object3D();
    marker.position.set(m.x, m.y, m.z);
    ship.add(marker);
    into.push(marker);
  }
}

export function createKitbashFleet(opts: { rng: () => number; escortCount?: number }): KitbashFleet {
  const { rng } = opts;
  const escortCount = opts.escortCount ?? 4;
  const group = new THREE.Group();
  const engineMarkers: THREE.Object3D[] = [];
  const muzzleMarkers: THREE.Object3D[] = [];

  // ---- carrier: the fleet's centerpiece, stationary at the formation origin ----
  const carrierShip = new THREE.Group();
  const carrierInfo = createCarrierHull(THREE, { add: makeAdd(carrierShip), mats: buildMats(), detail: 'full' });
  group.add(carrierShip);
  addMarkers(carrierShip, carrierInfo.engineMounts, engineMarkers);
  const carrierMuzzle = new THREE.Object3D();
  carrierMuzzle.position.set(carrierInfo.muzzleAnchor.x, carrierInfo.muzzleAnchor.y, carrierInfo.muzzleAnchor.z);
  carrierShip.add(carrierMuzzle);
  muzzleMarkers.push(carrierMuzzle);

  // ---- escorts: seeded formation, reusing the slimmer Odin hull ----
  const formation = computeFormation(rng, escortCount);
  for (const slot of formation) {
    const escortShip = new THREE.Group();
    const escortInfo = createOdinHull(THREE, { add: makeAdd(escortShip), mats: buildMats(), detail: 'full' });
    escortShip.scale.setScalar(0.4); // escorts read as smaller hulls next to the carrier
    escortShip.position.set(slot.x, slot.y, slot.z);
    escortShip.rotation.y = slot.yaw; // same +Z forward heading as the carrier, formation-flying
    group.add(escortShip);
    addMarkers(escortShip, escortInfo.engineMounts, engineMarkers);
    const muzzle = new THREE.Object3D();
    muzzle.position.set(escortInfo.muzzleAnchor.x, escortInfo.muzzleAnchor.y, escortInfo.muzzleAnchor.z);
    escortShip.add(muzzle);
    muzzleMarkers.push(muzzle);
  }

  return { group, engineMarkers, muzzleMarkers };
}
