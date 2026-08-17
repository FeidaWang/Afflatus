import { expect, settlePage, test } from './site-fixture.js';
import { performance as nodePerformance } from 'node:perf_hooks';

const requestedDurationMs = Number.parseInt(process.env.CITY_STABILITY_MS ?? '0', 10);
const durationMs = Number.isFinite(requestedDurationMs) ? Math.max(0, requestedDurationMs) : 0;
const requestedProfile = process.env.CITY_STABILITY_PROFILE ?? 'shanghai';
const STABILITY_PROFILES = Object.freeze(['shanghai', 'melbourne', 'hong-kong']);
if (!STABILITY_PROFILES.includes(requestedProfile)) {
  throw new Error(`Unknown CITY_STABILITY_PROFILE: ${requestedProfile}`);
}
const profile = requestedProfile;
const SCRUB_DAYS = Object.freeze([0, 1, 70, 147, 210, 147, 70, 1]);
const MEBIBYTE = 1024 * 1024;

function median(values) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.floor(ordered.length / 2)];
}

function summarizeHeap(samples) {
  const heapSamples = samples.filter(({ heapBytes }) => Number.isFinite(heapBytes));
  if (heapSamples.length < 8) return null;

  // Ignore initialization/warm-up and compare robust windows instead of two
  // individual samples; DevTools heap observations still follow a GC saw-tooth.
  const steady = heapSamples.slice(Math.floor(heapSamples.length * 0.2));
  const windowSize = Math.max(2, Math.floor(steady.length * 0.2));
  const firstMedian = median(steady.slice(0, windowSize).map(({ heapBytes }) => heapBytes));
  const lastMedian = median(steady.slice(-windowSize).map(({ heapBytes }) => heapBytes));

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
  const slopeBytesPerMinute = denominator > 0 ? (numerator / denominator) * 60_000 : 0;

  return Object.freeze({
    samples: heapSamples.length,
    distinctValues: new Set(heapSamples.map(({ heapBytes }) => heapBytes)).size,
    firstMedianBytes: firstMedian,
    lastMedianBytes: lastMedian,
    medianGrowthBytes: lastMedian - firstMedian,
    slopeBytesPerMinute,
  });
}

function summarizeRenderPeaks(samples) {
  return Object.freeze({
    p95Ms: Math.max(...samples.map(({ telemetry }) => telemetry?.p95Ms ?? 0)),
    drawCalls: Math.max(...samples.map(({ telemetry }) => telemetry?.drawCalls ?? 0)),
    triangles: Math.max(...samples.map(({ telemetry }) => telemetry?.triangles ?? 0)),
  });
}

// A 30-minute action trace grows large enough that zipping it can outlive the
// test timeout and produce a truncated archive. The JSON telemetry is the
// authoritative soak artifact; short interaction traces are covered by the
// regular Cityview candidate suite.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test.describe('Cityview opt-in scrub stability', () => {
  test('repeated 0–210 day scrubs keep the renderer healthy and heap bounded', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop-chromium',
      'The soak runs once in the reference Chromium profile.',
    );
    test.skip(
      durationMs < 1,
      'Set CITY_STABILITY_MS=1800000 for the 30-minute release-candidate soak.',
    );
    test.setTimeout(durationMs + 5 * 60_000);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const query = new URLSearchParams({ seed: `city-stability-${profile}-001`, profile });
    await page.goto(`/cityview.html?${query}`, { waitUntil: 'domcontentloaded' });
    await settlePage(page);
    await expect(page.locator('[data-city-stage]')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('[data-city-canvas]')).toHaveAttribute('data-renderer', 'webgl');
    await page.waitForFunction(
      () => (window.__AFFLATUS_CITYVIEW__?.getTelemetry()?.evaluatedWindows ?? 0) > 0,
      null,
      { timeout: 8_000 },
    );
    const devtools = await page.context().newCDPSession(page);
    await devtools.send('Performance.enable');

    const timeline = page.locator('[data-city-timeline]');
    const samples = [];
    // Use a monotonic clock: laptop sleep/resume and host clock corrections
    // must not shorten or indefinitely extend a release soak.
    const startedAt = nodePerformance.now();
    let iteration = 0;
    let nextSampleAt = 0;

    while (nodePerformance.now() - startedAt < durationMs) {
      const day = SCRUB_DAYS[iteration % SCRUB_DAYS.length];
      await timeline.evaluate((element, value) => {
        element.value = String(value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }, day);
      await expect(page.locator('[data-city-day]')).toHaveText(String(day).padStart(3, '0'));
      await page.waitForTimeout(50);

      const elapsedMs = nodePerformance.now() - startedAt;
      if (elapsedMs >= nextSampleAt) {
        const [browserSample, performanceSample] = await Promise.all([
          page.evaluate((sampleElapsedMs) => ({
            elapsedMs: sampleElapsedMs,
            telemetry: window.__AFFLATUS_CITYVIEW__?.getTelemetry?.() ?? null,
            renderer: document.querySelector('[data-city-canvas]')?.getAttribute('data-renderer'),
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

    const finalTelemetry = await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry?.());
    await devtools.send('Performance.disable');
    const heap = summarizeHeap(samples);
    const renderPeaks = summarizeRenderPeaks(samples);
    const steadyRenderPeaks = summarizeRenderPeaks(
      samples.slice(Math.floor(samples.length * 0.2)),
    );
    const report = Object.freeze({
      requestedDurationMs: durationMs,
      profile,
      measuredDurationMs: nodePerformance.now() - startedAt,
      iterations: iteration,
      heap,
      renderPeaks,
      steadyRenderPeaks,
      finalTelemetry,
      samples,
    });
    await testInfo.attach('cityview-stability.json', {
      body: Buffer.from(`${JSON.stringify(report, null, 2)}\n`),
      contentType: 'application/json',
    });
    console.info('[city-stability]', JSON.stringify({
      profile,
      measuredDurationMs: report.measuredDurationMs,
      iterations: report.iterations,
      heap,
      renderPeaks,
      steadyRenderPeaks,
      final: {
        evaluatedWindows: finalTelemetry?.evaluatedWindows ?? 0,
        p95Ms: finalTelemetry?.p95Ms ?? 0,
        drawCalls: finalTelemetry?.drawCalls ?? 0,
        triangles: finalTelemetry?.triangles ?? 0,
        thermalState: finalTelemetry?.thermalState ?? 'unknown',
        fallback: Boolean(finalTelemetry?.lifecycle?.fallback),
      },
    }));

    expect(samples.every(({ renderer }) => renderer === 'webgl')).toBe(true);
    expect(samples.every(({ telemetry }) => telemetry?.budgetEvaluation?.withinBudget)).toBe(true);
    expect(finalTelemetry?.budgetEvaluation).toMatchObject({ withinBudget: true, violations: [] });
    expect(finalTelemetry?.lifecycle?.fallback).toBe(false);

    if (heap) {
      // A 32 MiB median window drift catches unbounded dynamic-buffer churn but
      // leaves room for JIT/Three warm-up variance. The slope gate is reserved
      // for release-length runs where GC saw-tooth noise has averaged out.
      expect(heap.medianGrowthBytes).toBeLessThanOrEqual(32 * MEBIBYTE);
      if (durationMs >= 30 * 60_000) {
        expect(heap.slopeBytesPerMinute).toBeLessThanOrEqual(4 * MEBIBYTE);
      }
    }
  });
});
