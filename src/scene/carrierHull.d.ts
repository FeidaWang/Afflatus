// Ambient type declaration for carrierHull.js (plain JS, allowJs is off
// project-wide — see tsconfig.json — so a .ts consumer needs this sidecar
// rather than the project loosening allowJs globally). Only the shapes
// src/bootengine/render/kitbashFleet.ts actually uses are declared; this is
// not a full/authoritative type surface for the module.
import type * as THREE from 'three';

export interface HullMats {
  hull: THREE.Material;
  arm: THREE.Material;
  dark: THREE.Material;
  trim: THREE.Material;
  glass: THREE.Material;
  red: THREE.Material;
  blue: THREE.Material;
}

export type HullAddFn = (
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  t?: number[],
  r?: number[],
  s?: number[]
) => THREE.Mesh;

export interface HullMount {
  x: number;
  y: number;
  z: number;
  side?: number;
}

export interface CarrierHullInfo {
  length: number;
  height: number;
  width: number;
  engineMounts: HullMount[];
  muzzleAnchor: HullMount;
  emitterMounts: HullMount[];
  wingMounts: HullMount[];
  towerTip: HullMount;
  turretMounts: HullMount[];
  bayMount: HullMount;
  vlsMounts: HullMount[];
}

export function createCarrierHull(
  THREE: typeof import('three'),
  opts: { add: HullAddFn; mats: HullMats; detail?: 'full' | 'wire' }
): CarrierHullInfo;
