// tests/sectorsIndustryCore.test.js
import { describe, expect, it } from 'vitest';
import { validateIndustry, renderable } from '../src/sectors/industry/industry-core.js';

const ok = () => ({
  schema_version: 1, snapshot_id: 'industry-test', retrieved_on: '2026-09-27',
  sources: [{ id: 'S1', title: 't', url: 'https://example.com', publisher: 'p', published_at: null }],
  companies: [
    { id: 'nvda', ticker: 'NVDA', exchange: 'NASDAQ', listing: 'listed', name: { en: 'NVIDIA', zh: '英伟达' }, country: 'US',
      hq: { city: { en: 'Santa Clara', zh: '圣克拉拉' }, lat: 37.37, lon: -121.96 }, layer: 'compute', tier: 1,
      role: { en: 'GPUs', zh: 'GPU' }, official_domain: 'nvidia.com' },
    { id: 'anthropic', ticker: null, exchange: null, listing: 'pre_ipo', name: { en: 'Anthropic', zh: 'Anthropic' }, country: 'US',
      hq: { city: { en: 'San Francisco', zh: '旧金山' }, lat: 37.79, lon: -122.4 }, layer: 'labs', tier: 1,
      role: { en: 'Claude', zh: 'Claude' }, official_domain: 'anthropic.com' },
  ],
  edges: [{ id: 'e1', source: 'nvda', target: 'anthropic', type: 'investment', as_of: '2025-11-18', amount_usd_b: 10,
    label: { en: 'x', zh: 'x' }, status: 'official', source_ids: ['S1'] }],
  facts: { gap: [{ id: 'g1', status: 'independent', source_ids: ['S1'], label: { en: 'x', zh: 'x' }, value: 7 }] },
});

describe('validateIndustry', () => {
  it('accepts a well-formed dataset', () => expect(validateIndustry(ok())).toEqual([]));
  it.each([
    ['duplicate company id', (d) => d.companies.push({ ...d.companies[0] }), /duplicate/],
    ['bad tier', (d) => { d.companies[0].tier = 4; }, /tier/],
    ['listed without ticker', (d) => { d.companies[0].ticker = null; }, /ticker/],
    ['bad coordinates', (d) => { d.companies[0].hq.lat = 123; }, /coordinates/],
    ['missing zh name', (d) => { d.companies[0].name.zh = ''; }, /names/],
    ['unknown edge endpoint', (d) => { d.edges[0].target = 'nobody'; }, /endpoint/],
    ['self loop', (d) => { d.edges[0].target = 'nvda'; }, /self loop/],
    ['unknown edge type', (d) => { d.edges[0].type = 'friendship'; }, /type/],
    ['edge without sources', (d) => { d.edges[0].source_ids = []; }, /no source_ids/],
    ['edge cites unknown source', (d) => { d.edges[0].source_ids = ['NOPE']; }, /unknown source/],
    ['fact with bad status', (d) => { d.facts.gap[0].status = 'rumour'; }, /status/],
    ['source without https', (d) => { d.sources[0].url = 'http://x'; }, /https/],
  ])('rejects %s', (_, mutate, pattern) => {
    const d = ok(); mutate(d);
    expect(validateIndustry(d).join('\n')).toMatch(pattern);
  });
});

describe('renderable', () => {
  it('hides unverified items only', () => {
    expect(renderable({ status: 'unverified' })).toBe(false);
    expect(renderable({ status: 'projection' })).toBe(true);
  });
});
