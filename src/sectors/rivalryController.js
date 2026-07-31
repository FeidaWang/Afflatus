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
      + `<span>${escapeHtml(item.code)}</span>`
      + `<h3>${escapeHtml(t(item.title, lang))}</h3>`
      + `<p>${escapeHtml(t(item.body, lang))}</p>`
    + '</article>'
  )).join('');
  host.innerHTML = (
    '<div class="k3Signal">'
      + `<div class="k3Route">${escapeHtml(t(report.route, lang))}</div>`
      + `<h2>${escapeHtml(t(report.headline, lang))}</h2>`
      + `<p>${escapeHtml(t(report.summary, lang))}</p>`
      + `<div class="rivalryStats">${statHtml}</div>`
    + '</div>'
    + `<div class="k3Modules">${architectureHtml}</div>`
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

function labCard(lab, bloc, lang) {
  const labels = lang === 'zh'
    ? ['能力', '经济性', '分发', '算力', '迁移']
    : ['CAP', 'ECON', 'DIST', 'CMP', 'PORT'];
  const vector = lab.vector.map((value, index) => (
    `<div class="labVector"><span>${labels[index]}</span><i><b style="--v:${Number(value)}%"></b></i><em>${Number(value)}</em></div>`
  )).join('');
  return (
    `<article class="labCard labCard--${bloc.toLowerCase()}">`
      + '<header>'
        + `<span>${escapeHtml(lab.route)}</span>`
        + `<strong>${Number(lab.score)}</strong>`
      + '</header>'
      + `<h3>${escapeHtml(lab.name)}</h3>`
      + `<p class="labModel">${escapeHtml(lab.model)}</p>`
      + `<div class="labVectors">${vector}</div>`
      + `<p class="labEdge"><b>${escapeHtml(t({ en: 'EDGE', zh: '优势' }, lang))}</b>${escapeHtml(t(lab.edge, lang))}</p>`
      + `<p class="labRisk"><b>${escapeHtml(t({ en: 'BREAK POINT', zh: '破局点' }, lang))}</b>${escapeHtml(t(lab.risk, lang))}</p>`
    + '</article>'
  );
}

function renderLabs(host, data, lang) {
  if (!host) return;
  const us = data.frontierLabs.US.map((lab) => labCard(lab, 'US', lang)).join('');
  const cn = data.frontierLabs.CN.map((lab) => labCard(lab, 'CN', lang)).join('');
  host.innerHTML = (
    '<div class="labTheatre">'
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
    + `<p class="rivalryMethod">${escapeHtml(t(data.frontierLabs.method, lang))}</p>`
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
    '<div class="valuationIntro">'
      + `<h3>${escapeHtml(t(data.valuationMethod.title, lang))}</h3>`
      + `<p>${escapeHtml(t(data.valuationMethod.body, lang))}</p>`
    + '</div>'
    + section('US')
    + section('CN')
  );
}

function renderLetter(host, data, lang) {
  if (!host) return;
  const alliance = data.openSecureAlliance;
  const letter = data.openWeightsLetter;
  const nameGrid = (names, badge) => names.map((name, index) => (
    '<span class="initiativeName">'
      + `<i>${String(index + 1).padStart(2, '0')}</i>`
      + `<b>${escapeHtml(name)}</b>`
      + `<small>${escapeHtml(badge)}</small>`
    + '</span>'
  )).join('');
  const missing = letter.missing.map((item) => (
    '<article>'
      + `<b>${escapeHtml(item.name)}</b>`
      + `<p>${escapeHtml(t(item.why, lang))}</p>`
    + '</article>'
  )).join('');
  host.innerHTML = (
    '<div class="initiativeDossiers">'
      + '<section class="initiativeDossier initiativeDossier--security">'
        + '<header>'
          + '<div>'
            + `<span>01 · ${escapeHtml(t({ en: 'CYBERSECURITY ALLIANCE', zh: '网络安全联盟' }, lang))}</span>`
            + `<h3>${escapeHtml(alliance.name)}</h3>`
          + '</div>'
          + `<b>${Number(alliance.count)}<small>${escapeHtml(t({ en: 'INAUGURAL PARTNERS', zh: '创始伙伴' }, lang))}</small></b>`
          + `<p>${escapeHtml(t({
            en: 'Announced by NVIDIA on 27 July 2026 to build and share open defensive tools for AI safety and cybersecurity. This is an operating alliance, not the open-weights policy letter.',
            zh: 'NVIDIA 于 2026 年 7 月 27 日公布，目标是为 AI 安全与网络安全共同构建、共享开放防御工具。它是执行型联盟，不是开放权重政策联署。',
          }, lang))} ${sourceLink(alliance.source, t({ en: 'NVIDIA announcement ↗', zh: 'NVIDIA 官方公告 ↗' }, lang))}</p>`
        + '</header>'
        + '<figure class="initiativeLogoBoard">'
          + `<img src="${escapeHtml(alliance.image)}" width="2582" height="1332" loading="lazy" decoding="async" alt="${escapeHtml(t(alliance.imageAlt, lang))}">`
        + '</figure>'
        + `<div class="initiativeNames">${nameGrid(alliance.names, t({ en: 'ALLIANCE', zh: '安全联盟' }, lang))}</div>`
      + '</section>'
      + '<section class="initiativeDossier initiativeDossier--weights">'
        + '<header>'
          + '<div>'
            + `<span>02 · ${escapeHtml(t({ en: 'OPEN-WEIGHTS POLICY LETTER', zh: '开放权重政策联署' }, lang))}</span>`
            + '<h3>Open Weights and American AI Leadership</h3>'
          + '</div>'
          + `<b>${Number(letter.officialSnapshot.count)}<small>${escapeHtml(t({ en: 'LOGOS IN SNAPSHOT', zh: '快照机构' }, lang))}</small></b>`
          + `<p>${escapeHtml(t({
            en: 'The 77 names below are transcribed from the supplied logo snapshot for Jensen Huang’s first public open-weights letter. Supporting the policy does not prove that a company publishes frontier weights.',
            zh: '下方 77 家机构逐一转录自你提供的黄仁勋首轮开放权重联署 Logo 快照。支持该政策，并不等于该机构会公开前沿模型权重。',
          }, lang))} ${sourceLink(letter.officialSnapshot.source, t({ en: 'NVIDIA-hosted letter ↗', zh: 'NVIDIA 托管原文 ↗' }, lang))}</p>`
        + '</header>'
        + '<figure class="initiativeLogoBoard">'
          + `<img src="${escapeHtml(letter.image)}" width="1906" height="1502" loading="lazy" decoding="async" alt="${escapeHtml(t(letter.imageAlt, lang))}">`
        + '</figure>'
        + `<div class="initiativeNames">${nameGrid(letter.officialNames, t({ en: 'LETTER', zh: '联署' }, lang))}</div>`
      + '</section>'
    + '</div>'
    + '<section class="letterMissing">'
      + `<h3>${escapeHtml(t({ en: 'Important absences · absence is not a policy position', zh: '重要缺席者 · 缺席不代表政策立场' }, lang))}</h3>`
      + `<div>${missing}</div>`
    + '</section>'
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
    renderLabs(hosts.labs, data, lang);
    renderEventStudy(hosts.event, data, lang);
    renderTransmission(hosts.transmission, data, lang);
    renderEquities(hosts.equities, data, lang);
    renderLetter(hosts.letter, data, lang);
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
      const fallback = hosts.k3 || hosts.letter;
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
