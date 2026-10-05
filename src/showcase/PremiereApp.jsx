import { ArrowRight } from '@phosphor-icons/react';
import { navigationHref } from '../lib/siteNavigation.js';
import { getLocale } from '../lib/localeStore.js';
import { FilmPlayer } from './FilmPlayer.jsx';
import { PremiereFooter } from './PremiereFooter.jsx';

const work = [
  { href: '/sectors.html', en: 'AI industry atlas', zh: 'AI 产业图谱' },
  { href: '/course.html', en: 'FDE 0→1', zh: 'FDE 0→1' },
  { href: '/serial.html', en: 'A library of stories', zh: '原创故事书架' },
];
function SiteLink({ href, language, children }) {
  return <a className="text-link" href={navigationHref(href, language)}><span>{children}</span><ArrowRight aria-hidden="true" /></a>;
}
export function App() {
  const language = getLocale(document.documentElement.lang.startsWith('zh') ? 'zh' : 'en');
  const zh = language === 'zh';
  return <>
    <a className="skip-link" href="#home-content">{zh ? '跳至主要内容' : 'Skip to content'}</a>
    <main id="home-content" className="site-root" tabIndex={-1}>
      <section className="premiere" id="top" aria-labelledby="home-title">
        <div className="premiere-intro section-shell">
          <h1 id="home-title">{zh ? <><span>从这颗星球，</span><span>驶向更远的</span><span>地方。</span></> : <><span>From this world,</span>{' '}<span>into what comes</span>{' '}<span>next.</span></>}</h1>
          <div className="premiere-copy">
            <p>{zh ? '关于我们写下的故事、亲手做出的作品，以及理解这个世界的新方法。' : 'Stories we write, things we build, and new ways to understand the world around us.'}</p>
            <SiteLink href="/portfolio.html" language={language}>{zh ? '探索作品' : 'Explore the work'}</SiteLink>
          </div>
        </div>
        <FilmPlayer language={language} />
      </section>
      <section className="latest-work section-shell" id="major-releases" aria-labelledby="latest-title">
        <div className="section-heading"><h2 id="latest-title">{zh ? '最新作品' : 'Latest work'}</h2><p>{zh ? '用想法、研究与作品，走向更开阔的明天。' : 'Ideas, research and projects for a more open tomorrow.'}</p></div>
        <div className="work-grid">{work.map((item, index) => <a key={item.href} className="work-item" href={navigationHref(item.href, language)}>
          <span className="work-number">0{index + 1}</span><span className="work-title">{item[language]}</span><ArrowRight aria-hidden="true" />
        </a>)}</div>
      </section>
      <section className="home-essay section-shell" id="key-articles" aria-labelledby="essay-title">
        <p className="eyebrow">{zh ? '研究笔记' : 'A FIELD NOTE'}</p>
        <div className="essay-grid"><h2 id="essay-title">{zh ? '每一个判断，都需要被证伪的可能。' : 'Every thesis needs a way to be wrong.'}</h2><div>
          <p>{zh ? '区分测量、披露、计算与假设，让缺失的证据也清晰可见。' : 'Keep measurements, disclosures, calculations and hypotheses separate, then make the missing evidence visible.'}</p>
          <SiteLink href="/sectors.html#evidence" language={language}>{zh ? '阅读研究' : 'Read the research'}</SiteLink>
        </div></div>
      </section>
      <section className="destinations section-shell" id="destinations" aria-labelledby="destinations-title">
        <h2 id="destinations-title">{zh ? '找到你的入口。' : 'Find your way in.'}</h2>
        <nav aria-label={zh ? '站点入口' : 'Explore AFFLATUS'}>{[['/serial.html', 'Stories', '故事'], ['/portfolio.html', 'Portfolio', '作品集'], ['/course.html', 'Learn', '学习'], ['/arena.html', 'Markets', '市场']].map(([href, en, cn]) => <SiteLink key={href} href={href} language={language}>{zh ? cn : en}</SiteLink>)}</nav>
      </section>
    </main>
    <PremiereFooter language={language} />
  </>;
}
