import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildForceGraphData,
  createForceSim,
  stepForceSim,
  settleForceSim,
  ecosystemBloc,
} from '../src/lib/forceGraph.js';

// The settings the view actually ships for the ecosystem storyboard; the layout
// assertions below are meaningless against different constants.
const ECOSYSTEM_SETTINGS = {
  repulsion: 0.05,
  springLength: 0.42,
  springStrength: 0.022,
  poleStrength: 0.1,
  damping: 0.86,
  minDist: 0.12,
};

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
  it('builds the ecosystem storyboard schema with stage anchors and typed relationships', () => {
    const data = {
      ecosystemGraph: {
        chapters: [{ id: 'all', edge_types: [] }, { id: 'capital', edge_types: ['investment'] }],
        nodes: [
          { id: 'lab', label: 'Lab', kind: 'model', stage: 'models', products: ['Model X'] },
          { id: 'cloud', label: 'Cloud', kind: 'cloud', stage: 'cloud', products: ['Compute Y'] },
        ],
        edges: [
          { id: 'cloud-lab', source: 'cloud', target: 'lab', type: 'investment', strength: 0.9 },
        ],
      },
    };
    const graph = buildForceGraphData(data, { seed: 5 });
    expect(graph.mode).toBe('ecosystem');
    expect(graph.chapters).toHaveLength(2);
    expect(graph.nodes.filter((node) => node.kind === 'anchor')).toHaveLength(2);
    expect(graph.nodes.find((node) => node.id === 'lab').products).toEqual(['Model X']);
    expect(graph.links.find((link) => link.id === 'cloud-lab')).toMatchObject({
      kind: 'ecosystem',
      type: 'investment',
      weight: 0.9,
    });
  });

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
  it('keeps ecosystem stage anchors pinned while related nodes settle around them', () => {
    const graph = buildForceGraphData({
      ecosystemGraph: {
        nodes: [
          { id: 'lab', label: 'Lab', kind: 'model', stage: 'models' },
          { id: 'cloud', label: 'Cloud', kind: 'cloud', stage: 'cloud' },
        ],
        edges: [{ source: 'cloud', target: 'lab', type: 'cloud', strength: 0.8 }],
      },
    });
    const state = createForceSim(graph);
    settleForceSim(state, 300);
    for (const anchor of state.nodes.filter((node) => node.kind === 'anchor')) {
      expect(anchor.x).toBe(anchor.fx);
      expect(anchor.y).toBe(anchor.fy);
    }
  });

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

/* Red vs Blue layout (urgent.md Part 3, RB-P0-03): the horizontal axis is
   geopolitical, so these tests assert the property the design depends on —
   separation of the two blocs with shared suppliers on the meridian — rather than
   exact coordinates, which are free to be retuned. */
describe('bloc polarity', () => {
  it('assigns only the two competing ecosystems a side', () => {
    expect(ecosystemBloc('US')).toBe('US');
    expect(ecosystemBloc('CN')).toBe('CN');
    for (const country of ['KR', 'TW', 'NL', undefined, '']) {
      expect(ecosystemBloc(country)).toBe('neutral');
    }
  });

  it('creates one anchor per populated stage-and-bloc cell', () => {
    const graph = buildForceGraphData({
      ecosystemGraph: {
        chapters: [],
        nodes: [
          { id: 'us-lab', label: 'US lab', country: 'US', stage: 'models' },
          { id: 'cn-lab', label: 'CN lab', country: 'CN', stage: 'models' },
          { id: 'us-lab-2', label: 'US lab 2', country: 'US', stage: 'models' },
          { id: 'fab', label: 'Fab', country: 'TW', stage: 'manufacturing' },
        ],
        edges: [],
      },
    });
    const anchors = graph.nodes.filter((node) => node.kind === 'anchor');
    // models:US, models:CN, manufacturing:neutral — the two US labs share a cell.
    expect(anchors).toHaveLength(3);
    expect(anchors.map((anchor) => anchor.id).sort()).toEqual([
      'anchor:manufacturing:neutral',
      'anchor:models:CN',
      'anchor:models:US',
    ]);
  });

  it('tags every ecosystem node with its bloc for the renderer', () => {
    const graph = buildForceGraphData({
      ecosystemGraph: {
        chapters: [],
        nodes: [{ id: 'a', country: 'US', stage: 'models' }, { id: 'b', country: 'KR', stage: 'memory' }],
        edges: [],
      },
    });
    expect(graph.nodes.find((node) => node.id === 'a').bloc).toBe('US');
    expect(graph.nodes.find((node) => node.id === 'b').bloc).toBe('neutral');
  });

  it('settles the US bloc left, the China bloc right and shared suppliers between them', () => {
    const ecosystem = JSON.parse(readFileSync('public/sectors-ecosystem.json', 'utf8'));
    const graph = buildForceGraphData({ ecosystemGraph: ecosystem });
    const sim = settleForceSim(createForceSim(graph, ECOSYSTEM_SETTINGS), 360);
    const placed = sim.nodes.filter((node) => node.kind !== 'anchor');
    const mean = (bloc) => {
      const xs = placed.filter((node) => node.bloc === bloc).map((node) => node.x);
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    };
    expect(mean('US')).toBeLessThan(-1);
    expect(mean('CN')).toBeGreaterThan(1);
    expect(Math.abs(mean('neutral'))).toBeLessThan(1);
    // No US node may end up on the Chinese side of the meridian, or the map lies.
    for (const node of placed.filter((item) => item.bloc === 'CN')) expect(node.x).toBeGreaterThan(0);
  });

  it('keeps node plates from overlapping at the shipped desktop fit', () => {
    const ecosystem = JSON.parse(readFileSync('public/sectors-ecosystem.json', 'utf8'));
    const graph = buildForceGraphData({ ecosystemGraph: ecosystem });
    const sim = settleForceSim(createForceSim(graph, ECOSYSTEM_SETTINGS), 360);
    const placed = sim.nodes.filter((node) => node.kind !== 'anchor');
    const xs = placed.map((node) => node.x);
    const ys = placed.map((node) => node.y);
    // Mirrors sectorsGraphView.size() for a 1180x620 stage with desktop padding.
    const scale = Math.max(34, Math.min(
      (1180 - 190) / (Math.max(...xs) - Math.min(...xs)),
      (620 - 230) / (Math.max(...ys) - Math.min(...ys)),
    ));
    let closest = Infinity;
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        closest = Math.min(closest, Math.hypot(placed[i].x - placed[j].x, placed[i].y - placed[j].y));
      }
    }
    // 68 CSS px was the pre-change baseline; the retuned settings must not regress it.
    expect(closest * scale).toBeGreaterThanOrEqual(68);
  });

  it('is deterministic across rebuilds so the map does not reshuffle', () => {
    const ecosystem = JSON.parse(readFileSync('public/sectors-ecosystem.json', 'utf8'));
    const run = () => settleForceSim(
      createForceSim(buildForceGraphData({ ecosystemGraph: ecosystem }), ECOSYSTEM_SETTINGS),
      360,
    ).nodes.filter((node) => node.kind !== 'anchor').map((node) => [node.id, node.x.toFixed(6), node.y.toFixed(6)]);
    expect(run()).toEqual(run());
  });
});
