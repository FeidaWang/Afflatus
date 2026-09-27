// src/sectors/industry/sources-view.js — source links for facts, and the appendix ledgers (spec §8.1, §8.3 appendix).
import { escapeHtml, translate } from '../content.js';

/** Publisher links for one fact; `byId` maps source id → source. Snapshot-derived rows have no entry and link nothing. */
export const factSourceLinks = (fact, byId) => (fact.source_ids ?? []).filter((id) => byId[id])
  .map((id) => `<a class="fact-src" data-fact="${escapeHtml(fact.id)}" href="${escapeHtml(byId[id].url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(byId[id].publisher)}</a>`)
  .join(' · ');

export function mountIndustrySources(host, { industry, manifest, lang }) {
  if (!host) return () => {};
  const t = (v) => (lang === 'zh' ? v.zh : v.en);
  const link = (url, text) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
  const sources = [...industry.sources].sort((a, b) => a.publisher.localeCompare(b.publisher) || a.id.localeCompare(b.id));
  host.querySelector('.industry-source-list').innerHTML = `<h3>${escapeHtml(translate('Companies and relationships', '公司与关系', lang))}</h3><ol>${
    sources.map((s) => `<li id="source-${escapeHtml(s.id)}">${link(s.url, s.title)} · ${escapeHtml(s.publisher)}${s.published_at ? ` · <time>${escapeHtml(s.published_at)}</time>` : ''}</li>`).join('')}</ol>`;
  const names = Object.fromEntries(industry.companies.map((c) => [c.id, t(c.name)]));
  const rows = Object.entries(manifest).sort(([a], [b]) => (names[a] ?? a).localeCompare(names[b] ?? b));
  host.querySelector('.logo-source-list').innerHTML = `<h3>${escapeHtml(translate('Logo sources', '标志来源', lang))}</h3>
    <table><thead><tr><th scope="col">${translate('Company', '公司', lang)}</th><th scope="col">${translate('Official page', '官方页面', lang)}</th><th scope="col">${translate('Retrieved', '采集日期', lang)}</th></tr></thead><tbody>${
    rows.map(([id, m]) => `<tr><th scope="row">${escapeHtml(names[id] ?? m.name ?? id)}</th><td>${link(m.source_page, new URL(m.source_page).hostname)}</td><td>${escapeHtml(m.retrieved_on ?? '')}</td></tr>`).join('')}</tbody></table>`;
  return () => {};
}
