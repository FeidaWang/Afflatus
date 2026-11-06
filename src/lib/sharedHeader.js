import { NAV_GROUPS, NAV_ROUTES } from '../config/navRoutes.generated.js';
import { navigationHref } from './siteNavigation.js';

const text = (en, zh) => `<span class="af-nav-label" data-en="${en}" data-zh="${zh}">${en}</span>`;
export function renderSharedHeader() {
  const link = ({ path, en, zh, title, sublabel }) => `<a href="${navigationHref(path, 'en')}" data-header-path="${path}"${title ? ` title="${title}"` : ''}>${text(en, zh)}${sublabel ? `<span class="af-nav-sublabel" data-en="${sublabel.en}" data-zh="${sublabel.zh}">${sublabel.en}</span>` : ''}</a>`;
  const caret = '<svg class="af-nav-caret" aria-hidden="true" viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" /></svg>';
  // Desktop uses the disclosure button; the compact menu shows the title above an always-open list.
  const group = (id, routes) => { const { en, zh } = NAV_GROUPS[id]; return `<div class="af-header-group"><button type="button" data-header-disclosure aria-expanded="false" aria-controls="af-${id}">${text(en, zh)}${caret}</button><span class="af-header-group-title" data-en="${en}" data-zh="${zh}">${en}</span><div class="af-header-dropdown" id="af-${id}">${routes.map(link).join('')}</div></div>`; };
  const destinations = NAV_ROUTES.filter(route => route.path !== '/');
  // A group sits where its first route falls in nav order.
  const entries = destinations
    .filter((route, index) => !route.group || destinations.findIndex(other => other.group === route.group) === index)
    .map(route => route.group ? group(route.group, destinations.filter(other => other.group === route.group)) : link(route));
  const homeLink = '<a class="af-wordmark" href="/en/" data-header-path="/" aria-label="AFFLATUS home" data-aria-en="AFFLATUS home" data-aria-zh="AFFLATUS 首页"><span class="af-brand-art" aria-hidden="true"><span class="af-brand-full">AFFLATUS</span><span class="af-brand-compact"><span class="af-brand-a">A</span><span class="af-brand-i">I<span class="af-brand-underscore"></span></span></span></span></a>';
  return `<header id="afflatus-header" data-afflatus-header>
  <div class="af-header-inner">
    ${homeLink}
    <nav class="af-header-nav" id="af-primary-nav" aria-label="Primary navigation" data-aria-en="Primary navigation" data-aria-zh="主导航">
      ${entries.join('\n      ')}
    </nav>
    <a class="af-header-language" data-header-language href="/zh/" hreflang="zh-CN" aria-label="Switch to Chinese" data-aria-en="Switch to Chinese" data-aria-zh="切换至英文">中文</a>
    <button type="button" class="af-header-menu" data-header-disclosure aria-expanded="false" aria-controls="af-primary-nav" aria-label="Open navigation" data-aria-en="Open navigation" data-aria-zh="打开导航"><svg class="af-menu-icon" aria-hidden="true" focusable="false" viewBox="0 0 32 24"><path d="M1 2h30M1 12h30M1 22h13" /></svg></button>
  </div>
</header>`;
}
