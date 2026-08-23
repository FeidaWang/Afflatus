import { expect, settlePage, test } from './site-fixture.js';

const primaryLabels = ['Systems', 'Intelligence', 'Field Notes', 'Experiments', 'About'];

test.describe('M03 primary navigation', () => {
  test('renders the shared desktop model and a single command CTA', async ({ page }) => {
    await page.goto('/arena.html', { waitUntil: 'domcontentloaded' });
    await settlePage(page);

    const nav = page.locator('[data-afflatus-nav].afflatus-primary-nav');
    await expect(nav).toBeVisible();
    await expect(nav.locator('.afflatus-nav-links a')).toHaveText(primaryLabels);
    await expect(nav.locator('.afflatus-command-cta')).toHaveText('Enter Command');
    await expect(nav.locator('.afflatus-command-cta')).toHaveAttribute('href', '/command/');
    await expect(nav.locator('[aria-current="page"]')).toHaveText('Experiments');
  });

  test('opens, closes and restores focus for the mobile menu', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/arena.html', { waitUntil: 'domcontentloaded' });
    await settlePage(page);

    const nav = page.locator('[data-afflatus-nav].afflatus-primary-nav');
    const toggle = nav.locator('.afflatus-nav-toggle');
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(nav.locator('.afflatus-nav-links')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
  });

  test('keeps the current path and query when switching locale', async ({ page }) => {
    await page.goto('/arena.html?review=m03', { waitUntil: 'domcontentloaded' });
    await settlePage(page);
    await page.locator('[data-afflatus-nav] .lang-toggle').click();
    await page.waitForURL(/\/zh\/arena\.html\?review=m03/);
  });
});
