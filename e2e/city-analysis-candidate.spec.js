import { performance as nodePerformance } from 'node:perf_hooks';
import { expect, settlePage, test } from './site-fixture.js';

const ANALYSIS_URL = '/cityview.html?analysis-preview=melbourne&debug=1';
const requestedDurationMs = Number.parseInt(process.env.CITY_ANALYSIS_STABILITY_MS ?? '0', 10);
const stabilityDurationMs = Number.isFinite(requestedDurationMs)
  ? Math.max(0, requestedDurationMs)
  : 0;
const MEBIBYTE = 1024 * 1024;
const STREAMING_LIMITS = Object.freeze({
  visibleBytes: 1_100_000,
  visibleDrawCalls: 36,
  visibleTriangles: 40_000,
  residentBytes: 2_500_000,
  residentAssets: 18,
});
const STABILITY_ENVIRONMENTS = Object.freeze(['analysis', 'day', 'sunset', 'night']);

const TARGETS = Object.freeze([
  Object.freeze({ id: 'tile-c00-r00', x: -125, z: -375 }),
  Object.freeze({ id: 'tile-c03-r00', x: 625, z: -375 }),
  Object.freeze({ id: 'tile-c03-r04', x: 625, z: 625 }),
  Object.freeze({ id: 'tile-c00-r04', x: -125, z: 625 }),
  Object.freeze({ id: 'tile-c02-r02', x: 375, z: 125 }),
  Object.freeze({ id: 'tile-c01-r02', x: 125, z: 125 }),
]);
const OFFSETS = Object.freeze([
  Object.freeze({ lod: 2, x: 100, y: 160, z: 100 }),
  Object.freeze({ lod: 1, x: 330, y: 220, z: 240 }),
  Object.freeze({ lod: 0, x: 650, y: 480, z: 550 }),
]);
const STREAMING_VIEWS = Object.freeze(TARGETS.flatMap((target) => OFFSETS.map((offset) => Object.freeze({
  id: `${target.id}-lod${offset.lod}`,
  primaryTileId: target.id,
  lod: offset.lod,
  position: Object.freeze({
    x: target.x + offset.x,
    y: offset.y,
    z: target.z + offset.z,
  }),
  target: Object.freeze({ x: target.x, y: 18, z: target.z }),
}))));

function median(values) {
  if (!values.length) return null;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.floor(ordered.length / 2)];
}

function summarizeHeap(samples) {
  const heapSamples = samples.filter(({ heapBytes }) => Number.isFinite(heapBytes));
  if (heapSamples.length < 8) return null;
  const steady = heapSamples.slice(Math.floor(heapSamples.length * 0.2));
  const windowSize = Math.max(2, Math.floor(steady.length * 0.2));
  const firstMedianBytes = median(steady.slice(0, windowSize).map(({ heapBytes }) => heapBytes));
  const lastMedianBytes = median(steady.slice(-windowSize).map(({ heapBytes }) => heapBytes));
  const xMean = steady.reduce((sum, sample) => sum + sample.elapsedMs, 0) / steady.length;
  const yMean = steady.reduce((sum, sample) => sum + sample.heapBytes, 0) / steady.length;
  const numerator = steady.reduce(
    (sum, sample) => sum + ((sample.elapsedMs - xMean) * (sample.heapBytes - yMean)),
    0,
  );
  const denominator = steady.reduce(
    (sum, sample) => sum + ((sample.elapsedMs - xMean) ** 2),
    0,
  );
  return Object.freeze({
    samples: heapSamples.length,
    distinctValues: new Set(heapSamples.map(({ heapBytes }) => heapBytes)).size,
    firstMedianBytes,
    lastMedianBytes,
    medianGrowthBytes: lastMedianBytes - firstMedianBytes,
    slopeBytesPerMinute: denominator > 0 ? (numerator / denominator) * 60_000 : 0,
  });
}

