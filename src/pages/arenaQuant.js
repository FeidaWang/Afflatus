import { fetchJson, JsonDataError } from '../lib/fetchJson.js';
import { orderedHistorySymbols, runQuantExperiment } from '../lib/arenaQuantModel.js';

(() => {
  'use strict';
  const host = document.getElementById('quantFoundry');
  if (!host) return;

  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = 'afflatus:qf01:runs:v1';
  const state = {
    lang: (window.AfflatusI18N?.get?.() || 'en') === 'zh' ? 'zh' : 'en',
    base: null,
    config: null,
    result: null,
    histories: null,
    running: false,
    chartObserver: null,
  };
  const T = (en, zh) => (state.lang === 'zh' ? zh : en);
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const pct = (value, digits = 1) => Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : '—';
  const num = (value, digits = 2) => Number.isFinite(value) ? value.toFixed(digits) : '—';
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);

  function readRuns() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value.slice(0, 8) : [];
    } catch { return []; }
  }

  function writeRuns(runs) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(runs.slice(0, 8))); } catch {}
  }

  function controlConfig() {
    const config = clone(state.base);
    config.weights = {
      momentum: Number($('qmMomentum').value) / 100,
      trend: Number($('qmTrend').value) / 100,
      resilience: Number($('qmResilience').value) / 100,
      lowVol: Number($('qmLowVol').value) / 100,
    };
    config.settings = {
      ...config.settings,
      maxNames: Number($('qmMaxNames').value),
      maxWeight: Number($('qmMaxWeight').value) / 100,
      sectorCap: Number($('qmSectorCap').value) / 100,
      rebalanceDays: Number($('qmRebalance').value),
    };
    return config;
  }

  function syncControlReadouts() {
    ['Momentum', 'Trend', 'Resilience', 'LowVol', 'MaxNames', 'MaxWeight', 'SectorCap'].forEach((name) => {
      const input = $(`qm${name}`);
      const output = $(`qm${name}Value`);
      if (!input || !output) return;
      const suffix = ['Momentum', 'Trend', 'Resilience', 'LowVol', 'MaxWeight', 'SectorCap'].includes(name) ? '%' : '';
      output.textContent = `${input.value}${suffix}`;
    });
  }

  function setControls(config) {
    const weights = config.weights || {};
    const settings = config.settings || {};
    $('qmMomentum').value = Math.round((weights.momentum ?? 0.38) * 100);
    $('qmTrend').value = Math.round((weights.trend ?? 0.27) * 100);
    $('qmResilience').value = Math.round((weights.resilience ?? 0.2) * 100);
    $('qmLowVol').value = Math.round((weights.lowVol ?? 0.15) * 100);
    $('qmMaxNames').value = settings.maxNames ?? 6;
    $('qmMaxWeight').value = Math.round((settings.maxWeight ?? 0.24) * 100);
    $('qmSectorCap').value = Math.round((settings.sectorCap ?? 0.38) * 100);
    $('qmRebalance').value = settings.rebalanceDays ?? 20;
    syncControlReadouts();
  }

  function renderUniverse() {
    if (!state.base) return;
    $('qmUniverse').innerHTML = state.base.universe.map((asset) => (
      `<span><b>${escapeHtml(asset.sym)}</b><small>${escapeHtml(asset.sector)}</small></span>`
    )).join('');
    $('qmVersion').textContent = `${state.base.id} · v${state.base.version}`;
    $('qmAsOf').textContent = state.base.updated;
    $('qmCommit').textContent = state.base.provenance?.commit || '—';
  }

  function renderRuns() {
    const runs = readRuns();
    $('qmRunCount').textContent = String(runs.length).padStart(2, '0');
    $('qmIterations').innerHTML = runs.length ? runs.map((run) => `
      <li>
        <span>${escapeHtml(run.id)}</span>
        <b>${escapeHtml((run.top || []).join(' · ') || '—')}</b>
        <em>${pct(run.metrics?.totalReturn)} / ${pct(run.metrics?.maxDrawdown)}</em>
      </li>`).join('') : `<li class="qm-no-run">${T('No local variants yet. A successful compile creates R001.', '尚无本地变体。首次成功编译将创建 R001。')}</li>`;
  }

  function setStatus(kind, en, zh) {
    const status = $('qmStatus');
    status.dataset.kind = kind;
    status.textContent = T(en, zh);
  }

  function renderMetrics() {
    const { model, backtest } = state.result;
    const metrics = backtest.metrics;
    const rows = [
      [T('test-window return', '测试窗口收益'), pct(metrics.totalReturn)],
      [T('annualized / window', '窗口年化'), pct(metrics.annualized)],
      [T('annualized vol', '年化波动'), pct(metrics.annualVolatility)],
      ['Sharpe · rf 0%', num(metrics.sharpe)],
      [T('max drawdown', '最大回撤'), pct(metrics.maxDrawdown)],
      [T('average turnover', '平均换手'), pct(metrics.averageTurnover)],
      [`${state.base.benchmark} ${T('same window', '同期')}`, pct(backtest.benchmarkReturn)],
      [T('observations', '样本日'), String(metrics.observations)],
    ];
    $('qmMetrics').innerHTML = rows.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`).join('');
    $('qmRegime').textContent = model.regime.id.toUpperCase();
    $('qmGross').textContent = pct(model.invested, 0);
    $('qmBeta').textContent = num(model.portfolioBeta);
    $('qmWindow').textContent = `${backtest.firstSession} → ${backtest.lastSession}`;
  }

  function renderAllocations() {
    const { model } = state.result;
    $('qmAllocations').innerHTML = model.positions.map((position, index) => `
      <tr>
        <td><span>${String(index + 1).padStart(2, '0')}</span><b>${escapeHtml(position.sym)}</b><small>${escapeHtml(position.sector)}</small></td>
        <td>${num(position.score)}</td>
        <td>${pct(position.momentum)}</td>
        <td>${pct(position.volatility)}</td>
        <td>${num(position.beta)}</td>
        <td><div class="qm-weight"><i style="--w:${Math.max(0, Math.min(100, position.weight * 100))}%"></i><b>${pct(position.weight)}</b></div></td>
      </tr>`).join('') + `
      <tr class="qm-cash-row"><td><span>—</span><b>CASH</b><small>${T('regime reserve', '状态储备')}</small></td><td>—</td><td>—</td><td>—</td><td>—</td><td><div class="qm-weight"><i style="--w:${model.cash * 100}%"></i><b>${pct(model.cash)}</b></div></td></tr>`;
  }

  function factorCell(value) {
    const width = Math.min(100, Math.abs(value) / 3 * 100);
    const direction = value >= 0 ? 'positive' : 'negative';
    return `<div class="qm-factor ${direction}"><i style="--f:${width}%"></i><span>${value >= 0 ? '+' : ''}${num(value)}</span></div>`;
  }

  function renderFactors() {
    $('qmFactors').innerHTML = state.result.model.factorRows.map((row) => `
      <tr>
        <td><b>${escapeHtml(row.sym)}</b></td>
        <td>${factorCell(row.factors.momentum)}</td>
        <td>${factorCell(row.factors.trend)}</td>
        <td>${factorCell(row.factors.resilience)}</td>
        <td>${factorCell(row.factors.lowVol)}</td>
        <td><b>${num(row.score)}</b></td>
      </tr>`).join('');
  }

  function drawChart() {
    const canvas = $('qmChart');
    const curve = state.result?.backtest?.curve || [];
    if (!canvas || !curve.length) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, rect.width);
    const height = Math.max(220, rect.height || 260);
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const context = canvas.getContext('2d');
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    const padding = { left: 50, right: 18, top: 22, bottom: 30 };
    const values = curve.flatMap((point) => [point.portfolio, point.benchmark]);
    let min = Math.min(...values);
    let max = Math.max(...values);
    const spread = Math.max(0.04, max - min);
    min -= spread * 0.12;
    max += spread * 0.12;
    const x = (index) => padding.left + (index / Math.max(1, curve.length - 1)) * (width - padding.left - padding.right);
    const y = (value) => padding.top + ((max - value) / (max - min)) * (height - padding.top - padding.bottom);
    const styles = getComputedStyle(host);
    context.font = '10px JetBrains Mono, monospace';
    context.textAlign = 'right';
    context.textBaseline = 'middle';
    for (let line = 0; line <= 4; line += 1) {
      const value = min + ((max - min) * line / 4);
      const yy = y(value);
      context.strokeStyle = 'rgba(133,144,181,.16)';
      context.lineWidth = 1;
      context.beginPath(); context.moveTo(padding.left, yy); context.lineTo(width - padding.right, yy); context.stroke();
      context.fillStyle = styles.getPropertyValue('--muted').trim() || '#8590b5';
      context.fillText(pct(value - 1, 0), padding.left - 8, yy);
    }
    const plot = (key, color, dash = []) => {
      context.strokeStyle = color;
      context.lineWidth = key === 'portfolio' ? 2 : 1.35;
      context.setLineDash(dash);
      context.beginPath();
      curve.forEach((point, index) => {
        if (index === 0) context.moveTo(x(index), y(point[key]));
        else context.lineTo(x(index), y(point[key]));
      });
      context.stroke();
      context.setLineDash([]);
    };
    plot('benchmark', '#7283a8', [5, 5]);
    plot('portfolio', styles.getPropertyValue('--acid').trim() || '#3dff9a');
    context.fillStyle = styles.getPropertyValue('--muted').trim() || '#8590b5';
    context.textAlign = 'left';
    context.fillText(curve[0].t, padding.left, height - 12);
    context.textAlign = 'right';
    context.fillText(curve.at(-1).t, width - padding.right, height - 12);
  }

  function saveIteration() {
    const runs = readRuns();
    const record = {
      id: `R${String((runs[0]?.sequence || 0) + 1).padStart(3, '0')}`,
      sequence: (runs[0]?.sequence || 0) + 1,
      at: new Date().toISOString(),
      version: state.config.version,
      weights: state.config.weights,
      settings: state.config.settings,
      metrics: state.result.backtest.metrics,
      top: state.result.model.positions.slice(0, 4).map((position) => position.sym),
    };
    writeRuns([record, ...runs]);
    renderRuns();
    return record;
  }

  function renderResult() {
    renderMetrics();
    renderAllocations();
    renderFactors();
    $('qmResult').hidden = false;
    $('qmEmpty').hidden = true;
    $('qmExport').disabled = false;
    drawChart();
    state.chartObserver?.disconnect();
    state.chartObserver = new ResizeObserver(() => drawChart());
    state.chartObserver.observe($('qmChartWrap'));
  }

  async function mapLimit(items, limit, worker) {
    const results = new Array(items.length);
    let cursor = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await worker(items[index], index);
      }
    });
    await Promise.all(runners);
    return results;
  }

  async function loadHistories(config) {
    // The benchmark is the one non-negotiable input. Request it first so a
    // provider credit/rate boundary can degrade the asset set instead of
    // halting the entire model after successfully loading several stocks.
    const symbols = orderedHistorySymbols(config);
    const histories = {};
    const failures = [];
    await mapLimit(symbols, 4, async (symbol, index) => {
      setStatus('loading',
        `DATA CONTEXT · ${index + 1}/${symbols.length} · ${symbol}`,
        `数据上下文 · ${index + 1}/${symbols.length} · ${symbol}`);
      try {
        const payload = await fetchJson(`history:${symbol}:1day:250`, { forceRefresh: true });
        histories[symbol] = payload.values
          .map((value) => ({
            t: String(value.datetime).slice(0, 10),
            o: Number(value.open), h: Number(value.high), l: Number(value.low),
            c: Number(value.close), v: Number(value.volume) || 0,
          }))
          .filter((candle) => Number.isFinite(candle.c) && candle.c > 0)
          .reverse();
      } catch (error) { failures.push({ symbol, error }); }
    });
    if (!histories[config.benchmark]) throw failures.find((failure) => failure.symbol === config.benchmark)?.error || new Error('Benchmark unavailable');
    const available = config.universe.filter((asset) => (histories[asset.sym] || []).length >= config.minimumHistory);
    if (available.length < 2) throw failures[0]?.error || new Error('Insufficient model histories');
    config.universe = available;
    return { histories, failures };
  }

  async function compile() {
    if (state.running || !state.base) return;
    state.running = true;
    $('qmCompile').disabled = true;
    $('qmCompile').classList.add('is-running');
    $('qmResult').hidden = true;
    $('qmEmpty').hidden = false;
    try {
      state.config = controlConfig();
      const loaded = await loadHistories(state.config);
      state.histories = loaded.histories;
      setStatus('loading', 'WALK-FORWARD · scoring factors and applying constraints', '滚动回测 · 计算因子并执行硬约束');
      await new Promise((resolve) => requestAnimationFrame(resolve));
      state.result = runQuantExperiment(state.histories, state.config);
      const record = saveIteration();
      renderResult();
      const degraded = loaded.failures.length > 0;
      setStatus(degraded ? 'partial' : 'ready',
        `${record.id} COMPILED · ${state.config.universe.length}/${state.base.universe.length} assets · no orders routed`,
        `${record.id} 编译完成 · ${state.config.universe.length}/${state.base.universe.length} 个标的 · 未发送订单`);
    } catch (error) {
      const gated = error instanceof JsonDataError && error.status === 403;
      setStatus('error',
        gated ? 'DATA CONTEXT GATED · unlock Arena data or use a previously cached session.' : `MODEL HALTED · ${error.message || 'data unavailable'}`,
        gated ? '数据上下文受限 · 请解锁 Arena 数据或使用此前缓存的交易日。' : `模型停止 · ${error.message || '数据不可用'}`);
    } finally {
      state.running = false;
      $('qmCompile').disabled = false;
      $('qmCompile').classList.remove('is-running');
    }
  }

  function applyPreset(name) {
    const preset = state.base?.presets?.[name];
    if (!preset) return;
    setControls({ weights: preset.weights, settings: preset.settings });
    host.querySelectorAll('[data-qm-preset]').forEach((button) => button.classList.toggle('is-active', button.dataset.qmPreset === name));
    setStatus('idle', `VARIANT · ${name.toUpperCase()} · ready to compile`, `变体 · ${name.toUpperCase()} · 等待编译`);
  }

  function exportRun() {
    if (!state.result || !state.config) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      model: { id: state.config.id, version: state.config.version, provenance: state.config.provenance },
      config: { weights: state.config.weights, settings: state.config.settings, universe: state.config.universe, benchmark: state.config.benchmark },
      result: { model: state.result.model, backtest: { ...state.result.backtest, curve: undefined } },
      warning: 'Research simulation only. Not investment advice and not an order instruction.',
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${state.config.id.toLowerCase()}-${state.result.model.asOf || 'experiment'}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function bind() {
    host.querySelectorAll('input').forEach((input) => input.addEventListener('input', () => {
      syncControlReadouts();
      host.querySelectorAll('[data-qm-preset]').forEach((button) => button.classList.remove('is-active'));
    }));
    host.querySelectorAll('[data-qm-preset]').forEach((button) => button.addEventListener('click', () => applyPreset(button.dataset.qmPreset)));
    $('qmCompile').addEventListener('click', compile);
    $('qmExport').addEventListener('click', exportRun);
  }

  async function init() {
    try {
      state.base = await fetchJson('arena-quant-model');
      state.config = clone(state.base);
      renderUniverse();
      setControls(state.base);
      renderRuns();
      bind();
      setStatus('idle', 'MODEL COLD · compile uses completed daily sessions only', '模型冷态 · 编译仅使用已完成的日线交易日');
    } catch (error) {
      setStatus('error', `MODEL MANIFEST UNAVAILABLE · ${error.message}`, `模型清单不可用 · ${error.message}`);
      $('qmCompile').disabled = true;
    }
  }

  window.addEventListener('afflatus-lang', (event) => {
    state.lang = event.detail === 'zh' ? 'zh' : 'en';
    renderRuns();
    if (state.result) renderResult();
  });
  window.addEventListener('beforeunload', () => state.chartObserver?.disconnect(), { once: true });
  init();
})();
