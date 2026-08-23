import { PERIOD_META, genCandles, movingAverage } from '../data/marketSeries.js';
import { getRenderBudgetCoordinator } from '../lib/renderBudgetCoordinator.js';
import { initPortfolioSolarSystem } from './portfolioSolarSystem.js';
import { animateCountUp } from './viz.js';

export function initMarketDeck({
  getLang = () => 'en',
  onPickHotChange,
} = {}) {
  const renderCoordinator = getRenderBudgetCoordinator();
  let renderPolicy = renderCoordinator.getPolicy({ cost: 'medium', targetFps: 60 });
  const kc = document.getElementById('kchart');
  const kctx = kc?.getContext('2d');
  const seen = new Set();
  const visibleConvoyCards = new Set();
  const nodePositions = [
    [50, 50], [60, 45], [39, 58], [64, 64], [31, 39],
    [71, 31], [25, 71], [79, 61], [46, 19], [18, 48],
  ];
  let pickModels = [];
  let scrollActivePick = null;
  let drawProgress = 0;
  let kStarted = false;
  let activePeriod = '1Y';
  let candles = genCandles(activePeriod);
  let ma20 = movingAverage(candles, 20);
  let chartActive = false;
  let chartRaf = 0;
  let chartDpr = 1;
  let convoyPinRaf = 0;
  let solarSystem = null;
  let orbitSelectionLock = null;
  let orbitSelectionTimer = 0;
  // U44 44-2: tickers that actually have a real #card-<TICKER> anchor on
  // sectors.html today (verified 2026-07-18). The other picks share the AI
  // hardware supply-chain space sectors.html covers but aren't individually
  // anchored there yet — their CTA links to the page only, never a fabricated
  // anchor.
  const SECTORS_ANCHORS = new Set(['NVDA', 'AVGO', 'MU']);

  function langKey() {
    return getLang() === 'zh' ? 'zh' : 'en';
  }

  function sizeK() {
    if (!kc) return;
    const r = kc.getBoundingClientRect();
    const safeW = Math.max(320, r.width || kc.parentElement?.clientWidth || innerWidth * 0.8);
    const safeH = Math.max(220, r.height || 360);
    chartDpr = renderPolicy.computeDpr(safeW, safeH, { minDpr: 0.75, maxDpr: 2 });
    kc.width = safeW * chartDpr;
    kc.height = safeH * chartDpr;
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
    if (kStarted || !chartActive || !kc || !kctx) return;
    kStarted = true;
    drawProgress = 0;
    sizeK();
    drawK();
    setTimeout(animateK, 80);
  }

  function drawK() {
    if (!kc || !kctx) return;
    sizeK();
    const dpr = chartDpr;
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
    if (!chartActive) return;
    if (drawProgress >= 1) {
      drawK();
      return;
    }
    drawProgress = Math.min(1, drawProgress + 1 / 120);
    drawK();
    chartRaf = requestAnimationFrame(animateK);
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
    const max = parseFloat(bar.dataset.max) || target || 1;
    setTimeout(() => {
      bar.style.width = `${Math.min(100, (target / max) * 100)}%`;
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

  function activatePick(el) {
    if (!el) return;
    const index = Number.parseInt(el.dataset.pickIndex || '0', 10);
    const pick = pickModels[index];
    if (!pick) return;

    document.querySelectorAll('#pickGrid .pick-card').forEach((card) => {
      const active = card === el;
      card.classList.toggle('is-active', active);
      card.querySelector('.pcCover')?.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('#convoyNodes .convoy-node').forEach((node) => {
      node.classList.toggle('is-active', Number.parseInt(node.dataset.pickIndex || '-1', 10) === index);
    });
    solarSystem?.setActive(index);

    const layer = document.getElementById('convoyLayer');
    const ticker = document.getElementById('convoyTicker');
    const weight = document.getElementById('convoyWeight');
    const role = document.getElementById('convoyRole');
    const progress = document.getElementById('convoyProgress');
    if (layer) layer.textContent = pick.layer;
    if (ticker) ticker.textContent = pick.tk;
    if (weight) weight.textContent = `${pick.pct}%`;
    if (role) role.textContent = pick.role;
    if (progress) progress.textContent = `${String(index + 1).padStart(2, '0')} / 10`;
  }

  function lockOrbitSelection(el) {
    const lock = { element: el, until: performance.now() + 1800 };
    orbitSelectionLock = lock;
    if (orbitSelectionTimer) clearTimeout(orbitSelectionTimer);
    orbitSelectionTimer = setTimeout(() => {
      if (orbitSelectionLock !== lock) return;
      orbitSelectionLock = null;
      scrollActivePick = el;
      activatePick(el);
    }, 1850);
  }

  const convoyObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) visibleConvoyCards.add(entry.target);
      else visibleConvoyCards.delete(entry.target);
    });
    if (orbitSelectionLock && performance.now() < orbitSelectionLock.until) {
      scrollActivePick = orbitSelectionLock.element;
      activatePick(scrollActivePick);
      return;
    }
    orbitSelectionLock = null;
    const visible = [...visibleConvoyCards]
      .filter(card => card.isConnected)
      .sort((a, b) => {
        const aRect = a.getBoundingClientRect();
        const bRect = b.getBoundingClientRect();
        const ac = Math.abs((aRect.top + aRect.bottom) / 2 - innerHeight / 2);
        const bc = Math.abs((bRect.top + bRect.bottom) / 2 - innerHeight / 2);
        return ac - bc;
      });
    if (!visible.length) return;
    scrollActivePick = visible[0];
    activatePick(scrollActivePick);
  }, { threshold: [0.15, 0.45, 0.75], rootMargin: '-22% 0px -22% 0px' });

  function resetConvoyPin({ clearMeasure = false } = {}) {
    const visual = document.querySelector('.convoy-visual');
    if (!visual) return;
    visual.classList.remove('is-pinned', 'is-docked');
    if (clearMeasure) {
      visual.style.removeProperty('--convoy-pin-left');
      visual.style.removeProperty('--convoy-pin-width');
      delete visual.dataset.pinWidth;
    }
  }

  function syncConvoyPin() {
    convoyPinRaf = 0;
    const shell = document.querySelector('.convoy-shell');
    const visual = shell?.querySelector('.convoy-visual');
    if (!shell || !visual || matchMedia('(max-width: 940px)').matches) {
      resetConvoyPin({ clearMeasure: true });
      return;
    }

    const shellRect = shell.getBoundingClientRect();
    const safeTop = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-top')) || 0;
    const pinTop = safeTop + 92;
    const visualHeight = visual.offsetHeight;

    if (!visual.dataset.pinWidth) {
      const naturalRect = visual.getBoundingClientRect();
      visual.dataset.pinWidth = String(naturalRect.width);
      visual.style.setProperty('--convoy-pin-width', `${naturalRect.width}px`);
    }
    visual.style.setProperty('--convoy-pin-left', `${shellRect.left}px`);

    if (shellRect.top > pinTop) {
      visual.classList.remove('is-pinned', 'is-docked');
      return;
    }
    if (shellRect.bottom <= pinTop + visualHeight) {
      visual.classList.remove('is-pinned');
      visual.classList.add('is-docked');
      return;
    }
    visual.classList.remove('is-docked');
    visual.classList.add('is-pinned');
  }

  function scheduleConvoyPin() {
    if (convoyPinRaf) return;
    convoyPinRaf = requestAnimationFrame(syncConvoyPin);
  }

  function resizeConvoyPin() {
    resetConvoyPin({ clearMeasure: true });
    scheduleConvoyPin();
  }
  const chartSurface = kc ? renderCoordinator.register({
    id: 'home:market-chart',
    element: kc,
    cost: 'medium',
    targetFps: 60,
    onResume() {
      chartActive = true;
      if (kStarted && drawProgress < 1) chartRaf = requestAnimationFrame(animateK);
      else startKChart();
    },
    onPause() {
      chartActive = false;
      if (chartRaf) cancelAnimationFrame(chartRaf);
      chartRaf = 0;
    },
    onResize() {
      sizeK();
      if (kStarted) drawK();
    },
    onQualityChange(nextPolicy) { renderPolicy = nextPolicy; },
  }) : null;

  function observePick(el) {
    if (!el) return;
    el.addEventListener('mouseenter', () => {
      onPickHotChange?.(true);
      activatePick(el);
    });
    el.addEventListener('mouseleave', () => {
      onPickHotChange?.(false);
      if (scrollActivePick) activatePick(scrollActivePick);
    });
    el.addEventListener('focusin', () => activatePick(el));
    seen.delete(el);
    observer.observe(el);
    convoyObserver.observe(el);
  }

  function renderPicks(picks = []) {
    const grid = document.getElementById('pickGrid');
    if (!grid) return;
    grid.querySelectorAll('.pick-card').forEach(el => observer.unobserve(el));
    convoyObserver.disconnect();
    visibleConvoyCards.clear();
    grid.replaceChildren();
    grid.setAttribute('role', 'list');
    pickModels = picks;
    scrollActivePick = null;
    const maxPct = Math.max(1, ...picks.map(pick => Number(pick.pct) || 0));
    const ctaLabel = langKey() === 'zh' ? '去 sectors 看研判 →' : 'FULL THESIS →';
    const catalystLabel = langKey() === 'zh' ? '主要催化剂' : 'PRIMARY CATALYST';
    const riskLabel = langKey() === 'zh' ? '主要风险' : 'CRITICAL RISK';
    const nodes = document.getElementById('convoyNodes');
    if (nodes) nodes.innerHTML = '';
    picks.forEach((p, i) => {
      const el = document.createElement('article');
      el.className = 'pick pick-card';
      el.dataset.pickIndex = String(i);
      el.setAttribute('role', 'listitem');
      const href = SECTORS_ANCHORS.has(p.tk) ? `/sectors.html#card-${p.tk}` : '/sectors.html';
      const detailsLabel = langKey() === 'zh' ? `将 ${p.tk} 设为当前轨道档案` : `Focus ${p.tk} orbital dossier`;
      el.innerHTML = `<button type="button" class="pcCover" aria-pressed="false" aria-label="${detailsLabel}"><div class="pick-overline"><span>${p.layer}</span><b>${String(i + 1).padStart(2, '0')} / 10</b></div><div class="pick-head"><div class="pick-ticker">${p.tk}</div><div class="pick-rank">${p.pct}<span>%</span></div></div><div class="pick-name">${p.name}</div><p class="pick-role">${p.role}</p><p class="pick-thesis">${p.why}</p><div class="alloc-row"><div class="alloc-bar"><i data-target="${p.pct}" data-max="${maxPct}"></i></div><div class="alloc-num">0.0<span>%</span></div></div></button><div class="pcDetail"><div class="pick-signal catalyst"><span>${catalystLabel}</span><p>${p.catalyst}</p></div><div class="pick-signal risk"><span>${riskLabel}</span><p>${p.risk}</p></div><a class="pcCta" href="${href}">${ctaLabel}</a></div>`;
      grid.appendChild(el);
      observePick(el);

      if (nodes) {
        const [x, y] = nodePositions[i] || [50, 50];
        const solarBody = p.layer.split('/')[0].trim();
        const node = document.createElement('button');
        node.type = 'button';
        node.className = `convoy-node ${i === 0 ? 'is-sun' : 'is-planet'}`;
        node.dataset.pickIndex = String(i);
        node.style.setProperty('--node-x', `${x}%`);
        node.style.setProperty('--node-y', `${y}%`);
        node.style.setProperty('--node-weight', String(p.pct));
        node.dataset.solarBody = solarBody;
        node.setAttribute('aria-label', langKey() === 'zh' ? `聚焦 ${solarBody}，${p.tk}，权重 ${p.pct}%` : `Focus ${solarBody}, ${p.tk}, ${p.pct}% allocation`);
        node.innerHTML = `<span><b>${p.tk}</b><i>${solarBody}</i></span>`;
        nodes.appendChild(node);
      }
    });
    if (nodes) {
      nodes.onclick = (event) => {
        const nodeList = [...nodes.querySelectorAll('.convoy-node')];
        const eventNode = event.target.closest('.convoy-node');
        let selectedNode = eventNode;
        if (event.detail !== 0 && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
          selectedNode = nodeList.reduce((closest, node) => {
            const rect = node.getBoundingClientRect();
            const distance = (rect.left + rect.width / 2 - event.clientX) ** 2
              + (rect.top + rect.height / 2 - event.clientY) ** 2;
            return !closest || distance < closest.distance ? { node, distance } : closest;
          }, null)?.node || eventNode;
        }
        const index = Number.parseInt(selectedNode?.dataset.pickIndex || '-1', 10);
        const card = grid.querySelector(`.pick-card[data-pick-index="${index}"]`);
        if (!card) return;
        scrollActivePick = card;
        lockOrbitSelection(card);
        activatePick(card);
        card.scrollIntoView({
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'center',
        });
      };
    }
    const solarCanvas = document.getElementById('convoySolarSystem');
    const orbitHost = solarCanvas?.closest('.orbit-field');
    if (!solarSystem && solarCanvas && orbitHost) {
      solarSystem = initPortfolioSolarSystem({ canvas: solarCanvas, host: orbitHost, picks });
    } else {
      solarSystem?.updatePicks(picks);
    }
    const first = grid.querySelector('.pick-card');
    if (first) {
      scrollActivePick = first;
      activatePick(first);
    }
    scheduleConvoyPin();
  }

  function initPickGridToggle() {
    const grid = document.getElementById('pickGrid');
    if (!grid) return;
    grid.addEventListener('click', (e) => {
      const card = e.target.closest('.pick-card');
      if (!card || e.target.closest('.pcCta')) return;
      scrollActivePick = card;
      // A deliberate dossier choice must win over IntersectionObserver
      // callbacks queued by the preceding scroll. Without the same short lock
      // used by orbit-node selection, a wide desktop viewport can immediately
      // snap the readout back to the first visible card.
      lockOrbitSelection(card);
      activatePick(card);
    });
  }

  function init() {
    initPickGridToggle();
    addEventListener('scroll', scheduleConvoyPin, { passive: true });
    addEventListener('resize', resizeConvoyPin, { passive: true });
    scheduleConvoyPin();
    if (kc) {
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
        setTimeout(drawK, 250);
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
  return {
    renderPicks,
    updatePeriodUI,
    startKChart,
    drawK,
    observePick,
    destroy() {
      chartSurface?.unregister();
      observer.disconnect();
      convoyObserver.disconnect();
      removeEventListener('scroll', scheduleConvoyPin);
      removeEventListener('resize', resizeConvoyPin);
      if (convoyPinRaf) cancelAnimationFrame(convoyPinRaf);
      convoyPinRaf = 0;
      if (orbitSelectionTimer) clearTimeout(orbitSelectionTimer);
      orbitSelectionTimer = 0;
      orbitSelectionLock = null;
      resetConvoyPin({ clearMeasure: true });
      if (chartRaf) cancelAnimationFrame(chartRaf);
      solarSystem?.destroy();
      solarSystem = null;
    },
  };
}
