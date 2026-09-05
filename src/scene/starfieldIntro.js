// M04 owns only a visual timeline. Rendering remains in backgroundScene's loop.
const instances = new WeakMap();
const SEEN_KEY = 'afflatus:portfolio-intro:v1';
export function prepareStarfieldIntro(host) {
  if (instances.has(host)) return instances.get(host);
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const entry = Number(root.dataset.introEntry) || performance.getEntriesByType('navigation')[0]?.responseStart || 0;
  const historyEntry = performance.getEntriesByType('navigation')[0]?.type === 'back_forward';
  let seen = false;
  try { seen = sessionStorage.getItem(SEEN_KEY) === 'seen'; sessionStorage.setItem(SEEN_KEY, 'seen'); } catch {}
  let state = !seen && !historyEntry && !motion.matches && !root.dataset.introInterrupted && scrollY < 2 && !location.hash && performance.now() < entry + 1200 ? 'pending' : 'complete';
  let start = 0, end = entry + 1200, timer;
  const abort = new AbortController();
  const listen = (target, type, callback, options = {}) => target.addEventListener(type, callback, { ...options, signal: abort.signal });
  const publish = () => { host.dataset.intro = state; };
  function cancel(reason = 'complete') {
    if (state === 'complete') return;
    state = 'complete'; clearTimeout(timer); publish();
    host.dataset.introEnd = reason;
    host.dispatchEvent(new Event('afflatus:intro-end'));
  }
  function begin(replay = false) {
    if (motion.matches || (!replay && state !== 'pending')) return;
    const now = performance.now();
    if (replay) end = now + 1000;
    if (end - now < 150) { cancel('late-resource'); return; }
    start = now; end = Math.min(end, now + 1000); state = 'entering';
    clearTimeout(timer); timer = setTimeout(() => cancel('complete'), end - now);
    delete host.dataset.introEnd; publish();
  }
  publish();
  if (state === 'pending') timer = setTimeout(() => cancel('late-resource'), Math.max(0, end - performance.now()));
  for (const type of ['wheel', 'touchstart', 'scroll']) listen(window, type, () => cancel('scroll'), { passive: true });
  listen(document, 'pointerdown', event => {
    if (event.target.closest('a,button,input,select,textarea,[contenteditable],#starfieldViewport') && !event.target.closest('#starfieldReplay')) cancel('interaction');
  }, { capture: true });
  listen(document, 'focusin', event => { if (event.target.closest('input,select,textarea,[contenteditable]')) cancel('focus'); });
  listen(document, 'keydown', event => { if (!event.target.closest('#starfieldReplay')) cancel('keyboard'); }, { capture: true });
  listen(window, 'pagehide', event => { cancel('pagehide'); if (!event.persisted) abort.abort(); });
  listen(window, 'pageshow', event => { if (event.persisted) cancel('restore'); });
  listen(motion, 'change', () => { if (motion.matches) cancel('reduced-motion'); });
  const api = {
    begin, cancel,
    progress(now = performance.now()) {
      if (state !== 'entering') return 1;
      const t = Math.min(1, Math.max(0, (now - start) / (end - start)));
      return 1 - (1 - t) ** 3;
    },
  };
  instances.set(host, api);
  return api;
}
