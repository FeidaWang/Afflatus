import { test, expect } from '@playwright/test';

// Mobile-first reader contract. Uses the project's isolated CI browsers.
test('library opens a reader with reachable controls and returns to the same passage', async ({ page }) => {
  await page.goto('/zh/serial.html');
  await expect(page.locator('#continueReading')).toBeVisible();
  await page.locator('#continueReading').click();
  await expect(page.locator('#chapterBody')).toContainText('顾星辞');
  await page.locator('#pageNextHotspot').click();
  const passage = (await page.locator('#chapterBody').innerText()).slice(0, 20);
  await page.locator('#bookmarkBtn').click();
  await page.getByRole('button', { name: '阅读设置', exact: true }).click();
  await page.locator('#fsPlus').click();
  await page.getByRole('button', { name: '关闭阅读设置', exact: true }).click();
  await expect(page.locator('#chapterBody')).toContainText(passage);
  await page.locator('#readerBack').click();
  await expect(page.locator('#continueReading')).toBeVisible();
  await page.reload();
  await page.locator('#continueReading').click();
  await expect(page.locator('#chapterBody')).toContainText(passage);
  const bounds = await page.locator('#toolbar').boundingBox();
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(page.viewportSize().height + 1);
});

test('chapter links, night mode and contents retain the reading context', async ({ page }) => {
  await page.goto('/zh/novels/wanjie-zhongchun/2/');
  await expect(page.locator('#chapterTitle')).toContainText('枯藤夜行');
  await page.getByRole('button', { name: '阅读设置', exact: true }).click();
  await page.getByRole('button', { name: '夜间', exact: true }).click();
  await page.getByRole('button', { name: '关闭阅读设置', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-reader-theme', 'night');
  await page.locator('#tocOpen').click();
  await expect(page.locator('#tocDrawer')).toHaveAttribute('aria-hidden', 'false');
  await page.keyboard.press('Escape');
  await expect(page.locator('#tocDrawer')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#tocOpen')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('daily draw and private note survive a return visit without a birth profile', async ({ page }) => {
  await page.goto('/zh/horoscope.html');
  await expect(page.locator('#observatoryToday')).toBeVisible();
  await page.locator('#obsDrawButton').click();
  const draw = await page.locator('#drawText').innerText();
  await page.locator('#drawWriteNote').click();
  await page.locator('#obsNoteText').fill('给自己留一点时间。');
  await page.locator('#obsSaveNote').click();
  await expect(page.locator('#obsNoteStatus')).toContainText('已保存');
  await page.reload();
  await page.getByRole('button', { name: '手记', exact: true }).click();
  await expect(page.locator('#obsNoteText')).toHaveValue('给自己留一点时间。');
  await page.getByRole('button', { name: '今日', exact: true }).click();
  await page.locator('#obsDrawButton').click();
  await expect(page.locator('#drawText')).toHaveText(draw);
});
