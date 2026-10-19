import { expect, test } from '@playwright/test';

// Static novel documents are prerendered with their own canonical identity.
// The serial reader boots on top of them and must not rewrite that metadata.
async function bootReader(page, path) {
  await page.goto(path, { waitUntil: 'load' });
  await expect(page.locator('body')).toHaveClass(/\breader-enhanced\b/);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test('novel landing keeps its own canonical and Open Graph identity after boot', async ({ page }) => {
  await bootReader(page, '/zh/novels/wanjie-zhongchun/');
  const url = 'https://feida.au/zh/novels/wanjie-zhongchun/';
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', url);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', url);
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'book');
  await expect(page).toHaveTitle(/万界种春/);
});

test('novel chapter keeps its own canonical after boot', async ({ page }) => {
  await bootReader(page, '/zh/novels/wanjie-zhongchun/1/');
  const url = 'https://feida.au/zh/novels/wanjie-zhongchun/1/';
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', url);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', url);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /^《万界种春》第1章 · 坍缩预警：/);
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /^《万界种春》第1章 · 坍缩预警：/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://feida.au/assets/og/novels/wanjie-zhongchun/1.jpg');
  await expect(page.locator('h1')).toHaveText('第1章 · 坍缩预警');
});
