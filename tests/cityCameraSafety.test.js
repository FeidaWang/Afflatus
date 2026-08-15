import { describe, expect, it } from 'vitest';
import {
  cityTourClearanceHeightAt,
  createCityTourSafetyField,
  evaluateCityCameraSightline,
  resolveCityTourClearance,
  selectCityHeroViewPosition,
} from '../src/city/cameraSafety.ts';
import { createCityCameraRig, createCityTourPath } from '../src/city/camera.ts';
import { generateSandboxCity } from '../src/city/generate.ts';

describe('city tour camera safety field', () => {
  it('covers every generated structure with deterministic roof clearance', () => {
    for (const profile of ['shanghai', 'melbourne', 'hong-kong']) {
      const plan = generateSandboxCity('camera-safety', profile);
      const field = createCityTourSafetyField(plan);
      expect(field.envelopes).toHaveLength(plan.buildings.length + plan.heroLandmarks.length);
      expect(field).toEqual(createCityTourSafetyField(plan));
      for (const envelope of field.envelopes) {
        expect(cityTourClearanceHeightAt(field, envelope.center.x, envelope.center.z))
          .toBeGreaterThanOrEqual(envelope.top + field.verticalMargin);
      }
      expect(cityTourClearanceHeightAt(field, plan.extent * 2, plan.extent * 2)).toBe(0);
    }
  });

  it('preserves the takeover frame and then raises only the camera height', () => {
    const field = createCityTourSafetyField(generateSandboxCity('camera-takeover', 'shanghai'));
    const envelope = field.envelopes[0];
    const point = { x: envelope.center.x, y: 3, z: envelope.center.z };
    const untouched = resolveCityTourClearance(point, field, 0);
    const halfway = resolveCityTourClearance(point, field, 0.5);
    const safe = resolveCityTourClearance(point, field, 1);

    expect(untouched.position).toEqual(point);
    expect(halfway.position.x).toBe(point.x);
    expect(halfway.position.z).toBe(point.z);
    expect(halfway.position.y).toBeGreaterThan(point.y);
    expect(safe.position.y).toBeGreaterThanOrEqual(safe.requiredHeight);
    expect(resolveCityTourClearance(safe.position, field, 1).position).toEqual(safe.position);
  });

  it('feathers clearance continuously instead of stepping at an envelope edge', () => {
    const field = createCityTourSafetyField(generateSandboxCity('camera-feather', 'melbourne'));
    const envelope = field.envelopes[0];
    const isolated = { ...field, envelopes: [envelope] };
    const start = envelope.center.x + envelope.halfWidth;
    const heights = Array.from({ length: 89 }, (_, index) => (
      cityTourClearanceHeightAt(isolated, start + index * 0.25, envelope.center.z)
    ));
    for (let index = 1; index < heights.length; index += 1) {
      expect(Number.isFinite(heights[index])).toBe(true);
      expect(Math.abs(heights[index] - heights[index - 1])).toBeLessThan(4);
    }
    expect(heights.at(-1)).toBeCloseTo(0, 12);
  });

  it('escapes a low inner-city takeover without changing horizontal direction', () => {
    const plan = generateSandboxCity('camera-low-takeover', 'shanghai');
    const field = createCityTourSafetyField(plan);
    const envelope = field.envelopes.find((entry) => entry.id === plan.landmarkId);
    const start = { x: envelope.center.x, y: 3, z: envelope.center.z };
    const path = createCityTourPath(start, createCityCameraRig(plan));
    const resolved = [];

    for (let index = 0; index <= 200; index += 1) {
      const u = index / 2000;
      const raw = path.pos(u);
      const clearance = resolveCityTourClearance(raw, field, Math.min(1, u / 0.06));
      expect(clearance.position.x).toBe(raw.x);
      expect(clearance.position.z).toBe(raw.z);
      expect(Object.values(clearance.position).every(Number.isFinite)).toBe(true);
      if (u >= 0.06) expect(clearance.position.y).toBeGreaterThanOrEqual(clearance.requiredHeight);
      resolved.push(clearance.position);
    }

    expect(resolved[0]).toEqual(start);
    for (let index = 1; index < resolved.length; index += 1) {
      const current = resolved[index];
      const previous = resolved[index - 1];
      expect(Math.hypot(
        current.x - previous.x,
        current.y - previous.y,
        current.z - previous.z,
      )).toBeLessThan(8);
    }
  });

  it('rejects an occupied camera point and resolves an unobstructed hero sightline', () => {
    const plan = generateSandboxCity('city-corn-visual-001', 'shanghai');
    const field = createCityTourSafetyField(plan);
    const hero = plan.heroLandmarks.find((landmark) => landmark.form === 'corn-cob');
    expect(hero).toBeTruthy();
    const target = { x: hero.position.x, y: hero.bounds.height * 0.46, z: hero.position.z };
    const occupiedEnvelope = field.envelopes.find((envelope) => envelope.id !== hero.id);
    const occupied = {
      x: occupiedEnvelope.center.x,
      y: Math.min(occupiedEnvelope.top, 20),
      z: occupiedEnvelope.center.z,
    };
    expect(evaluateCityCameraSightline(field, occupied, target, hero.id).cameraInsideIds)
      .toContain(occupiedEnvelope.id);

    const selection = selectCityHeroViewPosition(
      field,
      target,
      hero.id,
      2.35,
      Math.max(82, hero.bounds.height * 0.92, hero.bounds.width * 4.2),
      Math.max(58, hero.bounds.height * 0.64),
    );
    expect(selection.sightline.cameraInsideIds).toEqual([]);
    expect(selection.sightline.occlusionIds).toEqual([]);
    expect(selection).toEqual(selectCityHeroViewPosition(
      field,
      target,
      hero.id,
      2.35,
      Math.max(82, hero.bounds.height * 0.92, hero.bounds.width * 4.2),
      Math.max(58, hero.bounds.height * 0.64),
    ));
  });
});
