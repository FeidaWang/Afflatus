export type CityBudgetClass = 'desktop' | 'mobile';

export interface CityRenderTelemetry {
  drawCalls: number;
  triangles: number;
  p95Ms: number;
}

export interface CityRenderBudget extends CityRenderTelemetry {
  targetFps: number;
}

/** P0 sandbox ceilings. P1 must re-measure before adding facade detail. */
export const CITY_SANDBOX_RENDER_BUDGET: Readonly<Record<CityBudgetClass, Readonly<CityRenderBudget>>> = Object.freeze({
  desktop: Object.freeze({ drawCalls: 40, triangles: 100_000, p95Ms: 18, targetFps: 60 }),
  mobile: Object.freeze({ drawCalls: 36, triangles: 80_000, p95Ms: 34, targetFps: 30 }),
});

export function cityBudgetClassForDevice(
  viewportWidth: number,
  coarsePointer = false,
): CityBudgetClass {
  return coarsePointer || (Number.isFinite(viewportWidth) && viewportWidth < 768)
    ? 'mobile'
    : 'desktop';
}

export interface CityBudgetEvaluation {
  withinBudget: boolean;
  violations: Array<keyof CityRenderTelemetry>;
  limits: Readonly<CityRenderBudget>;
}

export function evaluateCityRenderBudget(
  telemetry: CityRenderTelemetry,
  budgetClass: CityBudgetClass,
): CityBudgetEvaluation {
  const limits = CITY_SANDBOX_RENDER_BUDGET[budgetClass];
  const violations: Array<keyof CityRenderTelemetry> = [];
  if (!Number.isFinite(telemetry.drawCalls) || telemetry.drawCalls > limits.drawCalls) violations.push('drawCalls');
  if (!Number.isFinite(telemetry.triangles) || telemetry.triangles > limits.triangles) violations.push('triangles');
  if (!Number.isFinite(telemetry.p95Ms) || telemetry.p95Ms > limits.p95Ms) violations.push('p95Ms');
  return Object.freeze({ withinBudget: violations.length === 0, violations, limits });
}
