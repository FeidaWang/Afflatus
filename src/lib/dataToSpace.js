/* ============================================================
   DATA TO SPACE — pure data->3D-coordinate mapping for the sectors.html
   "data starfield" (U42 42c slice ①). Same dependency-free, DOM/THREE-free
   pattern as forceGraph.js/flightPath.js: this module only produces plain
   {x,y,z,...} node objects from real JSON, so it's fully vitest-testable
   without a renderer. The Points/shader/camera/interaction layers (U42
   slices ②-④) are separate sessions per the plan's own pacing note and are
   NOT part of this file.

   Coordinate semantics (U42 42a, "坐标即语义"):
     x = AI-vendor-camp pole, US camp -1 / CN camp +1 — same sign convention
         as forceGraph.js's MARKET_ANCHOR so the existing 2D graph and this
         3D starfield read the same way if ever shown side by side.
     y = real relevance/confidence score, 0..1, used as-is (not remapped) —
         nodes with no scored confidence (the arena-universe-only tickers,
         which are a fixed trading list, not a vendor correlation call) sit
         at a fixed neutral baseline instead of a faked reading; `hasConfidence`
         marks the difference so the render layer can dim/de-emphasize them
         rather than presenting a guess as a real value (Charter 2).
     z = bucket layer depth band — model vendor / core-ai-hardware /
         megacap-tech / benchmark / unclassified supply-chain.
   Nodes in the same (market, bucket) pair additionally share a small seeded
   offset ("聚类") so real categorical grouping is visible even before any
   physics settling pass runs on top of these seed positions.
   ============================================================ */

const MARKET_X = { US: -1, CN: 1 };
const BUCKET_Z = {
  'model-vendor': -1.5,
  'core-ai-hardware': -0.5,
  'megacap-tech': 0.5,
  benchmark: 1.5,
  'supply-chain': 0, // fallback: equity has no arena-universe bucket match
};
const NEUTRAL_CONFIDENCE = 0.5; // placeholder baseline only, never a real reading — see hasConfidence

/** Deterministic PRNG (mulberry32) — copied rather than imported from
 *  forceGraph.js so this stays a standalone dependency-free module, same
 *  reasoning forceGraph.js itself gives for not importing bootengine/seed.ts. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bucketZ(bucket) { return BUCKET_Z[bucket] ?? BUCKET_Z['supply-chain']; }

/**
 * @param {{sectorsData?: {modelWatch?: any[], baskets?: any[]}, universeData?: {symbols?: any[]}}} data
 * @param {{seed?: number}} [opts]
 * @returns {{nodes: object[]}}
 */
export function buildSpaceData(data = {}, opts = {}) {
  const rand = mulberry32(opts.seed ?? 7);
  const sectorsData = data.sectorsData || {};
  const modelWatch = Array.isArray(sectorsData.modelWatch) ? sectorsData.modelWatch : [];
  const baskets = Array.isArray(sectorsData.baskets) ? sectorsData.baskets : [];
  const universeSymbols = Array.isArray(data.universeData?.symbols) ? data.universeData.symbols : [];
  const universeByTicker = new Map(universeSymbols.map((s) => [s.sym, s]));

  const groupOffset = new Map();
  function offsetFor(key) {
    if (!groupOffset.has(key)) groupOffset.set(key, { ox: (rand() - 0.5) * 0.4, oz: (rand() - 0.5) * 0.35 });
    return groupOffset.get(key);
  }

  function place({ id, kind, label, market, bucket, confidence }) {
    const hasConfidence = typeof confidence === 'number';
    const go = offsetFor(market + '|' + bucket);
    const x = (MARKET_X[market] ?? 0) + go.ox + (rand() - 0.5) * 0.22;
    const y = (hasConfidence ? confidence : NEUTRAL_CONFIDENCE) + (rand() - 0.5) * 0.05;
    const z = bucketZ(bucket) + go.oz + (rand() - 0.5) * 0.22;
    return { id, kind, label, market, bucket, confidence: hasConfidence ? confidence : null, hasConfidence, x, y, z };
  }

  const nodes = [];
  const seen = new Set();

  // vendor nodes — the model-vendor layer (anthropic/openai/zhipu/alibaba)
  for (const card of modelWatch) {
    if (!card?.vendor) continue;
    const basket = baskets.find((b) => b.vendor === card.vendor);
    const market = basket ? basket.market : (card.vendor === 'anthropic' || card.vendor === 'openai' ? 'US' : 'CN');
    const id = 'vendor:' + card.vendor;
    nodes.push(place({ id, kind: 'vendor', label: card.vendor, market, bucket: 'model-vendor', confidence: null }));
    seen.add(id);
  }

  // equity nodes from sectors baskets — dedupe by ticker (a ticker referenced
  // from two baskets, e.g. AVGO under both anthropic and openai, becomes one
  // node whose confidence is the average of its refs); bucket comes from a
  // real cross-reference against arena-universe.json's own classification
  // when the ticker is a member of that fixed trading universe, or a generic
  // "supply-chain" fallback layer when it isn't (e.g. HK/China-listed names
  // that aren't on Arena's US-only trading list).
  const byTicker = new Map();
  for (const basket of baskets) {
    for (const eq of basket.equities || []) {
      if (!eq?.ticker) continue;
      let entry = byTicker.get(eq.ticker);
      if (!entry) { entry = { ticker: eq.ticker, market: basket.market, confidences: [] }; byTicker.set(eq.ticker, entry); }
      if (typeof eq.confidence === 'number') entry.confidences.push(eq.confidence);
    }
  }
  for (const entry of byTicker.values()) {
    const id = 'equity:' + entry.ticker;
    const uni = universeByTicker.get(entry.ticker);
    const bucket = uni ? uni.bucket : 'supply-chain';
    const confidence = entry.confidences.length ? entry.confidences.reduce((a, b) => a + b, 0) / entry.confidences.length : null;
    nodes.push(place({ id, kind: 'equity', label: entry.ticker, market: entry.market, bucket, confidence }));
    seen.add(id);
  }

  // remaining arena-universe symbols not already placed via a basket equity —
  // rounds the ~10 basket tickers out toward the ~50-particle data layer with
  // Arena's own fixed trading list. These have no vendor correlation call
  // (they're a trading universe, not a thesis), so market defaults to 'US'
  // (accurate, not fabricated — the list is US-listed-only by its own note)
  // and confidence stays unscored (hasConfidence:false).
  for (const s of universeSymbols) {
    if (!s?.sym) continue;
    const id = 'equity:' + s.sym;
    if (seen.has(id)) continue;
    nodes.push(place({ id, kind: 'universe', label: s.sym, market: 'US', bucket: s.bucket, confidence: null }));
    seen.add(id);
  }

  return { nodes };
}
