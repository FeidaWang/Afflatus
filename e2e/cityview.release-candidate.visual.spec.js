import { expect, settlePage, test } from './site-fixture.js';

const PROFILES = Object.freeze(['sandbox']);
const DAYS = Object.freeze([0, 70, 147, 210]);
const VISUAL_MODES = Object.freeze([
  Object.freeze({ id: 'full', reducedMotion: 'no-preference', days: DAYS }),
  Object.freeze({ id: 'reduced', reducedMotion: 'reduce', days: Object.freeze([210]) }),
]);
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

test.describe.configure({ mode: 'serial' });

test('Cityview emits an explicit fixed-seed Sandbox construction-day visual matrix', async ({ page }, testInfo) => {
  // This intentionally renders and attaches 20 WebGL snapshots. The default
  // 45-second project timeout is too short for the full matrix on CI Macs.
  test.setTimeout(120_000);
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'The release-candidate visual matrix is captured once in Chromium.',
  );
  await page.addInitScript(() => {
    // Visual baselines exercise the full renderer independent of the host
    // runner's advertised CPU/memory tier.
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  });
  for (const mode of VISUAL_MODES) {
    await page.emulateMedia({ reducedMotion: mode.reducedMotion });

    for (const profile of PROFILES) {
      const query = new URLSearchParams({
        seed: 'city-release-candidate-001',
        mode: 'sandbox',
        profile: 'shanghai',
      });
      await page.goto(`/cityview.html?${query}`, { waitUntil: 'domcontentloaded' });
      await settlePage(page);
      await expect(page.locator('[data-city-stage]')).toHaveAttribute('aria-busy', 'false');
      await expect.poll(
        () => page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry?.()?.drawCalls ?? 0),
        { message: `${mode.id}-${profile} must reach its first rendered frame` },
      ).toBeGreaterThan(0);

      for (const day of mode.days) {
        await page.locator('[data-city-timeline]').evaluate((element, value) => {
          element.value = String(value);
          element.dispatchEvent(new Event('input', { bubbles: true }));
        }, day);
        await expect(page.locator('[data-city-day]')).toHaveText(String(day).padStart(3, '0'));
        await expect.poll(
          () => page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry?.()?.day),
        ).toBe(day);
        await expect.poll(
          () => page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry?.()?.renderedDay),
          { message: `${mode.id}-${profile}-day-${day} must finish its render update` },
        ).toBe(day);
        const telemetry = await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry?.());
        const label = `${mode.id}-${profile}-day-${day}`;
        expect(telemetry, `${label} must expose renderer telemetry`).toBeTruthy();
        expect(telemetry.drawCalls, `${label} must reach the renderer`).toBeGreaterThan(0);
        expect(telemetry.triangles, `${label} must contain rendered geometry`).toBeGreaterThan(0);
        expect(telemetry.drawCalls, `${label} must stay within its draw-call budget`).toBeLessThanOrEqual(
          telemetry.budgetEvaluation.limits.drawCalls,
        );
        expect(telemetry.triangles, `${label} must stay within its triangle budget`).toBeLessThanOrEqual(
          telemetry.budgetEvaluation.limits.triangles,
        );
        if (mode.id === 'full') {
          expect(telemetry.reducedMotion).toBe(false);
          expect(telemetry.lod).not.toBe('silhouette');
        } else {
          expect(telemetry.reducedMotion).toBe(true);
          expect(telemetry.lod).toBe('silhouette');
        }
        if (day === 210) {
          expect(telemetry.constructionRender.roads.rendered).toBe(
            telemetry.constructionRender.roads.planned,
          );
          expect(telemetry.constructionRender.buildings.shells).toBe(
            telemetry.constructionRender.buildings.planned,
          );
          expect(telemetry.constructionRender.buildings.roofs).toBe(
            telemetry.constructionRender.buildings.planned,
          );
          expect(telemetry.constructionRender.buildings.rooftopAssets).toBe(
            telemetry.constructionRender.buildings.plannedRooftopAssets,
          );
          expect(telemetry.constructionRender.buildings.rooftopAssets).toBeGreaterThan(0);
          expect(telemetry.constructionRender.heroes.components).toBe(
            telemetry.constructionRender.heroes.plannedComponents,
          );
          expect(telemetry.constructionRender.heroes.roofs).toBe(
            telemetry.constructionRender.heroes.plannedLandmarks,
          );
          if (profile === 'shanghai') {
            expect(telemetry.heroForms['corn-cob']).toBe(1);
          }
          if (profile === 'hong-kong') {
            expect(telemetry).toMatchObject({
              profile: 'hong-kong',
              heroLandmarks: 3,
              environment: {
                ridgePeaks: 9,
                vehiclesPlanned: 26,
              },
            });
            expect(Object.keys(telemetry.heroForms).sort()).toEqual([
              'civic-shards',
              'notched-fin',
              'stepped-crown',
            ]);
          }
          if (mode.id === 'full') {
            expect(telemetry.environment.leisureAssetsVisible).toBe(
              telemetry.environment.leisureAssetsPlanned,
            );
          }
          expect(telemetry.structureLineSegments).toBeGreaterThan(500);
          expect(telemetry.triangles).toBeGreaterThan(mode.id === 'full' ? 30_000 : 18_000);
        }
        if (day === 0) {
          expect(telemetry.constructionRender.buildings.rooftopAssets).toBe(0);
          expect(telemetry.environment.leisureAssetsVisible).toBe(0);
        }
        const image = await page.screenshot({
          animations: 'disabled',
          caret: 'hide',
          fullPage: false,
          scale: 'css',
        });
        expect(image.subarray(0, PNG_SIGNATURE.length)).toEqual(PNG_SIGNATURE);
        expect(image.byteLength, `${label} must contain a rendered viewport`).toBeGreaterThan(8_000);
        await testInfo.attach(`cityview-${label}.png`, {
          body: image,
          contentType: 'image/png',
        });
        await testInfo.attach(`cityview-${label}.json`, {
          body: Buffer.from(JSON.stringify(telemetry, null, 2)),
          contentType: 'application/json',
        });
      }
    }
  }
});

test('real-city profiles emit truthful unavailable posters instead of generated hero views', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'The real-city unavailable matrix is captured once in Chromium.',
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const profile of ['shanghai', 'melbourne', 'hong-kong']) {
    const query = new URLSearchParams({ profile, mode: 'reality' });
    await page.goto(`/cityview.html?${query}`, { waitUntil: 'domcontentloaded' });
    await settlePage(page);
    await expect(page.locator('[data-city-stage]')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('[data-city-stage]')).toHaveAttribute('data-city-surface', 'unavailable');
    await expect(page.locator('[data-city-canvas]')).toHaveAttribute('data-renderer', 'poster');
    await expect(page.locator('[data-city-profile-note]')).toContainText('Reality package unavailable');
    expect(await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry?.())).toBeNull();
    expect(await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getPlanSummary?.())).toMatchObject({
      profile,
      truthMode: 'reality',
      truthClass: 'real-city-unavailable',
      availability: 'unavailable',
      buildings: 0,
      heroLandmarks: 0,
    });
    const image = await page.screenshot({
      animations: 'disabled',
      caret: 'hide',
      fullPage: false,
      scale: 'css',
    });
    expect(image.subarray(0, PNG_SIGNATURE.length)).toEqual(PNG_SIGNATURE);
    expect(image.byteLength, `${profile} unavailable poster must contain a rendered viewport`).toBeGreaterThan(8_000);
    await testInfo.attach(`cityview-${profile}-reality-unavailable.png`, {
      body: image,
      contentType: 'image/png',
    });
  }
});
