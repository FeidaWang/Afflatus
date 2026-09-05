import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// This file explicitly exercises both pointer hover and touch input.
test.use({ hasTouch: true });

const url = lang => `/${lang}/portfolio.html?embed=1#chart-cycles`;
const tip = page => page.locator('#chart-cycles-tooltip');
const panel = (page, kind = 'cycles') => page.locator(`[aria-label="${kind === 'cycles' ? 'Closed-cycle trajectories' : 'Model / benchmark'} — Complete chart data"]`).filter({ has: page.locator('table') }).first();

for (const lang of ['en', 'zh']) for (const width of [1440, 390]) {
  test(`${lang} ${width}: hover / focus / tap, bounded tooltip and full table`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url(lang));
    const chart = page.locator('#chart-cycles');
    await expect(chart).toBeFocused();
    await expect(tip(page)).toContainText('260.4 %');
    const focused = await tip(page).innerText();
    await page.keyboard.press('Escape'); await expect(tip(page)).toBeHidden();
    await chart.locator('.route-efficiency').first().hover();
    await expect(tip(page)).toHaveText(focused);
    await page.keyboard.press('Escape');
    await chart.locator('.route-efficiency').first().tap();
    await expect(tip(page)).toHaveText(focused);
    await chart.focus(); await page.keyboard.press('ArrowRight');
    await expect(tip(page)).toContainText('17.5');
    await page.keyboard.press('End'); await expect(tip(page)).toContainText('XLE');
    await page.keyboard.press('Home'); await expect(tip(page)).toContainText('AVGO');
    const bounds = await tip(page).boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y).toBeGreaterThanOrEqual(0); expect(bounds.y + bounds.height).toBeLessThanOrEqual(900);
    await page.mouse.click(width - 2, 3); await expect(tip(page)).toBeHidden();
    expect(await chart.locator('[tabindex="0"]').count()).toBe(0);
    const data = chart.locator('+ .chart-inspector');
    await expect(data.locator('tbody tr')).toHaveCount(10);
    await expect(data.locator('caption')).toContainText(lang === 'zh' ? '完整图表数据' : 'Complete chart data');
    await expect(data.locator('thead th[scope="col"]')).toHaveCount(6);
    await expect(data.locator('tbody tr').first()).toContainText('260.4');
    await expect(data.locator('.chart-footnote')).toContainText('2026-08-08');
    await data.locator('.chart-table-region').evaluate(el => { el.scrollLeft = 400; });
    expect(await data.locator('.chart-table-region').evaluate(el => el.scrollLeft)).toBe(width < 720 ? 400 : 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await data.locator('td').first().evaluate(el => parseFloat(getComputedStyle(el).paddingLeft))).toBeGreaterThanOrEqual(10);
    expect(await data.evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThan(width < 720 ? width * .65 : 700);
    await data.locator('.chart-table-region').evaluate(el => { el.scrollLeft = 0; });
    await data.evaluate(el => el.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: test.info().outputPath(`${lang}-${width}-table.png`) });
  });
}

test('series filters keep scales, identities and complete table; footnote round trip', async ({ page }) => {
  await page.goto(url('en'));
  const data = panel(page);
  const before = await page.locator('.route-efficiency').first().getAttribute('style');
  const button = data.getByRole('button', { name: 'Annualized cycle efficiency', exact: false });
  await button.click(); await expect(button).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.route-efficiency').first()).toBeHidden();
  await expect(data.locator('tbody tr')).toHaveCount(10);
  await expect(data.locator('tbody tr').first()).toContainText('Hidden');
  await page.locator('#chart-cycles').focus(); await expect(tip(page)).toContainText('Holding days');
  await button.click(); expect(await page.locator('.route-efficiency').first().getAttribute('style')).toBe(before);
  await data.getByRole('link', { name: 'Source and method [1]' }).click();
  await expect(page).toHaveURL(/#chart-cycles-note$/);
  await data.getByRole('link', { name: 'Back to chart' }).click();
  await expect(page.locator('#chart-cycles')).toBeFocused();
  await page.goBack(); await expect(page).toHaveURL(/#chart-cycles-note$/);
});

test('copy success / failure and public deep link reopens the same chart', async ({ page, context }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedChart = text; } } }));
  await page.goto('/en/portfolio.html?private=secret&record=123#chart-cycles');
  const data = panel(page);
  await data.getByRole('button', { name: 'Copy chart link' }).click();
  await expect(data.locator('.chart-status')).toHaveText('Link copied');
  const copied = await page.evaluate(() => window.copiedChart);
  expect(new URL(copied).search).toBe('');
  const reopened = await context.newPage(); await reopened.goto(copied);
  await expect(reopened.locator('#chart-cycles')).toBeFocused(); await reopened.close();
  await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('Denied'); }; });
  await data.getByRole('button', { name: 'Copy chart link' }).click();
  await expect(data.locator('.chart-status')).toHaveText('Could not copy link');
});

test('tooltip remains readable at viewport edges and can itself be hovered', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 300 });
  await page.goto(url('zh'));
  const chart = page.locator('#chart-cycles');
  await chart.focus(); await page.keyboard.press('End');
  const box = await tip(page).boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(8); expect(box.y).toBeGreaterThanOrEqual(8);
  expect(box.x + box.width).toBeLessThanOrEqual(312); expect(box.y + box.height).toBeLessThanOrEqual(292);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 900 });
  await chart.locator('.route-efficiency').first().hover();
  await tip(page).hover(); await page.waitForTimeout(220);
  await expect(tip(page)).toBeVisible();
  await page.keyboard.press('Escape'); await expect(tip(page)).toBeHidden();
});

