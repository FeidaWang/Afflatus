import { getLocale, localeToHtmlLang, setLocale } from './localeStore.js';

/* ============================================================
   Afflatus shared bilingual engine (EN / 中文).
   - Persists choice through localeStore.js (`afflatus:locale:v1`) and
     migrates both historical keys once.
   - Translates any element carrying data-en / data-zh.
     • textContent by default; add data-i18n-html for innerHTML.
   - Wires every .lang-toggle button (place one top-right per page).
   - Fires window event 'afflatus-lang' so dynamic pages (arena.js) react.
   Tickers and the word "Afflatus" are intentionally left untranslated.
   ============================================================ */
(() => {
  'use strict';
  let lang = getLocale('en');

  function apply() {
    try { document.documentElement.lang = localeToHtmlLang(lang); } catch {}
    document.querySelectorAll('[data-en]').forEach((el) => {
      const v = lang === 'zh' ? (el.getAttribute('data-zh') ?? el.getAttribute('data-en')) : el.getAttribute('data-en');
      if (v == null) return;
      if (el.hasAttribute('data-i18n-html')) {
        if (el.innerHTML !== v) el.innerHTML = v;
      } else if (el.textContent !== v) {
        el.textContent = v;
      }
    });
    document.querySelectorAll('[data-en-ph]').forEach((el) => { el.setAttribute('placeholder', lang === 'zh' ? (el.getAttribute('data-zh-ph') || el.getAttribute('data-en-ph')) : el.getAttribute('data-en-ph')); });
    document.querySelectorAll('.lang-toggle').forEach((b) => { b.textContent = lang === 'zh' ? 'EN' : '中文'; b.setAttribute('aria-label', lang === 'zh' ? 'Switch to English' : '切换到中文'); b.setAttribute('aria-pressed', lang === 'zh'); });
  }
  function set(l) { lang = setLocale(l); apply(); try { window.dispatchEvent(new CustomEvent('afflatus-lang', { detail: lang })); } catch {} }
  window.AfflatusI18N = { get: () => lang, set, toggle: () => set(lang === 'zh' ? 'en' : 'zh'), apply };

  document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('.lang-toggle'); if (b) { e.preventDefault(); window.AfflatusI18N.toggle(); } });
  if (document.readyState !== 'loading') apply(); else document.addEventListener('DOMContentLoaded', apply);
})();
