import './styles.css';
import './cic-hud.css';
import './performance-dossier.css';
import './portfolio-convoy.css';
import './home-visual-upgrade.css';
import { getLocale, localeSwitchHref, setLocale } from './lib/localeStore.js';
import { initHomeScrollTelemetry } from './ui/homeScrollTelemetry.js';

const HOME_INTENT_SELECTOR = [
  '#commandModeBtn',
  '#heroCommandCta',
  '#voyageLogToggle',
  '[data-cic-panel-focus]',
  '[data-cic-weapon]',
].join(',');

let experiencePromise = null;
let experienceReady = false;

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

function loadBlackHoleObservatory() {
  if (!allowRichMotion()) return;
  const frame = document.getElementById('blackhole-gl');
  const source = frame?.dataset.src;
  if (frame && source && !frame.getAttribute('src')) frame.setAttribute('src', source);
}

export function loadHomeExperience() {
  if (experiencePromise) return experiencePromise;
  document.documentElement.dataset.homeExperience = 'loading';
  experiencePromise = import('./homeExperience.js')
    .then((module) => {
      experienceReady = true;
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

function loadRichHomeExperience() {
  loadBlackHoleObservatory();
  return loadHomeExperience();
}

function scheduleIdleExperience() {
  const start = () => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => { void loadHomeExperience().catch(() => {}); }, { timeout: 4000 });
    } else {
      void loadHomeExperience().catch(() => {});
    }
  };
  // Keep the optional combat runtime outside the initial vitals window. Any
  // explicit command intent below still loads it immediately.
  window.setTimeout(start, 8000);
}

function installIntentLoader() {
  document.addEventListener('pointerover', (event) => {
    if (event.target instanceof Element && event.target.closest(HOME_INTENT_SELECTOR)) {
      void loadRichHomeExperience().catch(() => {});
    }
  }, { capture: true, passive: true });

  document.addEventListener('focusin', (event) => {
    if (event.target instanceof Element && event.target.closest(HOME_INTENT_SELECTOR)) {
      void loadRichHomeExperience().catch(() => {});
    }
  }, { capture: true });

  document.addEventListener('click', async (event) => {
    if (experienceReady || !(event.target instanceof Element)) return;
    const target = event.target.closest(HOME_INTENT_SELECTOR);
    if (!(target instanceof HTMLElement)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      await loadRichHomeExperience();
      target.click();
    } catch {
      // Static navigation and portfolio content remain usable if enhancement fails.
    }
  }, { capture: true });
}

function installVisibilityLoaders() {
  const stardrive = document.getElementById('stardrive');
  const portfolio = document.getElementById('portfolioConvoy');
  if (!('IntersectionObserver' in window)) {
    if (stardrive && allowRichMotion()) {
      stardrive.classList.add('has-motion-shell');
      window.setTimeout(() => {
        void import('./scene/alphardForge.js')
          .then(({ initAlphardForge }) => {
            if (!initAlphardForge()) stardrive.classList.remove('has-motion-shell');
          })
          .catch(() => { stardrive.classList.remove('has-motion-shell'); });
      }, 1800);
    }
    if (portfolio) window.setTimeout(() => { void loadHomeExperience().catch(() => {}); }, 2200);
    return;
  }

  if (stardrive && allowRichMotion()) {
    // Reserve the complete scroll stage before Three.js arrives. This prevents
    // late module evaluation from doubling the section height under a restored
    // scroll position and keeps the enhancement inside the document flow.
    stardrive.classList.add('has-motion-shell');
    const forgeObserver = new IntersectionObserver((entries, observer) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void import('./scene/alphardForge.js')
        .then(({ initAlphardForge }) => {
          if (!initAlphardForge()) stardrive.classList.remove('has-motion-shell');
        })
        .catch(() => { stardrive.classList.remove('has-motion-shell'); });
    }, { rootMargin: '80px 0px' });
    forgeObserver.observe(stardrive);
  }

  if (portfolio) {
    const experienceObserver = new IntersectionObserver((entries, observer) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void loadHomeExperience().catch(() => {});
    }, { rootMargin: '240px 0px' });
    experienceObserver.observe(portfolio);
  }
}

function installNavigationMenu() {
  const button = document.querySelector('.nav-menu-btn');
  if (!(button instanceof HTMLElement)) return;
  const pages = (window.AfflatusSite?.length ? [...window.AfflatusSite] : [
    { path: '/', en: 'Home', zh: '首页' },
    { path: '/arena.html', en: 'Arena', zh: '竞技场' },
    { path: '/sectors.html', en: 'Sectors', zh: '板块' },
    { path: '/signal.html', en: 'Signal', zh: '信号' },
    { path: '/horoscope.html', en: 'Horoscope', zh: '观星' },
    { path: '/serial.html', en: 'Novels', zh: '小说' },
    { path: '/course.html', en: 'Course', zh: '课程' },
  ]);
  pages.push({ path: '/boot.html', en: 'Bridge Sim', zh: '舰桥模拟' });
  const normalizePath = (path) => (path || '/').replace(/index\.html$/u, '') || '/';
  const currentPath = normalizePath(location.pathname);
  let panel = null;

  function close() { panel?.classList.remove('open'); }
  function build() {
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'nav-labs__menu nav-site-menu';
      for (const page of pages) {
        const link = document.createElement('a');
        link.href = page.path;
        if (normalizePath(page.path) === currentPath) link.className = 'active';
        panel.appendChild(link);
      }
      document.body.appendChild(panel);
    }
    const locale = document.documentElement.lang.toLowerCase().startsWith('zh') ? 'zh' : 'en';
    panel.querySelectorAll('a').forEach((link, index) => {
      link.textContent = pages[index][locale];
    });
    return panel;
  }

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const menu = build();
    if (menu.classList.contains('open')) { close(); return; }
    const rect = button.getBoundingClientRect();
    menu.style.top = `${Math.round(rect.bottom + 8)}px`;
    menu.style.right = `${Math.max(8, Math.round(innerWidth - rect.right))}px`;
    menu.style.left = 'auto';
    menu.classList.add('open');
  });
  document.addEventListener('click', close);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
  addEventListener('scroll', close, { passive: true });
  addEventListener('resize', close);
}

function installHeroCommandShortcut() {
  const shortcut = document.getElementById('heroCommandCta');
  shortcut?.addEventListener('click', () => {
    document.getElementById('commandModeBtn')?.click();
  });
}

installLocaleLinks();
installNavigationMenu();
installHeroCommandShortcut();
installIntentLoader();
installVisibilityLoaders();
initHomeScrollTelemetry();
scheduleIdleExperience();
