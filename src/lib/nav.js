import { NAV_ROUTES, normalizeRoutePath } from '../config/navRoutes.generated.js';
import { getLocale, localeFromPathname, localizePathname } from './localeStore.js';

/* ============================================================
   Afflatus shared navigation — SINGLE SOURCE OF TRUTH.

   To add / reorder / rename a page, edit ONLY src/config/siteManifest.js.
   Every public page just needs:
     • <nav class="nav" data-afflatus-nav> … keep your .lang-toggle … </nav>
       (the page links are rendered into it; the current page gets .active)
   Linear previous/next controls were removed in favour of the primary nav:
   they duplicated the same routes, occupied the reading margins and made
   unmodified arrow keys navigate unexpectedly.
   ============================================================ */
(() => {
  'use strict';

  // `group: 'labs'` pages render as a dropdown under one "Labs" trigger.
  // NAV_ROUTES is derived from the manifest and already sorted by nav.order.
  const SITE = NAV_ROUTES;
  const LABS_LABEL = { en: 'Labs', zh: '实验室' };
  const MOBILE_MENU_LABEL = { en: 'Menu', zh: '菜单' };
  const mobileNavControllers = [];
  // Exposed read-only for consumers that need route metadata without the DOM
  // rendering behaviour below.
  window.AfflatusSite = SITE.slice();

  const norm = normalizeRoutePath;
  const here = norm(location.pathname);
  const routeLocale = localeFromPathname(location.pathname);
  const routeHref = (route) => {
    const path = typeof route === 'string' ? route : route.path;
    if (!routeLocale) return path;
    const publishedLocales = typeof route === 'string' ? null : route.publishedLocales;
    const locale = publishedLocales && !publishedLocales.includes(routeLocale)
      ? publishedLocales[0]
      : routeLocale;
    return localizePathname(path, locale);
  };
  let i = SITE.findIndex((s) => norm(s.path) === here);
  if (i < 0) i = 0;

  function applyLocale(locale = getLocale('en')) {
    const lang = locale === 'zh' ? 'zh' : 'en';
    document.querySelectorAll('[data-afflatus-nav] [data-en][data-zh], .nav-labs__menu [data-en][data-zh]')
      .forEach((el) => { el.textContent = el.dataset[lang]; });
  }

  window.AfflatusNav = Object.freeze({ applyLocale });

  function run() {
    const renderedLocale = routeLocale || getLocale('en');
    // render the primary nav links from SITE (active = current page),
    // inserted BEFORE any existing children (e.g. the page's .lang-toggle).
    // `group: 'labs'` entries collapse into a single dropdown trigger at the
    // position of the first one encountered, instead of their own link.
    document.querySelectorAll('[data-afflatus-nav]').forEach((navEl) => {
      navEl.querySelectorAll('[data-afflatus-static-nav]').forEach((node) => node.remove());
      const frag = document.createDocumentFragment();
      let labsWrap = null;
      let labsMenu = null;
      let labsTrigger = null;
      SITE.forEach((s, idx) => {
        // U12b (2026-07-11): the home page's own nav no longer renders a
        // link to itself — it's redundant there (you're already on it) and
        // was the 5th button cluttering the home hero's top bar. Every other
        // page keeps its Home link exactly as before, so this only skips rendering when
        // `here` (the current page) IS home.
        if (s.path === '/' && here === '/') return;
        const a = document.createElement('a');
        a.setAttribute('href', routeHref(s));
        a.setAttribute('data-en', s.en);
        a.setAttribute('data-zh', s.zh);
        a.textContent = renderedLocale === 'zh' ? s.zh : s.en;
        if (idx === i) a.className = 'active';

        if (s.group === 'labs') {
          if (!labsWrap) {
            labsWrap = document.createElement('div');
            labsWrap.className = 'nav-labs';
            // <a href="#"> (not <button>) so it inherits each page's existing
            // ".nav a" / ".nav a:hover" / ".nav a.active" styling for free —
            // no per-page CSS needed for the trigger's look. transition.js's
            // click interceptor already ignores href="#" links (see its
            // internal() check), so this never triggers page navigation.
            labsTrigger = document.createElement('a');
            labsTrigger.href = '#';
            labsTrigger.className = 'nav-labs__trigger';
            labsTrigger.setAttribute('role', 'button');
            labsTrigger.setAttribute('data-en', LABS_LABEL.en);
            labsTrigger.setAttribute('data-zh', LABS_LABEL.zh);
            labsTrigger.setAttribute('aria-haspopup', 'true');
            labsTrigger.setAttribute('aria-expanded', 'false');
            labsTrigger.textContent = LABS_LABEL[renderedLocale];

            // The dropdown PANEL is portaled to a direct child of <body>
            // (position:fixed, positioned via JS from the trigger's own
            // rect) instead of nesting inside .nav-labs. Two per-page
            // ancestors were silently hiding it when it stayed nested:
            // games.html's header (.top) has a decorative clip-path that
            // slices away anything painted below the header edge, and the
            // home page's <nav> only reaches z-index:100 while several HUD
            // layers (.battle-feed, warnings, etc.) sit at 900+ — a
            // descendant can never out-rank ancestors it's capped inside.
            // Portaling sidesteps both: the panel is clipped/capped by
            // nothing but the viewport. See run()'s open/close handlers
            // below for how open state now travels via JS instead of pure
            // CSS :hover/:focus-within (which required real DOM nesting).
            labsMenu = document.createElement('div');
            labsMenu.className = 'nav-labs__menu';
            document.body.appendChild(labsMenu);

            let clickPinned = false;
            const openMenu = ({ pin = false } = {}) => {
              closeLabsMenus(labsMenu);
              positionLabsMenu(labsTrigger, labsMenu);
              labsWrap.classList.add('open');
              labsMenu.classList.add('open');
              labsTrigger.setAttribute('aria-expanded', 'true');
              if (pin) clickPinned = true;
            };
            const closeMenu = () => {
              clickPinned = false;
              labsWrap.classList.remove('open');
              labsMenu.classList.remove('open');
              labsTrigger.setAttribute('aria-expanded', 'false');
            };
            labsMenu._afflatusClose = closeMenu;

            let closeTimer = null;
            const cancelClose = () => { if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; } };
            const scheduleClose = () => { cancelClose(); closeTimer = setTimeout(closeMenu, 160); };

            labsTrigger.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (labsMenu.classList.contains('open') && clickPinned) closeMenu();
              else openMenu({ pin: true });
            });
            labsTrigger.addEventListener('mouseenter', () => { cancelClose(); openMenu(); });
            labsTrigger.addEventListener('mouseleave', () => { if (!clickPinned) scheduleClose(); });
            labsMenu.addEventListener('mouseenter', cancelClose);
            labsMenu.addEventListener('mouseleave', () => { if (!clickPinned) scheduleClose(); });
            labsTrigger.addEventListener('focus', openMenu);
            labsWrap.addEventListener('focusout', (e) => {
              if (!labsMenu.contains(e.relatedTarget) && e.relatedTarget !== labsTrigger) closeMenu();
            });
            labsMenu.addEventListener('focusout', (e) => {
              if (!labsMenu.contains(e.relatedTarget) && e.relatedTarget !== labsTrigger) closeMenu();
            });

            labsWrap.appendChild(labsTrigger);
            frag.appendChild(labsWrap);
          }
          labsMenu.appendChild(a);
          if (idx === i) { labsWrap.classList.add('active'); labsTrigger.classList.add('active'); }
        } else {
          frag.appendChild(a);
        }
      });
      navEl.insertBefore(frag, navEl.firstChild);
      installMobileDisclosure(navEl, renderedLocale);
    });

    // close any open Labs menu on an outside click, Escape, scroll or resize
    // (scroll/resize would leave a stale-positioned fixed panel behind)
    document.addEventListener('click', () => {
      closeLabsMenus();
      closeMobileNavs();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      closeLabsMenus();
      closeMobileNavs({ restoreFocus:true });
    });
    window.addEventListener('scroll', () => {
      closeLabsMenus();
      closeMobileNavs();
    }, { passive: true });
    window.addEventListener('resize', () => {
      closeLabsMenus();
      closeMobileNavs();
    });

    // translate freshly-rendered links to the current language
    try { if (window.AfflatusI18N) window.AfflatusI18N.apply(); } catch (e) {}
    applyLocale(renderedLocale);
  }

  function installMobileDisclosure(navEl, renderedLocale) {
    if (document.body.matches('.showcase-page, .home-page')) return;
    const header = navEl.closest('.site-header--follow');
    if (!header || header.querySelector(':scope > .afflatus-mobile-nav-toggle')) return;
    const menuId = navEl.id || `afflatus-primary-nav-${mobileNavControllers.length + 1}`;
    navEl.id = menuId;
    navEl.classList.add('afflatus-mobile-nav-panel');

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'afflatus-mobile-nav-toggle';
    toggle.setAttribute('aria-controls', menuId);
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', renderedLocale === 'zh' ? '打开主导航' : 'Open primary navigation');
    toggle.textContent = MOBILE_MENU_LABEL[renderedLocale === 'zh' ? 'zh' : 'en'];
    header.appendChild(toggle);
    document.documentElement.classList.add('afflatus-nav-enhanced');

    const close = ({ restoreFocus = false } = {}) => {
      if (!header.classList.contains('mobile-nav-open')) return;
      header.classList.remove('mobile-nav-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', renderedLocale === 'zh' ? '打开主导航' : 'Open primary navigation');
      if (restoreFocus) toggle.focus();
    };
    const open = () => {
      closeMobileNavs({ except:header });
      const rect = header.getBoundingClientRect();
      navEl.style.setProperty('--afflatus-mobile-nav-top', `${Math.round(rect.bottom + 8)}px`);
      header.classList.add('mobile-nav-open');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', renderedLocale === 'zh' ? '关闭主导航' : 'Close primary navigation');
    };
    mobileNavControllers.push({ header, close });

    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      if (header.classList.contains('mobile-nav-open')) close();
      else open();
    });
    navEl.addEventListener('click', (event) => {
      event.stopPropagation();
      const link = event.target.closest('a, button');
      if (!link || link.classList.contains('nav-labs__trigger')) return;
      close();
    });
  }

  function closeMobileNavs({ except = null, restoreFocus = false } = {}) {
    mobileNavControllers.forEach((controller) => {
      if (controller.header !== except) controller.close({ restoreFocus });
    });
  }

  // Anchors the portaled panel under its trigger using the trigger's own
  // viewport rect, right-aligned to match the old in-flow "right:0" look.
  function positionLabsMenu(trigger, menu) {
    const r = trigger.getBoundingClientRect();
    menu.style.top = Math.round(r.bottom + 8) + 'px';
    menu.style.right = Math.max(8, Math.round(window.innerWidth - r.right)) + 'px';
    menu.style.left = 'auto';
  }

  function closeLabsMenus(except) {
    document.querySelectorAll('.nav-labs__menu.open').forEach((m) => {
      if (m === except) return;
      if (m._afflatusClose) m._afflatusClose();
    });
  }

  if (document.readyState !== 'loading') run();
  else document.addEventListener('DOMContentLoaded', run);
})();
