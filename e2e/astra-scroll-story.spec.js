import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
const evidence = resolve('docs/astra-m05-evidence');
const state = page => page.evaluate(() => {
  const section=document.querySelector('#stardrive'), runway=section.querySelector('.stardrive-runway'), stage=section.querySelector('.stardrive-stage');
  const rect=runway.getBoundingClientRect(), css=getComputedStyle(stage), h=stage.clientHeight;
  return {y:scrollY,top:rect.top,height:rect.height,stageHeight:h,p:Number(section.style.getPropertyValue('--forge')),expected:Math.max(0,Math.min(1,((parseFloat(css.top)||0)-rect.top)/(rect.height-h))),phase:section.dataset.forgePhase,scale:section.style.getPropertyValue('--forge-scale'),light:section.style.getPropertyValue('--forge-light'),forgeDraws:window.__draws.forge,starDraws:window.__draws.star,sticky:css.position,tagline:document.querySelector('#forgeTagline').textContent.trim(),stripOpacity:getComputedStyle(document.querySelector('#strip')).opacity};
});
async function wheelTo(page,y) {
  await page.mouse.move(1100,500);
  await page.mouse.wheel(0,y-await page.evaluate(()=>scrollY));
  await expect.poll(async()=>Math.abs(await page.evaluate(()=>scrollY)-y)).toBeLessThan(3);
  await page.waitForTimeout(120);
}
async function wheelProgress(page,p) {
  const {y,top,height,stageHeight}=await state(page);
  await wheelTo(page,y+top-80+p*(height-stageHeight));
  await expect.poll(async()=>{const s=await state(page);return Math.abs(s.p-s.expected);}).toBeLessThan(.015);
}
async function stopped(page) {
  await page.waitForTimeout(180);const a=await state(page);await page.waitForTimeout(400);const b=await state(page);expect(b.forgeDraws).toBe(a.forgeDraws);
}
test.beforeEach(async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.addInitScript(()=>{
    window.__draws={forge:0,star:0};window.__storyErrors=[];
    for(const Type of [WebGLRenderingContext,WebGL2RenderingContext]) for(const name of ['drawArrays','drawElements']) {
      const draw=Type.prototype[name];Type.prototype[name]=function(...args){if(this.canvas.id==='alphardForge')window.__draws.forge++;if(this.canvas.id==='starfield')window.__draws.star++;return draw.apply(this,args);};
    }
  });
});

test('real wheel: start / 25 / 50 / end / reverse / fast, then data and offscreen stop',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/en/portfolio.html');await expect(page.locator('#heroTitle')).toBeVisible();
  const initial=await state(page);expect(initial.height).toBe(1800);
  const trace=[];
  for(const [name,p] of [['01-start',0],['02-quarter',.25],['03-half',.5],['04-end',1],['05-reverse',.5],['06-fast',.96]]) {
    await wheelProgress(page,p);const s=await state(page);trace.push({name,...s});
    expect(s.tagline).toBe('Every return is a jump through the dark.');expect(s.stripOpacity).toBe('1');
    expect(await page.locator('#forgeTagline').evaluate(e=>getComputedStyle(e).opacity)).toBe('1');
    await page.screenshot({path:`${evidence}/${name}.png`});
  }
  expect(trace[2].scale).toBe(trace[4].scale);expect(trace[3].light).toBe('0.0000');
  const before=await state(page);await wheelTo(page,before.y+before.top+before.height+100);await stopped(page);
  await page.screenshot({path:`${evidence}/07-data.png`});
  expect(await page.locator('#sv0').textContent()).toBe('41.4%');
  await wheelProgress(page,.25);expect((await state(page)).forgeDraws).toBeGreaterThan(before.forgeDraws);
  const a=await state(page);await page.waitForTimeout(500);const b=await state(page);expect(b.starDraws).toBe(a.starDraws);expect(b.forgeDraws).toBeGreaterThan(a.forgeDraws);
  expect(await page.locator('#starfieldViewport').evaluate(e=>getComputedStyle(e).backgroundImage)).toBe('none');
  expect(errors).toEqual([]);writeFileSync(`${evidence}/wheel-states.json`,JSON.stringify(trace,null,2));
});

test('anchor direct entry and changing viewport height sample the current position',async({page})=>{
  await page.goto('/en/portfolio.html#stardrive');await expect(page.locator('#stardrive')).toHaveClass(/forge-ready/);
  await expect.poll(async()=>{const s=await state(page);return Math.abs(s.p-s.expected);}).toBeLessThan(.015);
  await wheelProgress(page,.5);await page.setViewportSize({width:1440,height:820});
  await expect.poll(async()=>{const s=await state(page);return Math.abs(s.p-s.expected);}).toBeLessThan(.015);
  expect((await state(page)).height).toBe(1476);
  await page.screenshot({path:`${evidence}/08-resize.png`});
  await page.goto('/en/portfolio.html#fy2026Performance');await expect(page.locator('#fy2026Performance')).toBeInViewport();
  await stopped(page);await page.screenshot({path:`${evidence}/09-anchor.png`});
});

