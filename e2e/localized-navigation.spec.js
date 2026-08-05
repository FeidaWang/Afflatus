import { expect, test } from '@playwright/test';

test('English navigation targets the published Chinese-only bookshelf directly', async ({ page }) => {
  await page.goto('/en/arena.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.nav-labs__menu a[data-en="Novels"]'))
    .toHaveAttribute('href', '/zh/serial.html');

  await page.goto('/en/horoscope.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-page-turn="next"]'))
    .toHaveAttribute('href', '/zh/serial.html');

  await page.goto('/en/course.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-page-turn="prev"]'))
    .toHaveAttribute('href', '/zh/serial.html');
});
