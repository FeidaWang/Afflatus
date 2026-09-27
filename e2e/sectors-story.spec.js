// e2e/sectors-story.spec.js
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { rankMetric } from '../src/sectors/frontier/frontier-core.mjs';

const snapshot = JSON.parse(readFileSync('public/data/sectors-frontier/2026-09-27.json', 'utf8'));
const rankedCount = rankMetric(snapshot, 'intelligence').ranked.length;

test('relationship ledger works without the SVG on a 320px phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/zh/sectors.html#industryGraph');
  await expect(page.locator('#industryGraph svg.graph')).toBeHidden();
  await page.selectOption('#industryGraph select.graph-picker', 'anthropic');
  await expect(page.locator('#industryGraph .graph-ledger li').first()).toBeVisible();
  await page.click('#industryGraph [data-type="competitor"]');
  await expect(page.locator('#industryGraph .ledger-competitor')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('US–China edges fade from US blue to China red on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/en/sectors.html#industryGraph');
  await page.click('#industryGraph .gnode[data-id="anthropic"]');
  const edge = page.locator('#industryGraph path[data-id="ant-baba-rival"]');
  expect(await edge.evaluate((p) => getComputedStyle(p).stroke)).toMatch(/^url\(/);
  expect(await edge.evaluate((p) => getComputedStyle(p).strokeDasharray)).not.toBe('none');
});

