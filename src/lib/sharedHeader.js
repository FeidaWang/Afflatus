import { navigationHref, navigationLabel } from './siteNavigation.js';

const text = (en, zh) => `<span class="af-nav-label" data-en="${en}" data-zh="${zh}">${en}</span>`;
export function renderSharedHeader() {
  const link = (path, extra = '') => { const { en, zh } = navigationLabel(path); return `<a href="${navigationHref(path, 'en')}" data-header-path="${path}" ${extra}>${text(en, zh)}</a>`; };
  const caret = '<svg class="af-nav-caret" aria-hidden="true" viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" /></svg>';
  const group = (id, en, zh, links) => `<div class="af-header-group"><button type="button" data-header-disclosure aria-expanded="false" aria-controls="af-${id}">${text(en, zh)}${caret}</button><div class="af-header-dropdown" id="af-${id}">${links}</div></div>`;
  const homeLink = '<a class="af-wordmark" href="/en/" data-header-path="/" aria-label="AFFLATUS home" data-aria-en="AFFLATUS home" data-aria-zh="AFFLATUS 首页"><span class="af-brand-art" aria-hidden="true"><span class="af-brand-full">AFFLATUS</span><span class="af-brand-compact"><span class="af-brand-a">A</span><span class="af-brand-i">I<span class="af-brand-underscore"></span></span></span></span></a>';
  return `<header id="afflatus-header" data-afflatus-header>
  <div class="af-header-inner">
    ${homeLink}
    <nav class="af-header-nav" id="af-primary-nav" aria-label="Primary navigation" data-aria-en="Primary navigation" data-aria-zh="主导航">
      ${link('/portfolio.html')}
      ${group('markets', 'Markets', '市场', link('/arena.html') + link('/sectors.html') + link('/signal.html'))}
      ${link('/course.html')}
      ${link('/serial.html', 'title="Original stories in Chinese / 原创中文小说"')}
      ${link('/horoscope.html')}
      ${link('/worlds.html')}
      ${link('/about.html')}
    </nav>
    <a class="af-header-language" data-header-language href="/zh/" hreflang="zh-CN" aria-label="Switch to Chinese" data-aria-en="Switch to Chinese" data-aria-zh="切换至英文">中文</a>
    <button type="button" class="af-header-menu" data-header-disclosure aria-expanded="false" aria-controls="af-primary-nav" aria-label="Open navigation" data-aria-en="Open navigation" data-aria-zh="打开导航"><svg class="af-menu-icon" aria-hidden="true" focusable="false" viewBox="0 0 32 24"><path d="M1 2h30M1 12h30M1 22h13" /></svg></button>
  </div>
</header>`;
}
