import { isDecorativePaused, onDecorativePause } from './homeMotionPreferences.js';
// Financial values are content, not an animation state. Keep the server's
// exact values (including signs, precision and missing-value labels) from the
// first paint. Decorative tracks share that stable final state; no timer or
// observer may leave a reader looking at a fabricated zero.
export function initHomeScrollTelemetry() {
  initReadingEntries();
  for (const selector of ['#stardrive', '#fy2026Performance']) {
    document.querySelector(selector)?.classList.add('telemetry-static');
  }
}


// Portfolio's bounded reading owner. No pre-hidden state, document-wide element
// discovery, scroll sampler, or mutation observer. Card creation registers only
// its own prose and keeps stable keys across language changes/re-rendering.
let readingOwner;
export function registerHomeReadingEntries(elements) {
  readingOwner?.register(elements);
}
function initReadingEntries() {
  if (readingOwner || !document.body.classList.contains('home-page')) return;
  if (!('IntersectionObserver' in window)) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const seen = new Set();
  const pending = new Set();
  const timers = new Map();
  let disabled = isDecorativePaused() || motion.matches || Boolean(location.hash)
    || performance.getEntriesByType('navigation')[0]?.type === 'back_forward';
  const finish = element => {
    seen.add(element.dataset.readingEntry);
    observer.unobserve(element);
    pending.delete(element);
    clearTimeout(timers.get(element)); timers.delete(element);
    element.classList.remove('reading-enter');
    element.style.removeProperty('--reading-delay');
  };
  const finishAll = () => {
    disabled = true;
    [...pending].forEach(finish);
  };
  onDecorativePause(value => { if (value) finishAll(); });
  const observer = new IntersectionObserver(entries => {
    try {
      for (const entry of entries) {
        const element = entry.target;
        if (disabled || !element.isConnected) { finish(element); continue; }
        if (element.classList.contains('reading-enter')) {
          if (!entry.isIntersecting) finish(element);
          continue;
        }
        if (!entry.isIntersecting || entry.intersectionRatio < 0.15) continue;
        // A fast jump/find/anchor into the reading area resolves immediately.
        // Animate only a fresh entrance in the lower part of the viewport.
        if (entry.boundingClientRect.top < innerHeight * 0.55 || performance.now() - entry.time > 120) {
          finish(element); continue;
        }
        const delay = Math.min(3, Math.max(0, Number(element.dataset.readingOrder) || 0)) * 50;
        element.style.setProperty('--reading-delay', `${delay}ms`);
        seen.add(element.dataset.readingEntry);
        element.classList.add('reading-enter');
        // CSS is finite with no fill; this timer is cleanup only, never reveal.
        timers.set(element, setTimeout(() => finish(element), 450 + delay));
      }
    } catch { finishAll(); }
  }, { threshold: [0, 0.15] });
  const register = elements => {
    // Drop detached cards when their existing owner replaces a language view.
    for (const element of pending) if (!element.isConnected) finish(element);
    for (const element of elements) {
      if (disabled || seen.has(element.dataset.readingEntry)) continue;
      if (element.getBoundingClientRect().top < innerHeight) {
        seen.add(element.dataset.readingEntry); continue;
      }
      pending.add(element); observer.observe(element);
    }
  };
  readingOwner = { register };
  document.getElementById('mainContent')?.addEventListener('animationend', event => {
    if (event.animationName === 'portfolio-reading-enter') finish(event.target);
  });
  motion.addEventListener('change', () => { if (motion.matches) finishAll(); });
  for (const type of ['beforeprint', 'pagehide', 'hashchange', 'error', 'unhandledrejection']) window.addEventListener(type, finishAll);
  document.addEventListener('beforematch', finishAll);
  document.addEventListener('selectionchange', () => { if (!document.getSelection()?.isCollapsed) finishAll(); });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && ['f', 'g'].includes(event.key.toLowerCase())) finishAll();
  }, { capture: true });
  document.addEventListener('click', event => {
    if (event.target.closest?.('a[href*="#"]')) finishAll();
  }, { capture: true });
  document.addEventListener('focusin', event => {
    const element = event.target.closest?.('[data-reading-entry]');
    if (element) finish(element);
  });
  register(document.querySelectorAll('#mainContent [data-reading-entry]'));
}
