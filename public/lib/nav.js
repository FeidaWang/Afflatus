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

  const SITE = [
    { path: '/',             en: 'Home',    zh: '首页' },
    { path: '/arena.html',   en: 'Arena',   zh: '竞技场' },
    { path: '/sectors.html', en: 'Sectors', zh: '板块' },
    { path: '/signal.html',  en: 'Signal',  zh: '信号' },
    { path: '/games.html',   en: 'Games',   zh: '竞猜' },
    { path: '/novels.html',  en: 'Novels',  zh: '小说' }
  ];
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
    // inserted BEFORE any existing children (e.g. the page's .lang-toggle)
    document.querySelectorAll('[data-afflatus-nav]').forEach((navEl) => {
      const frag = document.createDocumentFragment();
      SITE.forEach((s, idx) => {
        const a = document.createElement('a');
        a.setAttribute('href', s.path);
        a.setAttribute('data-en', s.en);
        a.setAttribute('data-zh', s.zh);
        a.textContent = s.en;
        if (idx === i) a.className = 'active';
        frag.appendChild(a);
      });
      navEl.insertBefore(frag, navEl.firstChild);
    });

    // translate freshly-rendered links to the current language
    try { if (window.AfflatusI18N) window.AfflatusI18N.apply(); } catch (e) {}
  }

  if (document.readyState !== 'loading') run();
  else document.addEventListener('DOMContentLoaded', run);
})();
