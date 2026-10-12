import { expect, test as base } from '@playwright/test';

const FIXED_TIME = Date.parse('2026-07-25T12:00:00+10:00');
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);

function isExpectedNetworkNoise(message) {
  return /Failed to load resource: net::ERR_(?:ABORTED|BLOCKED_BY_CLIENT)/.test(message);
}

async function installDeterministicRuntime(page) {
  await page.addInitScript(({ fixedTime }) => {
    window.__AFFLATUS_E2E__ = true;
    localStorage.setItem('afflatus:locale:v1', 'en');

    const RealDate = Date;
    class FixedDate extends RealDate {
      constructor(...args) {
        super(...(args.length ? args : [fixedTime]));
      }

      static now() {
        return fixedTime;
      }
    }
    FixedDate.parse = RealDate.parse;
    FixedDate.UTC = RealDate.UTC;
    Object.defineProperty(FixedDate, 'name', { value: 'Date' });
    window.Date = FixedDate;

    let seed = 0xaff1a7;
    Math.random = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
  }, { fixedTime: FIXED_TIME });

  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (LOCAL_HOSTS.has(url.hostname)) {
      await route.continue();
      return;
    }

    if (request.resourceType() === 'stylesheet') {
      await route.fulfill({
        status: 200,
        contentType: 'text/css; charset=utf-8',
        body: '/* External font CSS intentionally neutralized in browser gates. */',
      });
      return;
    }

    if (request.resourceType() === 'script') {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript; charset=utf-8',
        body: '/* External analytics intentionally neutralized in browser gates. */',
      });
      return;
    }

    await route.abort('blockedbyclient');
  });

  // `vite preview` has no serverless functions. Answer the market-data APIs
  // (Arena journal) with deterministic data instead of letting them 404.
  await page.route('**/api/quote?**', (route) => {
    const symbol = new URL(route.request().url()).searchParams.get('symbol') || '';
    const c = 100 + [...symbol].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 400;
    const pc = c / 1.01;
    return route.fulfill({ json: { c, pc, o: pc, h: c * 1.005, l: pc * 0.995, t: FIXED_TIME / 1000 - 3600, d: c - pc, dp: 1 } });
  });
  await page.route('**/api/history?**', (route) => {
    const values = [];
    for (let day = 0; values.length < 300; day += 1) {
      const date = new Date(FIXED_TIME - day * 86_400_000);
      if (date.getUTCDay() === 0 || date.getUTCDay() === 6) continue;
      const close = 150 + Math.sin(values.length / 9) * 10;
      values.push({ datetime: date.toISOString().slice(0, 10), open: String(close - 1), high: String(close + 2), low: String(close - 3), close: String(close), volume: '1000' });
    }
    return route.fulfill({ json: { status: 'ok', meta: { interval: '1day' }, values } });
  });
}

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const browserErrors = [];
    page.on('pageerror', (error) => {
      browserErrors.push(`pageerror: ${error.message}`);
    });
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const text = message.text();
      if (!isExpectedNetworkNoise(text)) browserErrors.push(`console.error: ${text}`);
    });

    await installDeterministicRuntime(page);
    await use(page);

    await testInfo.attach('browser-errors.json', {
      body: Buffer.from(`${JSON.stringify(browserErrors, null, 2)}\n`),
      contentType: 'application/json',
    });
    expect(browserErrors, 'The page must not emit console errors or uncaught exceptions').toEqual([]);
  },
});

export { expect };

export async function settlePage(page) {
  await page.locator('body').waitFor({ state: 'visible' });
  await page.evaluate(() => document.fonts?.ready);
  await page.addStyleTag({
    content: `
      *,
      *::before,
      *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        scroll-behavior: auto !important;
        transition-delay: 0s !important;
        transition-duration: 0s !important;
        caret-color: transparent !important;
      }
      .course-enhanced main > section:not(.hero) {
        opacity: 1 !important;
        transform: none !important;
        filter: none !important;
      }
    `,
  });
  await page.waitForTimeout(100);
}