async function openAnalysis(page, suffix = '') {
  const response = await page.goto(`${ANALYSIS_URL}${suffix}`, { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBe(200);
  await settlePage(page);
  await expect(page.locator('[data-city-stage]')).toHaveAttribute('aria-busy', 'false');
  return response;
}

async function setAnalysisView(page, view) {
  await page.evaluate(async (nextView) => {
    await window.__AFFLATUS_CITYVIEW__?.setAnalysisView?.(nextView);
  }, view);
  await expect.poll(
    () => page.evaluate(() => {
      const telemetry = window.__AFFLATUS_CITYVIEW__?.getTelemetry?.();
      return telemetry ? `${telemetry.primaryTileId}:lod${telemetry.lod}` : null;
    }),
  ).toBe(`${view.primaryTileId}:lod${view.lod}`);
}

async function setAnalysisEnvironment(page, environment) {
  const state = await page.evaluate(async (nextEnvironment) => (
    window.__AFFLATUS_CITYVIEW__?.setAnalysisEnvironment?.(nextEnvironment)
  ), environment);
  expect(state).toMatchObject({
    status: 'ready',
    requestedEnvironment: environment,
    snapshot: { environment },
  });
  await expect.poll(
    () => page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry?.()?.environment?.environment),
  ).toBe(environment);
}

test.describe.configure({ mode: 'serial' });

test('freezes the verified Analysis and offline poster viewports', async ({ page }) => {
  await openAnalysis(page);
  await expect(page.locator('[data-city-canvas]')).toHaveAttribute('data-renderer', 'webgl');
  await expect(page.locator('[data-city-summary-model]')).toContainText('licensed Melbourne candidate package');
  await expect(page).toHaveScreenshot('melbourne-analysis-success.png', {
    animations: 'disabled',
    caret: 'hide',
    scale: 'css',
    maxDiffPixelRatio: 0.008,
  });

  await openAnalysis(page, '&analysis-failure=offline');
  await expect(page.locator('[data-city-canvas]')).toHaveAttribute('data-renderer', 'poster');
  await expect(page.locator('[data-city-status]')).toContainText('injected-offline');
  await expect(page.locator('[data-city-reset]')).toBeDisabled();
  await expect(page).toHaveScreenshot('melbourne-analysis-offline-poster.png', {
    animations: 'disabled',
    caret: 'hide',
    scale: 'css',
    maxDiffPixelRatio: 0.004,
  });
});

test('switches fixed environments without changing camera, LOD or decoded assets', async ({ page }) => {
  await openAnalysis(page);
  const selector = page.locator('select[data-city-environment]');
  await expect(selector).toBeEnabled();
  const initial = await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry?.());
  expect(initial?.environment).toMatchObject({
    requestedEnvironment: 'analysis',
    environment: 'analysis',
    styleId: 'melbourne-analysis-v1',
    simulatedLighting: false,
  });
  const invariant = {
    camera: initial.camera,
    primaryTileId: initial.primaryTileId,
    lod: initial.lod,
    resolvedTileIds: initial.resolvedTileIds,
    residentBytes: initial.cache.residentBytes,
    residentAssets: initial.cache.residentAssets,
    decodedAssetCount: initial.cache.decodedAssetCount,
  };

  for (const environment of ['day', 'sunset', 'night']) {
    await selector.selectOption(environment);
    await expect(page.locator('[data-city-stage]')).toHaveAttribute(
      'data-city-environment',
      environment,
    );
    const telemetry = await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry?.());
    expect(telemetry.environment).toMatchObject({
      requestedEnvironment: environment,
      environment,
      styleId: `melbourne-${environment}-v1`,
      simulatedLighting: environment === 'night',
    });
    expect({
      camera: telemetry.camera,
      primaryTileId: telemetry.primaryTileId,
      lod: telemetry.lod,
      resolvedTileIds: telemetry.resolvedTileIds,
      residentBytes: telemetry.cache.residentBytes,
      residentAssets: telemetry.cache.residentAssets,
      decodedAssetCount: telemetry.cache.decodedAssetCount,
    }).toEqual(invariant);
    if (environment === 'night') {
      await expect(page.locator('[data-city-status]')).toContainText('simulated visual layer');
    }
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot(`melbourne-${environment}.png`, {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.008,
    });
  }

  await page.mouse.click(800, 480);
  await expect.poll(
    () => page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getAnalysisSelection?.()?.entityId ?? null),
  ).not.toBeNull();
  const selected = await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getAnalysisSelection?.());
  expect(selected).toMatchObject({
    entityId: expect.any(String),
    layerId: expect.any(String),
    tileId: expect.any(String),
    lod: expect.any(Number),
    provider: expect.any(String),
    attribution: expect.any(String),
  });
  const selectionOutput = page.locator('[data-city-analysis-selection]');
  await expect(selectionOutput).toBeVisible();
  await expect(selectionOutput).toHaveAttribute('data-city-analysis-entity-id', selected.entityId);
  await expect(selectionOutput).toContainText(selected.attribution);

  await selector.selectOption('auto-local');
  await expect(page.locator('[data-city-stage]')).toHaveAttribute('data-city-environment', 'day');
  expect(await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry?.()?.environment))
    .toMatchObject({
      requestedEnvironment: 'auto-local',
      environment: 'day',
      localDateTime: '2026-07-25T12:00:00',
      timeZone: 'Australia/Melbourne',
      simulatedLighting: false,
    });
  expect(await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getAnalysisSelection?.()))
    .toEqual(selected);
  expect(await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry?.()?.selection))
    .toMatchObject({ entityId: selected.entityId, layerId: selected.layerId });

  await page.locator('.city-lang').click();
  await expect(selector).toHaveAttribute('aria-label', '墨尔本环境');
  await expect(selector.locator('option[value="auto-local"]')).toHaveText('自动 · 墨尔本当地时间');
  await expect(selectionOutput).toContainText('来源：');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(selector).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
    .toBeLessThanOrEqual(0);
});

