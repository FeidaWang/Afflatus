import { expect, settlePage, test } from './site-fixture.js';

const chapterIds = [
  '01-cold-void',
  '02-the-approach',
  '03-parallel-drift',
  '04-bridge-aperture',
  '05-the-wake',
  '06-departure',
];

test.describe('M04 semantic home', () => {
  test('renders six readable chapters without the superseded HUD surfaces', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await settlePage(page);

    const chapters = page.locator('[data-chapter]');
    await expect(chapters).toHaveCount(6);
    expect(await chapters.evaluateAll((nodes) => nodes.map((node) => node.dataset.chapter))).toEqual(chapterIds);

    for (const chapter of await chapters.all()) {
      await expect(chapter.locator('h1, h2').first()).toBeVisible();
    }

    expect(await page.locator('canvas').count()).toBeLessThanOrEqual(1);
    await expect(page.locator('.hero-telemetry, .feature-facts, .signature-deck, .principles-grid')).toHaveCount(0);
    await expect(page.getByText('ALL SYSTEMS NOMINAL', { exact: true })).toHaveCount(1);
    await expect(page.locator('.site-footer')).toContainText('MELBOURNE, AUSTRALIA');
    await expect(page.locator('.site-footer')).toContainText('Privacy / Disclosure');
  });

  test('opens a poster-only Command preview and restores focus on Escape', async ({ page }) => {
    await page.goto('/?experience=static', { waitUntil: 'domcontentloaded' });
    await settlePage(page);

    const command = page.getByRole('button', { name: 'Enter Command' });
    await command.click();
    const dialog = page.getByRole('dialog', { name: 'Command remains a deliberate entry.' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.deck-static-poster')).toHaveAttribute('data-renderer', 'poster');
    await expect(dialog.locator('canvas')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(command).toBeFocused();
  });

  test('keeps the mobile chapters and navigation inside the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await settlePage(page);

    const menu = page.locator('.mobile-menu');
    await menu.click();
    await expect(page.locator('.desktop-nav.is-mobile-open')).toBeVisible();
    await expect(page.locator('.desktop-nav .primary-nav-link')).toHaveCount(5);

    const overflow = await page.evaluate(() => Math.max(
      0,
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ));
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe('M04 no-JS home', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });

  test('keeps all chapters, the primary navigation and CTA available', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-chapter]')).toHaveCount(6);
    await expect(page.locator('h1')).toContainText('Systems for uncertain worlds.');
    await expect(page.locator('[data-afflatus-fallback-nav] .primary-nav-link')).toHaveCount(5);
    await expect(page.getByRole('link', { name: 'Enter Command', exact: true })).toHaveAttribute('href', '/command/');
    await expect(page.locator('[data-chapter="06-departure"]')).toContainText('Preserve capital. Build systems. Follow evidence.');
    const overflow = await page.evaluate(() => Math.max(
      0,
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ));
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
