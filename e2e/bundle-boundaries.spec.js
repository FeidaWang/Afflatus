import { expect, test } from '@playwright/test';

// Only the React routes (home, arena) may download the React jsx-runtime
// chunk. Rolldown keeps its runtime helpers in that chunk, so a dynamic
// import() of a shared module (which needs a namespace helper) silently made
// every page importing fetchJson pay ~60 KB gzip for React.
const NON_REACT_ROUTES = [
  '/serial.html',
  '/signal.html',
  '/sectors.html',
  '/horoscope.html',
  '/portfolio.html',
  '/course.html',
];

for (const path of NON_REACT_ROUTES) {
  test(`${path} does not download the React runtime chunk`, async ({ page }) => {
    const scripts = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'script') scripts.push(new URL(request.url()).pathname);
    });
    await page.goto(path, { waitUntil: 'networkidle' });
    expect(scripts.some((script) => script.includes('/assets/'))).toBe(true);
    expect(scripts.filter((script) => /\/jsx-runtime-[^/]*\.js$/.test(script))).toEqual([]);
  });
}
