/* ============================================================
   Afflatus shared bilingual engine (EN / 中文).
   - Persists choice in localStorage 'afflatus:lang' (shared by all pages).
   - Translates any element carrying data-en / data-zh.
     • textContent by default; add data-i18n-html for innerHTML.
   - Wires every .lang-toggle button (place one top-right per page).
   - Fires window event 'afflatus-lang' so dynamic pages (arena.js) react.
   Tickers and the word "Afflatus" are intentionally left untranslated.
   ============================================================ */
(() => {
  'use strict';
  const KEY = 'afflatus:lang';
  let lang = (() => { try { return localStorage.getItem(KEY) === 'zh' ? 'zh' : 'en'; } catch { return 'en'; } })();

  function apply() {
    try { document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'; } catch {}
    document.querySelectorAll('[data-en]').forEach((el) => {
      const v = lang === 'zh' ? (el.getAttribute('data-zh') ?? el.getAttribute('data-en')) : el.getAttribute('data-en');
      if (v == null) return;
      if (el.hasAttribute('data-i18n-html')) el.innerHTML = v; else el.textContent = v;
    });
    document.querySelectorAll('[data-en-ph]').forEach((el) => { el.setAttribute('placeholder', lang === 'zh' ? (el.getAttribute('data-zh-ph') || el.getAttribute('data-en-ph')) : el.getAttribute('data-en-ph')); });
    document.querySelectorAll('.lang-toggle').forEach((b) => { b.textContent = lang === 'zh' ? 'EN' : '中文'; b.setAttribute('aria-label', lang === 'zh' ? 'Switch to English' : '切换到中文'); b.setAttribute('aria-pressed', lang === 'zh'); });
  }
  function set(l) { lang = (l === 'zh') ? 'zh' : 'en'; try { localStorage.setItem(KEY, lang); } catch {} apply(); try { window.dispatchEvent(new CustomEvent('afflatus-lang', { detail: lang })); } catch {} }
  window.AfflatusI18N = { get: () => lang, set, toggle: () => set(lang === 'zh' ? 'en' : 'zh'), apply };

  document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('.lang-toggle'); if (b) { e.preventDefault(); window.AfflatusI18N.toggle(); } });
  if (document.readyState !== 'loading') apply(); else document.addEventListener('DOMContentLoaded', apply);
})();
