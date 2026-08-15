import { describe, expect, it } from 'vitest';
import { cityHelicopterPoseAt, createCityHelicopterRig } from '../src/city/airTraffic.ts';
import { generateSandboxCity } from '../src/city/generate.ts';

describe('city helicopter motion', () => {
  it('derives a roof-safe orbit for every city profile', () => {
    for (const profile of ['shanghai', 'melbourne', 'hong-kong']) {
      const plan = generateSandboxCity('air-traffic', profile);
      const rig = createCityHelicopterRig(plan);
      const maxStructureHeight = Math.max(
        ...plan.buildings.map((building) => building.bounds.height),
        ...plan.heroLandmarks.map((landmark) => landmark.bounds.height),
      );
      expect(rig.orbitRadius).toBeGreaterThanOrEqual(185);
      expect(rig.height).toBeGreaterThanOrEqual(maxStructureHeight + 24);
    }
  });

  it('keeps the aircraft on one deterministic orbit with finite rotor angles', () => {
    const rig = createCityHelicopterRig(generateSandboxCity('air-motion', 'shanghai'));
    const first = cityHelicopterPoseAt(12.5, rig);
    const repeated = cityHelicopterPoseAt(12.5, rig);
    const later = cityHelicopterPoseAt(13.5, rig);
    const radius = Math.hypot(first.position.x - rig.center.x, first.position.z - rig.center.z);

    expect(first).toEqual(repeated);
    expect(radius).toBeCloseTo(rig.orbitRadius, 8);
    expect(later.yaw).toBeLessThan(first.yaw);
    expect(later.mainRotorAngle).toBeGreaterThan(first.mainRotorAngle);
    expect(later.tailRotorAngle).toBeGreaterThan(first.tailRotorAngle);
    expect(Object.values(later.position).every(Number.isFinite)).toBe(true);
  });

  it('returns a stable freeze frame for reduced motion and invalid time', () => {
    const rig = createCityHelicopterRig(generateSandboxCity('air-freeze', 'melbourne'));
    expect(cityHelicopterPoseAt(Number.NaN, rig)).toEqual(cityHelicopterPoseAt(0, rig));
    expect(cityHelicopterPoseAt(-10, rig)).toEqual(cityHelicopterPoseAt(0, rig));
  });
});
