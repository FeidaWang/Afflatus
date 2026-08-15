import { describe, expect, it } from 'vitest';
import { generateSandboxCity } from '../src/city/generate.ts';
import {
  cityMetricSnapshotAt,
  cityMetricsAt,
  cityVehicleReadyAt,
  constructionStateAt,
  roadProgressAt,
} from '../src/city/schedule.ts';

describe('city sandbox model', () => {
  it('generates the same city from the same seed', () => {
    const first = generateSandboxCity('repeatable-city');
    const second = generateSandboxCity('repeatable-city');
    const alternate = generateSandboxCity('another-city');

    expect(first).toEqual(second);
    expect(first.seedHash).not.toBe(alternate.seedHash);
    expect(first.buildings).not.toEqual(alternate.buildings);
  });

  it('keeps the 8 x 8 plan, roads and buildings inside their lots', () => {
    const plan = generateSandboxCity('lot-contract');
    const blocks = new Map(plan.blocks.map((block) => [block.id, block]));

    expect(plan.blocks).toHaveLength(64);
    expect(plan.roads).toHaveLength(18);
    expect(new Set(plan.buildings.map((building) => building.id)).size).toBe(plan.buildings.length);
    expect(plan.buildings.filter((building) => building.kind === 'landmark')).toHaveLength(1);

    for (const building of plan.buildings) {
      const block = blocks.get(building.blockId);
      expect(block).toBeTruthy();
      const half = plan.profile.blockSize / 2;
      expect(Math.abs(building.position.x - block.center.x) + building.bounds.width / 2).toBeLessThanOrEqual(half);
      expect(Math.abs(building.position.z - block.center.z) + building.bounds.depth / 2).toBeLessThanOrEqual(half);
      expect(building.schedule.startDay).toBeGreaterThanOrEqual(0);
      expect(building.schedule.endDay).toBeGreaterThan(building.schedule.startDay);
      expect(building.schedule.endDay).toBeLessThanOrEqual(plan.profile.totalDays);
    }
  });

  it('maps schedule boundaries to stable reversible phases', () => {
    const schedule = { startDay: 10, endDay: 110 };

    expect(constructionStateAt(schedule, 9).phase).toBe('hidden');
    expect(constructionStateAt(schedule, 10)).toMatchObject({ phase: 'skeleton', phaseProgress: 0 });
    expect(constructionStateAt(schedule, 34)).toMatchObject({ phase: 'slabs', phaseProgress: 0 });
    expect(constructionStateAt(schedule, 58)).toMatchObject({ phase: 'shell', phaseProgress: 0 });
    expect(constructionStateAt(schedule, 100)).toMatchObject({ phase: 'roof', phaseProgress: 0 });
    expect(constructionStateAt(schedule, 110)).toMatchObject({ phase: 'complete', complete: true });

    const target = constructionStateAt(schedule, 72.5);
    constructionStateAt(schedule, 105);
    constructionStateAt(schedule, 12);
    expect(constructionStateAt(schedule, 72.5)).toEqual(target);
  });

  it('binds every vehicle to a completed road before it can render', () => {
    const plan = generateSandboxCity('vehicle-road-contract');
    const roadIds = new Set(plan.roads.map((road) => road.id));
    expect(plan.vehicles.every((vehicle) => roadIds.has(vehicle.roadId))).toBe(true);

    const vehicle = { ...plan.vehicles[0], availableDay: 0 };
    const road = plan.roads.find((candidate) => candidate.id === vehicle.roadId);
    expect(cityVehicleReadyAt(plan, vehicle, road.schedule.endDay - 0.01)).toBe(false);
    expect(cityVehicleReadyAt(plan, vehicle, road.schedule.endDay)).toBe(true);
  });

  it('derives display metrics from construction state instead of random drift', () => {
    const plan = generateSandboxCity('metrics-contract');
    const start = cityMetricsAt(plan, 0);
    const middle = cityMetricsAt(plan, 105);
    const finish = cityMetricsAt(plan, 210);

    expect(start).toMatchObject({ day: 0, completion: 0, residents: 0, jobs: 0, energy: 0, traffic: 0 });
    expect(middle.completion).toBeGreaterThan(0);
    expect(finish.completion).toBe(1);
    expect(finish.residents).toBeGreaterThan(0);
    expect(finish.jobs).toBeGreaterThan(0);
    expect(roadProgressAt(plan.roads[0], -1)).toBe(0);
    expect(roadProgressAt(plan.roads[0], 210)).toBe(1);
  });

  it('explains every simulated metric with deterministic causal evidence', () => {
    const plan = generateSandboxCity('causal-metrics-contract');
    const start = cityMetricSnapshotAt(plan, 0);
    const middle = cityMetricSnapshotAt(plan, 105);
    const finish = cityMetricSnapshotAt(plan, 210);

    expect(start).toMatchObject({
      day: 0,
      truthClass: 'simulated-state-derived',
      evidence: {
        completedStructures: 0,
        activeSites: 0,
        roadProgressEquivalent: 0,
      },
    });
    expect(start.evidence.plannedStructures).toBe(plan.buildings.length + plan.heroLandmarks.length);
    expect(middle.evidence.activeSites).toBeGreaterThan(0);
    expect(middle.metrics.energy).toBe(Math.round(Math.min(
      100,
      middle.metrics.completion * 72 + middle.evidence.activeConstructionLoad * 0.7,
    )));
    expect(middle.metrics.traffic).toBe(Math.round(Math.min(
      100,
      (middle.evidence.roadProgressEquivalent / middle.evidence.plannedRoads) * 38
        + middle.metrics.completion * 52,
    )));
    expect(Object.keys(middle.readings)).toEqual([
      'completion',
      'residents',
      'jobs',
      'energy',
      'traffic',
    ]);
    for (const reading of Object.values(middle.readings)) {
      expect(reading.cause.en.length).toBeGreaterThan(30);
      expect(reading.cause.zh.length).toBeGreaterThan(15);
    }

    expect(finish.evidence).toMatchObject({
      plannedStructures: finish.evidence.completedStructures,
      activeSites: 0,
      roadProgressEquivalent: plan.roads.length,
      plannedRoads: plan.roads.length,
    });
    cityMetricSnapshotAt(plan, 18);
    cityMetricSnapshotAt(plan, 196);
    expect(cityMetricSnapshotAt(plan, 105)).toEqual(middle);
  });

  it('generates distinct Shanghai, Melbourne and Hong Kong concepts through one plan contract', () => {
    const shanghai = generateSandboxCity('dual-city-contract', 'shanghai');
    const melbourne = generateSandboxCity('dual-city-contract', 'melbourne');
    const hongKong = generateSandboxCity('dual-city-contract', 'hong-kong');

    expect(shanghai.profile).toMatchObject({
      key: 'shanghai',
      truthClass: 'generated-concept',
      landmarkForm: 'twist',
    });
    expect(melbourne.profile).toMatchObject({
      key: 'melbourne',
      truthClass: 'generated-concept',
      landmarkForm: 'tapered-spire',
    });
    expect(hongKong.profile).toMatchObject({
      key: 'hong-kong',
      truthClass: 'generated-concept',
      trafficSide: 'left',
      coreBuildingCount: 3,
      mixedBuildingCount: 3,
      ridgeBackdrop: { peakCount: 9 },
    });
    expect(shanghai.water).toHaveLength(1);
    expect(melbourne.water).toHaveLength(1);
    expect(hongKong.water).toHaveLength(1);
    expect(shanghai.heroLandmarks).toHaveLength(3);
    expect(melbourne.heroLandmarks).toHaveLength(3);
    expect(hongKong.heroLandmarks).toHaveLength(3);
    expect(shanghai.water[0].axis).not.toBe(melbourne.water[0].axis);
    expect(shanghai.water[0].axis).not.toBe(hongKong.water[0].axis);
    expect(shanghai.blocks.filter((block) => block.zone === 'water')).toHaveLength(8);
    expect(melbourne.blocks.filter((block) => block.zone === 'water')).toHaveLength(8);
    expect(hongKong.blocks.filter((block) => block.zone === 'water')).toHaveLength(8);
    expect(hongKong.vehicles).toHaveLength(26);
    expect(hongKong.buildings.length).toBeGreaterThan(shanghai.buildings.length);
    for (const plan of [shanghai, melbourne, hongKong]) {
      const waterBlocks = new Set(plan.blocks.filter((block) => block.zone === 'water').map((block) => block.id));
      expect(plan.buildings.some((building) => waterBlocks.has(building.blockId))).toBe(false);
      expect(plan.trees.some((tree) => waterBlocks.has(tree.blockId))).toBe(false);
    }
    expect(shanghai.buildings.find((building) => building.id === shanghai.landmarkId)?.bounds.height)
      .toBeGreaterThan(melbourne.buildings.find((building) => building.id === melbourne.landmarkId)?.bounds.height);
    expect(hongKong.buildings.find((building) => building.id === hongKong.landmarkId)?.bounds.height)
      .toBeGreaterThan(melbourne.buildings.find((building) => building.id === melbourne.landmarkId)?.bounds.height);
  });
});
