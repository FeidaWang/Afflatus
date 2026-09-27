// Dot layouts for the sticky scroll stage (spec §2.1, §8.3).
// One dot per model × metric observation slot; every scene returns one target per dot
// so the renderer only ever interpolates between equal-length arrays.
import { projectLatLon } from './projection.js';
import { valueOf } from '../industry/head-to-head.js';

export const SCENES = ['open', 'ecosystems', 'distributions', 'frontier', 'dependencies', 'value'];
const US = '#0A3161', CN = '#EE1C25', INK = '#141413', MUTED = '#66645E';
const HQ = { US: [37.6, -122.2], CN: [34.5, 116.4] };  // lab-origin anchors at country level (Bay Area; Beijing–Hangzhou band)
/** Globe centre longitude per globe scene: open faces the Atlantic, ecosystems the Pacific so both origins are visible. */
export const GLOBE_LON = { open: -40, ecosystems: 177 };
/** The four listed issuers named in #issuers; S5 enlarges and labels only these. */
export const ISSUERS = [
  { name: { en: 'Broadcom', zh: '博通' }, company: 'avgo' },
  { name: { en: 'Micron', zh: '美光' }, company: 'mu' },
  { name: { en: 'Alibaba', zh: '阿里巴巴' }, lab: 'Alibaba' },
  { name: { en: 'Xiaomi', zh: '小米' }, lab: 'Xiaomi' },
];
const geoColor = (g) => (g === 'US' ? US : CN);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const mix = (a, b, t) => a + (b - a) * t;
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mixColor = (a, b, t) => `#${hex(a).map((v, i) => Math.round(mix(v, hex(b)[i], t)).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

export function buildDots(snapshot) {
  const out = [];
  for (const m of snapshot.models) for (const k of snapshot.metrics) out.push({ i: out.length, modelId: m.id, metricId: k.id, geo: m.lab_geography });
  return out;
}

/**
 * Drawing area left free by the stage cards: right of the card column on wide screens,
 * above the bottom-docked card on phones (see .stage-card in sectors-v2.css).
 */
export const plotBox = (w, h) => (w >= 900
  ? { x0: Math.max(w * 0.46, Math.max(20, (w - 1120) / 2) + 520), x1: w * 0.96, y0: h * 0.12, y1: h * 0.9 }
  : { x0: w * 0.06, x1: w * 0.94, y0: h * 0.12, y1: h * 0.5 });
export function globeView(w, h, lon0) {
  const b = plotBox(w, h);
  return { lat0: 25, lon0, radius: Math.min(b.x1 - b.x0, b.y1 - b.y0) * 0.46, cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2 };
}
// Sunflower spread (golden angle) so each country cluster reads as a disc, not a hatch.
const jitter = (i, s, n) => { const r = Math.sqrt((i + 0.5) / n) * s / 2, a = i * 2.39996; return [r * Math.sin(a), r * Math.cos(a)]; };
const clampTo = (p, w, h) => ({ ...p, x: Math.max(0, Math.min(w, p.x)), y: Math.max(0, Math.min(h, p.y)) });

/** Globe-scene targets for an arbitrary centre longitude (the renderer uses this while the globe turns). */
export function globeTargets(scene, { dots, width: w, height: h }, lon0 = GLOBE_LON[scene] ?? GLOBE_LON.open) {
  const view = globeView(w, h, lon0);
  const rank = new Map(), size = new Map();
  for (const d of dots) size.set(d.geo, (size.get(d.geo) ?? 0) + 1);
  return dots.map((d) => {
    const [lat, lon] = HQ[d.geo] ?? [0, 0];
    const k = rank.get(d.geo) ?? 0; rank.set(d.geo, k + 1);
    const [dl, dn] = jitter(k, 14, size.get(d.geo));
    const p = projectLatLon(lat + dl, lon + dn, view);
    // Far-side dots are hidden like the far-side land, so a cluster never shows through the globe.
    return clampTo({ x: p.x, y: p.y, r: 2.4, color: scene === 'open' ? INK : geoColor(d.geo), alpha: p.visible ? 1 : 0 }, w, h);
  });
}

export function sceneTargets(scene, context) {
  const { dots, snapshot, industry, width: w, height: h } = context;
  if (scene === 'open' || scene === 'ecosystems') return globeTargets(scene, context);
  const b = plotBox(w, h);
  if (scene === 'distributions') {
    const metrics = snapshot.metrics.map((m) => m.id);
    const band = (b.y1 - b.y0) / metrics.length;
    const stacks = new Map();
    const range = new Map(metrics.map((id) => {
      const values = snapshot.observations.filter((o) => o.metric_id === id && Number.isFinite(o.value)).map((o) => o.value);
      return [id, [Math.min(...values), Math.max(...values)]];
    }));
    return dots.map((d) => {
      const v = valueOf(snapshot, d.modelId, d.metricId);
      if (v == null) return { x: w / 2, y: h - 4, r: 0, color: MUTED, alpha: 0 };
      const [lo, hi] = range.get(d.metricId);
      const t = hi === lo ? 0.5 : (v - lo) / (hi - lo);
      const x = b.x0 + t * (b.x1 - b.x0);
      const row = metrics.indexOf(d.metricId);
      const key = `${row}|${Math.round(x)}`;
      const k = stacks.get(key) ?? 0; stacks.set(key, k + 1);
      return clampTo({ x, y: b.y0 + band * (row + 0.5) - k * 6, r: 2.4, color: geoColor(d.geo), alpha: 1 }, w, h);
    });
  }
  if (scene === 'frontier') {
    const cost = (id) => valueOf(snapshot, id, 'cost_task');
    const score = (id) => valueOf(snapshot, id, 'intelligence');
    const costs = snapshot.models.map((m) => cost(m.id)).filter((v) => v > 0);
    const [c0, c1] = [Math.log(Math.min(...costs)), Math.log(Math.max(...costs))];
    return dots.map((d) => {
      const c = cost(d.modelId), s = score(d.modelId);
      if (!(c > 0) || s == null) return { x: w / 2, y: h - 4, r: 0, color: MUTED, alpha: 0 };
      const x = b.x0 + ((Math.log(c) - c0) / (c1 - c0 || 1)) * (b.x1 - b.x0);
      const y = b.y1 - ((s - 25) / 40) * (b.y1 - b.y0);
      const on = d.metricId === 'intelligence';
      return clampTo({ x, y, r: on ? 6 : 0, color: geoColor(d.geo), alpha: on ? 1 : 0 }, w, h);
    });
  }
  // dependencies / value: model dots sink to the "models" layer; tier-1 companies light up in the other rows
  const rows = ['labs', 'compute', 'memory', 'foundry', 'power'];
  const tier1 = industry.companies.filter((c) => c.tier === 1);
  const labOf = (id) => snapshot.models.find((m) => m.id === id)?.lab;
  const anchored = new Set();
  return dots.map((d, i) => {
    const slot = i % Math.max(1, tier1.length);
    const c = tier1[slot];
    const onModels = d.metricId === 'intelligence';
    const row = onModels ? 0 : Math.max(0, rows.indexOf(c.layer));
    const col = onModels ? snapshot.models.findIndex((m) => m.id === d.modelId) / snapshot.models.length : slot / tier1.length;
    const color = onModels ? geoColor(d.geo) : c.country === 'CN' ? CN : c.country === 'US' ? US : MUTED;
    const base = { x: b.x0 + col * (b.x1 - b.x0), y: b.y0 + row * ((b.y1 - b.y0) / (rows.length - 1)), r: onModels ? 4 : 3, color };
    if (scene === 'dependencies') return clampTo({ ...base, alpha: onModels || i < tier1.length * 2 ? 1 : 0.08 }, w, h);
    const issuer = ISSUERS.find((s) => (onModels && s.lab && s.lab === labOf(d.modelId)) || (!onModels && s.company && s.company === c.id));
    if (!issuer) return clampTo({ ...base, alpha: 0.08 }, w, h);
    const labelAnchor = !anchored.has(issuer.name.en);
    anchored.add(issuer.name.en);
    return clampTo({ ...base, r: 7, alpha: 1, label: issuer.name.en, labelZh: issuer.name.zh, labelAnchor }, w, h);
  });
}

export function interpolate(from, to, t, i, n) {
  const stagger = n > 1 ? (i / (n - 1)) * 0.12 : 0;
  const k = ease(Math.max(0, Math.min(1, (t - stagger) / (1 - 0.12 || 1))));
  const kk = t >= 1 ? 1 : k;
  return { x: mix(from.x, to.x, kk), y: mix(from.y, to.y, kk), r: mix(from.r, to.r, kk),
    color: kk >= 1 ? to.color : mixColor(from.color, to.color, kk), alpha: mix(from.alpha, to.alpha, kk) };
}