for (const lang of ['en', 'zh']) {
  for (const width of [320, 390, 768, 1440]) {
    test(`${lang} @${width}: no horizontal scroll, chapters in order`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${lang}/sectors.html`);
      const ids = await page.$$eval('.stage, .chapter', (els) => els.map((e) => e.id));
      expect(ids.slice(0, 8)).toEqual(['sectorsStage', 'editorialIntro', 'frontierEditorial', 'usLeaders', 'usChina', 'industryGlobe', 'industryGraph', 'capital']);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
}

test('reduced motion shows static stage frames', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/en/sectors.html');
  await expect(page.locator('#sectorsStage')).toHaveAttribute('data-mode', 'static');
  await expect(page.locator('#sectorsStage .stage-card')).toHaveCount(6);
});

test('Anthropic × SpaceX story shows both cooperation and competition', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/en/sectors.html#industryGraph');
  await page.click('[data-story="ant-spacex"]');
  await expect(page.locator('#industryGraph .edge-coop:not(.is-dim)')).not.toHaveCount(0);
  await expect(page.locator('#industryGraph .edge-compete:not(.is-dim)')).not.toHaveCount(0);
  await expect(page.locator('#industryGraph .graph-ledger a[href^="https://"]').first()).toBeVisible();
});

test('projection labels are visible on the IPO chapter', async ({ page }) => {
  await page.goto('/zh/sectors.html#capital');
  await expect(page.locator('#capital [data-status="projection"] .status-tag').first()).toHaveText('预期');
});

test('no serious or critical axe violations', async ({ page }) => {
  await page.goto('/en/sectors.html');
  const r = await new AxeBuilder({ page }).include('main').analyze();
  expect(r.violations.filter((v) => ['serious', 'critical'].includes(v.impact))).toEqual([]);
});

test('logo failures fall back to monograms', async ({ page }) => {
  await page.route(/\/assets\/sectors\/logos\/.+\.(svg|png|webp)$/, (r) => r.abort());
  await page.goto('/en/sectors.html#industryGlobe');
  await expect(page.locator('#industryGlobe .layer-cards .logo-fallback').first()).toBeVisible();
});

test('keyboard reaches globe markers and graph nodes', async ({ page }) => {
  await page.goto('/en/sectors.html#industryGlobe');
  await page.locator('#industryGlobe .marker').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#industryGlobe .globe-list li').first()).toBeVisible();
});

// Assertions migrated from the retired sectors-{editorial,frontier,p2,p3,p4,reference-design} specs (Task 13).

test.describe('editorial', () => {
  const copy = JSON.parse(readFileSync('docs/Afflatus-Sectors-Frontier-V2/data/editorial-copy.json', 'utf8'));
  const heroTitle = { en: "Where does AI's value go?", zh: 'AI 的价值，流向哪里？' };

  for (const locale of ['en', 'zh']) {
    test(`${locale}: exact editorial copy and archive anchors without scripts`, async ({ browser }) => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:4173/${locale}/sectors.html`);
      await expect(page.locator('h1')).toHaveText(heroTitle[locale]);
      for (const chapter of copy.chapters) {
        // §2.3 item 3: the capability opener now lives only on the S2 stage card.
        const heading = chapter.id === 'capability' ? page.locator('.stage-card[data-scene="2"] h2') : page.locator(`#frontier-${chapter.id}-heading`);
        await expect(heading).toHaveText(chapter.title[locale]);
        await expect(heading.locator('xpath=following-sibling::p[1]')).toHaveText(chapter.body[locale]);
      }
      await expect(page.locator('.fc-static-fallback tbody tr')).toHaveCount(14);
      const contract = await page.evaluate(() => {
        const ids = [...document.querySelectorAll('[id]')].map(el => el.id);
        return {
          duplicates: ids.filter((id, i) => ids.indexOf(id) !== i),
          missing: [...document.querySelectorAll('main a[href^="#"]')].filter(a => !document.getElementById(a.hash.slice(1))).map(a => a.hash),
          graphInDisclosure: !!document.querySelector('#storyGraphSection').closest('details'),
        };
      });
      expect(contract).toEqual({ duplicates: [], missing: [], graphInDisclosure: false });
      await page.locator('#researchArchive>summary').click();
      await page.locator('.atlasArchive a[href="#k3Heading"]').click();
      await expect(page.locator('#k3Heading')).toBeInViewport();
      await expect(page.locator('#researchArchive>summary')).toContainText('2026');
      await context.close();
    });
  }

  test('desktop and mobile retain one live board, navigable story and graph', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const [locale, width, height] of [['en', 1440, 1000], ['zh', 390, 844]]) {
      await page.setViewportSize({ width, height });
      await page.goto(`/${locale}/sectors.html`);
      await expect(page.locator('.fc-controls')).toHaveCount(1);
      await expect(page.locator('#sectorsFrontier tr[data-row]')).toHaveCount(rankedCount);
      await expect(page.locator('#afflatus-header')).toHaveCount(1);
      // The reading-order nav is gone (§2.3 item 1); the stage and intro links lead into the story.
      await page.locator('.stage-jump').click();
      await expect(page.locator('#editorialIntroTitle')).toBeInViewport();
      await page.locator('.editorialCallout').click();
      await expect(page.locator('#frontierEditorialTitle')).toBeInViewport();
      for (const act of ['supply', 'migration', 'issuers', 'evidence']) {
        await page.goto(`/${locale}/sectors.html#${act}`);
        await expect(page.locator(`#frontier-${act}-heading`)).toBeInViewport();
      }
      await page.locator('#atlasStages button[data-stage="memory"]').click();
      await expect(page.locator('#atlasExplanation h2')).toHaveText(locale === 'zh' ? '内存与网络' : 'Memory & networks');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    expect(errors).toEqual([]);
  });
});

