// e2e/shared-header-prepaint.spec.js
// With scripting on, the shared header must paint in its final collapsed geometry before
// header-controller.js runs; otherwise it renders expanded and collapses (CLS on every route,
// and the page's first heading starts below the fold). Blocking every script freezes that
// pre-enhancement frame. With scripting off, the static header must still expose every link.
import { test, expect } from '@playwright/test';

const routes = ['/en/sectors.html', '/en/', '/en/portfolio.html', '/zh/course.html'];

async function frozenBeforeEnhancement(page, width, height, route) {
  await page.setViewportSize({ width, height });
  await page.route(/\.(m?js)(\?.*)?$/, (r) => r.abort());
  await page.goto(route);
  const header = page.locator('#afflatus-header');
  await expect(header).not.toHaveAttribute('data-enhanced', /.*/);
  return header;
}

for (const route of routes) {
  test(`phone: header is collapsed before its script runs on ${route}`, async ({ page }) => {
    const header = await frozenBeforeEnhancement(page, 412, 823, route);
    expect((await header.boundingBox()).height).toBeLessThanOrEqual(61);
    await expect(page.locator('#af-primary-nav')).toBeHidden();
    expect(await page.evaluate(() => getComputedStyle(document.body).paddingTop)).toBe('60px');
  });

  test(`desktop: header is 68px with closed menus before its script runs on ${route}`, async ({ page }) => {
    const header = await frozenBeforeEnhancement(page, 1440, 900, route);
    expect((await header.boundingBox()).height).toBeLessThanOrEqual(69);
    await expect(page.locator('#afflatus-header .af-header-dropdown').first()).toBeHidden();
    expect(await page.evaluate(() => getComputedStyle(document.body).paddingTop)).toBe('68px');
  });
}

test('without JavaScript the static header still exposes every destination', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 412, height: 823 } });
  const page = await context.newPage();
  await page.goto('/en/sectors.html');
  await expect(page.locator('#af-primary-nav')).toBeVisible();
  await expect(page.locator('#af-markets a').first()).toBeVisible();
  expect((await page.locator('#afflatus-header').boundingBox()).height).toBeGreaterThan(200);
  await context.close();
});
