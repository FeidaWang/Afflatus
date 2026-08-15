import {
  CITY_TOTAL_DAYS,
  type CityBuilding,
  type CityMetricEvidence,
  type CityMetricKey,
  type CityMetricReading,
  type CityMetrics,
  type CityMetricSnapshot,
  type CityPlan,
  type CityRoad,
  type CitySchedule,
  type CityVehicle,
  type ConstructionPhase,
  type ConstructionState,
} from './model';

const PHASES: ReadonlyArray<{
  phase: Exclude<ConstructionPhase, 'hidden' | 'complete'>;
  start: number;
  end: number;
}> = Object.freeze([
  { phase: 'skeleton', start: 0, end: 0.24 },
  { phase: 'slabs', start: 0.24, end: 0.48 },
  { phase: 'shell', start: 0.48, end: 0.9 },
  { phase: 'roof', start: 0.9, end: 1 },
]);

export const clampCityDay = (day: number, totalDays = CITY_TOTAL_DAYS): number =>
  Math.min(totalDays, Math.max(0, Number.isFinite(day) ? day : 0));

export function constructionStateAt(
  schedule: CitySchedule,
  day: number,
): ConstructionState {
  const duration = Math.max(0.0001, schedule.endDay - schedule.startDay);
  const progress = (day - schedule.startDay) / duration;
  if (progress < 0) {
    return { phase: 'hidden', phaseProgress: 0, totalProgress: 0, visible: false, complete: false };
  }
  if (progress >= 1) {
    return { phase: 'complete', phaseProgress: 1, totalProgress: 1, visible: true, complete: true };
  }
  const clamped = Math.max(0, progress);
  const match = PHASES.find((entry) => clamped < entry.end) ?? PHASES[PHASES.length - 1];
  const phaseProgress = (clamped - match.start) / Math.max(0.0001, match.end - match.start);
  return {
    phase: match.phase,
    phaseProgress: Math.min(1, Math.max(0, phaseProgress)),
    totalProgress: clamped,
    visible: true,
    complete: false,
  };
}

export function roadProgressAt(road: CityRoad, day: number): number {
  const duration = Math.max(0.0001, road.schedule.endDay - road.schedule.startDay);
  return Math.min(1, Math.max(0, (day - road.schedule.startDay) / duration));
}

export function cityVehicleReadyAt(
  plan: Pick<CityPlan, 'roads'>,
  vehicle: CityVehicle,
  day: number,
): boolean {
  if (day < vehicle.availableDay) return false;
  const road = plan.roads.find((candidate) => candidate.id === vehicle.roadId);
  return Boolean(road && roadProgressAt(road, day) >= 1);
}

const commissionedFraction = (building: CityBuilding, day: number): number => {
  const state = constructionStateAt(building.schedule, day);
  if (state.phase === 'complete') return 1;
  if (state.phase !== 'roof') return 0;
  return state.phaseProgress * 0.35;
};

interface CityMetricDerivation {
  metrics: CityMetrics;
  evidence: CityMetricEvidence;
}

