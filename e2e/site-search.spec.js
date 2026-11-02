// Site search: /search.html?q= over the titles and summaries of topics-index.json.
import { expect, test } from './site-fixture.js';

const results = (page) => page.locator('.topic-result');

test.describe('site search', () => {
  test('finds matches and reports the count', async ({ page }) => {
    await page.goto('/en/search.html?q=fed%20watch', { waitUntil: 'load' });
    await expect(page.locator('h1')).toHaveText('“fed watch”');
    await expect(page.locator('.topic-count')).toHaveText(/^\d+ results?$/);
    await expect(results(page).first().locator('h2 a')).toHaveAttribute('href', '/en/signal.html');
    await expect(page.locator('#q')).toHaveValue('fed watch');
    await expect(page).toHaveTitle('fed watch · AFFLATUS');
  });

  test('searches both languages from either locale', async ({ page }) => {
    await page.goto('/en/search.html?q=%E7%BE%8E%E8%81%94%E5%82%A8%E8%A7%82%E5%AF%9F', { waitUntil: 'load' });
    await expect(results(page).first().locator('h2 a')).toHaveAttribute('href', '/en/signal.html');
    await page.goto('/zh/search.html?q=fed%20watch', { waitUntil: 'load' });
    await expect(page.locator('.topic-eyebrow')).toHaveText('搜索结果');
    await expect(results(page).first().locator('h2 a')).toHaveAttribute('href', '/zh/signal.html');
  });

  test('submitting the form lands on the query URL in the same locale', async ({ page }) => {
    await page.goto('/zh/search.html', { waitUntil: 'load' });
    await page.locator('#q').fill('观察站');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/zh\/search\.html\?q=/);
    await expect(results(page).first()).toBeVisible();
  });

  test('offers the topics when nothing matches, showing the query as text', async ({ page }) => {
    await page.goto('/en/search.html?q=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E', { waitUntil: 'load' });
    await expect(page.locator('h1')).toHaveText('“<img src=x onerror=alert(1)>”');
    await expect(page.locator('.topic-panel img')).toHaveCount(0);
    await expect(page.locator('.topic-note')).toContainText('Nothing matched');
    await expect(page.locator('.topic-count')).toHaveCount(0);
    await expect(results(page)).toHaveCount(7);
    await expect(results(page).first().locator('h2 a')).toHaveAttribute('href', '/en/search.html?topic=ai-observatory');
  });

  test('a blank query is the directory', async ({ page }) => {
    await page.goto('/en/search.html?q=%20', { waitUntil: 'load' });
    await expect(page.locator('h1')).toHaveText('All topics');
    await expect(page.locator('.topic-note')).toHaveCount(0);
  });

  test('pages long result lists and opens Related on a result', async ({ page }) => {
    await page.goto('/en/search.html?q=a', { waitUntil: 'load' });
    await expect(results(page)).toHaveCount(10);
    await page.getByRole('button', { name: 'Load more' }).click();
    await expect(results(page)).toHaveCount(20);
    await expect(results(page).nth(10).locator('h2 a')).toBeFocused();
    await results(page).first().locator('.related-trigger').click();
    await expect(page.locator('.related-panel .related-more')).toBeVisible();
  });

  test('keeps the topic view working with the form above it', async ({ page }) => {
    await page.goto('/en/search.html?topic=labs', { waitUntil: 'load' });
    await expect(page.locator('h1')).not.toHaveText('All topics');
    await expect(page.locator('#q')).toHaveValue('');
    await expect(results(page).first()).toBeVisible();
  });

  test('fits a 390px phone with no sideways scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/zh/search.html?q=fed', { waitUntil: 'load' });
    await expect(results(page).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});
