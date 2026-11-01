import { expect, test } from './site-fixture.js';

const trigger = (page, name) => page.getByRole('button', { name });

test.describe('related popover', () => {
  test('every homepage card has a menu, and the index loads only on demand', async ({ page }) => {
    const indexRequests = [];
    page.on('request', (request) => { if (request.url().includes('topics-index.json')) indexRequests.push(request.url()); });
    await page.goto('/en/', { waitUntil: 'load' });
    await expect(page.locator('.related-trigger')).toHaveCount(7);
    expect(indexRequests).toEqual([]);
    await trigger(page, 'Related to AI Observatory').click();
    await expect(page.getByRole('dialog', { name: 'Related' })).toBeVisible();
    await expect(page.locator('.related-card')).toBeVisible();
    expect(indexRequests).toHaveLength(1);
  });

  test('opens with the topic summary, branch tree, one related card and a link onward', async ({ page }) => {
    await page.goto('/zh/', { waitUntil: 'load' });
    await trigger(page, '相关内容： AI 观察站').click();
    const panel = page.getByRole('dialog', { name: '相关内容' });
    await expect(panel.locator('.related-summary')).toContainText('塑造 AI');
    await expect(panel.locator('.related-tree circle')).toHaveCount(5);
    await expect(panel.locator('.related-card')).toHaveCount(1);
    await expect(panel.locator('.related-more')).toHaveAttribute('href', '/zh/search.html?topic=ai-observatory');
  });

  test('Escape closes it and returns focus to the button', async ({ page }) => {
    await page.goto('/en/', { waitUntil: 'load' });
    const button = trigger(page, 'Related to Fed Watch');
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.related-card')).toBeVisible();
    await expect(page.locator('.related-panel')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('.related-panel')).toHaveCount(0);
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  test('clicking outside or opening another menu closes it', async ({ page }) => {
    await page.goto('/en/', { waitUntil: 'load' });
    await trigger(page, 'Related to AI Observatory').click();
    await expect(page.locator('.related-panel')).toHaveCount(1);
    // In one column the open panel covers the next card's button.
    if (page.viewportSize().width > 1100) {
      await trigger(page, 'Related to Fed Watch').click();
      await expect(page.locator('.related-panel')).toHaveCount(1);
      await expect(trigger(page, 'Related to AI Observatory')).toHaveAttribute('aria-expanded', 'false');
    }
    await page.locator('#latest-title').click();
    await expect(page.locator('.related-panel')).toHaveCount(0);
  });

  test('the close button returns focus to the menu button', async ({ page }) => {
    await page.goto('/en/', { waitUntil: 'load' });
    const button = trigger(page, 'Related to Serials');
    await button.click();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('.related-panel')).toHaveCount(0);
    await expect(button).toBeFocused();
  });

  test('a cover card keeps its link and stays inside a narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en/', { waitUntil: 'load' });
    const button = trigger(page, 'Related to Courses');
    await button.scrollIntoViewIfNeeded();
    await button.click();
    const panel = page.locator('.related-panel');
    await expect(panel.locator('.related-card')).toBeVisible();
    const box = await panel.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(page.url()).toMatch(/\/en\/$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('stays inside the viewport on the leftmost cover at the four-column breakpoint', async ({ page }) => {
    await page.setViewportSize({ width: 980, height: 800 });
    await page.goto('/en/', { waitUntil: 'load' });
    const button = trigger(page, 'Related to Courses');
    await button.scrollIntoViewIfNeeded();
    await button.click();
    await expect(page.locator('.related-card')).toBeVisible();
    expect((await page.locator('.related-panel').boundingBox()).x).toBeGreaterThanOrEqual(0);
  });

  test('View more goes to the topic page', async ({ page }) => {
    await page.goto('/en/', { waitUntil: 'load' });
    await trigger(page, 'Related to Astrology').scrollIntoViewIfNeeded();
    await trigger(page, 'Related to Astrology').click();
    await page.locator('.related-more').click();
    await expect(page).toHaveURL(/\/en\/search\.html\?topic=labs$/);
    await expect(page.locator('h1')).toHaveText('Labs');
  });
});

test.describe('topic page', () => {
  test('lists a topic with its count, mosaic and working menus', async ({ page }) => {
    await page.goto('/en/search.html?topic=ai-observatory', { waitUntil: 'load' });
    await expect(page.locator('h1')).toHaveText('AI Observatory');
    await expect(page).toHaveTitle('AI Observatory · AFFLATUS');
    await expect(page.locator('.topic-count')).toHaveText('5 results');
    await expect(page.locator('.topic-result')).toHaveCount(5);
    await expect(page.locator('.topic-mosaic img')).toHaveCount(5);
    await expect(page.locator('.topic-result h2 a').first()).toHaveAttribute('href', '/en/sectors.html');
    const button = page.locator('.topic-result .related-trigger').first();
    await button.click();
    await expect(page.locator('.related-more')).toHaveAttribute('href', '/en/search.html?topic=ai-observatory');
    await page.keyboard.press('Escape');
    await expect(button).toBeFocused();
  });

  test('renders Chinese results, with novels linked under /zh/', async ({ page }) => {
    await page.goto('/zh/search.html?topic=serials', { waitUntil: 'load' });
    await expect(page.locator('h1')).toHaveText('连载');
    await expect(page.locator('.topic-count')).toHaveText('4 条结果');
    await expect(page.getByRole('link', { name: '玉熙宫词' })).toHaveAttribute('href', '/zh/novels/yuxi-gongci/');
  });

  for (const search of ['?topic=not-a-topic', '?topic=%3Cimg%20src%3Dx%3E', '']) {
    test(`shows the empty state and every topic for "${search}"`, async ({ page }) => {
      await page.goto(`/en/search.html${search}`, { waitUntil: 'load' });
      await expect(page.locator('h1')).toHaveText('All topics');
      await expect(page.locator('.topic-note')).toHaveCount(search ? 1 : 0);
      await expect(page.locator('.topic-result')).toHaveCount(6);
      await expect(page.locator('.topic-result h2 a').first()).toHaveAttribute('href', '/en/search.html?topic=ai-observatory');
    });
  }

  test('is a single column at 979px and keeps within the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 979, height: 800 });
    await page.goto('/en/search.html?topic=fde-course', { waitUntil: 'load' });
    await expect(page.locator('.topic-result').first()).toBeVisible();
    const mosaic = await page.locator('.topic-mosaic').boundingBox();
    const panel = await page.locator('.topic-panel').boundingBox();
    expect(panel.y).toBeGreaterThanOrEqual(mosaic.y + mosaic.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('the shared header and footer language links stay on the page', async ({ page }) => {
    await page.goto('/en/search.html?topic=labs', { waitUntil: 'load' });
    await expect(page.locator('#afflatus-header')).toBeVisible();
    await expect(page.locator('[data-footer-language="zh"]')).toHaveAttribute('href', '/zh/search.html');
  });
});
