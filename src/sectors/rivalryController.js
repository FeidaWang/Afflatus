import { currentLanguage, escapeHtml, translate } from './content.js';
import { fetchJson } from '../lib/fetchJson.js';

const t = (value, lang = currentLanguage()) => {
  if (typeof value === 'string') return value;
  return translate(value?.en || '', value?.zh || '', lang);
};

const safeUrl = (value) => {
  try {
    const url = new URL(value, location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
  } catch {
    return '#';
  }
};

const sourceLink = (source, label, className = '') => (
  `<a${className ? ` class="${className}"` : ''} href="${escapeHtml(safeUrl(source))}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
);

function renderK3(host, data, lang) {
  if (!host) return;
  const report = data.k3;
  const statHtml = report.stats.map((stat) => (
    `<div class="rivalryStat"><b>${escapeHtml(stat.value)}</b><span>${escapeHtml(t(stat.label, lang))}</span></div>`
  )).join('');
  const architectureHtml = report.architecture.map((item) => (
    '<article class="k3Module">'
      + '<header>'
        + `<span>${escapeHtml(item.code)}</span>`
        + `<small>${escapeHtml(t(item.axis, lang))}</small>`
      + '</header>'
      + `<h3>${escapeHtml(t(item.title, lang))}</h3>`
      + `<p class="k3ModuleFact"><b>${escapeHtml(t({ en: 'OFFICIAL', zh: '官方事实' }, lang))}</b>${escapeHtml(t(item.official, lang))}</p>`
      + `<p class="k3ModuleThread"><b>${escapeHtml(t({ en: 'THREAD FRAME', zh: '推文解释' }, lang))}</b>${escapeHtml(t(item.thread, lang))}</p>`
      + `<p class="k3ModuleRead"><b>${escapeHtml(t({ en: 'AFFLATUS READ', zh: '独立研判' }, lang))}</b>${escapeHtml(t(item.investment, lang))}</p>`
    + '</article>'
  )).join('');
  const boundary = report.evidenceBoundary;
  const boundaryLinks = boundary.sources.map((source) => (
    sourceLink(source.url, `${source.level} · ${t(source.label, lang)}`, `evidenceLink evidenceLink--${source.level.toLowerCase()}`)
  )).join('');
  host.innerHTML = (
    '<div class="k3Signal">'
      + `<div class="k3Route">${escapeHtml(t(report.route, lang))}</div>`
      + `<h2>${escapeHtml(t(report.headline, lang))}</h2>`
      + `<p>${escapeHtml(t(report.summary, lang))}</p>`
      + `<div class="rivalryStats">${statHtml}</div>`
    + '</div>'
    + `<div class="k3Modules">${architectureHtml}</div>`
    + '<aside class="k3EvidenceBoundary">'
      + `<div><span>${escapeHtml(t({ en: 'EVIDENCE FIREWALL', zh: '证据防火墙' }, lang))}</span><h3>${escapeHtml(t(boundary.title, lang))}</h3></div>`
      + `<p>${escapeHtml(t(boundary.body, lang))}</p>`
      + `<div class="k3EvidenceLinks">${boundaryLinks}</div>`
    + '</aside>'
  );
}

function renderCostFrontier(host, data, lang) {
  if (!host) return;
  const rows = data.k3.costFrontier.map((item) => (
    '<article class="costRow">'
      + `<div class="costLabel"><b>${escapeHtml(item.task)}</b><span>${escapeHtml(t(item.note, lang))}</span></div>`
      + '<div class="costPlot">'
        + `<i style="--cost:${Number(item.costIndex)}%"></i>`
        + `<span style="--cost:${Number(item.costIndex)}%">${escapeHtml(String(item.costIndex))}</span>`
      + '</div>'
      + `<strong>${escapeHtml(item.score)}</strong>`
    + '</article>'
  )).join('');
  host.innerHTML = (
    '<div class="costLegend">'
      + `<span>${escapeHtml(t({ en: 'K3 cost index · Claude Fable = 100', zh: 'K3 成本指数 · Claude Fable = 100' }, lang))}</span>`
      + `<span>${escapeHtml(t({ en: 'reported score', zh: '报告分数' }, lang))}</span>`
    + '</div>'
    + rows
    + `<p class="rivalryCaveat">${escapeHtml(t({
      en: 'Moonshot’s own report combines in-house and third-party evaluations with different agent harnesses. Cost-frontier results are evidence, not a universal price list.',
      zh: '月之暗面报告混合了内部与第三方评测，且使用不同代理框架。成本前沿是证据，不是通用价目表。',
    }, lang))}</p>`
  );
}

function renderDeepSeek(host, data, lang) {
  if (!host) return;
  const report = data.deepSeek;
  const models = report.models.map((model) => (
    '<article class="deepSeekModel">'
      + `<span>${escapeHtml(model.id)}</span>`
      + `<h3>${escapeHtml(model.version)}</h3>`
      + '<dl>'
        + `<div><dt>${escapeHtml(t({ en: 'PARAMETERS', zh: '参数' }, lang))}</dt><dd>${escapeHtml(model.parameters)}</dd></div>`
        + `<div><dt>${escapeHtml(t({ en: 'CONTEXT', zh: '上下文' }, lang))}</dt><dd>${escapeHtml(model.context)}</dd></div>`
        + `<div><dt>${escapeHtml(t({ en: 'CONCURRENCY', zh: '并发' }, lang))}</dt><dd>${escapeHtml(model.concurrency)}</dd></div>`
      + '</dl>'
      + `<p>${escapeHtml(t(model.availability, lang))}</p>`
    + '</article>'
  )).join('');
  const prices = report.pricing.map((item) => (
    '<div class="deepSeekPriceRow">'
      + `<b>${escapeHtml(item.model)}</b>`
      + `<span>${escapeHtml(item.cacheHit)}</span>`
      + `<span>${escapeHtml(item.cacheMiss)}</span>`
      + `<span>${escapeHtml(item.output)}</span>`
    + '</div>'
  )).join('');
  const operations = report.operations.map((item) => (
    '<article class="deepSeekOperation">'
      + `<span>${escapeHtml(item.code)}</span>`
      + `<h4>${escapeHtml(t(item.title, lang))}</h4>`
      + `<p>${escapeHtml(t(item.body, lang))}</p>`
    + '</article>'
  )).join('');
  const links = report.sources.map((source) => (
    sourceLink(source.url, t(source.label, lang), 'deepSeekSource')
  )).join('');
  host.innerHTML = (
    '<section class="deepSeekBrief" aria-labelledby="deepSeekBriefTitle">'
      + '<header class="deepSeekLead">'
        + `<span>${escapeHtml(t(report.status, lang))}</span>`
        + `<h3 id="deepSeekBriefTitle">${escapeHtml(t(report.headline, lang))}</h3>`
        + `<p>${escapeHtml(t(report.assessment, lang))}</p>`
      + '</header>'
      + `<div class="deepSeekModels">${models}</div>`
      + '<div class="deepSeekPrice">'
        + '<header>'
          + `<b>${escapeHtml(t({ en: 'CURRENT LISTED USD / 1M TOKENS', zh: '当前标价 · 美元／百万 TOKEN' }, lang))}</b>`
          + `<span>${escapeHtml(t({ en: 'CACHE HIT', zh: '缓存命中' }, lang))}</span>`
          + `<span>${escapeHtml(t({ en: 'CACHE MISS', zh: '缓存未命中' }, lang))}</span>`
          + `<span>${escapeHtml(t({ en: 'OUTPUT', zh: '输出' }, lang))}</span>`
        + '</header>'
        + prices
      + '</div>'
      + `<div class="deepSeekOperations">${operations}</div>`
      + '<aside class="deepSeekCausality">'
        + `<span>${escapeHtml(t(report.causality.label, lang))}</span>`
        + `<p><b>${escapeHtml(t({ en: 'DOCUMENTED FACT', zh: '已记录事实' }, lang))}</b>${escapeHtml(t(report.causality.fact, lang))}</p>`
        + `<p><b>${escapeHtml(t({ en: 'ANALYSIS HYPOTHESIS', zh: '分析假设' }, lang))}</b>${escapeHtml(t(report.causality.hypothesis, lang))}</p>`
      + '</aside>'
      + `<nav class="deepSeekSources" aria-label="DeepSeek primary sources">${links}</nav>`
    + '</section>'
  );
}

function labCard(lab, bloc, lang) {
  return (
    `<article class="labCard labCard--${bloc.toLowerCase()}">`
      + '<header>'
        + `<span>${escapeHtml(t(lab.route, lang))}</span>`
        + `<strong><small>${escapeHtml(t({ en: 'OPERATING INDEX', zh: '经营指数' }, lang))}</small>${Number(lab.score)}</strong>`
      + '</header>'
      + `<h3>${escapeHtml(lab.name)}</h3>`
      + `<p class="labModel">${escapeHtml(lab.model)}</p>`
      + `<p class="labEdge"><b>${escapeHtml(t({ en: 'EDGE', zh: '优势' }, lang))}</b>${escapeHtml(t(lab.edge, lang))}</p>`
      + `<p class="labRisk"><b>${escapeHtml(t({ en: 'BREAK POINT', zh: '破局点' }, lang))}</b>${escapeHtml(t(lab.risk, lang))}</p>`
    + '</article>'
  );
}

function comparisonCell(value) {
  if (!Number.isFinite(value)) {
    return '<span class="modelMatrixCell is-na"><b>N/A</b></span>';
  }
  return (
    '<span class="modelMatrixCell">'
      + `<i><b style="--score:${Number(value)}%"></b></i>`
      + `<em>${Number(value)}</em>`
    + '</span>'
  );
}

function comparisonRow(entry, bloc, lang, runtime = false) {
  const note = runtime ? `<small>${escapeHtml(t(entry.note, lang))}</small>` : '';
  return (
    `<div class="modelMatrixRow modelMatrixRow--${bloc.toLowerCase()}${runtime ? ' is-runtime' : ''}" role="row">`
      + '<span class="modelMatrixIdentity" role="cell">'
        + `<b>${escapeHtml(runtime ? entry.name : entry.model)}</b>`
        + `<em>${escapeHtml(runtime ? t(entry.route, lang) : entry.name)}</em>`
        + note
      + '</span>'
      + `<span class="modelMatrixComposite ${Number.isFinite(entry.score) ? '' : 'is-na'}" role="cell">${Number.isFinite(entry.score) ? Number(entry.score) : 'N/A'}</span>`
      + entry.vector.map((value) => comparisonCell(value)).join('')
    + '</div>'
  );
}

export function buildSectorsModelComparison(frontierLabs) {
  const marker = frontierLabs.runtimeMarker;
  const rows = [];
  const labs = [
    ...frontierLabs.US.map((entry) => ({ entry, bloc: 'US', runtime: false })),
    ...frontierLabs.CN.map((entry) => ({ entry, bloc: 'CN', runtime: false })),
  ];
  labs.forEach((row) => {
    rows.push(row);
    if (row.entry.model === marker.after) rows.push({ entry: marker, bloc: 'RUNTIME', runtime: true });
  });
  return rows;
}

function renderLabs(host, data, lang) {
  if (!host) return;
  const us = data.frontierLabs.US.map((lab) => labCard(lab, 'US', lang)).join('');
  const cn = data.frontierLabs.CN.map((lab) => labCard(lab, 'CN', lang)).join('');
  const matrixEntries = buildSectorsModelComparison(data.frontierLabs)
    .map(({ entry, bloc, runtime }) => comparisonRow(entry, bloc, lang, runtime));
  const headers = lang === 'zh'
    ? ['模型／系统', '综合', '能力', '经济性', '分发', '算力安全', '权重迁移']
    : ['MODEL / SYSTEM', 'INDEX', 'CAPABILITY', 'ECONOMICS', 'DISTRIBUTION', 'COMPUTE', 'PORTABILITY'];
  host.innerHTML = (
    '<section class="modelMatrix" aria-labelledby="modelMatrixTitle">'
      + '<header class="modelMatrixIntro">'
        + `<div><span>${escapeHtml(t({ en: 'MULTI-DIMENSION OPERATING MATRIX', zh: '多维经营对比矩阵' }, lang))}</span><h3 id="modelMatrixTitle">${escapeHtml(t({ en: 'Compare the system, not one benchmark', zh: '比较整套系统，不迷信单一基准' }, lang))}</h3></div>`
        + `<p>${escapeHtml(t(data.frontierLabs.method, lang))}</p>`
      + '</header>'
      + '<div class="modelMatrixScroller">'
        + '<div class="modelMatrixTable" role="table">'
          + `<div class="modelMatrixHeader" role="row">${headers.map((label) => `<span role="columnheader">${escapeHtml(label)}</span>`).join('')}</div>`
          + matrixEntries.join('')
        + '</div>'
      + '</div>'
    + '</section>'
    + '<div class="labTheatre">'
      + '<section class="labBloc labBloc--us">'
        + `<header><span>UNITED STATES</span><h3>${escapeHtml(t({ en: 'Closed frontier · distribution empire', zh: '闭源前沿 · 分发帝国' }, lang))}</h3></header>`
        + `<div class="labStack">${us}</div>`
      + '</section>'
      + '<div class="labMeridian" aria-hidden="true"><b>VS</b><i></i><span>MODEL<br>WAR</span></div>'
      + '<section class="labBloc labBloc--cn">'
        + `<header><span>CHINA</span><h3>${escapeHtml(t({ en: 'Open frontier · efficiency offensive', zh: '开放前沿 · 效率攻势' }, lang))}</h3></header>`
        + `<div class="labStack">${cn}</div>`
      + '</section>'
    + '</div>'
  );
}

function renderEventStudy(host, data, lang) {
  if (!host) return;
  host.innerHTML = data.eventStudy.map((event, index) => (
    '<article class="eventCell">'
      + `<div class="eventDate"><span>${escapeHtml(event.date)}</span><b>0${index + 1}</b></div>`
      + `<h3>${escapeHtml(t(event.title, lang))}</h3>`
      + `<div class="eventMoves">${event.moves.map((move) => `<span>${escapeHtml(move)}</span>`).join('')}</div>`
      + `<p>${escapeHtml(t(event.cause, lang))}</p>`
      + `<small>${escapeHtml(t({ en: 'ATTRIBUTION', zh: '归因置信度' }, lang))} · ${escapeHtml(event.confidence)}</small>`
    + '</article>'
  )).join('');
}

function renderTransmission(host, data, lang) {
  if (!host) return;
  host.innerHTML = data.transmission.map((item) => (
    '<article class="transmissionNode">'
      + `<span>${escapeHtml(item.step)}</span>`
      + `<h3>${escapeHtml(t(item.title, lang))}</h3>`
      + `<p>${escapeHtml(t(item.body, lang))}</p>`
      + '<div>'
        + `<b>↑ ${escapeHtml(item.winners)}</b>`
        + `<em>↓ ${escapeHtml(item.losers)}</em>`
      + '</div>'
    + '</article>'
  )).join('');
}

function equityRow(equity, bloc, lang) {
  return (
    `<article class="equityRow equityRow--${bloc.toLowerCase()}">`
      + `<span class="equityRank">${String(equity.rank).padStart(2, '0')}</span>`
      + '<div class="equityIdentity">'
        + `<b>${escapeHtml(equity.ticker)}</b>`
        + `<span>${escapeHtml(equity.name)}</span>`
      + '</div>'
      + `<span class="equityLayer">${escapeHtml(equity.layer)}</span>`
      + `<div class="equityStrength"><i><b style="--strength:${Number(equity.strength)}%"></b></i><span>${Number(equity.strength)}</span></div>`
      + `<strong class="equityBand">${escapeHtml(equity.fairBand)}</strong>`
      + `<span class="equityStance">${escapeHtml(equity.stance)}</span>`
      + '<details>'
        + `<summary>${escapeHtml(t({ en: 'AFFLATUS READ', zh: '独家研判' }, lang))}</summary>`
        + `<p>${escapeHtml(t(equity.thesis, lang))}</p>`
        + `<small><b>${escapeHtml(t({ en: 'RISK', zh: '风险' }, lang))}</b> ${escapeHtml(t(equity.risk, lang))}</small>`
      + '</details>'
    + '</article>'
  );
}

function renderEquities(host, data, lang) {
  if (!host) return;
  const allEquities = [
    ...data.equities.US.map((equity) => ({ ...equity, bloc: 'US' })),
    ...data.equities.CN.map((equity) => ({ ...equity, bloc: 'CN' })),
  ];
  const stages = data.supplyChain.stages.map((stage) => {
    const instruments = allEquities.filter((equity) => equity.chainStage === stage.id);
    return (
      '<li class="supplyStage">'
        + `<header><span>${escapeHtml(stage.step)}</span><h4>${escapeHtml(t(stage.label, lang))}</h4><b>${instruments.length}</b></header>`
        + '<div>'
          + instruments.map((equity) => (
            `<span class="supplyTicker supplyTicker--${equity.bloc.toLowerCase()}" title="${escapeHtml(equity.name)}">${escapeHtml(equity.ticker)}</span>`
          )).join('')
        + '</div>'
      + '</li>'
    );
  }).join('');
  const section = (bloc) => (
    `<section class="equityBoard equityBoard--${bloc.toLowerCase()}">`
      + '<header>'
        + `<span>${escapeHtml(bloc === 'US' ? 'UNITED STATES · 10' : 'CHINA · 10')}</span>`
        + `<h3>${escapeHtml(t(
          bloc === 'US'
            ? { en: 'Cash conversion and physical chokepoints', zh: '现金转化与物理咽喉' }
            : { en: 'Sovereignty and distribution', zh: '自主可控与分发' },
          lang,
        ))}</h3>`
      + '</header>'
      + '<div class="equityColumns" aria-hidden="true">'
        + `<span>#</span><span>${escapeHtml(t({ en: 'instrument', zh: '标的' }, lang))}</span>`
        + `<span>${escapeHtml(t({ en: 'owned layer', zh: '控制层' }, lang))}</span>`
        + `<span>${escapeHtml(t({ en: 'strength', zh: '强度' }, lang))}</span>`
        + `<span>${escapeHtml(t({ en: 'fair band', zh: '合理区间' }, lang))}</span>`
        + `<span>${escapeHtml(t({ en: 'stance', zh: '策略' }, lang))}</span><span></span>`
      + '</div>'
      + data.equities[bloc].map((equity) => equityRow(equity, bloc, lang)).join('')
    + '</section>'
  );
  host.innerHTML = (
    '<section class="supplyChainMap">'
      + '<header>'
        + `<h3>${escapeHtml(t(data.supplyChain.title, lang))}</h3>`
        + `<p>${escapeHtml(t(data.supplyChain.body, lang))}</p>`
      + '</header>'
      + `<ol>${stages}</ol>`
    + '</section>'
    + '<div class="valuationIntro">'
      + `<h3>${escapeHtml(t(data.valuationMethod.title, lang))}</h3>`
      + `<p>${escapeHtml(t(data.valuationMethod.body, lang))}</p>`
    + '</div>'
    + section('US')
    + section('CN')
  );
}

