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