test('fails an environment switch closed to Analysis', async ({ page }) => {
  await openAnalysis(page, '&analysis-environment-failure=night');
  const state = await page.evaluate(async () => (
    window.__AFFLATUS_CITYVIEW__?.setAnalysisEnvironment?.('night')
  ));
  expect(state).toMatchObject({
    status: 'fallback',
    requestedEnvironment: 'night',
    reason: 'injected-environment-failure:night',
    snapshot: { environment: 'analysis' },
  });
  await expect(page.locator('[data-city-stage]')).toHaveAttribute(
    'data-city-environment-status',
    'fallback',
  );
  await expect(page.locator('[data-city-stage]')).toHaveAttribute(
    'data-city-environment',
    'analysis',
  );
  await expect(page.locator('[data-city-status]')).toContainText('failed closed to Analysis');
  const telemetry = await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry?.());
  expect(telemetry.environment).toMatchObject({
    requestedEnvironment: 'analysis',
    environment: 'analysis',
    styleId: 'melbourne-analysis-v1',
    simulatedLighting: false,
  });
  expect(telemetry.lifecycle.fallback).toBe(false);
});

test('separates cold/warm p95 and keeps streamed assets plus heap bounded', async ({ page }, testInfo) => {
  test.skip(
    stabilityDurationMs < 1,
    'Set CITY_ANALYSIS_STABILITY_MS to run the candidate streaming soak.',
  );
  test.setTimeout(stabilityDurationMs + 5 * 60_000);
  const bootStartedAt = nodePerformance.now();
  await openAnalysis(page);
  const coldBootMs = nodePerformance.now() - bootStartedAt;
  await expect(page.locator('[data-city-canvas]')).toHaveAttribute('data-renderer', 'webgl');
  await page.waitForFunction(
    () => (window.__AFFLATUS_CITYVIEW__?.getTelemetry?.()?.frameSamples ?? 0) >= 180,
  );
  const coldTelemetry = await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry?.());

  for (const view of STREAMING_VIEWS) await setAnalysisView(page, view);
  await page.evaluate(async () => {
    await window.__AFFLATUS_CITYVIEW__?.resetAnalysisView?.();
  });

  const devtools = await page.context().newCDPSession(page);
  await devtools.send('Performance.enable');
  await devtools.send('HeapProfiler.collectGarbage');
  const samples = [];
  const visited = new Set();
  const visitedEnvironments = new Set();
  const startedAt = nodePerformance.now();
  let iteration = 0;
  let nextSampleAt = 0;

  while (nodePerformance.now() - startedAt < stabilityDurationMs) {
    const view = STREAMING_VIEWS[iteration % STREAMING_VIEWS.length];
    const environment = STABILITY_ENVIRONMENTS[iteration % STABILITY_ENVIRONMENTS.length];
    await setAnalysisView(page, view);
    await setAnalysisEnvironment(page, environment);
    visited.add(`${view.primaryTileId}:lod${view.lod}`);
    visitedEnvironments.add(environment);
    await page.waitForTimeout(250);
    const elapsedMs = nodePerformance.now() - startedAt;
    if (elapsedMs >= nextSampleAt) {
      const [browserSample, performanceSample] = await Promise.all([
        page.evaluate((sampleElapsedMs) => ({
          elapsedMs: sampleElapsedMs,
          telemetry: window.__AFFLATUS_CITYVIEW__?.getTelemetry?.() ?? null,
          renderer: document.querySelector('[data-city-canvas]')?.dataset.renderer,
          horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
        }), elapsedMs),
        devtools.send('Performance.getMetrics'),
      ]);
      const heapBytes = performanceSample.metrics
        .find(({ name }) => name === 'JSHeapUsedSize')?.value ?? null;
      samples.push({ ...browserSample, heapBytes });
      nextSampleAt = elapsedMs + 1_000;
    }
    iteration += 1;
  }

  await page.evaluate(async () => {
    await window.__AFFLATUS_CITYVIEW__?.resetAnalysisView?.();
    await window.__AFFLATUS_CITYVIEW__?.setAnalysisEnvironment?.('analysis');
  });
  await page.waitForTimeout(3_500);
  const warmTelemetry = await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry?.());
  await devtools.send('Performance.disable');
  const heap = summarizeHeap(samples);
  const steadySamples = samples.slice(Math.floor(samples.length * 0.2));
  const maximumSteadyP95Ms = Math.max(...steadySamples.map(({ telemetry }) => telemetry?.p95Ms ?? 0));
  const report = Object.freeze({
    requestedDurationMs: stabilityDurationMs,
    measuredDurationMs: nodePerformance.now() - startedAt,
    coldBootMs,
    coldTelemetry,
    warmTelemetry,
    iterations: iteration,
    visitedViews: [...visited].sort(),
    visitedEnvironments: [...visitedEnvironments].sort(),
    maximumSteadyP95Ms,
    heap,
    samples,
  });
  await testInfo.attach('melbourne-analysis-stability.json', {
    body: Buffer.from(`${JSON.stringify(report, null, 2)}\n`),
    contentType: 'application/json',
  });
  console.info('[melbourne-analysis-stability]', JSON.stringify({
    requestedDurationMs: report.requestedDurationMs,
    measuredDurationMs: report.measuredDurationMs,
    coldBootMs,
    coldP95Ms: coldTelemetry?.p95Ms,
    warmP95Ms: warmTelemetry?.p95Ms,
    maximumSteadyP95Ms,
    iterations: iteration,
    visitedViews: report.visitedViews.length,
    visitedEnvironments: report.visitedEnvironments,
    environmentSwitchCount: warmTelemetry?.environment?.switchCount,
    heap,
    cache: warmTelemetry?.cache,
  }));

  expect(coldBootMs).toBeLessThan(8_000);
  expect(report.visitedViews).toHaveLength(STREAMING_VIEWS.length);
  expect(report.visitedEnvironments).toEqual([...STABILITY_ENVIRONMENTS].sort());
  expect(samples.length).toBeGreaterThanOrEqual(Math.max(8, Math.floor(stabilityDurationMs / 1_500)));
  expect(samples.every(({ renderer }) => renderer === 'webgl')).toBe(true);
  expect(samples.every(({ horizontalOverflow }) => horizontalOverflow <= 0)).toBe(true);
  expect(samples.every(({ telemetry }) => (
    telemetry
    && telemetry.visibleAssetBytes <= STREAMING_LIMITS.visibleBytes
    && telemetry.visibleAssetDrawCalls <= STREAMING_LIMITS.visibleDrawCalls
    && telemetry.visibleAssetTriangles <= STREAMING_LIMITS.visibleTriangles
    && telemetry.cache.residentBytes <= STREAMING_LIMITS.residentBytes
    && telemetry.cache.residentAssets <= STREAMING_LIMITS.residentAssets
    && STABILITY_ENVIRONMENTS.includes(telemetry.environment.environment)
    && telemetry.environment.styleId === `melbourne-${telemetry.environment.environment}-v1`
    && telemetry.environment.styledMaterialCount > 0
    && telemetry.lifecycle.fallback === false
  ))).toBe(true);
  expect(warmTelemetry?.p95Ms).toBeLessThanOrEqual(18);
  expect(maximumSteadyP95Ms).toBeLessThanOrEqual(18);
  expect(warmTelemetry?.cache.decodedAssetCount).toBeGreaterThan(STREAMING_LIMITS.residentAssets);
  expect(warmTelemetry?.cache.evictionCount).toBeGreaterThan(0);
  expect(warmTelemetry?.environment?.switchCount).toBeGreaterThanOrEqual(iteration);
  if (heap) {
    expect(heap.medianGrowthBytes).toBeLessThanOrEqual(32 * MEBIBYTE);
    if (stabilityDurationMs >= 10 * 60_000) {
      expect(heap.slopeBytesPerMinute).toBeLessThanOrEqual(4 * MEBIBYTE);
    }
  }
});
