import { expect, test } from './site-fixture.js';

async function openAnimated(page) {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/?experience=cinematic', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean(window.__AFFLATUS_M13__))).toBe(true);
  await expect(page.locator('.signature-experience')).toHaveAttribute('data-scene-status', 'ready');
}

test.describe('M13 quality and resource governance', () => {
  test('runs the high profile and degrades resources in the authored order', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    await openAnimated(page);
    await expect(page.locator('.signature-experience')).toHaveAttribute('data-quality-profile', 'high');
    const baseline = await page.evaluate(() => window.__AFFLATUS_M13__.getMetrics());
    expect(baseline.resourceProfile).toMatchObject({ carrierLod: 'full', bloom: true, surfaceTextures: 'ktx2-basis' });
    expect(baseline.resources.triangles).toBeGreaterThan(4_000);
    expect(baseline.resources.instances).toBeGreaterThan(20);
    await expect.poll(
      () => page.evaluate(() => window.__AFFLATUS_M13__.getMetrics().surfaceTextures),
      { timeout: 8_000 },
    ).toBe('ktx2-basis');
    await expect.poll(
      () => page.evaluate(() => window.__AFFLATUS_M13__.getMetrics().resources.textures),
    ).toBeGreaterThanOrEqual(4);

    await page.evaluate(() => {
      const api = window.__AFFLATUS_M13__;
      const base = performance.now();
      for (let index = 0; index < 24; index += 1) api.samplePerformance(30, base);
      api.samplePerformance(30, base + 2_000);
      for (let index = 0; index < 24; index += 1) api.samplePerformance(30, base + 2_100);
      api.samplePerformance(30, base + 7_000);
    });
    await expect.poll(() => page.evaluate(() => window.__AFFLATUS_M13__.getMetrics().qualityGovernor.degradationLevel)).toBe(2);
    const degraded = await page.evaluate(() => window.__AFFLATUS_M13__.getMetrics().qualityGovernor);
    expect(degraded.dpr).toBeLessThan(baseline.qualityGovernor.dpr);
    expect(degraded.dustEnabled).toBe(false);
    expect(degraded.bloomEnabled).toBe(true);
  });

  test('restores a briefly lost context without creating a second canvas', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    await openAnimated(page);
    const canvas = page.locator('canvas');
    await canvas.dispatchEvent('webglcontextlost', { cancelable: true });
    await expect(page.locator('.signature-scene')).toHaveAttribute('data-raf', 'paused');
    await canvas.dispatchEvent('webglcontextrestored');
    await expect(page.locator('.signature-experience')).toHaveAttribute('data-scene-status', 'ready');
    await expect(page.locator('canvas')).toHaveCount(1);
  });

  test('uses mobile and static matrices without visual resource leakage', async ({ page }, testInfo) => {
    if (testInfo.project.name === 'galaxy-s26-ultra-chromium') {
      await openAnimated(page);
      await expect(page.locator('.signature-experience')).toHaveAttribute('data-quality-profile', 'mobile');
      const metrics = await page.evaluate(() => window.__AFFLATUS_M13__.getMetrics());
      expect(metrics.resourceProfile).toMatchObject({ carrierLod: 'reduced', bloom: false, surfaceTextures: 'none' });
      return;
    }
    if (testInfo.project.name === 'iphone-16-pro-max-webkit') {
      await page.goto('/?experience=static', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.signature-experience')).toHaveAttribute('data-quality-profile', 'static');
      await expect(page.locator('canvas')).toHaveCount(0);
      return;
    }
    test.skip();
  });
});
