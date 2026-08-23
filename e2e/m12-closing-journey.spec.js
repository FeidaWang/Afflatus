import { expect, test } from './site-fixture.js';

const screenshotRoot = 'docs/refactor/screenshots';

async function openHome(page) {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/?experience=cinematic', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean(window.__AFFLATUS_M12__))).toBe(true);
  await expect(page.locator('.signature-experience')).toHaveAttribute('data-scene-status', 'ready');
}

async function moveToProgress(page, progress) {
  await page.evaluate((value) => {
    const distance = document.documentElement.scrollHeight - innerHeight;
    scrollTo({ top: distance * value, behavior: 'instant' });
  }, progress);
  await expect.poll(() => page.evaluate(() => window.__AFFLATUS_M12__.getFlight().progress)).toBeCloseTo(progress, 2);
}

test.describe('M12 closing journey', () => {
  test('uses one bridge signal, three transmissions and an engine wake', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    await openHome(page);
    const bridge = page.locator('[data-chapter="04-bridge-aperture"]');
    await expect(bridge.locator('.signal-context')).toHaveCount(1);
    await expect(bridge.locator('.transmission-row')).toHaveCount(3);
    await moveToProgress(page, 0.58);
    await page.screenshot({ path: `${screenshotRoot}/m12-bridge-desktop-1440x1000.png` });
    await moveToProgress(page, 0.78);
    const wake = await page.evaluate(() => {
      const metrics = window.__AFFLATUS_M12__.getMetrics();
      return {
        dustEnabled: metrics.qualityGovernor.dustEnabled,
        dustOpacity: metrics.layerState?.dustOpacity,
        profileDust: metrics.resourceProfile.dust,
      };
    });
    expect(wake.profileDust).toBe(true);
    if (wake.dustEnabled) expect(wake.dustOpacity).toBeGreaterThan(0);
    else expect(wake.dustOpacity).toBe(0);
    await page.screenshot({ path: `${screenshotRoot}/m12-wake-desktop-1440x1000.png` });
  });

  test('lands on a stable manifesto and one nominal footer status', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    await openHome(page);
    await moveToProgress(page, 1);
    await expect(page.locator('.manifesto-command')).toHaveAttribute('href', '/en/command/');
    await expect(page.locator('.nominal-status')).toHaveCount(1);
    const before = await page.evaluate(() => window.__AFFLATUS_M12__.getFlight().cameraPosition);
    await page.waitForTimeout(350);
    const after = await page.evaluate(() => window.__AFFLATUS_M12__.getFlight().cameraPosition);
    expect(after).toEqual(before);
    const scrollRatio = await page.evaluate(() => document.documentElement.scrollHeight / innerHeight);
    expect(scrollRatio).toBeGreaterThanOrEqual(4.8);
    expect(scrollRatio).toBeLessThanOrEqual(5.65);
    await page.screenshot({ path: `${screenshotRoot}/m12-departure-desktop-1440x1000.png` });
  });
});
