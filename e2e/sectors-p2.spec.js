import { test,expect } from '@playwright/test';
for(const [locale,width,height] of [['en',1440,1000],['zh',390,844]])test(`${locale}: stable tasks, typed dependencies, keyboard and lifecycle`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width,height});await page.goto(`/${locale}/sectors.html`);
 const host=page.locator('#frontierTaskStory');await expect(host).toHaveAttribute('data-step','divide');
 await page.evaluate(()=>{window.__p2tasks=[...document.querySelectorAll('[data-task]')];});
 for(const step of ['frontier','capital','chokepoints','system','divide','system']){
  const b=host.locator(`[data-story-step=${step}]`);await b.focus();await page.keyboard.press('Enter');await expect(b).toBeFocused();await expect(b).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>window.__p2tasks.every((e,i)=>e===document.querySelectorAll('[data-task]')[i]))).toBe(true);
 }
 await expect(host.locator('[data-relationship]')).toHaveCount(12);
 await expect(host.locator('[data-node-controls] button')).toHaveCount(8);
 await host.locator('[data-node-controls] button').filter({hasText:'Micron'}).click();
 await expect(host.locator('[data-relationship]')).toHaveCount(4);
 await host.locator('[data-show-all]').click();await expect(host.locator('[data-relationship]')).toHaveCount(12);
 await host.locator('[data-workload]').selectOption('research');
 await expect(host.locator('[data-task=code]')).toHaveCSS('transform','matrix(1, 0, 0, 1, 0, 0)');
 await host.locator('[data-story-step=capital]').click();
 await host.locator('.fc-task-field').screenshot({path:`tmp/sectors-frontier-p2/${locale}-tasks.png`});
 await host.locator('[data-story-step=system]').click();
 await host.locator('canvas').screenshot({path:`tmp/sectors-frontier-p2/${locale}-network.png`});
 await host.locator('canvas').focus();await page.keyboard.press('Tab');await expect(host.locator('[data-node-controls] button').first()).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(errors).toEqual([]);
});
test('no-script and unavailable graph preserve text evidence',async({browser,page})=>{
 const context=await browser.newContext({javaScriptEnabled:false});const staticPage=await context.newPage();await staticPage.goto('/zh/sectors.html');await staticPage.locator('#frontierTaskText summary').click();await expect(staticPage.locator('#frontierTaskText article')).toHaveCount(12);await context.close();
 await page.route('**/*sectors-ecosystem*',r=>r.abort());await page.goto('/en/sectors.html');await page.locator('[data-story-step=system]').click();await expect(page.locator('[data-relationship]')).toHaveCount(12);await expect(page.locator('[data-node-controls] button')).toHaveCount(0);
});
test('graph pauses offscreen and tears down on nonpersisted pagehide',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.addInitScript(()=>{const clear=CanvasRenderingContext2D.prototype.clearRect;window.__p2draws=0;CanvasRenderingContext2D.prototype.clearRect=function(...args){if(this.canvas.classList.contains('fc-dependency-canvas'))window.__p2draws++;return clear.apply(this,args);};});
 await page.goto('/en/sectors.html');await page.locator('[data-story-step=system]').click();await page.locator('.fc-dependency-canvas').scrollIntoViewIfNeeded();
 await expect.poll(()=>page.evaluate(()=>window.__p2draws)).toBeGreaterThan(3);
 await page.locator('[data-story-step=divide]').click();await page.waitForTimeout(700);const paused=await page.evaluate(()=>window.__p2draws);await page.waitForTimeout(300);expect(await page.evaluate(()=>window.__p2draws)).toBe(paused);
 await page.locator('[data-story-step=system]').click();await page.locator('.fc-dependency-canvas').scrollIntoViewIfNeeded();await expect.poll(()=>page.evaluate(()=>window.__p2draws)).toBeGreaterThan(paused);
 await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false})));const stopped=await page.evaluate(()=>window.__p2draws);await page.waitForTimeout(300);expect(await page.evaluate(()=>window.__p2draws)).toBe(stopped);
});
