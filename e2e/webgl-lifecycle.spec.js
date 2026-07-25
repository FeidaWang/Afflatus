import { expect, test } from './site-fixture.js';

test('Boot WebGL restores once and falls back after a repeated context loss', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Context-loss extension gate runs in Chromium.');

  await page.addInitScript(() => {
    sessionStorage.removeItem('afflatus:webgl-losses:v1');
  });
  await page.goto('/boot.html?p2demo=armor', { waitUntil: 'domcontentloaded' });

  const canvas = page.locator('#bridgeCanvas');
  await expect(canvas).toHaveAttribute('data-renderer', 'webgl');

  const extensionAvailable = await page.evaluate(() => {
    const target = document.querySelector('#bridgeCanvas');
    const gl = target?.getContext('webgl2') || target?.getContext('webgl');
    const extension = gl?.getExtension('WEBGL_lose_context');
    window.__afflatusLoseContext = extension;
    return Boolean(extension);
  });
  test.skip(!extensionAvailable, 'Browser does not expose WEBGL_lose_context.');

  await page.evaluate(() => window.__afflatusLoseContext.loseContext());
  await expect(canvas).toHaveAttribute('data-renderer', 'lost');

  await page.evaluate(() => window.__afflatusLoseContext.restoreContext());
  await expect(canvas).toHaveAttribute('data-renderer', 'webgl');

  await page.evaluate(() => window.__afflatusLoseContext.loseContext());
  await expect(canvas).toHaveAttribute('data-renderer', 'poster');
  await expect(page.locator('.webgl-fallback[data-webgl-surface="boot:armor-demo"]')).toBeVisible();
  await expect(page.locator('.webgl-fallback button')).toHaveAccessibleName('Enable interactive scene');
});
