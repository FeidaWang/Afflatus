import { test, expect } from '@playwright/test';

for (const locale of ['en','zh']) {
 test(`P4 ${locale}: static dossiers, keyboard disclosure and evidence links`, async({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:locale==='en'?1440:390,height:900}});
  const page=await context.newPage();
  try {
   await page.goto(`http://127.0.0.1:4173/${locale}/sectors.html`);
   await expect(page.locator('#frontierIssuers [data-issuer]')).toHaveCount(4);
   await expect(page.locator('#frontierTheses [data-thesis]')).toHaveCount(8);
   await expect(page.locator('#issuer-alibaba .fc-instruments li')).toHaveCount(3);
   await expect(page.locator('#issuer-micron .fc-roles')).toContainText(locale==='en'?'Investor':'投资者');
   const summary=page.locator('#issuer-micron summary');await summary.focus();await page.keyboard.press('Enter');
   await expect(page.locator('#issuer-micron details')).toHaveAttribute('open','');
   await page.locator('#issuer-micron a[href="#thesis-T06"]').click();
   const thesis=page.locator('#thesis-T06');await thesis.locator('summary').click();
   expect(await thesis.locator('dd').evaluate(el=>el.getBoundingClientRect().width)).toBeGreaterThan(200);
   await expect(thesis.locator('dd')).toContainText(locale==='en'?'pricing pressure':'价格压力');
   await thesis.locator('a[href="#p4-source-MU-ANT"]').click();
   await expect(page.locator('#p4-source-MU-ANT')).toBeVisible();
   await expect(page.locator('#p4-source-MU-ANT')).toContainText('2026-06-22');
   await page.locator('#issuer-alibaba').scrollIntoViewIfNeeded();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await page.screenshot({path:`tmp/sectors-frontier-p4/${locale}-issuer.png`});
   await thesis.scrollIntoViewIfNeeded();
   await page.screenshot({path:`tmp/sectors-frontier-p4/${locale}-thesis.png`});
  } finally {await context.close();}
 });
}

test('P4 language and motion changes preserve native disclosure state',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/en/sectors.html');
 const details=page.locator('#issuer-micron details');await details.locator('summary').click();
 await page.evaluate(()=>{document.documentElement.dataset.afflatusLocale='inline';window.AfflatusI18N.set('zh');});
 await expect(details).toHaveAttribute('open','');
 await expect(details.locator('summary')).toHaveText('观察项、风险与证据');
 const before=await page.locator('#frontierIssuers').innerText();
 await page.emulateMedia({reducedMotion:'no-preference'});
 expect(await page.locator('#frontierIssuers').innerText()).toBe(before);
 expect(errors).toEqual([]);
});

test('P4 native disclosures accept touch',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
 try {
  const page=await context.newPage();await page.goto('http://127.0.0.1:4173/zh/sectors.html');
  const details=page.locator('#thesis-T01 details');await details.locator('summary').tap();
  await expect(details).toHaveAttribute('open','');
  await expect(details.locator('dd')).toContainText('配对生产测试');
 } finally {await context.close();}
});
