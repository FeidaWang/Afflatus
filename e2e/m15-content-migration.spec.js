import { expect, test } from './site-fixture.js';

const screenshotRoot = 'docs/refactor/screenshots';

test.describe('M15 content migration', () => {
  test('renders the Capital feature and complete index without a 3D surface', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    await page.goto('/capital/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'A field record, not a live feed.' })).toBeVisible();
    await expect(page.getByText('Featured entry')).toBeVisible();
    await expect(page.getByText('Complete index')).toBeVisible();
    await expect(page.getByRole('link', { name: /FY25\/26 field record and method/ })).toHaveAttribute('href', '/en/capital/fy25-26/');
    await expect(page.locator('canvas')).toHaveCount(0);
    await page.screenshot({ path: `${screenshotRoot}/m15-capital-index-desktop-1440x1000.png` });
  });

  test('keeps Solar Atlas source material addressable from a focused case study', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    await page.goto('/intelligence/solar-atlas/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'AI Industry Solar Atlas' })).toBeVisible();
    await expect(page.locator('.content-case-prose')).toBeVisible();
    await expect(page.getByRole('link', { name: /Open original record and charts/ })).toHaveAttribute('href', '/en/portfolio.html#solarAtlas');
    await expect(page.locator('canvas')).toHaveCount(0);
    await page.screenshot({ path: `${screenshotRoot}/m15-solar-atlas-case-desktop-1440x1000.png` });
  });

  test('keeps Field Notes readable and within the mobile viewport', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-16-pro-max-webkit');
    await page.goto('/field-notes/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Read at the speed of thought.' })).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(hasHorizontalOverflow).toBe(false);
    await page.screenshot({ path: `${screenshotRoot}/m15-field-notes-mobile-440x956.png` });
  });
});
