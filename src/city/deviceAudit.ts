export const CITY_DEVICE_AUDIT_SCHEMA_VERSION = 'city-device-audit-v1';
export const CITY_DEVICE_AUDIT_TARGET_MS = 10 * 60 * 1000;

export type CityDeviceOrientation = 'portrait' | 'landscape' | 'square';
export type CityDeviceVisibility = 'visible' | 'hidden';

export interface CityDeviceAuditTelemetry {
  active: boolean;
  budgetClass: string | null;
  budgetWithinLimits: boolean;
  day: number | null;
  drawCalls: number | null;
  evaluatedWindows: number;
  fallback: boolean;
  lod: string | null;
  p95Ms: number | null;
  profile: string | null;
  qualityTier: string | null;
  thermalState: string | null;
  triangles: number | null;
}

export interface CityDeviceAuditSample {
  elapsedMs: number;
  heapBytes: number | null;
  horizontalOverflowPx: number;
  language: 'en' | 'zh';
  orientation: CityDeviceOrientation;
  reducedMotion: boolean;
  telemetry: CityDeviceAuditTelemetry | null;
  viewport: Readonly<{ width: number; height: number; dpr: number }>;
  visibility: CityDeviceVisibility;
}

export interface CityDeviceAuditInteractions {
  backgroundTransitions: number;
  buildActions: number;
  canvasTouchStarts: number;
  languages: ReadonlyArray<'en' | 'zh'>;
  maxConcurrentTouchPointers: number;
  maxScrollY: number;
  orientations: ReadonlyArray<CityDeviceOrientation>;
  reducedMotionModes: ReadonlyArray<'no-preference' | 'reduce'>;
  timelineScrubs: number;
  tourActions: number;
  visibilityStates: ReadonlyArray<CityDeviceVisibility>;
}

export interface CityDeviceAuditInput {
  deviceLabel: string;
  endedAt: string;
  environment: Readonly<Record<string, unknown>>;
  events: ReadonlyArray<Readonly<Record<string, unknown>>>;
  interactions: CityDeviceAuditInteractions;
  measuredDurationMs: number;
  profile: string;
  samples: ReadonlyArray<CityDeviceAuditSample>;
  seed: string;
  startedAt: string;
  targetDurationMs?: number;
}

export interface CityDeviceAuditCheck {
  actual: string | number | boolean;
  passed: boolean;
  requirement: string;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function finiteNonNegative(value: unknown): number {
  const number = finiteOrNull(value);
  return number === null ? 0 : Math.max(0, number);
}

function orderedUnique<T extends string>(values: ReadonlyArray<T>): T[] {
  return [...new Set(values)];
}

export function cityDeviceOrientation(width: number, height: number): CityDeviceOrientation {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width === height) return 'square';
  return width > height ? 'landscape' : 'portrait';
}

/** Keep physical-device evidence compact and free of mutable scene objects. */
export function pickCityDeviceAuditTelemetry(value: unknown): CityDeviceAuditTelemetry | null {
  if (!value || typeof value !== 'object') return null;
  const telemetry = value as Record<string, unknown>;
  const lifecycle = telemetry.lifecycle && typeof telemetry.lifecycle === 'object'
    ? telemetry.lifecycle as Record<string, unknown>
    : null;
  const budgetEvaluation = telemetry.budgetEvaluation && typeof telemetry.budgetEvaluation === 'object'
    ? telemetry.budgetEvaluation as Record<string, unknown>
    : null;

  return Object.freeze({
    active: telemetry.active === true,
    budgetClass: typeof telemetry.budgetClass === 'string' ? telemetry.budgetClass : null,
    budgetWithinLimits: budgetEvaluation?.withinBudget === true,
    day: finiteOrNull(telemetry.day),
    drawCalls: finiteOrNull(telemetry.drawCalls),
    evaluatedWindows: finiteNonNegative(telemetry.evaluatedWindows),
    fallback: lifecycle?.fallback === true,
    lod: typeof telemetry.lod === 'string' ? telemetry.lod : null,
    p95Ms: finiteOrNull(telemetry.p95Ms),
    profile: typeof telemetry.profile === 'string' ? telemetry.profile : null,
    qualityTier: typeof telemetry.qualityTier === 'string' ? telemetry.qualityTier : null,
    thermalState: typeof telemetry.thermalState === 'string' ? telemetry.thermalState : null,
    triangles: finiteOrNull(telemetry.triangles),
  });
}

function maxFinite(values: ReadonlyArray<number | null>): number | null {
  const finite = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return finite.length ? Math.max(...finite) : null;
}

function summarizeHeap(samples: ReadonlyArray<CityDeviceAuditSample>) {
  const heapValues = samples
    .map(({ heapBytes }) => heapBytes)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  if (!heapValues.length) {
    return Object.freeze({ supported: false, samples: 0, firstBytes: null, lastBytes: null, growthBytes: null });
  }
  return Object.freeze({
    supported: true,
    samples: heapValues.length,
    firstBytes: heapValues[0],
    lastBytes: heapValues[heapValues.length - 1] ?? null,
    growthBytes: (heapValues[heapValues.length - 1] ?? heapValues[0]) - heapValues[0],
  });
}

function check(passed: boolean, requirement: string, actual: string | number | boolean): CityDeviceAuditCheck {
  return Object.freeze({ passed, requirement, actual });
}

