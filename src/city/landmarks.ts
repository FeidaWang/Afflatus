import type {
  CityBounds,
  CityHeroLandmark,
  CityPoint,
} from './model';
import type { CityHeroLandmarkForm } from './profiles';

export type CityHeroPrimitive = 'box' | 'cylinder' | 'sphere' | 'cone';
export type CityHeroTone = 'white' | 'pale' | 'orange' | 'green';

export interface CityHeroComponent {
  id: string;
  landmarkId: string;
  primitive: CityHeroPrimitive;
  tone: CityHeroTone;
  position: CityPoint;
  bounds: CityBounds;
  rotationY: number;
  revealStart: number;
  revealEnd: number;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

function component(
  landmark: CityHeroLandmark,
  suffix: string,
  primitive: CityHeroPrimitive,
  localX: number,
  baseY: number,
  localZ: number,
  width: number,
  height: number,
  depth: number,
  tone: CityHeroTone = 'white',
  rotationOffset = 0,
): CityHeroComponent {
  const cos = Math.cos(landmark.rotationY);
  const sin = Math.sin(landmark.rotationY);
  const revealStart = clamp01(baseY / Math.max(1, landmark.bounds.height));
  const revealEnd = clamp01((baseY + height) / Math.max(1, landmark.bounds.height));
  return Object.freeze({
    id: `${landmark.id}-${suffix}`,
    landmarkId: landmark.id,
    primitive,
    tone,
    position: Object.freeze({
      x: landmark.position.x + localX * cos + localZ * sin,
      y: baseY + height / 2,
      z: landmark.position.z - localX * sin + localZ * cos,
    }),
    bounds: Object.freeze({ width, height, depth }),
    rotationY: landmark.rotationY + rotationOffset,
    revealStart,
    revealEnd: Math.max(revealStart + 0.02, revealEnd),
  });
}

function pearlMast(landmark: CityHeroLandmark): CityHeroComponent[] {
  return [
    component(landmark, 'podium', 'cylinder', 0, 0, 0, 10, 8, 10),
    component(landmark, 'lower-mast', 'cylinder', 0, 8, 0, 3.2, 45, 3.2, 'pale'),
    component(landmark, 'lower-pearl', 'sphere', 0, 28, 0, 18, 18, 18, 'orange'),
    component(landmark, 'upper-mast', 'cylinder', 0, 53, 0, 2.5, 45, 2.5, 'pale'),
    component(landmark, 'upper-pearl', 'sphere', 0, 72, 0, 10, 10, 10, 'white'),
    component(landmark, 'spire', 'cone', 0, 98, 0, 4, 20, 4, 'orange'),
  ];
}

function steppedCrown(landmark: CityHeroLandmark): CityHeroComponent[] {
  return [
    component(landmark, 'base', 'box', 0, 0, 0, 19, 58, 19),
    component(landmark, 'middle', 'box', 0, 58, 0, 15.5, 32, 15.5, 'pale', 0.035),
    component(landmark, 'crown', 'box', 0, 90, 0, 11, 16, 11, 'white', 0.07),
    component(landmark, 'spire', 'cone', 0, 106, 0, 4.5, 6, 4.5, 'orange'),
  ];
}

function notchedFin(landmark: CityHeroLandmark): CityHeroComponent[] {
  return [
    component(landmark, 'shaft', 'box', -2.4, 0, 0, 12.5, 88, 18),
    component(landmark, 'fin', 'box', 5.2, 0, 0, 3, 98, 15, 'pale'),
    component(landmark, 'bridge', 'box', 1.8, 82, 0, 9, 8, 14, 'white'),
    component(landmark, 'blade', 'cone', 5.2, 98, 0, 4, 6, 10, 'orange'),
  ];
}

function cornCob(landmark: CityHeroLandmark): CityHeroComponent[] {
  const segmentCount = 14;
  const segmentHeight = landmark.bounds.height / segmentCount;
  return Array.from({ length: segmentCount }, (_, index) => {
    const t = (index + 0.5) / segmentCount;
    const bulge = Math.sin(Math.PI * t) ** 0.72;
    const taper = (0.44 + bulge * 0.48) * (1 - t * 0.12);
    const width = landmark.bounds.width * taper;
    const depth = landmark.bounds.depth * taper * (0.88 + Math.sin(t * Math.PI * 2) * 0.025);
    return component(
      landmark,
      `curve-${String(index).padStart(2, '0')}`,
      'cylinder',
      0,
      index * segmentHeight,
      0,
      width,
      segmentHeight + 0.12,
      depth,
      index % 3 === 1 ? 'pale' : 'white',
      (index - (segmentCount - 1) / 2) * 0.014,
    );
  });
}

function stationHall(landmark: CityHeroLandmark): CityHeroComponent[] {
  return [
    component(landmark, 'hall', 'box', 0, 0, 0, 38, 8, 20),
    component(landmark, 'dome', 'sphere', -8, 8, 0, 13, 8, 12, 'pale'),
    component(landmark, 'clock', 'box', 13, 7, 0, 6, 11, 7, 'white'),
    component(landmark, 'clock-roof', 'cone', 13, 18, 0, 7, 2, 8, 'orange'),
  ];
}

function civicShards(landmark: CityHeroLandmark): CityHeroComponent[] {
  return [
    component(landmark, 'plinth', 'box', 0, 0, 0, 34, 5, 26),
    component(landmark, 'west-shard', 'box', -8, 5, -2, 13, 14, 18, 'pale', 0.2),
    component(landmark, 'east-shard', 'box', 8, 5, 2, 12, 19, 16, 'white', -0.28),
    component(landmark, 'court', 'box', 0, 5, 7, 12, 8, 9, 'green', 0.08),
  ];
}

function artsSpire(landmark: CityHeroLandmark): CityHeroComponent[] {
  return [
    component(landmark, 'base', 'box', 0, 0, 0, 16, 9, 16),
    component(landmark, 'mast', 'cylinder', 0, 9, 0, 3.8, 44, 3.8, 'pale'),
    component(landmark, 'spire', 'cone', 0, 53, 0, 12, 43, 12, 'orange'),
  ];
}

const COMPONENT_FACTORIES: Readonly<Record<CityHeroLandmarkForm, (landmark: CityHeroLandmark) => CityHeroComponent[]>> = Object.freeze({
  'pearl-mast': pearlMast,
  'stepped-crown': steppedCrown,
  'notched-fin': notchedFin,
  'corn-cob': cornCob,
  'station-hall': stationHall,
  'civic-shards': civicShards,
  'arts-spire': artsSpire,
});

export function createCityHeroRenderPlan(landmarks: readonly CityHeroLandmark[]): readonly CityHeroComponent[] {
  return Object.freeze(landmarks.flatMap((landmark) => COMPONENT_FACTORIES[landmark.form](landmark)));
}
