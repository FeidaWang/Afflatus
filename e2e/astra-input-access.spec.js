import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
const evidence=resolve('docs/astra-m07-evidence');
const draws=(page,id)=>page.evaluate(id=>window.__draws[id]||0,id);
async function stopped(page,id){await page.waitForTimeout(400);const n=await draws(page,id);await page.waitForTimeout(500);expect(await draws(page,id)).toBe(n);}
async function wheelTo(page,selector,offset=100){const y=await page.locator(selector).evaluate((e,offset)=>scrollY+e.getBoundingClientRect().top-offset,offset);await page.mouse.move(1200,700);await page.mouse.wheel(0,y-await page.evaluate(()=>scrollY));await page.waitForTimeout(250);}
test.beforeEach(async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.addInitScript(()=>{window.__draws={};for(const Type of [WebGLRenderingContext,WebGL2RenderingContext])for(const name of ['drawArrays','drawElements']){const draw=Type.prototype[name];Type.prototype[name]=function(...args){window.__draws[this.canvas.id]=(window.__draws[this.canvas.id]||0)+1;return draw.apply(this,args);};}});
});

test('fine pointer requires entry, preserves 6px capture and returns Esc focus; arrows are local',async({page})=>{
  await page.goto('/en/portfolio.html');const host=page.locator('#starfieldViewport');await expect(host).toHaveAttribute('data-state','idle');
  const box=await host.boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+70,y+30);await page.mouse.up();await expect(host).toHaveAttribute('data-interacting','false');
  await page.locator('#starfieldInteract').click();await expect(host).toBeFocused();
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+3,y);await expect(host).not.toHaveClass(/is-dragging/);
  await page.mouse.move(x+60,y+10);await expect(host).toHaveClass(/is-dragging/);await host.dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();expect(await host.evaluate(e=>e.hasPointerCapture(1))).toBe(false);
  await host.press('ArrowRight');await host.press('Home');await host.press('Escape');await expect(page.locator('#starfieldInteract')).toBeFocused();await expect(host).toHaveAttribute('data-interacting','false');
  await page.locator('#starfieldPause').focus();const before=await page.evaluate(()=>scrollY);await page.keyboard.press('ArrowDown');await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(before);
});

test('one stored pause stops hero, Forge and solar; DOM selection remains available',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/en/portfolio.html');await expect(page.locator('#starfieldViewport')).toHaveAttribute('data-state','idle');
  await page.locator('#starfieldPause').click();await stopped(page,'starfield');await page.reload();await expect(page.locator('#starfieldPause')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#starfieldViewport')).toHaveAttribute('data-state','paused');
  await wheelTo(page,'.stardrive-stage');await expect(page.locator('#stardrive')).toHaveClass(/forge-ready/);await stopped(page,'alphardForge');await expect(page.locator('#forgePause')).toHaveAttribute('aria-pressed','true');
  await wheelTo(page,'#portfolioConvoy');await expect(page.locator('#pickGrid .pick-card')).toHaveCount(10);await wheelTo(page,'.convoy-orbit');await expect(page.locator('.orbit-field')).toHaveClass(/solar-ready/);await stopped(page,'convoySolarSystem');
  await page.locator('#pickGrid .pcCover').nth(1).click();await expect(page.locator('#pickGrid .pcCover').nth(1)).toHaveAttribute('aria-pressed','true');await expect(page.locator('.orbit-field')).toHaveAttribute('data-active-body',/MERCURY/i);
  await page.screenshot({path:`${evidence}/01-paused-selection.png`});
  await page.locator('#solarPause').click();const n=await draws(page,'convoySolarSystem');await expect.poll(()=>draws(page,'convoySolarSystem')).toBeGreaterThan(n);expect(errors).toEqual([]);
});

test('solar dynamically follows reduced motion and remains readable without WebGL',async({page})=>{
  await page.goto('/en/portfolio.html#portfolioConvoy');await expect(page.locator('#pickGrid .pick-card')).toHaveCount(10);await wheelTo(page,'.convoy-orbit');
  await expect.poll(()=>draws(page,'convoySolarSystem')).toBeGreaterThan(2);
  // Let lazy card selection and initial geometry settle before measuring idle drawing.
  await page.waitForTimeout(1000);await page.emulateMedia({reducedMotion:'reduce'});await stopped(page,'convoySolarSystem');
  await page.emulateMedia({reducedMotion:'no-preference'});const n=await draws(page,'convoySolarSystem');await expect.poll(()=>draws(page,'convoySolarSystem')).toBeGreaterThan(n);
  await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.includes('webgl')?null:get.call(this,type,...args);};});
  await page.reload();await expect(page.locator('#pickGrid .pick-card')).toHaveCount(10);await page.locator('#pickGrid .pcCover').nth(1).click();await expect(page.locator('#pickGrid .pcCover').nth(1)).toHaveAttribute('aria-pressed','true');
});

