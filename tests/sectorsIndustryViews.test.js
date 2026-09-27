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
