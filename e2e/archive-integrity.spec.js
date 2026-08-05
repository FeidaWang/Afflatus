import { expect, settlePage, test } from './site-fixture.js';
import { readFileSync } from 'node:fs';

const currentLeagues = JSON.parse(readFileSync('public/leagues-data.json', 'utf8'));

test.describe('prediction archive integrity', () => {
  test('renders the settled MSI final in the unified Stats archive', async ({ page }) => {
    await page.goto('/stats.html', { waitUntil: 'domcontentloaded' });
    await settlePage(page);

    const summary = page.locator('#msiStrip .stat b');
    await expect(summary.nth(0)).toHaveText('14');
    await expect(summary.nth(1)).toHaveText('50%');
    await expect(page.locator('#msiChampNote')).toContainText('Actual champion: HLE');
    await expect(page.locator('#msiMvps')).toContainText('Actual Finals MVP: Zeus · HLE');
    await expect(page.locator('#msiLog tbody tr')).toHaveCount(14);
  });

  test('replaces a fresh but older CacheStorage archive before rendering League', async ({ page }) => {
    const cachedLeagues = {
      ...currentLeagues,
      version: currentLeagues.version - 1,
      note_en: 'Previous validated archive.',
    };

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async ({ payload }) => {
      const cache = await caches.open('afflatus-json-v1');
      await cache.put('/leagues-data.json', new Response(JSON.stringify(payload), {
        headers: {
          'content-type': 'application/json',
          'x-afflatus-cached-at': String(Date.now()),
        },
      }));
    }, { payload: cachedLeagues });

    await page.goto('/league.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#updated')).toContainText(`v${currentLeagues.version}`);
    await expect(page.locator('#record')).toContainText('7/14');
  });

  test('switches legacy archives to Chinese without leaving the document', async ({ page }) => {
    await page.goto('/games.html', { waitUntil: 'domcontentloaded' });
    const before = page.url();
    await page.locator('.lang-toggle').click();

    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
    await expect(page.locator('.hero h2')).toHaveText('预言冠军之路');
    await expect(page.locator('#updated')).toContainText('非投资建议');
    expect(page.url()).toBe(before);
  });
});