test('coarse pointer at desktop width stays static and keeps touch pan/pinch and DOM picking',async({browser,baseURL})=>{
  const context=await browser.newContext({viewport:{width:1280,height:800},hasTouch:true,isMobile:true});const page=await context.newPage();await page.goto(`${baseURL}/en/portfolio.html`);
  expect(await page.evaluate(()=>matchMedia('(pointer: coarse)').matches)).toBe(true);await expect(page.locator('#starfieldInteract')).toBeDisabled();await expect(page.locator('#starfieldViewport')).toHaveAttribute('data-state','static');
  expect(await page.locator('#starfieldViewport').evaluate(e=>getComputedStyle(e).touchAction)).toBe('pan-y pinch-zoom');
  const session=await context.newCDPSession(page),before=await page.evaluate(()=>scrollY);await session.send('Input.synthesizeScrollGesture',{x:800,y:500,yDistance:-300,gestureSourceType:'touch'});expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(before+100);
  await page.goto(`${baseURL}/en/portfolio.html#portfolioConvoy`);await expect(page.locator('#pickGrid .pick-card')).toHaveCount(10);await page.locator('#pickGrid .pcCover').nth(1).tap();await expect(page.locator('#pickGrid .pcCover').nth(1)).toHaveAttribute('aria-pressed','true');
  expect(await page.locator('#convoyNodes button').count()).toBe(0);await page.screenshot({path:`${evidence}/02-wide-touch.png`});await context.close();
});

test('Command camera requires entry; Esc closes one layer and restores its trigger',async({page})=>{
  await page.goto('/en/portfolio.html');await page.locator('#heroCommandCta').click();await expect(page.locator('#cicCameraInteract')).toBeVisible();
  const canvas=page.locator('#cicPilotFeed');expect(await canvas.evaluate(e=>getComputedStyle(e).touchAction)).toBe('pan-y pinch-zoom');
  await page.locator('#cicCameraInteract').click();await expect(canvas).toBeFocused();await expect(canvas).toHaveAttribute('data-camera-interacting','true');await canvas.press('ArrowRight');await canvas.press('Escape');
  await expect(page.locator('#cicCameraInteract')).toBeFocused();await expect(page.locator('body')).not.toHaveClass(/hud-off/);
  const trigger=page.locator('.cic-panel-focus[data-cic-panel-focus="tactical"]');await trigger.click();await page.keyboard.press('Escape');await expect(trigger).toBeFocused();await expect(page.locator('body')).not.toHaveClass(/hud-off/);
  await page.locator('#voyageLogToggle').click();await expect(page.locator('#voyageLogClose')).toBeFocused();await page.keyboard.press('Escape');await expect(page.locator('#voyageLogToggle')).toBeFocused();await expect(page.locator('body')).not.toHaveClass(/hud-off/);
  await page.keyboard.press('Escape');await expect(page.locator('#heroCommandCta')).toBeFocused();await expect(page.locator('body')).toHaveClass(/hud-off/);
});

test('Command preserves safe-area space and real target boxes when the viewport shrinks',async({page})=>{
  await page.setViewportSize({width:844,height:390});await page.emulateMedia({reducedMotion:'reduce'});
  const session=await page.context().newCDPSession(page);
  await session.send('Emulation.setSafeAreaInsetsOverride',{insets:{left:44,right:44,bottom:34,top:0}});
  await page.goto('/en/portfolio.html');await page.locator('#heroCommandCta').click();
  await expect(page.locator('body')).not.toHaveClass(/hud-off/);
  const box=await page.locator('#combatHud .cic-shell').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(44);expect(box.x+box.width).toBeLessThanOrEqual(800);expect(box.y).toBeGreaterThanOrEqual(95);expect(box.y+box.height).toBeLessThanOrEqual(356);
  const menu=await page.locator('#portfolioMenu summary').boundingBox();expect(menu.x+menu.width).toBeLessThanOrEqual(800);
  const tabs=await page.locator('.cic-station-tabs button').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()));
  for(let i=0;i<tabs.length;i++){expect(tabs[i].height).toBeGreaterThanOrEqual(44);if(i)expect(tabs[i].left).toBeGreaterThanOrEqual(tabs[i-1].right);}
  await page.screenshot({path:`${evidence}/safe-area-simulation.png`});
  await page.setViewportSize({width:390,height:460});await expect(page.locator('#commandModeBtn')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('#heroCommandCta')).toBeFocused();
});

for(const [width,height,touch] of [[320,720,false],[390,844,true],[768,1024,true],[1280,800,false]]){
  test(`layout ${width}x${height} ${touch?'coarse':'fine'} and orientation`,async({browser,baseURL})=>{
    const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch,reducedMotion:'reduce'});const page=await context.newPage();await page.goto(`${baseURL}/zh/portfolio.html`);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const controls=await page.locator('#mainContent :is(.starfield-controls button,[data-motion-pause])').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return{id:e.id,width:r.width,height:r.height};}));
    for(const c of controls){expect(c.width,c.id).toBeGreaterThanOrEqual(44);expect(c.height,c.id).toBeGreaterThanOrEqual(44);}
    await page.screenshot({path:`${evidence}/layout-${width}.png`});
    await page.setViewportSize({width:height,height:width});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(height);
    await page.screenshot({path:`${evidence}/landscape-${width}.png`});writeFileSync(`${evidence}/controls-${width}.json`,JSON.stringify(controls,null,2));await context.close();
  });
}
