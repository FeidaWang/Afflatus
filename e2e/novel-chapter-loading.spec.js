import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// P1-8: a chapter page already carries its own body. The reader must adopt
// it, fetch only the small table of contents, load other chapters one at a
// time, and never replace the visible text with an error.
const book = JSON.parse(readFileSync('public/novels/yuxi-gongci.json', 'utf8'));
const chapter = (id) => book.chapters.find((item) => String(item.id) === String(id));
const firstLine = (id) => chapter(id).blocks.find((block) => block.type !== 'sys').text.slice(0, 24);
const WHOLE_BOOK = /\/novels\/[a-z0-9-]+\.json$/;

function recordRequests(page) {
  const paths = [];
  page.on('request', (request) => paths.push(new URL(request.url()).pathname));
  return paths;
}

async function openReader(page, path) {
  await page.goto(path, { waitUntil: 'load' });
  await expect(page.locator('body')).toHaveAttribute('data-reader-view', 'reading');
}

test('a chapter page reads its prerendered body without downloading the book', async ({ page }) => {
  const paths = recordRequests(page);
  await openReader(page, '/zh/novels/yuxi-gongci/100/');

  await expect(page.locator('#chapterTitle')).toHaveText(chapter(100).title);
  await expect(page.locator('#chapterBody')).toContainText(firstLine(100));
  expect(paths).toContain('/novels-data/yuxi-gongci/toc.json');
  expect(paths).not.toContain('/novels-data/yuxi-gongci/chapters/100.json');
  expect(paths.filter((path) => WHOLE_BOOK.test(path))).toEqual([]);
});

test('turning chapters loads only the chapters being read', async ({ page }) => {
  const paths = recordRequests(page);
  await openReader(page, '/zh/novels/yuxi-gongci/100/');

  await page.locator('#nextChapter').click();
  await expect(page.locator('#chapterTitle')).toHaveText(chapter(101).title);
  await expect(page.locator('#chapterBody')).toContainText(firstLine(101));
  await expect(page).toHaveURL(/\/zh\/novels\/yuxi-gongci\/101\/$/);

  await page.locator('#prevChapter').click();
  await expect(page.locator('#chapterTitle')).toHaveText(chapter(100).title);
  await expect(page.locator('#chapterBody')).toContainText(firstLine(100));

  const chapterFiles = [...new Set(paths.filter((path) => path.includes('/chapters/')))];
  expect(chapterFiles.length).toBeLessThanOrEqual(2);
  expect(paths.filter((path) => WHOLE_BOOK.test(path))).toEqual([]);
});

test('continuous reading appends the next chapter on demand', async ({ page }) => {
  await openReader(page, '/zh/novels/yuxi-gongci/100/');
  await page.getByRole('button', { name: '阅读设置', exact: true }).click();
  await page.locator('#layoutToggle').click();

  const sections = page.locator('#waterfallList .wf-chapter');
  await expect(sections.first()).toContainText(firstLine(100));
  await expect(sections.nth(1)).toContainText(firstLine(101));
  await page.locator('#wfSentinel').scrollIntoViewIfNeeded();
  await expect(sections.nth(2)).toContainText(firstLine(102));
});

test('a failed data request keeps the prerendered chapter on screen', async ({ page }) => {
  await page.route('**/novels-data/**', (route) => route.abort());
  await page.route(WHOLE_BOOK, (route) => route.abort());
  await page.goto('/zh/novels/yuxi-gongci/100/', { waitUntil: 'load' });

  await expect(page.locator('#toast')).toContainText('网络不太稳定');
  await expect(page.locator('#chapterTitle')).toHaveText(chapter(100).title);
  await expect(page.locator('#chapterBody')).toContainText(firstLine(100));
  await expect(page.locator('#chapterBody')).not.toContainText('暂时无法读取小说数据');
});

test('whole-book entries cached by earlier versions are ignored and dropped', async ({ page }) => {
  await page.goto('/zh/serial.html', { waitUntil: 'load' });
  const seeded = await page.evaluate(async () => {
    if (typeof caches === 'undefined') return false;
    const cache = await caches.open('afflatus-json-v1');
    await cache.put('/novels/yuxi-gongci.json', new Response('{"id":"yuxi-gongci","chapters":[]}', {
      headers: { 'content-type': 'application/json', 'x-afflatus-cached-at': String(Date.now()) },
    }));
    return true;
  });
  test.skip(!seeded, 'CacheStorage is unavailable in this browser context');

  await openReader(page, '/zh/novels/yuxi-gongci/100/');
  await expect(page.locator('#chapterBody')).toContainText(firstLine(100));
  await expect.poll(() => page.evaluate(async () => {
    const cache = await caches.open('afflatus-json-v1');
    return (await cache.keys()).map((request) => new URL(request.url).pathname);
  })).not.toContain('/novels/yuxi-gongci.json');
});

test('the library keeps the /zh/ prefix and the adaptive shelf canonicalizes to it', async ({ page }) => {
  await openReader(page, '/zh/novels/wanjie-zhongchun/1/');
  await page.locator('#readerBack').click();
  await expect(page).toHaveURL(/\/zh\/serial\.html$/);

  await page.goto('/serial.html', { waitUntil: 'load' });
  await expect(page.locator('body')).toHaveClass(/\breader-enhanced\b/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://feida.au/zh/serial.html');
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', 'https://feida.au/zh/serial.html');
});
