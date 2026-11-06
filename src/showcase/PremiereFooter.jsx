import { navigationHref } from '../lib/siteNavigation.js';
import { FOOTER_ABOUT, FOOTER_SOCIALS, footerGroups } from '../lib/sharedFooter.js';

export function PremiereFooter({ language }) {
  const zh = language === 'zh';
  return <footer className="pa-footer">
    <div className="pa-footer-inner">
      <a className="pa-footer-brand" href={navigationHref('/', language)} aria-label={zh ? 'AFFLATUS 首页' : 'AFFLATUS home'}>
        <span className="pa-footer-brand-mark" aria-hidden="true"><span>A</span><span className="af-brand-i">I<span className="af-brand-underscore" /></span></span>
      </a>
      <nav className="pa-footer-pages" aria-label={zh ? '探索站点' : 'Explore the site'}>
        {footerGroups().map(({ id, label, routes }) => <details key={id} className="pa-footer-group">
          <summary><span>{label[language]}</span><svg className="pa-footer-caret" aria-hidden="true" viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" /></svg></summary>
          <div className="pa-footer-group-links">{routes.map(route => <a key={route.path} href={navigationHref(route.path, language)}>{route[language]}</a>)}</div>
        </details>)}
      </nav>
      <div className="pa-footer-personal">
        <span className="pa-footer-copyright">© {new Date().getFullYear()} RSI AI</span>
        <nav className="pa-footer-socials" aria-label={zh ? '社交主页' : 'Social profiles'}>
          {FOOTER_SOCIALS.map(social => <a key={social.href} href={social.href} target="_blank" rel="noopener noreferrer" aria-label={social.label}>
            <svg viewBox={social.viewBox} aria-hidden="true" focusable="false"><path d={social.path} /></svg>
          </a>)}
        </nav>
      </div>
      <div className="pa-footer-about">
        <p className="pa-footer-title">{zh ? '关于这个站' : 'About this site'}</p>
        <p>{FOOTER_ABOUT[language]}</p>
      </div>
      <nav className="pa-footer-languages" aria-label={zh ? '语言' : 'Language'}>
        <p className="pa-footer-title">{zh ? '语言' : 'Language'}</p>
        <a href={navigationHref('/', 'en')} hrefLang="en" lang="en" data-footer-language="en">English</a>
        <a href={navigationHref('/', 'zh')} hrefLang="zh-CN" lang="zh-CN" data-footer-language="zh">中文</a>
      </nav>
    </div>
  </footer>;
}
