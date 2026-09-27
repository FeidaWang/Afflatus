// View for chapter 02: the two US leaders compared metric by metric.
// Leaders and gaps come from headToHead(); this file only writes DOM.
import { headToHead, pairedScale } from './head-to-head.js';
import { STATUS_LABEL, renderable } from './industry-core.js';
import { escapeHtml, translate } from '../content.js';

const fmt = (v, unit) => (v == null ? null : unit === 'USD_per_evaluation_task' ? `$${v.toFixed(2)}` : String(v));

export function mountHeadToHead(host, { snapshot, industry, lang, a = 'opus55-max', b = 'astra-max', ref = 'fable-max' }) {
  if (!host) return () => {};
  const t = (v) => (lang === 'zh' ? v.zh : v.en);
  const name = (id) => snapshot.models.find((m) => m.id === id)?.name ?? id;
  const tag = (f) => `<span class="status-tag" data-status="${f.status}">${escapeHtml(t(STATUS_LABEL[f.status]))}</span>`;
  const r = headToHead(snapshot, a, b, { refId: ref });
  const na = translate('Not published', '未公布', lang);

  host.querySelector('.h2h-bars').innerHTML = `<p class="h2h-key"><i class="k-a"></i>${escapeHtml(name(a))} <i class="k-b"></i>${escapeHtml(name(b))} <i class="k-ref"></i>${escapeHtml(name(ref))}</p>` +
    r.rows.map((row) => {
      const s = pairedScale(row);
      if (row.leader === null) return `<div class="h2h-row" data-missing><span class="h2h-label">${escapeHtml(t(row.label))}</span><span class="h2h-na">${na}</span></div>`;
      const bar = (who, v) => `<span class="h2h-bar h2h-${who}${row.leader === who ? ' is-lead' : ''}" style="--w:${(s(v) * 100).toFixed(1)}%"><b>${fmt(v, row.unit)}</b></span>`;
      const refTick = row.ref != null ? `<span class="h2h-ref" style="--x:${(s(row.ref) * 100).toFixed(1)}%" title="${escapeHtml(name(ref))}: ${fmt(row.ref, row.unit)}"></span>` : '';
      const verdict = row.leader === 'tie' ? translate('Tie', '持平', lang) : translate(`${name(row.leader === 'a' ? a : b)} leads`, `${name(row.leader === 'a' ? a : b)} 领先`, lang);
      return `<div class="h2h-row" data-leader="${row.leader}"><span class="h2h-label">${escapeHtml(t(row.label))}${row.direction === 'lower' ? translate(' (lower is better)', '（越低越好）', lang) : ''}</span>
        <span class="h2h-track">${bar('a', row.a)}${bar('b', row.b)}${refTick}</span><span class="h2h-verdict">${escapeHtml(verdict)}</span></div>`;
    }).join('');

  const list = (ids) => ids.map((id) => t(snapshot.metrics.find((m) => m.id === id).label)).join(translate(', ', '、', lang));
  host.querySelector('.h2h-cards').innerHTML = `
    <article><h3>${escapeHtml(translate(`Where ${name(a)} leads`, `${name(a)} 领先之处`, lang))}</h3><p>${escapeHtml(list(r.aLeads) || '—')}</p></article>
    <article><h3>${escapeHtml(translate(`Where ${name(b)} leads`, `${name(b)} 领先之处`, lang))}</h3><p>${escapeHtml(list(r.bLeads) || '—')}</p></article>
    <article><h3>${escapeHtml(translate('Level', '持平', lang))}</h3><p>${escapeHtml(list(r.ties) || '—')}</p></article>
    <article><h3>${escapeHtml(translate('Not yet measured for both', '尚未同时测得', lang))}</h3><p>${escapeHtml(list(r.missing) || '—')}</p></article>`;

  const price = (id) => snapshot.models.find((m) => m.id === id)?.prices;
  const scale = industry.facts.scale.filter(renderable);
  host.querySelector('.h2h-scale').innerHTML = `<dl>
    ${[a, b].map((id) => `<div><dt>${escapeHtml(name(id))}</dt><dd>${translate(`$${price(id).input} / $${price(id).output} per 1M tokens`, `每百万 token $${price(id).input} / $${price(id).output}`, lang)}</dd></div>`).join('')}
    ${scale.map((f) => `<div><dt>${escapeHtml(f.company === 'anthropic' ? 'Anthropic' : 'OpenAI')} · ${escapeHtml(t(f.label))}</dt><dd>$${f.usd_b}B <time>${f.date}</time> ${tag(f)}</dd></div>`).join('')}</dl>`;

  host.querySelector('.h2h-rsi').innerHTML = industry.facts.rsi.filter(renderable).map((f) =>
    `<blockquote class="quote"><p>${f.value != null ? `<strong>${f.value}${f.unit === 'pct' ? '%' : f.unit === 'x' ? '×' : translate(' months', ' 个月', lang)}</strong> ` : ''}${escapeHtml(t(f.label))}</p>
     <footer>${tag(f)} ${f.source_ids.map((id) => { const s = industry.sources.find((x) => x.id === id); return `<a href="${s.url}" target="_blank" rel="noopener">${escapeHtml(s.publisher)}</a>`; }).join(' · ')}</footer></blockquote>`).join('');
  return () => {};
}
