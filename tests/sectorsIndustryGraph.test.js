// tests/sectorsIndustryGraph.test.js
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GRAPH_COLUMNS } from '../src/sectors/industry/industry-core.js';
import { STORIES, edgesOf, layoutIndustryGraph } from '../src/sectors/industry/graph-layout.js';

const data = JSON.parse(readFileSync('public/data/sectors-industry/2026-09-27.json', 'utf8'));
const opts = { width: 1120, height: 760 };

describe('layoutIndustryGraph', () => {
  it('places every company once, left-to-right by supply-chain column', () => {
    const { nodes } = layoutIndustryGraph(data, opts);
    expect(nodes).toHaveLength(data.companies.length);
    const xOf = (col) => nodes.find((n) => n.column === col)?.x;
    const xs = GRAPH_COLUMNS.map(xOf).filter((x) => x != null);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    for (const n of nodes) { expect(n.y).toBeGreaterThan(0); expect(n.y).toBeLessThan(760); }
  });
  it('filters by edge type', () => {
    const { edges } = layoutIndustryGraph(data, { ...opts, types: ['competitor'] });
    expect(edges.length).toBeGreaterThan(0);
    expect(edges.every((e) => e.stance === 'compete')).toBe(true);
  });
  it('draws cooperation and competition between the same pair as separate, offset paths', () => {
    const { edges } = layoutIndustryGraph(data, opts);
    const coop = edges.find((e) => e.id === 'spcx-ant-colossus');
    const rival = edges.find((e) => e.id === 'ant-spcx-rival');
    expect(coop.stance).toBe('cooperate');
    expect(rival.stance).toBe('compete');
    expect(coop.path).not.toBe(rival.path);
  });
  it('never stacks two edges of the same pair on one path', () => {
    const { edges } = layoutIndustryGraph(data, opts);
    const paths = ['spcx-ant-colossus', 'ant-spcx-pay', 'ant-spcx-rival'].map((id) => edges.find((e) => e.id === id).path);
    expect(new Set(paths).size).toBe(3);
  });
  it('keeps every edge of a story at full strength', () => {
    const story = STORIES.find((s) => s.id === 'ant-spacex');
    const { edges } = layoutIndustryGraph(data, { ...opts, focus: story.focus, edgeIds: story.edgeIds });
    expect(edges).toHaveLength(4);
    expect(edges.filter((e) => e.dim)).toEqual([]);
  });
  it('flags US–China edges as cross-border', () => {
    const { edges } = layoutIndustryGraph(data, opts);
    expect(edges.find((e) => e.id === 'ant-baba-rival').crossBorder).toBe(true);
    expect(edges.find((e) => e.id === 'tsm-nvda-foundry').crossBorder).toBe(false);
  });
  it('dims everything outside the focus neighbourhood', () => {
    const { nodes, edges } = layoutIndustryGraph(data, { ...opts, focus: 'anthropic' });
    expect(nodes.find((n) => n.id === 'googl').dim).toBe(false);
    expect(nodes.find((n) => n.id === 'vrt').dim).toBe(true);
    expect(edges.find((e) => e.id === 'tsm-nvda-foundry').dim).toBe(true);
  });
  it('skips unverified edges', () => {
    const copy = structuredClone(data);
    copy.edges[0].status = 'unverified';
    expect(layoutIndustryGraph(copy, opts).edges.some((e) => e.id === copy.edges[0].id)).toBe(false);
  });
});

describe('stories and ledger', () => {
  it('every story edge exists', () => {
    const ids = new Set(data.edges.map((e) => e.id));
    for (const s of STORIES) for (const id of s.edgeIds) expect(ids.has(id), `${s.id}:${id}`).toBe(true);
  });
  it('lists a company’s edges newest first', () => {
    const list = edgesOf(data, 'anthropic');
    expect(list.length).toBeGreaterThan(8);
    expect(list.map((e) => e.as_of)).toEqual([...list.map((e) => e.as_of)].sort().reverse());
  });
});
