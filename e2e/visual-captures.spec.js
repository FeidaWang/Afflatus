import { SITE_MANIFEST } from '../src/config/siteManifest.js';
import { expect, settlePage, test } from './site-fixture.js';

const activeRoutes = SITE_MANIFEST.filter((route) => route.status === 'active');
const captureRoutes = [
  ...activeRoutes.filter((route) => route.id === 'portfolio'),
  ...activeRoutes.filter((route) => route.id !== 'portfolio'),
];
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function capturePath(route) {
  // The portfolio's production default owns a long-lived WebGL combat scene.
  // Visual-capture tests exercise document layout, so keep that route on its
  // deterministic, low-resource renderer and avoid exhausting Chromium's
  // screenshot surface late in the serial route sweep.
  return route.id === 'portfolio' ? `${route.path}?combatview=2d` : route.path;
}

async function capture(page, testInfo, routeId, name) {
  let image;
  const viewport = page.viewportSize();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      image = await page.screenshot({
        caret: 'hide',
        fullPage: false,
        scale: 'css',
      });
      break;
    } catch (error) {
      if (attempt > 1 || !String(error).includes('Unable to capture screenshot')) throw error;
      await page.waitForTimeout(150);
    }
  }

  expect(image.subarray(0, PNG_SIGNATURE.length)).toEqual(PNG_SIGNATURE);
  expect(image.byteLength, `${routeId}/${name} must contain PNG image data`).toBeGreaterThan(1_000);
  expect(image.readUInt32BE(16), `${routeId}/${name} must preserve viewport width`).toBe(viewport.width);
  expect(image.readUInt32BE(20), `${routeId}/${name} must preserve viewport height`).toBe(viewport.height);
  await testInfo.attach(`${routeId}-${name}.png`, {
    body: image,
    contentType: 'image/png',
  });
}

test('active routes emit deterministic top and main viewport captures', async ({ page }, testInfo) => {
  for (const route of captureRoutes) {
    await test.step(route.id, async () => {
      await page.goto(capturePath(route), { waitUntil: 'domcontentloaded' });
      await settlePage(page);
      await page.addStyleTag({
        content: 'canvas, video, iframe { visibility: hidden !important; }',
      });
      await capture(page, testInfo, route.id, 'top');

      await page.evaluate(() => {
        const viewportHeight = window.visualViewport?.height || window.innerHeight;
        const maxScroll = Math.max(0, document.documentElement.scrollHeight - viewportHeight);
        window.scrollTo(0, Math.min(maxScroll, Math.round(viewportHeight * 0.82)));
      });
      await page.waitForTimeout(50);
      await capture(page, testInfo, route.id, 'main');
    });
  }
});
