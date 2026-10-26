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

  test('arrow keys on a drawn card do not seal a pick', async ({ page }) => {
    await page.goto('/worlds.html');
    await settlePage(page);
    await page.locator('#carousel').scrollIntoViewIfNeeded();
    await page.locator('#carousel .mcard.center').click();
    await page.locator('#drawn article.card').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#drawn article.card')).toHaveAttribute('data-state', 'pick');
  });

  test('an interrupted spin still settles on a whole card', async ({ page }) => {
    await page.goto('/worlds.html');
    await settlePage(page);
    await page.locator('#carousel').scrollIntoViewIfNeeded();
    const angle = await page.evaluate(async () => {
      const el = document.getElementById('carousel');
      const r = el.getBoundingClientRect();
      const y = r.top + 120;
      const fire = (type, x) => el.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 5, isPrimary: true, bubbles: true }));
      let x = r.left + r.width * 0.8;
      fire('pointerdown', x);
      for (let k = 0; k < 6; k += 1) { x -= 25; fire('pointermove', x); await new Promise((done) => setTimeout(done, 16)); }
      fire('pointerup', x);
      await new Promise((done) => setTimeout(done, 40));
      fire('pointerdown', x); // catch the coasting deck, then let the browser take the gesture
      fire('pointercancel', x);
      await new Promise((done) => setTimeout(done, 2500));
      const m = new DOMMatrixReadOnly(getComputedStyle(document.querySelector('#carousel .mcard.center')).transform);
      return Math.round((Math.atan2(-m.m13, m.m11) * 180) / Math.PI);
    });
    expect(Math.abs(angle)).toBeLessThanOrEqual(1);
  });

  test('a missed series shows Fable\'s sealed call when drawn', async ({ page }) => {
    await page.route('**/worlds-data.json', async (route) => {
      const data = await (await route.fetch()).json();
      // Kick everything open off before the pinned clock (picks stay sealed before kickoff).
      for (const s of data.series) {
        if (s.result) continue;
        s.kickoff = '2026-07-01T00:00:00.000Z';
        if (s.pick) s.pick.decidedAt = '2026-06-30T00:00:00.000Z';
      }
      await route.fulfill({ json: data });
    });
    await page.goto('/worlds.html');
    await settlePage(page);
    await page.locator('#carousel').scrollIntoViewIfNeeded();
    await page.locator('#carousel .mcard.center').click();
    await expect(page.locator('#drawn article.card')).toHaveAttribute('data-state', 'locked-missed');
    await expect(page.locator('#drawn article.card')).toHaveClass(/flipped/);
  });
});

