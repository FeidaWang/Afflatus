// Screenshots of the chamber and tally with synthetic data, normal and with simulated deuteranopia
// (Machado 2009 matrix, applied as an SVG filter). Data is invented and served on 127.0.0.1 only.
// node cvd-shot.mjs <repo> <out dir> <url> <name>
const [root, out, url, name] = process.argv.slice(2);
const { chromium } = await import(`${root}/node_modules/playwright/index.mjs`);
const M = '0.367322 0.860646 -0.227968 0 0  0.280085 0.672501 0.047413 0 0  -0.01182 0.04294 0.968881 0 0  0 0 0 1 0';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 }, locale: 'en-AU', timezoneId: 'Australia/Melbourne' });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForSelector('.el-chamber-svg .is-called, .el-chamber-svg .is-leading');
await page.waitForTimeout(400);
const box = await page.locator('#el-tally').boundingBox();
const chamber = await page.locator('.el-chamber').boundingBox();
const clip = { x: 0, y: box.y - 10, width: 1440, height: chamber.y + chamber.height - box.y + 20 };
await page.screenshot({ path: `${out}/${name}.png`, clip });
await page.evaluate((matrix) => {
  document.body.insertAdjacentHTML('beforeend', `<svg width="0" height="0" style="position:absolute"><filter id="cvd" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="${matrix}"/></filter></svg>`);
  document.documentElement.style.filter = 'url(#cvd)';
}, M);
await page.waitForTimeout(200);
await page.screenshot({ path: `${out}/${name}-deuteranopia.png`, clip });
await browser.close();
