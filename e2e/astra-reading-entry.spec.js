import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
const evidence=resolve('docs/astra-m06-evidence');
const target=page=>page.locator('#s2title');
const steady=async locator=>{
  await expect(locator).not.toHaveClass(/reading-enter/);
  expect(await locator.evaluate(e=>{const s=getComputedStyle(e);return [s.opacity,s.transform,s.willChange];})).toEqual(['1','none','auto']);
};
async function enter(page,selector='#s2title',fraction=.88){
  const y=await page.locator(selector).evaluate((e,f)=>scrollY+e.getBoundingClientRect().top-innerHeight*f,fraction);
  await page.mouse.move(1300,800);await page.mouse.wheel(0,y-await page.evaluate(()=>scrollY));
}
test.beforeEach(async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.addInitScript(()=>{window.__readingStarts=[];document.addEventListener('animationstart',e=>{if(e.animationName==='portfolio-reading-enter')window.__readingStarts.push(e.target.dataset.readingEntry);});});
});

test('one prose entrance, complete DOM, automatic final state and no replay on return',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/en/portfolio.html');await steady(target(page));
  expect(await page.locator('#mainContent [data-reading-entry]').evaluateAll(els=>els.every(e=>getComputedStyle(e).opacity==='1'))).toBe(true);
  const html=await target(page).innerHTML();await enter(page);await expect(target(page)).toHaveClass(/reading-enter/);
  await page.screenshot({path:`${evidence}/01-entering.png`});await steady(target(page));
  expect(await target(page).innerHTML()).toBe(html);
  const starts=await page.evaluate(()=>window.__readingStarts.filter(x=>x==='s2title').length);expect(starts).toBe(1);
  await page.mouse.wheel(0,1400);await page.waitForTimeout(100);await enter(page);await page.waitForTimeout(600);
  await steady(target(page));expect(await page.evaluate(()=>window.__readingStarts.filter(x=>x==='s2title').length)).toBe(1);
  await page.screenshot({path:`${evidence}/02-read-return.png`});expect(errors).toEqual([]);
});

test('fast jump, native find selection and direct anchors remain fully readable',async({page})=>{
  await page.goto('/en/portfolio.html');await enter(page,'#s2title',.25);await page.waitForTimeout(100);await steady(target(page));
  expect(await page.evaluate(()=>window.__readingStarts.includes('s2title'))).toBe(false);
  await page.reload();await page.evaluate(()=>window.find('Return is not one number',false,false,true));
  expect(await page.evaluate(()=>getSelection().toString())).toContain('Return is not one number');await steady(target(page));
  await page.screenshot({path:`${evidence}/03-find.png`});
  await page.goto('/en/portfolio.html#fy2026Performance');await expect(page.locator('#fy2026Performance')).toBeInViewport();await steady(target(page));
  expect(await page.evaluate(()=>window.__readingStarts)).toEqual([]);
});

test('find shortcut, printing, reduced motion and script errors cancel active entry',async({page})=>{
  for(const mode of ['find','print','reduce','error']){
    await page.goto('/en/portfolio.html');await page.emulateMedia({media:'screen',reducedMotion:'no-preference'});await page.reload();
    await enter(page);await expect(target(page)).toHaveClass(/reading-enter/);
    if(mode==='find')await page.keyboard.press('Control+f');
    if(mode==='print'){await page.emulateMedia({media:'print'});await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));}
    if(mode==='reduce')await page.emulateMedia({reducedMotion:'reduce'});
    if(mode==='error')await page.evaluate(()=>dispatchEvent(new ErrorEvent('error',{message:'M06 fallback test'})));
    await steady(target(page));
    if(mode==='print')await page.screenshot({path:`${evidence}/04-print.png`});
  }
});

test('CSS finishes even when JS cleanup fails; no retained will-change',async({page})=>{
  await page.goto('/en/portfolio.html');
  // Deliberately orphan the enhancement class, simulating failed cleanup.
  await target(page).evaluate(e=>{e.classList.add('reading-enter');e.addEventListener('animationend',event=>event.stopPropagation(),{capture:true});});
  await page.waitForTimeout(650);
  expect(await target(page).evaluate(e=>{const s=getComputedStyle(e);return [s.opacity,s.transform,s.willChange];})).toEqual(['1','none','auto']);
});

test('cards register only prose with <=150ms stagger; chart and media geometry stays separate',async({page})=>{
  await page.goto('/en/portfolio.html');await enter(page,'#portfolioConvoy',.95);
  await expect(page.locator('#pickGrid .pick-thesis')).toHaveCount(10);
  const records=await page.locator('#pickGrid [data-reading-entry]').evaluateAll(els=>els.map(e=>({tag:e.className,key:e.dataset.readingEntry,order:Number(e.dataset.readingOrder)})));
  expect(records).toHaveLength(10);expect(new Set(records.map(x=>x.key)).size).toBe(10);
  expect(records.every(x=>x.tag.includes('pick-thesis')&&x.order>=0&&x.order<=3)).toBe(true);
  expect(await page.locator('[data-reading-entry] :is(canvas,table,svg,.alloc-bar,.alloc-num,.strip-value,.core-telemetry)').count()).toBe(0);
  const box=await page.locator('.orbit-field').boundingBox();expect(Math.abs(box.width-box.height)).toBeLessThan(2);
  const thesis=page.locator('[data-reading-entry="holding-NVDA"]');
  await enter(page,'[data-reading-entry="holding-NVDA"]',.8);
  await expect(thesis).toHaveClass(/reading-enter/);await steady(thesis);
  // A wheel entrance can leave the viewport before the stagger starts; cancellation is valid.
  const starts = await page.evaluate(()=>window.__readingStarts.filter(x=>x==='holding-NVDA').length);
  expect(starts).toBeLessThanOrEqual(1);
  await page.screenshot({path:`${evidence}/05-cards.png`});
  await page.mouse.wheel(0,1100);await page.waitForTimeout(100);await enter(page,'[data-reading-entry="holding-NVDA"]',.8);await page.waitForTimeout(600);
  expect(await page.evaluate(()=>window.__readingStarts.filter(x=>x==='holding-NVDA').length)).toBe(starts);
});

test('no JavaScript and reduced-motion first visits keep complete content and reserved media',async({browser,baseURL,page})=>{
  const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});const nojs=await context.newPage();
  await nojs.goto(`${baseURL}/zh/portfolio.html#fy2026Performance`);await steady(target(nojs));
  expect(await nojs.locator('#s2title').textContent()).toBeTruthy();expect(await nojs.locator('#sv0').textContent()).toBe('41.4%');
  expect(await nojs.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await nojs.screenshot({path:`${evidence}/06-nojs-mobile.png`});await context.close();
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/en/portfolio.html');await enter(page);await page.waitForTimeout(500);await steady(target(page));
  expect(await page.evaluate(()=>window.__readingStarts)).toEqual([]);
});
