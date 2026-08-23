import { expect, test } from '@playwright/test';

const visibleHomeLanguageSwitch = (page) => page.locator('#langBtn:visible');

async function clickOnlyHomeLanguageSwitch(page) {
  const switcher = visibleHomeLanguageSwitch(page);
  await expect(switcher).toHaveCount(1);
  await switcher.click();
}

test('home navigation follows the fixed and interactive locale', async ({ page }) => {
  const primaryLinks = page.locator('.primary-nav-link');

  await page.goto('/zh/', { waitUntil: 'domcontentloaded' });
  await expect(primaryLinks).toHaveText(['系统', '情报', '现场笔记', '实验', '关于']);

  await page.goto('/en/', { waitUntil: 'domcontentloaded' });
  await expect(primaryLinks).toHaveText(['Systems', 'Intelligence', 'Field Notes', 'Experiments', 'About']);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await Promise.all([
    page.waitForURL(/\/zh\/$/),
    clickOnlyHomeLanguageSwitch(page),
  ]);
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(primaryLinks).toHaveText(['系统', '情报', '现场笔记', '实验', '关于']);
});

test('home fixed-locale switch preserves query and hash state', async ({ page }) => {
  await page.goto('/en/?combatview=2d#portfolioConvoy', { waitUntil: 'domcontentloaded' });
  await Promise.all([
    page.waitForURL(/\/zh\/\?combatview=2d#portfolioConvoy$/),
    clickOnlyHomeLanguageSwitch(page),
  ]);
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
});

test('home shell remains English by default even when an old adaptive locale is stored', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('afflatus:locale:v1', 'zh');
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#langBtn')).toHaveAttribute('href', '/zh/');
  await expect(page.locator('h1')).toContainText('Systems for');
  await expect(visibleHomeLanguageSwitch(page)).toHaveCount(1);
});

test('primary navigation replaces duplicate linear page-turn controls', async ({ page }) => {
  for (const path of ['/en/', '/en/arena.html', '/en/horoscope.html', '/en/course.html']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.page-turn-controls, .route-arrows')).toHaveCount(0);
    await expect(page.locator('body')).not.toHaveAttribute('data-prev');
    await expect(page.locator('body')).not.toHaveAttribute('data-next');
    const links = path === '/en/'
      ? page.locator('[data-afflatus-nav] .primary-nav-link')
      : page.locator('[data-afflatus-nav] .afflatus-nav-links a');
    await expect(links).toHaveCount(5);
    await expect(links.filter({ hasText: 'Field Notes' })).toHaveAttribute('href', '/en/field-notes/');
  }

  const currentUrl = page.url();
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(currentUrl);
});

test('fixed-locale switching keeps the reader in the current section', async ({ page }) => {
  await page.goto('/en/course.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.page-turn-controls')).toHaveCount(0);
  await page.locator('#review').evaluate((section) => {
    section.scrollIntoView({ behavior: 'instant', block: 'start' });
  });

  await Promise.all([
    page.waitForURL(/\/zh\/course\.html#review$/),
    page.locator('.lang-toggle').click(),
  ]);

  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  const reviewPosition = await page.locator('#review').evaluate((section) => {
    const bounds = section.getBoundingClientRect();
    return { top: bounds.top, bottom: bounds.bottom };
  });
  expect(reviewPosition.top).toBeGreaterThanOrEqual(0);
  expect(reviewPosition.top).toBeLessThan(180);
  expect(reviewPosition.bottom).toBeGreaterThan(180);
  expect(new URL(page.url()).hash).toBe('#review');
});

test('desktop primary concepts remain visible without a disclosure menu', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop pointer interaction');
  await page.goto('/en/course.html', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('.afflatus-nav-links')).toBeVisible();
  await expect(page.locator('.afflatus-nav-links a')).toHaveCount(5);
  await expect(page.locator('.afflatus-nav-toggle')).toBeHidden();
});
