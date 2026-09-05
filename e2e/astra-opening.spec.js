import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
// Visible Chromium is required for native cross-document capture; the M03
// baseline also stalls headless capture. Allow real browser BFCache behaviour.
test.use({headless:false,launchOptions:{ignoreDefaultArgs:['--disable-back-forward-cache']}});
const evidence = resolve('docs/astra-m04-evidence');
const host = page => page.locator('#starfieldViewport');
const stable = page => expect(host(page)).toHaveAttribute('data-intro', 'complete');
async function bounds(page) {
  return page.evaluate(() => ['heroTitle','heroDesc','scrollHint','starfieldViewport','starfieldReplay'].map(id => {
    const r=document.getElementById(id).getBoundingClientRect();return {id,x:r.x,y:r.y,width:r.width,height:r.height};
  }));
}
test.beforeEach(async ({page}) => {
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.addInitScript(() => {
    window.__introStates=[];window.__pageshows=[];
    addEventListener('pageshow',e=>window.__pageshows.push({persisted:e.persisted}));
    new MutationObserver(records=>{
      for(const r of records) if(r.target.id==='starfieldViewport' && r.attributeName==='data-intro')
        window.__introStates.push({state:r.target.dataset.intro,at:performance.now(),entry:Number(document.documentElement.dataset.introEntry)});
    }).observe(document,{subtree:true,attributes:true,attributeFilter:['data-intro']});
  });
});

test('first HTML is readable and CTA works without any enhancement bundle',async({page})=>{
  await page.route('**/*.js*',route=>route.abort());
  await page.goto('/en/portfolio.html');
  await expect(page.locator('#heroTitle')).toBeVisible();await expect(page.locator('#heroDesc')).toBeVisible();
  await expect(page.locator('#scrollHint')).toBeVisible();await expect(page.locator('#heroCommandCta')).toBeEnabled();
  expect((await host(page).boundingBox()).height).toBeGreaterThan(300);
  expect(await host(page).evaluate(e=>getComputedStyle(e).backgroundImage)).toContain('source-poster');
  await page.screenshot({path:`${evidence}/01-initial-html.png`});
  await page.locator('#scrollHint').click();await expect(page).toHaveURL(/#fy2026Performance$/);
});

test('first entry forms once within budget; replay preserves application state',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/en/portfolio.html');await expect(host(page)).toHaveAttribute('data-state','idle');
  await stable(page);
  const states=await page.evaluate(()=>window.__introStates);
  expect(states.some(s=>s.state==='entering')).toBe(true);
  const finished=states.find(s=>s.state==='complete');expect(finished.at-finished.entry).toBeLessThan(1350);
  await page.screenshot({path:`${evidence}/02-formed.png`});
  const snapshot=()=>page.evaluate(()=>({y:scrollY,lang:document.documentElement.lang,values:[...document.querySelectorAll('.strip-value')].map(e=>e.textContent),storage:{...localStorage}}));
  const before=await snapshot();await page.locator('#starfieldReplay').click();await expect(host(page)).toHaveAttribute('data-intro','entering');
  expect(await snapshot()).toEqual(before);await stable(page);expect(await snapshot()).toEqual(before);
  await page.reload();await expect(host(page)).toHaveAttribute('data-state','idle');await stable(page);
  expect((await page.evaluate(()=>window.__introStates)).some(s=>s.state==='entering')).toBe(false);
  expect(errors).toEqual([]);
  writeFileSync(`${evidence}/sequence.json`,JSON.stringify(states,null,2));
});

