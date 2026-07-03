import { PERIOD_META, genCandles, movingAverage } from '../data/marketSeries.js';
import { animateCountUp } from './viz.js';

export function initMarketDeck({
  getLang = () => 'en',
  getDpr = () => window.devicePixelRatio || 1,
  onPickHotChange,
} = {}) {
  const kc = document.getElementById('kchart');
  const kctx = kc?.getContext('2d');
  const seen = new Set();
  let drawProgress = 0;
  let kStarted = false;
  let activePeriod = '1Y';
  let candles = genCandles(activePeriod);
  let ma20 = movingAverage(candles, 20);

  function langKey() {
    return getLang() === 'zh' ? 'zh' : 'en';
  }

  function sizeK() {
    if (!kc) return;
    const dpr = getDpr();
    const r = kc.getBoundingClientRect();
    const safeW = Math.max(320, r.width || kc.parentElement?.clientWidth || innerWidth * 0.8);
    const safeH = Math.max(220, r.height || 360);
    kc.width = safeW * dpr;
    kc.height = safeH * dpr;
  }

  function updatePeriodUI() {
    const meta = PERIOD_META[activePeriod] || PERIOD_META['1Y'];
    document.querySelectorAll('#periodTabs button').forEach(btn => {
      const p = btn.dataset.period;
      btn.textContent = (PERIOD_META[p] || meta)[langKey()];
      btn.classList.toggle('active', p === activePeriod);
    });
    const chartReturn = document.getElementById('chartReturn');
    if (chartReturn) chartReturn.textContent = meta.ret;
    const chartValue = document.getElementById('chartValue');
    if (chartValue) chartValue.textContent = meta.value;
    const chartStart = document.getElementById('chartStartLabel');
    if (chartStart) chartStart.textContent = meta.start;
    const chartEnd = document.getElementById('chartEndLabel');
    if (chartEnd) chartEnd.textContent = 'T-0 · 138.66';
    const sub = document.getElementById('chartSub');
    if (sub) {
      sub.textContent = getLang() === 'zh'
        ? `私有组合 · ${meta.zh}周期年化`
        : `private · ${meta.en} annualized`;
    }
  }

  function rebuildCandles(period) {
    activePeriod = period || '1Y';
    candles = genCandles(activePeriod);
    ma20 = movingAverage(candles, Math.min(20, Math.max(5, Math.floor(candles.length * 0.16))));
    updatePeriodUI();
    drawProgress = 0;
    kStarted = false;
    startKChart();
  }

  function startKChart() {
    if (kStarted || !kc || !kctx) return;
    kStarted = true;
    drawProgress = 0;
    sizeK();
    drawK();
    setTimeout(animateK, 80);
  }

  function drawK() {
    if (!kc || !kctx) return;
    sizeK();
    const dpr = getDpr();
    const w = kc.width;
    const h = kc.height;
    kctx.clearRect(0, 0, w, h);
    const pad = { l: 14 * dpr, r: 56 * dpr, t: 10 * dpr, b: 14 * dpr };
    const iw = w - pad.l - pad.r;
    const ih = h - pad.t - pad.b;
    let minV = Infinity;
    let maxV = -Infinity;
    candles.forEach(c => {
      if (c.low < minV) minV = c.low;
      if (c.high > maxV) maxV = c.high;
    });
    const pv = (maxV - minV) * 0.08;
    minV -= pv;
    maxV += pv;
    const gridGlow = kctx.createLinearGradient(0, pad.t, w, pad.t + ih);
    gridGlow.addColorStop(0, 'rgba(141,180,192,0.018)');
    gridGlow.addColorStop(0.5, 'rgba(232,179,128,0.045)');
    gridGlow.addColorStop(1, 'rgba(154,229,255,0.018)');
    kctx.fillStyle = gridGlow;
    kctx.fillRect(pad.l, pad.t, iw, ih);
    kctx.strokeStyle = 'rgba(228,232,240,0.045)';
    kctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const y = pad.t + ih * (i / 4);
      kctx.beginPath();
      kctx.moveTo(pad.l, y);
      kctx.lineTo(w - pad.r, y);
      kctx.stroke();
      kctx.fillStyle = 'rgba(105,116,140,0.55)';
      kctx.font = `${9.5 * dpr}px 'JetBrains Mono',monospace`;
      kctx.textAlign = 'left';
      kctx.fillText((maxV - (maxV - minV) * (i / 4)).toFixed(1), w - pad.r + 8 * dpr, y + 3.5 * dpr);
    }
    if (100 >= minV && 100 <= maxV) {
      const y0 = pad.t + ih * (1 - (100 - minV) / (maxV - minV));
      kctx.strokeStyle = 'rgba(228,232,240,0.10)';
      kctx.setLineDash([3, 5]);
      kctx.lineWidth = 1;
      kctx.beginPath();
      kctx.moveTo(pad.l, y0);
      kctx.lineTo(w - pad.r, y0);
      kctx.stroke();
      kctx.setLineDash([]);
    }
    const bw = iw / candles.length;
    const drawn = Math.floor(candles.length * drawProgress);
    const barCount = document.getElementById('barCount');
    if (barCount) barCount.textContent = drawn;
    if (drawn > 1) {
      kctx.beginPath();
      kctx.moveTo(pad.l, pad.t + ih);
      for (let i = 0; i < drawn; i += 1) {
        kctx.lineTo(pad.l + i * bw + bw * 0.5, pad.t + ih * (1 - (candles[i].close - minV) / (maxV - minV)));
      }
      kctx.lineTo(pad.l + (drawn - 1) * bw + bw * 0.5, pad.t + ih);
      kctx.closePath();
      const fg = kctx.createLinearGradient(0, pad.t, 0, pad.t + ih);
      fg.addColorStop(0, 'rgba(141,180,192,0.08)');
      fg.addColorStop(1, 'rgba(141,180,192,0)');
      kctx.fillStyle = fg;
      kctx.fill();
    }
    const cc = 'rgba(154,229,255,0.78)';
    const cs = 'rgba(232,179,128,0.62)';
    for (let i = 0; i < drawn; i += 1) {
      const c = candles[i];
      const x = pad.l + i * bw + bw * 0.5;
      const yH = pad.t + ih * (1 - (c.high - minV) / (maxV - minV));
      const yL = pad.t + ih * (1 - (c.low - minV) / (maxV - minV));
      const yO = pad.t + ih * (1 - (c.open - minV) / (maxV - minV));
      const yC = pad.t + ih * (1 - (c.close - minV) / (maxV - minV));
      kctx.shadowBlur = 7 * dpr;
      kctx.shadowColor = c.close >= c.open ? 'rgba(154,229,255,.36)' : 'rgba(232,179,128,.32)';
      kctx.strokeStyle = c.close >= c.open ? cc : cs;
      kctx.lineWidth = 0.85 * dpr;
      kctx.beginPath();
      kctx.moveTo(x, yH);
      kctx.lineTo(x, yL);
      kctx.stroke();
      const bt = Math.min(yO, yC);
      const bh = Math.max(1.2 * dpr, Math.abs(yC - yO));
      if (c.close >= c.open) {
        const cg = kctx.createLinearGradient(0, bt, 0, bt + bh);
        cg.addColorStop(0, 'rgba(154,229,255,.86)');
        cg.addColorStop(1, 'rgba(154,229,255,.18)');
        kctx.fillStyle = cg;
        kctx.fillRect(x - bw * 0.22, bt, bw * 0.44, bh);
      } else {
        kctx.strokeStyle = 'rgba(232,179,128,.75)';
        kctx.lineWidth = 0.9 * dpr;
        kctx.strokeRect(x - bw * 0.22, bt, bw * 0.44, bh);
      }
    }
    kctx.shadowBlur = 0;
    kctx.strokeStyle = 'rgba(232,179,128,0.7)';
    kctx.lineWidth = 1.1 * dpr;
    kctx.beginPath();
    let started = false;
    for (let i = 0; i < drawn; i += 1) {
      if (ma20[i] === null) continue;
      const x = pad.l + i * bw + bw * 0.5;
      const y = pad.t + ih * (1 - (ma20[i] - minV) / (maxV - minV));
      if (!started) {
        kctx.moveTo(x, y);
        started = true;
      } else {
        kctx.lineTo(x, y);
      }
    }
    kctx.stroke();
    if (drawn > 0 && drawn < candles.length) {
      const sx = pad.l + (drawn - 0.25) * bw;
      const scan = kctx.createLinearGradient(sx - 22 * dpr, pad.t, sx + 24 * dpr, pad.t);
      scan.addColorStop(0, 'rgba(154,229,255,0)');
      scan.addColorStop(0.5, 'rgba(154,229,255,.46)');
      scan.addColorStop(1, 'rgba(154,229,255,0)');
      kctx.fillStyle = scan;
      kctx.fillRect(sx - 24 * dpr, pad.t, 48 * dpr, ih);
      kctx.strokeStyle = 'rgba(255,255,255,.5)';
      kctx.lineWidth = 0.8 * dpr;
      kctx.beginPath();
      kctx.moveTo(sx, pad.t);
      kctx.lineTo(sx, pad.t + ih);
      kctx.stroke();
    }
  }

  function animateK() {
    if (drawProgress >= 1) {
      drawK();
      return;
    }
    drawProgress = Math.min(1, drawProgress + 1 / 120);
    drawK();
    requestAnimationFrame(animateK);
  }

  function animateCounter(el) {
    const target = parseFloat(el.dataset.counter);
    const suffix = el.dataset.suffix || '';
    const fixed = el.dataset.fixed !== undefined ? parseInt(el.dataset.fixed, 10) : null;
    animateCountUp(el, target, {
      suffix,
      duration: 1800,
      format: v => (fixed !== null ? v.toFixed(fixed) : v.toFixed(1)),
    });
  }

  function animatePick(el) {
    const bar = el.querySelector('.alloc-bar i');
    const num = el.querySelector('.alloc-num');
    if (!bar || !num) return;
    const target = parseFloat(bar.dataset.target);
    setTimeout(() => {
      bar.style.width = `${(target / 15) * 100}%`;
    }, 100);
    animateCountUp(null, target, {
      duration: 2600,
      onFrame: v => { num.childNodes[0].nodeValue = v.toFixed(1); },
    });
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting || seen.has(entry.target)) return;
      seen.add(entry.target);
      const el = entry.target;
      if (el.classList.contains('pick')) animatePick(el);
      if (el.dataset?.counter !== undefined) animateCounter(el);
      if (el.id === 'chartFrame') startKChart();
    });
  }, { threshold: 0.25 });
  window.__io = observer;

  function observePick(el) {
    if (!el) return;
    el.addEventListener('mouseenter', () => onPickHotChange?.(true));
    el.addEventListener('mouseleave', () => onPickHotChange?.(false));
    seen.delete(el);
    observer.observe(el);
  }

  function renderPicks(picks = []) {
    const grid = document.getElementById('pickGrid');
    if (!grid) return;
    grid.innerHTML = '';
    picks.forEach((p, i) => {
      const el = document.createElement('div');
      el.className = 'pick';
      el.innerHTML = `<div class="pick-head"><div class="pick-ticker">${p.tk}</div><div class="pick-rank">${String(i + 1).padStart(2, '0')} / 10</div></div><div class="pick-name">${p.name}</div><div class="pick-thesis">${p.why}</div><div class="alloc-row"><div class="alloc-bar"><i data-target="${p.pct}"></i></div><div class="alloc-num">0.0<span>%</span></div></div>`;
      grid.appendChild(el);
      observePick(el);
    });
  }

  function init() {
    if (kc) {
      addEventListener('resize', sizeK);
      const periodTabs = document.getElementById('periodTabs');
      if (periodTabs) {
        const selectPeriod = event => {
          if (event.type === 'click' && periodTabs._lastPointer && performance.now() - periodTabs._lastPointer < 450) return;
          if (event.type === 'pointerdown') periodTabs._lastPointer = performance.now();
          const btn = event.target.closest('button[data-period]');
          if (!btn) return;
          event.preventDefault();
          rebuildCandles(btn.dataset.period);
        };
        periodTabs.addEventListener('pointerdown', selectPeriod);
        periodTabs.addEventListener('click', selectPeriod);
      }
      const chartFrame = document.getElementById('chartFrame');
      if (chartFrame) {
        observer.observe(chartFrame);
        ['load', 'scroll', 'visibilitychange'].forEach(ev => addEventListener(ev, () => {
          const r = chartFrame.getBoundingClientRect();
          if (r.top < innerHeight * 1.15 && r.bottom > -80) startKChart();
        }, { passive: true }));
        setTimeout(drawK, 250);
        setTimeout(() => {
          const r = chartFrame.getBoundingClientRect();
          if (r.top < innerHeight * 1.3) startKChart();
        }, 1200);
      }
    }

    document.querySelectorAll('[data-counter]').forEach(el => observer.observe(el));
    setTimeout(() => {
      document.querySelectorAll('.strip [data-counter]').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.top < innerHeight && r.bottom > 0 && !seen.has(el)) {
          seen.add(el);
          animateCounter(el);
        }
      });
    }, 400);
  }

  init();
  return { renderPicks, updatePeriodUI, startKChart, drawK, observePick };
}
