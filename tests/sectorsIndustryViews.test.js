// tests/sectorsIndustryViews.test.js
// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { mountHeadToHead } from '../src/sectors/industry/head-to-head-view.js';
import { mountUsChina } from '../src/sectors/industry/rivalry-view.js';

const snapshot = JSON.parse(readFileSync('public/data/sectors-frontier/2026-09-27.json', 'utf8'));
const industry = JSON.parse(readFileSync('public/data/sectors-industry/2026-09-27.json', 'utf8'));
let host;
beforeEach(() => { document.body.innerHTML = '<section id="h"><div class="h2h-bars"></div><div class="h2h-cards"></div><div class="h2h-scale"></div><div class="h2h-rsi"></div></section><section id="u"><div class="gap"></div><div class="dims"></div><div class="flows"></div></section>'; });

describe('mountHeadToHead', () => {
  beforeEach(() => { host = document.getElementById('h'); mountHeadToHead(host, { snapshot, industry, lang: 'zh' }); });
  it('draws one paired row per metric', () => expect(host.querySelectorAll('.h2h-row')).toHaveLength(snapshot.metrics.length));
  it('writes "not published" instead of a zero bar for missing values', () => {
    const missing = [...host.querySelectorAll('.h2h-row[data-missing]')];
    for (const r of missing) expect(r.textContent).toContain('未公布');
  });
  it('labels lab-claimed RSI figures', () => expect(host.querySelector('.h2h-rsi [data-status="lab_claimed"]')).not.toBeNull());
});

describe('mountUsChina', () => {
  beforeEach(() => { host = document.getElementById('u'); mountUsChina(host, { snapshot, industry, lang: 'en' }); });
  it('names a leader on every diverging row', () => {
    const rows = [...host.querySelectorAll('.dim-row')];
    expect(rows.length).toBe(industry.facts.dims.filter((d) => d.status !== 'unverified').length + 3);
    for (const r of rows) expect(['US', 'CN', 'tie']).toContain(r.dataset.leader);
  });
  it('marks friction flows as dashed', () => expect(host.querySelectorAll('.flow[data-friction="true"]').length).toBeGreaterThan(0));
});

// Task 6 amendment: a dimension with one side unpublished names no leader and draws no bar.
describe('mountUsChina with a missing value', () => {
  it('writes "Not published" and draws no shares when one side is null', () => {
    const gapped = structuredClone(industry);
    gapped.facts.dims[0].cn = null;
    host = document.getElementById('u');
    mountUsChina(host, { snapshot, industry: gapped, lang: 'en' });
    const row = host.querySelector(`.dim-row[data-id="${gapped.facts.dims[0].id}"]`);
    expect(row.hasAttribute('data-missing')).toBe(true);
    expect(row.hasAttribute('data-leader')).toBe(false);
    expect(row.querySelector('.dim-bar')).toBeNull();
    expect(row.textContent).toContain('Not published');
  });
});

import { mountIpo } from '../src/sectors/industry/ipo-view.js';
describe('mountIpo', () => {
  it('hatches projections and sorts by amount raised', () => {
    document.body.innerHTML = '<section id="c"><div class="ipo-bars"></div><div class="ipo-ladder"></div></section>';
    const c = document.getElementById('c');
    mountIpo(c, { industry, lang: 'zh' });
    const bars = [...c.querySelectorAll('.ipo-bar')];
    expect(bars.map((b) => Number(b.dataset.raised))).toEqual([...bars.map((b) => Number(b.dataset.raised))].sort((a, b) => a - b));
    expect(c.querySelector('.ipo-bar[data-status="projection"] .status-tag').textContent).toBe('预期');
  });

  // Task 11 carry-over: a missing amount is "Not published", never a zero-length bar or a sort key.
  it('writes "Not published" for a missing amount and keeps it out of the ranking and the scale', () => {
    document.body.innerHTML = '<section id="c"><div class="ipo-bars"></div><div class="ipo-ladder"></div></section>';
    const c = document.getElementById('c');
    const gapped = structuredClone(industry);
    gapped.facts.ipo[1].raised_usd_b = null;
    gapped.facts.valuation[0].usd_b = null;
    mountIpo(c, { industry: gapped, lang: 'en' });
    const missingBar = c.querySelector(`.ipo-bar[data-id="${gapped.facts.ipo[1].id}"]`);
    expect(missingBar.hasAttribute('data-missing')).toBe(true);
    expect(missingBar.hasAttribute('data-raised')).toBe(false);
    expect(missingBar.querySelector('i')).toBeNull();
    expect(missingBar.textContent).toContain('Not published');
    const ranked = [...c.querySelectorAll('.ipo-bar[data-raised]')].map((b) => Number(b.dataset.raised));
    expect(ranked).toEqual([...ranked].sort((a, b) => a - b));
    for (const w of [...c.querySelectorAll('.ipo-bar i')].map((i) => i.style.getPropertyValue('--w'))) expect(w).not.toMatch(/NaN|Infinity/);
    const missingStep = c.querySelector(`.ladder-lane li[data-id="${gapped.facts.valuation[0].id}"]`);
    expect(missingStep.hasAttribute('data-missing')).toBe(true);
    expect(missingStep.querySelector('i')).toBeNull();
    expect(missingStep.textContent).toContain('Not published');
  });
});

