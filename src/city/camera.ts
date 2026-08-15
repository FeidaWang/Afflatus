import { createCatmullRomPath, type CatmullRomPath, type Vec3 } from '../bootengine/catmullRom';
import type { CityPlan } from './model';
import { createCityTourSafetyField, selectCityHeroViewPosition } from './cameraSafety';

export const CITY_SANDBOX_CAMERA: Readonly<Vec3> = Object.freeze({ x: 180, y: 160, z: 220 });
export const CITY_SANDBOX_TARGET: Readonly<Vec3> = Object.freeze({ x: 0, y: 35, z: 0 });
export const CITY_TOUR_TURNS = 1.5;
export const CITY_TOUR_BASE_FOV = 43;
export const CITY_TOUR_MAX_ROLL = Math.PI / 72;

export type CityTourPhase = 'outer' | 'cbd' | 'pullback' | 'complete';

export interface CityTourTimeline {
  cbdEndDay: number;
  cbdEndProgress: number;
}

export interface CityTourPresentation {
  phase: CityTourPhase;
  progress: number;
  fov: number;
  roll: number;
}

export interface CityCameraView {
  id: string;
  labels: Readonly<{ en: string; zh: string }>;
  position: Readonly<Vec3>;
  target: Readonly<Vec3>;
  occlusionCount?: number;
}

