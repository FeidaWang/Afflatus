import { describe, expect, it } from 'vitest';
import { generateSandboxCity } from '../src/city/generate.ts';
import {
  CITY_METRIC_CHART_SAMPLES,
  cityMetricPolylinePoints,
  createCityMetricChartSnapshot,
} from '../src/city/metricCharts.ts';

describe('city causal metric chart projection', () => {
  it.each(['sandbox', 'shanghai', 'melbourne', 'hong-kong'])('is deterministic and bounded for %s', (profile) => {
    const plan = generateSandboxCity('metric-chart-contract', profile);
    const first = createCityMetricChartSnapshot(plan, 105);
    const second = createCityMetricChartSnapshot(plan, 105);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      day: 105,
      truthClass: 'simulated-state-derived',
    });
    expect(first.residents).toHaveLength(CITY_METRIC_CHART_SAMPLES);
    expect(first.energy).toHaveLength(CITY_METRIC_CHART_SAMPLES);
    for (const value of [
      first.completion,
      first.jobs,
      first.traffic,
      ...first.residents,
      ...first.energy,
    ]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    expect(cityMetricPolylinePoints(first.energy)).not.toMatch(/NaN|Infinity/);
    expect(cityMetricPolylinePoints(first.energy).split(' ')).toHaveLength(CITY_METRIC_CHART_SAMPLES);
  });

  it('shows zero state at day 0 and commissioned capacity at day 210', () => {
    const plan = generateSandboxCity('metric-chart-boundaries', 'shanghai');
    const start = createCityMetricChartSnapshot(plan, 0);
    const finish = createCityMetricChartSnapshot(plan, 210);

    expect(start).toMatchObject({ completion: 0, jobs: 0, traffic: 0 });
    expect([...start.residents, ...start.energy].every((value) => value === 0)).toBe(true);
    expect(finish.completion).toBe(1);
    expect(finish.jobs).toBe(1);
    expect(finish.residents.at(-1)).toBe(1);
    expect(finish.energy.at(-1)).toBeCloseTo(0.72, 2);
    expect(finish.traffic).toBeCloseTo(0.9, 2);
  });

  it('clamps invalid input and emits stable single-point SVG geometry', () => {
    const plan = generateSandboxCity('metric-chart-clamp');
    expect(createCityMetricChartSnapshot(plan, Number.NaN).day).toBe(0);
    expect(createCityMetricChartSnapshot(plan, 999).day).toBe(210);
    expect(cityMetricPolylinePoints([])).toBe('');
    expect(cityMetricPolylinePoints([0.5])).toBe('50,16');
  });
});
