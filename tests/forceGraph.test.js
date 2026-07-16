import { describe, it, expect } from 'vitest';
import { buildForceGraphData, createForceSim, stepForceSim, settleForceSim } from '../src/lib/forceGraph.js';

function fixtureData() {
  return {
    modelWatch: [
      { vendor: 'anthropic', route: 'closed' },
      { vendor: 'openai', route: 'closed' },
      { vendor: 'zhipu', route: 'open' },
      { vendor: 'alibaba', route: 'closed' },
    ],
    baskets: [
      { vendor: 'anthropic', market: 'US', equities: [
        { ticker: 'MU', relation: 'supplier', confidence: 0.8 },
        { ticker: 'AVGO', relation: 'supplier', confidence: 0.7 },
      ] },
      { vendor: 'openai', market: 'US', equities: [
        { ticker: 'MSFT', relation: 'infra', confidence: 0.8 },
        { ticker: 'AVGO', relation: 'supplier', confidence: 0.8 },
      ] },
      { vendor: 'zhipu', market: 'CN', equities: [
        { ticker: '0700.HK', relation: 'infra', confidence: 0.55 },
        { ticker: '002230.SZ', relation: 'competitor', confidence: 0.5 },
      ] },
      { vendor: 'alibaba', market: 'CN', equities: [
        { ticker: '9988.HK', relation: 'direct', confidence: 0.85 },
      ] },
    ],
  };
}

describe('buildForceGraphData', () => {
  it('creates 2 pole nodes + 1 node per vendor + 1 node per unique ticker', () => {
    const { nodes } = buildForceGraphData(fixtureData());
    // poles: US, CN (2); vendors: anthropic/openai/zhipu/alibaba (4);
    // unique tickers: MU, AVGO, MSFT, 0700.HK, 002230.SZ, 9988.HK (6, AVGO deduped)
    expect(nodes.filter((n) => n.kind === 'pole')).toHaveLength(2);
    expect(nodes.filter((n) => n.kind === 'vendor')).toHaveLength(4);
    expect(nodes.filter((n) => n.kind === 'equity')).toHaveLength(6);
  });

  it('dedupes a ticker referenced by two vendors into one node with two links', () => {
    const { nodes, links } = buildForceGraphData(fixtureData());
    const avgo = nodes.filter((n) => n.id === 'equity:AVGO');
    expect(avgo).toHaveLength(1);
    expect(avgo[0].refs).toBe(2);
    const avgoLinks = links.filter((l) => l.source === 'equity:AVGO');
    expect(avgoLinks).toHaveLength(2);
    expect(avgoLinks.map((l) => l.target).sort()).toEqual(['vendor:anthropic', 'vendor:openai']);
  });

  it('marks competitor relations as pressure links and everything else as affinity', () => {
    const { links } = buildForceGraphData(fixtureData());
    const competitor = links.find((l) => l.source === 'equity:002230.SZ');
    expect(competitor.kind).toBe('pressure');
    const direct = links.find((l) => l.source === 'equity:9988.HK');
    expect(direct.kind).toBe('affinity');
  });

  it('links every vendor to its market pole', () => {
    const { links } = buildForceGraphData(fixtureData());
    const poleLinks = links.filter((l) => l.kind === 'pole');
    expect(poleLinks).toHaveLength(4);
    expect(poleLinks.find((l) => l.target === 'vendor:anthropic').source).toBe('pole:US');
    expect(poleLinks.find((l) => l.target === 'vendor:zhipu').source).toBe('pole:CN');
  });

  it('degrades to just the two poles, no throw, on the pre-first-run empty seed state', () => {
    const { nodes, links } = buildForceGraphData({});
    expect(nodes).toHaveLength(2);
    expect(nodes.every((n) => n.kind === 'pole')).toBe(true);
    expect(links).toEqual([]);
  });

  it('is deterministic for a given seed (same input+seed -> byte-identical initial layout)', () => {
    const a = buildForceGraphData(fixtureData(), { seed: 7 });
    const b = buildForceGraphData(fixtureData(), { seed: 7 });
    expect(a.nodes.map((n) => [n.x, n.y])).toEqual(b.nodes.map((n) => [n.x, n.y]));
  });
});

describe('stepForceSim / settleForceSim', () => {
  it('never produces NaN/Infinity after many iterations', () => {
    const state = createForceSim(buildForceGraphData(fixtureData(), { seed: 3 }));
    settleForceSim(state, 400);
    for (const n of state.nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    }
  });

  it('pins the two pole nodes exactly at their fx/fy regardless of steps run', () => {
    const state = createForceSim(buildForceGraphData(fixtureData()));
    settleForceSim(state, 400);
    const us = state.nodes.find((n) => n.id === 'pole:US');
    const cn = state.nodes.find((n) => n.id === 'pole:CN');
    expect(us.x).toBe(-1); expect(us.y).toBe(0);
    expect(cn.x).toBe(1); expect(cn.y).toBe(0);
  });

  it('separates the two market factions along x (US nodes end up left of CN nodes)', () => {
    const state = createForceSim(buildForceGraphData(fixtureData(), { seed: 5 }));
    settleForceSim(state, 500);
    const usX = state.nodes.filter((n) => n.market === 'US').map((n) => n.x);
    const cnX = state.nodes.filter((n) => n.market === 'CN').map((n) => n.x);
    const avg = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
    expect(avg(usX)).toBeLessThan(avg(cnX));
  });

  it('pushes a competitor-linked node farther from its vendor than a same-distance-seeded direct link', () => {
    // isolated fixture: one vendor, one direct equity, one competitor equity, same market
    const data = {
      nodes: [
        { id: 'v', kind: 'vendor', market: 'US', r: 10, x: 0, y: 0, vx: 0, vy: 0 },
        { id: 'direct', kind: 'equity', market: 'US', r: 6, x: 0.5, y: 0, vx: 0, vy: 0 },
        { id: 'rival', kind: 'equity', market: 'US', r: 6, x: -0.5, y: 0, vx: 0, vy: 0 },
      ],
      links: [
        { source: 'direct', target: 'v', kind: 'affinity', weight: 1 },
        { source: 'rival', target: 'v', kind: 'pressure', weight: 1 },
      ],
    };
    const state = createForceSim(data);
    settleForceSim(state, 300);
    const v = state.nodes.find((n) => n.id === 'v');
    const direct = state.nodes.find((n) => n.id === 'direct');
    const rival = state.nodes.find((n) => n.id === 'rival');
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    expect(dist(rival, v)).toBeGreaterThan(dist(direct, v));
  });

  it('keeps a minimum separation between any two settled nodes (repulsion prevents collapse)', () => {
    const state = createForceSim(buildForceGraphData(fixtureData(), { seed: 11 }));
    settleForceSim(state, 500);
    let minDist = Infinity;
    for (let i = 0; i < state.nodes.length; i++) {
      for (let j = i + 1; j < state.nodes.length; j++) {
        const d = Math.hypot(state.nodes[i].x - state.nodes[j].x, state.nodes[i].y - state.nodes[j].y);
        if (d < minDist) minDist = d;
      }
    }
    expect(minDist).toBeGreaterThan(0.05);
  });

  it('is a no-op-safe on an empty graph', () => {
    const state = createForceSim({ nodes: [], links: [] });
    expect(() => settleForceSim(state, 10)).not.toThrow();
    expect(state.nodes).toEqual([]);
  });
});
