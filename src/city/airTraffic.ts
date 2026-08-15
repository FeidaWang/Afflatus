import type { CityPlan, CityPoint } from './model';

export interface CityHelicopterRig {
  center: Readonly<{ x: number; z: number }>;
  orbitRadius: number;
  height: number;
  startAngle: number;
  angularSpeed: number;
  bobAmplitude: number;
  bobSpeed: number;
  mainRotorSpeed: number;
  tailRotorSpeed: number;
}

export interface CityHelicopterPose {
  position: Readonly<CityPoint>;
  yaw: number;
  mainRotorAngle: number;
  tailRotorAngle: number;
}

const PROFILE_START_ANGLES = Object.freeze({
  sandbox: 0.35,
  shanghai: 0.18,
  melbourne: 1.05,
  'hong-kong': 0.72,
});

/** Derives a roof-safe orbit from the generated precinct rather than fixed city coordinates. */
export function createCityHelicopterRig(plan: CityPlan): Readonly<CityHelicopterRig> {
  const maxStructureHeight = Math.max(
    plan.profile.landmarkHeight,
    ...plan.buildings.map((building) => building.bounds.height),
    ...plan.heroLandmarks.map((landmark) => landmark.bounds.height),
  );
  return Object.freeze({
    center: Object.freeze({ x: 0, z: 0 }),
    orbitRadius: Math.max(185, plan.extent * 0.38),
    height: Math.max(175, maxStructureHeight + 24),
    startAngle: PROFILE_START_ANGLES[plan.profile.key],
    angularSpeed: 0.065,
    bobAmplitude: 2.4,
    bobSpeed: 0.42,
    mainRotorSpeed: 16,
    tailRotorSpeed: 23,
  });
}

/** Pure deterministic pose; passing time=0 is the reduced-motion freeze frame. */
export function cityHelicopterPoseAt(
  timeSeconds: number,
  rig: CityHelicopterRig,
): Readonly<CityHelicopterPose> {
  const time = Number.isFinite(timeSeconds) ? Math.max(0, timeSeconds) : 0;
  const angle = rig.startAngle + time * rig.angularSpeed;
  return Object.freeze({
    position: Object.freeze({
      x: rig.center.x + Math.cos(angle) * rig.orbitRadius,
      y: rig.height + Math.sin(time * rig.bobSpeed) * rig.bobAmplitude,
      z: rig.center.z + Math.sin(angle) * rig.orbitRadius,
    }),
    // The model nose points along local +X; this aligns it with the orbit tangent.
    yaw: -angle - Math.PI / 2,
    mainRotorAngle: time * rig.mainRotorSpeed,
    tailRotorAngle: time * rig.tailRotorSpeed,
  });
}
