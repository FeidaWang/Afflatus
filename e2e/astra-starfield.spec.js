import { test, expect } from '@playwright/test';

async function trackDraws(page) {
  await page.addInitScript(() => {
    window.__starDraws = 0;
    for (const Type of [WebGLRenderingContext, WebGL2RenderingContext]) {
      const draw = Type.prototype.drawArrays;
      Type.prototype.drawArrays = function (...args) { if (this.canvas.id === 'starfield') window.__starDraws++; return draw.apply(this, args); };
    }
  });
}
const draws = page => page.evaluate(() => window.__starDraws);
async function unchanged(page) {
  await page.waitForTimeout(150);
  const before = await draws(page);
  await page.waitForTimeout(350);
  expect(await draws(page)).toBe(before);
}
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await trackDraws(page);
});

test('one renderer, 6px drag capture, cancel/up release, keyboard and reset', async ({ page }) => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/portfolio.html');
  const host=page.locator('#starfieldViewport');
  await expect(host).toHaveAttribute('data-state','idle');
  await expect(host).toHaveAttribute('data-particles','4000');
  expect(Number(await host.getAttribute('data-dpr'))).toBeLessThanOrEqual(1.5);
  await page.locator('#starfieldInteract').click();
  const r=await host.boundingBox();const x=r.x+r.width*.5,y=r.y+r.height*.5;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+3,y);
  await expect(host).not.toHaveClass(/is-dragging/);
  await page.mouse.move(x+70,y+30,{steps:5});await expect(host).toHaveClass(/is-dragging/);
  await host.dispatchEvent('pointercancel',{pointerId:1,pointerType:'mouse'});
  await expect(host).not.toHaveClass(/is-dragging/);
  expect(await host.evaluate(el=>el.hasPointerCapture(1))).toBe(false);
  await page.mouse.up();
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+45,y+12);await page.mouse.up();
  await expect(host).not.toHaveClass(/is-dragging/);
  await page.locator('#starfieldPause').click();await page.locator('#starfieldReset').click();
  await unchanged(page);
  await host.press("Home");
  const original=await page.locator("#starfield").screenshot();
  await host.press('ArrowRight');const turned=await page.locator("#starfield").screenshot();expect(turned.equals(original)).toBe(false);
  await host.press('Home');const restored=await page.locator("#starfield").screenshot();expect(restored.equals(original)).toBe(true);
  await host.press('Escape');await expect(page.locator('#starfieldInteract')).toBeFocused();
  await expect(page.locator('#blackhole-gl')).not.toHaveAttribute('src');
  await expect(page.locator('#starfield')).toHaveAttribute('aria-hidden','true');
  await page.locator('#scrollHint').click();await expect(page).toHaveURL(/#fy2026Performance$/);
  expect(errors).toEqual([]);
});

test('pause survives reload; offscreen, Command and forge stop actual drawing', async ({ page }) => {
  await page.goto('/portfolio.html');const host=page.locator('#starfieldViewport');
  await expect(host).toHaveAttribute('data-state','idle');
  await page.waitForTimeout(100);expect(await draws(page)).toBeGreaterThan(0);
  await page.locator('#starfieldPause').click();await unchanged(page);
  await page.reload();await expect(host).toHaveAttribute('data-state','paused');await unchanged(page);
  await page.locator('#starfieldPause').click();
  await page.locator('#commandModeBtn').click();await expect(page.locator('body')).not.toHaveClass(/hud-off/);await unchanged(page);
  await page.keyboard.press('Escape');await expect.poll(()=>draws(page)).toBeGreaterThan(1);
  await page.mouse.wheel(0,700);await page.waitForTimeout(400);await unchanged(page);
  await page.mouse.wheel(0,-1500);await expect(host).toHaveAttribute('data-state','idle');
  const before=await draws(page);await expect.poll(()=>draws(page)).toBeGreaterThan(before);
});

test('dynamic reduced motion stops drawing and returns a stable poster', async ({ page }) => {
  await page.goto('/portfolio.html');await expect(page.locator('#starfieldViewport')).toHaveAttribute('data-state','idle');
  await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('#starfieldViewport')).toHaveAttribute('data-state','static');
  await expect(page.locator('#starfieldPause')).toBeEnabled();await unchanged(page);
  await page.emulateMedia({reducedMotion:'no-preference'});await expect(page.locator('#starfieldViewport')).toHaveAttribute('data-state','idle');
});

