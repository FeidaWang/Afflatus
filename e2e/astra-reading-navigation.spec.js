import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
  // Local builds have no live API server. Keep external resources out of timing.
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
});
test('Serial: existing drawer has real chapter URLs, current state and Esc return',async({page})=>{
 await page.goto('/zh/novels/wanjie-zhongchun/1/',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#tocList a')).not.toHaveCount(0);
 await page.locator('#tocOpen').click();
 await expect(page.locator('#tocDrawer')).toHaveAttribute('aria-hidden','false');
 const links=page.locator('#tocList a');await expect(links.first()).toHaveAttribute('href',/\/zh\/novels\/.+\/.+\//);
 await expect(page.locator('#tocList [aria-current="page"]')).toHaveCount(1);
 await page.keyboard.press('Escape');await expect(page.locator('#tocOpen')).toBeFocused();
 await page.locator('#tocOpen').click();const next=await links.nth(1).getAttribute('href');
 await links.nth(1).click();await expect(page).toHaveURL(new RegExp(next+'$'));
 await expect(page.locator('#tocDrawer')).toHaveAttribute('aria-hidden','true');
 await page.locator('#tocOpen').click();await expect(page.locator('#tocList [aria-current="page"]')).toHaveAttribute('href',next);
});
test('Serial: chapter link opens independently and static chapter remains readable without JS',async({page,context,browser,baseURL})=>{
 await page.goto('/zh/novels/wanjie-zhongchun/1/',{waitUntil:'domcontentloaded'});
 await page.locator('#tocOpen').click();
 const popupPromise=context.waitForEvent('page');await page.locator('#tocList a').nth(1).click({modifiers:['ControlOrMeta']});
 const popup=await popupPromise;await popup.waitForLoadState('domcontentloaded');
 await expect(popup).toHaveURL(/\/zh\/novels\/wanjie-zhongchun\/2\/$/);
 await expect(popup.locator('#tocList a[aria-current="page"]')).toHaveAttribute('href',/\/2\/$/);
 await expect(page.locator('#tocDrawer')).toHaveAttribute('aria-hidden','false');await popup.close();
 const nojs=await browser.newContext({javaScriptEnabled:false});const staticPage=await nojs.newPage();
 await staticPage.goto(`${baseURL}/zh/novels/wanjie-zhongchun/2/`,{waitUntil:'domcontentloaded'});
 await expect(staticPage.locator('#readerNormal')).toHaveAttribute('data-prerendered','chapter');
 expect((await staticPage.locator('#chapterBody').innerText()).length).toBeGreaterThan(1000);
 await expect(staticPage.locator('.chapter-nav a').first()).toHaveAttribute('href',/\/1\/$/);
 await staticPage.goto(`${baseURL}/zh/novels/wanjie-zhongchun/`,{waitUntil:'domcontentloaded'});
 await expect(staticPage.locator('#novelTitle')).toBeVisible();
 await expect(staticPage.locator('#chapterBody .prerender-toc a').first()).toBeVisible();
 await nojs.close();
});
