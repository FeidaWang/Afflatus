import { expect, test } from './site-fixture.js';

const screenshotRoot = 'docs/refactor/screenshots';

test.describe('M14 Command Mission Room', () => {
  test('shows truthful objective, trajectory and keyboard-operable modes', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    await page.goto('/command/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Command what is real.' })).toBeVisible();
    await expect(page.getByText('Preserve capital while maintaining optionality.')).toBeVisible();
    await expect(page.locator('.trajectory-row')).toHaveCount(3);
    await expect(page.locator('.mission-unavailable[data-state="unavailable"]')).toHaveCount(1);
    const navigation = page.locator('[data-afflatus-nav].afflatus-primary-nav');
    await expect(navigation.locator('.afflatus-nav-links a')).toHaveCount(5);
    const navigationFits = await navigation.evaluate((nav) => {
      const links = nav.querySelector('.afflatus-nav-links');
      const command = nav.querySelector('.afflatus-command-cta');
      if (!links || !command) return false;
      const linkBox = links.getBoundingClientRect();
      const commandBox = command.getBoundingClientRect();
      return links.scrollWidth <= links.clientWidth + 1 && linkBox.right <= commandBox.left + 1;
    });
    expect(navigationFits).toBe(true);
    const observe = page.getByRole('tab', { name: /Observe/ });
    await observe.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: /Model/ })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('End');
    await expect(page.getByRole('tab', { name: /Commit/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('canvas')).toHaveCount(0);
    const loaded = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name));
    expect(loaded.some((name) => /SignatureScene|vendor-three|topdownCombat/i.test(name))).toBe(false);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${screenshotRoot}/m14-command-desktop-1440x1000.png` });
  });

  test('keeps Mission Room useful without motion on mobile', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-16-pro-max-webkit');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/command/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.mission-drift')).toHaveCSS('animation-name', 'none');
    await expect(page.locator('canvas')).toHaveCount(0);
    await page.screenshot({ path: `${screenshotRoot}/m14-command-mobile-reduced-440x956.png` });
  });
});

test.describe('M14 Flight Experiment', () => {
  test('labels simulated systems and preserves the legacy launch path', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    await page.goto('/experiments/flight/?flight-debug=1', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Flight systems, isolated.' })).toBeVisible();
    await expect(page.getByText(/Experimental simulation/)).toBeVisible();
    for (const feature of ['NAV / COMBAT', 'RADAR', 'WEAPONS', 'SHIELDS', 'G-FORCE']) {
      await expect(page.getByRole('heading', { level: 2, name: feature })).toBeVisible();
    }
    await expect(page.getByRole('link', { name: /Launch Legacy Flight Simulation/ })).toHaveAttribute('href', '/portfolio.html?mode=flight');
    await expect(page.locator('.flight-fps-debug')).toHaveCount(0);
    await page.screenshot({ path: `${screenshotRoot}/m14-flight-experiment-desktop-1440x1000.png` });
  });
});
