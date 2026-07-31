import { expect, settlePage, test } from './site-fixture.js';

const CRITICAL_LOGOS = ['OpenAI', 'Meta AI', 'Huawei', 'Zhipu AI', 'Apple'];

async function scrollToSystem(page) {
  await page.evaluate(() => {
    const story = document.querySelector('#storyGraphSection');
    const span = Math.max(1, story.offsetHeight - innerHeight);
    scrollTo(0, story.offsetTop + span * 0.9);
  });
  await expect(page.locator('#storyGraphSection')).toHaveAttribute('data-graph-chapter', 'system');
  await expect(page.locator('.graphInspector')).toBeVisible();
}

test.describe('Sectors Anthropic-inspired layout', () => {
  test('desktop header stays seamless and the relationship index owns the left rail', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    await page.goto('/zh/sectors.html', { waitUntil: 'domcontentloaded' });
    await settlePage(page);

    const header = page.locator('.top.site-header--follow');
    const initial = await header.boundingBox();
    expect(initial).toMatchObject({ x: 0, y: 0, height: 68 });
    expect(Math.round(initial.width)).toBe(1440);
    await expect(page.locator('html')).toHaveAttribute('data-afflatus-brand-state', 'full');

    await page.evaluate(() => scrollTo(0, 760));
    await expect(page.locator('html')).toHaveAttribute('data-afflatus-brand-state', 'compact');
    const compact = await header.boundingBox();
    expect(compact).toMatchObject({ x: 0, y: 0, height: 68 });
    await expect(page.locator('.top .nav a.active')).toBeVisible();
    await expect(page.locator('.top .lang-toggle')).toBeVisible();

    await scrollToSystem(page);
    await expect(page.locator('.graphStoryStep[data-graph-step="system"] .graphStoryCard')).toHaveCSS('opacity', '0');
    const rail = await page.locator('.graphInspector').boundingBox();
    expect(rail.x).toBeLessThanOrEqual(24);
    expect(rail.width).toBeLessThanOrEqual(248);
    const nodeButtons = page.locator('#mwGraphNodes button');
    await expect(nodeButtons).toHaveCount(19);
    const first = await nodeButtons.nth(0).boundingBox();
    const second = await nodeButtons.nth(1).boundingBox();
    expect(second.y).toBeGreaterThan(first.y + 20);

    await testInfo.attach('sectors-desktop-system.png', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });

  test('critical logos produce ink inside their white canvas plates', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    await page.goto('/zh/sectors.html', { waitUntil: 'domcontentloaded' });
    await settlePage(page);
    await scrollToSystem(page);

    for (const label of CRITICAL_LOGOS) {
      await page.getByRole('button', { name: new RegExp(`${label}$`) }).click();
      await page.waitForTimeout(700);
      const pixels = await page.locator('#mwGraph').evaluate((canvas) => {
        const context = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const width = Math.round(44 * scaleX);
        const height = Math.round(28 * scaleY);
        const image = context.getImageData(
          Math.round(canvas.width / 2 - width / 2),
          Math.round(canvas.height / 2 - height / 2),
          width,
          height,
        ).data;
        let pale = 0;
        let ink = 0;
        for (let index = 0; index < image.length; index += 4) {
          const [red, green, blue, alpha] = image.slice(index, index + 4);
          if (alpha < 220) continue;
          if (red > 220 && green > 220 && blue > 220) pale += 1;
          if (red < 205 || green < 205 || blue < 205) ink += 1;
        }
        return { ink, pale };
      });
      expect(pixels.pale, `${label} white plate pixels`).toBeGreaterThan(120);
      expect(pixels.ink, `${label} visible logo pixels`).toBeGreaterThan(18);
    }
  });

  test('mobile keeps the header at 68px and the index inside the left half', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop-chromium');
    await page.goto('/zh/sectors.html', { waitUntil: 'domcontentloaded' });
    await settlePage(page);
    await page.evaluate(() => scrollTo(0, 760));

    const header = await page.locator('.top.site-header--follow').boundingBox();
    expect(header).toMatchObject({ x: 0, y: 0, height: 68 });
    expect(Math.round(header.width)).toBe(await page.evaluate(() => innerWidth));
    await expect(page.locator('.top .lang-toggle')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
      await page.evaluate(() => innerWidth),
    );

    await scrollToSystem(page);
    const rail = await page.locator('.graphInspector').boundingBox();
    expect(rail.x).toBeLessThanOrEqual(12);
    expect(rail.width).toBeLessThanOrEqual((await page.evaluate(() => innerWidth)) * 0.46 + 1);
    await expect(page.locator('.page-turn-controls')).toBeHidden();

    await testInfo.attach('sectors-mobile-system.png', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });
});
