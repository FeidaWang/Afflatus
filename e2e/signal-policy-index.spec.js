import { expect, test } from './site-fixture.js';

for (const locale of ['en', 'zh']) {
  test(`Signal ${locale}: intersect filters, inspect evidence and clear`, async ({ page }) => {
    await page.goto(`/${locale}/signal.html`);
    await expect(page.locator('.record-card')).toHaveCount(9);
    await page.locator('[data-topic="fed"]').click();
    await page.locator('#record-month').selectOption('2026-09');
    await page.locator('#record-search').fill('Cook');
    await expect(page.locator('.record-card')).toHaveCount(1);
    await expect(page.locator('.record-card h3')).toContainText('Cook');
    await page.locator('.record-card summary').click();
    await expect(page.locator('.record-detail')).toBeVisible();
    await expect(page.locator('.record-footer a')).toHaveAttribute('href', /cook20260928a/);
    await page.locator('[data-view="table"]').click();
    await expect(page.locator('#record-table tbody tr')).toHaveCount(1);
    await page.locator('#reset-records').click();
    await expect(page.locator('#record-search')).toHaveValue('');
    await expect(page.locator('#record-month')).toHaveValue('all');
    await expect(page.locator('#reset-records')).toBeHidden();
    await page.locator('[data-view="cards"]').click();
    await page.locator('#load-records').click();
    await expect(page.locator('.record-card')).toHaveCount(18);
    await page.locator('#record-search').fill('no-matching-policy-xyz');
    await expect(page.locator('.empty-records').first()).toBeVisible();
    await expect(page.locator('#load-records')).toBeHidden();
  });

  test(`Signal ${locale}: phone navigation, industry and locale preserve the section`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(`/${locale}/signal.html?review=policy`);
    const nav = page.locator('.signal-sidebar nav');
    const link = nav.locator('a[href="#industry-map"]');
    await link.focus();
    await link.press('Enter');
    await expect(page).toHaveURL(/#industry-map$/);
    await page.locator('[data-industry-shortcut="power"]').click();
    await expect(page.locator('#record-industry')).toHaveValue('power');
    await expect(page.locator('.record-card').first()).toBeVisible();
    await page.locator('[data-header-language]').click();
    const other = locale === 'en' ? 'zh' : 'en';
    await expect(page).toHaveURL(new RegExp(`/${other}/signal.html\\?review=policy#ch03$`));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('[data-view="table"]').click();
    await expect(page.locator('#record-table')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await nav.locator('a').evaluateAll(links => links.every(a => a.getBoundingClientRect().height >= 44))).toBe(true);
  });
}
