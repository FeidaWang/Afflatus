import { expect, test } from './site-fixture.js';

test.describe('shared JSON delivery contract', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'The network de-duplication contract runs once in Chromium.');
  });

  test('Signal shares one validated request across both inline consumers', async ({ page }) => {
    let requests = 0;
    await page.route('**/signal-events.json', async (route) => {
      requests += 1;
      await route.continue();
    });

    await page.goto('/signal.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#incidentList .incident').first()).toBeAttached();
    await expect(page.locator('#pillarGrid .pillar')).toHaveCount(5);
    expect(requests).toBe(1);
  });
});
