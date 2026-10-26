import { expect, settlePage, test } from './site-fixture.js';

// The fixture pins the clock to 2026-07-25, before every Worlds kickoff, so
// every open series in the current stage can still be picked.
test.describe('Worlds 2026 card deck', () => {
  test('drawing the front card and picking a side flips it at once', async ({ page }) => {
    await page.goto('/worlds.html');
    await settlePage(page);
    const deck = page.locator('#carousel');
    await deck.scrollIntoViewIfNeeded();
    await expect(deck.locator('.mcard.center')).toHaveCount(1);

    await deck.locator('.mcard.center').click();
    await expect(page.locator('#drawn article.card')).toHaveAttribute('data-state', 'pick');

    await page.locator('#drawn article.card .side[data-side="home"]').click();
    await expect(page.locator('#drawn article.card')).toHaveClass(/flipped/, { timeout: 1000 });
    await expect(page.locator('#drawn article.card')).toHaveAttribute('data-state', 'revealed');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('afflatus-worlds:picks:v1')));
    expect(Object.values(stored)[0]).toMatchObject({ side: 'home', revealed: true });
  });

  test('panels switch from the tab list and the page never scrolls sideways', async ({ page }) => {
    await page.goto('/worlds.html');
    await settlePage(page);
    await expect(page.locator('#sources')).toHaveCount(0);
    await page.locator('#tab-odds').click();
    await expect(page).toHaveURL(/#odds$/);
    await expect(page.locator('#odds')).toBeVisible();
    await expect(page.locator('#cards')).toBeHidden();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
