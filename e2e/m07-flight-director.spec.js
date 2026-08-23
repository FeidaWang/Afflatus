import { expect, test } from './site-fixture.js';

const screenshotRoot = 'docs/refactor/screenshots';

async function openTimeline(page, path = '/?experience=cinematic') {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(window.__AFFLATUS_M07__))).toBe(true);
}

test.describe('M07 ScrollTimeline and FlightDirector', () => {
  test('maps rapid forward/backward scroll to finite chapter state', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    await openTimeline(page);
    const root = page.locator('.signature-experience');
    await expect(root).toHaveAttribute('data-scene-status', 'ready');
    await expect(root).toHaveAttribute('data-current-chapter', '01-cold-void');

    await page.evaluate(() => window.scrollTo({
      behavior: 'instant',
      left: 0,
      top: document.documentElement.scrollHeight,
    }));
    await expect(root).toHaveAttribute('data-current-chapter', '06-departure');
    const forward = await page.evaluate(() => ({
      flight: window.__AFFLATUS_M07__.getFlight(),
      timeline: window.__AFFLATUS_M07__.getTimeline(),
    }));
    expect(forward.timeline).toMatchObject({ chapterId: '06-departure', direction: 1, targetProgress: 1 });
    expect([
      ...forward.flight.cameraPosition,
      ...forward.flight.lookAt,
      forward.flight.fov,
      forward.flight.exposure,
      forward.flight.roll,
      forward.flight.progress,
    ].every(Number.isFinite)).toBe(true);

    await page.evaluate(() => window.scrollTo({ behavior: 'instant', left: 0, top: 0 }));
    await expect(root).toHaveAttribute('data-current-chapter', '01-cold-void');
    const backward = await page.evaluate(() => window.__AFFLATUS_M07__.getTimeline());
    expect(backward).toMatchObject({ chapterId: '01-cold-void', direction: -1, targetProgress: 0 });
    expect(Number.isFinite(backward.progress)).toBe(true);
    await page.screenshot({ path: `${screenshotRoot}/m07-flight-desktop-1440x1000.png` });
  });

  test('keeps anchor, Back/Forward, and keyboard scrolling native', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    await openTimeline(page, '/?experience=cinematic#top');
    const root = page.locator('.signature-experience');

    await page.getByRole('link', { name: 'Explore systems' }).click();
    await expect(page).toHaveURL(/#chapter-03-title$/);
    await expect(root).toHaveAttribute('data-current-chapter', '03-parallel-drift');
    await page.goBack();
    await expect(page).toHaveURL(/experience=cinematic#top$/);
    await expect(root).toHaveAttribute('data-current-chapter', '01-cold-void');

    await page.evaluate(() => {
      history.pushState({ m07: 'approach' }, '', '#chapter-02-title');
      document.getElementById('chapter-02-title').scrollIntoView({ behavior: 'instant' });
    });
    await expect(root).toHaveAttribute('data-current-chapter', '02-the-approach');
    await page.goBack();
    await expect(page).toHaveURL(/experience=cinematic#top$/);
    await expect(root).toHaveAttribute('data-current-chapter', '01-cold-void');
    await page.goForward();
    await expect(page).toHaveURL(/#chapter-02-title$/);
    const restored = await page.evaluate(() => ({
      chapterId: document.querySelector('.signature-experience').dataset.currentChapter,
      scrollY: window.scrollY,
      timeline: window.__AFFLATUS_M07__.getTimeline(),
    }));
    expect(restored.chapterId).toBe(restored.timeline.chapterId);
    expect(restored.timeline.targetProgress).toBeGreaterThanOrEqual(0);
    expect(restored.timeline.targetProgress).toBeLessThanOrEqual(1);
    expect(Number.isFinite(restored.scrollY)).toBe(true);

    await page.evaluate(() => window.scrollTo({ behavior: 'instant', left: 0, top: 0 }));
    const before = await page.evaluate(() => window.scrollY);
    await page.keyboard.press('PageDown');
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
  });

  test('runs one main RAF without React frame-by-frame renders', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    await openTimeline(page);
    await expect(page.locator('.signature-experience')).toHaveAttribute('data-scene-status', 'ready');
    await page.waitForTimeout(250);
    const before = await page.evaluate(() => window.__AFFLATUS_M07__.getMetrics());
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => window.__AFFLATUS_M07__.getMetrics());
    expect(before).toMatchObject({ activeRafOwners: 1, mainRafRunning: true });
    expect(after.sceneFrames).toBeGreaterThan(before.sceneFrames);
    expect(after.sceneRenders).toBeGreaterThan(before.sceneRenders);
    expect(after.reactRenders).toBe(before.reactRenders);
    expect(after.timeline).toEqual({ destroyed: false, listenerCount: 5 });
  });

  test('cleans the old RAF and Timeline when context loss remounts the route', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    await openTimeline(page);
    await expect(page.locator('.signature-experience')).toHaveAttribute('data-scene-status', 'ready');
    await page.evaluate(() => { window.__m07UnmountedExperience = window.__AFFLATUS_M07__; });
    await page.locator('canvas').dispatchEvent('webglcontextlost', { cancelable: true });
    await expect(page.locator('html')).toHaveAttribute('data-experience-mode', 'static');
    await expect(page.locator('canvas')).toHaveCount(0);
    const oldMetrics = await page.evaluate(() => window.__m07UnmountedExperience.getMetrics());
    expect(oldMetrics).toMatchObject({
      activeRafOwners: 0,
      mainRafRunning: false,
      timeline: { destroyed: true, listenerCount: 0 },
    });
  });

  test('keeps readonly chapter state alive on the static path without a RAF', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    await openTimeline(page, '/?experience=static');
    const root = page.locator('.signature-experience');
    await expect(root).toHaveAttribute('data-quality-profile', 'static');
    await expect(page.locator('canvas')).toHaveCount(0);
    await page.getByRole('link', { name: 'Explore systems' }).click();
    await expect(root).toHaveAttribute('data-current-chapter', '03-parallel-drift');
    const metrics = await page.evaluate(() => window.__AFFLATUS_M07__.getMetrics());
    expect(metrics).toMatchObject({ activeRafOwners: 0, mainRafRunning: false, sceneFrames: 0 });
  });
});

test.describe('M07 cross-device evidence', () => {
  test('keeps the mobile Timeline on the same one-canvas path', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'galaxy-s26-ultra-chromium');
    await openTimeline(page);
    await expect(page.locator('.signature-experience')).toHaveAttribute('data-quality-profile', 'mobile');
    await expect(page.locator('canvas')).toHaveCount(1);
    await page.screenshot({ path: `${screenshotRoot}/m07-flight-mobile-412x892.png` });
  });

  test('keeps reduced motion readable and RAF-free', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-16-pro-max-webkit');
    await page.goto('/?experience=reduced', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect.poll(() => page.evaluate(() => Boolean(window.__AFFLATUS_M07__))).toBe(true);
    await expect(page.locator('canvas')).toHaveCount(0);
    const metrics = await page.evaluate(() => window.__AFFLATUS_M07__.getMetrics());
    expect(metrics).toMatchObject({ activeRafOwners: 0, mainRafRunning: false, sceneFrames: 0 });
    await page.screenshot({ path: `${screenshotRoot}/m07-flight-reduced-440x956.png` });
  });
});
