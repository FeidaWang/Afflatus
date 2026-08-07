import { expect, test } from '@playwright/test';

const visibleHomeLanguageSwitch = (page) => page.locator('#langBtn:visible, #langMiniToggle:visible');

async function clickOnlyHomeLanguageSwitch(page) {
  const switcher = visibleHomeLanguageSwitch(page);
  await expect(switcher).toHaveCount(1);
  await switcher.click();
}

test('home navigation follows the fixed and interactive locale', async ({ page }) => {
  const primaryLinks = page.locator('[data-afflatus-nav] > a');
  const labsTrigger = page.locator('.nav-labs__trigger');
  const labsLinks = page.locator('.nav-labs__menu a');

  await page.goto('/zh/', { waitUntil: 'domcontentloaded' });
  await expect(primaryLinks).toHaveText(['竞技场', '板块', '信号']);
  await expect(labsTrigger).toHaveText('实验室');
  await expect(labsLinks).toHaveText(['战绩', '观星', '小说', '课程']);

  await page.goto('/en/', { waitUntil: 'domcontentloaded' });
  await expect(primaryLinks).toHaveText(['Arena', 'Sectors', 'Signal']);
  await expect(labsTrigger).toHaveText('Labs');
  await expect(labsLinks).toHaveText(['Stats', 'Horoscope', 'Novels', 'Course']);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await Promise.all([
    page.waitForURL(/\/zh\/$/),
    clickOnlyHomeLanguageSwitch(page),
  ]);
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(primaryLinks).toHaveText(['竞技场', '板块', '信号']);
  await expect(labsTrigger).toHaveText('实验室');
  await expect(labsLinks).toHaveText(['战绩', '观星', '小说', '课程']);
});

test('home fixed-locale switch preserves query and hash state', async ({ page }) => {
  await page.goto('/en/?combatview=2d#portfolioConvoy', { waitUntil: 'domcontentloaded' });
  await Promise.all([
    page.waitForURL(/\/zh\/\?combatview=2d#portfolioConvoy$/),
    clickOnlyHomeLanguageSwitch(page),
  ]);
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
});

test('home shell resolves a stored adaptive locale before rich experience loads', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('afflatus:locale:v1', 'zh');
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.locator('#langBtn')).toHaveAttribute('href', '/en/');
  await expect(page.locator('#langBtn')).toHaveText('Dream in English');
  await expect(page.locator('#langMiniToggle')).toHaveAttribute('href', '/en/');
  await expect(visibleHomeLanguageSwitch(page)).toHaveCount(1);
});

test('primary navigation replaces duplicate linear page-turn controls', async ({ page }) => {
  for (const path of ['/en/', '/en/arena.html', '/en/horoscope.html', '/en/course.html']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.page-turn-controls, .route-arrows')).toHaveCount(0);
    await expect(page.locator('body')).not.toHaveAttribute('data-prev');
    await expect(page.locator('body')).not.toHaveAttribute('data-next');
    await expect(page.locator('.nav-labs__menu a[data-en="Novels"]'))
      .toHaveAttribute('href', '/zh/serial.html');
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

test('desktop pointer click pins a Labs menu that hover opened', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop pointer interaction');
  await page.goto('/en/course.html', { waitUntil: 'domcontentloaded' });

  const trigger = page.locator('.nav-labs__trigger');
  const menu = page.locator('.nav-labs__menu');
  await trigger.hover();
  await expect(menu).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');

  await trigger.click();
  await expect(menu).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');

  await trigger.click();
  await expect(menu).toBeHidden();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});