test.describe('frontier', () => {
  const dataPath = '**/data/sectors-frontier/2026-09-27.json';

  test('comparison filters, dossiers, evidence, language and persisted lifecycle', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/en/sectors.html');
    const host = page.locator('#sectorsFrontier');
    await expect(host.locator('.fc-meta')).toContainText('27 September 2026');
    await expect(host.locator('.fc-table-scroll tbody tr')).toHaveCount(rankedCount);
    await expect(host.locator('.fc-exclusions')).toContainText('MiniMax-M3');
    await expect(host.locator('.fc-exclusions')).toContainText('Source conflict; unranked');
    for (const { id } of snapshot.metrics) {
      await host.locator('[name=metric]').selectOption(id);
      await host.locator('[name=geography]').selectOption('CN');
      await host.locator('[name=openOnly]').check();
      const expected = rankMetric(snapshot, id, { geography: 'CN', openOnly: true });
      await expect(host.locator('tr[data-row]')).toHaveCount(expected.ranked.length);
      expect(await host.locator('tr[data-row]').evaluateAll(rows => rows.map(r => r.dataset.row)))
        .toEqual(expected.ranked.map(r => r.model.id));
    }
    await host.locator('[name=geography]').selectOption('all');
    await host.locator('[name=openOnly]').uncheck();
    const missingMetric = snapshot.metrics.find(m => rankMetric(snapshot, m.id).excluded.some(r => r.reason === 'not_retrieved'));
    await host.locator('[name=metric]').selectOption(missingMetric.id);
    await expect(host.locator('.fc-exclusions')).toContainText('Not retrieved');
    await host.locator('[name=metric]').selectOption('intelligence');
    // Phones hide the SVG plot and show tappable paired bars (.fc-mobile-point) for the same observations.
    const desktopPlot = await host.locator('.fc-desktop-plot').isVisible();
    const point = host.locator(desktopPlot ? '.fc-point' : '.fc-mobile-point').last();
    const modelId = await point.getAttribute('data-model');
    if (desktopPlot) await point.focus();
    else await point.click();
    await expect(host.locator('.fc-dossier h3')).toHaveText(snapshot.models.find(m => m.id === modelId).name);
    if (desktopPlot) await point.press('Enter');
    const row = host.locator('tr[data-row]').first();
    await row.locator('button').click();
    await expect(host.locator('.fc-dossier h3')).toHaveText(await row.locator('button').textContent());
    const sources = new Set(snapshot.sources.map(s => new URL(s.url).href));
    for (const url of await host.locator('a').evaluateAll(links => links.map(a => a.href))) {
      const parsed = new URL(url);
      if (parsed.origin === new URL(page.url()).origin && parsed.hash) {
        await expect(page.locator(parsed.hash)).toHaveCount(1);
      } else expect(sources.has(url)).toBe(true);
    }
    await host.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'tmp/sectors-frontier-p0/desktop.png' });
    await page.evaluate(() => {
      document.documentElement.dataset.afflatusLocale = 'inline';
      window.AfflatusI18N.set('zh');
    });
    await expect(host.locator('.fc-meta')).toContainText('采集于');
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
    await host.locator('[name=geography]').selectOption('CN');
    await expect(host.locator('.fc-origin').first()).toHaveText('CN');
    await expect(page.locator('#storyGraphSection')).toBeVisible();
    await expect(page.locator('#afflatus-header')).toHaveCount(1);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
    await expect(host.locator('.fc-static-fallback')).toBeVisible();
    await expect(host.locator('.fc-controls')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('mobile Chinese route stays within viewport with reduced motion', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/zh/sectors.html');
    const host = page.locator('#sectorsFrontier');
    await expect(host.locator('.fc-meta')).toContainText('采集于');
    await host.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await host.locator('[name=geography]').selectOption('CN');
    await host.locator('[name=openOnly]').check();
    await expect(host.locator('.fc-origin').first()).toHaveText('CN');
    await page.screenshot({ path: 'tmp/sectors-frontier-p0/mobile.png' });
  });

  test('billing uses entered tokens and empty filters recover without invented values', async ({ page }) => {
    await page.goto('/en/sectors.html');
    const host = page.locator('#sectorsFrontier');
    await expect(host.locator('tr[data-row]')).toHaveCount(rankedCount);
    const priced = snapshot.models.find(m => m.status === 'reported_snapshot' && m.prices.cache_read !== null);
    await host.locator(`tr[data-row="${priced.id}"] button`).click();
    await host.locator('[name=uncachedInput]').fill('1000000');
    await host.locator('[name=cacheRead]').fill('2000000');
    await host.locator('[name=output]').fill('3000000');
    await host.locator('[data-role=billing] button').click();
    const bill = priced.prices.input + 2 * priced.prices.cache_read + 3 * priced.prices.output;
    await expect.poll(async () => {
      const text = await host.locator('.fc-bill-result').textContent();
      return Number(text.match(/\$([\d,.]+) USD/)?.[1].replaceAll(',', ''));
    }).toBe(bill);

    const unknown = snapshot.models.find(m => m.status === 'reported_snapshot' && m.prices.cache_read === null);
    await host.locator(`tr[data-row="${unknown.id}"] button`).click();
    await expect(host.locator('.fc-bill-result')).toContainText('A required price is unavailable');

    const empty = snapshot.metrics.flatMap(metric => ['US', 'CN'].map(geography => ({ metric: metric.id, geography })))
      .find(({ metric, geography }) => rankMetric(snapshot, metric, { geography, openOnly: true }).ranked.length === 0);
    expect(empty).toBeTruthy();
    await host.locator('[name=metric]').selectOption(empty.metric);
    await host.locator('[name=geography]').selectOption(empty.geography);
    await host.locator('[name=openOnly]').check();
    await expect(host.locator('tr[data-row]')).toHaveCount(0);
    await expect(host.locator('.fc-table-scroll')).toContainText('No matching observations');
    await host.locator('[name=metric]').selectOption('intelligence');
    await host.locator('[name=geography]').selectOption('all');
    await host.locator('[name=openOnly]').uncheck();
    await expect(host.locator('tr[data-row]')).toHaveCount(rankedCount);
  });

  test('snapshot fetch failure preserves localized source table', async ({ page }) => {
    await page.route(dataPath, route => route.abort());
    await page.goto('/zh/sectors.html');
    const fallback = page.locator('#sectorsFrontier .fc-static-fallback');
    await expect(fallback.locator('h2')).toContainText('公开评测快照');
    await expect(fallback.locator('tbody tr')).toHaveCount(14);
    await expect(fallback).toContainText('待核对，未排名');
    await expect(fallback).toContainText('来源报告数值，未经本站复测');
    await expect(page.locator('#atlasStages button').first()).toBeVisible();
  });

  test('script failure retains meaningful bilingual build output', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    for (const [locale, heading] of [['en', 'Public evaluation snapshot'], ['zh', '公开评测快照']]) {
      await page.goto(`http://127.0.0.1:4173/${locale}/sectors.html`);
      const fallback = page.locator('#sectorsFrontier .fc-static-fallback');
      await expect(fallback.locator('h2')).toContainText(heading);
      await expect(fallback.locator('tbody tr')).toHaveCount(14);
      await expect(fallback).toContainText(locale === 'zh' ? '来源报告数值，未经本站复测' : 'source-reported, not rerun');
      await expect(fallback.locator('a').first()).toHaveAttribute('href', /^https:/);
    }
    await context.close();
  });

  test('late snapshot cannot mount after nonpersisted teardown', async ({ page }) => {
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    await page.route(dataPath, async route => {
      await pending;
      await route.fulfill({ json: snapshot });
    });
    await page.goto('/en/sectors.html');
    await expect(page.locator('#atlasStages button').first()).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
    release();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#sectorsFrontier .fc-static-fallback')).toBeVisible();
    await expect(page.locator('#sectorsFrontier .fc-controls')).toHaveCount(0);
  });
});

