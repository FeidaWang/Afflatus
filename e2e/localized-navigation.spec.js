import { expect, test } from '@playwright/test';

const visibleHomeLanguageSwitch = (page) => page.locator('#langBtn:visible');

async function clickOnlyHomeLanguageSwitch(page) {
  const switcher = visibleHomeLanguageSwitch(page);
  await expect(switcher).toHaveCount(1);
  await switcher.click();
}

test('home navigation follows the fixed and interactive locale', async ({ page }) => {
  const groupTriggers = page.locator('.nav-trigger');

  await page.goto('/zh/', { waitUntil: 'domcontentloaded' });
  await expect(groupTriggers).toHaveText(['市场', '实验室', '写作']);
  await expect(page.locator('.nav-about')).toHaveText('关于');

  await page.goto('/en/', { waitUntil: 'domcontentloaded' });
  await expect(groupTriggers).toHaveText(['Markets', 'Lab', 'Writing']);
  await expect(page.locator('.nav-about')).toHaveText('About');

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await Promise.all([
    page.waitForURL(/\/zh\/$/),
    clickOnlyHomeLanguageSwitch(page),
  ]);
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(groupTriggers).toHaveText(['市场', '实验室', '写作']);
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