function renderTheses(host, data, lang) {
  if (!host) return;
  host.innerHTML = data.postMemoryTheses.map((item) => (
    '<article class="thesisCard">'
      + `<span>${escapeHtml(item.id)}</span>`
      + `<h3>${escapeHtml(t(item.title, lang))}</h3>`
      + `<p>${escapeHtml(t(item.thesis, lang))}</p>`
      + `<b>OWN · ${escapeHtml(item.own)}</b>`
      + `<small><strong>${escapeHtml(t({ en: 'INVALIDATION', zh: '失效条件' }, lang))}</strong>${escapeHtml(t(item.invalidate, lang))}</small>`
    + '</article>'
  )).join('');
}

export function initSectorsRivalryController(hosts) {
  const abortController = new AbortController();
  let data = null;
  let destroyed = false;

  const render = () => {
    if (!data || destroyed) return;
    const lang = currentLanguage();
    renderK3(hosts.k3, data, lang);
    renderCostFrontier(hosts.cost, data, lang);
    renderDeepSeek(hosts.deepSeek, data, lang);
    renderLabs(hosts.labs, data, lang);
    renderEventStudy(hosts.event, data, lang);
    renderTransmission(hosts.transmission, data, lang);
    renderEquities(hosts.equities, data, lang);
    renderTheses(hosts.theses, data, lang);
  };

  const onLanguage = () => render();
  addEventListener('afflatus-lang', onLanguage);

  const ready = fetchJson('sectors-rivalry', { signal: abortController.signal })
    .then((payload) => {
      if (destroyed) return null;
      data = payload;
      render();
      return payload;
    })
    .catch((error) => {
      if (error?.code === 'ABORTED' || error?.name === 'AbortError') return null;
      const fallback = hosts.k3 || hosts.deepSeek;
      if (fallback) {
        fallback.innerHTML = `<p class="rivalryCaveat">${escapeHtml(t({
          en: 'The research dataset could not be verified. Reload to retry.',
          zh: '研究数据未能通过校验，请刷新重试。',
        }))}</p>`;
      }
      return null;
    });

  return Object.freeze({
    ready,
    render,
    destroy() {
      destroyed = true;
      abortController.abort();
      removeEventListener('afflatus-lang', onLanguage);
    },
  });
}
