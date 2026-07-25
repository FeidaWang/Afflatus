import { onCLS, onINP, onLCP } from 'web-vitals';
import { findPerformanceRoute } from '../config/performanceRoutes.generated.js';

export const WEB_VITAL_NAMES = Object.freeze(['CLS', 'INP', 'LCP']);
export const WEB_VITAL_EVENT = 'web_vital';
export const TELEMETRY_SCHEMA_VERSION = 1;

const METRIC_NAME_SET = new Set(WEB_VITAL_NAMES);
const VALID_RATINGS = new Set(['good', 'needs-improvement', 'poor']);
const MAX_GTAG_WAIT_MS = 10_000;
const GTAG_POLL_MS = 250;

let started = false;
let flushTimer = 0;
const pendingEvents = [];

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function roundedMetricValue(name, value) {
  const number = Math.max(0, finiteNumber(value));
  return name === 'CLS'
    ? Math.round(number * 1000) / 1000
    : Math.round(number);
}

export function normalizeTelemetryLocale(value) {
  return String(value || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

/**
 * Returns a deliberately coarse bucket. Raw viewport, DPR, memory, CPU count,
 * UA, model name and touch data never leave the browser.
 */
export function classifyDeviceTier({
  width = 0,
  coarsePointer = false,
  hardwareConcurrency = 0,
  deviceMemory = 0,
  dpr = 1,
} = {}) {
  const viewportWidth = Math.max(0, finiteNumber(width));
  const cores = Math.max(0, finiteNumber(hardwareConcurrency));
  const memory = Math.max(0, finiteNumber(deviceMemory));
  const pixelRatio = Math.max(1, finiteNumber(dpr, 1));

  if (!coarsePointer || viewportWidth > 1024) return 'desktop';
  if (viewportWidth > 600) return 'tablet';
  if ((cores >= 6 && pixelRatio >= 2.5) || memory >= 6) return 'mobile-flagship';
  if ((cores > 0 && cores <= 4) || (memory > 0 && memory <= 2)) return 'mobile-constrained';
  return 'mobile-standard';
}

export function getDeviceTier(win = globalThis.window) {
  const nav = win?.navigator || {};
  return classifyDeviceTier({
    width: win?.innerWidth,
    coarsePointer: Boolean(win?.matchMedia?.('(pointer: coarse)')?.matches),
    hardwareConcurrency: nav.hardwareConcurrency,
    deviceMemory: nav.deviceMemory,
    dpr: win?.devicePixelRatio,
  });
}

export function getTelemetryContext(win = globalThis.window) {
  const route = findPerformanceRoute(win?.location?.pathname);
  if (!route) return null;

  return Object.freeze({
    route: route.id,
    locale: normalizeTelemetryLocale(win?.document?.documentElement?.lang),
    device_tier: getDeviceTier(win),
  });
}

/**
 * Whitelist the complete GA event payload. Never spread the metric object:
 * it contains PerformanceEntry/DOM attribution data that is outside P0-05's
 * privacy contract.
 */
export function buildWebVitalEvent(metric, context) {
  const name = String(metric?.name || '').toUpperCase();
  if (!METRIC_NAME_SET.has(name) || !context?.route) return null;

  const metricValue = roundedMetricValue(name, metric?.value);
  const metricDelta = roundedMetricValue(name, metric?.delta);

  return Object.freeze({
    schema_version: TELEMETRY_SCHEMA_VERSION,
    metric_name: name,
    value: metricDelta,
    metric_value: metricValue,
    metric_delta: metricDelta,
    metric_rating: VALID_RATINGS.has(metric?.rating) ? metric.rating : 'needs-improvement',
    metric_id: String(metric?.id || '').slice(0, 80),
    route: String(context.route).slice(0, 40),
    locale: normalizeTelemetryLocale(context.locale),
    device_tier: String(context.device_tier || 'desktop').slice(0, 40),
  });
}

function flushPending(win) {
  if (typeof win?.gtag !== 'function') return false;
  while (pendingEvents.length) {
    win.gtag('event', WEB_VITAL_EVENT, pendingEvents.shift());
  }
  return true;
}

function scheduleFlush(win, elapsed = 0) {
  if (flushTimer || elapsed >= MAX_GTAG_WAIT_MS) return;
  const setTimer = win?.setTimeout?.bind(win) || globalThis.setTimeout;
  flushTimer = setTimer(() => {
    flushTimer = 0;
    if (!flushPending(win) && elapsed + GTAG_POLL_MS < MAX_GTAG_WAIT_MS) {
      scheduleFlush(win, elapsed + GTAG_POLL_MS);
    } else if (elapsed + GTAG_POLL_MS >= MAX_GTAG_WAIT_MS) {
      pendingEvents.length = 0;
    }
  }, GTAG_POLL_MS);
}

export function reportWebVital(metric, win = globalThis.window) {
  const context = getTelemetryContext(win);
  const payload = buildWebVitalEvent(metric, context);
  if (!payload) return false;

  if (typeof win?.gtag === 'function') {
    win.gtag('event', WEB_VITAL_EVENT, payload);
  } else {
    pendingEvents.push(payload);
    scheduleFlush(win);
  }
  return true;
}

export function startWebVitals(win = globalThis.window) {
  if (started || !win?.document || win.__AFFLATUS_E2E__) return false;
  if (!findPerformanceRoute(win.location?.pathname)) return false;

  started = true;
  const report = (metric) => reportWebVital(metric, win);
  onCLS(report);
  onINP(report);
  onLCP(report);
  return true;
}

export function resetWebVitalsForTest(win = globalThis.window) {
  started = false;
  pendingEvents.length = 0;
  if (flushTimer) {
    (win?.clearTimeout?.bind(win) || globalThis.clearTimeout)(flushTimer);
    flushTimer = 0;
  }
}
