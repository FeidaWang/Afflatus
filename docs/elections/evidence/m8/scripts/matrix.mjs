// M8 screenshot matrix. Viewport captures only: full-page captures whiten the drawer and misplace the fixed header.
// Ports: 4290 = production build with no feed (vite preview); 4180/4181 = scripts/elections/serve-local.mjs over
// invented local stores (SYNTH in the file name). node matrix.mjs <repo> <out dir> <data file>
import { writeFileSync } from 'node:fs';
const [root, out, dataFile] = process.argv.slice(2);
const { chromium } = await import(`${root}/node_modules/playwright/index.mjs`);
const VIEWPORTS = [[1440, 1080], [1920, 1080], [1024, 768], [768, 1024], [390, 844]];
const STATES = [
  { id: 'hub', port: 4290, q: '' },
  { id: 'vic-waiting', port: 4290, q: '?event=vic-2026&office=assembly' },
  { id: 'replay-disabled', port: 4290, q: '?event=vic-2026&office=assembly', scrollTo: '#el-replay' },
  { id: 'us-house-selected', port: 4290, q: '?event=us-2026&office=house&race=CA-12' },
  // From 641 to 1279 the race details sit below the map, so the first screen does not show them.
  { id: 'us-house-drawer', port: 4290, q: '?event=us-2026&office=house&race=CA-12', scrollTo: '#el-drawer', widths: [1024, 768] },
  { id: 'us-senate-held', port: 4290, q: '?event=us-2026&office=senate&race=AZ-S1' },
  { id: 'vic-selected-SYNTH', port: 4180, q: '?event=vic-2026&office=assembly&race=ashwood' },
  { id: 'source-error-SYNTH', port: 4181, q: '?event=vic-2026&office=assembly' },
];
const browser = await chromium.launch();
const results = [];
for (const [width, height] of VIEWPORTS) for (const lang of ['en', 'zh']) for (const state of STATES) {
  if (state.widths && !state.widths.includes(width)) continue;
  const context = await browser.newContext({ viewport: { width, height }, locale: lang === 'zh' ? 'zh-CN' : 'en-AU', timezoneId: 'Australia/Melbourne', hasTouch: width < 768, isMobile: width < 768, colorScheme: 'light', serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text().slice(0, 160)); });
  page.on('pageerror', (error) => errors.push(`PAGEERROR ${error.message.slice(0, 160)}`));
  await page.goto(`http://127.0.0.1:${state.port}/${lang}/elections.html${state.q}`, { waitUntil: 'load' });
  await page.waitForSelector('#el-view > *', { state: 'attached' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(500);
  if (state.scrollTo) {
    await page.locator(state.scrollTo).evaluate((element) => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2));
    await page.waitForTimeout(200);
  }
  const name = `${state.id}-${width}x${height}-${lang}`;
  await page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 80 });
  const measured = await page.evaluate(() => {
    const visible = (element) => { const style = getComputedStyle(element); const box = element.getBoundingClientRect(); return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0; };
    const leaves = [...document.querySelectorAll('.el-strip *, .el-page *')].filter((element) => !element.closest('svg') && !element.closest('.el-sr') && visible(element) && [...element.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim()));
    const offscreen = leaves.filter((element) => { const box = element.getBoundingClientRect(); return box.right > innerWidth + 1 || box.left < -1; }).map((element) => element.textContent.trim().slice(0, 30)).slice(0, 6);
    const clipped = [...document.querySelectorAll('.el-page *')].filter((element) => visible(element) && !element.closest('svg') && element.scrollWidth > element.clientWidth + 1 && getComputedStyle(element).overflowX === 'hidden').map((element) => element.className || element.tagName).slice(0, 5);
    const text = document.querySelector('.el-page').innerText + document.querySelector('.el-strip').innerText;
    return {
      pageWidth: document.documentElement.scrollWidth, innerWidth,
      offscreen, clipped,
      stageCodes: text.match(/\bM\d{1,2}\b/g) || [],
      strip: document.querySelector('.el-strip').innerText.replace(/\s+/g, ' ').slice(0, 180),
      drawer: document.querySelector('#el-drawer:not([hidden])') ? document.querySelector('#el-drawer').innerText.replace(/\s+/g, ' ').slice(0, 240) : null,
      replay: document.querySelector('#el-replay')?.innerText.replace(/\s+/g, ' ').slice(0, 160),
      tags: document.querySelectorAll('.el-seat-tags text').length,
    };
  });
  results.push({ state: state.id, width, height, lang, errors, ...measured });
  await context.close();
}
await browser.close();
writeFileSync(dataFile, `${JSON.stringify(results, null, 1)}\n`);
const flagged = results.filter((row) => row.pageWidth > row.innerWidth || row.offscreen.length || row.clipped.length || row.errors.length || row.stageCodes.length);
console.log('captures', results.length, 'flagged', flagged.length);
for (const row of flagged) console.log(row.state, row.width, row.lang, JSON.stringify({ pageWidth: row.pageWidth, offscreen: row.offscreen, clipped: row.clipped, errors: row.errors, stageCodes: row.stageCodes }));
