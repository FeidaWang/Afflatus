import { installSimulationEntry, isSimulationFrame } from './ui/portfolioSimulation.js';
import { initPortfolioReading } from './ui/portfolioReading.js';
import { navigationHref } from './lib/siteNavigation.js';
import { initPortfolioChartGeometry } from './ui/portfolioChartGeometry.js';
import './lib/readingNavigation.ts';
import './styles.css';
import './cic-hud.css';
import './performance-dossier.css';
import './portfolio-convoy.css';
import './home-visual-upgrade.css';
import { initPortfolioChartInspector } from './ui/portfolioChartInspector.js';
import { NAV_ROUTES, normalizeRoutePath } from './config/navRoutes.generated.js';
import { getLocale, localeFromPathname, localeSwitchHref, setLocale } from './lib/localeStore.js';
import { prepareStarfieldIntro } from './scene/starfieldIntro.js';
import { initHomeMotionPreferences } from './ui/homeMotionPreferences.js';
import { initHomeScrollTelemetry } from './ui/homeScrollTelemetry.js';

let experiencePromise = null;

function installLocaleLinks() {
  const fallback = document.documentElement.lang.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  const current = getLocale(fallback);
  const next = current === 'zh' ? 'en' : 'zh';
  const href = localeSwitchHref(location, next);
  document.querySelectorAll('#langBtn, #langMiniToggle').forEach((link) => {
    if (!(link instanceof HTMLAnchorElement)) return;
    link.href = href;
    link.hreflang = next === 'zh' ? 'zh-CN' : 'en';
    link.setAttribute('aria-label', next === 'zh' ? '切换到中文' : 'Switch to English');
    if (link.id === 'langBtn') link.textContent = next === 'zh' ? '以中文入梦' : 'Dream in English';
    if (link.id === 'langMiniToggle') link.dataset.active = current;
    link.addEventListener('click', () => { setLocale(next); });
  });
}

function allowRichMotion() {
  const reducedMotion = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const compactOrTouch = typeof matchMedia === 'function'
    && matchMedia('(max-width: 860px), (pointer: coarse)').matches;
  const saveData = Boolean(navigator.connection?.saveData);
  const constrainedMemory = Number.isFinite(navigator.deviceMemory) && navigator.deviceMemory < 4;
  const constrainedCpu = Number.isFinite(navigator.hardwareConcurrency) && navigator.hardwareConcurrency < 4;
  return !reducedMotion && !compactOrTouch && !saveData && !constrainedMemory && !constrainedCpu;
}

export function loadHomeExperience() {
  if (!isSimulationFrame()) return Promise.reject(new Error('Simulation requires explicit entry'));
  if (experiencePromise) return experiencePromise;
  document.documentElement.dataset.homeExperience = 'loading';
  experiencePromise = import('./homeExperience.js')
    .then((module) => {
      document.documentElement.dataset.homeExperience = 'ready';
      return module;
    })
    .catch((error) => {
      document.documentElement.dataset.homeExperience = 'failed';
      document.body.classList.add('blackhole-failed');
      throw error;
    });
  return experiencePromise;
}

function installVisibilityLoaders() {
  const stardrive = document.getElementById('stardrive');
  const loadForge = () => { void import('./scene/alphardForge.js').then(({ initAlphardForge }) => initAlphardForge()).catch(() => {}); };
  if (!('IntersectionObserver' in window)) {
    if (stardrive && allowRichMotion()) window.setTimeout(loadForge, 1800);
    return;
  }

  if (stardrive && allowRichMotion()) {
    const forgeObserver = new IntersectionObserver((entries, observer) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      loadForge();
    }, { rootMargin: '80px 0px' });
    forgeObserver.observe(stardrive);
  }

}

function installNavigationMenu() {
  const menu = document.getElementById('portfolioMenu');
  const button = menu?.querySelector('summary');
  if (!menu || !button) return;
  const locale = getLocale('en');
  const routeLocale = localeFromPathname(location.pathname);
  const panel = menu.querySelector('.portfolio-menu-links');
  panel.replaceChildren(...NAV_ROUTES.map((route) => {
    const link = document.createElement('a');
    link.href = navigationHref(route.path, routeLocale);
    link.textContent = route[locale];
    if (normalizeRoutePath(route.path) === normalizeRoutePath(location.pathname)) link.setAttribute('aria-current', 'page');
    return link;
  }));
  button.textContent = locale === 'zh' ? '菜单' : 'Menu';
  const close = () => { menu.open = false; };
  document.addEventListener('click', (event) => { if (!menu.contains(event.target)) close(); });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.open) { close(); button.focus(); }
  });
  menu.addEventListener('focusout', (event) => { if (!menu.contains(event.relatedTarget)) close(); });
  panel.addEventListener('click', close);
  addEventListener('scroll', close, { passive: true });
}

initHomeMotionPreferences();
installLocaleLinks();
window.addEventListener('hashchange', () => {
  const next = getLocale('en') === 'zh' ? 'en' : 'zh';
  document.querySelectorAll('#langBtn, #langMiniToggle').forEach(link => { link.href = localeSwitchHref(location, next); });
});
installNavigationMenu();
installSimulationEntry(loadHomeExperience);
if (!isSimulationFrame()) {
  initPortfolioReading();
  installVisibilityLoaders();
}
initHomeScrollTelemetry();
initPortfolioChartGeometry();
initPortfolioChartInspector();

// Hero background is independent of the optional combat bundle. Its single
// renderer replaces the old worker, and owns only the explicit scene region.
const starfieldHost = document.getElementById('starfieldViewport');
if (starfieldHost && !isSimulationFrame()) {
  const intro = prepareStarfieldIntro(starfieldHost);
  let starfieldPromise;
  const queries = ['(prefers-reduced-motion: reduce)', '(max-width: 860px)', '(hover: hover) and (pointer: fine)'].map(query => matchMedia(query));
  const loadStarfield = () => {
    if (starfieldPromise || queries[0].matches || queries[1].matches || !queries[2].matches || navigator.connection?.saveData) return;
    starfieldPromise = import('./scene/backgroundScene.js').then(module => module.createBackgroundScene()).catch(() => {
      intro.cancel('module-failure');
      starfieldHost.dataset.state = 'fallback';
      document.getElementById('starfieldStatus').textContent = getLocale('en') === 'zh' ? '静态视图 · 图形暂不可用' : 'Static view · graphics unavailable';
    });
  };
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { loadStarfield(); if (starfieldPromise) observer.disconnect(); }
    });
    observer.observe(starfieldHost);
  } else loadStarfield();
  queries.forEach(query => query.addEventListener('change', loadStarfield));
}
