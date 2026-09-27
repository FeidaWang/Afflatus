// e2e/sectors-story.spec.js
import { test, expect } from '@playwright/test';

test('relationship ledger works without the SVG on a 320px phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/zh/sectors.html#industryGraph');
  await expect(page.locator('#industryGraph svg.graph')).toBeHidden();
  await page.selectOption('#industryGraph select.graph-picker', 'anthropic');
  await expect(page.locator('#industryGraph .graph-ledger li').first()).toBeVisible();
  await page.click('#industryGraph [data-type="competitor"]');
  await expect(page.locator('#industryGraph .ledger-competitor')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('US–China edges fade from US blue to China red on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/en/sectors.html#industryGraph');
  await page.click('#industryGraph .gnode[data-id="anthropic"]');
  const edge = page.locator('#industryGraph path[data-id="ant-baba-rival"]');
  expect(await edge.evaluate((p) => getComputedStyle(p).stroke)).toMatch(/^url\(/);
  expect(await edge.evaluate((p) => getComputedStyle(p).strokeDasharray)).not.toBe('none');
});
