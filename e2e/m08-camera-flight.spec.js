import { expect, test } from './site-fixture.js';

const screenshotRoot = 'docs/refactor/screenshots';

async function openFlight(page, path = '/?experience=cinematic') {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(window.__AFFLATUS_M08__))).toBe(true);
  await expect(page.locator('.signature-experience')).toHaveAttribute('data-scene-status', 'ready');
}

async function moveToProgress(page, progress) {
  await page.evaluate((nextProgress) => {
    const distance = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ behavior: 'instant', left: 0, top: distance * nextProgress });
  }, progress);
  await expect.poll(() => page.evaluate(() => window.__AFFLATUS_M08__.getTimeline().targetProgress)).toBeCloseTo(progress, 2);
  await expect.poll(() => page.evaluate(() => window.__AFFLATUS_M08__.getFlight().progress), {
    timeout: 5_000,
  }).toBeCloseTo(progress, 2);
}

function maximumDelta(left, right) {
  return Math.max(...left.map((value, index) => Math.abs(value - right[index])));
}

test.describe('M08 guided carrier camera flight', () => {
  test('flies the seven-shot route while the carrier remains static', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    await openFlight(page);
    const scene = page.locator('.signature-scene');
    await expect(scene).toHaveAttribute('data-ship-motion', 'camera-only');

    const initial = await page.evaluate(() => ({
      flight: window.__AFFLATUS_M08__.getFlight(),
      metrics: window.__AFFLATUS_M08__.getMetrics(),
    }));
    expect(initial.flight.pathNode).toBe('distant-observation');
    expect(initial.metrics.shipRotation).toEqual([0, 0, 0]);
    expect(initial.metrics.shipTriangles).toBeLessThan(5000);

    await moveToProgress(page, 0.18);
    await expect(scene).toHaveAttribute('data-path-node', 'bow-approach');
    await page.screenshot({ path: `${screenshotRoot}/m08-bow-approach-desktop-1440x1000.png` });

    await moveToProgress(page, 0.36);
    await expect(scene).toHaveAttribute('data-path-node', 'port-side-parallel-drift');
    await page.screenshot({ path: `${screenshotRoot}/m08-parallel-drift-desktop-1440x1000.png` });

    await moveToProgress(page, 0.98);
    await expect(scene).toHaveAttribute('data-path-node', 'departure-vector');
    const departure = await page.evaluate(() => ({
      flight: window.__AFFLATUS_M08__.getFlight(),
      metrics: window.__AFFLATUS_M08__.getMetrics(),
    }));
    expect(departure.metrics.shipRotation).toEqual(initial.metrics.shipRotation);
    expect(departure.flight.fov).toBeGreaterThanOrEqual(28);
    expect(departure.flight.fov).toBeLessThanOrEqual(40);
    expect(Math.abs(departure.flight.roll)).toBeLessThanOrEqual(0.8);
    await page.screenshot({ path: `${screenshotRoot}/m08-departure-desktop-1440x1000.png` });
  });

  test('is deterministic in reverse and on direct chapter jumps', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    await openFlight(page);

    await moveToProgress(page, 0.5);
    const forward = await page.evaluate(() => window.__AFFLATUS_M08__.getFlight());
    await moveToProgress(page, 0.87);
    await moveToProgress(page, 0.5);
    const reverse = await page.evaluate(() => window.__AFFLATUS_M08__.getFlight());
    expect(maximumDelta(reverse.cameraPosition, forward.cameraPosition)).toBeLessThan(0.03);
    expect(maximumDelta(reverse.lookAt, forward.lookAt)).toBeLessThan(0.03);
    expect(Math.abs(reverse.fov - forward.fov)).toBeLessThan(0.03);

    await page.evaluate(() => { window.location.hash = 'chapter-06-title'; });
    await expect(page.locator('.signature-experience')).toHaveAttribute('data-current-chapter', '06-departure');
    await expect.poll(() => page.evaluate(() => {
      const timeline = window.__AFFLATUS_M08__.getTimeline();
      return Math.abs(timeline.progress - timeline.targetProgress);
    })).toBeLessThan(0.001);
    const direct = await page.evaluate(() => window.__AFFLATUS_M08__.getTimeline());
    expect(direct.chapterId).toBe('06-departure');
  });

  test('keeps mouse input supplemental and one RAF owner', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    await openFlight(page);
    await moveToProgress(page, 0.34);
    const routeBefore = await page.evaluate(() => window.__AFFLATUS_M08__.getFlight());
    await page.mouse.move(1, 1);
    await expect.poll(() => page.evaluate(() => window.__AFFLATUS_M08__.getMetrics().parallaxPixels?.x)).toBeLessThan(-1);
    const after = await page.evaluate(() => ({
      flight: window.__AFFLATUS_M08__.getFlight(),
      metrics: window.__AFFLATUS_M08__.getMetrics(),
    }));
    expect(Math.abs(after.metrics.parallaxPixels.x)).toBeLessThanOrEqual(5);
    expect(Math.abs(after.metrics.parallaxPixels.y)).toBeLessThanOrEqual(5);
    expect(maximumDelta(after.flight.cameraPosition, routeBefore.cameraPosition)).toBeLessThan(0.03);
    expect(after.metrics).toMatchObject({ activeRafOwners: 1, mainRafRunning: true });
  });

  test('does not expose the development overlay in a production build', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    await openFlight(page, '/?experience=cinematic&flight-debug=1');
    await expect(page.locator('.flight-debug-overlay')).toHaveCount(0);
    await expect(page.locator('.signature-experience')).not.toHaveAttribute('data-flight-debug', 'enabled');
  });
});

test.describe('M08 cross-device evidence', () => {
  test('keeps the mobile route on the same fixed single canvas', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'galaxy-s26-ultra-chromium');
    await openFlight(page);
    await expect(page.locator('canvas')).toHaveCount(1);
    const geometry = await page.locator('.signature-experience').evaluate((root) => {
      const rect = root.getBoundingClientRect();
      return [rect.width, rect.height, window.innerWidth, window.innerHeight];
    });
    expect(geometry[0]).toBe(geometry[2]);
    expect(geometry[1]).toBe(geometry[3]);
    await moveToProgress(page, 0.36);
    await page.screenshot({ path: `${screenshotRoot}/m08-flight-mobile-412x892.png` });
  });

  test('keeps Reduced Motion static, readable, and RAF-free', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-16-pro-max-webkit');
    await page.goto('/?experience=reduced', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect.poll(() => page.evaluate(() => Boolean(window.__AFFLATUS_M08__))).toBe(true);
    await expect(page.locator('canvas')).toHaveCount(0);
    const metrics = await page.evaluate(() => window.__AFFLATUS_M08__.getMetrics());
    expect(metrics).toMatchObject({ activeRafOwners: 0, mainRafRunning: false, sceneFrames: 0 });
    await page.screenshot({ path: `${screenshotRoot}/m08-flight-reduced-440x956.png` });
  });
});