test('reduced motion starts static; dynamic opt-in changes never leave a dim scene',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/en/portfolio.html#stardrive');
  expect((await state(page)).sticky).toBe('relative');expect((await state(page)).height).toBe((await state(page)).stageHeight);await stopped(page);
  await expect(page.locator('.stardrive-poster')).toBeVisible();await expect(page.locator('#forgeTagline')).toContainText('Every return');
  await page.screenshot({path:`${evidence}/10-reduced.png`});
  await page.emulateMedia({reducedMotion:'no-preference'});await page.reload();await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await document.activeViewTransition?.finished;});await wheelProgress(page,.5);
  await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('#stardrive')).toHaveAttribute('data-forge-phase','static');
  // The media change also collapses the runway. Wait for the coordinator's
  // resize draw (760 → 540), then measure steady-state cessation of rendering.
  await expect.poll(()=>page.locator('#alphardForge').evaluate(e=>e.height)).toBe(540);
  await stopped(page);
  expect(await page.locator('.stardrive-scale').evaluate(e=>getComputedStyle(e).opacity)).toBe('1');
  await page.emulateMedia({reducedMotion:'no-preference'});await wheelProgress(page,.5);const before=(await state(page)).forgeDraws;await expect.poll(async()=>(await state(page)).forgeDraws).toBeGreaterThan(before);
});

test('mobile normal flow preserves touch scrolling and complete metrics',async({browser,baseURL})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();
  await page.goto(`${baseURL}/zh/portfolio.html#stardrive`);
  expect(await page.locator('.stardrive-stage').evaluate(e=>getComputedStyle(e).position)).toBe('relative');
  expect(await page.locator('#forgeTagline').textContent()).toContain('每一份回报');
  const client=await context.newCDPSession(page);const before=await page.evaluate(()=>scrollY);
  await client.send('Input.synthesizeScrollGesture',{x:195,y:650,yDistance:-400,gestureSourceType:'touch'});
  expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(before+100);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({path:`${evidence}/11-mobile.png`});await context.close();
});

test('WebGL and bundle failure keep fixed geometry, poster, full text and links',async({page})=>{
  await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.includes('webgl')?null:get.call(this,type,...args);};});
  await page.goto('/en/portfolio.html#stardrive');await expect(page.locator('.stardrive-poster')).toBeVisible();expect((await state(page)).height).toBe(1800);
  await page.screenshot({path:`${evidence}/12-webgl-failure.png`});
  await page.route('**/*.js*',r=>r.abort());await page.goto('/en/portfolio.html');expect((await state(page)).height).toBe(1800);
  await expect(page.locator('#forgeTagline')).toContainText('Every return is a jump through the dark.');
  await page.locator('#scrollHint').click();await expect(page).toHaveURL(/#fy2026Performance$/);await expect(page.locator('#fy2026Performance')).toBeInViewport();
});


test('context loss restores fallback and resumes only in view; measured draw cadence',async({page})=>{
  await page.goto('/en/portfolio.html');await wheelProgress(page,.5);
  await page.evaluate(()=>{
    const gl=document.querySelector('#alphardForge').getContext('webgl2');
    window.__forgeLoss=gl.getExtension('WEBGL_lose_context');window.__forgeLoss.loseContext();
  });
  await expect(page.locator('#stardrive')).not.toHaveClass(/forge-ready/);await expect(page.locator('.stardrive-poster')).toBeVisible();await stopped(page);
  await page.evaluate(()=>window.__forgeLoss.restoreContext());await expect(page.locator('#stardrive')).toHaveClass(/forge-ready/);
  await expect.poll(async()=>{const s=await state(page);return Math.abs(s.p-s.expected);}).toBeLessThan(.015);
  const result=await page.evaluate(async()=>{
    const times=[];const proto=WebGL2RenderingContext.prototype, draw=proto.drawElements;
    proto.drawElements=function(...args){if(this.canvas.id==='alphardForge')times.push(performance.now());return draw.apply(this,args);};
    const begin=performance.now();await new Promise(r=>setTimeout(r,2500));const elapsed=performance.now()-begin;proto.drawElements=draw;
    const intervals=times.slice(1).map((t,i)=>t-times[i]).sort((a,b)=>a-b),canvas=document.querySelector('#alphardForge'),stage=document.querySelector('.stardrive-stage');
    return {elapsedMs:elapsed,draws:times.length,fps:times.length*1000/elapsed,medianMs:intervals[Math.floor(intervals.length*.5)],p95Ms:intervals[Math.floor(intervals.length*.95)],buffer:[canvas.width,canvas.height],layout:[stage.clientWidth,stage.clientHeight],dpr:canvas.width/stage.clientWidth};
  });
  expect(result.draws).toBeGreaterThan(0);expect(result.dpr).toBeLessThanOrEqual(1.5);writeFileSync(`${evidence}/draw-cadence.json`,JSON.stringify(result,null,2));
});
