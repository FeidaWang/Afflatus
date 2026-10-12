import { expect, settlePage, test } from './site-fixture.js';

// Portfolio hides its header on scroll and Serial keeps a relative reader
// header by design, so neither follows the collapse contract below.
const FOLLOWING_ROUTES = ['/', '/arena.html', '/sectors.html', '/signal.html', '/horoscope.html', '/course.html'];
const MOBILE_NAV_ROUTES = ['/arena.html', '/sectors.html', '/signal.html', '/horoscope.html', '/course.html', '/serial.html'];

const collapse = (page) => page.locator('#afflatus-header').evaluate((header) => header.style.getPropertyValue('--af-collapse'));

test.describe('Afflatus adaptive brand', () => {
  test.use({ reducedMotion: 'no-preference' });

  for (const route of FOLLOWING_ROUTES) {
    test(`${route} expands only at the top and keeps the header attached`, async ({ page }) => {
      test.skip((page.viewportSize()?.width ?? 0) < 980, 'The shared header is always compact below 980px.');
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await settlePage(page);

      const header = page.locator('#afflatus-header');
      await expect(header).toHaveAttribute('data-enhanced', 'true');
      expect(await header.evaluate((element) => getComputedStyle(element).position)).toBe('fixed');
      await expect.poll(() => collapse(page)).toBe('0');

      await page.evaluate(() => scrollTo(0, 180));
      await expect.poll(() => collapse(page)).toBe('1');
      await expect.poll(async () => Math.round((await header.boundingBox())?.y ?? -1)).toBeGreaterThanOrEqual(-1);

      await page.evaluate(() => scrollTo(0, 0));
      await expect.poll(() => collapse(page)).toBe('0');
    });
  }
});

test.describe('Afflatus reduced motion brand', () => {
  test.use({ reducedMotion: 'reduce' });

  test('compact identity remains legible without motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/arena.html', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    await page.evaluate(() => scrollTo(0, 180));
    await expect.poll(() => collapse(page)).toBe('1');
    await expect(page.locator('#afflatus-header .af-brand-compact')).toBeVisible();
  });
});

test.describe('Mobile primary navigation', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const route of MOBILE_NAV_ROUTES) {
    test(`${route} keeps every primary action visible and touchable`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await settlePage(page);

      const menu = page.locator('#afflatus-header .af-header-menu');
      await menu.click();
      await expect(menu).toHaveAttribute('aria-expanded', 'true');

      const nav = page.locator('#af-primary-nav');
      await expect(nav).toBeVisible();
      const items = nav.locator(':scope > a, :scope > .af-header-group > button');
      await expect(items).toHaveCount(5);

      const bounds = await items.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().toJSON()));
      for (const item of bounds) {
        expect(item.left).toBeGreaterThanOrEqual(-1);
        expect(item.right).toBeLessThanOrEqual(391);
        expect(item.height).toBeGreaterThanOrEqual(44);
      }
      expect(await nav.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    });
  }
});
