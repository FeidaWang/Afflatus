// src/sectors/industry/graph-layout.js
import { EDGE_TYPES, GRAPH_COLUMNS, renderable } from './industry-core.js';

export const NODE_RADIUS = { 1: 14, 2: 10, 3: 7 };

export const STORIES = [
  { id: 'ant-spacex', focus: 'anthropic', label: { en: 'Anthropic × SpaceX: partners and rivals', zh: 'Anthropic × SpaceX：既合作又竞争' },
    edgeIds: ['spcx-ant-colossus', 'ant-spcx-pay', 'ant-spcx-rival', 'nvda-spcx-gpus'] },
  { id: 'ant-capital', focus: 'anthropic', label: { en: 'The capital web around Anthropic', zh: '围绕 Anthropic 的资本网' },
    edgeIds: ['googl-ant-invest', 'amzn-ant-invest', 'msft-ant-invest', 'nvda-ant-invest', 'mu-ant-invest', 'googl-ant-rival'] },
  { id: 'oai-compute', focus: 'openai', label: { en: 'OpenAI’s compute web', zh: 'OpenAI 的算力网' },
    edgeIds: ['msft-oai-azure', 'orcl-oai-stargate', 'nvda-oai-chips', 'amd-oai-chips', 'avgo-oai-chips', 'crwv-oai-compute', 'amzn-oai-cloud', 'cbrs-oai-compute'] },
  { id: 'hbm', focus: 'nvda', label: { en: 'Three memory makers, one customer', zh: '三家存储厂，同一个客户' },
    edgeIds: ['skhy-nvda-hbm', 'mu-nvda-hbm', 'samsung-nvda-hbm', 'tsm-nvda-foundry'] },
];

export const edgesOf = (data, id) => data.edges
  .filter((e) => renderable(e) && (e.source === id || e.target === id))
  .sort((a, b) => (a.as_of < b.as_of ? 1 : a.as_of > b.as_of ? -1 : 0));

function curve(a, b, offset) {
  if (a.x === b.x) {                               // same column: arc out to the left
    const cx = a.x - 70 - offset * 4;
    return `M${a.x} ${a.y}Q${cx} ${(a.y + b.y) / 2} ${b.x} ${b.y}`;
  }
  const mx = (a.x + b.x) / 2;
  return `M${a.x} ${a.y + offset}C${mx} ${a.y + offset} ${mx} ${b.y + offset} ${b.x} ${b.y + offset}`;
}

export function layoutIndustryGraph(data, { width, height, types = EDGE_TYPES, focus = null, edgeIds = null, pad = 36 }) {
  const pos = new Map();
  const colW = (width - 2 * pad) / (GRAPH_COLUMNS.length - 1);
  GRAPH_COLUMNS.forEach((col, i) => {
    const list = data.companies.filter((c) => c.layer === col).sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
    const step = (height - 2 * pad) / Math.max(list.length, 1);
    list.forEach((c, j) => pos.set(c.id, { id: c.id, x: pad + i * colW, y: pad + step * (j + 0.5), r: NODE_RADIUS[c.tier], column: col, country: c.country }));
  });
  const shown = data.edges.filter((e) => renderable(e) && types.includes(e.type) && (!edgeIds || edgeIds.includes(e.id)));
  // A story is its own selection: every one of its edges stays at full strength.
  const touches = (e) => !focus || !!edgeIds || e.source === focus || e.target === focus;
  const neighbours = focus ? new Set([focus, ...shown.filter(touches).flatMap((e) => [e.source, e.target])]) : null;
  const seen = new Map();
  const edges = shown.map((e) => {
    const a = pos.get(e.source), b = pos.get(e.target);
    const key = [e.source, e.target].sort().join('|');
    const k = seen.get(key) ?? 0; seen.set(key, k + 1);
    const offset = k === 0 ? 0 : (k % 2 ? 4 : -4) * Math.ceil(k / 2);
    const pair = new Set([a.country, b.country]);
    return { id: e.id, type: e.type, stance: e.type === 'competitor' ? 'compete' : 'cooperate',
      crossBorder: pair.has('US') && pair.has('CN'), dim: !touches(e), path: curve(a, b, offset) };
  });
  const nodes = [...pos.values()].map((n) => ({ ...n, dim: neighbours ? !neighbours.has(n.id) : false }));
  return { nodes, edges };
}
