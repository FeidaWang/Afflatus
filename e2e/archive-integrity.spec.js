import { expect, settlePage, test } from './site-fixture.js';

test.describe('prediction archive integrity', () => {
  test('renders the settled MSI final in the unified Stats archive', async ({ page }) => {
    await page.goto('/stats.html', { waitUntil: 'domcontentloaded' });
    await settlePage(page);

    const summary = page.locator('#msiStrip .stat b');
    await expect(summary.nth(0)).toHaveText('14');
    await expect(summary.nth(1)).toHaveText('50%');
    await expect(page.locator('#msiChampNote')).toContainText('Actual champion: HLE');
    await expect(page.locator('#msiMvps')).toContainText('Actual Finals MVP: Zeus · HLE');
    await expect(page.locator('#msiLog tbody tr')).toHaveCount(14);
  });
});
