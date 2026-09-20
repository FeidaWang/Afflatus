import { MediaMotion } from './MediaMotion.jsx';
import { HOME_NAV_GROUPS as navGroups, NAV_ROUTES } from '../config/navRoutes.generated.js';
import { navigationHref as siteHref } from '../lib/siteNavigation.js';
import { useEffect, useRef, useState } from "react";
import { fetchJson } from "../lib/fetchJson.js";
import { publishedCycles } from "../data/publishedCycles.generated.js";
import { chartScale } from "../ui/portfolioChartGeometry.js";
import { publishedSignal, signalPublicationLabel } from "../data/publishedSignal.js";
import {
  ArrowRight,
  CaretDown,
  GlobeHemisphereEast,
  List,
  X,
} from "@phosphor-icons/react";


const routePath = id => NAV_ROUTES.find(route => route.id === id).path;

const systems = [
  {
    index: "01",
    title: { en: "Capital", zh: "资本" },
    description: { en: "Model bounds, closed-cycle velocity and drawdown discipline.", zh: "以模型上界、闭环速度与回撤纪律约束资本。" },
    meta: { en: `${publishedCycles.length} disclosed closed cycles`, zh: `${publishedCycles.length} 个公开已结清周期` },
    href: `${routePath("portfolio")}#fy2026Performance`,
    action: { en: "Open flight record", zh: "查看飞行记录" },
  },
  {
    index: "02",
    title: { en: "Software", zh: "软件" },
    description: { en: "Field guides for recoverable agents and enterprise AI delivery.", zh: "面向可恢复智能体与企业 AI 交付的实战指南。" },
    meta: { en: "Field guides & learning paths", zh: "实战指南与学习路径" },
    href: routePath("course"),
    action: { en: "Open FDE course", zh: "打开 FDE 课程" },
  },
  {
    index: "03",
    title: { en: "Intelligence", zh: "情报" },
    description: { en: "QF-01 market intelligence with explicit provenance.", zh: "带明示来源的 QF-01 市场情报。" },
    meta: { en: "QF-01 · Paper research", zh: "QF-01 · 模拟研究" },
    href: routePath("arena"),
    action: { en: "Open research lab", zh: "进入研究实验室" },
  },
];

const principles = [
  ["01", { en: "Preserve capital.", zh: "保存资本。" }, { en: "Risk is a design constraint, not a surprise.", zh: "风险是设计约束，而不是意外。" }],
  ["02", { en: "Build systems.", zh: "构建系统。" }, { en: "Durable leverage comes from repeatable operating loops.", zh: "持久杠杆来自可重复的运营闭环。" }],
  ["03", { en: "Follow evidence.", zh: "遵循证据。" }, { en: "Primary records before slogans; provenance before confidence.", zh: "一手记录先于口号，来源先于确信。" }],
];

