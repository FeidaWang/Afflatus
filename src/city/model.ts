export const CITY_TOTAL_DAYS = 210;

import type {
  CityConceptProfileId,
  CityConceptProfileKey,
  CityExperienceProfileId,
  CityHeroLandmarkForm,
  CityLandmarkForm,
} from './profiles';

export type CityZone = 'core' | 'mixed' | 'residential' | 'park' | 'water';
export type BuildingKind = 'office' | 'residential' | 'mall' | 'cylinder' | 'landmark';
export type RoofKind = 'flat' | 'garden' | 'spire' | 'crown';
export type CityAxis = 'x' | 'z';

export interface CitySchedule {
  startDay: number;
  endDay: number;
}

export interface CityPoint {
  x: number;
  y: number;
  z: number;
}

export interface CityBounds {
  width: number;
  height: number;
  depth: number;
}

export interface CityBlock {
  id: string;
  gridX: number;
  gridZ: number;
  center: CityPoint;
  zone: CityZone;
}

export interface CityRoad {
  id: string;
  kind: 'road';
  axis: CityAxis;
  position: number;
  length: number;
  width: number;
  schedule: CitySchedule;
}

export interface CityBuilding {
  id: string;
  kind: 'building' | 'landmark';
  buildingKind: BuildingKind;
  blockId: string;
  zone: CityZone;
  position: CityPoint;
  bounds: CityBounds;
  rotationY: number;
  roofKind: RoofKind;
  capacity: {
    residents: number;
    jobs: number;
  };
  schedule: CitySchedule;
}

export interface CityTree {
  id: string;
  kind: 'tree';
  blockId: string;
  position: CityPoint;
  radius: number;
  height: number;
  availableDay: number;
}

export interface CityVehicle {
  id: string;
  kind: 'vehicle';
  roadId: string;
  axis: CityAxis;
  lane: number;
  direction: 1 | -1;
  offset: number;
  speed: number;
  availableDay: number;
}

export interface CityWater {
  id: string;
  kind: 'water';
  axis: CityAxis;
  position: CityPoint;
  width: number;
  length: number;
}

export interface CityHeroLandmark {
  id: string;
  kind: 'hero-landmark';
  form: CityHeroLandmarkForm;
  labels: Readonly<{ en: string; zh: string }>;
  blockId: string;
  position: CityPoint;
  bounds: CityBounds;
  rotationY: number;
  schedule: CitySchedule;
  truthClass: 'generated-concept';
}

export interface CityProfile {
  key: CityConceptProfileKey;
  id: CityConceptProfileId;
  labels: Readonly<{ en: string; zh: string }>;
  experienceProfileId: CityExperienceProfileId | null;
  truthClass: 'generated-concept';
  radius: number;
  blockSize: number;
  roadWidth: number;
  pitch: number;
  totalDays: number;
  heightScale: number;
  landmarkHeight: number;
  landmarkForm: CityLandmarkForm;
  residentialBuildingCount: 2 | 3;
  coreBuildingCount: 2 | 3;
  mixedBuildingCount: 2 | 3;
  vehicleCount: number;
  parkProbability: number;
  coreCylinderChance: number;
  coreOffset: Readonly<{ x: number; z: number }>;
  landmarkGrid: Readonly<{ x: number; z: number }>;
  trafficSide: 'left' | 'right';
  waterChannel: Readonly<{ axis: CityAxis; gridIndex: number }> | null;
  ridgeBackdrop: Readonly<{
    axis: CityAxis;
    side: -1 | 1;
    distance: number;
    span: number;
    peakCount: number;
    maxHeight: number;
  }> | null;
  heroLandmarks: readonly import('./profiles').CityHeroLandmarkTemplate[];
}

export interface CityPlan {
  version: 1;
  seed: string;
  seedHash: number;
  profile: CityProfile;
  extent: number;
  blocks: CityBlock[];
  roads: CityRoad[];
  buildings: CityBuilding[];
  trees: CityTree[];
  vehicles: CityVehicle[];
  water: CityWater[];
  heroLandmarks: CityHeroLandmark[];
  landmarkId: string;
}

export type ConstructionPhase = 'hidden' | 'skeleton' | 'slabs' | 'shell' | 'roof' | 'complete';

export interface ConstructionState {
  phase: ConstructionPhase;
  phaseProgress: number;
  totalProgress: number;
  visible: boolean;
  complete: boolean;
}

export interface CityMetrics {
  day: number;
  completion: number;
  residents: number;
  jobs: number;
  energy: number;
  traffic: number;
}

export type CityMetricKey = 'completion' | 'residents' | 'jobs' | 'energy' | 'traffic';

export interface CityMetricEvidence {
  plannedStructures: number;
  completedStructures: number;
  activeSites: number;
  activeConstructionLoad: number;
  plannedVolume: number;
  progressedVolume: number;
  residentialCompleteSites: number;
  residentialRoofSites: number;
  jobCompleteSites: number;
  jobRoofSites: number;
  roadProgressEquivalent: number;
  plannedRoads: number;
}

export interface CityMetricReading {
  key: CityMetricKey;
  value: number;
  unit: 'ratio' | 'people' | 'jobs' | 'index';
  cause: Readonly<{ en: string; zh: string }>;
}

export interface CityMetricSnapshot {
  day: number;
  truthClass: 'simulated-state-derived';
  metrics: CityMetrics;
  evidence: CityMetricEvidence;
  readings: Readonly<Record<CityMetricKey, CityMetricReading>>;
}
