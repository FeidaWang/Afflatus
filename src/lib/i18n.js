import {
  getLocale,
  localeSwitchHref,
  localeToHtmlLang,
  setLocale,
} from './localeStore.js';

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
    document.querySelectorAll('[data-aria-en]').forEach((el) => {
      const value = lang === 'zh'
        ? (el.getAttribute('data-aria-zh') || el.getAttribute('data-aria-en'))
        : el.getAttribute('data-aria-en');
      if (value != null) el.setAttribute('aria-label', value);
    });
    document.querySelectorAll('.lang-toggle').forEach((b) => {
      const nextLocale = lang === 'zh' ? 'en' : 'zh';
      b.textContent = nextLocale === 'zh' ? '中文' : 'EN';
      b.setAttribute('aria-label', nextLocale === 'zh' ? '切换到中文' : 'Switch to English');
      if (b.matches('a[href]')) {
        // Fixed-locale builds turn this control into a real cross-locale link.
        // aria-pressed is valid for the adaptive button, but not for an anchor.
        b.removeAttribute('aria-pressed');
        b.setAttribute('href', localeSwitchHref(window.location, nextLocale));
        b.setAttribute('hreflang', nextLocale === 'zh' ? 'zh-CN' : 'en');
      } else {
        b.setAttribute('aria-pressed', lang === 'zh');
      }
    });
  }
  function set(l) {
    lang = setLocale(l);
    const href = localeSwitchHref(window.location, lang);
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== href) {
      document.documentElement.classList.add('vt-suppress');
      window.location.assign(href);
      return;
    }
    apply();
    try { window.dispatchEvent(new CustomEvent('afflatus-lang', { detail: lang })); } catch {}
  }
  window.AfflatusI18N = { get: () => lang, set, toggle: () => set(lang === 'zh' ? 'en' : 'zh'), apply };

  document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('.lang-toggle'); if (b) { e.preventDefault(); window.AfflatusI18N.toggle(); } });
  if (document.readyState !== 'loading') apply(); else document.addEventListener('DOMContentLoaded', apply);
})();
