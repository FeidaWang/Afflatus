import { expect, settlePage, test } from './site-fixture.js';

test('Worlds loads the catalogue on first use and keeps the selected entry across languages', async ({ page }) => {
  const catalogPath = '/worlds-universe/content.json';
  const requests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === catalogPath) requests.push(request.url());
  });

  await page.goto('/zh/worlds.html');
  await settlePage(page);
  await expect(page.getByRole('heading', { name: '此刻，传奇相逢' })).toBeVisible();
  expect(requests).toHaveLength(0);

  await page.getByRole('button', { name: '搜索英雄联盟宇宙' }).click();
  const search = page.getByRole('searchbox', { name: '搜索英雄联盟宇宙' });
  await search.fill('Ahri');
  await page.getByRole('link', { name: '阿狸 英雄' }).click();
  const detail = page.getByRole('dialog');
  await expect(detail.getByRole('heading', { name: '阿狸', exact: true })).toBeVisible();
  expect(requests).toHaveLength(1);

  await detail.getByRole('link', { name: '用英文阅读此条目' }).click();
  await expect(page).toHaveURL(/\/en\/worlds\.html#champion\/ahri$/);
  await expect(detail.getByRole('heading', { name: 'Ahri', exact: true })).toBeVisible();
});

test('Worlds handles the first region keyboard action before the catalogue is loaded', async ({ page }) => {
  await page.goto('/en/worlds.html');
  const noxus = page.getByRole('tab', { name: 'Noxus' });
  await noxus.press('ArrowRight');
  const ionia = page.getByRole('tab', { name: 'Ionia' });
  await expect(ionia).toBeFocused();
  await expect(ionia).toHaveAttribute('aria-selected', 'true');
});
