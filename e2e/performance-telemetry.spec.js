import { expect, test } from '@playwright/test';

test.use({ reducedMotion: 'no-preference' });

async function captureGtag(page) {
  await page.addInitScript(() => {
    const events = [];
    Object.defineProperty(window, '__AFFLATUS_VITAL_EVENTS__', {
      configurable: false,
      value: events,
      writable: false,
    });
    Object.defineProperty(window, 'gtag', {
      configurable: false,
      get() {
        return (...args) => events.push(args);
      },
      set() {
        // Keep the capture transport when the delayed production bootstrap
        // attempts to install its own gtag function.
      },
    });
  });
  await page.route('https://www.googletagmanager.com/**', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: '/* Analytics transport neutralized by the telemetry contract test. */',
  }));
}

async function waitForLcpCandidate(page) {
  return page.evaluate(() => new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      resolve(value);
    };
    const observer = new PerformanceObserver((list) => {
      if (list.getEntries().length) finish(true);
    });
    observer.observe({ type: 'largest-contentful-paint', buffered: true });
    setTimeout(() => finish(false), 10_000);
  }));
}

test('field telemetry emits an anonymous LCP event on the shared entry route', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'One foreground Chromium page covers the shared collector without background-tab LCP suppression.',
  );
  await captureGtag(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  expect(await waitForLcpCandidate(page), 'home must paint an LCP candidate').toBe(true);

  // The collector is intentionally lazy: the first pointer interaction loads
  // the web-vitals chunk, and a subsequent trusted interaction finalizes LCP.
  const collectorLoaded = page.waitForResponse((response) => (
    /\/assets\/webVitals-[^/]+\.js$/.test(new URL(response.url()).pathname)
    && response.ok()
  ));
  await page.locator('h1').click({ force: true });
  await collectorLoaded;
  await page.locator('h1').click({ force: true });

  await expect.poll(
    () => page.evaluate(() => window.__AFFLATUS_VITAL_EVENTS__
      .filter(([command, eventName]) => command === 'event' && eventName === 'web_vital')
      .map(([, , payload]) => payload)),
    { timeout: 5_000 },
  ).toEqual(expect.arrayContaining([
    expect.objectContaining({
      metric_name: 'LCP',
      route: 'main',
    }),
  ]));

  const payloads = await page.evaluate(() => window.__AFFLATUS_VITAL_EVENTS__
    .filter(([command, eventName]) => command === 'event' && eventName === 'web_vital')
    .map((entry) => entry[2]));
  for (const payload of payloads) {
    expect(Object.keys(payload).sort()).toEqual([
      'device_tier',
      'locale',
      'metric_delta',
      'metric_id',
      'metric_name',
      'metric_rating',
      'metric_value',
      'route',
      'schema_version',
      'value',
    ]);
  }
});
