import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { rankMetric } from '../src/sectors/frontier/frontier-core.mjs';

const snapshot = JSON.parse(readFileSync('public/data/sectors-frontier/2026-09-27.json', 'utf8'));
const dataPath = '**/data/sectors-frontier/2026-09-27.json';
const rankedCount = rankMetric(snapshot, 'intelligence').ranked.length;

test('comparison filters, dossiers, evidence, language and persisted lifecycle', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/en/sectors.html');
  const host = page.locator('#sectorsFrontier');
  await expect(host.locator('.fc-meta')).toContainText('27 September 2026');
  await expect(host.locator('.fc-table-scroll tbody tr')).toHaveCount(rankedCount);
  await expect(host.locator('.fc-exclusions')).toContainText('MiniMax-M3');
  await expect(host.locator('.fc-exclusions')).toContainText('Source conflict; unranked');
  for (const { id } of snapshot.metrics) {
    await host.locator('[name=metric]').selectOption(id);
    await host.locator('[name=geography]').selectOption('CN');
    await host.locator('[name=openOnly]').check();
    const expected = rankMetric(snapshot, id, { geography: 'CN', openOnly: true });
    await expect(host.locator('tr[data-row]')).toHaveCount(expected.ranked.length);
    expect(await host.locator('tr[data-row]').evaluateAll(rows => rows.map(r => r.dataset.row)))
      .toEqual(expected.ranked.map(r => r.model.id));
  }
  await host.locator('[name=geography]').selectOption('all');
  await host.locator('[name=openOnly]').uncheck();
  const missingMetric = snapshot.metrics.find(m => rankMetric(snapshot, m.id).excluded.some(r => r.reason === 'not_retrieved'));
  await host.locator('[name=metric]').selectOption(missingMetric.id);
  await expect(host.locator('.fc-exclusions')).toContainText('Not retrieved');
  await host.locator('[name=metric]').selectOption('intelligence');
  const point = host.locator('.fc-point').last();
  const modelId = await point.getAttribute('data-model');
  await point.focus();
  await expect(host.locator('.fc-dossier h3')).toHaveText(snapshot.models.find(m => m.id === modelId).name);
  await point.press('Enter');
  const row = host.locator('tr[data-row]').first();
  await row.locator('button').click();
  await expect(host.locator('.fc-dossier h3')).toHaveText(await row.locator('button').textContent());
  const sources = new Set(snapshot.sources.map(s => new URL(s.url).href));
  for (const url of await host.locator('a').evaluateAll(links => links.map(a => a.href))) {
    const parsed = new URL(url);
    if (parsed.origin === new URL(page.url()).origin && parsed.hash) {
      await expect(page.locator(parsed.hash)).toHaveCount(1);
    } else expect(sources.has(url)).toBe(true);
  }
  await host.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'tmp/sectors-frontier-p0/desktop.png' });
  await page.evaluate(() => {
    document.documentElement.dataset.afflatusLocale = 'inline';
    window.AfflatusI18N.set('zh');
  });
  await expect(host.locator('.fc-header h2')).toContainText('同一条前沿');
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await host.locator('[name=geography]').selectOption('CN');
  await expect(host.locator('.fc-origin').first()).toHaveText('CN');
  await expect(page.locator('#storyGraphSection')).toBeVisible();
  await expect(page.locator('#afflatus-header')).toHaveCount(1);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
  await expect(host.locator('.fc-static-fallback')).toBeVisible();
  await expect(host.locator('.fc-controls')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('mobile Chinese route stays within viewport with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/zh/sectors.html');
  const host = page.locator('#sectorsFrontier');
  await expect(host.locator('.fc-header h2')).toContainText('同一条前沿');
  await host.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await host.locator('[name=geography]').selectOption('CN');
  await host.locator('[name=openOnly]').check();
  await expect(host.locator('.fc-origin').first()).toHaveText('CN');
  await page.screenshot({ path: 'tmp/sectors-frontier-p0/mobile.png' });
});

