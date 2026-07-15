// Ambient type declaration for wedgeCruiserHull.js — see carrierHull.d.ts
// for why this sidecar exists (allowJs is off project-wide). Only the
// shapes src/bootengine/render/kitbashFleet.ts actually uses are declared.
import type * as THREE from 'three';
import type { HullMats, HullAddFn, HullMount } from './carrierHull';

export interface WedgeCruiserHullInfo {
  length: number;
  height: number;
  width: number;
  engineMounts: HullMount[];
  muzzleAnchor: HullMount;
  turretMounts: HullMount[];
  towerTips: HullMount[];
}

export function createWedgeCruiserHull(
  THREE: typeof import('three'),
  opts: { add: HullAddFn; mats: HullMats; detail?: 'full' | 'wire' }
): WedgeCruiserHullInfo;
