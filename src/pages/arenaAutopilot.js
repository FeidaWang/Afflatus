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
import { buildProvenanceBadge } from '../lib/provenanceBadge.js';

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
  let chartCtx = null, tipEl = null, tipBound = false;
  function nearestByDay(series, day) {
    if (!series || !series.length) return null;
    let best = series[0], bestDist = Math.abs(series[0].day - day);
    for (const pt of series) { const dist = Math.abs(pt.day - day); if (dist < bestDist) { best = pt; bestDist = dist; } }
    return best;
  }
  function interpTwoPoint(series, day) {
    if (!series || !series.length) return null;
    if (series.length === 1) return series[0].equity;
    const [p0, p1] = series;
    if (p1.day === p0.day) return p0.equity;
    const k = Math.min(1, Math.max(0, (day - p0.day) / (p1.day - p0.day)));
    return p0.equity + (p1.equity - p0.equity) * k;
  }
  function showChartTip(clientX, clientY, day, A, B, spy, smh) {
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'viz-tip'; document.body.appendChild(tipEl); }
    const a = nearestByDay(A, day), b = nearestByDay(B, day);
    tipEl.innerHTML = `<b>${T('DAY', '第')} ${a ? a.day : '—'}${state.lang === 'zh' ? '日' : ''}</b>` +
      `Model A: ${fmtUsd(a ? a.equity : null)}<br>Model B: ${fmtUsd(b ? b.equity : null)}<br>` +
      `SPY: ${fmtUsd(interpTwoPoint(spy, day))}<br>SMH: ${fmtUsd(interpTwoPoint(smh, day))}`;
    tipEl.style.left = (clientX + 14) + 'px';
    tipEl.style.top = (clientY + 14) + 'px';
    tipEl.classList.add('show');
  }
  function hideChartTip() { if (tipEl) tipEl.classList.remove('show'); }
  function bindChartTooltip() {
    if (tipBound) return;
    tipBound = true;
    const svg = $('apChart');
    svg.addEventListener('pointermove', (ev) => {
      if (!chartCtx) return;
      const { A, B, spy, smh, domain, W, pad } = chartCtx;
      const rect = svg.getBoundingClientRect();
      if (!rect.width) return;
      const localX = (ev.clientX - rect.left) * (W / rect.width);
      const dayRange = domain.maxDay - domain.minDay || 1;
      const day = domain.minDay + Math.min(1, Math.max(0, (localX - pad) / (W - pad * 2))) * dayRange;
      showChartTip(ev.clientX, ev.clientY, day, A.equityHistory, B.equityHistory, spy, smh);
    });
    svg.addEventListener('pointerleave', hideChartTip);
  }
  function buildPath(series, domain, w, h, pad) {
    if (!series.length) return '';
    if (series.length === 1) { const p = scalePoint(series[0], domain, w, h, pad); return `<circle class="ap-dot" cx="${p.x}" cy="${p.y}" r="3.4" fill="currentColor"/>`; }
    const pts = series.map((pt) => scalePoint(pt, domain, w, h, pad));
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
    const end = pts[pts.length - 1];
    return `<path class="ap-line" d="${d}"/><circle class="ap-end-dot" cx="${end.x}" cy="${end.y}" r="3" fill="currentColor"/>`;
  }
  function renderChart(A, B, bench) {
    const W = 600, H = 240, pad = 30;
    const spy = benchmarkEndpoints(A.equityHistory, A.startEquity, bench.spyPct);
    const smh = benchmarkEndpoints(B.equityHistory, B.startEquity, bench.smhPct);
    const domain = equityDomain([A.equityHistory, B.equityHistory, spy, smh]);
    // horizontal gridlines (behind the data) + $ labels (drawn last, on top,
    // on an opaque backing plate — text alone has gaps between glyphs that a
    // dashed benchmark line crossing the same row would otherwise show through)
    let grid = '', labels = '';
    for (let i = 0; i <= 3; i++) {
      const y = pad + (i / 3) * (H - pad * 2);
      const price = domain.maxEq - (i / 3) * (domain.maxEq - domain.minEq);
      const txt = fmtUsd(price);
      const tw = txt.length * 5.6 + 6;
      if (i === 0 || i === 3) grid += `<line x1="${pad}" y1="${y.toFixed(1)}" x2="${W - pad}" y2="${y.toFixed(1)}" class="ap-grid"/>`;
      labels += `<rect x="${(W - 4 - tw).toFixed(1)}" y="${(y - 6.5).toFixed(1)}" width="${tw.toFixed(1)}" height="13" class="ap-axis-bg"/><text x="${W - 4}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" class="ap-axis">${txt}</text>`;
    }
    let s = grid;
    s += `<g class="ap-line-spy">${buildPath(spy, domain, W, H, pad)}</g>`;
    s += `<g class="ap-line-smh">${buildPath(smh, domain, W, H, pad)}</g>`;
    s += `<g class="ap-line-b">${buildPath(B.equityHistory, domain, W, H, pad)}</g>`;
    s += `<g class="ap-line-a">${buildPath(A.equityHistory, domain, W, H, pad)}</g>`;
    s += labels;
    $('apChart').setAttribute('viewBox', `0 0 ${W} ${H}`);
    $('apChart').innerHTML = s;
    $('apLegend').innerHTML = [
      ['ap-line-a', T('Model A', 'Model A')],
      ['ap-line-b', T('Model B', 'Model B')],
      ['ap-line-spy dash', 'SPY'],
      ['ap-line-smh dash', 'SMH'],
    ].map(([cls, label]) => `<span><i class="${cls}"></i>${label}</span>`).join('');
    chartCtx = { A, B, spy, smh, domain, W, pad };
    bindChartTooltip();
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
    const badge = buildProvenanceBadge({ updatedAt: d.updated, version: d.version, lang: state.lang });
    $('apUpdChip').className = 'chip prov-badge prov-' + badge.tier;
    $('apUpdChip').textContent = badge.text;
    $('apNote').textContent = T(d.note_en || '', d.note_zh || '');
    renderChart(A, B, d.bench || {});
    renderModel('apModelA', 'MODEL A', A);
    renderModel('apModelB', 'MODEL B', B);
  }

  window.addEventListener('afflatus-lang', (e) => { state.lang = e.detail === 'zh' ? 'zh' : 'en'; render(); });
})();
