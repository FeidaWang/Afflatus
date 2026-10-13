import { expect, test } from '@playwright/test';

// P3-23: one 404.html serves every missing path; /zh/ shows the Chinese version.
test('a missing /zh/ page answers 404 in Chinese', async ({ page }) => {
  const response = await page.goto('/zh/no-such-page.html');
  expect(response?.status()).toBe(404);
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page).toHaveTitle('404 — 页面不存在 · AFFLATUS');
  await expect(page.locator('#errorTitle')).toHaveText(/^页面不存在。/);
  await expect(page.locator('.recovery nav a').first()).toHaveText('返回中文首页');
  await expect(page.locator('#afflatus-header a[data-header-path="/portfolio.html"]')).toHaveAttribute('href', '/zh/portfolio.html');
  await expect(page.locator('[data-header-language]')).toHaveAttribute('href', '/en/');
});

test('a missing English page keeps the English 404', async ({ page }) => {
  const response = await page.goto('/en/no-such-page.html');
  expect(response?.status()).toBe(404);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#errorTitle')).toHaveText(/^Page not found\./);
  await expect(page.locator('.recovery nav a').first()).toHaveText('English homepage');
});
