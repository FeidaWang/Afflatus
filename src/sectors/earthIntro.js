import { loadGlobeAsset } from '../showcase/globeAsset.js';

export function mountSectorsEarth(root) {
  if (!root) return () => {};
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches) root.removeAttribute('data-pending');
  let scene = null;
  let observer = null;
  let destroyed = false;
  let loading = false;

  async function start() {
    if (destroyed || motion.matches || scene || loading) return;
    loading = true;
    try {
      const [land, { createEarthScene }] = await Promise.all([
        loadGlobeAsset(),
        import('../showcase/earthScene.js'),
      ]);
      if (destroyed || motion.matches) return;
      scene = createEarthScene(root, land, () => { scene = null; });
    } catch {
      root.removeAttribute('data-pending');
      // The poster and all three text panels remain available.
    } finally {
      loading = false;
    }
  }

  function preference() {
    if (motion.matches) {
      root.removeAttribute('data-pending');
      scene?.destroy();
      scene = null;
    } else start();
  }

  const select = (event) => {
    const button = event.target.closest('[data-excerpt-select]');
    if (!button || !root.contains(button)) return;
    const index = Number(button.dataset.excerptSelect);
    if (scene) scene.selectExcerpt(index);
    else {
      root.querySelectorAll('[data-excerpt]').forEach((item, position) => { item.hidden = position !== index; });
      root.querySelectorAll('[data-excerpt-select]').forEach((item, position) => {
        item.setAttribute('aria-pressed', String(position === index));
      });
    }
  };
  root.addEventListener('click', select);
  motion.addEventListener('change', preference);
  observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) { observer.disconnect(); observer = null; start(); }
  }, { rootMargin: '300px' });
  observer.observe(root);
  return () => {
    destroyed = true;
    root.removeAttribute('data-pending');
    observer?.disconnect();
    motion.removeEventListener('change', preference);
    root.removeEventListener('click', select);
    scene?.destroy();
  };
}