export interface CityCameraRig {
  profileKey: CityPlan['profile']['key'];
  home: CityCameraView;
  heroViews: readonly CityCameraView[];
  tour: Readonly<{
    center: Readonly<{ x: number; z: number }>;
    outerRadius: number;
    innerRadius: number;
    outerHeight: number;
    innerHeight: number;
    finalRadius: number;
    finalHeight: number;
  }>;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const ease = (value: number): number => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const lerp = (from: number, to: number, value: number): number => from + (to - from) * value;

/** Keeps the end of the CBD orbit pinned to the generated CBD completion day. */
export function createCityTourTimeline(plan: CityPlan): Readonly<CityTourTimeline> {
  const cbd = plan.buildings.find((building) => building.id === plan.landmarkId);
  const cbdEndDay = Math.min(plan.profile.totalDays, Math.max(0, cbd?.schedule.endDay ?? plan.profile.totalDays * 0.7));
  return Object.freeze({
    cbdEndDay,
    cbdEndProgress: clamp01(cbdEndDay / Math.max(1, plan.profile.totalDays)),
  });
}

/** Maps construction truth to the three equal half-turns without changing the day. */
export function constructionProgressToTourProgress(
  constructionProgress: number,
  timeline: CityTourTimeline,
): number {
  const progress = clamp01(constructionProgress);
  const cbdEnd = Math.min(0.95, Math.max(0.05, timeline.cbdEndProgress));
  if (progress <= cbdEnd) return (progress / cbdEnd) * (2 / 3);
  return (2 / 3) + ((progress - cbdEnd) / (1 - cbdEnd)) * (1 / 3);
}

/** Pure lens/roll contract so camera presentation can be tested without WebGL. */
export function cityTourPresentationAt(progress: number): Readonly<CityTourPresentation> {
  const u = clamp01(progress);
  let phase: CityTourPhase;
  let fov: number;
  if (u < 1 / 3) {
    phase = 'outer';
    fov = lerp(CITY_TOUR_BASE_FOV, 39, ease(u * 3));
  } else if (u < 2 / 3) {
    phase = 'cbd';
    fov = 39 - Math.sin((u - 1 / 3) * Math.PI * 3) * 0.8;
  } else if (u < 1) {
    phase = 'pullback';
    fov = lerp(39, CITY_TOUR_BASE_FOV, ease((u - 2 / 3) * 3));
  } else {
    phase = 'complete';
    fov = CITY_TOUR_BASE_FOV;
  }
  return Object.freeze({
    phase,
    progress: u,
    fov,
    roll: -CITY_TOUR_MAX_ROLL * Math.sin(Math.PI * u),
  });
}

const DEFAULT_SANDBOX_RIG: CityCameraRig = Object.freeze({
  profileKey: 'sandbox',
  home: Object.freeze({
    id: 'sandbox-home',
    labels: Object.freeze({ en: 'Planning overview', zh: '规划总览' }),
    position: CITY_SANDBOX_CAMERA,
    target: CITY_SANDBOX_TARGET,
  }),
  heroViews: Object.freeze([]),
  tour: Object.freeze({
    center: Object.freeze({ x: 0, z: 0 }),
    outerRadius: 360,
    innerRadius: 165,
    outerHeight: 235,
    innerHeight: 195,
    finalRadius: 440,
    finalHeight: 420,
  }),
});

const CAMERA_PRESETS = Object.freeze({
  sandbox: Object.freeze({ angle: Math.atan2(220, 180), radius: Math.hypot(180, 220), height: 160, targetY: 35 }),
  shanghai: Object.freeze({ angle: 0.74, radius: 340, height: 210, targetY: 46 }),
  melbourne: Object.freeze({ angle: 0.9, radius: 290, height: 158, targetY: 30 }),
  'hong-kong': Object.freeze({ angle: 0.72, radius: 365, height: 220, targetY: 44 }),
});

const HERO_VIEW_ANGLES = Object.freeze({
  sandbox: Object.freeze([0.8]),
  shanghai: Object.freeze([0.55, 2.35, -0.65]),
  melbourne: Object.freeze([0.45, 2.55, -1.05]),
  'hong-kong': Object.freeze([1.52, 1.35, 1.72]),
});

/** Derives all camera scale from the current concept plan, never city-specific controllers. */
export function createCityCameraRig(plan: CityPlan): CityCameraRig {
  const preset = CAMERA_PRESETS[plan.profile.key];
  const maxHeight = Math.max(
    plan.profile.landmarkHeight,
    ...plan.buildings.map((building) => building.bounds.height),
    ...plan.heroLandmarks.map((landmark) => landmark.bounds.height),
  );
  const homePosition = Object.freeze({
    x: Math.cos(preset.angle) * preset.radius,
    y: Math.max(preset.height, maxHeight * 1.08),
    z: Math.sin(preset.angle) * preset.radius,
  });
  const homeTarget = Object.freeze({ x: 0, y: preset.targetY, z: 0 });
  const heroSources = plan.heroLandmarks.length
    ? plan.heroLandmarks
    : plan.buildings.filter((building) => building.id === plan.landmarkId).map((building) => ({
      id: building.id,
      labels: Object.freeze({ en: 'CBD landmark', zh: '中央地标' }),
      position: building.position,
      bounds: building.bounds,
    }));
  const angles = HERO_VIEW_ANGLES[plan.profile.key];
  const safetyField = createCityTourSafetyField(plan);
  const heroViewScale = plan.profile.key === 'hong-kong'
    ? Object.freeze({ distance: 1.72, height: 1.32 })
    : Object.freeze({ distance: 1, height: 1 });
  const heroViews = heroSources.map((hero, index) => {
    const angle = angles[index % angles.length];
    const distance = Math.max(82, hero.bounds.height * 0.92, hero.bounds.width * 4.2)
      * heroViewScale.distance;
    const target = Object.freeze({
      x: hero.position.x,
      y: hero.bounds.height * 0.46,
      z: hero.position.z,
    });
    const selection = selectCityHeroViewPosition(
      safetyField,
      target,
      hero.id,
      angle,
      distance,
      Math.max(58, hero.bounds.height * 0.64) * heroViewScale.height,
    );
    return Object.freeze({
      id: hero.id,
      labels: hero.labels,
      position: selection.position,
      target,
      occlusionCount: selection.sightline.occlusionIds.length,
    });
  });
  const profileScale = plan.profile.key === 'shanghai'
    ? 1.14
    : plan.profile.key === 'melbourne'
      ? 0.95
      : plan.profile.key === 'hong-kong'
        ? 1.08
        : 1;
  const innerRadius = Math.max(150, maxHeight * 1.08);

  return Object.freeze({
    profileKey: plan.profile.key,
    home: Object.freeze({
      id: `${plan.profile.key}-home`,
      labels: Object.freeze({ en: 'Planning overview', zh: '规划总览' }),
      position: homePosition,
      target: homeTarget,
    }),
    heroViews: Object.freeze(heroViews),
    tour: Object.freeze({
      center: Object.freeze({ x: 0, z: 0 }),
      outerRadius: Math.max(340, plan.extent * 0.78) * profileScale,
      innerRadius,
      outerHeight: Math.max(220, maxHeight * 1.45),
      innerHeight: Math.max(180, maxHeight * 1.18),
      finalRadius: Math.max(420, plan.extent * 0.92) * profileScale,
      finalHeight: Math.max(390, maxHeight * 2.55),
    }),
  });
}

/**
 * Deterministic one-direction tour. Its geometry is profile-scaled, while the
 * same normalized 1.5-turn narrative remains shared by every city.
 */
export function createCityTourWaypoints(
  samples = 18,
  start: Vec3 = CITY_SANDBOX_CAMERA,
  rig: CityCameraRig = DEFAULT_SANDBOX_RIG,
): Vec3[] {
  const safeSamples = Math.max(6, Math.trunc(samples));
  const { center } = rig.tour;
  const startAngle = Math.atan2(start.z - center.z, start.x - center.x);
  const points: Vec3[] = [{ ...start }];

  for (let index = 1; index <= safeSamples; index += 1) {
    const u = index / safeSamples;
    const angle = startAngle + u * Math.PI * 2 * CITY_TOUR_TURNS;
    let radius;
    let height;
    if (u < 1 / 3) {
      // Keep the opening 90 degrees wide, then contract during the final 90.
      const local = u * 3;
      const contraction = local <= 0.5 ? 0 : ease((local - 0.5) * 2);
      radius = lerp(rig.tour.outerRadius, rig.tour.innerRadius, contraction);
      height = lerp(rig.tour.outerHeight, rig.tour.innerHeight, contraction);
    } else if (u < 2 / 3) {
      radius = rig.tour.innerRadius;
      height = rig.tour.innerHeight + Math.sin(u * Math.PI * 6) * Math.max(6, rig.tour.innerHeight * 0.04);
    } else {
      const local = ease((u - 2 / 3) * 3);
      radius = lerp(rig.tour.innerRadius, rig.tour.finalRadius, local);
      height = lerp(rig.tour.innerHeight, rig.tour.finalHeight, local);
    }
    points.push({
      x: center.x + Math.cos(angle) * radius,
      y: height,
      z: center.z + Math.sin(angle) * radius,
    });
  }
  return points;
}

export function createCityTourPath(
  start: Vec3 = CITY_SANDBOX_CAMERA,
  rig: CityCameraRig = DEFAULT_SANDBOX_RIG,
): CatmullRomPath {
  return createCatmullRomPath(createCityTourWaypoints(18, start, rig));
}

export function createCityTourFocusPath(
  rig: CityCameraRig,
  startTarget: Vec3 = rig.home.target,
): CatmullRomPath {
  const heroTargets = rig.heroViews.map((view) => ({ ...view.target }));
  const points = [
    { ...startTarget },
    ...(heroTargets.length ? heroTargets : [{ ...rig.home.target }]),
    { ...rig.home.target },
  ];
  return createCatmullRomPath(points);
}
