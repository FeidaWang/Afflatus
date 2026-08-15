import { describe, expect, it } from 'vitest';
import {
  CITY_SANDBOX_CAMERA,
  CITY_TOUR_BASE_FOV,
  CITY_TOUR_MAX_ROLL,
  CITY_TOUR_TURNS,
  cityTourPresentationAt,
  constructionProgressToTourProgress,
  createCityCameraRig,
  createCityTourFocusPath,
  createCityTourPath,
  createCityTourTimeline,
  createCityTourWaypoints,
} from '../src/city/camera.ts';
import { generateSandboxCity } from '../src/city/generate.ts';

function unwrapAngles(points) {
  const angles = [];
  let previous = Math.atan2(points[0].z, points[0].x);
  angles.push(previous);
  for (const point of points.slice(1)) {
    let angle = Math.atan2(point.z, point.x);
    while (angle - previous > Math.PI) angle -= Math.PI * 2;
    while (angle - previous < -Math.PI) angle += Math.PI * 2;
    angles.push(angle);
    previous = angle;
  }
  return angles;
}

describe('city tour camera path', () => {
  it('starts at the controlled camera and ends after one-direction rotation', () => {
    const path = createCityTourPath();
    const positions = Array.from({ length: 1001 }, (_, index) => path.pos(index / 1000));
    const angles = unwrapAngles(positions);

    expect(path.pos(0)).toEqual(CITY_SANDBOX_CAMERA);
    expect(angles.at(-1) - angles[0]).toBeCloseTo(Math.PI * 2 * CITY_TOUR_TURNS, 2);
    for (let index = 1; index < angles.length; index += 1) {
      expect(angles[index] - angles[index - 1]).toBeGreaterThanOrEqual(-0.001);
    }
  });

  it('stays finite and continuous across every spline segment', () => {
    const path = createCityTourPath();
    for (let index = 0; index <= 1000; index += 1) {
      const { pos, tangent } = path.sample(index / 1000);
      for (const value of [...Object.values(pos), ...Object.values(tangent)]) {
        expect(Number.isFinite(value)).toBe(true);
      }
      if (index === 0) continue;
      const previous = path.pos((index - 1) / 1000);
      expect(Math.hypot(pos.x - previous.x, pos.y - previous.y, pos.z - previous.z)).toBeLessThan(12);
    }
  });

  it('is deterministic and can begin at the current user camera', () => {
    const customStart = { x: -240, y: 190, z: 120 };
    expect(createCityTourWaypoints()).toEqual(createCityTourWaypoints());
    expect(createCityTourPath(customStart).pos(0)).toEqual(customStart);
  });

  it('derives three city-specific hero views through one rig contract', () => {
    const shanghai = createCityCameraRig(generateSandboxCity('camera-profile', 'shanghai'));
    const melbourne = createCityCameraRig(generateSandboxCity('camera-profile', 'melbourne'));
    const hongKong = createCityCameraRig(generateSandboxCity('camera-profile', 'hong-kong'));

    expect(shanghai.heroViews).toHaveLength(3);
    expect(melbourne.heroViews).toHaveLength(3);
    expect(hongKong.heroViews).toHaveLength(3);
    expect(shanghai.heroViews.map((view) => view.id)).not.toEqual(melbourne.heroViews.map((view) => view.id));
    expect(hongKong.heroViews.map((view) => view.id)).not.toEqual(shanghai.heroViews.map((view) => view.id));
    expect(shanghai.home.position.y).toBeGreaterThan(melbourne.home.position.y);
    expect(shanghai.tour.outerRadius).toBeGreaterThan(melbourne.tour.outerRadius);
    expect(hongKong.home.position.y).toBeGreaterThan(melbourne.home.position.y);
    for (const rig of [shanghai, melbourne, hongKong]) {
      const planIds = new Set(rig.heroViews.map((view) => view.id));
      expect(planIds.size).toBe(3);
      for (const view of rig.heroViews) {
        expect([...Object.values(view.position), ...Object.values(view.target)].every(Number.isFinite)).toBe(true);
        expect(view.occlusionCount).toBe(0);
      }
    }
  });

  it('keeps every finished-city hero shot clear for the visual regression seed', () => {
    for (const profile of ['shanghai', 'melbourne', 'hong-kong']) {
      const rig = createCityCameraRig(generateSandboxCity('city-corn-visual-001', profile));
      expect(rig.heroViews.map((view) => [view.id, view.occlusionCount])).toEqual(
        rig.heroViews.map((view) => [view.id, 0]),
      );
    }
  });

  it('keeps profile-scaled camera and focus splines continuous and finite', () => {
    for (const profile of ['shanghai', 'melbourne', 'hong-kong']) {
      const plan = generateSandboxCity('camera-focus', profile);
      const rig = createCityCameraRig(plan);
      const cameraPath = createCityTourPath(rig.home.position, rig);
      const focusPath = createCityTourFocusPath(rig);
      const maxStructureHeight = Math.max(
        ...plan.buildings.map((building) => building.bounds.height),
        ...plan.heroLandmarks.map((landmark) => landmark.bounds.height),
      );
      expect(cameraPath.pos(0)).toEqual(rig.home.position);
      const angles = unwrapAngles(Array.from({ length: 501 }, (_, index) => cameraPath.pos(index / 500)));
      for (let index = 0; index <= 500; index += 1) {
        const u = index / 500;
        expect([...Object.values(cameraPath.pos(u)), ...Object.values(focusPath.pos(u))].every(Number.isFinite)).toBe(true);
        expect(cameraPath.pos(u).y).toBeGreaterThan(maxStructureHeight + 10);
      }
      for (let index = 1; index < angles.length; index += 1) {
        expect(angles[index] - angles[index - 1]).toBeGreaterThanOrEqual(-0.002);
      }
    }
  });

  it('pins the second half-turn to CBD completion and preserves all three phases', () => {
    const plan = generateSandboxCity('camera-timeline', 'shanghai');
    const rig = createCityCameraRig(plan);
    const timeline = createCityTourTimeline(plan);
    const waypoints = createCityTourWaypoints(18, rig.home.position, rig);
    const radiusAt = (index) => Math.hypot(
      waypoints[index].x - rig.tour.center.x,
      waypoints[index].z - rig.tour.center.z,
    );

    expect(timeline.cbdEndDay).toBe(147);
    expect(constructionProgressToTourProgress(0, timeline)).toBe(0);
    expect(constructionProgressToTourProgress(timeline.cbdEndProgress, timeline)).toBeCloseTo(2 / 3, 8);
    expect(constructionProgressToTourProgress(1, timeline)).toBe(1);
    expect(cityTourPresentationAt(0).phase).toBe('outer');
    expect(cityTourPresentationAt(0.5).phase).toBe('cbd');
    expect(cityTourPresentationAt(0.8).phase).toBe('pullback');
    expect(cityTourPresentationAt(1).phase).toBe('complete');
    expect(radiusAt(3)).toBeCloseTo(rig.tour.outerRadius, 6);
    expect(radiusAt(6)).toBeCloseTo(rig.tour.innerRadius, 6);
    expect(radiusAt(12)).toBeCloseTo(rig.tour.innerRadius, 6);
    expect(radiusAt(18)).toBeCloseTo(rig.tour.finalRadius, 6);
  });

  it('keeps lens and roll bounded and returns to a neutral final frame', () => {
    for (let index = 0; index <= 1000; index += 1) {
      const presentation = cityTourPresentationAt(index / 1000);
      expect(presentation.fov).toBeGreaterThanOrEqual(38.2);
      expect(presentation.fov).toBeLessThanOrEqual(CITY_TOUR_BASE_FOV);
      expect(Math.abs(presentation.roll)).toBeLessThanOrEqual(CITY_TOUR_MAX_ROLL + Number.EPSILON);
    }
    expect(cityTourPresentationAt(0)).toMatchObject({ fov: CITY_TOUR_BASE_FOV, roll: -0 });
    expect(cityTourPresentationAt(1).fov).toBe(CITY_TOUR_BASE_FOV);
    expect(cityTourPresentationAt(1).roll).toBeCloseTo(0, 12);
  });
});
