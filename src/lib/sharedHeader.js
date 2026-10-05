import { navigationHref } from './siteNavigation.js';

const text = (en, zh) => `<span class="af-nav-label" data-en="${en}" data-zh="${zh}">${en}</span>`;
export function renderSharedHeader() {
  const link = (path, en, zh, extra = '') => `<a href="${navigationHref(path, 'en')}" data-header-path="${path}" ${extra}>${text(en, zh)}</a>`;
  const caret = '<svg class="af-nav-caret" aria-hidden="true" viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" /></svg>';
  const group = (id, en, zh, links) => `<div class="af-header-group"><button type="button" data-header-disclosure aria-expanded="false" aria-controls="af-${id}">${text(en, zh)}${caret}</button><div class="af-header-dropdown" id="af-${id}">${links}</div></div>`;
  const homeLink = '<a class="af-wordmark" href="/en/" data-header-path="/" aria-label="AFFLATUS home" data-aria-en="AFFLATUS home" data-aria-zh="AFFLATUS 首页"><span class="af-brand-art" aria-hidden="true"><span class="af-brand-full">AFFLATUS</span><span class="af-brand-compact"><span class="af-brand-a">A</span><span class="af-brand-i">I<span class="af-brand-underscore"></span></span></span></span></a>';
  return `<header id="afflatus-header" data-afflatus-header>
  <div class="af-header-inner">
    ${homeLink}
    <nav class="af-header-nav" id="af-primary-nav" aria-label="Primary navigation" data-aria-en="Primary navigation" data-aria-zh="主导航">
      ${link('/portfolio.html', 'Work', '作品')}
      ${group('markets', 'Markets', '市场', link('/arena.html', 'Stock observation', '股票观察') + link('/sectors.html', 'AI industry', 'AI 产业') + link('/signal.html', 'Economic updates', '经济动态'))}
      ${link('/course.html', 'Learn', '学习')}
      ${link('/serial.html', 'Stories', '故事', 'title="Original stories in Chinese / 原创中文小说"')}
      ${group('more', 'More', '更多', link('/horoscope.html', 'Astrology for fun', '趣味占星') + link('/#about', 'About', '关于'))}
    </nav>
    <a class="af-header-language" data-header-language href="/zh/" hreflang="zh-CN" aria-label="Switch to Chinese" data-aria-en="Switch to Chinese" data-aria-zh="切换至英文">中文</a>
    <button type="button" class="af-header-menu" data-header-disclosure aria-expanded="false" aria-controls="af-primary-nav" aria-label="Open navigation" data-aria-en="Open navigation" data-aria-zh="打开导航"><svg class="af-menu-icon" aria-hidden="true" focusable="false" viewBox="0 0 32 24"><path d="M2 2h28M2 12h28M2 22h12" /></svg></button>
  </div>
</header>`;
}
