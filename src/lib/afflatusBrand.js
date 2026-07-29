/**
 * Adaptive Afflatus wordmark.
 *
 * The 1px document-top sentinel keeps the full name exclusive to the true top
 * of the page. Once it leaves the viewport the wordmark folds to A·l; returning
 * to the top reverses the same transition. IntersectionObserver avoids a
 * per-frame layout read while scrolling.
 */

export const AFFLATUS_BRAND_FULL = 'full';
export const AFFLATUS_BRAND_COMPACT = 'compact';
export const AFFLATUS_BRAND_SELECTOR = '[data-afflatus-brand]';

export function brandStateFromTop(isAtTop) {
  return isAtTop ? AFFLATUS_BRAND_FULL : AFFLATUS_BRAND_COMPACT;
}

export function mountAfflatusBrand({
  doc = document,
  onChange,
} = {}) {
  const brand = doc?.querySelector?.(AFFLATUS_BRAND_SELECTOR);
  const root = doc?.documentElement;
  const body = doc?.body;
  if (!brand || !root || !body) return null;

  const win = doc.defaultView || globalThis.window;
  const sentinel = doc.createElement('span');
  sentinel.className = 'afflatus-brand-sentinel';
  sentinel.setAttribute('aria-hidden', 'true');
  body.prepend(sentinel);

  let state = brandStateFromTop((win?.scrollY || 0) <= 0);
  let observer = null;
  let removeFallback = null;

  const apply = (next) => {
    if (next === state && root.dataset.afflatusBrandState === state) return;
    state = next;
    root.dataset.afflatusBrandState = state;
    onChange?.(state);
  };

  root.dataset.afflatusBrandState = state;

  const Observer = win?.IntersectionObserver || globalThis.IntersectionObserver;
  if (typeof Observer === 'function') {
    observer = new Observer((entries) => {
      const entry = entries.find(({ target }) => target === sentinel);
      if (entry) apply(brandStateFromTop(entry.isIntersecting));
    }, { threshold: 0 });
    observer.observe(sentinel);
  } else if (win?.addEventListener) {
    let queued = false;
    const read = () => {
      queued = false;
      apply(brandStateFromTop((win.scrollY || 0) <= 0));
    };
    const onScroll = () => {
      if (queued) return;
      queued = true;
      (win.requestAnimationFrame || win.setTimeout)(read);
    };
    win.addEventListener('scroll', onScroll, { passive: true });
    removeFallback = () => win.removeEventListener('scroll', onScroll);
  }

  return {
    get state() {
      return state;
    },
    destroy() {
      observer?.disconnect();
      removeFallback?.();
      sentinel.remove();
      delete root.dataset.afflatusBrandState;
    },
  };
}
