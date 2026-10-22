import { expect, settlePage, test } from './site-fixture.js';

test.describe('Horoscope M0: hash, fx switch, English-only UI', () => {
  test('direct #journal lands on the journal and keeps the hash', async ({ page }) => {
    await page.goto('/horoscope.html#journal', { waitUntil: 'domcontentloaded' });
    await settlePage(page);
    await expect(page.locator('body')).toHaveAttribute('data-observatory-view', 'journal');
    expect(new URL(page.url()).hash).toBe('#journal');
  });

  test('direct #relationships lands on relations', async ({ page }) => {
    await page.goto('/horoscope.html#relationships', { waitUntil: 'domcontentloaded' });
    await settlePage(page);
    await expect(page.locator('body')).toHaveAttribute('data-observatory-view', 'relationships');
  });

  test('query is stripped while an unlisted hash is dropped', async ({ page }) => {
    await page.goto('/horoscope.html?utm=x&y=1990#secret', { waitUntil: 'domcontentloaded' });
    expect(new URL(page.url()).search).toBe('');
    expect(new URL(page.url()).hash).toBe('');
  });

  test('?fx=almanac survives reload and ?fx=off clears it', async ({ page }) => {
    await page.goto('/horoscope.html?fx=almanac', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('data-fx', 'almanac');
    expect(new URL(page.url()).search).toBe('');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('data-fx', 'almanac');
    await page.goto('/horoscope.html?fx=off', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).not.toHaveAttribute('data-fx', /.*/);
  });

  test('without the switch the page carries no data-fx', async ({ page }) => {
    await page.goto('/horoscope.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).not.toHaveAttribute('data-fx', /.*/);
  });

  test('English page shows no Chinese UI outside lang="zh" islands', async ({ page }) => {
    await page.goto('/horoscope.html', { waitUntil: 'domcontentloaded' });
    await settlePage(page);
    const offenders = await page.evaluate(() => {
      const found = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const el = node.parentElement;
        if (!el || el.closest('script,style,noscript,option,[hreflang^="zh"],[lang^="zh"]') || !/[㐀-鿿]/.test(node.nodeValue)) continue;
        found.push(node.nodeValue.trim().slice(0, 40));
      }
      return found;
    });
    expect(offenders).toEqual([]);
  });

  test('footer and nav use the page name Astrology for fun', async ({ page }) => {
    await page.goto('/horoscope.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('footer').last()).toContainText('ASTROLOGY FOR FUN');
    await expect(page.locator('nav.horo-bottom-nav')).toHaveAttribute('aria-label', 'Astrology for fun navigation');
  });
});
