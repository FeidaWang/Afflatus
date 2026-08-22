import { expect, test } from './site-fixture.js';

test.describe('M01 home experience guardrails', () => {
  test('serves a static command deck without loading the Three.js scene', async ({ page }) => {
    await page.goto('/?experience=static', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('data-experience-mode', 'static');
    await page.getByRole('button', { name: 'Open Deck' }).click();
    await expect(page.locator('.deck-static-poster')).toBeVisible();
    await expect(page.locator('.deck-static-poster')).toHaveAttribute('data-renderer', 'poster');
  });

  test('keeps a direct legacy escape hatch to the existing portfolio deck', async ({ page }) => {
    await page.goto('/?experience=legacy', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/portfolio\.html\?experience=legacy$/);
    await expect(page.locator('#commandModeBtn')).toBeVisible();
  });

  test('falls back from an unavailable WebGL command scene to static mode', async ({ page }) => {
    await page.goto('/?experience=cinematic&scene=unavailable', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Open Deck' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-experience-mode', 'static');
    await page.getByRole('button', { name: 'Open Deck' }).click();
    await expect(page.locator('.deck-static-poster')).toBeVisible();
  });
});
