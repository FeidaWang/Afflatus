import { expect, settlePage, test } from './site-fixture.js';

const ROUTES = ['/', '/arena.html', '/sectors.html', '/signal.html'];

test.describe('Afflatus adaptive brand', () => {
  for (const route of ROUTES) {
    test(`${route} expands only at the top and keeps the header attached`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await settlePage(page);

      const brand = page.locator('a[data-afflatus-brand]');
      const header = brand.locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " site-header--follow ")][1]');
      await expect(brand).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-afflatus-brand-state', 'full');

      const enterArena = page.locator('#bfEnter');
      if (await enterArena.isVisible()) await enterArena.click();

      const position = await header.evaluate((element) => getComputedStyle(element).position);
      expect(['fixed', 'sticky']).toContain(position);

      await page.evaluate(() => scrollTo(0, 180));
      await expect(page.locator('html')).toHaveAttribute('data-afflatus-brand-state', 'compact');
      await expect.poll(async () => {
        const box = await header.boundingBox();
        return Math.round(box?.y ?? -1);
      }).toBe(0);

      await page.evaluate(() => scrollTo(0, 0));
      await expect(page.locator('html')).toHaveAttribute('data-afflatus-brand-state', 'full');
    });
  }

  test('Labs routes retain their independent identity systems', async ({ page }) => {
    for (const route of ['/stats.html', '/horoscope.html', '/serial.html', '/course.html']) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('a[data-afflatus-brand]')).toHaveCount(0);
    }
  });
});
