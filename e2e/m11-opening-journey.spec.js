import { expect, test } from './site-fixture.js';

const screenshotRoot = 'docs/refactor/screenshots';

async function openHome(page) {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/?experience=cinematic', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(window.__AFFLATUS_M11__))).toBe(true);
  await expect(page.locator('.signature-experience')).toHaveAttribute('data-scene-status', 'ready');
}

test.describe('M11 opening journey', () => {
  test('starts editorially and replaces cards with three sequential system routes', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    await openHome(page);
    await expect(page.getByRole('button', { name: 'Enter Command' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Explore systems/ })).toBeVisible();
    await expect(page.locator('.system-card')).toHaveCount(0);
    await expect(page.locator('.system-route')).toHaveCount(3);
    await page.screenshot({ path: `${screenshotRoot}/m11-opening-desktop-1440x1000.png` });

    const software = page.locator('.system-route[data-system="software"] .editorial-link');
    await software.scrollIntoViewIfNeeded();
    const intent = await software.evaluate((element) => {
      element.focus();
      return document.querySelector('.signature-experience')?.dataset.sceneIntent;
    });
    expect(intent).toBe('system:software');
    await expect.poll(() => page.evaluate(() => window.__AFFLATUS_M11__.getMetrics().lastSceneSignal)).toBe('system:software');
  });

  test('keeps the approach cropped and scale-referenced on mobile', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'galaxy-s26-ultra-chromium');
    await openHome(page);
    await page.locator('[data-chapter="02-the-approach"]').scrollIntoViewIfNeeded();
    await expect(page.getByText('Approach vector / stable')).toBeVisible();
    const metrics = await page.evaluate(() => window.__AFFLATUS_M11__.getMetrics());
    expect(metrics.spaceLayers.scaleReferenceKinds.length).toBeGreaterThanOrEqual(3);
    await page.screenshot({ path: `${screenshotRoot}/m11-approach-mobile-412x892.png` });
  });

  test('keeps the opening readable and canvas-free in Reduced Motion', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-16-pro-max-webkit');
    await page.goto('/?experience=reduced', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
    await page.screenshot({ path: `${screenshotRoot}/m11-opening-reduced-440x956.png` });
  });
});
