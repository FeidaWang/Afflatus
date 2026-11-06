import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from '@phosphor-icons/react';
import { navigationHref, navigationLabel } from '../lib/siteNavigation.js';
import { getLocale } from '../lib/localeStore.js';
import { FilmPlayer } from './FilmPlayer.jsx';
import { HOME_LATEST } from '../config/homeLatest.generated.js';
import { LATEST_ACTIONS, LATEST_HEADING, LEARN_CARDS, LEARN_HEADING } from './homeCards.js';
import { PremiereFooter } from './PremiereFooter.jsx';

function SiteLink({ href, language, children }) {
  return <a className="text-link" href={navigationHref(href, language)}><span>{children}</span><ArrowRight aria-hidden="true" /></a>;
}
// loading="lazy" still fetches these at page load, inside the browser's distance
// threshold, and those requests delay the film poster's paint.
function LearnCover({ image, width, height }) {
  const cover = useRef(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setNear(true); }, { rootMargin: '600px' });
    observer.observe(cover.current);
    return () => observer.disconnect();
  }, []);
  return <>
    <img ref={cover} src={near ? image : undefined} width={width} height={height} alt="" decoding="async" />
    <noscript><img src={image} width={width} height={height} alt="" /></noscript>
  </>;
}
export function App({ language: initialLanguage } = {}) {
  const language = initialLanguage || getLocale(document.documentElement.lang.startsWith('zh') ? 'zh' : 'en');
  const zh = language === 'zh';
  return <>
    <a className="skip-link" href="#home-content">{zh ? '跳至主要内容' : 'Skip to content'}</a>
    <main id="home-content" className="site-root" tabIndex={-1}>
      <section className="premiere" id="top" aria-labelledby="home-title">
        <div className="premiere-intro section-shell">
          <h1 id="home-title">{zh ? <><span>从这颗星球，</span><span>驶向更远的</span><span>地方。</span></> : <><span>From this world,</span>{' '}<span>into what comes</span>{' '}<span>next.</span></>}</h1>
          <div className="premiere-copy">
            <p className="premiere-role">{zh ? '王飞达 · AI 工程、编程智能体与研究' : 'Feida Wang · AI engineering, agentic coding & research'}</p>
            <p>{zh ? '关于我们写下的故事、亲手做出的作品，以及理解这个世界的新方法。' : 'Stories we write, things we build, and new ways to understand the world around us.'}</p>
            <SiteLink href="/portfolio.html" language={language}>{zh ? '探索作品' : 'Explore the work'}</SiteLink>
          </div>
        </div>
        <FilmPlayer language={language} />
      </section>
      <section className="home-latest section-shell" id="major-releases" aria-labelledby="latest-title">
        <div className="section-heading"><h2 id="latest-title">{LATEST_HEADING.title[language]}</h2><p>{LATEST_HEADING.note[language]}</p></div>
        <div className="home-latest-grid">{HOME_LATEST.map(({ href, date, title, summary }) => <article key={href} className="home-card">
          <p className="home-card-meta"><span>{navigationLabel(href)[language]}</span>{date && <time dateTime={date.iso}>{date.label[language]}</time>}</p>
          <h3>{title[language]}</h3>
          <p className="home-card-summary">{summary[language]}</p>
          <a className="home-card-action" href={navigationHref(href, language)}><span>{LATEST_ACTIONS[href][language]}</span><ArrowRight aria-hidden="true" /></a>
        </article>)}</div>
      </section>
      <section className="home-learn section-shell" id="learn-more" aria-labelledby="learn-title">
        <h2 id="learn-title">{LEARN_HEADING[language]}</h2>
        <div className="home-learn-grid">{LEARN_CARDS.map(({ href, image, width, height, title, summary }) => <a key={href} className="home-learn-card" href={navigationHref(href, language)}>
          <span className="home-learn-label">{navigationLabel(href)[language]}</span>
          <LearnCover image={image} width={width} height={height} />
          <h3>{title[language]}</h3>
          <p>{summary[language]}</p>
        </a>)}</div>
      </section>
    </main>
    <PremiereFooter language={language} />
  </>;
}
