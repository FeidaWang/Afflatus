import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

function localePrepaintSource() {
  const html = readFileSync('portfolio.html', 'utf8');
  const source = html.match(/<script>([^<]*afflatus:locale:v1[^<]*)<\/script>/i)?.[1];
  if (!source) throw new Error('Locale pre-paint script is missing from portfolio.html');
  return source;
}

test('restored Chinese locale never exposes untranslated rich text', async ({ page }) => {
  const prepaint = localePrepaintSource();
  const fixture = `<!doctype html>
    <html lang="en">
      <head><meta charset="utf-8"><script>${prepaint}</script></head>
      <body>
        <h1 data-en="English first paint" data-zh="<span>中文首屏</span>" data-i18n-html>
          English first paint
        </h1>
        <script>
          window.localeBeforeDomReady = {
            language: document.documentElement.lang,
            visibility: document.documentElement.style.visibility,
            heading: document.querySelector('h1').textContent.trim(),
          };
        </script>
      </body>
    </html>`;

  await page.addInitScript(() => {
    localStorage.setItem('afflatus:locale:v1', 'zh');
  });
  await page.route('**/locale-prepaint-fixture.html', (route) => route.fulfill({
    contentType: 'text/html',
    body: fixture,
  }));
  // Capture the parser's state inside the fixture. A driver round trip can
  // run after DOMContentLoaded even if navigation only waits for commit.
  await page.goto('/locale-prepaint-fixture.html', { waitUntil: 'domcontentloaded' });
  expect(await page.evaluate(() => window.localeBeforeDomReady)).toEqual({
    language: 'zh-CN',
    visibility: 'hidden',
    heading: 'English first paint',
  });

  expect(await page.evaluate(() => ({
    visibility: document.documentElement.style.visibility,
    heading: document.querySelector('h1')?.textContent.trim(),
  }))).toEqual({
    visibility: '',
    heading: '中文首屏',
  });
});