const showcaseCopy = {
  en: {
    hero: {
      eyebrow: "A PERSONAL ORBITAL ARCHIVE",
      title: <><span className="hero-title-line">Systems for</span><br /><span className="hero-title-line">uncertain worlds.</span></>,
      subtitle: "Capital, software and intelligence for long horizons.",
    },
    systems: "OPERATING SYSTEMS",
    systemAxis: "CAPITAL · SOFTWARE · INTELLIGENCE",
    transmissions: "SELECTED EVIDENCE",
    archive: "Open archive",
    featureEyebrow: "FEATURE · MARKET SIGNAL",
    featureTitle: <>Fed operations<br />&amp; the long end.</>,
    featureCta: "Read the evidence-first dossier",
    asOf: "AS OF",
    fieldEyebrow: "FIELD NOTE · FY25/26 FLIGHT RECORD",
    fieldTitle: "Return is not one number.",
    fieldBody: "It is a chain of assumptions: closed-cycle velocity, benchmark choice, holding duration and the drawdown required to stay in the route.",
    fieldBodyTwo: "Five closed-cycle summaries are published; account values, live positions and calculation details remain private.",
    fieldCta: "Inspect the method",
    chartTitle: "CLOSED-CYCLE OBSERVATIONS",
    chartReference: "REFERENCE: AFFLATUS / METHOD 2026.08.08",
    principles: "OPERATING PRINCIPLES",
    about: "ABOUT AFFLATUS",
    aboutTitle: "A personal command system.",
    aboutBody: "Built by Feida “Bruce” Wang in Melbourne for capital, code, original writing and long-range research. No ads. No tips. No promises.",
    portfolioCta: "Open the portfolio",
    uplink: "SIGNAL UPLINK",
    uplinkTitle: "Follow the evidence.",
    uplinkBody: "Start with the published Federal Reserve dossier, the QF-01 risk engine, or the Forward Deployed Engineer course.",
    heroUpdate: "FED OPERATIONS & THE LONG END",
    systemNominal: "PUBLIC RESEARCH ARCHIVE",
  },
  zh: {
    hero: {
      eyebrow: "个人轨道档案",
      title: <><span className="hero-title-line">为不确定的世界</span><br /><span className="hero-title-line">构建系统。</span></>,
      subtitle: "资本、软件与情报，为长期主义而建。",
    },
    systems: "运行系统",
    systemAxis: "资本 · 软件 · 情报",
    transmissions: "精选证据",
    archive: "打开档案",
    featureEyebrow: "重点 · 市场信号",
    featureTitle: <>美联储操作<br />与长端市场。</>,
    featureCta: "阅读证据优先档案",
    asOf: "截至",
    fieldEyebrow: "现场笔记 · FY25/26 飞行记录",
    fieldTitle: "回报从来不只一个数字。",
    fieldBody: "它由一连串假设构成：闭环速度、基准选择、持有时长，以及留在航线所需承受的回撤。",
    fieldBodyTwo: "公开五个已结清周期的摘要；账户数值、实时仓位与具体计算细节保持私密。",
    fieldCta: "查看方法",
    chartTitle: "已结清周期观测",
    chartReference: "参考：AFFLATUS / 方法 2026.08.08",
    principles: "运行原则",
    about: "关于 AFFLATUS",
    aboutTitle: "一套个人指挥系统。",
    aboutBody: "由 Feida “Bruce” Wang 在墨尔本构建，用于资本、代码、原创写作与长期研究。无广告、无荐股、无承诺。",
    portfolioCta: "打开作品集",
    uplink: "信号上行",
    uplinkTitle: "遵循证据。",
    uplinkBody: "从已发布的美联储档案、QF-01 风险引擎或前沿部署工程师课程开始。",
    heroUpdate: "美联储操作与长端市场",
    systemNominal: "公开研究档案",
  },
};

const pick = (value, language) => typeof value === "string" ? value : value[language];


function ExternalLink({ href, language, className = "", children, onClick }) {
  return (
    <a className={className} href={siteHref(href, language)} onClick={onClick}>
      {children}
      <ArrowRight aria-hidden="true" weight="thin" />
    </a>
  );
}