test.describe('p2', () => {
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
});

test.describe('p3', () => {
  for(const [locale,width] of [['en',1440],['zh',390]]) {
   test(`P3 constraints and evidence ${locale}`,async({page})=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.setViewportSize({width,height:width===390?844:1000});
    await page.goto(`/${locale}/sectors.html`);
    const host=page.locator('#sectorsFrontier');
    await expect(host.locator('tr[data-row]')).toHaveCount(rankedCount);
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
    await expect(host.locator('tr[data-row]')).toHaveCount(rankedCount);
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
   await page.route('**/data/sectors-frontier/2026-09-27.json',async route=>{
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
});

test.describe('p4', () => {
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
});

test.describe('reference-design', () => {
  const ranked = rankMetric(snapshot, 'intelligence').ranked;
  const costOf = (id) => snapshot.observations.find((o) => o.model_id === id && o.metric_id === 'cost_task').value;
  const evidence = 'docs/sectors-reference-design-2026-09-27';
  mkdirSync(evidence, { recursive: true });

  for (const locale of ['en', 'zh']) {
    test(`${locale}: production entry and four editorial measures render their actual observations`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`/${locale}/sectors.html#frontierEditorial`);
      await expect(page.locator('.frontierEditorialRow')).toHaveCount(10);
      for (const metric of ['intelligence', 'terminal', 'scicode', 'lcr']) {
        await page.locator(`[data-editorial-metric="${metric}"]`).click();
        await expect(page.locator(`[data-editorial-metric="${metric}"]`)).toHaveAttribute('aria-pressed', 'true');
        const expected = snapshot.models.map(model => ({
          model,
          observation: snapshot.observations.find(o => o.model_id === model.id && o.metric_id === metric && o.evidence_status === 'reported_snapshot' && Number.isFinite(o.value)),
        })).filter(row => row.observation).sort((a, b) => b.observation.value - a.observation.value).slice(0, 10);
        await expect(page.locator('.frontierEditorialRow')).toHaveCount(expected.length);
        expect(await page.locator('.editorialScore').allTextContents()).toEqual(expected.map(({ observation: o }) => `${o.value}${o.unit === 'percent' ? '%' : ''}`));
      }
      await page.locator('[data-editorial-metric="intelligence"]').click();
      await page.locator('#frontierEditorial').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${evidence}/${locale}-desktop-board.png` });
      await page.locator('#sourceWallOpen').click();
      await expect(page.locator('#sourceWall')).toBeVisible();
      await page.locator('#sourceWallSearch').fill('MiMo');
      await expect(page.locator('.sourceWallCard')).toHaveCount(1);
      // Search inputs consume Escape to clear their text; move focus first.
      await page.keyboard.press('Tab');
      await page.keyboard.press('Escape');
      await expect(page.locator('#sourceWall')).not.toBeVisible();
      expect(errors).toEqual([]);
    });

    test(`${locale}: mobile disclosure, paired values and all supported widths`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/${locale}/sectors.html#frontierEditorial`);
      // Use the observed model id from this dated fixture rather than a label selector.
      const second = page.locator('.frontierEditorialRow').nth(1);
      await second.click();
      await expect(second).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('.editorialInlineDetail:visible')).toHaveCount(1);
      await expect(page.locator('.editorialInlineDetail:visible h3')).toHaveText(ranked[1].model.name);
      await page.screenshot({ path: `${evidence}/${locale}-mobile-detail.png` });
      await second.click();
      await expect(page.locator('.editorialInlineDetail:visible')).toHaveCount(0);
      const mobile = page.locator('.fc-mobile-point');
      await expect(mobile).toHaveCount(rankedCount);
      await expect(page.locator('.fc-desktop-plot')).not.toBeVisible();
      await expect(mobile.first().locator('strong')).toHaveText([String(ranked[0].value), `$${costOf(ranked[0].model.id).toFixed(2)}`]);
      await mobile.nth(1).click();
      await expect(mobile.nth(1)).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.fc-dossier h3')).toHaveText(ranked[1].model.name);
      await page.locator('.fc-mobile-plot').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${evidence}/${locale}-mobile-pairs.png` });
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      await expect(page.locator('.fc-desktop-plot')).toBeVisible();
      await expect(page.locator('.fc-mobile-plot')).not.toBeVisible();
      await page.locator('.fc-plot-section').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${evidence}/${locale}-desktop-plot.png` });
      await page.locator('#storyGraphSection').scrollIntoViewIfNeeded();
      await expect(page.locator('.atlasInkDrawing')).toHaveCount(5);
      await page.screenshot({ path: `${evidence}/${locale}-desktop-atlas.png` });
      await page.locator('#researchArchive > summary').click();
      await expect(page.locator('#researchArchive')).toHaveAttribute('open', '');
      await page.locator('#rivalryCost').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${evidence}/${locale}-archive.png` });
      await page.setViewportSize({width:390,height:844});
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
});

// Task 15: the first column heading ("Power & cooling") started at x=-12 and right-hand tickers were cut at the frame.
test('relationship graph text stays inside its frame on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/en/sectors.html#industryGraph');
  await page.locator('#industryGraph .gnode').first().waitFor({ state: 'attached' });
  const cut = await page.locator('#industryGraph svg.graph').evaluate((svg) => {
    const box = svg.getBoundingClientRect();
    return [...svg.querySelectorAll('text')].filter((t) => { const r = t.getBoundingClientRect(); return r.width && (r.left < box.left - 0.5 || r.right > box.right + 0.5); }).map((t) => t.textContent);
  });
  expect(cut).toEqual([]);
});

// Final review: the company list sat under the globe (right column empty), and US/China land was not tinted.
test('company globe: list beside the globe on desktop, US and China land tinted', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/en/sectors.html#industryGlobe');
  await page.locator('#industryGlobe .marker').first().waitFor({ state: 'attached' });
  await expect(page.locator('#industryGlobe path.globe-land.is-us')).toHaveAttribute('d', /M/);
  await expect(page.locator('#industryGlobe path.globe-land.is-cn')).toHaveAttribute('d', /M/, { timeout: 8000 });
  const [globe, list] = await Promise.all(['svg.globe', '.globe-list'].map((s) => page.locator(`#industryGlobe ${s}`).boundingBox()));
  expect(list.x).toBeGreaterThanOrEqual(globe.x + globe.width);
  expect(list.y).toBeLessThan(globe.y + globe.height);
});

// Final review: a failed logo-manifest fetch used to blank the stage and chapters 02, 03 and 06.
test('chapters still render when the logo manifest fails', async ({ page }) => {
  await page.route('**/assets/sectors/logos/manifest.json', (r) => r.abort());
  await page.goto('/en/sectors.html');
  await expect(page.locator('#usLeaders .h2h-row').first()).toBeAttached();
  await expect(page.locator('#usChina .dim-row').first()).toBeAttached();
  await expect(page.locator('#capital .ipo-bar').first()).toBeAttached();
  await expect(page.locator('#industryGraph .gnode').first()).toBeAttached();
  await expect(page.locator('#industrySources .industry-source-list li').first()).toBeAttached();
});

// On phones the shared header used to render expanded (478px) until its script set data-enhanced, so
// the S0 heading first painted below the fold and a 13px legend became the LCP element (3.6 s → 5.7 s).
// shared-header.css now paints the collapsed header from the first frame when scripting is on, so the
// S0 card (heading above the fold, lede as the largest text) owns LCP.
test('the largest contentful paint comes from the S0 card, not the stage legend', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 823 });
  await page.addInitScript(() => {
    window.__lcp = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__lcp.push({ inS0: Boolean(e.element?.closest('.stage-card[data-scene="0"]')), t: e.startTime });
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });
  await page.goto('/en/sectors.html');
  await page.waitForTimeout(1500);
  const last = await page.evaluate(() => window.__lcp.at(-1));
  expect(last.inS0).toBe(true);
  const h1 = await page.locator('.stage-card[data-scene="0"] h1').boundingBox();
  expect(h1.y + h1.height).toBeLessThanOrEqual(823);
});
