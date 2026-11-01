import { expect, test } from './site-fixture.js';

test.describe('homepage cards and accordion footer', () => {
  test('shows three latest cards and four covers without overflow', async ({ page }) => {
    await page.goto('/en/', { waitUntil: 'load' });
    await expect(page.locator('.home-card')).toHaveCount(3);
    await expect(page.locator('.home-card time').first()).toHaveAttribute('datetime', /^\d{4}-\d{2}/);
    const covers = page.locator('.home-learn-card img');
    await expect(covers).toHaveCount(4);
    for (const cover of await covers.all()) {
      await cover.scrollIntoViewIfNeeded();
      await expect.poll(() => cover.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.locator('#key-articles, #about-me, #destinations')).toHaveCount(0);
  });

  test('footer sections start closed and open to reveal their links', async ({ page }) => {
    await page.goto('/zh/', { waitUntil: 'domcontentloaded' });
    const groups = page.locator('.pa-footer-group');
    await expect(groups).toHaveCount(5);
    await expect(page.locator('.pa-footer-pages a')).toHaveCount(9);
    const analysis = groups.first();
    await expect(analysis.locator('a').first()).toBeHidden();
    await analysis.locator('summary').click();
    await expect(analysis.locator('a')).toHaveCount(4);
    await expect(analysis.locator('a').first()).toBeVisible();
    await expect(analysis.locator('a').first()).toHaveAttribute('href', '/zh/portfolio.html');
  });

  for (const path of ['about.html', 'course.html', 'signal.html', 'portfolio.html', 'arena.html', 'course/guide.html']) {
    test(`footer language links stay on /${path}`, async ({ page }) => {
      await page.goto(`/en/${path}`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.pa-footer-pages summary')).toHaveCount(5);
      await expect(page.locator('[data-footer-language="en"]')).toHaveAttribute('href', `/en/${path}`);
      await expect(page.locator('[data-footer-language="zh"]')).toHaveAttribute('href', `/zh/${path}`);
    });
  }
});
