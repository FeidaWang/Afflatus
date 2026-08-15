import { describe, expect, it } from 'vitest';
import {
  CITY_MAX_ACTIVE_CRANES,
  cityCraneStateAt,
  createCityCranePlans,
  createCityCraneRenderPlan,
} from '../src/city/cranes.ts';
import { generateSandboxCity } from '../src/city/generate.ts';

describe('city construction cranes', () => {
  it('creates deterministic landmark and large-building crane candidates', () => {
    const sandbox = generateSandboxCity('crane-plan', 'sandbox');
    const shanghai = generateSandboxCity('crane-plan', 'shanghai');
    const first = createCityCranePlans(shanghai);

    expect(createCityCranePlans(sandbox).length).toBeGreaterThan(1);
    expect(first.length).toBeGreaterThan(4);
    expect(first).toEqual(createCityCranePlans(shanghai));
    expect(new Set(first.map((crane) => crane.ownerId)).size).toBe(first.length);
    expect(first.filter((crane) => crane.priority === 'flagship')).toHaveLength(1);
    expect(first.filter((crane) => crane.priority === 'hero')).toHaveLength(3);
    expect(first.some((crane) => crane.priority === 'large-building')).toBe(true);
    const owners = new Map(
      [...shanghai.buildings, ...shanghai.heroLandmarks].map((owner) => [owner.id, owner]),
    );
    for (const crane of first) {
      const owner = owners.get(crane.ownerId);
      const clearance = Math.hypot(
        crane.position.x - owner.position.x,
        crane.position.z - owner.position.z,
      );
      expect(clearance).toBeGreaterThanOrEqual(Math.max(owner.bounds.width, owner.bounds.depth) / 2 + 5 - 1e-8);
    }
  });

  it('lowers after completion and remains reversible at every boundary', () => {
    const crane = createCityCranePlans(generateSandboxCity('crane-state', 'shanghai'))[0];
    const before = cityCraneStateAt(crane, crane.schedule.startDay - 0.01);
    const active = cityCraneStateAt(crane, crane.schedule.startDay);
    const complete = cityCraneStateAt(crane, crane.schedule.endDay);
    const retreatDay = crane.schedule.endDay + crane.retreatDays / 2;
    const retreat = cityCraneStateAt(crane, retreatDay);
    const gone = cityCraneStateAt(crane, crane.schedule.endDay + crane.retreatDays);

    expect(before.visible).toBe(false);
    expect(active).toMatchObject({ visible: true, retreatProgress: 0, baseY: -0 });
    expect(complete).toMatchObject({ visible: true, retreatProgress: 0, baseY: -0 });
    expect(retreat.visible).toBe(true);
    expect(retreat.retreatProgress).toBeCloseTo(0.5, 8);
    expect(retreat.baseY).toBeLessThan(0);
    expect(gone.visible).toBe(false);
    expect(cityCraneStateAt(crane, retreatDay)).toEqual(retreat);
    expect(cityCraneStateAt(crane, crane.schedule.startDay)).toEqual(active);
  });

  it('compiles detail into shared batch data and reduces it by LOD', () => {
    const cranes = createCityCranePlans(generateSandboxCity('crane-render', 'melbourne'));
    const activeDay = Math.max(...cranes.map((crane) => crane.schedule.startDay)) + 2;
    const high = createCityCraneRenderPlan(cranes, activeDay, 'high');
    const medium = createCityCraneRenderPlan(cranes, activeDay, 'medium');
    const silhouette = createCityCraneRenderPlan(cranes, activeDay, 'silhouette');

    expect(high.activeCraneIds.length).toBeGreaterThan(0);
    expect(high.activeCraneIds.length).toBeLessThanOrEqual(CITY_MAX_ACTIVE_CRANES);
    expect(high.boxes.length).toBeGreaterThan(medium.boxes.length);
    expect(medium.boxes.length).toBeGreaterThan(silhouette.boxes.length);
    expect(high.lines.length).toBeGreaterThan(0);
    expect(silhouette.lines).toHaveLength(0);
    expect(createCityCraneRenderPlan(cranes, 210, 'high').activeCraneIds).toHaveLength(0);
    for (const part of [...high.boxes, ...high.lines]) {
      expect(JSON.stringify(part)).not.toContain('null');
    }
  });

  it('never exceeds the active-crane budget on any construction day', () => {
    for (const profile of ['sandbox', 'shanghai', 'melbourne', 'hong-kong']) {
      const cranes = createCityCranePlans(generateSandboxCity('crane-budget', profile));
      for (let day = 0; day <= 210; day += 1) {
        const renderPlan = createCityCraneRenderPlan(cranes, day, 'silhouette');
        const scheduled = cranes.filter((crane) => cityCraneStateAt(crane, day).visible);
        expect(renderPlan.activeCraneIds.length).toBeLessThanOrEqual(CITY_MAX_ACTIVE_CRANES);
        expect(renderPlan.activeCraneIds).toHaveLength(scheduled.length);
      }
    }
  });

  it('keeps key-day render plans stable and lowers every flagship component', () => {
    for (const profile of ['shanghai', 'melbourne', 'hong-kong']) {
      const cranes = createCityCranePlans(generateSandboxCity('crane-key-days', profile));
      const keyDays = [0, 70, 147, 210];
      const firstPass = keyDays.map((day) => createCityCraneRenderPlan(cranes, day, 'high'));
      const repeated = keyDays.map((day) => createCityCraneRenderPlan(cranes, day, 'high'));
      expect(repeated).toEqual(firstPass);
      expect(firstPass.at(-1).activeCraneIds).toHaveLength(0);

      const flagship = cranes.find((crane) => crane.priority === 'flagship');
      const completed = createCityCraneRenderPlan(cranes, flagship.schedule.endDay, 'high');
      const retreatDay = flagship.schedule.endDay + flagship.retreatDays / 2;
      const lowered = createCityCraneRenderPlan(cranes, retreatDay, 'high');
      const completedY = completed.boxes
        .filter((part) => part.craneId === flagship.id)
        .map((part) => part.position.y);
      const loweredY = lowered.boxes
        .filter((part) => part.craneId === flagship.id)
        .map((part) => part.position.y);

      expect(loweredY).toHaveLength(completedY.length);
      expect(Math.max(...loweredY)).toBeLessThan(Math.max(...completedY));
      expect(createCityCraneRenderPlan(cranes, retreatDay, 'high')).toEqual(lowered);
    }
  });
});
