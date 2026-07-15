// Ambient type declaration for odinHull.js — see carrierHull.d.ts for why
// this sidecar exists (allowJs is off project-wide). Only the shapes
// src/bootengine/render/kitbashFleet.ts actually uses are declared; this is
// not a full/authoritative type surface for the module.
import type * as THREE from 'three';
import type { HullMats, HullAddFn, HullMount } from './carrierHull';

export interface OdinHullInfo {
  length: number;
  height: number;
  bowLen: number;
  bowRoot: number;
  engineMounts: HullMount[];
  turretMounts: HullMount[];
  bellyPodMounts: HullMount[];
  mastTips: HullMount[];
  muzzleAnchor: HullMount;
  sideBayMounts: HullMount[];
  lateralTurretMounts: HullMount[];
}

export function createOdinHull(
  THREE: typeof import('three'),
  opts: { add: HullAddFn; mats: HullMats; detail?: 'full' | 'wire' }
): OdinHullInfo;
