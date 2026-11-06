import { navEntries } from './navEntries.js';
import { navigationHref } from './siteNavigation.js';

export const FOOTER_ABOUT = {
  en: 'A software engineer in Melbourne, designing, building and shipping working software with coding agents.',
  zh: '墨尔本的软件工程师，用编程智能体设计、构建并上线真实运行的软件。',
};

// Same destinations and icon artwork on every footer.
export const FOOTER_SOCIALS = [
  {
    href: 'https://www.linkedin.com/in/feida-wang/',
    label: 'LinkedIn',
    viewBox: '0 0 256 256',
    path: 'M216,24H40A16,16,0,0,0,24,40V216a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V40A16,16,0,0,0,216,24ZM96,176a8,8,0,0,1-16,0V112a8,8,0,0,1,16,0ZM88,96a12,12,0,1,1,12-12A12,12,0,0,1,88,96Zm96,80a8,8,0,0,1-16,0V140a20,20,0,0,0-40,0v36a8,8,0,0,1-16,0V112a8,8,0,0,1,15.79-1.78A36,36,0,0,1,184,140Z',
  },
  {
    href: 'https://github.com/FeidaWang',
    label: 'GitHub',
    viewBox: '0 0 256 256',
    path: 'M216,104v8a56.06,56.06,0,0,1-48.44,55.47A39.8,39.8,0,0,1,176,192v40a8,8,0,0,0-8,8H104a8,8,0,0,1-8-8V216H72a40,40,0,0,1-40-40A24,24,0,0,0,8,152a8,8,0,0,1,0-16,40,40,0,0,1,40,40,24,24,0,0,0,24,24H96v-8a39.8,39.8,0,0,1,8.44-24.53A56.06,56.06,0,0,1,56,112v-8a58.14,58.14,0,0,1,7.69-28.32A59.78,59.78,0,0,1,69.07,28,8,8,0,0,1,76,24a59.75,59.75,0,0,1,48,24h24a59.75,59.75,0,0,1,48-24,8,8,0,0,1,6.93,4,59.74,59.74,0,0,1,5.37,47.68A58,58,0,0,1,216,104Z',
  },
  {
    href: 'https://www.zhihu.com/people/ye-piao-xue',
    label: '知乎',
    viewBox: '0 0 24 24',
    path: 'M5.721 0C2.251 0 0 2.25 0 5.719V18.28C0 21.751 2.252 24 5.721 24h12.56C21.751 24 24 21.75 24 18.281V5.72C24 2.249 21.75 0 18.281 0zm1.964 4.078c-.271.73-.5 1.434-.68 2.11h4.587c.545-.006.445 1.168.445 1.171H9.384a58.104 58.104 0 01-.112 3.797h2.712c.388.023.393 1.251.393 1.266H9.183a9.223 9.223 0 01-.408 2.102l.757-.604c.452.456 1.512 1.712 1.906 2.177.473.681.063 2.081.063 2.081l-2.794-3.382c-.653 2.518-1.845 3.607-1.845 3.607-.523.468-1.58.82-2.64.516 2.218-1.73 3.44-3.917 3.667-6.497H4.491c0-.015.197-1.243.806-1.266h2.71c.024-.32.086-3.254.086-3.797H6.598c-.136.406-.158.447-.268.753-.594 1.095-1.603 1.122-1.907 1.155.906-1.821 1.416-3.6 1.591-4.064.425-1.124 1.671-1.125 1.671-1.125zM13.078 6h6.377v11.33h-2.573l-2.184 1.373-.401-1.373h-1.219zm1.313 1.219v8.86h.623l.263.937 1.455-.938h1.456v-8.86z',
  },
];

// Accordion sections mirror the header's top-level entries, so a single route is a section of one link.
export const footerGroups = () => navEntries().map(({ id, label, routes }) => ({ id, label, routes }));

// Adaptive pages keep unprefixed links; localize-site and the page scripts add the locale.
const adaptiveHref = route => route.publishedLocales ? navigationHref(route.path, 'en') : route.path;

export function renderSharedFooter(pagePath = '/') {
  const caret = '<svg class="pa-footer-caret" aria-hidden="true" viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" /></svg>';
  const groups = footerGroups().map(({ label, routes }) => `<details class="pa-footer-group">
        <summary><span data-en="${label.en}" data-zh="${label.zh}">${label.en}</span>${caret}</summary>
        <div class="pa-footer-group-links">${routes.map(route => `<a href="${adaptiveHref(route)}" data-en="${route.en}" data-zh="${route.zh}">${route.en}</a>`).join('')}</div>
      </details>`).join('\n      ');
  const socials = FOOTER_SOCIALS.map(({ href, label, viewBox, path }) => `<a href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${label}" data-i18n-static-aria><svg viewBox="${viewBox}" aria-hidden="true" focusable="false"><path d="${path}"/></svg></a>`).join('\n        ');
  return `<footer class="pa-footer">
  <div class="pa-footer-inner">
    <a class="pa-footer-brand" href="/" aria-label="AFFLATUS home" data-aria-en="AFFLATUS home" data-aria-zh="AFFLATUS 首页"><span class="pa-footer-brand-mark" aria-hidden="true"><span>A</span><span class="af-brand-i">I<span class="af-brand-underscore"></span></span></span></a>
    <nav class="pa-footer-pages" aria-label="Explore the site" data-aria-en="Explore the site" data-aria-zh="探索站点">
      ${groups}
    </nav>
    <div class="pa-footer-personal">
      <span class="pa-footer-copyright">© 2026 RSI AI</span>
      <nav class="pa-footer-socials" aria-label="Social profiles" data-aria-en="Social profiles" data-aria-zh="社交主页">
        ${socials}
      </nav>
    </div>
    <div class="pa-footer-about">
      <p class="pa-footer-title" data-en="About this site" data-zh="关于这个站">About this site</p>
      <p data-en="${FOOTER_ABOUT.en}" data-zh="${FOOTER_ABOUT.zh}">${FOOTER_ABOUT.en}</p>
    </div>
    <nav class="pa-footer-languages" aria-label="Language" data-aria-en="Language" data-aria-zh="语言">
      <p class="pa-footer-title" data-en="Language" data-zh="语言">Language</p>
      <a href="${navigationHref(pagePath, 'en')}" hreflang="en" lang="en" data-footer-language="en">English</a>
      <a href="${navigationHref(pagePath, 'zh')}" hreflang="zh-CN" lang="zh-CN" data-footer-language="zh">中文</a>
    </nav>
  </div>
</footer>`;
}
