import { describe, expect, it } from 'vitest';
import {
  CITY_DEVICE_AUDIT_SCHEMA_VERSION,
  cityDeviceOrientation,
  pickCityDeviceAuditTelemetry,
  summarizeCityDeviceAudit,
} from '../src/city/deviceAudit.ts';

function completeInteractions(overrides = {}) {
  return {
    backgroundTransitions: 2,
    buildActions: 1,
    canvasTouchStarts: 3,
    languages: ['en', 'zh'],
    maxConcurrentTouchPointers: 2,
    maxScrollY: 180,
    orientations: ['portrait', 'landscape'],
    reducedMotionModes: ['no-preference', 'reduce'],
    timelineScrubs: 2,
    tourActions: 1,
    visibilityStates: ['visible', 'hidden'],
    ...overrides,
  };
}

function telemetry(overrides = {}) {
  return pickCityDeviceAuditTelemetry({
    active: true,
    budgetClass: 'mobile',
    budgetEvaluation: { withinBudget: true },
    day: 147,
    drawCalls: 32,
    evaluatedWindows: 3,
    lifecycle: { fallback: false },
    lod: 'medium',
    p95Ms: 18.5,
    profile: 'hong-kong',
    qualityTier: 'balanced',
    thermalState: 'nominal',
    triangles: 52_000,
    ...overrides,
  });
}

function samples(count = 30, overrides = {}) {
  return Array.from({ length: count }, (_, index) => ({
    elapsedMs: index * 1_000,
    heapBytes: 12_000_000 + index * 2_000,
    horizontalOverflowPx: 0,
    language: index % 2 ? 'zh' : 'en',
    orientation: index % 2 ? 'landscape' : 'portrait',
    reducedMotion: index % 2 === 0,
    telemetry: telemetry(),
    viewport: { width: 390, height: 844, dpr: 3 },
    visibility: index === 10 ? 'hidden' : 'visible',
    ...overrides,
  }));
}

function report(overrides = {}) {
  return summarizeCityDeviceAudit({
    deviceLabel: 'iPhone 16 Pro / iOS / Safari',
    endedAt: '2026-08-15T10:10:00.000Z',
    environment: { robots: 'noindex,nofollow' },
    events: [],
    interactions: completeInteractions(),
    measuredDurationMs: 60_000,
    profile: 'hong-kong',
    samples: samples(),
    seed: 'device-audit-test',
    startedAt: '2026-08-15T10:00:00.000Z',
    targetDurationMs: 60_000,
    ...overrides,
  });
}

describe('City physical-device audit evidence', () => {
  it('normalizes orientation and a compact renderer sample', () => {
    expect(cityDeviceOrientation(390, 844)).toBe('portrait');
    expect(cityDeviceOrientation(844, 390)).toBe('landscape');
    expect(cityDeviceOrientation(400, 400)).toBe('square');
    expect(telemetry()).toEqual({
      active: true,
      budgetClass: 'mobile',
      budgetWithinLimits: true,
      day: 147,
      drawCalls: 32,
      evaluatedWindows: 3,
      fallback: false,
      lod: 'medium',
      p95Ms: 18.5,
      profile: 'hong-kong',
      qualityTier: 'balanced',
      thermalState: 'nominal',
      triangles: 52_000,
    });
  });

  it('marks a complete, budget-safe physical path ready for engineering review', () => {
    const result = report();
    expect(result.schemaVersion).toBe(CITY_DEVICE_AUDIT_SCHEMA_VERSION);
    expect(result.truthClass).toBe('physical-device-observation—not benchmark certification');
    expect(result.privacy).toContain('does not upload');
    expect(result.readyForReview).toBe(true);
    expect(Object.values(result.checks).every(({ passed }) => passed)).toBe(true);
    expect(result.summary).toMatchObject({
      renderSamples: 30,
      evaluatedWindows: 3,
      budgetViolations: 0,
      fallbackSamples: 0,
      hotSamples: 0,
      renderPeaks: { drawCalls: 32, triangles: 52_000, p95Ms: 18.5 },
      heap: { supported: true, samples: 30, growthBytes: 58_000 },
    });
  });

  it('fails closed when required gestures, duration or renderer health are missing', () => {
    const unhealthySamples = samples(30);
    unhealthySamples[5] = {
      ...unhealthySamples[5],
      horizontalOverflowPx: 9,
      telemetry: telemetry({
        budgetEvaluation: { withinBudget: false },
        lifecycle: { fallback: true },
        thermalState: 'hot',
      }),
    };
    const result = report({
      deviceLabel: '',
      measuredDurationMs: 20_000,
      interactions: completeInteractions({
        maxConcurrentTouchPointers: 1,
        maxScrollY: 0,
        orientations: ['portrait'],
        visibilityStates: ['visible'],
        backgroundTransitions: 0,
      }),
      samples: unhealthySamples,
    });
    expect(result.readyForReview).toBe(false);
    expect(result.checks.identifiedDevice.passed).toBe(false);
    expect(result.checks.duration.passed).toBe(false);
    expect(result.checks.budget.passed).toBe(false);
    expect(result.checks.fallback.passed).toBe(false);
    expect(result.checks.framePressure.passed).toBe(false);
    expect(result.checks.orientations.passed).toBe(false);
    expect(result.checks.pinch.passed).toBe(false);
    expect(result.checks.backgroundRecovery.passed).toBe(false);
    expect(result.checks.verticalRecovery.passed).toBe(false);
    expect(result.checks.horizontalOverflow.passed).toBe(false);
  });

  it('keeps heap evidence optional for Safari-style runtimes', () => {
    const result = report({ samples: samples(30, { heapBytes: null }) });
    expect(result.readyForReview).toBe(true);
    expect(result.summary.heap).toEqual({
      supported: false,
      samples: 0,
      firstBytes: null,
      lastBytes: null,
      growthBytes: null,
    });
  });
});
