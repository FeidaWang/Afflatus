// View for chapter 03: US–China gap, diverging strengths and mutual dependence.
// Leaders and shares come from rivalry-math.js; this file only writes DOM/SVG.
import { divergingShares, geographyLeaders, snapshotDims } from './rivalry-math.js';
import { STATUS_LABEL, renderable } from './industry-core.js';
import { escapeHtml, translate } from '../content.js';

const num = (v, unit, lang) => unit === 'pct' ? `${v}%` : unit === 'usd_b' ? (lang === 'zh' ? `${v * 10} 亿美元` : `$${v}B`)
  : unit === 'usd_per_m' ? `$${v}` : unit === 'count' ? v.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-AU') : String(v);

export function mountUsChina(host, { snapshot, industry, lang }) {
  if (!host) return () => {};
  const t = (v) => (lang === 'zh' ? v.zh : v.en);
  const tag = (f) => `<span class="status-tag" data-status="${f.status}">${escapeHtml(t(STATUS_LABEL[f.status]))}</span>`;
  const leaders = geographyLeaders(snapshot);

  const gaps = industry.facts.gap.filter(renderable);
  const max = Math.max(...gaps.map((g) => g.high ?? g.value)) + 2;
  host.querySelector('.gap').innerHTML = `<p class="gap-lede">${escapeHtml(translate(
    `In this snapshot the best US configuration (${leaders.US.name}, ${leaders.US.value}) leads the best Chinese one (${leaders.CN.name}, ${leaders.CN.value}) by ${leaders.points} index points. Estimates of the lag in time:`,
    `本快照中，美国最佳配置（${leaders.US.name}，${leaders.US.value}）领先中国最佳配置（${leaders.CN.name}，${leaders.CN.value}）${leaders.points} 个指数点。以时间计的落后估计：`, lang))}</p>
    <ol class="gap-scale">${gaps.map((g) => `<li style="--v:${(g.value / max) * 100}%;--lo:${((g.low ?? g.value) / max) * 100}%;--hi:${((g.high ?? g.value) / max) * 100}%">
      <span class="gap-label">${escapeHtml(t(g.label))} ${tag(g)}</span><span class="gap-track"><i class="gap-range"></i><b class="gap-dot">${g.value}</b></span></li>`).join('')}</ol>
    <p class="gap-axis">${escapeHtml(translate('Months behind the US frontier', '落后美国前沿的月数', lang))}</p>`;

  const dims = divergingShares([...snapshotDims(snapshot), ...industry.facts.dims.filter(renderable)]);
  const label = (d) => `<span class="dim-label">${escapeHtml(t(d.label))}${d.better === 'lower' ? translate(' (lower is better)', '（越低越好）', lang) : ''} ${d.source_ids[0] === 'snapshot' ? '' : tag(d)}</span>`;
  host.querySelector('.dims').innerHTML = `<p class="dims-key"><span class="is-us">${translate('United States', '美国', lang)}</span><span class="is-cn">${translate('China', '中国', lang)}</span></p>` +
    dims.map((d) => d.leader === null
      ? `<div class="dim-row" data-id="${d.id}" data-missing>${label(d)}<span class="dim-na">${translate('Not published', '未公布', lang)}</span></div>`
      : `<div class="dim-row" data-id="${d.id}" data-leader="${d.leader}">${label(d)}
      <span class="dim-bar"><i class="dim-us" style="--s:${(d.usShare * 100).toFixed(1)}%" data-v="${escapeHtml(num(d.us, d.unit, lang))}"></i><i class="dim-cn" style="--s:${(d.cnShare * 100).toFixed(1)}%" data-v="${escapeHtml(num(d.cn, d.unit, lang))}"></i></span>
      <span class="sr-only">${escapeHtml(translate(`US ${num(d.us, d.unit, lang)}, China ${num(d.cn, d.unit, lang)}`, `美国 ${num(d.us, d.unit, lang)}，中国 ${num(d.cn, d.unit, lang)}`, lang))}</span>
      <span class="dim-verdict ${d.leader === 'US' ? 'is-us' : d.leader === 'CN' ? 'is-cn' : ''}">${escapeHtml(d.leader === 'tie' ? translate('Level', '持平', lang) : d.leader === 'US' ? translate('US leads', '美国领先', lang) : translate('China leads', '中国领先', lang))}</span></div>`).join('') +
    industry.facts.shares.filter(renderable).map((s) => `<p class="share-callout is-cn"><strong>${s.value}%</strong> ${escapeHtml(t(s.label))} ${tag(s)}</p>`).join('');

  const flows = industry.facts.flows.filter(renderable);
  const col = (from) => flows.filter((f) => f.from === from).map((f) =>
    `<li class="flow" data-friction="${f.friction}">${escapeHtml(t(f.label))} ${tag(f)}</li>`).join('');
  host.querySelector('.flows').innerHTML = `<div class="flow-col"><h3 class="is-us">${translate('United States → China', '美国 → 中国', lang)}</h3><ul>${col('US')}</ul></div>
    <svg class="flow-arrows" viewBox="0 0 80 200" aria-hidden="true"><defs><linearGradient id="flowGrad" gradientUnits="userSpaceOnUse" x1="4" x2="76"><stop offset="0" style="stop-color:var(--us)"/><stop offset="1" style="stop-color:var(--cn)"/></linearGradient></defs>
      <path d="M4 60H72" stroke="url(#flowGrad)" stroke-width="2"/><path d="M76 140H8" stroke="url(#flowGrad)" stroke-width="2" stroke-dasharray="6 4"/></svg>
    <div class="flow-col"><h3 class="is-cn">${translate('China → United States', '中国 → 美国', lang)}</h3><ul>${col('CN')}</ul></div>
    <p class="flow-note">${escapeHtml(translate('Dashed items are points of friction: controls, bans or accusations.', '虚线标记的是摩擦点：管制、禁令或指控。', lang))}</p>`;
  return () => {};
}
