import { expect, test } from '@playwright/test';

const languageSwitch = (page) => page.locator('#afflatus-header [data-header-language]');
const groupTriggers = (page) => page.locator('#afflatus-header [data-header-disclosure][aria-controls^="af-"]:not(.af-header-menu) .af-nav-label');

test('home navigation follows the fixed and interactive locale', async ({ page }) => {
  await page.goto('/zh/', { waitUntil: 'domcontentloaded' });
  await expect(groupTriggers(page)).toHaveText(['市场', '更多']);

  await page.goto('/en/', { waitUntil: 'domcontentloaded' });
  await expect(groupTriggers(page)).toHaveText(['Markets', 'More']);

  // Fixed-locale pages do not own the adaptive preference. Seed the state
  // explicitly so this assertion never depends on a previous navigation.
  await page.evaluate(() => localStorage.setItem('afflatus:locale:v1', 'en'));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await Promise.all([
    page.waitForURL(/\/zh\/$/),
    languageSwitch(page).click(),
  ]);
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(groupTriggers(page)).toHaveText(['市场', '更多']);
});

test('home fixed-locale switch preserves query and hash state', async ({ page }) => {
  await page.goto('/en/?q=1#major-releases', { waitUntil: 'domcontentloaded' });
  await expect(languageSwitch(page)).toHaveAttribute('href', '/zh/?q=1#major-releases');
  await Promise.all([
    page.waitForURL(/\/zh\/\?q=1#major-releases$/),
    languageSwitch(page).click(),
  ]);
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
});

test('adaptive root honours a stored Chinese locale and offers English back', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('afflatus:locale:v1', 'zh');
  });
  await page.goto('/?q=1#major-releases', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  const switcher = languageSwitch(page);
  await expect(switcher).toHaveText('EN');
  await expect(switcher).toHaveAttribute('href', '/en/?q=1#major-releases');
  await expect(switcher).toHaveAttribute('aria-label', /English|英文/);
  await expect(page.locator('#home-title')).toContainText('从这颗星球');
  await expect(page.getByRole('link', { name: '探索作品', exact: true })).toHaveAttribute('href', '/zh/portfolio.html');
});

test('primary navigation replaces duplicate linear page-turn controls', async ({ page }) => {
  for (const path of ['/en/', '/en/arena.html', '/en/horoscope.html', '/en/course.html']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.page-turn-controls, .route-arrows')).toHaveCount(0);
    await expect(page.locator('body')).not.toHaveAttribute('data-prev');
    await expect(page.locator('body')).not.toHaveAttribute('data-next');
    await expect(page.locator('#af-primary-nav a[href="/zh/serial.html"]')).toHaveCount(1);
  }

  const currentUrl = page.url();
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(currentUrl);
});

test('fixed-locale switching keeps the reader in the current section', async ({ page }) => {
  await page.goto('/en/course.html#curriculum', { waitUntil: 'domcontentloaded' });
  await languageSwitch(page).click();
  await expect(page).toHaveURL(/\/zh\/course\.html#curriculum$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect.poll(() => page.locator('#curriculum').evaluate((section) => Math.round(section.getBoundingClientRect().top)))
    .toBeLessThan(180);
});

test('desktop pointer click toggles a Markets menu that hover opened', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop pointer interaction');
  await page.goto('/en/course.html', { waitUntil: 'domcontentloaded' });

  const trigger = page.locator('#afflatus-header [data-header-disclosure][aria-controls="af-markets"]');
  await trigger.hover();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');

  // Current product behaviour: a click after hover-open toggles the menu.
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');

  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
});
