// US–China comparison for a frontier snapshot.
// Pure functions: the view layer renders these values and never decides a leader itself.
import { valueOf } from './head-to-head.js';

const median = (xs) => {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Best model per geography on one metric, plus the US − CN point gap (null if either side is missing). */
export function geographyLeaders(snapshot, metricId = 'intelligence') {
  const best = { US: null, CN: null };
  for (const m of snapshot.models) {
    if (!(m.lab_geography in best)) continue;
    const v = valueOf(snapshot, m.id, metricId);
    if (v == null) continue;
    if (!best[m.lab_geography] || v > best[m.lab_geography].value) best[m.lab_geography] = { modelId: m.id, name: m.name, value: v };
  }
  return { ...best, points: best.US && best.CN ? best.US.value - best.CN.value : null };
}

/** Three US-vs-CN dimensions derived from the snapshot itself: top index, open-weights count, median output price. */
export function snapshotDims(snapshot) {
  const geo = (g) => snapshot.models.filter((m) => m.lab_geography === g);
  const leaders = geographyLeaders(snapshot);
  const src = { status: 'independent', source_ids: ['snapshot'] };
  return [
    { id: 'top_index', us: leaders.US?.value ?? null, cn: leaders.CN?.value ?? null, unit: 'index_points', better: 'higher', ...src,
      label: { en: 'Best overall index in this snapshot', zh: '本快照最高综合指数' } },
    { id: 'open_configs', us: geo('US').filter((m) => m.open_weights).length, cn: geo('CN').filter((m) => m.open_weights).length,
      unit: 'count', better: 'higher', ...src, label: { en: 'Open-weights configurations', zh: '开放权重配置数' } },
    { id: 'median_output_price', us: median(geo('US').map((m) => m.prices?.output)), cn: median(geo('CN').map((m) => m.prices?.output)),
      unit: 'usd_per_m', better: 'lower', ...src, label: { en: 'Median output price per 1M tokens', zh: '每百万输出 token 中位价格' } },
  ];
}

/** Split each dimension into US/CN shares of the pair total and name the leader by `better`. */
export function divergingShares(dims) {
  return dims.map((d) => {
    const total = d.us + d.cn;
    const usShare = total > 0 ? d.us / total : 0.5;
    const leader = d.us === d.cn ? 'tie' : (d.us > d.cn) === (d.better !== 'lower') ? 'US' : 'CN';
    return { ...d, usShare, cnShare: 1 - usShare, leader };
  });
}
