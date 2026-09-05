import { test, expect } from '@playwright/test';

// Run against a localized build. Runtime ownership is inspected through the
// existing coordinator on the Vite dev URL, without adding a production API.
const devURL = process.env.ASTRA_DEV_URL;
const values = ['41.4%', '0.85', '−22%', '1.85'];

test('financial values and full labels survive narrow layouts and reflow', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [320, 390, 768, 1280, 640]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/en/portfolio.html');
    await expect(page.locator('.strip-value')).toHaveText(values);
    await page.locator('#scrollHint').click();
    const clipped = await page.locator('.core-telemetry-note, .strip-foot, .strip-label').evaluateAll(nodes => nodes.filter(el => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1).map(el => el.textContent));
    expect(clipped).toEqual([]);
    await expect(page.locator('#cicCruiseStrip')).toBeHidden();
    expect(await page.locator('.hero-desc').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  }
  expect(errors).toEqual([]);
});

test('native menu supports keyboard, locale routes and Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/en/portfolio.html?sample=1#fy2026Performance');
  await page.locator('#portfolioMenu summary').press('Enter');
  await expect(page.locator('#portfolioMenu')).toHaveAttribute('open', '');
  await expect(page.locator('#portfolioMenu a[href="/zh/serial.html"]')).toBeVisible();
  await expect(page.locator('#portfolioMenu a')).toHaveCount(8);
  await expect(page.locator('#langMiniToggle')).toHaveAttribute('href', '/zh/portfolio.html?sample=1#fy2026Performance');
  await page.keyboard.press('Escape');
  await expect(page.locator('#portfolioMenu summary')).toBeFocused();
  await expect(page.locator('#portfolioMenu')).not.toHaveAttribute('open');
});

test('no JavaScript still has readable data and native site navigation', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${baseURL}/zh/portfolio.html`);
  await expect(page.locator('.strip-value')).toHaveText(values);
  await page.locator('#portfolioMenu summary').click();
  await expect(page.locator('#portfolioMenu a[href="/zh/serial.html"]')).toBeVisible();
  await page.locator('#portfolioMenu a[href="/zh/course.html"]').click();
  await expect(page).toHaveURL(/\/zh\/course.html$/);
  await context.close();
});

test('failed enhancement keeps reading, navigation and truthful numbers', async ({ page }) => {
  await page.route('**/assets/homeExperience-*.js', route => route.abort());
  await page.goto('/en/portfolio.html');
  await page.locator('#heroCommandCta').click();
  await expect(page.locator('#heroCommandCta')).toContainText('unavailable');
  await expect(page.locator('body')).toHaveClass(/hud-off/);
  await expect(page.locator('.strip-value')).toHaveText(values);
  await page.locator('#scrollHint').click();
  await expect(page).toHaveURL(/#fy2026Performance$/);
});

test('command uses the existing budget and restores reading position and focus', async ({ page }) => {
  test.skip(!devURL, 'Set ASTRA_DEV_URL to the running Vite dev server for coordinator inspection.');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1280, height: 844 });
  await page.goto(`${devURL}/portfolio.html?lang=en`);
  await page.mouse.wheel(0, 260);
  await page.waitForTimeout(300);
  const previousY = await page.evaluate(() => scrollY);
  await page.locator('#heroCommandCta').click();
  await expect(page.locator('body')).not.toHaveClass(/hud-off/);
  const telemetry = () => page.evaluate(async () => (await import(performance.getEntriesByType('resource').find(entry => entry.name.includes('/src/lib/renderBudgetCoordinator.js')).name)).getRenderBudgetCoordinator().getTelemetry());
  await expect.poll(async () => (await telemetry()).surfaces.find(s => s.id === 'home:master')?.active).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).toHaveClass(/hud-off/);
  await expect(page.locator('#heroCommandCta')).toBeFocused();
  expect(Math.abs(await page.evaluate(() => scrollY) - previousY)).toBeLessThan(3);
  await expect.poll(async () => (await telemetry()).surfaces.filter(s => s.id === 'home:master' || s.id.startsWith('home:background')).every(s => !s.active)).toBe(true);
  // A frozen/restored page must keep explicit pause state, without extra registrations.
  const ids = (await telemetry()).surfaces.map(s => s.id);
  await page.evaluate(() => { dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })); dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); });
  const restoredIds = (await telemetry()).surfaces.map(s => s.id);
  // Unrelated lazy sections may finish loading during restoration. Existing
  // owners must survive exactly once, and newly loaded owners cannot duplicate.
  expect(new Set(restoredIds).size).toBe(restoredIds.length);
  for (const id of ids) expect(restoredIds.filter(value => value === id)).toHaveLength(1);
  expect((await telemetry()).surfaces.find(s => s.id === 'home:master').active).toBe(false);
  await page.locator('#heroCommandCta').click();
  await page.mouse.wheel(0, 1800);
  await expect.poll(async () => (await telemetry()).surfaces.find(s => s.id === 'home:master')?.active).toBe(false);
});

test('reduced motion and WebGL failure retain the portfolio list', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) { return type.includes('webgl') ? null : getContext.call(this, type, ...args); };
  });
  await page.goto('/en/portfolio.html');
  await page.locator('#portfolioConvoy').scrollIntoViewIfNeeded();
  await expect(page.locator('#portfolioConvoy')).toContainText('NVDA');
  await expect(page.locator('.strip-value')).toHaveText(values);
  await expect(page.locator('#blackhole-gl')).not.toHaveAttribute('src');
  await expect(page.locator('#cicCruiseStrip')).toBeHidden();
});
