import { COMMAND_ENTRY, PRIMARY_NAVIGATION, primaryNavigationForRoute } from '../config/primaryNavigation.js';
import { NAV_ROUTES, normalizeRoutePath } from '../config/navRoutes.generated.js';
import { getLocale, localeFromPathname, localizePathname } from './localeStore.js';

let enhanceNavigationImpl = () => {};

// React-owned route shells call this in a layout effect so the complete
// navigation is present before first paint. Legacy documents still use the
// module's DOMContentLoaded bootstrap below.
export function enhanceNavigation(nav, locale) {
  enhanceNavigationImpl(nav, locale);
}

/*
 * M03 shared primary navigation.
 *
 * The route manifest still lists every destination. This module renders the
 * smaller five-concept model from primaryNavigation.js, which maps the old
 * Markets, Lab and Writing groupings to Intelligence, Experiments and Field
 * Notes without moving or deleting their pages.
 */
(() => {
  'use strict';

  const here = normalizeRoutePath(location.pathname);
  const currentRoute = NAV_ROUTES.find((route) => normalizeRoutePath(route.path) === here);
  const currentPrimary = primaryNavigationForRoute(currentRoute?.id);
  const routeLocale = localeFromPathname(location.pathname);

  function routeHref(path) {
    const [pathname, hash = ''] = String(path).split('#', 2);
    const localPath = routeLocale ? localizePathname(pathname || '/', routeLocale) : (pathname || '/');
    return `${localPath}${hash ? `#${hash}` : ''}`;
  }

  function label(item, locale) {
    return locale === 'zh' ? item.zh : item.en;
  }

  function closeMenu(nav, { returnFocus = false } = {}) {
    if (!nav.classList.contains('is-menu-open')) return;
    nav.classList.remove('is-menu-open');
    const toggle = nav.querySelector('.afflatus-nav-toggle');
    toggle?.setAttribute('aria-expanded', 'false');
    if (returnFocus) toggle?.focus();
  }

  function closeAllMenus(options) {
    document.querySelectorAll('[data-afflatus-nav].is-menu-open')
      .forEach((nav) => closeMenu(nav, options));
  }

  function render(nav, locale) {
    if (!nav) return;
    const oldLanguageControl = nav.querySelector('.lang-toggle');
    const menuId = `afflatus-primary-menu-${Math.random().toString(36).slice(2, 9)}`;
    const links = document.createElement('div');
    links.className = 'afflatus-nav-links';
    links.id = menuId;

    PRIMARY_NAVIGATION.forEach((item) => {
      const anchor = document.createElement('a');
      anchor.href = routeHref(item.path);
      anchor.dataset.en = item.en;
      anchor.dataset.zh = item.zh;
      anchor.textContent = label(item, locale);
      if (item.id === currentPrimary?.id) anchor.setAttribute('aria-current', 'page');
      links.appendChild(anchor);
    });

    const command = document.createElement('a');
    command.className = 'afflatus-command-cta';
    command.href = routeHref(COMMAND_ENTRY.path);
    command.dataset.en = COMMAND_ENTRY.en;
    command.dataset.zh = COMMAND_ENTRY.zh;
    command.textContent = label(COMMAND_ENTRY, locale);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'afflatus-nav-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', menuId);
    toggle.setAttribute('aria-label', locale === 'zh' ? '打开主导航' : 'Open primary navigation');
    toggle.dataset.ariaEn = 'Open primary navigation';
    toggle.dataset.ariaZh = '打开主导航';
    toggle.innerHTML = '<span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>';

    nav.classList.add('afflatus-primary-nav');
    nav.setAttribute('aria-label', locale === 'zh' ? '主导航' : 'Primary navigation');
    nav.replaceChildren(toggle, links, command);

    if (oldLanguageControl) {
      oldLanguageControl.disabled = false;
      nav.appendChild(oldLanguageControl);
    }

    toggle.addEventListener('click', () => {
      const nextOpen = !nav.classList.contains('is-menu-open');
      closeAllMenus();
      nav.classList.toggle('is-menu-open', nextOpen);
      toggle.setAttribute('aria-expanded', String(nextOpen));
      if (nextOpen && matchMedia('(max-width: 47.5rem)').matches) {
        links.querySelector('a')?.focus();
      }
    });

    links.addEventListener('click', () => closeMenu(nav));
  }

  enhanceNavigationImpl = render;

  function applyLocale(locale = getLocale('en')) {
    const language = locale === 'zh' ? 'zh' : 'en';
    document.querySelectorAll('[data-afflatus-nav] [data-en][data-zh]').forEach((element) => {
      element.textContent = element.dataset[language];
    });
    document.querySelectorAll('[data-afflatus-nav] [data-aria-en][data-aria-zh]').forEach((element) => {
      element.setAttribute('aria-label', element.dataset[`aria${language === 'zh' ? 'Zh' : 'En'}`]);
    });
  }

  function run() {
    const locale = routeLocale || getLocale('en');
    document.querySelectorAll('[data-afflatus-nav]').forEach((nav) => render(nav, locale));
    document.addEventListener('click', (event) => {
      if (!event.target.closest('[data-afflatus-nav]')) closeAllMenus();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeAllMenus({ returnFocus: true });
    });
    window.addEventListener('resize', () => closeAllMenus());
    window.AfflatusNav = Object.freeze({ applyLocale });
    try { window.AfflatusI18N?.apply(); } catch {}
    applyLocale(locale);
  }

  if (document.readyState !== 'loading') run();
  else document.addEventListener('DOMContentLoaded', run, { once: true });
})();
