export function progressiveBatchEnd(total, visible, batchSize) {
  return Math.min(
    Math.max(0, Number(total) || 0),
    Math.max(0, Number(visible) || 0) + Math.max(1, Number(batchSize) || 1),
  );
}

export function progressiveObserverDecision(entries, blockedUntilExit = false) {
  const records = Array.isArray(entries) ? entries : [];
  const leftObserverRoot = records.some((entry) => !entry?.isIntersecting);
  const blocked = leftObserverRoot ? false : blockedUntilExit;
  return {
    blocked,
    reveal: !blocked && records.some((entry) => entry?.isIntersecting),
  };
}

export function mountProgressiveCollection(host, items, options = {}) {
  if (!host) return { revealAll() {}, destroy() {}, get visible() { return 0; } };
  const records = Array.isArray(items) ? items : [];
  const renderItem = typeof options.renderItem === 'function' ? options.renderItem : String;
  const onAppend = typeof options.onAppend === 'function' ? options.onAppend : () => {};
  const initialCount = Math.max(1, options.initialCount || 4);
  const batchSize = Math.max(1, options.batchSize || initialCount);
  let visible = 0;
  let destroyed = false;
  let queued = false;
  let observerBlockedUntilExit = false;
  let observerTimer = 0;

  host.replaceChildren();
  const sentinel = document.createElement('button');
  sentinel.type = 'button';
  sentinel.className = options.className || 'collectionMore';
  sentinel.setAttribute('aria-live', 'polite');

  function updateSentinel() {
    const remaining = records.length - visible;
    if (remaining <= 0) {
      sentinel.remove();
      observer?.disconnect();
      return;
    }
    sentinel.textContent = options.label
      ? options.label(remaining)
      : `Load ${Math.min(batchSize, remaining)} more`;
    sentinel.setAttribute('aria-label', sentinel.textContent);
  }

  function revealNext(count = batchSize) {
    if (destroyed || visible >= records.length) return;
    const from = visible;
    const to = progressiveBatchEnd(records.length, visible, count);
    sentinel.insertAdjacentHTML(
      'beforebegin',
      records.slice(from, to).map((item, index) => renderItem(item, from + index)).join(''),
    );
    visible = to;
    onAppend({ host, from, to });
    updateSentinel();
  }

  function queueReveal() {
    if (queued || destroyed) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      revealNext();
    });
  }

  function revealFromButton() {
    // Locator/browser scrolling can make the sentinel intersect immediately
    // before its click fires. Cancel the short auto-reveal grace period so that
    // scroll+click remains one batch, then wait for the sentinel to leave.
    observerBlockedUntilExit = true;
    clearTimeout(observerTimer);
    observerTimer = 0;
    queueReveal();
  }

  sentinel.addEventListener('click', revealFromButton);
  host.appendChild(sentinel);
  const observer = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver((entries) => {
        const decision = progressiveObserverDecision(entries, observerBlockedUntilExit);
        observerBlockedUntilExit = decision.blocked;
        if (!decision.reveal) {
          clearTimeout(observerTimer);
          observerTimer = 0;
          return;
        }
        clearTimeout(observerTimer);
        observerTimer = setTimeout(() => {
          observerTimer = 0;
          if (!observerBlockedUntilExit) queueReveal();
        }, Math.max(0, options.observerDelay ?? 180));
      }, { rootMargin: options.rootMargin || '700px 0px' })
    : null;
  observer?.observe(sentinel);
  revealNext(initialCount);

  return {
    revealAll() {
      revealNext(records.length);
    },
    destroy() {
      destroyed = true;
      observer?.disconnect();
      clearTimeout(observerTimer);
      sentinel.removeEventListener('click', revealFromButton);
    },
    get visible() {
      return visible;
    },
  };
}
