import { expect, test } from './site-fixture.js';

test.describe('visualization semantic and keyboard equivalents', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'The semantic DOM contract runs once in Chromium.');
  });

  test('Sectors canvas has a parallel node control list and keyboard selection', async ({ page }) => {
    await page.goto('/sectors.html', { waitUntil: 'domcontentloaded' });

    const canvas = page.locator('#mwGraph');
    await canvas.scrollIntoViewIfNeeded();
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute('aria-describedby', /mwGraphSummary/);
    await expect(page.locator('#mwGraphSummary')).not.toBeEmpty();
    expect(await page.locator('#mwGraphNodes button').count()).toBeGreaterThan(2);

    await canvas.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#mwGraphNodes button[aria-pressed="true"]')).toHaveCount(1);
    await expect(page.locator('#mwDetail')).toBeVisible();
  });

  test('Arena equity chart exposes its latest values in text', async ({ page }) => {
    await page.goto('/arena.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#apChart')).toHaveAttribute('aria-describedby', 'apChartSummary');
    await expect(page.locator('#apChartSummary')).toContainText(/Final values:/);
    await expect(page.locator('#bgCanvas')).toHaveAttribute('aria-hidden', 'true');
  });
});
