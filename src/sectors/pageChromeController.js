import { fetchJson } from '../lib/fetchJson.js';
import { runCountUpOnLoad } from '../ui/viz.js';
import { currentLanguage, escapeHtml, translate } from './content.js';

function renderFooterNavigation() {
  const host = document.getElementById('footNav');
  if (!host || !window.AfflatusSite) return;
  host.innerHTML = window.AfflatusSite.map((route) => (
    `<li><a href="${escapeHtml(route.path)}" data-en="${escapeHtml(route.en)}" data-zh="${escapeHtml(route.zh)}">${escapeHtml(route.en)}</a></li>`
  )).join('');
  window.AfflatusI18N?.apply?.();
}

function initTicker() {
  const wrap = document.getElementById('tickerTrackWrap');
  const track = document.getElementById('tickerTrack');
  if (!wrap || !track) return () => {};
  const abortController = new AbortController();
  let lcpObserver = null;
  let motionFallback = 0;
  let flashTimer = 0;

  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let motionStarted = false;
    const startMotion = () => {
      if (motionStarted) return;
      motionStarted = true;
      if (motionFallback) clearTimeout(motionFallback);
      wrap.classList.add('motion-ready');
    };
    if (
      typeof PerformanceObserver === 'function'
      && PerformanceObserver.supportedEntryTypes?.includes('largest-contentful-paint')
    ) {
      lcpObserver = new PerformanceObserver((list) => {
        if (!list.getEntries().length) return;
        lcpObserver.disconnect();
        requestAnimationFrame(startMotion);
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      motionFallback = setTimeout(startMotion, 2500);
    } else {
      motionFallback = setTimeout(startMotion, 1500);
    }
  }

  const bucketColors = {
    'core-ai-hardware': '#10a37f',
    'megacap-tech': '#2f6bff',
    benchmark: '#e5484d',
  };
  const ambientSymbols = (symbols, limit) => {
    const priority = new Set(['NVDA', 'AVGO', 'MU', 'SKHY', 'TSM', 'ASML']);
    const selected = symbols.filter((item) => priority.has(item.sym));
    const seen = new Set(selected.map((item) => item.sym));
    const buckets = new Map();
    symbols.forEach((item) => {
      if (seen.has(item.sym)) return;
      const key = item.bucket || 'other';
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(item);
    });
    const groups = [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, group]) => group);
    for (let row = 0; selected.length < limit; row += 1) {
      let added = false;
      groups.forEach((group) => {
        if (selected.length >= limit || !group[row]) return;
        selected.push(group[row]);
        added = true;
      });
      if (!added) break;
    }
    return selected.slice(0, limit);
  };

  const onClick = (event) => {
    const button = event.target.closest('.tickerChip');
    if (!button) return;
    const symbol = button.dataset.ticker;
    let target = document.getElementById(`card-${symbol}`);
    if (!target) target = document.querySelector(`.nChip[data-ticker="${CSS.escape(symbol)}"]`)?.closest('.nCard');
    if (!target) return;
    target.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'center',
    });
    target.classList.add('flash');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => target.classList.remove('flash'), 1400);
  };
  wrap.addEventListener('click', onClick);

  fetchJson('arena-universe', { signal: abortController.signal })
    .then((data) => {
      const symbols = Array.isArray(data.symbols) ? data.symbols : [];
      if (!symbols.length) return;
      track.innerHTML = ambientSymbols(symbols, 60).map((symbol) => (
        `<button type="button" class="tickerChip" style="--tc:${bucketColors[symbol.bucket] || '#aeaeb6'}" data-ticker="${escapeHtml(symbol.sym)}"><b>${escapeHtml(symbol.sym)}</b>${escapeHtml(symbol.name)}</button>`
      )).join('');
      const clone = track.cloneNode(true);
      clone.removeAttribute('id');
      clone.classList.add('clone');
      clone.setAttribute('aria-hidden', 'true');
      clone.setAttribute('inert', '');
      wrap.appendChild(clone);
    })
    .catch(() => {});

  return () => {
    abortController.abort();
    lcpObserver?.disconnect();
    clearTimeout(motionFallback);
    clearTimeout(flashTimer);
    wrap.removeEventListener('click', onClick);
    wrap.querySelector('.clone')?.remove();
  };
}

function initStaticCardDisclosures() {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const removers = [];
  document.querySelectorAll('.rCard .rMore').forEach((button) => {
    button.setAttribute('aria-expanded', 'false');
    const onClick = () => {
      const card = button.closest('.rCard');
      const update = () => {
        card.classList.toggle('open');
        const expanded = card.classList.contains('open');
        button.setAttribute('aria-expanded', String(expanded));
        button.dataset.en = expanded ? button.dataset.enLess : button.dataset.enMore;
        button.dataset.zh = expanded ? button.dataset.zhLess : button.dataset.zhMore;
        button.textContent = translate(button.dataset.en, button.dataset.zh, currentLanguage());
      };
      if (!reduceMotion && document.startViewTransition) document.startViewTransition(update);
      else update();
    };
    button.addEventListener('click', onClick);
    removers.push(() => button.removeEventListener('click', onClick));
  });
  return () => removers.forEach((remove) => remove());
}

export function initSectorsPageChrome() {
  renderFooterNavigation();
  runCountUpOnLoad();
  const destroyTicker = initTicker();
  const destroyDisclosures = initStaticCardDisclosures();
  return () => {
    destroyTicker();
    destroyDisclosures();
  };
}
