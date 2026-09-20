import { getRenderBudgetCoordinator } from '../lib/renderBudgetCoordinator.js';

// One composited layer over the unchanged poster; no WebGL or permanent JS loop.
// These are original design values, not measurements of a reference website.
export function createPosterScene(host) {
  const poster = host.querySelector('.hero-image');
  if (!poster?.animate) throw new Error('Static poster only');
  const layer = poster.cloneNode();
  layer.classList.add('hero-scene-layer');
  layer.removeAttribute('fetchpriority');
  layer.setAttribute('aria-hidden', 'true');
  host.prepend(layer);
  const animation = layer.animate([
    { transform: 'scale(1.015) translate3d(-4px, 0, 0)' },
    { transform: 'scale(1.025) translate3d(4px, -3px, 0)' },
    { transform: 'scale(1.015) translate3d(-4px, 0, 0)' },
  ], { duration: 18000, iterations: Infinity, easing: 'ease-in-out' });
  animation.pause();
  const handle = getRenderBudgetCoordinator().register({
    id: 'showcase:poster', element: host, cost: 'low', targetFps: 60,
    onResume() { animation.play(); host.dataset.sceneActive = 'true'; },
    onPause() { animation.pause(); host.dataset.sceneActive = 'false'; },
    onDispose() { animation.cancel(); layer.remove(); delete host.dataset.sceneActive; },
  });
  return { setPaused(value) { if (value) handle.pause(); else handle.resume(); }, destroy() { handle.dispose(); } };
}
