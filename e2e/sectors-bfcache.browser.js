import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { rankMetric } from '../src/sectors/frontier/frontier-core.mjs';

const snapshot = JSON.parse(readFileSync('public/data/sectors-frontier/2026-09-23.json', 'utf8'));

async function probe(page) {
  return page.evaluate(() => {
    const record = window.__realBfcache = { id: crypto.randomUUID(), events: [] };
    for (const type of ['pagehide', 'pageshow']) {
      addEventListener(type, event => record.events.push({ type, persisted: event.persisted, trusted: event.isTrusted }));
    }
    return record.id;
  });
}

async function restored(page, id, count) {
  // A reload, an ordinary history navigation, or a synthetic event must fail.
  await expect.poll(() => page.evaluate(() => window.__realBfcache?.id)).toBe(id);
  await expect.poll(() => page.evaluate(() => window.__realBfcache.events.filter(e => e.type === 'pageshow' && e.persisted && e.trusted).length)).toBe(count);
  expect(await page.evaluate(() => window.__realBfcache.events.every(e => e.persisted && e.trusted))).toBe(true);
}

for (const locale of ['en', 'zh']) {
  test(`${locale}: real back/forward cache preserves Frontier and live handlers`, async ({ page, browser }, testInfo) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/${locale}/sectors.html`);
    const host = page.locator('#sectorsFrontier');
    await expect(host.locator('tr[data-row]')).toHaveCount(13);
    await host.locator('[name=metric]').selectOption('gdpval');
    await host.locator('[name=geography]').selectOption('CN');
    await host.locator('[name=openOnly]').check();
    await host.locator('tr[data-row] button').last().click();
    const selected = await host.locator('.fc-dossier h3').textContent();
    await page.locator('[data-story-step=system]').click();
    await expect(page.locator('[data-node-controls] button')).toHaveCount(8);
    await host.locator('[name=metric]').scrollIntoViewIfNeeded();
    const y = await page.evaluate(() => scrollY);
    const sectorsId = await probe(page);

    // Full document navigation followed by actual browser history traversal.
    await page.goto(`/${locale}/course.html`);
    const courseId = await probe(page);
    const rounds = [];
    const forwardRounds = [];
    for (let round = 1; round <= 2; round++) {
      await page.goBack({ waitUntil: 'commit' });
      await restored(page, sectorsId, round);
      await expect(page.locator('#frontierTaskStory')).toHaveAttribute('data-step', 'system');
      await expect(page.locator('[data-relationship]')).toHaveCount(12);
      await expect(host.locator('[name=metric]')).toHaveValue('gdpval');
      await expect(host.locator('[name=geography]')).toHaveValue('CN');
      await expect(host.locator('[name=openOnly]')).toBeChecked();
      await expect(host.locator('.fc-dossier h3')).toHaveText(selected);
      expect(Math.abs(await page.evaluate(() => scrollY) - y)).toBeLessThanOrEqual(2);
      rounds.push(await page.evaluate(() => structuredClone(window.__realBfcache)));
      await page.goForward({ waitUntil: 'commit' });
      await restored(page, courseId, round);
      forwardRounds.push(await page.evaluate(() => structuredClone(window.__realBfcache)));
    }
    await page.goBack({ waitUntil: 'commit' });
    await restored(page, sectorsId, 3);
    await page.locator('[data-node-controls] button').filter({ hasText: 'Micron' }).click();
    await expect(page.locator('[data-relationship]')).toHaveCount(4);
    await page.locator('[data-show-all]').click();
    await expect(page.locator('[data-relationship]')).toHaveCount(12);
    await host.locator('[name=geography]').selectOption('US');
    await host.locator('[name=openOnly]').uncheck();
    const expected = rankMetric(snapshot, 'gdpval', { geography: 'US', openOnly: false });
    expect(await host.locator('tr[data-row]').evaluateAll(rows => rows.map(r => r.dataset.row))).toEqual(expected.ranked.map(r => r.model.id));
    const row = host.locator('tr[data-row]').last();
    await row.locator('button').click();
    await expect(host.locator('.fc-dossier h3')).toHaveText(await row.locator('button').textContent());
    await page.evaluate(() => {
      document.documentElement.dataset.afflatusLocale = 'inline';
      window.AfflatusI18N.set(document.documentElement.lang.startsWith('zh') ? 'en' : 'zh');
    });
    await expect(host.locator('.fc-header h2')).toContainText(locale === 'en' ? '同一条前沿' : 'One frontier');
    await expect(host.locator('.fc-controls')).toHaveCount(1);
    await expect(host.locator('.fc-static-fallback')).toHaveCount(0);
    await expect(page.locator('#afflatus-header')).toHaveCount(1);
    expect(errors).toEqual([]);
    const evidencePath = testInfo.outputPath('native-bfcache-evidence.json');
    writeFileSync(evidencePath, JSON.stringify({ browser: browser.version(), locale, selected, scrollY: y, rounds, forwardRounds, final: await page.evaluate(() => window.__realBfcache), errors }, null, 2));
    await testInfo.attach('native-bfcache-evidence', { path: evidencePath, contentType: 'application/json' });
    await page.screenshot({ path: testInfo.outputPath('restored.png') });
  });
}
