/* ============================================================
   Afflatus shared navigation — SINGLE SOURCE OF TRUTH.

   To add / reorder / rename a page, edit ONLY the SITE array below.
   Every public page just needs:
     • <nav class="nav" data-afflatus-nav> … keep your .lang-toggle … </nav>
       (the page links are rendered into it; the current page gets .active)
     • the usual <nav class="page-turn-controls"> arrows with
       data-page-turn="prev"/"next" (their href is filled in here)
   This script derives the cyclic prev/next, sets body.dataset.prev/next
   (read by page-turn.js for keyboard turns) and the arrow hrefs — so the
   per-page nav links and prev/next chain never need hand-editing again.

   Load order on each page: i18n.js → lib/nav.js → page-turn.js (all defer).
   ============================================================ */
(() => {
  'use strict';

  // `group: 'labs'` pages render as a dropdown under one "Labs" trigger in
  // the top nav instead of their own top-level link (see run() below).
  // Future seasonal / experimental pages should be added here with the same
  // group tag — nothing else needs to change to make them show up in Labs.
  // prev/next page-turn order is unaffected: it still walks SITE flat, so
  // arrow-key/click paging still visits every page in this exact order.
  const SITE = [
    { path: '/',             en: 'Home',    zh: '首页' },
    { path: '/arena.html',   en: 'Arena',   zh: '竞技场' },
    { path: '/sectors.html', en: 'Sectors', zh: '板块' },
    { path: '/signal.html',  en: 'Signal',  zh: '信号' },
    { path: '/games.html',   en: 'Games',   zh: '竞猜',   group: 'labs' },
    { path: '/league.html',  en: 'Leagues', zh: '电竞',   group: 'labs' },
    { path: '/serial.html',  en: 'Novels',  zh: '小说',   group: 'labs' }
  ];
  const LABS_LABEL = { en: 'Labs', zh: '实验室' };
  // Exposed read-only for consumers that can't use the full DOM-rendering
  // behaviour below (e.g. index.html's own nav, which has its own bilingual
  // system instead of i18n.js/data-en/data-zh). Everything else in this file
  // is unchanged for the five pages already using it.
  window.AfflatusSite = SITE.slice();

  const norm = (p) => { p = (p || '/').replace(/index\.html$/, ''); return p === '' ? '/' : p; };
  const here = norm(location.pathname);
  let i = SITE.findIndex((s) => norm(s.path) === here);
  if (i < 0) i = 0;
  const n = SITE.length;
  const prev = SITE[(i - 1 + n) % n].path;
  const next = SITE[(i + 1) % n].path;

  function run() {
    // prev/next: keyboard (body.dataset, read by page-turn.js) + arrow clicks
    document.body.dataset.prev = prev;
    document.body.dataset.next = next;
    document.querySelectorAll('[data-page-turn="prev"]').forEach((a) => a.setAttribute('href', prev));
    document.querySelectorAll('[data-page-turn="next"]').forEach((a) => a.setAttribute('href', next));

    // render the primary nav links from SITE (active = current page),
    // inserted BEFORE any existing children (e.g. the page's .lang-toggle).
    // `group: 'labs'` entries collapse into a single dropdown trigger at the
    // position of the first one encountered, instead of their own link.
    document.querySelectorAll('[data-afflatus-nav]').forEach((navEl) => {
      const frag = document.createDocumentFragment();
      let labsWrap = null;
      let labsMenu = null;
      let labsTrigger = null;
      SITE.forEach((s, idx) => {
        const a = document.createElement('a');
        a.setAttribute('href', s.path);
        a.setAttribute('data-en', s.en);
        a.setAttribute('data-zh', s.zh);
        a.textContent = s.en;
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
            labsTrigger.textContent = LABS_LABEL.en;

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

            const openMenu = () => {
              closeLabsMenus(labsMenu);
              positionLabsMenu(labsTrigger, labsMenu);
              labsWrap.classList.add('open');
              labsMenu.classList.add('open');
              labsTrigger.setAttribute('aria-expanded', 'true');
            };
            const closeMenu = () => {
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
              if (labsMenu.classList.contains('open')) closeMenu(); else openMenu();
            });
            labsTrigger.addEventListener('mouseenter', () => { cancelClose(); openMenu(); });
            labsTrigger.addEventListener('mouseleave', scheduleClose);
            labsMenu.addEventListener('mouseenter', cancelClose);
            labsMenu.addEventListener('mouseleave', scheduleClose);
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
    });

    // close any open Labs menu on an outside click, Escape, scroll or resize
    // (scroll/resize would leave a stale-positioned fixed panel behind)
    document.addEventListener('click', () => closeLabsMenus());
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLabsMenus(); });
    window.addEventListener('scroll', () => closeLabsMenus(), { passive: true });
    window.addEventListener('resize', () => closeLabsMenus());

    // translate freshly-rendered links to the current language
    try { if (window.AfflatusI18N) window.AfflatusI18N.apply(); } catch (e) {}
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
