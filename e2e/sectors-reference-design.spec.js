import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { rankMetric } from '../src/sectors/frontier/frontier-core.mjs';

const snapshot = JSON.parse(readFileSync('public/data/sectors-frontier/2026-09-27.json', 'utf8'));
const rankedCount = rankMetric(snapshot, 'intelligence').ranked.length;
const ranked = rankMetric(snapshot, 'intelligence').ranked;
const costOf = (id) => snapshot.observations.find((o) => o.model_id === id && o.metric_id === 'cost_task').value;
const evidence = 'docs/sectors-reference-design-2026-09-27';
mkdirSync(evidence, { recursive: true });

for (const locale of ['en', 'zh']) {
  test(`${locale}: production entry and four editorial measures render their actual observations`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/${locale}/sectors.html#frontierEditorial`);
    await expect(page.locator('.frontierEditorialRow')).toHaveCount(10);
    for (const metric of ['intelligence', 'terminal', 'scicode', 'lcr']) {
      await page.locator(`[data-editorial-metric="${metric}"]`).click();
      await expect(page.locator(`[data-editorial-metric="${metric}"]`)).toHaveAttribute('aria-pressed', 'true');
      const expected = snapshot.models.map(model => ({
        model,
        observation: snapshot.observations.find(o => o.model_id === model.id && o.metric_id === metric && o.evidence_status === 'reported_snapshot' && Number.isFinite(o.value)),
      })).filter(row => row.observation).sort((a, b) => b.observation.value - a.observation.value).slice(0, 10);
      await expect(page.locator('.frontierEditorialRow')).toHaveCount(expected.length);
      expect(await page.locator('.editorialScore').allTextContents()).toEqual(expected.map(({ observation: o }) => `${o.value}${o.unit === 'percent' ? '%' : ''}`));
    }
    await page.locator('[data-editorial-metric="intelligence"]').click();
    await page.locator('#frontierEditorial').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${evidence}/${locale}-desktop-board.png` });
    await page.locator('#sourceWallOpen').click();
    await expect(page.locator('#sourceWall')).toBeVisible();
    await page.locator('#sourceWallSearch').fill('MiMo');
    await expect(page.locator('.sourceWallCard')).toHaveCount(1);
    // Search inputs consume Escape to clear their text; move focus first.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Escape');
    await expect(page.locator('#sourceWall')).not.toBeVisible();
    expect(errors).toEqual([]);
  });

  test(`${locale}: mobile disclosure, paired values and all supported widths`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/${locale}/sectors.html#frontierEditorial`);
    // Use the observed model id from this dated fixture rather than a label selector.
    const second = page.locator('.frontierEditorialRow').nth(1);
    await second.click();
    await expect(second).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.editorialInlineDetail:visible')).toHaveCount(1);
    await expect(page.locator('.editorialInlineDetail:visible h3')).toHaveText(ranked[1].model.name);
    await page.screenshot({ path: `${evidence}/${locale}-mobile-detail.png` });
    await second.click();
    await expect(page.locator('.editorialInlineDetail:visible')).toHaveCount(0);
    const mobile = page.locator('.fc-mobile-point');
    await expect(mobile).toHaveCount(rankedCount);
    await expect(page.locator('.fc-desktop-plot')).not.toBeVisible();
    await expect(mobile.first().locator('strong')).toHaveText([String(ranked[0].value), `$${costOf(ranked[0].model.id).toFixed(2)}`]);
    await mobile.nth(1).click();
    await expect(mobile.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.fc-dossier h3')).toHaveText(ranked[1].model.name);
    await page.locator('.fc-mobile-plot').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${evidence}/${locale}-mobile-pairs.png` });
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await expect(page.locator('.fc-desktop-plot')).toBeVisible();
    await expect(page.locator('.fc-mobile-plot')).not.toBeVisible();
    await page.locator('.fc-plot-section').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${evidence}/${locale}-desktop-plot.png` });
    await page.locator('#storyGraphSection').scrollIntoViewIfNeeded();
    await expect(page.locator('.atlasInkDrawing')).toHaveCount(5);
    await page.screenshot({ path: `${evidence}/${locale}-desktop-atlas.png` });
    await page.locator('#researchArchive > summary').click();
    await expect(page.locator('#researchArchive')).toHaveAttribute('open', '');
    await page.locator('#rivalryCost').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${evidence}/${locale}-archive.png` });
    await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
