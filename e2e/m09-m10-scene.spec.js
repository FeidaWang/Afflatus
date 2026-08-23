import { expect, test } from './site-fixture.js';

const screenshotRoot = 'docs/refactor/screenshots';

async function openScene(page) {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/?experience=cinematic', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean(window.__AFFLATUS_M10__))).toBe(true);
  await expect(page.locator('.signature-experience')).toHaveAttribute('data-scene-status', 'ready');
}

async function moveToProgress(page, progress) {
  await page.evaluate((value) => {
    const distance = document.documentElement.scrollHeight - innerHeight;
    scrollTo({ top: distance * value, behavior: 'instant' });
  }, progress);
  await expect.poll(() => page.evaluate(() => window.__AFFLATUS_M10__.getFlight().progress)).toBeCloseTo(progress, 2);
}

async function isolateCanvas(page) {
  await page.addStyleTag({
    content: '.site-root > section, .site-root > main, .site-root > footer { visibility: hidden !important; }',
  });
}

test.describe('M09 scale and M10 cinematic rendering', () => {
  test('renders five degradable layers and scale without textual explanation', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    await openScene(page);
    const metrics = await page.evaluate(() => window.__AFFLATUS_M10__.getMetrics());
    expect(metrics.spaceLayers.enabledLayers).toEqual([
      'deep-stars',
      'distant-environment',
      'midfield-dust',
      'near-field-scale-references',
      'carrier',
    ]);
    expect(metrics.spaceLayers.scaleReferenceKinds.length).toBeGreaterThanOrEqual(3);
    expect(metrics.spaceLayers.majorDistantBodies).toBe(1);
    expect(metrics.spaceLayers.instancedReferenceCount).toBeGreaterThan(40);
    await moveToProgress(page, 0.38);
    await isolateCanvas(page);
    await page.screenshot({ path: `${screenshotRoot}/m09-scale-without-text-desktop-1440x1000.png` });
  });

  test('uses selective engine bloom only on the high cinematic profile', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    await openScene(page);
    const high = await page.evaluate(() => window.__AFFLATUS_M10__.getMetrics());
    expect(high.postProcessing).toMatchObject({ selectiveBloom: true });
    expect(high.postProcessing.bloomObjects).toBeGreaterThanOrEqual(3);
    await moveToProgress(page, 0.86);
    await isolateCanvas(page);
    await page.screenshot({ path: `${screenshotRoot}/m10-engine-lighting-desktop-1440x1000.png` });

    await page.setViewportSize({ width: 1000, height: 800 });
    await expect(page.locator('.signature-experience')).toHaveAttribute('data-quality-profile', 'medium');
    await expect.poll(() => page.evaluate(() => window.__AFFLATUS_M10__.getMetrics().postProcessing?.selectiveBloom)).toBe(false);
  });
});
