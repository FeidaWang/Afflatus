import {test,expect} from '@playwright/test';

const pages = {
  portfolio: ['fy2026Performance','flightPathsTitle','portfolioConvoy'],
  sectors: ['k3Heading','labsHeading','marketHeading','equitiesHeading','letterHeading','thesesHeading','sourcesHeading'],
  signal: ['treasuryYieldBoard','ch00','ch01','ch02','ch03','ch04'],
  course: ['signal','agent-core','atlas','pathway','education','fieldwork','review'],
};
const visibleNav = page => page.locator('[data-reading-nav]:visible');
async function unobscured(page,id) {
  try { await expect.poll(()=>page.evaluate(id=>{
    const anchor=document.getElementById(id);
    const target=(anchor.matches('section') ? anchor.querySelector('h2, h3') || anchor : anchor).getBoundingClientRect();
    const header=document.querySelector('.site-header--follow').getBoundingClientRect();
    const strip=[...document.querySelectorAll('[data-reading-nav]')].find(n=>n.clientWidth&&getComputedStyle(n).position==='sticky');
    const bottom=Math.max(header.bottom,strip?.getBoundingClientRect().bottom||0);
    return target.top>=bottom-2 && target.top<innerHeight;
  },id)).toBe(true); } catch(error) {
    console.log('Anchor geometry',id,await page.evaluate(id=>({hash:location.hash,top:document.getElementById(id).getBoundingClientRect().top,heading:document.getElementById(id).querySelector('h2,h3')?.getBoundingClientRect().top,header:document.querySelector('.site-header--follow').getBoundingClientRect().bottom,nav:[...document.querySelectorAll('[data-reading-nav]')].map(n=>n.getBoundingClientRect().bottom)}),id));throw error;
  }
}
test.beforeEach(async({page})=>{
  // Local builds have no live API server. Keep external resources out of timing.
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
});
for(const [name,ids] of Object.entries(pages)) for(const locale of ['en','zh']) for(const width of [1440,390]) {
 test(`${name} ${locale} ${width}: links, keyboard, history and deep link`,async({page})=>{
  await page.setViewportSize({width,height:1000});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`/${locale}/${name}.html?m08=reading`,{waitUntil:'domcontentloaded'});
  const nav=visibleNav(page);await expect(nav).toHaveCount(1);
  await expect(nav.locator('a')).toHaveCount(ids.length);
  for(const id of [ids[0],ids[1],ids.at(-1)]) {
    const link=nav.locator(`a[href="#${id}"]`);
    await link.focus();await link.press('Enter');
    await expect(page).toHaveURL(new RegExp(`\\?m08=reading#${id}$`));
    await unobscured(page,id);
    await expect(nav.locator('[aria-current="location"]')).toHaveAttribute('href',`#${id}`);
    await expect(nav.locator('[aria-current]')).toHaveCount(1);
  }
  await page.goBack();await expect(page).toHaveURL(new RegExp(`#${ids[1]}$`));await unobscured(page,ids[1]);
  await page.goForward();await expect(page).toHaveURL(new RegExp(`#${ids.at(-1)}$`));
  await page.reload({waitUntil:'domcontentloaded'});await unobscured(page,ids.at(-1));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
 });
}
for(const [name,ids] of Object.entries(pages)) {
 test(`${name}: no-JS native links and modified click`,async({browser,baseURL})=>{
  const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
  const page=await context.newPage();await page.goto(`${baseURL}/en/${name}.html`,{waitUntil:'domcontentloaded'});
  const link=visibleNav(page).locator(`a[href="#${ids[1]}"]`);
  await link.click();await expect(page).toHaveURL(new RegExp(`#${ids[1]}$`));await unobscured(page,ids[1]);
  await context.close();
 });
}
test('Portfolio: real wheel updates only the current marker, normal motion and RM change',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.goto('/en/portfolio.html?m08=wheel',{waitUntil:'domcontentloaded'});
 await visibleNav(page).locator('a').first().click();
 const original=page.url();const length=await page.evaluate(()=>history.length);
 for(const id of ['flightPathsTitle','portfolioConvoy','fy2026Performance']){
  const delta=await page.locator(`#${id}`).evaluate(e=>e.getBoundingClientRect().top-200);
  await page.mouse.move(900,700);await page.mouse.wheel(0,delta);
  await expect(visibleNav(page).locator('[aria-current]')).toHaveAttribute('href',`#${id}`);
  expect(page.url()).toBe(original);expect(await page.evaluate(()=>history.length)).toBe(length);
 }
 await page.emulateMedia({reducedMotion:'reduce'});
 await visibleNav(page).locator('a').nth(1).click();await unobscured(page,'flightPathsTitle');
});
test('Portfolio: language link retains query and chosen section',async({page})=>{
 await page.goto('/en/portfolio.html?m08=locale',{waitUntil:'domcontentloaded'});
 await visibleNav(page).locator('a').nth(1).click();
 await page.locator('#langMiniToggle').click();
 await expect(page).toHaveURL(/\/zh\/portfolio.html\?m08=locale#flightPathsTitle$/);
 await unobscured(page,'flightPathsTitle');
 await expect(visibleNav(page).locator('a').nth(1)).toHaveText('周期路径');
});
test('Course: a quick second jump is not undone by a delayed first jump',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.goto('/en/course.html',{waitUntil:'domcontentloaded'});
 await visibleNav(page).locator('a[href="#agent-core"]').click();
 await visibleNav(page).locator('a[href="#atlas"]').click();
 await page.waitForTimeout(1000);await unobscured(page,'atlas');
 await expect(page).toHaveURL(/#atlas$/);
});
test('Portfolio: modified click opens an independent native deep link',async({page,context})=>{
 await page.goto('/en/portfolio.html',{waitUntil:'domcontentloaded'});
 const popupPromise=context.waitForEvent('page');
 await visibleNav(page).locator('a').nth(1).click({modifiers:['ControlOrMeta']});
 const popup=await popupPromise;await popup.waitForLoadState('domcontentloaded');
 await expect(popup).toHaveURL(/#flightPathsTitle$/);expect(new URL(page.url()).hash).toBe('');await popup.close();
});
test('Serial: existing drawer has real chapter URLs, current state and Esc return',async({page})=>{
 await page.goto('/zh/serial.html',{waitUntil:'domcontentloaded'});
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
for(const name of ['sectors','signal','course']) test(`${name}: locale switch retains query and section`,async({page})=>{
 const id=pages[name][1];await page.goto(`/en/${name}.html?m08=locale`,{waitUntil:'domcontentloaded'});
 await visibleNav(page).locator(`a[href="#${id}"]`).click();await page.locator('.lang-toggle:visible').click();
 await expect(page).toHaveURL(new RegExp(`/zh/${name}.html\\?m08=locale#${id}$`));await unobscured(page,id);
});
test('Four reading indexes: 320/768/1280 and landscape layouts retain accessible targets',async({page})=>{
 for(const name of Object.keys(pages)){
  await page.goto(`/en/${name}.html`,{waitUntil:'domcontentloaded'});
  for(const [width,height] of [[320,720],[768,1024],[1280,800],[844,390]]){
   await page.setViewportSize({width,height});const nav=visibleNav(page);
   await nav.locator('a').nth(1).click();await unobscured(page,pages[name][1]);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   expect(await nav.locator('a').evaluateAll(links=>links.every(a=>a.getBoundingClientRect().height>=44))).toBe(true);
  }
 }
});
test('Touch: horizontal directory browsing does not change page position or history',async({browser,baseURL})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
 const page=await context.newPage();await page.goto(`${baseURL}/en/sectors.html`,{waitUntil:'domcontentloaded'});
 const nav=visibleNav(page);await nav.locator('a').first().tap();
 const before=await page.evaluate(()=>({y:scrollY,href:location.href,length:history.length}));
 const cdp=await context.newCDPSession(page);const box=await nav.boundingBox();const y=box.y+30;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:330,y}]});
 for(const x of [280,230,180,130,80]) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect.poll(()=>nav.evaluate(n=>n.scrollLeft)).toBeGreaterThan(0);
 expect(await page.evaluate(()=>({y:scrollY,href:location.href,length:history.length}))).toEqual(before);
 await context.close();
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
 await nojs.close();
});
