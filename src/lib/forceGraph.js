/* ============================================================
   FORCE GRAPH — generic 2D force-directed layout engine, pure functions only
   (U30 R3, sectors.html "US–CN AI watch" section). Same self-contained
   integrator pattern as flightPath/cameraMath elsewhere in this codebase:
   no D3/Pixi/Three dependency (U30 30a technical ruling) — a fixed-timestep
   Euler integrator over three forces (pairwise repulsion, Hookean spring
   links, weak pole attraction) is more than enough for the <30-node graphs
   this page ever produces, and keeps the whole thing vitest-testable
   without a DOM or canvas.

   Coordinate space is abstract/normalized (roughly [-1.6, 1.6] on either
   axis once settled) — the rendering layer (sectorsGraphView.js) owns the
   canvas-pixel + pan/zoom mapping, this module never touches a DOM API.
   ============================================================ */

const MARKET_ANCHOR = { US: -1, CN: 1 };
const RELATION_FORCE = { direct: 1, supplier: 0.7, infra: 0.5, competitor: -0.6 };

/** Deterministic PRNG (mulberry32) — same algorithm used by src/bootengine/seed.ts,
 *  reimplemented locally so this stays a dependency-free plain-JS module. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Turns sectors-data.json's modelWatch/baskets arrays into graph nodes+links.
 * Pure data shaping, no simulation state (x/y here are just seeded initial
 * placement — the sim is free to move everything except the two pole nodes).
 *
 * @param {{modelWatch?: any[], baskets?: any[]}} sectorsData
 * @param {{seed?: number}} [opts]
 * @returns {{nodes: object[], links: object[]}}
 */
export function buildForceGraphData(sectorsData, opts = {}) {
  const rand = mulberry32(opts.seed ?? 1);
  const modelWatch = Array.isArray(sectorsData?.modelWatch) ? sectorsData.modelWatch : [];
  const baskets = Array.isArray(sectorsData?.baskets) ? sectorsData.baskets : [];
  const nodes = [];
  const links = [];
  const known = new Set();

  for (const market of ['US', 'CN']) {
    const ax = MARKET_ANCHOR[market];
    nodes.push({ id: 'pole:' + market, kind: 'pole', label: market, market, r: 4, fx: ax, fy: 0, x: ax, y: 0, vx: 0, vy: 0 });
    known.add('pole:' + market);
  }

  for (const card of modelWatch) {
    const basket = baskets.find((b) => b.vendor === card.vendor);
    const market = basket ? basket.market : (card.vendor === 'anthropic' || card.vendor === 'openai' ? 'US' : 'CN');
    const id = 'vendor:' + card.vendor;
    const ax = MARKET_ANCHOR[market] ?? 0;
    nodes.push({
      id, kind: 'vendor', label: card.vendor, vendor: card.vendor, route: card.route, market, r: 10,
      x: ax * 0.55 + (rand() - 0.5) * 0.3, y: (rand() - 0.5) * 0.6, vx: 0, vy: 0,
    });
    known.add(id);
    links.push({ source: 'pole:' + market, target: id, kind: 'pole', weight: 1 });
  }

  // Dedupe equities by ticker — an equity referenced from two baskets (e.g. AVGO
  // under both anthropic and openai) becomes ONE node with two affinity links,
  // which is exactly the "shared supplier" story the graph should surface.
  const byTicker = new Map();
  for (const basket of baskets) {
    const vendorId = 'vendor:' + basket.vendor;
    if (!known.has(vendorId)) continue; // basket references a vendor not in modelWatch this week
    for (const eq of basket.equities || []) {
      if (!eq || !eq.ticker) continue;
      let entry = byTicker.get(eq.ticker);
      if (!entry) { entry = { ticker: eq.ticker, market: basket.market, refs: [] }; byTicker.set(eq.ticker, entry); }
      entry.refs.push({ vendorId, relation: eq.relation, confidence: typeof eq.confidence === 'number' ? eq.confidence : 0.5 });
    }
  }
  for (const entry of byTicker.values()) {
    const id = 'equity:' + entry.ticker;
    const ax = MARKET_ANCHOR[entry.market] ?? 0;
    nodes.push({
      id, kind: 'equity', label: entry.ticker, market: entry.market, r: 6, refs: entry.refs.length,
      x: ax * 0.85 + (rand() - 0.5) * 0.7, y: (rand() - 0.5) * 1.3, vx: 0, vy: 0,
    });
    for (const ref of entry.refs) {
      const rel = RELATION_FORCE[ref.relation] ?? 0.5;
      links.push({
        source: id, target: ref.vendorId, relation: ref.relation,
        kind: rel < 0 ? 'pressure' : 'affinity', weight: Math.abs(rel) * (0.5 + 0.5 * ref.confidence),
      });
    }
  }

  return { nodes, links };
}

