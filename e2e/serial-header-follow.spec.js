import { expect, settlePage, test } from './site-fixture.js';

test('Chinese serial header remains attached to the viewport while reading', async ({ page }) => {
  await page.goto('/zh/serial.html', { waitUntil: 'domcontentloaded' });
  await settlePage(page);

  const header = page.locator('.site-header--follow');
  await expect(header).toHaveCount(1);
  await expect(header).toBeVisible();

  const rootOverflow = await page.evaluate(() => ({
    html: getComputedStyle(document.documentElement).overflowX,
    body: getComputedStyle(document.body).overflowX,
  }));
  expect(rootOverflow).toEqual({ html: 'visible', body: 'visible' });

  await page.evaluate(() => scrollTo(0, 1200));
  await expect.poll(async () => {
    const box = await header.boundingBox();
    return Math.round(box?.y ?? -1);
  }).toBe(0);
});
