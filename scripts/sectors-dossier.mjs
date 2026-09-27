import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const data = JSON.parse(readFileSync(new URL('../src/sectors/frontier/dossier-data.json', import.meta.url), 'utf8'));
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const bi = (en, zh) => ({ en, zh });
const text = (copy, tag = 'span') => `<${tag} data-en="${escape(copy.en)}" data-zh="${escape(copy.zh)}">${escape(copy.en)}</${tag}>`;
const roles = { supplier: bi('Supplier', '供应商'), investor: bi('Investor', '投资者'), customer: bi('Customer', '客户'), developer: bi('Model developer', '模型开发者') };
const field = (label, value) => `<div>${text(label, 'dt')}${text(value, 'dd')}</div>`;
const links = ids => ids.map(id => `<a href="#p4-source-${escape(id)}">${escape(id)}</a>`).join(' · ');
export function renderIssuers() {
  return `<div class="fc-issuer-dossier" id="frontierIssuers">
${text(bi(`${data.issuers.length} reviewed issuers · identity and business sources read ${data.reviewed_on}. Selected instruments, not a complete securities register.`, `${data.issuers.length} 家已复核发行人 · 证券身份与业务来源阅读于 ${data.reviewed_on}。仅列选定证券，并非完整证券登记册。`), 'p')}
${text(bi('One legal issuer can have several instruments or currency counters. No model-to-stock score, price target or return forecast is assigned.', '同一法律发行人可能有多个证券或币种柜台。这里不将模型分数映射为股票评分，也不提供目标价或收益预测。'), 'p')}
${data.issuers.map(i => `<article id="issuer-${i.id}" data-issuer="${i.id}">
${text(i.name, 'h3')}<p class="fc-legal">${escape(i.legal_name)}</p>
<p class="fc-roles">${i.roles.map(r => text(roles[r])).join(' · ')}</p>${text(i.role, 'p')}
<ul class="fc-instruments">${i.instruments.map(x => `<li><b>${escape(x.exchange)}: ${escape(x.symbol)} · ${escape(x.currency)}</b> — ${text(x.kind)}</li>`).join('')}</ul>
${i.id === 'alibaba' ? text(bi('BABA, 9988 and 89988 represent one issuer. The two Hong Kong counters trade the same ordinary shares in different currencies; the ADS has a different share ratio.', 'BABA、9988 与 89988 归属同一发行人。两个香港柜台以不同币种交易同一普通股；存托股的股数比例不同。'), 'p') : ''}
<dl class="frontierDimensions">${field(bi('Company disclosure / status','公司披露／实施状态'),i.status)}${field(bi('Materiality evidence','实质影响证据'),i.materiality)}</dl>
<details><summary>${text(bi('Watch items, risks and evidence','观察项、风险与证据'))}</summary><dl class="frontierDimensions">${field(bi('Editorial watch items','编辑观察项'),i.watch)}${field(bi('Countervailing risks','相反风险'),i.risk)}</dl>
<p>${text(bi('Company / issuer sources: ','公司／发行人来源：'))}${links(i.source_ids)}</p>
<p>${text(bi('Related theses: ','相关论点：'))}${i.thesis_ids.map(id => `<a href="#thesis-${id}">${id}</a>`).join(' · ')}</p></details></article>`).join('\n')}
${text(bi('Other issuers remain in the dated archive or await an identity and business audit. This selection is not a US/China quota or an equity ranking.', '其他发行人保留于有日期的历史档案，或等待身份与业务核查。本选集不设中美名额，也不是股票排名。'), 'p')}</div>`;
}
export function renderTheses() {
 return `<div class="fc-issuer-dossier" id="frontierTheses">${data.theses.map(t => `<article id="thesis-${t.id}" data-thesis="${t.id}"><h3>${t.id} · ${text(t.title)}</h3>
${text(bi(t.evidence_status === 'analytical_guardrail' ? 'Analytical guardrail' : 'Editorial hypothesis',t.evidence_status === 'analytical_guardrail' ? '分析约束' : '编辑假设'), 'p')}${text(t.thesis, 'p')}
<p class="fc-uncertainty">${text(bi('Uncertainty: ','不确定性：'))}${text(t.uncertainty)}</p>
<details><summary>${text(bi('Inspect falsifier and sources','检查失效条件与来源'))}</summary><dl class="frontierDimensions">${field(bi('Falsifier / boundary','失效条件／边界'),t.falsifier)}</dl>
<p>${t.source_ids.length ? links(t.source_ids) : text(bi('No empirical source supplied. This is a reasoning constraint, not an observed finding.','未提供实证来源。这是推理约束，不是观测结论。'))}</p></details></article>`).join('\n')}
<details id="frontierDossierSources"><summary>${text(bi('Source ledger · dates and verification scope','来源台账 · 日期与核查范围'))}</summary>
${text(bi('Company statements do not establish independent outcomes. Supplied benchmark references remain unchanged and were not rechecked in P4. Dates below distinguish publication from retrieval.', '公司声明不能证明独立验证的结果。随附基准参考保持原样，P4 未重新核查。下列日期区分发布时间与采集时间。'), 'p')}
${data.sources.map(s => `<div id="p4-source-${s.id}" class="fc-source"><a href="${escape(s.url)}">${escape(s.id)} · ${escape(s.title)}</a><p>${text(bi(`Published: ${s.published_at || 'not stated'} · retrieved: ${s.retrieved_on}`, `发布：${s.published_at || '未注明'} · 采集：${s.retrieved_on}`))}</p>${text(s.verification.startsWith('read_primary') ? bi('Company / issuer disclosure · primary page read in P4 on 2026-09-23.','公司／发行人披露 · P4 于 2026-09-23 阅读一手页面。') : bi(`Supplied reference (${s.evidence_type}) · not rechecked in P4.`, `随附参考（${s.evidence_type}）· P4 未重新核查。`),'p')}</div>`).join('\n')}</details></div>`;
}
export function updatePage(html) {
 for (const [name, render] of [['issuers',renderIssuers],['theses',renderTheses]]) {
  const start = `<!-- P4 ${name} start -->`, end = `<!-- P4 ${name} end -->`;
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
  if (!pattern.test(html)) throw new Error(`Missing ${name} generation markers`);
  html = html.replace(pattern, `${start}\n${render()}\n${end}`);
 }
 return html;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
 const path = new URL('../sectors.html', import.meta.url);
 const original = readFileSync(path, 'utf8');
 const generated = updatePage(original);
 if (process.argv.includes('--write')) writeFileSync(path, generated);
 else if (original !== generated) throw new Error('Sectors dossier is stale; run node scripts/sectors-dossier.mjs --write');
 console.log('Sectors issuer/thesis dossier: current');
}
