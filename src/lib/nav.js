import { NAV_ROUTES, normalizeRoutePath } from '../config/navRoutes.generated.js';
import { getLocale, localeSwitchHref, setLocale } from './localeStore.js';
import { navigationHref } from './siteNavigation.js';
import '../../public/lib/header-controller.js';

window.AfflatusSite = NAV_ROUTES.slice();
function applyLocale(locale = getLocale('en')) {
  const header = document.querySelector('[data-afflatus-header]');
  if (!header) return;
  const chineseStory = location.pathname.includes('/novels/') || location.pathname.endsWith('/serial.html');
  const lang = chineseStory || locale === 'zh' ? 'zh' : 'en';
  header.querySelectorAll('[data-en][data-zh]').forEach(node => { node.textContent = node.dataset[lang]; });
  header.querySelectorAll('[data-aria-en]').forEach(node => { node.setAttribute('aria-label', node.dataset[lang === 'zh' ? 'ariaZh' : 'ariaEn']); });
  header.querySelectorAll('[data-header-path]').forEach(link => {
    link.href = navigationHref(link.dataset.headerPath, lang);
    if (!link.dataset.headerPath.includes('#') && normalizeRoutePath(link.dataset.headerPath) === normalizeRoutePath(chineseStory ? '/serial.html' : location.pathname)) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  const language = header.querySelector('[data-header-language]');
  const next = lang === 'zh' ? 'en' : 'zh';
  language.href = localeSwitchHref(location, next);
  language.textContent = next === 'zh' ? '中文' : 'EN';
  if (chineseStory) {
    language.href = localeSwitchHref(location, 'zh');
    language.textContent = '仅中文';
    language.title = 'Original text is published in Chinese only / 小说原文仅有中文';
    language.dataset.ariaEn = 'Original text is published in Chinese only';
    language.dataset.ariaZh = '小说原文仅有中文';
    language.setAttribute('aria-label', language.dataset.ariaZh);
    language.setAttribute('aria-disabled', 'true');
  }
  language.hreflang = chineseStory || next === 'zh' ? 'zh-CN' : 'en';
}
window.AfflatusNav = Object.freeze({ applyLocale });
window.addEventListener('afflatus-lang', event => applyLocale(event.detail));
window.addEventListener('hashchange', () => applyLocale());
window.addEventListener('popstate', () => applyLocale());
window.addEventListener('afflatus-locationchange', () => applyLocale());
applyLocale();

document.querySelector('[data-header-language]')?.addEventListener('click', event => {
  if (event.currentTarget.getAttribute('aria-disabled') === 'true') { event.preventDefault(); return; }
  const next = document.querySelector('[data-header-language]').hreflang.startsWith('zh') ? 'zh' : 'en';
  setLocale(next);
});