export function summarizeCityDeviceAudit(input: CityDeviceAuditInput) {
  const targetDurationMs = Math.max(1, finiteNonNegative(input.targetDurationMs ?? CITY_DEVICE_AUDIT_TARGET_MS));
  const measuredDurationMs = finiteNonNegative(input.measuredDurationMs);
  const samples = input.samples.map((sample) => Object.freeze({
    ...sample,
    telemetry: sample.telemetry ? Object.freeze({ ...sample.telemetry }) : null,
    viewport: Object.freeze({ ...sample.viewport }),
  }));
  const events = input.events.map((event) => Object.freeze({ ...event }));
  const renderSamples = samples.filter(({ telemetry }) => telemetry !== null);
  const interactions = Object.freeze({
    ...input.interactions,
    languages: Object.freeze(orderedUnique(input.interactions.languages)),
    orientations: Object.freeze(orderedUnique(input.interactions.orientations)),
    reducedMotionModes: Object.freeze(orderedUnique(input.interactions.reducedMotionModes)),
    visibilityStates: Object.freeze(orderedUnique(input.interactions.visibilityStates)),
  });
  const budgetViolations = renderSamples.filter(({ telemetry }) => !telemetry?.budgetWithinLimits).length;
  const fallbackSamples = renderSamples.filter(({ telemetry }) => telemetry?.fallback).length;
  const hotSamples = renderSamples.filter(({ telemetry }) => telemetry?.thermalState === 'hot').length;
  const evaluatedWindows = Math.max(0, ...renderSamples.map(({ telemetry }) => telemetry?.evaluatedWindows ?? 0));
  const maximumOverflowPx = Math.max(0, ...samples.map(({ horizontalOverflowPx }) => horizontalOverflowPx));
  const minimumSamples = Math.max(30, Math.floor(targetDurationMs / 2_000));
  const orientations = new Set(interactions.orientations);
  const languages = new Set(interactions.languages);
  const reducedMotionModes = new Set(interactions.reducedMotionModes);
  const visibilityStates = new Set(interactions.visibilityStates);
  const label = input.deviceLabel.trim().replace(/\s+/g, ' ').slice(0, 120);

  const checks = Object.freeze({
    identifiedDevice: check(label.length >= 3, 'Device / OS / browser label is present', label || 'missing'),
    duration: check(measuredDurationMs >= targetDurationMs, `Measured duration ≥ ${targetDurationMs} ms`, Math.round(measuredDurationMs)),
    renderSamples: check(renderSamples.length >= minimumSamples, `Renderer samples ≥ ${minimumSamples}`, renderSamples.length),
    evaluatedWindows: check(evaluatedWindows > 0, 'At least one complete adaptive render window', evaluatedWindows),
    budget: check(budgetViolations === 0, 'Every renderer sample remains within the declared device budget', budgetViolations),
    fallback: check(fallbackSamples === 0, 'No WebGL fallback samples', fallbackSamples),
    framePressure: check(hotSamples === 0, 'No hot frame-pressure heuristic samples', hotSamples),
    orientations: check(orientations.has('portrait') && orientations.has('landscape'), 'Portrait and landscape both observed', [...orientations].join(', ') || 'none'),
    touchOrbit: check(interactions.canvasTouchStarts > 0, 'At least one touch starts on the city canvas', interactions.canvasTouchStarts),
    pinch: check(interactions.maxConcurrentTouchPointers >= 2, 'At least two concurrent canvas touch pointers', interactions.maxConcurrentTouchPointers),
    timeline: check(interactions.timelineScrubs > 0, 'Timeline scrub exercised', interactions.timelineScrubs),
    build: check(interactions.buildActions > 0, 'Build control exercised', interactions.buildActions),
    tour: check(interactions.tourActions > 0, 'Tour control exercised', interactions.tourActions),
    locales: check(languages.has('en') && languages.has('zh'), 'English and Chinese both observed', [...languages].join(', ') || 'none'),
    reducedMotion: check(reducedMotionModes.has('reduce') && reducedMotionModes.has('no-preference'), 'Reduced and full motion both observed', [...reducedMotionModes].join(', ') || 'none'),
    backgroundRecovery: check(visibilityStates.has('hidden') && visibilityStates.has('visible') && interactions.backgroundTransitions >= 2, 'Background and foreground transition observed', `${[...visibilityStates].join(', ') || 'none'} / ${interactions.backgroundTransitions}`),
    verticalRecovery: check(interactions.maxScrollY > 0, 'Vertical page recovery exercised in a short viewport', Math.round(interactions.maxScrollY)),
    horizontalOverflow: check(maximumOverflowPx <= 2, 'Horizontal overflow ≤ 2 px', Math.round(maximumOverflowPx * 100) / 100),
  });
  const readyForReview = Object.values(checks).every(({ passed }) => passed);

  return Object.freeze({
    schemaVersion: CITY_DEVICE_AUDIT_SCHEMA_VERSION,
    truthClass: 'physical-device-observation—not benchmark certification',
    privacy: 'local JSON export only; the page does not upload this report',
    deviceLabel: label,
    profile: input.profile,
    seed: input.seed,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    targetDurationMs,
    measuredDurationMs,
    environment: input.environment,
    summary: Object.freeze({
      samples: samples.length,
      renderSamples: renderSamples.length,
      evaluatedWindows,
      budgetViolations,
      fallbackSamples,
      hotSamples,
      maximumOverflowPx,
      renderPeaks: Object.freeze({
        drawCalls: maxFinite(renderSamples.map(({ telemetry }) => telemetry?.drawCalls ?? null)),
        triangles: maxFinite(renderSamples.map(({ telemetry }) => telemetry?.triangles ?? null)),
        p95Ms: maxFinite(renderSamples.map(({ telemetry }) => telemetry?.p95Ms ?? null)),
      }),
      heap: summarizeHeap(samples),
    }),
    interactions,
    checks,
    readyForReview,
    events: Object.freeze(events),
    samples: Object.freeze(samples),
  });
}
