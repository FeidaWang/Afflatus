import { expect, test } from './site-fixture.js';

test.describe('shared JSON delivery contract', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'The network de-duplication contract runs once in Chromium.');
  });

  test('Signal renders records and policy overview from one validated request', async ({ page }) => {
    let requests = 0;
    await page.route('**/signal-events.json', async (route) => {
      requests += 1;
      await route.continue();
    });

    await page.goto('/signal.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#record-list .record-card').first()).toBeAttached();
    await expect(page.locator('#index-summary a')).toHaveAttribute('href', /federalreserve.gov/);
    await expect(page.locator('#fomc-decisions a').first()).toBeAttached();
    expect(requests).toBe(1);
  });
});
