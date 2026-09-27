// View for chapter 06: the IPO record and the two labs' valuation steps.
// Projections are hatched; a missing amount reads "Not published" and is left out of the
// ranking and the scale (same rule as the US–China chapter).
import { STATUS_LABEL, renderable } from './industry-core.js';
import { escapeHtml, translate } from '../content.js';

const known = (v) => typeof v === 'number' && Number.isFinite(v);

export function mountIpo(host, { industry, lang }) {
  if (!host) return () => {};
  const t = (v) => (lang === 'zh' ? v.zh : v.en);
  const tag = (f) => `<span class="status-tag" data-status="${f.status}">${escapeHtml(t(STATUS_LABEL[f.status]))}</span>`;
  const na = `<b class="ipo-na">${escapeHtml(translate('Not published', '未公布', lang))}</b>`;
  const usd = (b) => {
    if (lang !== 'zh') return `$${b}B`;
    const yi = Math.round(b * 100) / 10; // 1 billion = 10 亿
    return yi >= 10000 ? `${yi / 10000} 万亿美元` : `${yi} 亿美元`;
  };

  const ipo = industry.facts.ipo.filter(renderable);
  const ranked = ipo.filter((f) => known(f.raised_usd_b)).sort((a, b) => a.raised_usd_b - b.raised_usd_b);
  const max = Math.max(...ranked.map((f) => f.raised_usd_b));
  host.querySelector('.ipo-bars').innerHTML = `<h3>${escapeHtml(translate('Money raised at IPO', 'IPO 募资额', lang))}</h3>` +
    [...ranked, ...ipo.filter((f) => !known(f.raised_usd_b))].map((f) => known(f.raised_usd_b)
      ? `<div class="ipo-bar" data-id="${f.id}" data-status="${f.status}" data-raised="${f.raised_usd_b}"><span>${escapeHtml(t(f.label))} · ${f.year}</span>
     <i style="--w:${(f.raised_usd_b / max) * 100}%"></i><b>${usd(f.raised_usd_b)}</b> ${tag(f)}</div>`
      : `<div class="ipo-bar" data-id="${f.id}" data-status="${f.status}" data-missing><span>${escapeHtml(t(f.label))} · ${f.year}</span>
     <span></span>${na} ${tag(f)}</div>`).join('');

  const val = industry.facts.valuation.filter(renderable);
  const vmax = Math.max(...val.filter((v) => known(v.usd_b)).map((v) => v.usd_b));
  const step = (v) => known(v.usd_b)
    ? `<li data-id="${v.id}" data-status="${v.status}" style="--h:${(v.usd_b / vmax) * 100}"><i></i><b>${usd(v.usd_b)}</b><span>${escapeHtml(t(v.label))} · ${v.date}</span> ${tag(v)}</li>`
    : `<li data-id="${v.id}" data-status="${v.status}" data-missing>${na}<span>${escapeHtml(t(v.label))} · ${v.date}</span> ${tag(v)}</li>`;
  const lane = (company, label) => `<div class="ladder-lane"><h4>${label}</h4><ol>${val.filter((v) => v.company === company).map(step).join('')}</ol></div>`;
  host.querySelector('.ipo-ladder').innerHTML = `<h3>${escapeHtml(translate('Valuation steps', '估值阶梯', lang))}</h3>${lane('anthropic', 'Anthropic')}${lane('openai', 'OpenAI')}`;
  return () => {};
}