test('WebGL failure leaves static subject, navigation and text available', async ({ page }) => {
  await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...rest){return type.includes('webgl')?null:original.call(this,type,...rest);};});
  await page.goto('/portfolio.html');await expect(page.locator('#starfieldViewport')).toHaveAttribute('data-state','fallback');
  await expect(page.locator('#heroDesc')).toBeVisible();await expect(page.locator('#starfieldPause')).toBeEnabled();
  await page.locator('#scrollHint').click();await expect(page).toHaveURL(/#fy2026Performance$/);
});

test('touch uses static subject and preserves vertical pan', async ({ browser, baseURL }) => {
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();
  await trackDraws(page);await page.goto(`${baseURL}/portfolio.html`);
  await expect(page.locator('#starfieldViewport')).toHaveAttribute('data-state','static');
  await expect(page.locator('#starfieldPause')).toBeEnabled();
  expect(await page.locator('#starfieldViewport').evaluate(e=>getComputedStyle(e).touchAction)).toContain('pan-y');
  expect(await draws(page)).toBe(0);
  const client=await page.context().newCDPSession(page);
  await page.locator('#starfieldViewport').scrollIntoViewIfNeeded();
  const r=await page.locator('#starfieldViewport').boundingBox();const before=await page.evaluate(()=>scrollY);
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width*.5,y:r.y+r.height*.7}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x+r.width*.5,y:r.y+r.height*.2}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(before);
  await context.close();
});


test('real context loss restores once, then keeps the licensed poster', async ({page}) => {
  await page.goto('/portfolio.html');
  const canvas=page.locator('#starfield'), host=page.locator('#starfieldViewport');
  await expect(host).toHaveAttribute('data-state','idle');
  const supported=await canvas.evaluate(el=>Boolean(el.getContext('webgl2').getExtension('WEBGL_lose_context')));
  test.skip(!supported,'Browser does not expose WEBGL_lose_context');
  await canvas.evaluate(el=>{window.__loss=el.getContext('webgl2').getExtension('WEBGL_lose_context');window.__loss.loseContext();});
  await expect(canvas).toHaveAttribute('data-renderer','lost');await unchanged(page);
  await page.evaluate(()=>window.__loss.restoreContext());
  await expect(canvas).toHaveAttribute('data-renderer','webgl');
  const before=await draws(page);await expect.poll(()=>draws(page)).toBeGreaterThan(before);
  await canvas.evaluate(el=>el.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await expect(host).toHaveAttribute('data-state','fallback');await unchanged(page);
  await expect(page.locator('#starfieldPause')).toBeEnabled();
  await page.locator('#scrollHint').click();await expect(page).toHaveURL(/#fy2026Performance$/);
});

test('starfield module failure and JavaScript disabled keep navigation usable', async ({page,browser,baseURL}) => {
  await page.route('**/*backgroundScene*.js*',route=>route.abort());
  await page.goto('/portfolio.html');
  await expect(page.locator('#starfieldViewport')).toHaveAttribute('data-state','fallback');
  await page.locator('#portfolioMenu summary').click();await expect(page.locator('#portfolioMenu .portfolio-menu-links')).toBeVisible();
  const context=await browser.newContext({javaScriptEnabled:false});const nojs=await context.newPage();
  await nojs.goto(`${baseURL}/portfolio.html`);
  await expect(nojs.locator('#heroDesc')).toBeVisible();await expect(nojs.locator('#starfieldPause')).toBeDisabled();
  await nojs.locator('#scrollHint').click();await expect(nojs).toHaveURL(/#fy2026Performance$/);
  await context.close();
});

test('existing low-tier budget reduces particles and persisted page lifecycle stops drawing', async ({page}) => {
  await page.addInitScript(()=>Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>2}));
  await page.goto('/portfolio.html');
  const host=page.locator('#starfieldViewport');
  await expect(host).toHaveAttribute('data-state','idle');
  await expect(host).toHaveAttribute('data-particles','1200');
  expect(Number(await host.getAttribute('data-dpr'))).toBeLessThanOrEqual(1);
  await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
  await unchanged(page);
  await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  const before=await draws(page);await expect.poll(()=>draws(page)).toBeGreaterThan(before);
});
