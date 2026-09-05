import {test,expect} from '@playwright/test';
import {COPY} from '../src/data/content.js';

for(const locale of ['en','zh']) for(const width of [1440,390]){
 test(`${locale} ${width}: disclosed values, shared scales and stable allocation`,async({page})=>{
  await page.setViewportSize({width,height:1000});
  await page.goto(`/${locale}/portfolio.html?embed=1#fy2026Performance`);
  await expect(page.locator('.route-efficiency').first()).toHaveAttribute('data-chart-missing','false');
  expect(await page.locator('.route-efficiency [data-chart-value]').allTextContents()).toEqual(['+260.4%','+208.5%','+257.9%','+32.6%','+85.6%']);
  expect(await page.locator('.route-track [data-chart-value]').allTextContents()).toEqual(['17.5','3.0','11.2','246.0','5.6']);
  expect(await page.locator('#sv0').textContent()).toBe('41.4%');
  expect(await page.locator('#sv2').textContent()).toBe('−22%');
  const ratios=await page.locator('.velocity-vector').evaluateAll(rows=>rows.map(row=>({width:parseFloat(row.style.getPropertyValue('--chart-width')),max:row.querySelector('[data-axis-max]').textContent})));
  expect(ratios.map(row=>row.max)).toEqual(['5','5']);expect(ratios[0].width).toBeCloseTo(58.8);expect(ratios[1].width).toBeCloseTo(88);
  const geometry=await page.locator('.route-efficiency').evaluateAll(rows=>rows.map(row=>({width:parseFloat(row.style.getPropertyValue('--chart-width')),rail:row.querySelector('.efficiency-rail').getBoundingClientRect().width})));
  expect(geometry[0].width).toBeCloseTo(86.8);for(const row of geometry)expect(row.rail).toBeCloseTo(geometry[0].rail,0);
  await page.locator('#portfolioConvoy').scrollIntoViewIfNeeded();
  await expect(page.locator('.pick-card')).toHaveCount(10);
  await expect(page.locator('.pick-card .pick-rank').first()).toHaveText('18%');
  const values=await page.locator('.alloc-bar i').evaluateAll(bars=>bars.map(bar=>parseFloat(bar.style.width)));
  expect(values).toEqual(COPY[locale].picks.map(p=>p.pct));expect(values.reduce((a,b)=>a+b,0)).toBe(100);
  await page.evaluate(()=>{window.m10Changes=[];new MutationObserver(records=>window.m10Changes.push(...records.map(r=>r.target.textContent))).observe(document.querySelector('#pickGrid'),{characterData:true,subtree:true});});
  await page.mouse.wheel(0,800);await page.waitForTimeout(650);
  expect(await page.evaluate(()=>window.m10Changes)).toEqual([]);
  await expect(page.locator('.allocation-note')).toContainText('2026-08-07');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
 test(`${locale} ${width}: no JS final figures stay readable`,async({browser,baseURL})=>{
  const context=await browser.newContext({javaScriptEnabled:false,viewport:{width,height:1000}});const page=await context.newPage();
  await page.goto(`${baseURL}/${locale}/portfolio.html#flightPathsTitle`);
  await expect(page.locator('.route-efficiency').first()).toContainText('+260.4%');
  await expect(page.locator('.holdings-fallback li')).toHaveCount(10);
  await expect(page.locator('.route-track').first()).toContainText('17.5');await context.close();
 });
}
for(const locale of ['en','zh']) test(`${locale}: zero, negative, missing and long label`,async({page})=>{
 await page.setViewportSize({width:390,height:900});
 await page.route(`**/${locale}/portfolio.html*`,async route=>{
  const response=await route.fetch();let html=await response.text();
  html=html.replace('>+260.4%</strong>','>0%</strong>').replace('>+208.5%</strong>','>−208.5%</strong>').replace('>+257.9%</strong>','>—</strong>');
  html=html.replaceAll('Broadcom','Very long company name '.repeat(12)).replaceAll('博通','极长公司名称'.repeat(20));
  await route.fulfill({response,body:html});
 });
 await page.goto(`/${locale}/portfolio.html#flightPathsTitle`);
 const rows=page.locator('.route-efficiency');await expect(rows.nth(2)).toHaveAttribute('data-chart-missing','true');
 await expect(rows.nth(2)).toContainText(locale==='zh'?'无数据':'No data');
 expect(await rows.first().evaluate(el=>parseFloat(el.style.getPropertyValue('--chart-width')))).toBe(0);
 await expect(rows.nth(1)).toHaveAttribute('data-chart-negative','true');
 expect(await rows.nth(1).evaluate(el=>parseFloat(el.style.getPropertyValue('--chart-start')))).toBeLessThan(await rows.nth(1).evaluate(el=>parseFloat(el.style.getPropertyValue('--chart-zero'))));
 expect(await rows.nth(2).locator('.efficiency-rail').evaluate(el=>getComputedStyle(el,'::after').display)).toBe('none');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
