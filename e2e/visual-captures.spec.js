import { SITE_MANIFEST } from '../src/config/siteManifest.js';
import { expect, settlePage, test } from './site-fixture.js';

const activeRoutes = SITE_MANIFEST.filter((route) => route.status === 'active');
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// Chromium's capture protocol is not reliable when two pages request a
// screenshot in the same instant. Route capture is inexpensive, so serialize
// this file while keeping smoke/keyboard tests parallel.
test.describe.configure({ mode: 'serial' });

async function capture(page, testInfo, routeId, name) {
  let image;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      image = await page.screenshot({
        animations: 'disabled',
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
  expect(image.byteLength, `${routeId}/${name} must contain a rendered viewport`).toBeGreaterThan(8_000);
  await testInfo.attach(`${routeId}-${name}.png`, {
    body: image,
    contentType: 'image/png',
  });
}

for (const route of activeRoutes) {
  test(`${route.id} emits two deterministic viewport captures`, async ({ page }, testInfo) => {
    await page.goto(route.path, { waitUntil: 'domcontentloaded' });
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
