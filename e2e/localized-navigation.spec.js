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

test('fixed-locale switching keeps the reader in the current section', async ({ page }) => {
  await page.goto('/en/course.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.page-turn-controls')).toBeHidden();
  await page.locator('#review').evaluate((section) => {
    section.scrollIntoView({ behavior: 'instant', block: 'start' });
  });

  await Promise.all([
    page.waitForURL(/\/zh\/course\.html#review$/),
    page.locator('.lang-toggle').click(),
  ]);

  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  const reviewPosition = await page.locator('#review').evaluate((section) => {
    const bounds = section.getBoundingClientRect();
    return { top: bounds.top, bottom: bounds.bottom };
  });
  expect(reviewPosition.top).toBeGreaterThanOrEqual(0);
  expect(reviewPosition.top).toBeLessThan(180);
  expect(reviewPosition.bottom).toBeGreaterThan(180);
  expect(new URL(page.url()).hash).toBe('#review');
});

test('desktop pointer click pins a Labs menu that hover opened', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop pointer interaction');
  await page.goto('/en/course.html', { waitUntil: 'domcontentloaded' });

  const trigger = page.locator('.nav-labs__trigger');
  const menu = page.locator('.nav-labs__menu');
  await trigger.hover();
  await expect(menu).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');

  await trigger.click();
  await expect(menu).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');

  await trigger.click();
  await expect(menu).toBeHidden();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});
