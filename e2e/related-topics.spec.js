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

  test('opens with the topic summary, a dated newest-first tree, one related card and a link onward', async ({ page }) => {
    await page.goto('/zh/', { waitUntil: 'load' });
    await trigger(page, '相关内容： AI 观察站').click();
    const panel = page.getByRole('dialog', { name: '相关内容' });
    await expect(panel.locator('.related-summary')).toContainText('塑造 AI');
    await expect(panel.locator('.related-tree-root')).toHaveText('AI 观察站');
    const nodes = panel.locator('.related-tree li');
    await expect(nodes).toHaveCount(5);
    const dates = await nodes.locator('time').evaluateAll((times) => times.map((time) => time.dateTime));
    expect(dates).toEqual([...dates].sort().reverse());
    await expect(nodes.first()).toContainText('Haiku 5.5');
    await expect(nodes.first().locator('a')).toHaveAttribute('href', '/zh/sectors.html#event-haiku55-launch');
    await expect(panel.locator('.related-tree-branches path')).toHaveCount(5);
    // Measured together, since the panel may still be scrolling into view.
    const { node, link } = await nodes.first().evaluate((item) => ({ node: item.offsetHeight, link: item.querySelector('a').offsetHeight }));
    expect(link).toBe(node);
    expect(node).toBeGreaterThanOrEqual(44);
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

  for (const [width, height] of [[1280, 800], [390, 844]]) {
    for (const path of ['/en/', '/en/search.html?topic=ai-observatory']) {
      test(`scrolls fully into view below the header at ${width}x${height} on ${path}`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await page.goto(path, { waitUntil: 'load' });
        const button = page.locator(path === '/en/' ? '.related-trigger >> nth=0' : '.topic-result .related-trigger >> nth=1');
        await button.scrollIntoViewIfNeeded();
        await button.click();
        await expect(page.locator('.related-card')).toBeVisible();
        const panel = page.locator('.related-panel');
        await expect(async () => {
          const box = await panel.boundingBox();
          expect(box.y).toBeGreaterThanOrEqual(68);
          expect(box.y + box.height).toBeLessThanOrEqual(height);
        }).toPass();
      });
    }
  }

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

test.describe('tree links', () => {
  test('a Fed Watch node opens, highlights and shows its record', async ({ page }) => {
    await page.goto('/en/', { waitUntil: 'load' });
    await trigger(page, 'Related to Fed Watch').click();
    const node = page.locator('.related-tree li a').last();
    const href = await node.getAttribute('href');
    expect(href).toMatch(/^\/en\/signal\.html#.+/);
    await node.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    const record = page.locator(`[id="${decodeURIComponent(href.split('#')[1])}"]`);
    await expect(record).toBeInViewport();
    await expect(record).toHaveClass(/is-linked/);
    await expect(record.locator('details')).toHaveJSProperty('open', true);
    expect((await record.boundingBox()).y).toBeGreaterThan(60);
  });

  test('an AI Observatory node opens, highlights and shows its event', async ({ page }) => {
    await page.goto('/zh/', { waitUntil: 'load' });
    await trigger(page, '相关内容： AI 观察站').click();
    const node = page.locator('.related-tree li a').first();
    const href = await node.getAttribute('href');
    expect(href).toMatch(/^\/zh\/sectors\.html#event-.+/);
    await node.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    const event = page.locator(`[id="${href.split('#')[1]}"]`);
    await expect(event).toBeInViewport();
    await expect(event).toHaveClass(/is-linked/);
    await expect(event.locator('details')).toHaveJSProperty('open', true);
  });

  test('a Serials node opens the latest chapter of the work', async ({ page }) => {
    await page.goto('/zh/search.html?topic=serials', { waitUntil: 'load' });
    await page.locator('.topic-result .related-trigger').first().click();
    const node = page.locator('.related-tree li a').filter({ hasText: '万界种春' });
    await expect(node).toHaveAttribute('href', /^\/zh\/novels\/wanjie-zhongchun\/[^/]+\/$/);
    const href = await node.getAttribute('href');
    await node.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.locator('h1, h2').filter({ hasText: '第' }).first()).toBeVisible();
  });

  test('the finished novel\'s node stays on its landing page', async ({ page }) => {
    await page.goto('/zh/search.html?topic=serials', { waitUntil: 'load' });
    await page.locator('.topic-result').filter({ hasText: '万界种春' }).locator('.related-trigger').click();
    await expect(page.locator('.related-tree li a').filter({ hasText: '玉熙宫词' })).toHaveAttribute('href', '/zh/novels/yuxi-gongci/');
  });

  test('a course node opens that week\'s book', async ({ page }) => {
    await page.goto('/en/search.html?topic=fde-course', { waitUntil: 'load' });
    await page.locator('.topic-result .related-trigger').first().click();
    const node = page.locator('.related-tree li a').first();
    await expect(node).toHaveAttribute('href', /^\/en\/course\/book-\d+\.html$/);
    await node.click();
    await expect(page).toHaveURL(/\/en\/course\/book-\d+\.html$/);
  });

  test('a record further down the list is still reachable by its link', async ({ page }) => {
    await page.goto('/en/signal.html', { waitUntil: 'load' });
    const oldest = await page.evaluate(async () => {
      const { events } = await (await fetch('/signal-events.json')).json();
      return [...events].sort((a, b) => a.date.localeCompare(b.date))[0].id;
    });
    await page.goto(`/en/signal.html#${oldest}`, { waitUntil: 'load' });
    await expect(page.locator(`[id="${oldest}"]`)).toBeInViewport();
  });

  test('an observatory node lands on its event', async ({ page }) => {
    await page.goto('/en/sectors.html#event-haiku55-launch', { waitUntil: 'load' });
    const event = page.locator('#event-haiku55-launch');
    await expect(event.locator('details')).toHaveJSProperty('open', true);
    await expect(event).toBeInViewport();
    expect((await event.boundingBox()).y).toBeGreaterThan(60);
  });
});

test.describe('topic page', () => {
  test('lists a topic with its count, mosaic and working menus', async ({ page }) => {
    await page.goto('/en/search.html?topic=ai-observatory', { waitUntil: 'load' });
    await expect(page.locator('h1')).toHaveText('AI Observatory');
    await expect(page).toHaveTitle('AI Observatory · AFFLATUS');
    const { entries } = await page.evaluate(async () => (await fetch('/topics-index.json')).json());
    const own = entries.filter((entry) => entry.topic.includes('ai-observatory'));
    await expect(page.locator('.topic-count')).toHaveText(`${own.length} results`);
    await expect(page.locator('.topic-result')).toHaveCount(10);
    const dates = await page.locator('.topic-result time').evaluateAll((times) => times.map((time) => time.dateTime));
    expect(dates).toEqual([...dates].sort().reverse());
    const covers = await page.locator('.topic-mosaic img').evaluateAll((images) => images.map((image) => new URL(image.src).pathname));
    expect(covers).toHaveLength(5);
    const ownCovers = new Set(own.filter((entry) => entry.cover).map((entry) => entry.cover.en));
    expect(covers.every((cover) => ownCovers.has(cover))).toBe(true);
    await expect(page.locator('.topic-result h2 a').first()).toHaveAttribute('href', '/en/sectors.html');
    const button = page.locator('.topic-result .related-trigger').first();
    await button.click();
    await expect(page.locator('.related-more')).toHaveAttribute('href', '/en/search.html?topic=ai-observatory');
    await page.keyboard.press('Escape');
    await expect(button).toBeFocused();
  });

  test('shows ten results and reveals ten more on each click, keeping the order', async ({ page }) => {
    await page.goto('/en/search.html?topic=ai-observatory', { waitUntil: 'load' });
    const { entries } = await page.evaluate(async () => (await fetch('/topics-index.json')).json());
    const total = entries.filter((entry) => entry.topic.includes('ai-observatory')).length;
    const results = page.locator('.topic-result');
    const more = page.getByRole('button', { name: 'Load more' });
    await expect(results).toHaveCount(10);
    await more.click();
    await expect(results).toHaveCount(20);
    await expect(results.nth(10).locator('h2 a')).toBeFocused();
    await more.click();
    await expect(results).toHaveCount(Math.min(30, total));
    await expect(more).toHaveCount(total > 30 ? 1 : 0);
    await expect(page.locator('.topic-count')).toHaveText(`${total} results`);
    const dates = await page.locator('.topic-result time').evaluateAll((times) => times.map((time) => time.dateTime));
    expect(dates).toEqual([...dates].sort().reverse());
  });

  test('labels the button in Chinese, and leaves it out of a short topic', async ({ page }) => {
    await page.goto('/zh/search.html?topic=fde-course', { waitUntil: 'load' });
    await expect(page.locator('.topic-more')).toHaveText('加载更多');
    await expect(page.locator('.topic-more span')).toHaveAttribute('data-en', 'Load more');
    await page.goto('/zh/search.html?topic=serials', { waitUntil: 'load' });
    await expect(page.locator('.topic-result')).toHaveCount(4);
    await expect(page.locator('.topic-more')).toHaveCount(0);
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
      await expect(page.locator('.topic-result')).toHaveCount(7);
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
