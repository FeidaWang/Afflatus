import { expect, settlePage, test } from './site-fixture.js';

// REL-080 / v2 G3: a synthetic sentinel birth typed into the real page must
// not appear in any request URL or body, and nothing is stored unless the
// person ticks "Save on this device". Sentinel values only — no real person.
const NEEDLES = ['1911-11-11', '1911', '11:11', '1912-12-12'];

test.describe('Horoscope privacy: sentinel birth stays local', () => {
  test('no request carries the sentinel; storage only on opt-in; delete clears it', async ({ page }) => {
    const requests = [];
    page.on('request', (r) => requests.push(`${r.method()} ${r.url()} ${r.postData() ?? ''}`));
    await page.goto('/horoscope.html#self', { waitUntil: 'load' });
    await settlePage(page);

    await page.evaluate(() => {
      document.getElementById('birthDetails')?.setAttribute('open', '');
      document.querySelector('details.more-explorations')?.setAttribute('open', '');
    });
    await page.fill('#bDate', '1911-11-11');
    await page.selectOption('#bHour', 'exact');
    await page.fill('#bExactTime', '11:11');
    await expect(page.locator('#bSave')).not.toBeChecked();
    await page.click('#birthForm [type=submit]');
    await expect(page.locator('#bSaveStatus')).toContainText(/visit only/);
    expect(await page.evaluate(() => localStorage.getItem('afflatus-horo:me'))).toBeNull();

    await page.evaluate(() => { location.hash = '#relationships'; });
    await expect(page.locator('body')).toHaveAttribute('data-observatory-view', 'relationships');
    await page.evaluate(() => document.querySelector('details.more-explorations')?.setAttribute('open', ''));
    await page.fill('#sName', 'Sentinel');
    await page.fill('#sDate', '1912-12-12');
    await page.click('#synForm [type=submit]');
    await expect(page.locator('#sScore')).not.toHaveText('—');
    expect(await page.evaluate(() => localStorage.getItem('afflatus-horo:book'))).toBeNull();

    // Opt in, then delete everything this page saved.
    await page.evaluate(() => { location.hash = '#self'; });
    await page.check('#bSave');
    await page.click('#birthForm [type=submit]');
    await expect(page.locator('#bSaveStatus')).toContainText(/Saved in this browser/);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('afflatus-horo:me')).minute)).toBe(11);

    for (const line of requests) for (const n of NEEDLES) expect(line, line).not.toContain(n);

    page.once('dialog', (d) => d.accept());
    await page.evaluate(() => document.querySelector('details.privacy-settings')?.setAttribute('open', ''));
    await page.click('#clearDataBtn');
    await page.waitForLoadState('load');
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('afflatus-horo:')))).toEqual([]);
  });
});
