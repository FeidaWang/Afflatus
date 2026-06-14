export function createPageTurnController({ root = document, body = document.body, delay = 220 } = {}) {
  let isPageTurning = false;
  let clearTimer = 0;

  function clearTurnState() {
    isPageTurning = false;
    if (clearTimer) {
      window.clearTimeout(clearTimer);
      clearTimer = 0;
    }
    body.classList.remove('page-turn-next', 'page-turn-prev');
  }

  function pageTurnTo(url, dir = 'next') {
    if (!url || isPageTurning) return;
    isPageTurning = true;
    body.classList.remove('page-turn-next', 'page-turn-prev');
    void body.offsetWidth;
    body.classList.add(dir === 'prev' ? 'page-turn-prev' : 'page-turn-next');
    clearTimer = window.setTimeout(clearTurnState, delay + 460);
    setTimeout(() => window.location.assign(url), delay);
  }

  root.querySelectorAll('[data-turn]').forEach(link => {
    const go = event => {
      event.preventDefault();
      event.stopPropagation();
      pageTurnTo(link.getAttribute('href'), link.dataset.turn);
    };
    link.addEventListener('click', go);
  });

  window.addEventListener('keydown', event => {
    const tag = (event.target?.tagName || '').toLowerCase();
    if (event.metaKey || event.ctrlKey || event.altKey || ['input', 'textarea', 'select'].includes(tag)) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      pageTurnTo(body.dataset.next, 'next');
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      pageTurnTo(body.dataset.prev, 'prev');
    }
  });

  const isInteractiveTarget = target => Boolean(target?.closest?.('a,button,input,textarea,select,label,[contenteditable="true"]'));
  let touchStart = null;
  window.addEventListener('touchstart', event => {
    if (event.touches.length !== 1 || isInteractiveTarget(event.target)) {
      touchStart = null;
      return;
    }
    const touch = event.touches[0];
    touchStart = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  }, { passive: true });

  window.addEventListener('touchend', event => {
    if (!touchStart || event.changedTouches.length !== 1) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    const elapsed = Date.now() - touchStart.time;
    touchStart = null;
    if (elapsed > 900 || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.35) return;
    pageTurnTo(dx < 0 ? body.dataset.next : body.dataset.prev, dx < 0 ? 'next' : 'prev');
  }, { passive: true });

  window.addEventListener('touchcancel', () => {
    touchStart = null;
  }, { passive: true });

  window.addEventListener('pageshow', clearTurnState);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') clearTurnState();
  });

  return { pageTurnTo };
}
