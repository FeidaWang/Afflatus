import { expect, settlePage, test } from './site-fixture.js';

const VIEWS = ['today', 'you', 'two', 'log'];
const ROUTES = [
  ['today', 'today', 'today'],
  ['you', 'you', 'you'],
  ['two', 'two', 'two'],
  ['log', 'log', 'log'],
  ['self', 'you', 'you'],
  ['relationships', 'two', 'two'],
  ['journal', 'log', 'log'],
];

async function openAlmanac(page, hash = '') {
  await page.goto(`/horoscope.html?fx=almanac${hash}`, { waitUntil: 'domcontentloaded' });
  await settlePage(page);
  await expect(page.locator('#almanacShell')).toBeVisible();
}

async function expectView(page, id, key) {
  for (const view of VIEWS) {
    if (view === id) await expect(page.locator(`[data-alm-view="${view}"]`)).toBeVisible();
    else await expect(page.locator(`[data-alm-view="${view}"]`)).toBeHidden();
  }
  await expect(page.locator('.alm-keys [aria-current="page"]')).toHaveText(key);
}

test.describe('Horoscope M1: almanac shell, tokens and routes', () => {
  for (const [hash, id, key] of ROUTES) {
    test(`direct #${hash} lands on ${id}`, async ({ page }) => {
      await openAlmanac(page, `#${hash}`);
      await expectView(page, id, key);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
    });
  }

  test('keys switch views, write the new hash and return to the top', async ({ page }) => {
    await openAlmanac(page);
    await expectView(page, 'today', 'today');
    for (const [label, id] of [['you', 'you'], ['two', 'two'], ['log', 'log'], ['today', 'today']]) {
      await page.evaluate(() => window.scrollTo(0, 400));
      await page.locator('.alm-keys .alm-key', { hasText: label }).click();
      await expectView(page, id, label);
      expect(new URL(page.url()).hash).toBe(`#${id}`);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
    }
    await page.goBack();
    await expectView(page, 'log', 'log');
  });

  for (const width of [320, 390, 768, 1280]) {
    test(`${width}px: no horizontal scroll and the key row clears the footer`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await openAlmanac(page);
      for (const view of VIEWS) {
        await page.locator('.alm-keys .alm-key').nth(VIEWS.indexOf(view)).click();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${view} overflows`).toBeLessThanOrEqual(0);
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const footer = await page.locator('footer.foot').boundingBox();
        const keys = await page.locator('.alm-keys').boundingBox();
        await expect(page.locator('footer.foot')).toBeVisible();
        if (width < 1024) expect(footer.y + footer.height, `${view} footer under keys`).toBeLessThanOrEqual(keys.y);
      }
    });
  }

  test('theme follows the system, then remembers a manual choice', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await openAlmanac(page);
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-alm-theme', 'light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(html).toHaveAttribute('data-alm-theme', 'dark');
    await page.locator('#almTheme').click();
    await expect(html).toHaveAttribute('data-alm-theme', 'light');
    await expect(page.locator('#almTheme')).toHaveAttribute('aria-pressed', 'false');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(html).toHaveAttribute('data-alm-theme', 'light');
  });

  test('English almanac shows no Chinese UI outside lang="zh" islands', async ({ page }) => {
    await openAlmanac(page);
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

  test('without the switch the shell stays hidden and the current page runs', async ({ page }) => {
    await page.goto('/horoscope.html#you', { waitUntil: 'domcontentloaded' });
    await settlePage(page);
    await expect(page.locator('#almanacShell')).toBeHidden();
    await expect(page.locator('html')).not.toHaveAttribute('data-alm-theme', /.*/);
    await expect(page.locator('nav.horo-bottom-nav')).toBeVisible();
    await expect(page.locator('body')).toHaveAttribute('data-observatory-view', 'self');
  });
});
