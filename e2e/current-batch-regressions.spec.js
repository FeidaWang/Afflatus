import { expect, settlePage, test } from './site-fixture.js';

test.describe.configure({ mode: 'serial' });

async function useChinese(page) {
  await page.addInitScript(() => {
    localStorage.setItem('afflatus:locale:v1', 'zh');
  });
}

async function expectNoPageOverflow(page) {
  const overflow = await page.evaluate(() => Math.max(
    0,
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  ));
  expect(overflow).toBeLessThanOrEqual(2);
}

async function attachViewport(page, testInfo, name) {
  const image = await page.screenshot({ animations: 'disabled', caret: 'hide', fullPage: false, scale: 'css' });
  await testInfo.attach(`${name}.png`, { body: image, contentType: 'image/png' });
}

test('desktop batch keeps the research, privacy and layout contracts visible', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await useChinese(page);

  await page.goto('/zh/arena.html', { waitUntil: 'domcontentloaded' });
  await settlePage(page);
  const briefing = page.locator('#bfModal');
  if (!(await briefing.isVisible())) await page.locator('#openBriefBtn').click();
  await expect(briefing).toBeVisible();
  await expect(page.locator('#bfLang')).toHaveCount(1);
  await expect(page.locator('#bfEnter')).toHaveCount(1);
  await expect(page.locator('.bf-item')).toHaveCount(6);
  await expect(page.locator('.bf-cat')).toContainText(['宏观', '存储', 'AI 基础设施', '光互连', '财报', '财报日历']);
  await page.locator('#bfEnter').click();
  await expect(page.locator('#qmUniverse > span')).toHaveCount(17);
  await expect(page.locator('.earn-card')).toHaveCount(2);
  await expect(page.locator('.ap-model')).toHaveCount(3);
  await expect(page.locator('#statusTxt')).toHaveText(/常规交易时段|盘前交易|盘后交易|美股休市/);
  await expect(page.locator('#cdLabel')).toHaveText(/距离美股(?:开盘|收盘)/);
  await expectNoPageOverflow(page);
  await attachViewport(page, testInfo, 'arena-zh-desktop');

  await page.goto('/zh/sectors.html', { waitUntil: 'domcontentloaded' });
  await settlePage(page);
  await expect(page.locator('.deepSeekBrief')).toBeVisible();
  await expect(page.locator('.modelMatrixRow')).toHaveCount(11);
  await expect(page.locator('.modelMatrixRow.is-runtime')).toContainText('5.6 Sol Ultra');
  await expect(page.locator('.modelMatrixRow.is-runtime .is-na')).toHaveCount(6);
  await expect(page.locator('.equityRow')).toHaveCount(20);
  await expect(page.locator('body')).not.toContainText('OPEN-WEIGHTS LETTER AUDIT');
  await expect(page.locator('body')).not.toContainText('来源账本');
  await page.evaluate(() => window.scrollTo(0, 1400));
  await page.waitForTimeout(100);
  const header = await page.locator('.top.site-header--follow').boundingBox();
  expect(header).not.toBeNull();
  expect(header.y).toBeLessThanOrEqual(1);
  expect(header.width).toBeGreaterThanOrEqual(1438);
  await expectNoPageOverflow(page);
  await attachViewport(page, testInfo, 'sectors-zh-desktop');

  await page.goto('/zh/course.html', { waitUntil: 'domcontentloaded' });
  await settlePage(page);
  await page.locator('.fde-field-synthesis').scrollIntoViewIfNeeded();
  await expect(page.locator('.fde-field-synthesis')).toBeVisible();
  await expect(page.locator('.harness-research')).toBeAttached();
  await expect(page.locator('.ml-route-brief')).toBeAttached();
  await expectNoPageOverflow(page);
  await attachViewport(page, testInfo, 'course-zh-desktop');

  await page.goto('/zh/horoscope.html', { waitUntil: 'domcontentloaded' });
  await settlePage(page);
  await expect(page.locator('#logicSec, #eqSec')).toHaveCount(0);
  await expect(page.locator('#personaSec')).toBeAttached();
  const overseasRegions = await page.locator('#bRegionSel optgroup[label="海外 · OVERSEAS"] option').allTextContents();
  expect(overseasRegions).toHaveLength(2);
  expect(overseasRegions.join(' ')).toContain('澳大利亚');
  expect(overseasRegions.join(' ')).toContain('新西兰');
  await expectNoPageOverflow(page);

  await page.goto('/zh/', { waitUntil: 'domcontentloaded' });
  await settlePage(page);
  const convoyDivider = await page.locator('.portfolio-convoy').evaluate((element) => {
    const style = getComputedStyle(element, '::after');
    return { content: style.content, height: style.height };
  });
  expect(['none', 'normal', '""']).toContain(convoyDivider.content);
  await expectNoPageOverflow(page);
});

test('mobile batch has no horizontal clipping at the requested content breakpoints', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'galaxy-s26-ultra-chromium');
  await useChinese(page);

  for (const route of ['/zh/arena.html', '/zh/sectors.html', '/zh/course.html', '/zh/horoscope.html']) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await settlePage(page);
    const enter = page.locator('#bfEnter');
    if (await enter.isVisible()) await enter.click();
    await expectNoPageOverflow(page);
    await page.evaluate(() => window.scrollTo(0, Math.min(document.documentElement.scrollHeight - innerHeight, 1200)));
    await page.waitForTimeout(100);
    await expectNoPageOverflow(page);
  }

  await page.goto('/zh/sectors.html', { waitUntil: 'domcontentloaded' });
  await settlePage(page);
  await page.locator('.deepSeekBrief').scrollIntoViewIfNeeded();
  await expect(page.locator('.deepSeekBrief')).toBeVisible();
  await expect(page.locator('.equityRow')).toHaveCount(20);
  await attachViewport(page, testInfo, 'sectors-zh-mobile');

  await page.goto('/zh/horoscope.html', { waitUntil: 'domcontentloaded' });
  await settlePage(page);
  await page.locator('#personaSec').scrollIntoViewIfNeeded();
  await expect(page.locator('#personaSec')).toBeVisible();
  await expectNoPageOverflow(page);
  await attachViewport(page, testInfo, 'horoscope-zh-mobile');
});