// Final-review fixes (Task 15): relationship graph view.
import { mountIndustryGraph } from '../src/sectors/industry/graph-view.js';
const manifest = JSON.parse(readFileSync('public/assets/sectors/logos/manifest.json', 'utf8'));
const graphHost = () => {
  document.body.innerHTML = '<section id="g"><div class="graph-stories"></div><div class="graph-filters"></div><select class="graph-picker"></select><svg class="graph" viewBox="-40 0 1200 760"></svg><aside class="graph-ledger"></aside></section>';
  return document.getElementById('g');
};
describe('mountIndustryGraph', () => {
  it('ignores a click on a relationship line (no throw, selection unchanged)', () => {
    const g = graphHost();
    mountIndustryGraph(g, { industry, manifest, lang: 'en' });
    g.querySelector('.gnode[data-id="anthropic"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const before = g.querySelector('.graph-ledger').innerHTML;
    const edge = g.querySelector('path.edge[data-id]');
    expect(() => edge.dispatchEvent(new MouseEvent('click', { bubbles: true }))).not.toThrow();
    expect(g.querySelector('.gnode.is-focus').dataset.id).toBe('anthropic');
    expect(g.querySelector('.graph-ledger').innerHTML).toBe(before);
  });
  it('draws the paper-ready web logo, and an ink chip under a dark-background original', () => {
    const g = graphHost();
    mountIndustryGraph(g, { industry, manifest, lang: 'en' });
    expect(g.querySelector('.gnode[data-id="mu"] image').getAttribute('href')).toBe(manifest.mu.web_file);
    const raw = structuredClone(manifest); delete raw.mu.web_file;
    const g2 = graphHost();
    mountIndustryGraph(g2, { industry, manifest: raw, lang: 'en' });
    expect(g2.querySelector('.gnode[data-id="mu"] image').getAttribute('href')).toBe(manifest.mu.file);
    expect(g2.querySelector('.gnode[data-id="mu"] .logo-chip-bg')).not.toBeNull();
  });
  it('keeps keyboard focus on the node after Enter', () => {
    const g = graphHost();
    mountIndustryGraph(g, { industry, manifest, lang: 'en' });
    const node = g.querySelector('.gnode[data-id="nvda"]');
    node.focus();
    node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(document.activeElement?.dataset?.id).toBe('nvda');
    expect(g.querySelector('.gnode.is-focus').dataset.id).toBe('nvda');
  });
});

// Final review (spec §3.4/§4.1): reduced motion gets each scene's final frame as a static SVG.
import { mountStage } from '../src/sectors/stage/stage.js';
import { SCENES } from '../src/sectors/stage/layouts.js';
describe('mountStage with reduced motion', () => {
  it('draws one static frame per scene, with dots, inside each card', () => {
    const mm = window.matchMedia;
    window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
    document.body.innerHTML = `<section class="stage" id="s"><div class="stage-sticky"><canvas></canvas></div><div class="stage-cards">${
      SCENES.map((_, i) => `<article class="stage-card" data-scene="${i}"><h2>Scene ${i}</h2></article>`).join('')}</div></section>`;
    const host = document.getElementById('s');
    const destroy = mountStage(host, { snapshot, industry });
    window.matchMedia = mm;
    expect(host.dataset.mode).toBe('static');
    const frames = [...host.querySelectorAll('.stage-card > svg.stage-frame')];
    expect(frames).toHaveLength(SCENES.length);
    for (const f of frames) {
      expect(f.getAttribute('aria-hidden')).toBe('true');
      expect(f.querySelectorAll('circle.dot').length).toBeGreaterThan(0);
    }
    destroy();
  });
});

// Final review (spec §8.6 #10): the gap sentence's verdict comes from the computed sign.
describe('mountUsChina gap sentence', () => {
  const host0 = () => { document.body.innerHTML = '<section id="u"><div class="gap"></div><div class="dims"></div><div class="flows"></div></section>'; return document.getElementById('u'); };
  it('says the US trails when China has the top configuration', () => {
    const s = structuredClone(snapshot);
    const cn = s.models.find((m) => m.lab_geography === 'CN');
    s.observations.find((o) => o.model_id === cn.id && o.metric_id === 'intelligence').value = 99;
    const h = host0(); mountUsChina(h, { snapshot: s, industry, lang: 'en' });
    const lede = h.querySelector('.gap-lede').textContent;
    expect(lede).toMatch(/trails/); expect(lede).not.toMatch(/leads|-\d/);
  });
  it('does not throw and makes no comparison when one side has no scored model', () => {
    const s = structuredClone(snapshot);
    s.observations = s.observations.filter((o) => !(o.metric_id === 'intelligence' && s.models.find((m) => m.id === o.model_id)?.lab_geography === 'CN'));
    const h = host0();
    expect(() => mountUsChina(h, { snapshot: s, industry, lang: 'zh' })).not.toThrow();
    expect(h.querySelector('.gap-lede').textContent).not.toMatch(/(领先|落后)中国最佳/);
  });
});

// Final review (spec §8.1, §8.3 appendix): facts in chapters 03 and 06 link their sources; the appendix lists them all.
import { renderable } from '../src/sectors/industry/industry-core.js';
import { mountIndustrySources } from '../src/sectors/industry/sources-view.js';
const srcUrls = new Set(industry.sources.map((s) => s.url));
const factLinksOk = (root) => {
  const links = [...root.querySelectorAll('a.fact-src')];
  for (const a of links) { expect(srcUrls.has(a.getAttribute('href'))).toBe(true); expect(a.getAttribute('rel')).toBe('noopener noreferrer'); }
  return links;
};
describe('fact sources', () => {
  it('chapter 03 links a source for every gap, dimension, share and flow fact', () => {
    document.body.innerHTML = '<section id="u"><div class="gap"></div><div class="dims"></div><div class="flows"></div></section>';
    const u = document.getElementById('u'); mountUsChina(u, { snapshot, industry, lang: 'en' });
    const facts = ['gap', 'dims', 'shares', 'flows'].flatMap((k) => industry.facts[k].filter(renderable));
    const cited = new Set(factLinksOk(u).map((a) => a.dataset.fact));
    for (const f of facts) expect(cited.has(f.id)).toBe(true);
  });
  it('chapter 06 links a source for every IPO and valuation fact', () => {
    document.body.innerHTML = '<section id="c"><div class="ipo-bars"></div><div class="ipo-ladder"></div></section>';
    const c = document.getElementById('c'); mountIpo(c, { industry, lang: 'zh' });
    const cited = new Set(factLinksOk(c).map((a) => a.dataset.fact));
    for (const f of [...industry.facts.ipo, ...industry.facts.valuation].filter(renderable)) expect(cited.has(f.id)).toBe(true);
  });
  it('appendix lists every company-and-relationship source and every logo source', () => {
    document.body.innerHTML = '<details id="industrySources"><summary>s</summary><div class="industry-source-list"></div><div class="logo-source-list"></div></details>';
    const d = document.getElementById('industrySources'); mountIndustrySources(d, { industry, manifest, lang: 'en' });
    expect(d.querySelectorAll('.industry-source-list li')).toHaveLength(industry.sources.length);
    expect(d.querySelectorAll('.logo-source-list tbody tr')).toHaveLength(Object.keys(manifest).length);
    for (const a of d.querySelectorAll('a')) { expect(a.getAttribute('href')).toMatch(/^https:\/\//); expect(a.getAttribute('rel')).toBe('noopener noreferrer'); }
  });
});
