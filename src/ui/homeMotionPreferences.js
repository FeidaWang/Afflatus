// One Portfolio decoration preference, retaining the M03 storage key. This is
// not a rendering scheduler: each existing scene still owns its lifecycle.
const KEY = 'afflatus:starfield-paused:v1';
let paused = false;
try { paused = localStorage.getItem(KEY) === 'true'; } catch {}
const subscribers = new Set();
export const isDecorativePaused = () => paused;
export function onDecorativePause(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}
export function initHomeMotionPreferences() {
  const buttons = [...document.querySelectorAll('#mainContent [data-motion-pause]')];
  const update = () => {
    document.body.classList.toggle('portfolio-motion-paused', paused);
    const zh = document.documentElement.lang.startsWith('zh');
    for (const button of buttons) {
      button.disabled = false;
      button.setAttribute('aria-pressed', String(paused));
      button.textContent = paused ? (zh ? '继续动态' : 'Resume motion') : (zh ? '暂停动态' : 'Pause motion');
    }
  };
  const publish = () => { update(); for (const callback of subscribers) callback(paused); };
  buttons.forEach(button => button.addEventListener('click', () => {
    paused = !paused;
    try { localStorage.setItem(KEY, String(paused)); } catch {}
    publish();
  }));
  window.addEventListener('storage', event => { if (event.key === KEY || event.key === null) { paused = event.key === KEY && event.newValue === 'true'; publish(); } });
  new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  update();
}
