import type { CityPlan } from './model';
import { cityMetricSnapshotAt, clampCityDay } from './schedule';

export const CITY_METRIC_CHART_SAMPLES = 9;

export interface CityMetricChartSnapshot {
  day: number;
  truthClass: 'simulated-state-derived';
  completion: number;
  residents: readonly number[];
  jobs: number;
  energy: readonly number[];
  traffic: number;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

/**
 * A chart-only projection of the causal metric model. No random drift is
 * introduced: historical columns and line points are snapshots of the same
 * reversible construction schedule that powers the visible values.
 */
export function createCityMetricChartSnapshot(
  plan: CityPlan,
  rawDay: number,
): Readonly<CityMetricChartSnapshot> {
  const day = clampCityDay(rawDay, plan.profile.totalDays);
  const plannedResidents = plan.buildings.reduce(
    (sum, building) => sum + building.capacity.residents,
    0,
  );
  const plannedJobs = plan.buildings.reduce(
    (sum, building) => sum + building.capacity.jobs,
    0,
  );
  const history = Array.from({ length: CITY_METRIC_CHART_SAMPLES }, (_, index) => (
    cityMetricSnapshotAt(
      plan,
      day * index / Math.max(1, CITY_METRIC_CHART_SAMPLES - 1),
    )
  ));
  const current = history[history.length - 1];

  return Object.freeze({
    day: Math.round(day),
    truthClass: 'simulated-state-derived',
    completion: clamp01(current.metrics.completion),
    residents: Object.freeze(history.map((snapshot) => clamp01(
      plannedResidents > 0 ? snapshot.metrics.residents / plannedResidents : 0,
    ))),
    jobs: clamp01(plannedJobs > 0 ? current.metrics.jobs / plannedJobs : 0),
    energy: Object.freeze(history.map((snapshot) => clamp01(snapshot.metrics.energy / 100))),
    traffic: clamp01(current.metrics.traffic / 100),
  });
}

const round = (value: number): number => Math.round(value * 100) / 100;

/** Converts normalized history values to a stable SVG polyline. */
export function cityMetricPolylinePoints(
  values: readonly number[],
  width = 100,
  height = 32,
  padding = 2,
): string {
  if (!values.length) return '';
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const safePadding = Math.min(
    Math.max(0, padding),
    Math.max(0, Math.min(safeWidth, safeHeight) / 2 - 0.01),
  );
  const usableWidth = Math.max(0, safeWidth - safePadding * 2);
  const usableHeight = Math.max(0, safeHeight - safePadding * 2);
  return values.map((value, index) => {
    const progress = values.length === 1 ? 0.5 : index / (values.length - 1);
    const x = safePadding + usableWidth * progress;
    const y = safeHeight - safePadding - usableHeight * clamp01(value);
    return `${round(x)},${round(y)}`;
  }).join(' ');
}
