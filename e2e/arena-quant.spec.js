import { expect, settlePage, test } from './site-fixture.js';

function historyPayload(symbol) {
  const symbols = ['SPY', 'NVDA', 'AVGO', 'MSFT', 'TSM', 'AMZN', 'GOOGL', 'MU', 'ANET', 'VRT', 'AMD'];
  const rank = Math.max(0, symbols.indexOf(symbol));
  const start = Date.UTC(2025, 10, 1);
  let price = 80 + rank * 9;
  const values = Array.from({ length: 250 }, (_, index) => {
    const date = new Date(start + (index * 86400000)).toISOString().slice(0, 10);
    const open = price;
    const move = 0.00035 + rank * 0.000055 + Math.sin(index * 0.19 + rank) * (0.0018 + rank * 0.0001);
    price *= 1 + move;
    return {
      datetime: date,
      open: open.toFixed(4),
      high: (Math.max(open, price) * 1.004).toFixed(4),
      low: (Math.min(open, price) * 0.996).toFixed(4),
      close: price.toFixed(4),
      volume: String(1_000_000 + rank * 50_000 + index * 1200),
    };
  }).reverse();
  return { status: 'ok', values };
}

test('QF-01 compiles a responsive walk-forward experiment', async ({ page }) => {
  await page.route('**/api/history?**', async (route) => {
    const symbol = new URL(route.request().url()).searchParams.get('symbol') || 'SPY';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(historyPayload(symbol)) });
  });

  await page.goto('/arena.html?embed=1', { waitUntil: 'domcontentloaded' });
  await settlePage(page);
  const foundry = page.locator('#quantFoundry');
  await expect(foundry).toBeVisible();
  const declaredUniverseSize = await page.evaluate(async () => {
    const response = await fetch('/arena-quant-model.json');
    if (!response.ok) throw new Error(`quant model manifest returned ${response.status}`);
    const manifest = await response.json();
    return manifest.universe.length;
  });
  expect(declaredUniverseSize).toBeGreaterThanOrEqual(10);
  await expect(foundry.locator('#qmUniverse > span')).toHaveCount(declaredUniverseSize);

  const compile = foundry.locator('#qmCompile');
  await compile.scrollIntoViewIfNeeded();
  await expect(compile).toBeVisible();
  await compile.click();

  await expect(foundry.locator('#qmResult')).toBeVisible();
  await expect(foundry.locator('#qmStatus')).toHaveAttribute('data-kind', 'ready');
  await expect(foundry.locator('#qmStatus')).toContainText('R001 READY');
  expect(await foundry.locator('#qmAllocations tr').count()).toBeGreaterThan(2);
  await expect(foundry.locator('#qmMetrics > div')).toHaveCount(8);
  await expect(foundry.locator('#qmExport')).toBeEnabled();

  const geometry = await page.evaluate(() => {
    const canvas = document.getElementById('qmChart');
    const button = document.getElementById('qmCompile').getBoundingClientRect();
    return {
      overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      buttonWidth: button.width,
      viewportWidth: window.innerWidth,
    };
  });
  expect(geometry.overflow).toBeLessThanOrEqual(2);
  expect(geometry.canvasWidth).toBeGreaterThan(300);
  expect(geometry.canvasHeight).toBeGreaterThan(200);
  expect(geometry.buttonWidth).toBeLessThanOrEqual(geometry.viewportWidth);
});
