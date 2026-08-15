import { describe, expect, it } from 'vitest';
import { generateSandboxCity } from '../src/city/generate.ts';
import { createCityHeroRenderPlan } from '../src/city/landmarks.ts';

describe('city concept hero landmarks', () => {
  it('reserves exactly three non-water blocks for each city concept', () => {
    for (const profile of ['shanghai', 'melbourne', 'hong-kong']) {
      const plan = generateSandboxCity('hero-reservation', profile);
      const heroBlocks = new Set(plan.heroLandmarks.map((landmark) => landmark.blockId));
      expect(plan.heroLandmarks).toHaveLength(3);
      expect(heroBlocks.size).toBe(3);
      expect(plan.buildings.some((building) => heroBlocks.has(building.blockId))).toBe(false);
      expect(plan.trees.some((tree) => heroBlocks.has(tree.blockId))).toBe(false);
      for (const landmark of plan.heroLandmarks) {
        expect(landmark.truthClass).toBe('generated-concept');
        expect(landmark.schedule.startDay).toBeGreaterThanOrEqual(0);
        expect(landmark.schedule.endDay).toBeGreaterThan(landmark.schedule.startDay);
        expect(plan.blocks.find((block) => block.id === landmark.blockId)?.zone).not.toBe('water');
      }
    }
    expect(generateSandboxCity('hero-reservation', 'sandbox').heroLandmarks).toEqual([]);
  });

  it('compiles seven recognizable forms into four shared primitive classes', () => {
    const landmarks = [
      ...generateSandboxCity('hero-forms', 'shanghai').heroLandmarks,
      ...generateSandboxCity('hero-forms', 'melbourne').heroLandmarks,
      ...generateSandboxCity('hero-forms', 'hong-kong').heroLandmarks,
    ];
    const components = createCityHeroRenderPlan(landmarks);
    const ids = components.map((entry) => entry.id);

    expect(new Set(landmarks.map((entry) => entry.form))).toEqual(new Set([
      'pearl-mast', 'stepped-crown', 'corn-cob',
      'station-hall', 'civic-shards', 'arts-spire',
      'notched-fin',
    ]));
    expect(new Set(components.map((entry) => entry.primitive))).toEqual(new Set(['box', 'cylinder', 'sphere', 'cone']));
    expect(new Set(ids).size).toBe(ids.length);
    expect(components.length).toBeLessThan(50);
    for (const component of components) {
      expect(component.revealStart).toBeGreaterThanOrEqual(0);
      expect(component.revealEnd).toBeGreaterThan(component.revealStart);
      expect(component.revealEnd).toBeLessThanOrEqual(1.02);
      expect([...Object.values(component.position), ...Object.values(component.bounds)].every(Number.isFinite)).toBe(true);
    }
  });

  it('builds the corn-cob tower as a continuous deterministic curved stack', () => {
    const city = generateSandboxCity('hero-corn-curve', 'shanghai');
    const landmark = city.heroLandmarks.find((entry) => entry.form === 'corn-cob');
    expect(landmark).toBeDefined();
    const components = createCityHeroRenderPlan([landmark]);
    const widths = components.map((entry) => entry.bounds.width);

    expect(components).toHaveLength(14);
    expect(components.every((entry) => entry.primitive === 'cylinder')).toBe(true);
    expect(Math.max(...widths)).toBeGreaterThan(widths[0] * 1.5);
    expect(Math.max(...widths)).toBeGreaterThan(widths.at(-1) * 1.5);
    for (let index = 1; index < components.length; index += 1) {
      const previousTop = components[index - 1].position.y + components[index - 1].bounds.height / 2;
      const currentBase = components[index].position.y - components[index].bounds.height / 2;
      expect(previousTop).toBeGreaterThanOrEqual(currentBase);
    }
  });

  it('is deterministic for the same profile and seed', () => {
    const first = generateSandboxCity('hero-determinism', 'shanghai');
    const second = generateSandboxCity('hero-determinism', 'shanghai');
    expect(first.heroLandmarks).toEqual(second.heroLandmarks);
    expect(createCityHeroRenderPlan(first.heroLandmarks)).toEqual(createCityHeroRenderPlan(second.heroLandmarks));
  });
});
