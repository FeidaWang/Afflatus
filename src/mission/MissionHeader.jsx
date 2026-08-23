import { useLayoutEffect, useRef } from 'react';
import { enhanceNavigation } from '../lib/nav.js';

export function missionHref(path, language) {
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  return path === '/' ? `/${language}/` : `/${language}${path}`;
}

export function MissionHeader({ language, routeId, routePath }) {
  const navigationRef = useRef(null);

  useLayoutEffect(() => {
    enhanceNavigation(navigationRef.current, language);
  }, [language]);

  const languageHref = missionHref(
    routePath || (routeId === 'flight-experiment' ? '/experiments/flight/' : '/command/'),
    language === 'en' ? 'zh' : 'en',
  );

  return (
    <header className="mission-header site-header--follow">
      <a className="afflatus-brand" data-afflatus-brand data-brand-persona={routeId} href="/" aria-label="AFFLATUS home">
        <span className="afflatus-brand__stage" aria-hidden="true">
          <span className="afflatus-brand__a">A</span><span className="afflatus-brand__before">ff</span><span className="afflatus-brand__l">l</span><span className="afflatus-brand__after">atus</span><span className="afflatus-brand__signal" /><span className="afflatus-brand__core" />
        </span>
        <span className="afflatus-brand__sr">Afflatus</span>
      </a>
      <nav ref={navigationRef} className="mission-nav" aria-label={language === 'zh' ? '主导航' : 'Primary navigation'} data-afflatus-nav>
        <a id="langBtn" className="lang-toggle mission-language" href={languageHref} hrefLang={language === 'en' ? 'zh-CN' : 'en'}>
          {language === 'en' ? 'EN / 中' : '中 / EN'}
        </a>
      </nav>
    </header>
  );
}