test('early scroll, form focus, reduced motion and navigation cancel immediately',async({page})=>{
  await page.goto('/en/portfolio.html');await expect(host(page)).toHaveAttribute('data-state','idle');
  await page.locator('#starfieldReplay').click();await expect(host(page)).toHaveAttribute('data-intro','entering');
  await page.mouse.wheel(0,80);await stable(page);
  await page.screenshot({path:`${evidence}/03-early-scroll.png`});
  await page.mouse.wheel(0,-200);await expect(host(page)).toHaveAttribute('data-state','idle');
  // No public form is added: this exercises the cancellation boundary only.
  await page.evaluate(()=>{const input=document.createElement('input');input.id='intro-test-input';document.querySelector('.hero').append(input);});
  await page.locator('#starfieldReplay').click();await page.locator('#intro-test-input').focus();await stable(page);
  await page.evaluate(()=>document.querySelector('#intro-test-input').remove());
  await page.locator('#starfieldReplay').click();await page.emulateMedia({reducedMotion:'reduce'});await stable(page);
  await expect(page.locator('#starfieldReplay')).toBeDisabled();
  await page.emulateMedia({reducedMotion:'no-preference'});await stable(page);
  await page.locator('#starfieldReplay').click();await page.locator('#scrollHint').click();await stable(page);
  await expect(page).toHaveURL(/#fy2026Performance$/);
});

test('real back/forward and persisted restoration never replay or reset scroll',async({page})=>{
  await page.goto('/en/portfolio.html');await stable(page);await expect(host(page)).toHaveAttribute('data-state','idle');
  await page.mouse.wheel(0,180);await page.waitForTimeout(200);const y=await page.evaluate(()=>scrollY);
  const entryCount=await page.evaluate(()=>window.__introStates.filter(s=>s.state==='entering').length);
  await page.goto('/en/course.html');
  // Wait for the destination to be presented before beginning another native
  // navigation; overlapping native captures can stall Chromium itself.
  await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await document.activeViewTransition?.finished;});
  await page.goBack({waitUntil:'commit'});await stable(page);
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(y);
  await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await document.activeViewTransition?.finished;});
  await page.screenshot({path:`${evidence}/04-history-restored.png`});
  const restored=await page.evaluate(()=>({type:performance.getEntriesByType('navigation')[0].type,pageshows:window.__pageshows,states:window.__introStates,y:scrollY}));
  writeFileSync(`${evidence}/history.json`,JSON.stringify(restored,null,2));
  if(restored.pageshows.some(event=>event.persisted)) expect(restored.states.filter(s=>s.state==='entering')).toHaveLength(entryCount);
  else expect(restored.states.some(s=>s.state==='entering')).toBe(false);
  await page.goForward({waitUntil:'commit'});await expect(page).toHaveURL(/course.html$/);
  await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await document.activeViewTransition?.finished;});
  await page.goBack({waitUntil:'commit'});await stable(page);
  await page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});await stable(page);
  expect(await page.evaluate(()=>scrollY)).toBe(y);
});

test('late resources never start an opening and do not move text or controls',async({page})=>{
  let release;const gate=new Promise(resolve=>release=resolve);
  await page.route('**/*backgroundScene*.js*',async route=>{await gate;await route.continue();});
  await page.route('**/*.woff2*',async route=>{await gate;await route.continue();});
  await page.goto('/en/portfolio.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(250);const before=await bounds(page);
  await page.waitForTimeout(1300);await stable(page);release();
  await expect(host(page)).toHaveAttribute('data-state','idle');await page.evaluate(()=>document.fonts.ready);
  const after=await bounds(page);
  writeFileSync(`${evidence}/late-resource-layout.json`,JSON.stringify({before,after},null,2));
  for(let i=0;i<before.length;i++) for(const key of ['x','y','width','height']) expect(Math.abs(after[i][key]-before[i][key])).toBeLessThan(.1);
  expect((await page.evaluate(()=>window.__introStates)).some(s=>s.state==='entering')).toBe(false);
  writeFileSync(`${evidence}/late-resource-layout.json`,JSON.stringify({before,after},null,2));
});

test('reduced motion and renderer failure show a stable poster and usable CTA',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/zh/portfolio.html');await stable(page);
  await expect(page.locator('#starfieldReplay')).toBeDisabled();await expect(page.locator('#heroDesc')).toBeVisible();
  expect(await page.evaluate(()=>performance.getEntriesByType('resource').some(e=>e.name.includes('backgroundScene-')))).toBe(false);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.route('**/*backgroundScene*.js*',route=>route.abort());await page.reload();await stable(page);
  await expect(host(page)).toHaveAttribute('data-state','fallback');await expect(page.locator('#starfieldReplay')).toBeDisabled();
  await page.locator('#scrollHint').click();await expect(page).toHaveURL(/#fy2026Performance$/);
});


test('scroll before the main bundle arrives is remembered even after returning to the top',async({page})=>{
  let release;const gate=new Promise(resolve=>release=resolve);
  await page.route('**/assets/portfolio-*.js',async route=>{await gate;await route.continue();});
  await page.goto('/en/portfolio.html',{waitUntil:'commit'});
  await expect(page.locator('#scrollHint')).toBeVisible();
  await page.mouse.wheel(0,100);await page.waitForTimeout(80);
  await page.mouse.wheel(0,-200);await page.waitForTimeout(80);
  expect(await page.locator('html').getAttribute('data-intro-interrupted')).toBe('true');
  release();await expect(host(page)).toHaveAttribute('data-state','idle');await stable(page);
  expect((await page.evaluate(()=>window.__introStates)).some(s=>s.state==='entering')).toBe(false);
});