test('billing uses entered tokens and empty filters recover without invented values', async ({ page }) => {
  await page.goto('/en/sectors.html');
  const host = page.locator('#sectorsFrontier');
  await expect(host.locator('tr[data-row]')).toHaveCount(rankedCount);
  const priced = snapshot.models.find(m => m.status === 'reported_snapshot' && m.prices.cache_read !== null);
  await host.locator(`tr[data-row="${priced.id}"] button`).click();
  await host.locator('[name=uncachedInput]').fill('1000000');
  await host.locator('[name=cacheRead]').fill('2000000');
  await host.locator('[name=output]').fill('3000000');
  await host.locator('[data-role=billing] button').click();
  const bill = priced.prices.input + 2 * priced.prices.cache_read + 3 * priced.prices.output;
  await expect.poll(async () => {
    const text = await host.locator('.fc-bill-result').textContent();
    return Number(text.match(/\$([\d,.]+) USD/)?.[1].replaceAll(',', ''));
  }).toBe(bill);

  const unknown = snapshot.models.find(m => m.status === 'reported_snapshot' && m.prices.cache_read === null);
  await host.locator(`tr[data-row="${unknown.id}"] button`).click();
  await expect(host.locator('.fc-bill-result')).toContainText('A required price is unavailable');

  const empty = snapshot.metrics.flatMap(metric => ['US', 'CN'].map(geography => ({ metric: metric.id, geography })))
    .find(({ metric, geography }) => rankMetric(snapshot, metric, { geography, openOnly: true }).ranked.length === 0);
  expect(empty).toBeTruthy();
  await host.locator('[name=metric]').selectOption(empty.metric);
  await host.locator('[name=geography]').selectOption(empty.geography);
  await host.locator('[name=openOnly]').check();
  await expect(host.locator('tr[data-row]')).toHaveCount(0);
  await expect(host.locator('.fc-table-scroll')).toContainText('No matching observations');
  await host.locator('[name=metric]').selectOption('intelligence');
  await host.locator('[name=geography]').selectOption('all');
  await host.locator('[name=openOnly]').uncheck();
  await expect(host.locator('tr[data-row]')).toHaveCount(rankedCount);
});

test('snapshot fetch failure preserves localized source table', async ({ page }) => {
  await page.route(dataPath, route => route.abort());
  await page.goto('/zh/sectors.html');
  const fallback = page.locator('#sectorsFrontier .fc-static-fallback');
  await expect(fallback.locator('h2')).toContainText('公开评测快照');
  await expect(fallback.locator('tbody tr')).toHaveCount(14);
  await expect(fallback).toContainText('待核对，未排名');
  await expect(fallback).toContainText('来源报告数值，未经本站复测');
  await expect(page.locator('#atlasStages button').first()).toBeVisible();
});

test('script failure retains meaningful bilingual build output', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const [locale, heading] of [['en', 'Public evaluation snapshot'], ['zh', '公开评测快照']]) {
    await page.goto(`http://127.0.0.1:4173/${locale}/sectors.html`);
    const fallback = page.locator('#sectorsFrontier .fc-static-fallback');
    await expect(fallback.locator('h2')).toContainText(heading);
    await expect(fallback.locator('tbody tr')).toHaveCount(14);
    await expect(fallback).toContainText(locale === 'zh' ? '来源报告数值，未经本站复测' : 'source-reported, not rerun');
    await expect(fallback.locator('a').first()).toHaveAttribute('href', /^https:/);
  }
  await context.close();
});

test('late snapshot cannot mount after nonpersisted teardown', async ({ page }) => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route(dataPath, async route => {
    await pending;
    await route.fulfill({ json: snapshot });
  });
  await page.goto('/en/sectors.html');
  await expect(page.locator('#atlasStages button').first()).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
  release();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#sectorsFrontier .fc-static-fallback')).toBeVisible();
  await expect(page.locator('#sectorsFrontier .fc-controls')).toHaveCount(0);
});
