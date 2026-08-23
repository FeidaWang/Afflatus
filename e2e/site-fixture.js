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
      if (url.pathname === '/api/treasury-yields') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({
            yields: [
              { tenor: '10Y', value: 4.21, changeBps: -1.2, open: 4.23, high: 4.25, low: 4.19, asOf: new Date(FIXED_TIME).toISOString() },
              { tenor: '30Y', value: 4.84, changeBps: 0.8, open: 4.82, high: 4.86, low: 4.8, asOf: new Date(FIXED_TIME).toISOString() },
            ],
            spread30s10sBps: 63,
            marketStatus: 'CLOSED',
            source: { provider: 'Deterministic E2E fixture', venue: 'Tradeweb', realTime: false },
          }),
        });
        return;
      }
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
}

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const browserErrors = [];
    page.on('pageerror', (error) => {
      browserErrors.push(`pageerror: ${error.message}`);
    });
    page.on('response', (response) => {
      if (response.status() < 400) return;
      const url = new URL(response.url());
      if (LOCAL_HOSTS.has(url.hostname)) {
        browserErrors.push(`http.${response.status()}: ${url.pathname}${url.search}`);
      }
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
