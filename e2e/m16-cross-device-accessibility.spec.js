import { expect, settlePage, test } from './site-fixture.js';

const screenshotRoot = 'docs/refactor/screenshots';

test.describe('M16 cross-device and accessibility gates', () => {
  test('uses three static AVIF frames and never initializes WebGL for Save-Data', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    const sceneRequests = [];
    page.on('request', (request) => {
      if (/SignatureScene/i.test(request.url())) sceneRequests.push(request.url());
    });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'connection', {
        configurable: true,
        value: { effectiveType: '4g', saveData: true },
      });
    });
    await page.setViewportSize({ width: 430, height: 932 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await settlePage(page);
    await page.waitForTimeout(900);

    await expect(page.locator('.static-journey__frame')).toHaveCount(3);
    await expect(page.locator('[data-static-frame="bow"]')).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.locator('.signature-experience')).toHaveAttribute('data-quality-profile', 'reduced');
    expect(sceneRequests).toEqual([]);
    await page.screenshot({ path: `${screenshotRoot}/m16-save-data-static-430x932.png` });
  });

  test('keeps the visible motion preference persistent and poster-only when disabled', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await settlePage(page);
    const motion = page.getByRole('switch', { name: /Motion:/ });
    await expect(motion).toBeVisible();
    await expect(motion).toHaveAttribute('aria-checked', 'true');
    await motion.click();
    await expect(motion).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('canvas')).toHaveCount(0);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settlePage(page);
    await expect(page.getByRole('switch', { name: /Motion:/ })).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('canvas')).toHaveCount(0);
    await page.screenshot({ path: `${screenshotRoot}/m16-motion-off-390x844.png` });
  });

  test('fits the documented phone, tablet and desktop matrix without clipped header controls', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 768, height: 1024 },
      { width: 1440, height: 1000 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await settlePage(page);
      const state = await page.evaluate(() => {
        const isVisible = (element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        };
        const controls = [...document.querySelectorAll('header a, header button')].filter(isVisible);
        return {
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          undersized: innerWidth <= 820
            ? controls.map((element) => {
              const rect = element.getBoundingClientRect();
              return { label: element.getAttribute('aria-label') || element.textContent.trim(), width: rect.width, height: rect.height };
            }).filter(({ width, height }) => width < 44 || height < 44)
            : [],
        };
      });
      expect(state.overflow, `${viewport.width}×${viewport.height} horizontal overflow`).toBeLessThanOrEqual(1);
      expect(state.undersized, `${viewport.width}×${viewport.height} header target size`).toEqual([]);
    }
  });

  test('supports skip navigation, keyboard focus and 200% text size', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await settlePage(page);
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeFocused();
    await skip.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();

    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    const state = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      h1Visible: Boolean(document.querySelector('h1')?.getBoundingClientRect().height),
    }));
    expect(state.overflow).toBeLessThanOrEqual(1);
    expect(state.h1Visible).toBe(true);
  });
});