function Header({ language }) {
  const [openGroup, setOpenGroup] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef(null);
  const mobileRef = useRef(null);
  const groupRefs = useRef({});

  useEffect(() => {
    const closeOutside = (event) => {
      if (!headerRef.current?.contains(event.target)) {
        setOpenGroup(null);
        setMobileOpen(false);
      } else if (!event.target.closest('[data-nav-popover]')) setOpenGroup(null);
    };
    const resize = () => {
      if (headerRef.current?.querySelector('nav')?.contains(document.activeElement)) {
        if (window.innerWidth <= 980) mobileRef.current?.focus();
        else if (openGroup) groupRefs.current[openGroup]?.focus();
      }
      setOpenGroup(null);
      setMobileOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    window.addEventListener('resize', resize);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      window.removeEventListener('resize', resize);
    };
  }, [openGroup]);

  useEffect(() => {
    if (mobileOpen) headerRef.current?.querySelector('.nav-trigger')?.focus();
  }, [mobileOpen]);

  const translations = language === 'zh'
    ? { about: '关于', home: 'AFFLATUS 首页', open: '打开导航', close: '关闭导航', primaryNavigation: '主导航', switcher: '切换至英文' }
    : { about: 'About', home: 'AFFLATUS home', open: 'Open navigation', close: 'Close navigation', primaryNavigation: 'Primary navigation', switcher: 'Switch to Chinese' };
  const languageHref = `${language === 'en' ? '/zh/' : '/en/'}${window.location.search}${window.location.hash}`;
  const closeLinks = () => { setOpenGroup(null); setMobileOpen(false); };

  return (
    <header className="site-header" ref={headerRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) closeLinks();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        if (openGroup) {
          event.preventDefault(); event.stopPropagation();
          groupRefs.current[openGroup]?.focus();
          setOpenGroup(null);
        } else if (mobileOpen) {
          event.preventDefault(); event.stopPropagation();
          mobileRef.current?.focus();
          setMobileOpen(false);
        }
      }}>
      <a className="brand" href={siteHref('/', language)} aria-label={translations.home} aria-current="page">AFFLATUS</a>
      <nav data-afflatus-nav id="showcase-primary-nav" className={`desktop-nav ${mobileOpen ? 'is-mobile-open' : ''}`} aria-label={translations.primaryNavigation}>
        {navGroups.map((group) => (
          <div className="nav-cluster" data-nav-popover key={group.id}
            onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpenGroup(current => current === group.id ? null : current); }}>
            <button type="button" className="nav-trigger"
              ref={(node) => { groupRefs.current[group.id] = node; }}
              aria-controls={`showcase-nav-${group.id}`}
              aria-expanded={openGroup === group.id}
              onClick={() => setOpenGroup(openGroup === group.id ? null : group.id)}>
              {pick(group.label, language)}<CaretDown aria-hidden="true" weight="thin" />
            </button>
            <div id={`showcase-nav-${group.id}`} className="nav-popover" hidden={openGroup !== group.id}>
              {group.items.map(({ label, href }) => (
                <ExternalLink key={href} href={href} language={language} onClick={closeLinks}>{pick(label, language)}</ExternalLink>
              ))}
            </div>
          </div>
        ))}
        <a className="nav-about" href="#about" onClick={closeLinks}>{translations.about}</a>
      </nav>
      <div className="header-actions">
        <a id="langBtn" className="language-switch" href={languageHref}
          hreflang={language === 'en' ? 'zh-CN' : 'en'} aria-label={translations.switcher}>
          <GlobeHemisphereEast aria-hidden="true" weight="thin" />{language === 'en' ? 'EN / 中' : '中 / EN'}
        </a>
        <button type="button" className="mobile-menu" ref={mobileRef}
          aria-label={mobileOpen ? translations.close : translations.open}
          aria-controls="showcase-primary-nav" aria-expanded={mobileOpen}
          onClick={() => { setOpenGroup(null); setMobileOpen(!mobileOpen); }}>
          {mobileOpen ? <X aria-hidden="true" weight="thin" /> : <List aria-hidden="true" weight="thin" />}
        </button>
      </div>
    </header>
  );
}

function CycleChart({ language }) {
  const zh = language === 'zh';
  const days = chartScale(publishedCycles.map(row => row.holdingDays));
  const efficiency = chartScale(publishedCycles.map(row => row.efficiencyPercent));
  const x = value => `${14 + days.mark(value).point * .8}%`;
  const y = value => 222 - efficiency.mark(value).point * 1.9;
  const ticks = scale => Array.from({ length: 6 }, (_, i) => scale.min + (scale.max - scale.min) * i / 5);
  return <figure className="cycle-figure" aria-labelledby="cycle-summary-title" aria-describedby="cycle-method">
    <figcaption id="cycle-summary-title">{zh ? '五个公开已结清周期 · 独立观测点' : 'Five disclosed closed cycles · independent observations'}</figcaption>
    <p className="cycle-axis-title">{zh ? '模型年化效率（%）' : 'Modeled annualized efficiency (%)'}</p>
    <svg className="cycle-chart" role="img" aria-labelledby="cycle-plot-title cycle-plot-description">
      <title id="cycle-plot-title">{zh ? '持有天数与模型年化效率散点图' : 'Holding days versus modeled annualized efficiency'}</title>
      <desc id="cycle-plot-description">{zh ? '点号对应下表；各周期互不相连，不是账户净值或逐日收益曲线。' : 'Point IDs match the table below. Unconnected cycles are not an account equity or daily return curve.'}</desc>
      {ticks(efficiency).map(value => <g key={`y-${value}`}>
        <line x1="14%" x2="94%" y1={y(value)} y2={y(value)} className="cycle-grid" />
        <text x="11%" y={y(value) + 5} textAnchor="end">{value}</text>
      </g>)}
      {ticks(days).map(value => <g key={`x-${value}`}>
        <line x1={x(value)} x2={x(value)} y1="32" y2="222" className="cycle-grid" />
        <text x={x(value)} y="245" textAnchor="middle">{value}</text>
      </g>)}
      {publishedCycles.map(row => <g key={row.id} data-cycle-id={row.id} data-holding-days={row.holdingDays} data-efficiency-percent={row.efficiencyPercent}>
        <circle cx={x(row.holdingDays)} cy={y(row.efficiencyPercent)} r="4" />
        <text x={x(row.holdingDays)} y={y(row.efficiencyPercent) + (['01', '02'].includes(row.id) ? 20 : -12)} textAnchor="middle">{row.id}</text>
      </g>)}
    </svg>
    <p className="cycle-axis-title cycle-axis-x">{zh ? '持有天数（天）' : 'Holding duration (days)'}</p>
    <table className="cycle-table">
      <caption>{zh ? '散点图完整数据 · 与 Portfolio 公开摘要一致' : 'Complete scatter data · matches the Portfolio public summary'}</caption>
      <thead><tr><th scope="col">{zh ? '点号 / 标的' : 'ID / Asset'}</th><th scope="col">{zh ? '持有天数（天）' : 'Holding days'}</th><th scope="col">{zh ? '模型年化效率（%）' : 'Modeled annualized efficiency (%)'}</th></tr></thead>
      <tbody>{publishedCycles.map(row => <tr key={row.id} data-cycle-id={row.id}>
        <th scope="row">{row.id} · {row.asset}</th><td>{row.holdingDays.toFixed(1)}</td><td>{row.efficiencyPercent.toFixed(1)}%</td>
      </tr>)}</tbody>
    </table>
    <p id="cycle-method" className="cycle-method">{zh
      ? '来源：Portfolio 公开已结清周期摘要；2025–26 财年，精确截止日未披露。方法日期：2026-08-08。指标为模型年化效率，非账户实际收益，也非资金加权或时间加权收益。具体公式、输入和持有天数口径因隐私不公开，无法独立复算；不推算单笔收益。'
      : 'Source: Portfolio disclosed closed-cycle summary; FY2025–26, exact cutoff undisclosed. Method dated 2026-08-08. These are modeled annualized efficiencies, not achieved account, money-weighted or time-weighted returns. Formula, inputs and holding-day methodology remain private and cannot be independently reproduced; no individual returns are inferred.'}</p>
  </figure>;
}

