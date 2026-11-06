// The compact menu is a dark full screen with five groups and a "Latest" carousel.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './site-fixture.js';

const WHITE = 'rgb(250, 249, 245)';
const GREY = 'rgb(143, 141, 133)';
const ROUTES = ['/en/', '/en/portfolio.html', '/en/arena.html', '/en/signal.html', '/en/sectors.html', '/en/course.html', '/en/horoscope.html', '/en/worlds.html', '/en/about.html', '/en/search.html', '/zh/serial.html', '/zh/'];

const menuButton = (page) => page.locator('#afflatus-header .af-header-menu');
const nav = (page) => page.locator('#af-primary-nav');
const color = (locator) => locator.evaluate((node) => getComputedStyle(node).color);

async function openMenu(page, path) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(path, { waitUntil: 'load' });
  await menuButton(page).click();
  await expect(menuButton(page)).toHaveAttribute('aria-expanded', 'true');
}

test.describe('compact menu', () => {
  for (const path of ROUTES) {
    test(`covers the screen with no sideways scroll on ${path}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(path, { waitUntil: 'load' });
      // Portfolio's finale note runs 0.5px past the edge in WebKit with or without the menu.
      const closedWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      await menuButton(page).click();
      await expect(page.locator('.af-menu-latest')).toBeVisible();
      const box = await nav(page).boundingBox();
      expect(box).toMatchObject({ x: 0, y: 60, width: 390, height: 784 });
      const state = await page.evaluate(() => ({
        header: getComputedStyle(document.querySelector('#afflatus-header')).backgroundColor,
        panel: getComputedStyle(document.querySelector('#af-primary-nav')).backgroundColor,
        overflow: getComputedStyle(document.documentElement).overflow,
        wide: document.documentElement.scrollWidth,
        navWide: document.querySelector('#af-primary-nav').scrollWidth,
      }));
      expect(state).toMatchObject({ header: 'rgb(20, 20, 19)', panel: 'rgb(20, 20, 19)', overflow: 'hidden' });
      expect(state.wide).toBeLessThanOrEqual(Math.max(390, closedWidth));
      expect(state.navWide).toBeLessThanOrEqual(390);
      await menuButton(page).click();
      await expect(nav(page)).toBeHidden();
      await expect(page.locator('html')).not.toHaveAttribute('data-af-menu-open');
    });
  }

  test('shows five grey groups on the homepage', async ({ page }) => {
    await openMenu(page, '/en/');
    const labels = nav(page).locator(':scope > a .af-nav-label, :scope > .af-header-group > button .af-nav-label');
    await expect(labels).toHaveText(['Analysis', 'Courses', 'Serials', 'Labs', 'About']);
    for (const name of ['Courses', 'About']) await expect.poll(() => color(nav(page).getByRole('link', { name, exact: true }))).toBe(GREY);
    await expect.poll(() => color(page.locator('[aria-controls="af-analysis"]'))).toBe(GREY);
    await expect(page.locator('#af-analysis')).toBeHidden();
  });

  test('opens on the current group with the current page in white', async ({ page }) => {
    await openMenu(page, '/en/portfolio.html');
    await expect(page.locator('#af-analysis')).toBeVisible();
    await expect.poll(() => color(page.locator('[aria-controls="af-analysis"]'))).toBe(WHITE);
    await expect.poll(() => color(page.locator('#af-analysis a[aria-current="page"]'))).toBe(WHITE);
    await expect.poll(() => color(page.locator('#af-analysis a').nth(1))).toBe(GREY);
    await expect.poll(() => color(page.locator('[aria-controls="af-labs"]'))).toBe(GREY);
  });

  test('marks a single-link group in white, in Chinese too', async ({ page }) => {
    await openMenu(page, '/zh/course.html');
    await expect(nav(page).locator(':scope > a[aria-current="page"] .af-nav-label')).toHaveText('课程');
    await expect.poll(() => color(nav(page).locator(':scope > a[aria-current="page"]'))).toBe(WHITE);
  });

  test('opens one group at a time', async ({ page }) => {
    await openMenu(page, '/en/');
    await page.locator('[aria-controls="af-analysis"]').click();
    await expect(page.locator('#af-analysis a')).toHaveCount(5);
    await expect(page.locator('#af-analysis')).toBeVisible();
    await page.locator('[aria-controls="af-labs"]').click();
    await expect(page.locator('#af-labs')).toBeVisible();
    await expect(page.locator('#af-analysis')).toBeHidden();
    await expect(page.locator('[aria-controls="af-analysis"]')).toHaveAttribute('aria-expanded', 'false');
    await page.locator('[aria-controls="af-labs"]').click();
    await expect(page.locator('#af-labs')).toBeHidden();
    await expect(nav(page)).toBeVisible();
  });

  test('stays open when its background is tapped', async ({ page }) => {
    await openMenu(page, '/en/');
    await page.mouse.click(300, 300);
    await expect(nav(page)).toBeVisible();
    await expect(menuButton(page)).toHaveAttribute('aria-expanded', 'true');
  });

  test('hides the page from the keyboard, closes on Escape and returns focus to the button', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en/portfolio.html', { waitUntil: 'load' });
    const button = menuButton(page);
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('[aria-controls="af-analysis"]')).toBeFocused();
    await expect(page.locator('main').first()).toBeHidden();
    await expect(page.locator('.af-menu-latest')).toBeVisible();

    // Tab never reaches the page behind. WebKit's default skips links and buttons, leaving focus on the body.
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement.closest('body > :not(#afflatus-header)')))).toBe(false);
    const pageLinksHidden = await page.evaluate(() => [...document.querySelectorAll('body > :not(#afflatus-header) a[href]')].every((link) => getComputedStyle(link).visibility === 'hidden'));
    expect(pageLinksHidden).toBe(true);

    await page.keyboard.press('Escape');
    await expect(nav(page)).toBeHidden();
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('passes axe while open', async ({ page }) => {
    await openMenu(page, '/en/portfolio.html');
    await expect(page.locator('.af-menu-latest')).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).include('#afflatus-header').analyze();
    expect(violations.filter(({ impact }) => ['serious', 'critical'].includes(impact)).map(({ id }) => id)).toEqual([]);
  });

  test('closes when the viewport grows to the desktop header', async ({ page }) => {
    await openMenu(page, '/en/');
    await page.setViewportSize({ width: 1200, height: 844 });
    await expect(page.locator('[aria-controls="af-primary-nav"]')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('main').first()).toBeVisible();
    await expect(nav(page)).toBeVisible();
    await expect(page.locator('#af-analysis')).toBeHidden();
    await expect(page.locator('[aria-controls="af-primary-nav"]')).toBeHidden();
  });
});

test.describe('Latest carousel', () => {
  test('loads only when the menu first opens', async ({ page }) => {
    const requests = [];
    page.on('request', (request) => { if (/menu-latest|compact-menu/.test(request.url())) requests.push(new URL(request.url()).pathname); });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en/', { waitUntil: 'load' });
    expect(requests).toEqual([]);
    await menuButton(page).click();
    await expect(page.locator('.af-menu-latest-card')).toHaveCount(3);
    expect(requests.sort()).toEqual(['/lib/compact-menu.js', '/menu-latest.json']);
    await menuButton(page).click();
    await menuButton(page).click();
    await expect(page.locator('.af-menu-latest')).toHaveCount(1);
    expect(requests).toHaveLength(2);
  });

  test('pages through the homepage cards and wraps at both ends', async ({ page }) => {
    await openMenu(page, '/en/');
    const count = page.locator('.af-menu-latest-count');
    await expect(count).toHaveText('01 / 03');
    const next = page.getByRole('button', { name: 'Next card' });
    const previous = page.getByRole('button', { name: 'Previous card' });
    await next.click();
    await expect(count).toHaveText('02 / 03');
    await next.click();
    await expect(count).toHaveText('03 / 03');
    await next.click();
    await expect(count).toHaveText('01 / 03');
    await previous.click();
    await expect(count).toHaveText('03 / 03');
    const homeTitles = await page.locator('.home-latest .home-card h3').allTextContents();
    await expect(page.locator('.af-menu-latest-title')).toHaveText(homeTitles);
    await expect(page.locator('.af-menu-latest-card').first()).toHaveAttribute('href', '/en/sectors.html');
  });

  test('uses Chinese copy and links on Chinese pages', async ({ page }) => {
    await openMenu(page, '/zh/');
    await expect(page.locator('.af-menu-latest-meta').first()).toContainText('AI 观察站');
    await expect(page.locator('.af-menu-latest-card').nth(1)).toHaveAttribute('href', '/zh/signal.html');
    await expect(page.getByRole('button', { name: '下一张' })).toBeVisible();
    await expect(page.locator('.af-menu-latest')).toHaveAttribute('aria-label', '最新');
  });

  test('leaves a working menu when its data cannot load', async ({ page }) => {
    await page.route('**/menu-latest.json', (route) => route.abort('aborted'));
    await openMenu(page, '/en/');
    await expect(nav(page).getByRole('link', { name: 'About', exact: true })).toBeVisible();
    await expect(page.locator('.af-menu-latest')).toHaveCount(0);
  });
});

test.describe('without scripts', () => {
  test('the phone header is still a plain list of every destination', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto('/en/');
    await expect(page.locator('#af-labs a').first()).toBeVisible();
    await expect(page.locator('#afflatus-header .af-header-menu')).toBeHidden();
    await context.close();
  });
});
