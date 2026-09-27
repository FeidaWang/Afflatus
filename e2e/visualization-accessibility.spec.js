import { expect, test } from './site-fixture.js';

test.describe('visualization semantic and keyboard equivalents', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'The semantic DOM contract runs once in Chromium.');
  });

  test('Sectors relationship graph has a parallel company picker and keyboard selection', async ({ page }) => {
    await page.goto('/sectors.html#industryGraph', { waitUntil: 'domcontentloaded' });

    const graph = page.locator('#industryGraph svg.graph');
    await graph.scrollIntoViewIfNeeded();
    await expect(graph).toBeVisible();
    await expect(graph).toHaveAttribute('aria-label', /.+/);
    expect(await page.locator('#industryGraph select.graph-picker option').count()).toBeGreaterThan(2);

    const node = page.locator('#industryGraph .gnode[data-id="anthropic"]');
    await node.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#industryGraph .gnode.is-focus')).toHaveCount(1);
    await expect(page.locator('#industryGraph .graph-ledger li').first()).toBeVisible();
  });

  test('Arena equity chart exposes its latest values in text', async ({ page }) => {
    await page.goto('/arena.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#apChart')).toHaveAttribute('aria-describedby', 'apChartSummary');
    await expect(page.locator('#apChartSummary')).toContainText(/Final values:/);
    await expect(page.locator('#bgCanvas')).toHaveAttribute('aria-hidden', 'true');
  });
});
