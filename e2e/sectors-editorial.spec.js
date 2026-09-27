import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const copy = JSON.parse(readFileSync('docs/Afflatus-Sectors-Frontier-V2/data/editorial-copy.json', 'utf8'));
const acts = ['capability', 'supply', 'migration', 'issuers', 'evidence'];

for (const locale of ['en', 'zh']) {
  test(`${locale}: exact editorial copy, five acts and archive anchors without scripts`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:4173/${locale}/sectors.html`);
    await expect(page.locator('h1')).toHaveText(copy.hero.title[locale]);
    await expect(page.locator('.frontierDate')).toHaveText(copy.hero.date_notice[locale]);
    for (const chapter of copy.chapters) {
      const heading = page.locator(`#frontier-${chapter.id}-heading`);
      await expect(heading).toHaveText(chapter.title[locale]);
      await expect(heading.locator('xpath=following-sibling::p[1]')).toHaveText(chapter.body[locale]);
    }
    expect(await page.locator('.frontierIndex a').evaluateAll(links => links.map(a => a.hash.slice(1)))).toEqual(acts);
    await expect(page.locator('.fc-static-fallback tbody tr')).toHaveCount(14);
    const contract = await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map(el => el.id);
      return {
        duplicates: ids.filter((id, i) => ids.indexOf(id) !== i),
        missing: [...document.querySelectorAll('main a[href^="#"]')].filter(a => !document.getElementById(a.hash.slice(1))).map(a => a.hash),
        graphInDisclosure: !!document.querySelector('#storyGraphSection').closest('details'),
      };
    });
    expect(contract).toEqual({ duplicates: [], missing: [], graphInDisclosure: false });
    await page.locator('.atlasArchive a[href="#k3Heading"]').click();
    await expect(page.locator('#k3Heading')).toBeInViewport();
    await expect(page.locator('#researchArchive>summary')).toContainText('2026');
    await context.close();
  });
}

test('desktop and mobile retain one live board, navigable story and graph', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const [locale, width, height] of [['en', 1440, 1000], ['zh', 390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto(`/${locale}/sectors.html`);
    await expect(page.locator('.fc-controls')).toHaveCount(1);
    await expect(page.locator('#sectorsFrontier tr[data-row]')).toHaveCount(13);
    await expect(page.locator('#afflatus-header')).toHaveCount(1);
    await page.screenshot({ path: `tmp/sectors-frontier-p1/${locale}-hero.png` });
    for (const act of acts) {
      await page.locator(`.frontierIndex a[href="#${act}"]`).click();
      await expect(page.locator(`#frontier-${act}-heading`)).toBeInViewport();
    }
    await page.locator('.frontierActions a[href="#sectorsFrontier"]').click();
    await expect(page.locator('.fc-header h2')).toBeInViewport();
    await page.locator('#atlasStages button[data-stage="memory"]').click();
    await expect(page.locator('#atlasExplanation h2')).toHaveText(locale === 'zh' ? '内存与网络' : 'Memory & networks');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('#capability').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `tmp/sectors-frontier-p1/${locale}-story.png` });
  }
  expect(errors).toEqual([]);
});
