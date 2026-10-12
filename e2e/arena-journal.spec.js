import { expect, test } from '@playwright/test';

// P0-1: the Arena journal shows real quotes (/api/quote) and daily candles
// (/api/history) — never the prototype's fictional prices — and degrades to
// "—" when a provider is unavailable. Provider responses are mocked here.
const PRICES = { NVDA: 181.5, MSFT: 512.25, AVGO: 330.1, MU: 172.4, TSM: 305.75, VRT: 140.2 };

function quoteFor(symbol) {
  const c = PRICES[symbol] ?? 100;
  const pc = c / 1.02;
  return { c, pc, o: pc, h: c * 1.01, l: pc * 0.99, t: Math.floor(Date.now() / 1000) - 120, d: c - pc, dp: 2 };
}

function dailyBars(count = 300) {
  const values = [];
  const day = new Date(Date.UTC(2026, 9, 9));
  for (let i = 0; values.length < count; i += 1) {
    const date = new Date(day.getTime() - i * 86_400_000);
    if (date.getUTCDay() === 0 || date.getUTCDay() === 6) continue;
    const close = 150 + Math.sin(values.length / 9) * 12;
    values.push({ datetime: date.toISOString().slice(0, 10), open: String(close - 1), high: String(close + 2), low: String(close - 3), close: String(close), volume: '1000' });
  }
  return { status: 'ok', meta: { symbol: 'MU', interval: '1day' }, values };
}

async function mockProviders(page, { quotes = true, history = true } = {}) {
  await page.route('**/api/quote?**', (route) => {
    const symbol = new URL(route.request().url()).searchParams.get('symbol');
    return quotes
      ? route.fulfill({ json: quoteFor(symbol) })
      : route.fulfill({ status: 503, json: { error: { code: 'UPSTREAM_UNAVAILABLE' } } });
  });
  await page.route('**/api/history?**', (route) => (history
    ? route.fulfill({ json: dailyBars() })
    : route.fulfill({ status: 503, json: { error: { code: 'UPSTREAM_UNAVAILABLE' } } })));
}

test('shows provider quotes and daily candles instead of sample data', async ({ page }) => {
  const requests = [];
  page.on('request', (request) => requests.push(new URL(request.url()).pathname));
  await mockProviders(page);
  await page.goto('/en/arena.html', { waitUntil: 'networkidle' });

  await expect(page.locator('#detail-title')).toHaveText('Micron Technology');
  await expect(page.locator('.detail-quote strong')).toHaveText('172.40');
  await expect(page.locator('.detail-quote')).toContainText('+2.00%');
  await expect(page.locator('.quote-time')).toContainText('ET');
  await expect(page.locator('.watch-row').first()).toContainText('181.50');
  await expect(page.locator('.market-chart .chart-status')).toHaveCount(0);
  await expect(page.locator('.periods button')).toHaveText(['M', '3M', 'YTD', 'Y', 'MAX']);
  await expect(page.locator('.index-strip')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/fictional|sample data|Oct 2, 16:00/i);
  await expect(page).toHaveTitle('US stock journal · AFFLATUS');

  expect(requests.filter((path) => path.startsWith('/api/vibe-'))).toEqual([]);
  expect(requests.filter((path) => /paper-grid\.png|pigment-wash\.png/.test(path))).toEqual([]);
});

test('falls back to dashes and a chart notice when providers fail', async ({ page }) => {
  await mockProviders(page, { quotes: false, history: false });
  await page.goto('/zh/arena.html', { waitUntil: 'networkidle' });

  await expect(page.locator('.detail-quote strong')).toHaveText('—');
  await expect(page.locator('.quote-time')).toHaveText('报价暂时无法获取');
  await expect(page.locator('.watch-row .stock-price').first()).toHaveText('—');
  await expect(page.locator('.market-chart .chart-status')).toHaveText('日线暂时无法加载。');
  await expect(page).toHaveTitle('美股看板 · AFFLATUS');
});

test('only journal companies can be added to the watchlist', async ({ page }) => {
  await mockProviders(page);
  await page.goto('/en/arena.html', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Add a stock' }).click();
  await page.getByRole('searchbox').fill('apple');
  await page.locator('.dialog-stock .add-stock').first().click();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.watch-row').last()).toContainText('AAPL');
  await page.getByRole('button', { name: 'Add a stock' }).click();
  await page.getByRole('searchbox').fill('IBM');
  await expect(page.locator('.empty-search')).toBeVisible();
});