test('SVG and PNG downloads contain complete public figures, even with a tooltip open', async ({ page }) => {
  await page.goto(url('en'));
  const data = panel(page);
  for (const format of ['SVG', 'PNG']) {
    await page.locator('#chart-cycles').focus();
    await data.locator('summary').click();
    const downloadPromise = page.waitForEvent('download');
    await data.getByRole('button', { name: format, exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`chart-cycles.${format.toLowerCase()}`);
    const file = await download.path(); const buffer = await readFile(file);
    await download.saveAs(test.info().outputPath(`cycles.${format.toLowerCase()}`));
    if (format === 'SVG') {
      const svg = buffer.toString();
      for (const text of ['Closed-cycle trajectories', 'Source:', 'FY2025', '2026-08-08', 'Model estimate', 'AVGO', 'XLE', '260.4', '246', 'days']) expect(svg).toContain(text);
      expect(svg).not.toMatch(/tooltip|foreignObject|<animate|accountBalance/);
    } else {
      expect(buffer.subarray(1, 4).toString()).toBe('PNG');
      expect(buffer.readUInt32BE(16)).toBe(1920); expect(buffer.readUInt32BE(20)).toBeGreaterThan(1000);
    }
    await expect(data.locator('.chart-status')).toHaveText('Download started');
    await expect(tip(page)).toBeHidden();
  }
});

test('all supported figures export localized titles, units, provenance and status', async ({ page }) => {
  for (const lang of ['en', 'zh']) {
    await page.goto(`/${lang}/portfolio.html?embed=1#chart-allocation`);
    await expect(page.locator('.pick-card')).toHaveCount(10);
    for (const kind of ['core', 'benchmarks', 'cycles', 'allocation']) {
      const chart = page.locator(`#chart-${kind}`);
      const data = kind === 'allocation' ? chart.locator('.chart-inspector') : chart.locator('+ .chart-inspector');
      await data.locator('summary').click();
      const pending = page.waitForEvent('download');
      await data.getByRole('button', { name: 'SVG', exact: true }).click();
      const download = await pending;
      await download.saveAs(test.info().outputPath(`${lang}-${kind}.svg`));
      const svg = await readFile(await download.path(), 'utf8');
      expect(svg).toContain(lang === 'zh' ? '来源' : 'Source');
      expect(svg).toContain(kind === 'allocation' ? '2026-08-07' : '2026-08-08');
      expect(svg).toContain(kind === 'allocation' ? (lang === 'zh' ? '主观研究配置' : 'Subjective research') : (lang === 'zh' ? '模型' : 'Model'));
      expect(svg).not.toMatch(/NaN|undefined|<animate|<foreignObject/);
    }
  }
});

test('missing values stay absent and thousands of points do not join Tab order', async ({ page }) => {
  await page.goto(url('en'));
  await page.locator('#chart-cycles').evaluate(root => {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < 1000; i++) fragment.append(root.querySelector('.trade-route').cloneNode(true));
    root.append(fragment);
    root.querySelector('[data-chart-value]').textContent = '—';
  });
  const data = panel(page);
  await expect(data.locator('tbody tr')).toHaveCount(2010);
  await expect(data.locator('tbody tr').first()).toContainText('No data');
  expect(await page.locator('.efficiency-rail').first().evaluate(el => getComputedStyle(el, '::after').display)).toBe('none');
  await page.locator('#chart-cycles').focus(); await page.keyboard.press('Home');
  await expect(tip(page)).toContainText('No data');
  expect(await page.locator('#chart-cycles [tabindex="0"]').count()).toBe(0);
  // Oversized export is intentionally unavailable, full table remains accessible.
  await expect(data.locator('summary')).toHaveCount(0);
});

test('lazy owner replacement and busy data never expose an old record', async ({ page }) => {
  await page.route('**/homeExperience-*.js', async route => { await new Promise(resolve => setTimeout(resolve, 700)); await route.continue(); });
  await page.goto('/en/portfolio.html?embed=1#chart-allocation');
  const chart = page.locator('#chart-allocation'), tooltip = page.locator('#chart-allocation-tooltip');
  await chart.focus(); await page.keyboard.press('End'); await expect(tooltip).toContainText('VRT');
  await expect(page.locator('.pick-card')).toHaveCount(10);
  await chart.focus(); await page.keyboard.press('Home'); await expect(tooltip).toContainText('NVDA');
  await page.locator('#pickGrid').evaluate(el => el.setAttribute('aria-busy', 'true'));
  await expect(tooltip).toBeHidden();
  await page.keyboard.press('ArrowRight'); await expect(tooltip).toBeHidden();
  await page.locator('#pickGrid').evaluate(el => {
    el.querySelector('.pick-ticker').textContent = 'NEW-TEST-RECORD';
    el.querySelector('.alloc-num').textContent = '0%';
    el.removeAttribute('aria-busy');
  });
  await page.keyboard.press('Home'); await expect(tooltip).toContainText('NEW-TEST-RECORD');
  await expect(tooltip).not.toContainText('NVDA');
  await expect(chart.locator('tbody tr').first()).toContainText('0');
});
