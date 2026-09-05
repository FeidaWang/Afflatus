import {test, expect} from '@playwright/test';

// Synthetic candles exercise view behavior only; never written to published data.
const values = Array.from({length:250}, (_, i) => {
  const price = 100 + i / 10;
  return {datetime:new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0,10), open:price, high:price+2, low:price-2, close:price+1, volume:1000000};
}).reverse();
async function load(page, locale) {
  await page.route('**/api/history?**', route => route.fulfill({json:{status:'ok',values}}));
  await page.route('**/api/quote?**', route => route.fulfill({json:{c:125,pc:124}}));
  await page.goto(`/${locale}/arena.html?embed=1`);
  await page.locator('#taSearch').fill('NVDA');
  await page.locator('#taSearch').press('Enter');
  await expect(page.locator('#ta-tab-pre')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
for (const locale of ['en','zh']) for (const width of [1440,390]) {
  test(`${locale} ${width}: keyboard, stable panels, offline rapid switching`, async ({page,context}) => {
    await page.setViewportSize({width,height:900});
    await load(page,locale);
    const pre = page.locator('#ta-tab-pre'), post = page.locator('#ta-tab-post');
    await page.locator('#qmRebalance').selectOption('40');
    await pre.click();
    await expect(page.getByRole('tabpanel')).toHaveCount(1);
    await expect(pre).toHaveAttribute('aria-controls','ta-view-pre');
    await expect(page.locator('#ta-view-pre')).toHaveAttribute('aria-labelledby','ta-tab-pre');
    await page.locator('#ta-view-pre summary').first().click();
    await pre.focus();
    const before = await page.evaluate(() => ({y:scrollY,h:document.querySelector('.ta-views').getBoundingClientRect().height}));
    await pre.press('ArrowLeft');
    await expect(post).toBeFocused();
    await expect(post).toHaveAttribute('aria-selected','true');
    await expect(pre).toHaveAttribute('tabindex','-1');
    expect(await page.locator('#ta-view-pre').evaluate(el=>el.inert)).toBe(true);
    await post.press('ArrowRight'); await expect(pre).toBeFocused();
    await pre.press('End'); await expect(post).toBeFocused();
    await post.press('Home'); await expect(pre).toBeFocused();
    await pre.press('Space'); await pre.press('Enter');
    await context.setOffline(true);
    let calls=0;page.on('request',()=>calls++);
    for(let i=0;i<12;i++) await page.keyboard.press('ArrowRight');
    await expect(pre).toBeFocused();
    expect(calls).toBe(0);
    await expect(page.locator('#qmRebalance')).toHaveValue('40');
    await expect(page.locator('#ta-view-pre details').first()).toHaveAttribute('open','');
    const after = await page.evaluate(() => ({y:scrollY,h:document.querySelector('.ta-views').getBoundingClientRect().height}));
    expect(Math.abs(after.y-before.y)).toBeLessThanOrEqual(1);
    expect(after.h).toBe(before.h);
    await pre.press('Tab'); await expect(page.locator('#taRefresh')).toBeFocused();
    await page.keyboard.press('Shift+Tab'); await expect(pre).toBeFocused();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await context.setOffline(false);
  });
  test(`${locale} ${width}: uninitialized reference views remain sequential`, async ({browser,baseURL}) => {
    const context=await browser.newContext({javaScriptEnabled:false,viewport:{width,height:900}});
    const page=await context.newPage();await page.goto(`${baseURL}/${locale}/arena.html`);
    await expect(page.locator('.ta-fallback article')).toHaveCount(2);
    for(const article of await page.locator('.ta-fallback article').all()) await expect(article).toBeVisible();
    await expect(page.locator('.ta-fallback a')).toHaveAttribute('href','/arena-picks.json');
    await context.close();
  });
}
test('mobile long labels: edges, selected item visible, vertical gesture retained', async ({page}) => {
  await page.setViewportSize({width:320,height:800});await load(page,'en');
  await page.locator('#ta-tab-post').click();
  expect(await page.locator('.ta-modes').evaluate(el=>el.scrollLeft>0)).toBe(true);
  await expect(page.locator('.ta-mode-scroll')).toHaveClass(/has-before/);
  const box=await page.locator('#ta-tab-post').boundingBox();expect(box.x+box.width).toBeLessThanOrEqual(320);
  expect(await page.locator('.ta-modes').evaluate(el=>getComputedStyle(el).touchAction)).toMatch(/pan-y|manipulation/);
  await page.locator('#ta-tab-pre').focus();await page.keyboard.press('Home');
  await expect(page.locator('.ta-mode-scroll')).toHaveClass(/has-after/);
});
test('offline first selection reports unavailability without empty tabs', async ({page,context}) => {
  await page.goto('/en/arena.html?embed=1');await context.setOffline(true);
  await page.locator('#taSearch').fill('NVDA');await page.locator('#taSearch').press('Enter');
  await expect(page.locator('#taPanel [role="alert"]')).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(0);
});

test('touch vertical drag over tabs scrolls page; reduced motion disables fade', async ({browser,baseURL}) => {
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const page=await context.newPage();await load(page,'zh');
  await page.locator('#ta-tab-pre').click();
  await page.evaluate(()=>window.scrollTo(0,document.querySelector('.ta-modes').getBoundingClientRect().top+scrollY-450));
  const rect=await page.locator('.ta-modes').boundingBox();const before=await page.evaluate(()=>scrollY);
  const cdp=await context.newCDPSession(page);const x=rect.x+60,y=rect.y+25;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let i=1;i<=8;i++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*25}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(before+40);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('#ta-tab-post').click();
  expect(await page.locator('#ta-view-post').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
  await context.close();
});
