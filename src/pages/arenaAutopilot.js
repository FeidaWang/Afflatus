/* ============================================================
   ARENA · AUTOPILOT DASHBOARD (V6, Part 4 §18.2.3 — generalized to N models)

   Renders however many simulated LLM ledgers are present in
   public/arena-ledger.json — Season 1 shipped exactly two (Model A/B);
   Season 2 (urgent.md Part 4) ships three (S: ORACLE, P: PULSE, T: ATLAS).
   This file no longer assumes a fixed count or fixed DOM ids: it reads
   Object.keys(ledger.models) and builds the chart legend, equity-curve
   lines, and per-model cards from that list, so a future season with a
   different roster needs no changes here. #apModels (arena.html) starts
   empty and is populated per-render.

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

  // Known model codenames get a fixed color + label; an unrecognized future
  // key still renders correctly via the fallback palette/generic label
  // rather than crashing or silently dropping a model.
  const MODEL_COLOR = { A: 'var(--acid)', B: 'var(--cyan)', S: 'var(--acid)', P: 'var(--cyan)', T: 'var(--magenta)' };
  const MODEL_LABEL = { A: 'MODEL A', B: 'MODEL B', S: 'S · ORACLE', P: 'P · PULSE', T: 'T · ATLAS' };
  const FALLBACK_COLORS = ['var(--acid)', 'var(--cyan)', 'var(--magenta)', 'var(--blue)'];
  const colorFor = (key, i) => MODEL_COLOR[key] || FALLBACK_COLORS[i % FALLBACK_COLORS.length];
  const labelFor = (key) => MODEL_LABEL[key] || `MODEL ${key}`;

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
    $('apModels').innerHTML = `<div class="ap-model panel pad"><div class="empty">${T('No data.', '暂无数据。')}</div></div>`;
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
  function showChartTip(clientX, clientY, day, modelSeries, spy, smh) {
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'viz-tip'; document.body.appendChild(tipEl); }
    const rows = modelSeries.map(({ key, series }) => {
      const pt = nearestByDay(series, day);
      return `${labelFor(key)}: ${fmtUsd(pt ? pt.equity : null)}`;
    });
    tipEl.innerHTML = `<b>${T('DAY', '第')} ${modelSeries[0] && nearestByDay(modelSeries[0].series, day) ? nearestByDay(modelSeries[0].series, day).day : '—'}${state.lang === 'zh' ? '日' : ''}</b>` +
      rows.join('<br>') + `<br>SPY: ${fmtUsd(interpTwoPoint(spy, day))}<br>SMH: ${fmtUsd(interpTwoPoint(smh, day))}`;
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
      const { modelSeries, spy, smh, domain, W, pad } = chartCtx;
      const rect = svg.getBoundingClientRect();
      if (!rect.width) return;
      const localX = (ev.clientX - rect.left) * (W / rect.width);
      const dayRange = domain.maxDay - domain.minDay || 1;
      const day = domain.minDay + Math.min(1, Math.max(0, (localX - pad) / (W - pad * 2))) * dayRange;
      showChartTip(ev.clientX, ev.clientY, day, modelSeries, spy, smh);
    });
    svg.addEventListener('pointerleave', hideChartTip);
  }
  function buildPath(series, domain, w, h, pad, color) {
    if (!series.length) return '';
    if (series.length === 1) { const p = scalePoint(series[0], domain, w, h, pad); return `<circle class="ap-dot" cx="${p.x}" cy="${p.y}" r="3.4" fill="${color}"/>`; }
    const pts = series.map((pt) => scalePoint(pt, domain, w, h, pad));
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
    const end = pts[pts.length - 1];
    return `<path class="ap-line" style="stroke:${color}" d="${d}"/><circle class="ap-end-dot" cx="${end.x}" cy="${end.y}" r="3" fill="${color}"/>`;
  }
  function renderChart(models, bench) {
    const W = 600, H = 240, pad = 30;
    const keys = Object.keys(models);
    const first = models[keys[0]];
    const spy = benchmarkEndpoints(first.equityHistory, first.startEquity, bench.spyPct);
    const smh = benchmarkEndpoints(first.equityHistory, first.startEquity, bench.smhPct);
    const modelSeries = keys.map((k) => ({ key: k, series: models[k].equityHistory }));
    const domain = equityDomain([...modelSeries.map((m) => m.series), spy, smh]);
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
    s += `<g class="ap-line-spy">${buildPath(spy, domain, W, H, pad, '#ffd166')}</g>`;
    s += `<g class="ap-line-smh">${buildPath(smh, domain, W, H, pad, 'var(--magenta)')}</g>`;
    modelSeries.forEach(({ key, series }, i) => {
      s += `<g class="ap-line-model">${buildPath(series, domain, W, H, pad, colorFor(key, i))}</g>`;
    });
    s += labels;
    $('apChart').setAttribute('viewBox', `0 0 ${W} ${H}`);
    $('apChart').innerHTML = s;
    $('apLegend').innerHTML = [
      ...keys.map((k, i) => [colorFor(k, i), labelFor(k), false]),
      ['#ffd166', 'SPY', true],
      ['var(--magenta)', 'SMH', true],
    ].map(([color, label, dash]) => `<span><i style="border-top-color:${color}${dash ? ';border-top-style:dashed' : ''}"></i>${label}</span>`).join('');
    chartCtx = { modelSeries, spy, smh, domain, W, pad };
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
    const review = m.review && (m.review.en || m.review.zh) ? T(m.review.en, m.review.zh) : '';
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
  function renderModels(models) {
    const container = $('apModels');
    const keys = Object.keys(models);
    container.innerHTML = keys.map((k) => `<div class="ap-model panel pad" id="apModel${k}"></div>`).join('');
    keys.forEach((k) => renderModel(`apModel${k}`, labelFor(k), models[k]));
  }

  function render() {
    const d = state.ledger; if (!d) return;
    $('apDayChip').textContent = T(`DAY ${d.day} · SEASON ${d.season}`, `第 ${d.day} 日 · 赛季 ${d.season}`);
    const badge = buildProvenanceBadge({ updatedAt: d.updated, version: d.version, lang: state.lang });
    $('apUpdChip').className = 'chip prov-badge prov-' + badge.tier;
    $('apUpdChip').textContent = badge.text;
    $('apNote').textContent = T(d.note_en || '', d.note_zh || '');
    renderChart(d.models, d.bench || {});
    renderModels(d.models);
  }

  window.addEventListener('afflatus-lang', (e) => { state.lang = e.detail === 'zh' ? 'zh' : 'en'; render(); });
})();
