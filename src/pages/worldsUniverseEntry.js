const root = document.getElementById('wu-universe-content');
const entityHash = /^#(?:region|champion|story|skin)\/[a-z0-9-]+$/;
const tabKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];

if (root) {
  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  let loading;
  const notice = document.getElementById('wu-content-error');

  function activate(action) {
    loading ??= import('./worldsUniverse.js')
      .then(async (universe) => {
        await universe.initWorldsUniverse();
        listeners.abort();
        notice.hidden = true;
        return universe;
      })
      .catch((error) => {
        loading = undefined;
        notice.hidden = false;
        console.warn('[worlds-universe] Unable to load interactive content', error);
      });

    if (action) void loading.then((universe) => { if (universe) action(universe); });
  }

  root.addEventListener('click', (event) => {
    const target = event.target.closest('button, a[href^="#"]');
    if (!target || (target.tagName !== 'BUTTON' && !entityHash.test(target.hash))) return;
    event.preventDefault();
    activate((universe) => universe.handleClick(event));
  }, options);

  const activateFilters = (event) => {
    if (event.target.matches('#wu-champion-search, #wu-champion-region')) {
      activate((universe) => universe.filterChampions());
    }
  };
  root.addEventListener('input', activateFilters, options);
  root.addEventListener('change', activateFilters, options);

  document.addEventListener('keydown', (event) => {
    const openSearch = event.key === '/' && !event.ctrlKey && !event.metaKey
      && !event.target.matches('input, textarea, select');
    const switchTab = tabKeys.includes(event.key) && event.target.matches('[data-region], [data-skin]');
    if (!openSearch && !switchTab) return;
    event.preventDefault();
    activate((universe) => universe.handleKey(event));
  }, options);

  const openLinkedEntry = () => { if (entityHash.test(location.hash)) activate(); };
  window.addEventListener('hashchange', openLinkedEntry, options);
  openLinkedEntry();

  if ('IntersectionObserver' in window) {
    const sections = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        for (const link of root.querySelectorAll('.wu-nav-links a')) {
          if (link.hash === '#' + entry.target.id) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        }
      }
    }, { rootMargin: '-22% 0px -60% 0px' });

    const observeSections = () => {
      sections.disconnect();
      for (const section of document.querySelectorAll('#regions, #champions, #stories, #skins, #art, #competition')) {
        sections.observe(section);
      }
    };
    observeSections();
    window.addEventListener('afflatus-lang', () => queueMicrotask(observeSections));
  }
}
