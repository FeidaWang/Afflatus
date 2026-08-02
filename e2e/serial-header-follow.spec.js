import { expect, settlePage, test } from './site-fixture.js';

async function expectReadingToolbarOnly(page, header, toolbar) {
  await page.evaluate(() => scrollTo(0, 1200));
  await expect.poll(async () => {
    const headerBox = await header.boundingBox();
    const toolbarBox = await toolbar.boundingBox();
    if (!headerBox || !toolbarBox) return null;
    return {
      headerHasLeftViewport: Math.round(headerBox.y + headerBox.height) <= 0,
      toolbarTop: Math.round(toolbarBox.y),
    };
  }).toEqual({ headerHasLeftViewport: true, toolbarTop: 0 });

  const toolbarIsTopmost = await toolbar.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return target === element || element.contains(target);
  });
  expect(toolbarIsTopmost).toBe(true);
}

test('Chinese serial landing header scrolls away while reader toolbar remains visible', async ({ page }) => {
  await page.goto('/zh/serial.html', { waitUntil: 'domcontentloaded' });
  await settlePage(page);

  const header = page.locator('.site-header--follow');
  const toolbar = page.locator('#toolbar');
  await expect(header).toHaveCount(1);
  await expect(toolbar).toHaveCount(1);
  await expect(header).toBeVisible();
  await expect(toolbar).toBeVisible();

  const rootOverflow = await page.evaluate(() => ({
    html: getComputedStyle(document.documentElement).overflowX,
    body: getComputedStyle(document.body).overflowX,
  }));
  expect(rootOverflow).toEqual({ html: 'visible', body: 'visible' });

  await expectReadingToolbarOnly(page, header, toolbar);

  const layoutToggle = page.locator('#layoutToggle');
  await expect(layoutToggle).toHaveAttribute('aria-pressed', 'false');
  await layoutToggle.click();
  await expect(layoutToggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#readerWaterfall')).toBeVisible();
  await expectReadingToolbarOnly(page, header, toolbar);
});
