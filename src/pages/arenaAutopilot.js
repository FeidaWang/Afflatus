/* ============================================================
   ARENA · AUTOPILOT DASHBOARD (V5, ROADMAP §7.1)

   Renders the two simulated LLM ledgers (public/arena-ledger.json) into
   #apDash: an equity dual-curve chart (Model A vs Model B vs a two-point
   SPY/SMH "buy & hold since day 0" reference line), per-model metric
   chips, bilingual review text, a positions table and a merged trade/
   rejection log. Read-only — never writes the ledger (settlement lives in
   src/lib/arenaRun.js, run by the scheduled task's CLI wrapper).

   All non-trivial math (P&L, chart scaling, benchmark line) is delegated
   to src/lib/arenaLedgerView.js (pure, vitest-covered) — this file only
   fetches and renders.
   ============================================================ */
import { unrealizedPnl, benchmarkEndpoints, equityDomain, scalePoint } from '../lib/arenaLedgerView.js';

(() => {
  'use strict';
  const host = document.getElementById('apDash');
  if (!host) return;

  const $ = (id) => document.getElementById(id);
  const LEDGER_URL = '/arena-ledger.json';
  const UNIVERSE_URL = '/arena-universe.json';

  const state = {
    lang: (window.AfflatusI18N && window.AfflatusI18N.get && window.AfflatusI18N.get()) || 'en',
    ledger: null,
    names: {},   // sym -> display name, best-effort from arena-universe.json
  };
  const T = (en, zh) => (state.lang === 'zh' ? zh : en);
  const fmtUsd = (x) => (x == null || !isFinite(x)) ? '—' : '$' + Number(x).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtPct = (x) => (x == null || !isFinite(x)) ? '—' : (x >= 0 ? '+' : '') + Number(x).toFixed(2) + '%';
  const fmtNum = (x, d = 2) => (x == null || !isFinite(x)) ? '—' : Number(x).toFixed(d);

  // ---- data ------------------------------------------------------
  fetch(UNIVERSE_URL, { cache: 'no-store' })
    .then((r) => r.ok ? r.json() : Promise.reject())
    .then((d) => { for (const s of d.symbols || []) state.names[s.sym] = s.name; })
    .catch(() => {});

  fetch(LEDGER_URL, { cache: 'no-store' })
    .then((r) => r.ok ? r.json() : Promise.reject())
    .then((d) => { state.ledger = d; render(); })
    .catch(() => { renderError(); });

  function renderError() {
    $('apNote').textContent = T('Autopilot ledger unavailable right now.', 'Autopilot 账本暂时无法加载。');
    $('apLegend').innerHTML = '';
    $('apModelA').innerHTML = `<div class="empty">${T('No data.', '暂无数据。')}</div>`;
    $('apModelB').innerHTML = `<div class="empty">${T('No data.', '暂无数据。')}</div>`;
  }

  // ---- chart -------------------------------------------------------
  function buildPath(series, domain, w, h, pad) {
    if (!series.length) return '';
    if (series.length === 1) { const p = scalePoint(series[0], domain, w, h, pad); return `<circle class="ap-dot" cx="${p.x}" cy="${p.y}" r="3.4" fill="currentColor"/>`; }
    const d = series.map((pt, i) => { const p = scalePoint(pt, domain, w, h, pad); return `${i ? 'L' : 'M'}${p.x},${p.y}`; }).join(' ');
    return `<path class="ap-line" d="${d}"/>`;
  }
  function renderChart(A, B, bench) {
    const W = 600, H = 240, pad = 30;
    const spy = benchmarkEndpoints(A.equityHistory, A.startEquity, bench.spyPct);
    const smh = benchmarkEndpoints(B.equityHistory, B.startEquity, bench.smhPct);
    const domain = equityDomain([A.equityHistory, B.equityHistory, spy, smh]);
    let s = '';
    // horizontal gridlines + $ labels
    for (let i = 0; i <= 3; i++) {
      const y = pad + (i / 3) * (H - pad * 2);
      const price = domain.maxEq - (i / 3) * (domain.maxEq - domain.minEq);
      s += `<line x1="${pad}" y1="${y.toFixed(1)}" x2="${W - pad}" y2="${y.toFixed(1)}" class="ap-grid"/><text x="${(W - pad + 4)}" y="${(y + 3.5).toFixed(1)}" class="ap-axis">${fmtUsd(price)}</text>`;
    }
    s += `<g class="ap-line-spy">${buildPath(spy, domain, W, H, pad)}</g>`;
    s += `<g class="ap-line-smh">${buildPath(smh, domain, W, H, pad)}</g>`;
    s += `<g class="ap-line-b">${buildPath(B.equityHistory, domain, W, H, pad)}</g>`;
    s += `<g class="ap-line-a">${buildPath(A.equityHistory, domain, W, H, pad)}</g>`;
    $('apChart').setAttribute('viewBox', `0 0 ${W} ${H}`);
    $('apChart').innerHTML = s;
    $('apLegend').innerHTML = [
      ['ap-line-a', T('Model A', 'Model A')],
      ['ap-line-b', T('Model B', 'Model B')],
      ['ap-line-spy dash', 'SPY'],
      ['ap-line-smh dash', 'SMH'],
    ].map(([cls, label]) => `<span><i class="${cls}"></i>${label}</span>`).join('');
  }

  // ---- per-model card -----------------------------------------------
  function metricChip(label, value) { return `<div class="ap-metric"><span>${label}</span><b>${value}</b></div>`; }
  function positionRow(p) {
    const { pnl, pnlPct } = unrealizedPnl(p);
    const name = state.names[p.sym] ? ` <span style="color:var(--muted)">${state.names[p.sym]}</span>` : '';
    return `<tr><td>${p.sym}${name}</td><td>${fmtNum(p.qty, 0)}</td><td>${fmtUsd(p.avgPx)}</td><td>${fmtUsd(p.mkPx)}</td><td class="${pnl >= 0 ? 'up' : 'down'}">${fmtPct(pnlPct)}</td></tr>`;
  }
  function logRow(entry) {
    if (entry.kind === 'trade') { const t = entry.data; return `<div class="ap-log-row ${t.side}"><span>${t.side.toUpperCase()} ${t.sym} × ${fmtNum(t.qty, 0)} @ ${fmtUsd(t.px)}</span><span>${t.realizedPnl != null ? fmtUsd(t.realizedPnl) : ''}</span></div>`; }
    const o = entry.data.order || {}; return `<div class="ap-log-row rej"><span>✗ ${(o.side || '?').toUpperCase()} ${o.sym || '?'}</span><span>${entry.data.reason || ''}</span></div>`;
  }
  function renderModel(hostId, label, m) {
    const metrics = m.metrics || {};
    const chips = [
      metricChip(T('EQUITY', '净值'), fmtUsd(m.equity)),
      metricChip(T('CASH', '现金'), fmtUsd(m.cash)),
      metricChip(T('CUM %', '累计%'), fmtPct(metrics.cumPct)),
      metricChip(T('MAX DD', '最大回撤'), fmtPct(metrics.maxDD)),
      metricChip(T('HIT %', '胜率'), metrics.hitRate == null ? '—' : metrics.hitRate.toFixed(1) + '%'),
      metricChip(T('EXPOSURE', '仓位'), metrics.exposure == null ? '—' : metrics.exposure.toFixed(1) + '%'),
    ].join('');
    const review = m.review ? T(m.review.en, m.review.zh) : '';
    const positions = (m.positions || []);
    const posBlock = positions.length
      ? `<table class="ap-postbl"><thead><tr><th>${T('SYM', '代码')}</th><th>${T('QTY', '数量')}</th><th>${T('AVG', '均价')}</th><th>${T('MKT', '现价')}</th><th>${T('P&L', '盈亏')}</th></tr></thead><tbody>${positions.map(positionRow).join('')}</tbody></table>`
      : `<div class="empty">${T('No open positions.', '当前无持仓。')}</div>`;
    const log = [
      ...(m.trades || []).map((data) => ({ kind: 'trade', ts: data.ts, data })),
      ...(m.rejections || []).map((data) => ({ kind: 'rej', ts: data.ts, data })),
    ].sort((a, b) => Date.parse(b.ts || 0) - Date.parse(a.ts || 0)).slice(0, 8);
    const logBlock = log.length ? `<div class="ap-log">${log.map(logRow).join('')}</div>` : `<div class="empty">${T('No trades yet.', '尚未成交。')}</div>`;
    $(hostId).innerHTML = `
      <div class="ap-mh"><b>${label}</b><span class="chip">${m.promptVersion || ''}</span></div>
      <div class="ap-metrics">${chips}</div>
      ${review ? `<p class="ap-review">${review}</p>` : ''}
      <div class="ap-sub">${T('Positions', '持仓')}</div>
      ${posBlock}
      <div class="ap-sub">${T('Recent activity', '近期动态')}</div>
      ${logBlock}
    `;
  }

  function render() {
    const d = state.ledger; if (!d) return;
    const A = d.models.A, B = d.models.B;
    $('apDayChip').textContent = T(`DAY ${d.day} · SEASON ${d.season}`, `第 ${d.day} 日 · 赛季 ${d.season}`);
    $('apUpdChip').textContent = T('UPDATED ', '更新 ') + (d.updated || '—');
    $('apNote').textContent = T(d.note_en || '', d.note_zh || '');
    renderChart(A, B, d.bench || {});
    renderModel('apModelA', 'MODEL A', A);
    renderModel('apModelB', 'MODEL B', B);
  }

  window.addEventListener('afflatus-lang', (e) => { state.lang = e.detail === 'zh' ? 'zh' : 'en'; render(); });
})();