/**
 * @param {{nodes: object[], links: object[]}} graphData
 * @param {object} [opts]
 * @returns simulation state — plain object, JSON-cloneable except for the
 *   resolved link indices (`a`/`b`), safe to mutate step-by-step.
 */
export function createForceSim(graphData, opts = {}) {
  const nodes = (graphData.nodes || []).map((n) => ({ ...n }));
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  const links = (graphData.links || [])
    .map((l) => ({ ...l, a: idx.get(l.source), b: idx.get(l.target) }))
    .filter((l) => l.a != null && l.b != null);
  return {
    nodes,
    links,
    opts: {
      repulsion: opts.repulsion ?? 0.045,
      springLength: opts.springLength ?? 0.42,
      springStrength: opts.springStrength ?? 0.03,
      poleStrength: opts.poleStrength ?? 0.01,
      poleRestLength: opts.poleRestLength ?? (opts.springLength ?? 0.42) * 1.4,
      damping: opts.damping ?? 0.82,
      minDist: opts.minDist ?? 0.06,
    },
  };
}

/**
 * Advances the simulation by one fixed step. Mutates and returns `state` (the
 * caller — either a rAF loop or a test — owns how many times/how fast this
 * gets called). Nodes with `fx`/`fy` set (the two market poles) are pinned:
 * forces are computed for bookkeeping symmetry but never move them.
 */
export function stepForceSim(state, dt = 1) {
  const { nodes, links, opts } = state;
  const n = nodes.length;
  const fx = new Array(n).fill(0), fy = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx0 = nodes[j].x - nodes[i].x, dy0 = nodes[j].y - nodes[i].y;
      const d2 = Math.max(dx0 * dx0 + dy0 * dy0, opts.minDist * opts.minDist);
      const d = Math.sqrt(d2);
      const f = opts.repulsion / d2;
      const ux = dx0 / d, uy = dy0 / d;
      fx[i] -= ux * f; fy[i] -= uy * f;
      fx[j] += ux * f; fy[j] += uy * f;
    }
  }

  for (const l of links) {
    const a = nodes[l.a], b = nodes[l.b];
    const dx0 = b.x - a.x, dy0 = b.y - a.y;
    const d = Math.max(Math.sqrt(dx0 * dx0 + dy0 * dy0), 1e-4);
    const ux = dx0 / d, uy = dy0 / d;
    if (l.kind === 'pole') {
      const f = (d - opts.poleRestLength) * opts.poleStrength;
      fx[l.a] += ux * f; fy[l.a] += uy * f;
    } else if (l.kind === 'pressure') {
      const f = -Math.abs(l.weight ?? 1) * opts.springStrength;
      fx[l.a] += ux * f; fy[l.a] += uy * f;
      fx[l.b] -= ux * f; fy[l.b] -= uy * f;
    } else {
      const f = (d - opts.springLength) * opts.springStrength * (l.weight ?? 1);
      fx[l.a] += ux * f; fy[l.a] += uy * f;
      fx[l.b] -= ux * f; fy[l.b] -= uy * f;
    }
  }

  for (let i = 0; i < n; i++) {
    const node = nodes[i];
    if (node.fx != null) { node.x = node.fx; node.y = node.fy ?? 0; node.vx = 0; node.vy = 0; continue; }
    node.vx = (node.vx + fx[i] * dt) * opts.damping;
    node.vy = (node.vy + fy[i] * dt) * opts.damping;
    node.x += node.vx * dt;
    node.y += node.vy * dt;
  }
  return state;
}

/** Convenience: run `iterations` fixed-dt steps in one call (used by tests and
 *  by the view's initial "settle before first paint" pass). */
export function settleForceSim(state, iterations = 200, dt = 1) {
  for (let i = 0; i < iterations; i++) stepForceSim(state, dt);
  return state;
}
