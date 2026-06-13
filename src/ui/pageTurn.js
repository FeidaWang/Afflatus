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

  window.addEventListener('pageshow', clearTurnState);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') clearTurnState();
  });

  return { pageTurnTo };
}