export function App() {
  const language = window.location.pathname.startsWith("/zh/") ? "zh" : "en";
  const copy = showcaseCopy[language];
  const unavailable = language === "zh" ? "未提供" : "Unavailable";
  const [publication, setPublication] = useState(null);
  const [now, setNow] = useState(Date.now);
  const snapshot = publishedSignal(publication, now);
  const publicationLabel = signalPublicationLabel(snapshot, language);
  useEffect(() => {
    let active = true;
    fetchJson("signal").then((data) => { if (active) setPublication(data); }).catch(() => {});
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);

  return (
    <div className="site-root">
      <a className="skip-link" href="#home-content">{language === "zh" ? "跳至主要内容" : "Skip to content"}</a>
      <section className="hero" id="top">
        <img className="hero-image" src="/assets/showcase/blackhole-hero.jpg" alt="" fetchPriority="high" decoding="async" />
        <div className="hero-shade" aria-hidden="true" />
        <Header language={language} />
        <MediaMotion language={language} />
        <div className="hero-content">
          <span className="eyebrow">{copy.hero.eyebrow}</span>
          <h1>{copy.hero.title}</h1>
          <p>{copy.hero.subtitle}</p>
          <div className="hero-actions">
            <ExternalLink href={routePath("portfolio")} language={language} className="hero-action hero-action-primary">{language === "zh" ? "探索作品" : "Explore the work"}</ExternalLink>
            <ExternalLink href={routePath("signal")} language={language} className="hero-action">{language === "zh" ? "阅读研究" : "Read the research"}</ExternalLink>
          </div>
        </div>
      </section>

      <main id="home-content" tabIndex={-1}>
        <section className="systems section-shell" aria-labelledby="systems-title">
          <div className="section-heading">
            <span className="eyebrow" id="systems-title">{copy.systems}</span>
            <span>{copy.systemAxis}</span>
          </div>
          <div className="systems-grid">
            {systems.map((system) => (
              <article className="system-card" key={system.index}>
                <span className="system-index">{system.index}</span>
                <span className="system-rule" aria-hidden="true" />
                <h2>{pick(system.title, language)}</h2>
                <p>{pick(system.description, language)}</p>
                <small>{pick(system.meta, language)}</small>
                <ExternalLink href={system.href} language={language} className="editorial-link">{pick(system.action, language)}</ExternalLink>
              </article>
            ))}
          </div>
        </section>

        <section data-chapter-reveal className="transmissions section-shell" aria-labelledby="transmissions-title">
          <div className="section-heading">
            <span className="eyebrow" id="transmissions-title">{copy.transmissions}</span>
          </div>
          <article className="featured-transmission">
            <div>
              <span className="eyebrow">{copy.featureEyebrow}</span>
              <h2>{copy.featureTitle}</h2>
              <p>{snapshot.summary?.[language] ?? (language === "zh" ? "研究摘要暂不可用；请前往档案查看原始记录。" : "Research summary unavailable; open the archive for original records.")}</p>
              <ExternalLink href="/signal.html" language={language} className="editorial-link">{copy.featureCta}</ExternalLink>
            </div>
            <div className="feature-facts">
              <span><i>{language === "zh" ? "发布状态" : "PUBLICATION"}</i><b data-publication-source={snapshot.source} data-publication-state={snapshot.state}>{publicationLabel}</b></span>
              <span><i>{language === "zh" ? "来源" : "SOURCE"}</i><a href={snapshot.source}>signal-events.json</a></span>
              <span><i>{language === "zh" ? "原始获取时间" : "SOURCE RETRIEVED"}</i><b>{snapshot.retrievedAt ?? unavailable}</b></span>
            </div>
          </article>
        </section>

        <section data-chapter-reveal className="field-note" aria-labelledby="field-note-title">
          <div className="field-copy">
            <span className="eyebrow">{copy.fieldEyebrow}</span>
            <h2 id="field-note-title">{copy.fieldTitle}</h2>
            <p>{copy.fieldBody}</p>
            <p>{copy.fieldBodyTwo}</p>
            <ExternalLink href="/portfolio.html#fy2026Performance" language={language} className="editorial-link">{copy.fieldCta}</ExternalLink>
          </div>
          <div className="field-chart-wrap">
            <div className="chart-heading">
              <span>{copy.chartTitle}</span>
              <span>{copy.chartReference}</span>
            </div>
            <CycleChart language={language} />

          </div>
        </section>

        <section data-chapter-reveal className="recent-work section-shell" aria-labelledby="recent-title">
          <div className="section-heading"><h2 className="eyebrow" id="recent-title">{language === "zh" ? "有日期的发布记录" : "DATED PUBLICATION"}</h2></div>
          <p className="recent-note">{language === "zh" ? "日期来自公开档案；表示来源快照时间，不代表实时更新。" : "Dated from the public archive: the source snapshot time, not a live update."}</p>
          <div className="transmission-list">
            <ExternalLink href={routePath("signal")} language={language}>
              <span className="transmission-title">{copy.heroUpdate}</span>
              {snapshot.asOf ? <time dateTime={snapshot.asOf}>{snapshot.asOf.replace("T", " ").replace("Z", " UTC")}</time> : <span>{unavailable}</span>}
              <em>{language === "zh" ? "研究档案" : "Research archive"}</em>
            </ExternalLink>
          </div>
        </section>

        <section className="principles section-shell" aria-labelledby="principles-title">
          <div className="section-heading"><span className="eyebrow" id="principles-title">{copy.principles}</span></div>
          <div className="principles-grid">
            {principles.map(([index, title, description]) => (
              <article key={index}>
                <span>{index}</span>
                <h2>{pick(title, language)}</h2>
                <p>{pick(description, language)}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="site-footer section-shell" id="about">
        <div className="footer-grid">
          <section>
            <span className="eyebrow">{copy.about}</span>
            <h2>{copy.aboutTitle}</h2>
            <p>{copy.aboutBody}</p>
            <ExternalLink href="/portfolio.html" language={language} className="editorial-link">{copy.portfolioCta}</ExternalLink>
          </section>
          <section>
            <span className="eyebrow">{copy.uplink}</span>
            <h2>{copy.uplinkTitle}</h2>
            <p>{copy.uplinkBody}</p>
            <div className="footer-links">
              <ExternalLink href="/signal.html" language={language}>Signal</ExternalLink>
              <ExternalLink href="/arena.html" language={language}>Arena</ExternalLink>
              <ExternalLink href="/course.html" language={language}>Course</ExternalLink>
            </div>
          </section>
        </div>
        <div className="system-bar">
          <span>© 2026 AFFLATUS</span>
          <span>{copy.systemNominal}</span>
          <span>MELBOURNE, AUSTRALIA — EARTH / SOL-3</span>
        </div>
      </footer>
    </div>
  );
}
