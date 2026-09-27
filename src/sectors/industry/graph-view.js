// src/sectors/industry/graph-view.js
import { EDGE_LABEL, EDGE_TYPES, GRAPH_COLUMNS, LAYER_LABEL, STATUS_LABEL } from './industry-core.js';
import { STORIES, edgesOf, layoutIndustryGraph } from './graph-layout.js';
import { escapeHtml, translate } from '../content.js';

export function mountIndustryGraph(host, { industry, manifest, lang }) {
  if (!host) return () => {};
  const t = (v) => (lang === 'zh' ? v.zh : v.en);
  const byId = Object.fromEntries(industry.companies.map((c) => [c.id, c]));
  const src = Object.fromEntries(industry.sources.map((s) => [s.id, s]));
  const svg = host.querySelector('svg.graph');
  const ledger = host.querySelector('.graph-ledger');
  const picker = host.querySelector('select.graph-picker');
  const filters = host.querySelector('.graph-filters');
  const stories = host.querySelector('.graph-stories');
  const W = 1120, H = 760;
  let state = { types: [...EDGE_TYPES], focus: null, edgeIds: null };

  filters.innerHTML = EDGE_TYPES.map((k) => `<button type="button" data-type="${k}" aria-pressed="true" class="chip chip-${k}">${escapeHtml(t(EDGE_LABEL[k]))}</button>`).join('');
  stories.innerHTML = STORIES.map((s) => `<button type="button" data-story="${s.id}" aria-pressed="false">${escapeHtml(t(s.label))}</button>`).join('');
  picker.innerHTML = `<option value="">${translate('Choose a company', '选择公司', lang)}</option>` +
    GRAPH_COLUMNS.map((col) => `<optgroup label="${escapeHtml(t(LAYER_LABEL[col]))}">${industry.companies.filter((c) => c.layer === col)
      .map((c) => `<option value="${c.id}">${escapeHtml(t(c.name))}${c.ticker ? ` (${c.ticker})` : ''}</option>`).join('')}</optgroup>`).join('');

  function row(e) {
    const other = byId[e.source === state.focus ? e.target : e.source];
    const dir = e.source === state.focus ? '→' : '←';
    const amount = e.amount_usd_b ? translate(`$${e.amount_usd_b}B`, `${e.amount_usd_b * 10} 亿美元`, lang) : '';
    const links = e.source_ids.map((id) => `<a href="${src[id].url}" rel="noopener" target="_blank">${escapeHtml(src[id].publisher)}</a>`).join(' · ');
    return `<li class="ledger-${e.type}"><span class="ledger-type">${escapeHtml(t(EDGE_LABEL[e.type]))}</span>
      <strong>${dir} ${escapeHtml(t(other.name))}</strong> <time>${e.as_of}</time> ${amount ? `<b>${amount}</b>` : ''}
      <span class="status-tag" data-status="${e.status}">${escapeHtml(t(STATUS_LABEL[e.status]))}</span>
      <p>${escapeHtml(t(e.label))}</p><small>${links}</small></li>`;
  }

  function render() {
    const { nodes, edges } = layoutIndustryGraph(industry, { width: W, height: H, ...state });
    // Each cross-border edge fades from its own US endpoint to its own China endpoint.
    const at = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const ends = Object.fromEntries(industry.edges.map((e) => [e.id, [at[e.source], at[e.target]]]));
    const fade = (e) => { const [us, cn] = ends[e.id][0].country === 'US' ? ends[e.id] : [...ends[e.id]].reverse();
      return `<linearGradient id="usCn-${e.id}" gradientUnits="userSpaceOnUse" x1="${us.x}" y1="${us.y}" x2="${cn.x}" y2="${cn.y}"><stop offset="0" stop-color="var(--us)"/><stop offset="1" stop-color="var(--cn)"/></linearGradient>`; };
    svg.innerHTML = `<defs>${edges.filter((e) => e.crossBorder).map(fade).join('')}</defs>
      ${GRAPH_COLUMNS.map((col, i) => `<text class="graph-col" x="${36 + i * ((W - 72) / 7)}" y="16">${escapeHtml(t(LAYER_LABEL[col]))}</text>`).join('')}
      ${edges.map((e) => `<path data-id="${e.id}" d="${e.path}" class="edge ${e.stance === 'compete' ? 'edge-compete' : 'edge-coop'} edge-${e.type}${e.dim ? ' is-dim' : ''}"${e.crossBorder ? ` style="stroke:url(#usCn-${e.id})"` : ''}/>`).join('')}
      ${nodes.map((n) => { const c = byId[n.id]; return `<g class="gnode${n.dim ? ' is-dim' : ''}${n.id === state.focus ? ' is-focus' : ''}" data-id="${n.id}" tabindex="0" role="button" aria-label="${escapeHtml(t(c.name))}" transform="translate(${n.x} ${n.y})">
        <circle r="${n.r}" class="ring-${n.country}"/><image href="${manifest[n.id]?.file ?? ''}" x="${-n.r * 0.6}" y="${-n.r * 0.6}" width="${n.r * 1.2}" height="${n.r * 1.2}"/>
        <text x="${n.r + 4}" dy="4">${escapeHtml(c.ticker ?? t(c.name))}</text></g>`; }).join('')}`;
    const list = state.focus ? edgesOf(industry, state.focus).filter((e) => state.types.includes(e.type) && (!state.edgeIds || state.edgeIds.includes(e.id))) : [];
    ledger.innerHTML = state.focus
      ? `<h3>${escapeHtml(t(byId[state.focus].name))}</h3><ol>${list.map(row).join('')}</ol>`
      : `<p>${translate('Select a company or a story to read its relationships.', '选择一家公司或一个故事，阅读其关系。', lang)}</p>`;
    picker.value = state.focus ?? '';
  }

  const onFilter = (e) => { const b = e.target.closest('[data-type]'); if (!b) return;
    const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on));
    state = { ...state, types: EDGE_TYPES.filter((k) => filters.querySelector(`[data-type="${k}"]`).getAttribute('aria-pressed') === 'true') }; render(); };
  const onStory = (e) => { const b = e.target.closest('[data-story]'); if (!b) return;
    const s = STORIES.find((x) => x.id === b.dataset.story); const active = state.edgeIds === s.edgeIds;
    stories.querySelectorAll('[data-story]').forEach((x) => x.setAttribute('aria-pressed', String(!active && x === b)));
    state = active ? { ...state, focus: null, edgeIds: null } : { ...state, focus: s.focus, edgeIds: s.edgeIds }; render(); };
  const onNode = (e) => { const g = e.target.closest('[data-id]'); if (!g) return; if (e.type === 'keydown' && !['Enter', ' '].includes(e.key)) return;
    e.preventDefault?.(); state = { ...state, focus: state.focus === g.dataset.id ? null : g.dataset.id, edgeIds: null }; render(); };
  const onPick = () => { state = { ...state, focus: picker.value || null, edgeIds: null }; render(); };

  filters.addEventListener('click', onFilter); stories.addEventListener('click', onStory);
  svg.addEventListener('click', onNode); svg.addEventListener('keydown', onNode); picker.addEventListener('change', onPick);
  render();
  return () => { filters.removeEventListener('click', onFilter); stories.removeEventListener('click', onStory); picker.removeEventListener('change', onPick);
    svg.removeEventListener('click', onNode); svg.removeEventListener('keydown', onNode); };
}
