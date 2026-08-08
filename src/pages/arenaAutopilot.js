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
import { fetchJson } from '../lib/fetchJson.js';
import { buildProvenanceBadge } from '../lib/provenanceBadge.js';
import { declutter1D } from '../lib/ladderLayout.js';
import { escapeHtml } from '../lib/contentSafety.js';
import { ARENA_PUBLICATION_MINUTES, assessMarketSnapshot } from '../lib/marketFreshness.js';

(() => {
  'use strict';
  const host = document.getElementById('apDash');
  if (!host) return;

  const $ = (id) => document.getElementById(id);

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
  fetchJson('arena-universe')
    .then((d) => { for (const s of d.symbols || []) state.names[s.sym] = s.name; })
    .catch(() => {});

  fetchJson('arena-ledger')
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
      rows.map(escapeHtml).join('<br>') + `<br>SPY: ${escapeHtml(fmtUsd(interpTwoPoint(spy, day)))}<br>SMH: ${escapeHtml(fmtUsd(interpTwoPoint(smh, day)))}`;
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
      const { modelSeries, spy, smh, domain, viewW, plotW, pad } = chartCtx;
      const rect = svg.getBoundingClientRect();
      if (!rect.width) return;
      // viewW (full viewBox, includes the end-label margin) converts the
      // mouse pixel to local SVG units; plotW (data area only) is what the
      // day fraction is actually measured against -- these differ now that
      // the chart reserves a right-hand strip for end-of-line value chips.
      const localX = (ev.clientX - rect.left) * (viewW / rect.width);
      const dayRange = domain.maxDay - domain.minDay || 1;
      const day = domain.minDay + Math.min(1, Math.max(0, (localX - pad) / (plotW - pad * 2))) * dayRange;
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
    // Design per the "Arena Autopilot Chart Fix" mockup (2026-07-24): calmer
    // than the previous glowing-pill iteration -- thinner lines, plain
    // (no box/no glow) end-value text at a lighter weight, a dashed
    // baseline at everyone's common starting equity, and a range readout
    // (max/min $ top-left, day span bottom) so the plot is legible without
    // hovering. PLOT_W/H is the data area; LABEL_MARGIN (right) fits the
    // end-of-line values, BOTTOM_MARGIN fits the day-range caption.
    // W/TOTAL_H below MUST match arena.css's `.ap-chart{aspect-ratio:...}`
    // and arena.html's static <svg viewBox> (the pre-first-render fallback)
    // -- otherwise the box the chart renders into is a different shape
    // than its own coordinate system and preserveAspectRatio has to
    // non-uniformly stretch the content to fill it (the flattened/
    // distorted look reported 2026-07-24).
    const PLOT_W = 600, H = 240, pad = 30, LABEL_MARGIN = 90, BOTTOM_MARGIN = 24;
    const W = PLOT_W + LABEL_MARGIN, TOTAL_H = H + BOTTOM_MARGIN;
    const keys = Object.keys(models);
    const first = models[keys[0]];
    const spy = benchmarkEndpoints(first.equityHistory, first.startEquity, bench.spyPct);
    const smh = benchmarkEndpoints(first.equityHistory, first.startEquity, bench.smhPct);
    const modelSeries = keys.map((k) => ({ key: k, series: models[k].equityHistory }));
    const domain = equityDomain([...modelSeries.map((m) => m.series), spy, smh]);

    // four evenly-spaced gridlines for rhythm, no text (the $ range now
    // lives in the top-left/bottom-left readout instead).
    let grid = '';
    for (let i = 0; i <= 3; i++) {
      const y = pad + (i / 3) * (H - pad * 2);
      grid += `<line x1="${pad}" y1="${y.toFixed(1)}" x2="${PLOT_W - pad}" y2="${y.toFixed(1)}" class="ap-grid"/>`;
    }
    // dashed baseline at the shared starting equity -- an at-a-glance
    // "above/below where everyone began" reference the old chart lacked.
    const baselineY = scalePoint({ day: domain.minDay, equity: first.startEquity }, domain, PLOT_W, H, pad).y;
    const baseline = `<line x1="${pad}" y1="${baselineY.toFixed(1)}" x2="${PLOT_W - pad}" y2="${baselineY.toFixed(1)}" class="ap-baseline"/>`;

    // SMH used to share T·ATLAS's magenta -- five series need five
    // distinguishable colors, so the benchmark pair now takes the two
    // palette hues no model uses: gold for SPY, blue for SMH.
    const SPY_COLOR = '#ffd166', SMH_COLOR = 'var(--blue)';
    let s = grid + baseline;
    s += `<g class="ap-line-spy">${buildPath(spy, domain, PLOT_W, H, pad, SPY_COLOR)}</g>`;
    s += `<g class="ap-line-smh">${buildPath(smh, domain, PLOT_W, H, pad, SMH_COLOR)}</g>`;
    modelSeries.forEach(({ key, series }, i) => {
      s += `<g class="ap-line-model">${buildPath(series, domain, PLOT_W, H, pad, colorFor(key, i))}</g>`;
    });

    // top-left / bottom-left range readout ($ max/min) + bottom day-span
    // caption -- lets the plot be read at a glance without hovering.
    s += `<text x="${pad + 2}" y="${(pad - 8).toFixed(1)}" class="ap-axis-range">${fmtUsd(domain.maxEq)}</text>`;
    s += `<text x="${pad + 2}" y="${(H - pad + 14).toFixed(1)}" class="ap-axis-range">${fmtUsd(domain.minEq)}</text>`;
    s += `<text x="${pad}" y="${(H + 16).toFixed(1)}" class="ap-day-range">${T('DAY', '第')} ${domain.minDay}${state.lang === 'zh' ? '日' : ''}</text>`;
    s += `<text x="${PLOT_W - pad}" y="${(H + 16).toFixed(1)}" text-anchor="end" class="ap-day-range">${T('DAY', '第')} ${domain.maxDay}${state.lang === 'zh' ? '日' : ''}</text>`;

    // end-of-line readouts: one plain value per model + SPY/SMH, at their
    // true final Y position, decluttered (same 1D declutter the TA Level
    // Ladder uses) so converged values -- e.g. day 1, everyone still near
    // $10,000 -- never overlap. A short leader connects a nudged label
    // back to its true line-end when they diverge.
    const endItems = [
      ...modelSeries.map(({ key, series }, i) => ({ color: colorFor(key, i), pt: series[series.length - 1] })),
      { color: SPY_COLOR, pt: spy[spy.length - 1] },
      { color: SMH_COLOR, pt: smh[smh.length - 1] },
    ].filter((it) => it.pt);
    const trueYs = endItems.map((it) => scalePoint(it.pt, domain, PLOT_W, H, pad).y);
    const labelYs = declutter1D(trueYs, { minGap: 14 });
    let endLabelsHtml = '';
    endItems.forEach((it, i) => {
      const trueY = trueYs[i], labelY = labelYs[i];
      const lineX = PLOT_W - pad + 2;
      const chipX = PLOT_W - pad + 10;
      let g = `<g class="ap-end-chip" style="color:${it.color}">`;
      if (Math.abs(labelY - trueY) > 2) {
        g += `<line x1="${lineX.toFixed(1)}" y1="${trueY.toFixed(1)}" x2="${lineX.toFixed(1)}" y2="${labelY.toFixed(1)}" class="ap-end-leader"/>`;
      }
      g += `<circle cx="${(PLOT_W - pad).toFixed(1)}" cy="${trueY.toFixed(1)}" r="2.4" class="ap-end-chip-dot"/>`;
      g += `<text x="${chipX.toFixed(1)}" y="${(labelY + 3.4).toFixed(1)}" class="ap-end-chip-text">${fmtUsd(it.pt.equity)}</text>`;
      g += '</g>';
      endLabelsHtml += g;
    });
    s += endLabelsHtml;

    $('apChart').setAttribute('viewBox', `0 0 ${W} ${TOTAL_H}`);
    $('apChart').innerHTML = s;
    const finalValues = [
      ...modelSeries.map(({ key, series }) => ({ label: labelFor(key), point: series[series.length - 1] })),
      { label: 'SPY', point: spy[spy.length - 1] },
      { label: 'SMH', point: smh[smh.length - 1] },
    ].filter(({ point }) => point);
    $('apChartSummary').textContent = T(
      `Equity curves from day ${domain.minDay} to ${domain.maxDay}. Final values: ${finalValues.map(({ label, point }) => `${label} ${fmtUsd(point.equity)}`).join('; ')}.`,
      `净值曲线覆盖第 ${domain.minDay} 日至第 ${domain.maxDay} 日。期末净值：${finalValues.map(({ label, point }) => `${label} ${fmtUsd(point.equity)}`).join('；')}。`,
    );
    $('apLegend').innerHTML = [
      ...keys.map((k, i) => [colorFor(k, i), labelFor(k), false]),
      [SPY_COLOR, 'SPY', true],
      [SMH_COLOR, 'SMH', true],
    ].map(([color, label, dash]) => `<span><i style="border-top-color:${color}${dash ? ';border-top-style:dashed' : ''}"></i>${escapeHtml(label)}</span>`).join('');
    chartCtx = { modelSeries, spy, smh, domain, viewW: W, plotW: PLOT_W, pad };
    bindChartTooltip();
  }

  // ---- per-model card -----------------------------------------------
  function metricChip(label, value) { return `<div class="ap-metric"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`; }
  function positionRow(p) {
    const { pnl, pnlPct } = unrealizedPnl(p);
    const name = state.names[p.sym] ? ` <span style="color:var(--muted)">${escapeHtml(state.names[p.sym])}</span>` : '';
    return `<tr><td>${escapeHtml(p.sym)}${name}</td><td>${fmtNum(p.qty, 0)}</td><td>${fmtUsd(p.avgPx)}</td><td>${fmtUsd(p.mkPx)}</td><td class="${pnl >= 0 ? 'up' : 'down'}">${fmtPct(pnlPct)}</td></tr>`;
  }
  function logRow(entry) {
    if (entry.kind === 'trade') { const t = entry.data; const side = t.side === 'buy' ? 'buy' : 'sell'; return `<div class="ap-log-row ${side}"><span>${escapeHtml(side.toUpperCase())} ${escapeHtml(t.sym)} × ${fmtNum(t.qty, 0)} @ ${fmtUsd(t.px)}</span><span>${t.realizedPnl != null ? fmtUsd(t.realizedPnl) : ''}</span></div>`; }
    const o = entry.data.order || {}; return `<div class="ap-log-row rej"><span>✗ ${escapeHtml((o.side || '?').toUpperCase())} ${escapeHtml(o.sym || '?')}</span><span>${escapeHtml(entry.data.reason || '')}</span></div>`;
  }
  function renderModel(modelHost, key, label, m) {
    const metrics = m.metrics || {};
    const exposure = Math.max(0, Math.min(100, Number(metrics.exposure) || 0));
    const cashRatio = Number(m.equity) > 0 ? Math.max(0, Math.min(100, Number(m.cash) / Number(m.equity) * 100)) : 0;
    const cumPct = Number(metrics.cumPct) || 0;
    const positionCount = (m.positions || []).length;
    const status = positionCount
      ? T(`${positionCount} OPEN POSITION${positionCount === 1 ? '' : 'S'}`, `${positionCount} 个持仓`)
      : T('CASH / NO OPEN RISK', '现金待命 / 无开放风险');
    const chips = [
      metricChip(T('EQUITY', '净值'), fmtUsd(m.equity)),
      metricChip(T('CUMULATIVE', '累计收益'), fmtPct(metrics.cumPct)),
      metricChip(T('MAX DRAWDOWN', '最大回撤'), fmtPct(metrics.maxDD)),
      metricChip(T('HIT RATE', '胜率'), metrics.hitRate == null ? '—' : metrics.hitRate.toFixed(1) + '%'),
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
    modelHost.innerHTML = `
      <section class="ap-book-summary">
        <div class="ap-book-id"><span>${escapeHtml(key)}</span><div><small>${T('SIMULATED MODEL', '模拟模型')}</small><h3>${escapeHtml(label)}</h3></div></div>
        <div class="ap-book-equity ${cumPct >= 0 ? 'up' : 'down'}"><small>${T('MARKED EQUITY', '已估值净值')}</small><strong>${fmtUsd(m.equity)}</strong><b>${fmtPct(metrics.cumPct)}</b></div>
        <div class="ap-book-status"><i></i>${escapeHtml(status)}<em>${escapeHtml(m.promptVersion || '')}</em></div>
        <div class="ap-risk-rail">
          <div><span>${T('MARKET EXPOSURE', '市场敞口')}</span><b>${fmtNum(exposure, 1)}%</b></div>
          <i style="--risk:${exposure}%"><span></span></i>
          <div class="ap-risk-cash"><span>${T('CASH RESERVE', '现金储备')}</span><b>${fmtNum(cashRatio, 1)}% · ${fmtUsd(m.cash)}</b></div>
        </div>
        ${review ? `<p class="ap-review"><b>${T('LATEST REVIEW', '最新复盘')}</b>${escapeHtml(review)}</p>` : ''}
      </section>
      <section class="ap-book-core">
        <div class="ap-metrics">${chips}</div>
        <div class="ap-book-pane-head"><b>${T('OPEN POSITIONS', '当前持仓')}</b><span>${positionCount} ${T('NAMES', '个标的')}</span></div>
        <div class="ap-position-scroll">${posBlock}</div>
      </section>
      <section class="ap-book-activity">
        <div class="ap-book-pane-head"><b>${T('EXECUTION TAPE', '执行记录')}</b><span>${Math.min(log.length, 8)} / 8</span></div>
        ${logBlock}
      </section>
    `;
  }
  function renderModels(models) {
    const container = $('apModels');
    const keys = Object.keys(models);
    container.replaceChildren();
    keys.forEach((key, index) => {
      const modelHost = document.createElement('div');
      modelHost.className = 'ap-model panel';
      modelHost.style.setProperty('--model-accent', colorFor(key, index));
      container.appendChild(modelHost);
      renderModel(modelHost, key, labelFor(key), models[key]);
    });
  }

  function render() {
    const d = state.ledger; if (!d) return;
    $('apDayChip').textContent = T(`DAY ${d.day} · SEASON ${d.season}`, `第 ${d.day} 日 · 赛季 ${d.season}`);
    const badge = buildProvenanceBadge({ updatedAt: d.updated, version: d.version, lang: state.lang });
    $('apUpdChip').className = 'chip prov-badge prov-' + badge.tier;
    $('apUpdChip').textContent = badge.text;
    const freshness = assessMarketSnapshot(d.updated, new Date(), { availableFromMinutes: ARENA_PUBLICATION_MINUTES.postMarket });
    host.classList.toggle('ap-stale', freshness.stale);
    $('apNote').textContent = freshness.stale
      ? T(
        `Historical simulation ledger · last settled ${d.updated || 'unknown'}. Automation is delayed; no current-session execution is implied.`,
        `历史模拟账本 · 最后结算于 ${d.updated || '日期不明'}。自动任务当前延迟；不代表当前交易时段仍在执行。`,
      )
      : T(d.note_en || '', d.note_zh || '');
    renderChart(d.models, d.bench || {});
    renderModels(d.models);
  }

  window.addEventListener('afflatus-lang', (e) => { state.lang = e.detail === 'zh' ? 'zh' : 'en'; render(); });
})();
