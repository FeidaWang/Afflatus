// Real-user vitals are observational telemetry, not render-critical product
// code. Load the collector after the first interaction (so engaged visits are
// measured promptly) or once the page has been idle for a while. web-vitals
// uses buffered PerformanceObservers, so LCP/CLS entries that occurred before
// the import are still reported without putting the library on every route's
// first-paint dependency chain.
let loading = false;
let idleTimer = 0;

function startCollector() {
  if (loading) return;
  loading = true;
  if (idleTimer) clearTimeout(idleTimer);
  removeEventListener('pointerdown', startCollector, true);
  removeEventListener('keydown', startCollector, true);
  import('../lib/webVitals.js')
    .then(({ startWebVitals }) => startWebVitals())
    .catch(() => {});
}

addEventListener('pointerdown', startCollector, { capture: true, passive: true, once: true });
addEventListener('keydown', startCollector, { capture: true, once: true });
idleTimer = setTimeout(startCollector, 15_000);