function deriveCityMetrics(plan: CityPlan, rawDay: number): CityMetricDerivation {
  const day = clampCityDay(rawDay, plan.profile.totalDays);
  let completedCapacity = 0;
  let totalCapacity = 0;
  let residents = 0;
  let jobs = 0;
  let activeConstruction = 0;
  let completedStructures = 0;
  let activeSites = 0;
  let residentialCompleteSites = 0;
  let residentialRoofSites = 0;
  let jobCompleteSites = 0;
  let jobRoofSites = 0;

  for (const building of plan.buildings) {
    const capacityWeight = building.bounds.width * building.bounds.depth * building.bounds.height;
    totalCapacity += capacityWeight;
    const state = constructionStateAt(building.schedule, day);
    completedCapacity += capacityWeight * state.totalProgress;
    if (state.complete) completedStructures += 1;
    if (state.visible && !state.complete && state.totalProgress > 0) {
      activeSites += 1;
      activeConstruction += state.totalProgress;
    }
    if (building.capacity.residents > 0) {
      if (state.complete) residentialCompleteSites += 1;
      else if (state.phase === 'roof') residentialRoofSites += 1;
    }
    if (building.capacity.jobs > 0) {
      if (state.complete) jobCompleteSites += 1;
      else if (state.phase === 'roof') jobRoofSites += 1;
    }
    const commissioned = commissionedFraction(building, day);
    residents += building.capacity.residents * commissioned;
    jobs += building.capacity.jobs * commissioned;
  }

  for (const landmark of plan.heroLandmarks) {
    const capacityWeight = landmark.bounds.width * landmark.bounds.depth * landmark.bounds.height;
    totalCapacity += capacityWeight;
    const state = constructionStateAt(landmark.schedule, day);
    completedCapacity += capacityWeight * state.totalProgress;
    if (state.complete) completedStructures += 1;
    if (state.visible && !state.complete && state.totalProgress > 0) {
      activeSites += 1;
      activeConstruction += state.totalProgress;
    }
  }

  const completion = totalCapacity > 0 ? completedCapacity / totalCapacity : 0;
  const roadProgressEquivalent = plan.roads.reduce((sum, road) => sum + roadProgressAt(road, day), 0);
  const roadsOpen = plan.roads.length
    ? roadProgressEquivalent / plan.roads.length
    : 0;
  const energy = Math.round(Math.min(100, completion * 72 + activeConstruction * 0.7));
  const traffic = Math.round(Math.min(100, roadsOpen * 38 + completion * 52));

  const metrics = Object.freeze({
    day: Math.round(day),
    completion,
    residents: Math.round(residents),
    jobs: Math.round(jobs),
    energy,
    traffic,
  });

  return Object.freeze({
    metrics,
    evidence: Object.freeze({
      plannedStructures: plan.buildings.length + plan.heroLandmarks.length,
      completedStructures,
      activeSites,
      activeConstructionLoad: activeConstruction,
      plannedVolume: totalCapacity,
      progressedVolume: completedCapacity,
      residentialCompleteSites,
      residentialRoofSites,
      jobCompleteSites,
      jobRoofSites,
      roadProgressEquivalent,
      plannedRoads: plan.roads.length,
    }),
  });
}

export function cityMetricsAt(plan: CityPlan, rawDay: number): CityMetrics {
  return deriveCityMetrics(plan, rawDay).metrics;
}

const reading = (
  key: CityMetricKey,
  value: number,
  unit: CityMetricReading['unit'],
  en: string,
  zh: string,
): CityMetricReading => Object.freeze({ key, value, unit, cause: Object.freeze({ en, zh }) });

export function cityMetricSnapshotAt(plan: CityPlan, rawDay: number): CityMetricSnapshot {
  const { metrics, evidence } = deriveCityMetrics(plan, rawDay);
  const activeLoad = evidence.activeConstructionLoad.toFixed(1);
  const roadEquivalent = evidence.roadProgressEquivalent.toFixed(1);
  const completionPercent = Math.round(metrics.completion * 100);

  return Object.freeze({
    day: metrics.day,
    truthClass: 'simulated-state-derived',
    metrics,
    evidence,
    readings: Object.freeze({
      completion: reading(
        'completion',
        metrics.completion,
        'ratio',
        `${completionPercent}% weighted phase progress across ${evidence.plannedStructures} planned structures; ${evidence.activeSites} sites active.`,
        `${evidence.plannedStructures} 个计划结构的加权阶段进度为 ${completionPercent}%；${evidence.activeSites} 个工地在建。`,
      ),
      residents: reading(
        'residents',
        metrics.residents,
        'people',
        `Commissioned capacity from ${evidence.residentialCompleteSites} complete and ${evidence.residentialRoofSites} roof-stage residential sites.`,
        `投产容量来自 ${evidence.residentialCompleteSites} 个完工住宅工地和 ${evidence.residentialRoofSites} 个屋顶阶段住宅工地。`,
      ),
      jobs: reading(
        'jobs',
        metrics.jobs,
        'jobs',
        `Commissioned capacity from ${evidence.jobCompleteSites} complete and ${evidence.jobRoofSites} roof-stage employment sites.`,
        `投产容量来自 ${evidence.jobCompleteSites} 个完工就业工地和 ${evidence.jobRoofSites} 个屋顶阶段就业工地。`,
      ),
      energy: reading(
        'energy',
        metrics.energy,
        'index',
        `Scenario load = 72 × built share + 0.7 × active-site progress (${activeLoad}); capped at 100.`,
        `情景负荷 = 72 × 建造占比 + 0.7 × 在建进度（${activeLoad}），上限 100。`,
      ),
      traffic: reading(
        'traffic',
        metrics.traffic,
        'index',
        `Scenario demand = 38 × road completion (${roadEquivalent}/${evidence.plannedRoads}) + 52 × built share.`,
        `情景需求 = 38 × 道路完成量（${roadEquivalent}/${evidence.plannedRoads}）+ 52 × 建造占比。`,
      ),
    }),
  });
}
