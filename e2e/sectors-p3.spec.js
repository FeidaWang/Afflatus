import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

for(const [locale,width] of [['en',1440],['zh',390]]) {
 test(`P3 constraints and evidence ${locale}`,async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width,height:width===390?844:1000});
  await page.goto(`/${locale}/sectors.html`);
  const host=page.locator('#sectorsFrontier');
  await expect(host.locator('tr[data-row]')).toHaveCount(13);
  const explanation=host.locator('[data-lens-explanation]');
  const first=await explanation.innerText();
  await host.locator('[data-lens=routing]').focus();await page.keyboard.press('Enter');
  await expect(explanation).not.toHaveText(first);
  await host.locator('[data-lens=supply]').click();
  await expect(host.locator('[data-lens=supply]')).toHaveAttribute('aria-pressed','true');
  await host.locator('[name=metric]').selectOption('omniscience');
  await expect(host.locator('.fc-distributions')).toContainText('-100');
  await host.locator('[name=metric]').selectOption('intelligence');
  for(const [name,value] of [['minScore','40'],['maxCost','2'],['context','200000']]) {
   await host.locator(`[name=${name}]`).fill(value);await host.locator(`[name=${name}]`).press('Tab');
  }
  await host.locator('[name=openOnly]').check();
  const matches=await host.locator('tr[data-row]').count();expect(matches).toBeGreaterThan(0);expect(matches).toBeLessThan(13);
  await expect(host.locator('.fc-plot-summary')).toContainText('Pareto:');
  await host.locator('[name=minScore]').fill('9999');await page.keyboard.press('Tab');
  await expect(host.locator('tr[data-row]')).toHaveCount(0);
  await expect(host.locator('.fc-point')).toHaveCount(0);
  await expect(host.locator('.fc-dossier h3')).toHaveCount(1);
  await expect(host.locator('.fc-bill-result')).not.toContainText('USD');
  await mkdir('tmp/sectors-frontier-p3',{recursive:true});
  await host.locator('.fc-distributions').scrollIntoViewIfNeeded();
  await page.screenshot({path:`tmp/sectors-frontier-p3/${locale}-empty.png`});
  await host.locator('[name=minScore]').fill('');await page.keyboard.press('Tab');
  await host.locator('[name=maxCost]').fill('');await page.keyboard.press('Tab');
  await host.locator('[name=context]').fill('0');await page.keyboard.press('Tab');
  await host.locator('[name=openOnly]').uncheck();
  await expect(host.locator('tr[data-row]')).toHaveCount(13);
  await host.locator('[name=metric]').selectOption('cost_task');
  await expect(host.locator('[name=minScore]')).toBeDisabled();
  await host.locator('[name=metric]').selectOption('intelligence');
  await expect(host.locator('[name=minScore]')).toBeEnabled();
  await host.locator('.fc-lenses').scrollIntoViewIfNeeded();
  await page.screenshot({path:`tmp/sectors-frontier-p3/${locale}-controls.png`});
  await host.locator('.fc-distributions').scrollIntoViewIfNeeded();
  await page.screenshot({path:`tmp/sectors-frontier-p3/${locale}-distribution.png`});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
 });
}

test('P3 missing metadata and cost cannot satisfy a constraint',async({page})=>{
 await page.route('**/data/sectors-frontier/2026-09-23.json',async route=>{
  const response=await route.fetch();const data=await response.json();
  data.models.forEach(model=>model.context_tokens=null);
  await route.fulfill({response,json:data});
 });
 await page.goto('/en/sectors.html');
 const host=page.locator('#sectorsFrontier');
 await host.locator('[name=context]').fill('1');await page.keyboard.press('Tab');
 await expect(host.locator('tr[data-row]')).toHaveCount(0);
 await host.locator('.fc-exclusions summary').click();
 await expect(host.locator('.fc-exclusions')).toContainText('Context capacity not retrieved');
});

test('P3 information is identical with motion enabled; language preserves requirements',async({page})=>{
 await page.goto('/en/sectors.html');
 const host=page.locator('#sectorsFrontier');
 await host.locator('[name=minScore]').fill('44');await page.keyboard.press('Tab');
 await host.locator('[data-lens=routing]').click();
 const before=await host.innerText();
 await page.emulateMedia({reducedMotion:'no-preference'});
 expect(await host.innerText()).toBe(before);
 await page.evaluate(()=>{document.documentElement.dataset.afflatusLocale='inline';window.AfflatusI18N.set('zh');});
 await expect(host.locator('[name=minScore]')).toHaveValue('44');
 await expect(host.locator('[data-lens=routing]')).toHaveAttribute('aria-pressed','true');
 await expect(host.locator('.fc-evidence-gaps')).toContainText('只有一期');
 await expect(host.locator('.fc-evidence-gaps')).toContainText('缺少逐次尝试结果');
 await host.locator('.fc-evidence-gaps').scrollIntoViewIfNeeded();
 await page.screenshot({path:'tmp/sectors-frontier-p3/zh-evidence-gaps.png'});
});

test('P3 native controls accept touch',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});
 const page=await context.newPage();
 try {
  await page.goto('http://127.0.0.1:4173/zh/sectors.html');
  const host=page.locator('#sectorsFrontier');
  await host.locator('[data-lens=routing]').tap();
  await expect(host.locator('[data-lens=routing]')).toHaveAttribute('aria-pressed','true');
  await host.locator('[name=openOnly]').tap();
  await expect(host.locator('[name=openOnly]')).toBeChecked();
  await host.locator('[name=maxCost]').fill('0');
  await host.locator('.fc-lenses h3').tap();
  await expect(host.locator('tr[data-row]')).toHaveCount(0);
 } finally {await context.close();}
});
