import type { CityPlan, CityPoint } from './model';

export interface CityTourSafetyEnvelope {
  id: string;
  center: Readonly<{ x: number; z: number }>;
  halfWidth: number;
  halfDepth: number;
  top: number;
}

export interface CityTourSafetyField {
  envelopes: readonly CityTourSafetyEnvelope[];
  horizontalMargin: number;
  verticalMargin: number;
  feather: number;
}

export interface CityTourClearanceResult {
  position: Readonly<CityPoint>;
  requiredHeight: number;
  lift: number;
}

export interface CityCameraSightlineResult {
  cameraInsideIds: readonly string[];
  occlusionIds: readonly string[];
}

export interface CityHeroViewSelection {
  position: Readonly<CityPoint>;
  sightline: Readonly<CityCameraSightlineResult>;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const ease = (value: number): number => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

/** Conservative rotated AABBs keep the tour camera outside finished structures. */
export function createCityTourSafetyField(plan: CityPlan): Readonly<CityTourSafetyField> {
  const horizontalMargin = 7;
  const verticalMargin = 12;
  const feather = 22;
  const structures = [
    ...plan.buildings.map((building) => ({
      id: building.id,
      position: building.position,
      bounds: building.bounds,
      rotationY: building.rotationY,
      roofAllowance: building.roofKind === 'spire' ? 8 : 3,
    })),
    ...plan.heroLandmarks.map((landmark) => ({
      id: landmark.id,
      position: landmark.position,
      bounds: landmark.bounds,
      rotationY: landmark.rotationY,
      roofAllowance: 4,
    })),
  ];
  const envelopes = structures.map((structure) => {
    const cosine = Math.abs(Math.cos(structure.rotationY));
    const sine = Math.abs(Math.sin(structure.rotationY));
    return Object.freeze({
      id: structure.id,
      center: Object.freeze({ x: structure.position.x, z: structure.position.z }),
      halfWidth: (
        cosine * structure.bounds.width / 2
        + sine * structure.bounds.depth / 2
        + horizontalMargin
      ),
      halfDepth: (
        sine * structure.bounds.width / 2
        + cosine * structure.bounds.depth / 2
        + horizontalMargin
      ),
      top: structure.bounds.height + structure.roofAllowance,
    });
  });
  return Object.freeze({
    envelopes: Object.freeze(envelopes),
    horizontalMargin,
    verticalMargin,
    feather,
  });
}

/** Smooth maximum clearance height at a horizontal camera coordinate. */
export function cityTourClearanceHeightAt(
  field: CityTourSafetyField,
  x: number,
  z: number,
): number {
  let requiredHeight = 0;
  for (const envelope of field.envelopes) {
    const outsideX = Math.max(0, Math.abs(x - envelope.center.x) - envelope.halfWidth);
    const outsideZ = Math.max(0, Math.abs(z - envelope.center.z) - envelope.halfDepth);
    const outsideDistance = Math.hypot(outsideX, outsideZ);
    if (outsideDistance >= field.feather) continue;
    const influence = ease(1 - outsideDistance / field.feather);
    requiredHeight = Math.max(
      requiredHeight,
      (envelope.top + field.verticalMargin) * influence,
    );
  }
  return requiredHeight;
}

/** Raises only Y; activation=0 preserves the exact takeover frame, then eases in. */
export function resolveCityTourClearance(
  point: CityPoint,
  field: CityTourSafetyField,
  activation = 1,
): Readonly<CityTourClearanceResult> {
  const requiredHeight = cityTourClearanceHeightAt(field, point.x, point.z);
  const fullLift = Math.max(0, requiredHeight - point.y);
  const lift = fullLift * ease(activation);
  return Object.freeze({
    position: Object.freeze({ x: point.x, y: point.y + lift, z: point.z }),
    requiredHeight,
    lift,
  });
}

function segmentIntervalForEnvelope(
  from: CityPoint,
  to: CityPoint,
  envelope: CityTourSafetyEnvelope,
): Readonly<{ enter: number; exit: number }> | null {
  let enter = 0;
  let exit = 1;
  const axes = [
    { origin: from.x, delta: to.x - from.x, min: envelope.center.x - envelope.halfWidth, max: envelope.center.x + envelope.halfWidth },
    { origin: from.z, delta: to.z - from.z, min: envelope.center.z - envelope.halfDepth, max: envelope.center.z + envelope.halfDepth },
  ];
  for (const axis of axes) {
    if (Math.abs(axis.delta) < 1e-8) {
      if (axis.origin < axis.min || axis.origin > axis.max) return null;
      continue;
    }
    const first = (axis.min - axis.origin) / axis.delta;
    const second = (axis.max - axis.origin) / axis.delta;
    enter = Math.max(enter, Math.min(first, second));
    exit = Math.min(exit, Math.max(first, second));
    if (enter > exit) return null;
  }
  return Object.freeze({ enter, exit });
}

/**
 * Tests a finished-city hero shot independently of WebGL. Conservative AABBs
 * catch both a camera placed inside a structure and a structure cutting the
 * sightline before it reaches the selected landmark.
 */
export function evaluateCityCameraSightline(
  field: CityTourSafetyField,
  position: CityPoint,
  target: CityPoint,
  excludedId: string,
): Readonly<CityCameraSightlineResult> {
  const cameraInsideIds: string[] = [];
  const occlusionIds: string[] = [];
  for (const envelope of field.envelopes) {
    if (envelope.id === excludedId) continue;
    const insideHorizontal = (
      Math.abs(position.x - envelope.center.x) <= envelope.halfWidth
      && Math.abs(position.z - envelope.center.z) <= envelope.halfDepth
    );
    if (insideHorizontal && position.y <= envelope.top + field.verticalMargin) {
      cameraInsideIds.push(envelope.id);
    }

    const interval = segmentIntervalForEnvelope(position, target, envelope);
    if (!interval) continue;
    // Ignore endpoint-only contact at the camera and target. A real obstacle
    // must occupy a visible portion of the segment.
    const enter = Math.max(0.015, interval.enter);
    const exit = Math.min(0.985, interval.exit);
    if (enter > exit) continue;
    const yAtEnter = position.y + (target.y - position.y) * enter;
    const yAtExit = position.y + (target.y - position.y) * exit;
    if (Math.min(yAtEnter, yAtExit) <= envelope.top + field.verticalMargin) {
      occlusionIds.push(envelope.id);
    }
  }
  return Object.freeze({
    cameraInsideIds: Object.freeze(cameraInsideIds),
    occlusionIds: Object.freeze(occlusionIds),
  });
}

const HERO_ANGLE_OFFSETS = Object.freeze([
  0,
  Math.PI / 12, -Math.PI / 12,
  Math.PI / 6, -Math.PI / 6,
  Math.PI / 4, -Math.PI / 4,
  Math.PI / 3, -Math.PI / 3,
  Math.PI / 2, -Math.PI / 2,
  Math.PI * 2 / 3, -Math.PI * 2 / 3,
  Math.PI * 5 / 6, -Math.PI * 5 / 6,
  Math.PI,
]);
const HERO_DISTANCE_FACTORS = Object.freeze([1, 1.18, 1.42, 1.7]);
const HERO_HEIGHT_OFFSETS = Object.freeze([0, 24, 52, 88]);

/** Selects the least-displaced deterministic hero shot with a clear sightline. */
export function selectCityHeroViewPosition(
  field: CityTourSafetyField,
  target: CityPoint,
  excludedId: string,
  preferredAngle: number,
  baseDistance: number,
  baseHeight: number,
): Readonly<CityHeroViewSelection> {
  let best: CityHeroViewSelection | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let angleIndex = 0; angleIndex < HERO_ANGLE_OFFSETS.length; angleIndex += 1) {
    const angle = preferredAngle + HERO_ANGLE_OFFSETS[angleIndex];
    for (let distanceIndex = 0; distanceIndex < HERO_DISTANCE_FACTORS.length; distanceIndex += 1) {
      const distance = baseDistance * HERO_DISTANCE_FACTORS[distanceIndex];
      for (let heightIndex = 0; heightIndex < HERO_HEIGHT_OFFSETS.length; heightIndex += 1) {
        const position = Object.freeze({
          x: target.x + Math.cos(angle) * distance,
          y: baseHeight + HERO_HEIGHT_OFFSETS[heightIndex],
          z: target.z + Math.sin(angle) * distance,
        });
        const sightline = evaluateCityCameraSightline(field, position, target, excludedId);
        const score = (
          sightline.cameraInsideIds.length * 100_000
          + sightline.occlusionIds.length * 10_000
          + angleIndex * 100
          + distanceIndex * 10
          + heightIndex
        );
        if (score >= bestScore) continue;
        best = Object.freeze({ position, sightline });
        bestScore = score;
      }
    }
  }
  if (!best) {
    const position = Object.freeze({
      x: target.x + Math.cos(preferredAngle) * baseDistance,
      y: baseHeight,
      z: target.z + Math.sin(preferredAngle) * baseDistance,
    });
    return Object.freeze({
      position,
      sightline: evaluateCityCameraSightline(field, position, target, excludedId),
    });
  }
  return best;
}
