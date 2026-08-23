import { useEffect, useRef, useState } from "react";
import { GlobeHemisphereEast, List, X } from "@phosphor-icons/react";
import { COMMAND_ENTRY, PRIMARY_NAVIGATION } from "../config/primaryNavigation.js";
import { ExperienceRoot } from "./experience/ExperienceRoot.jsx";
import { FocusBoundary } from "./primitives/FocusBoundary.jsx";
import {
  CommandButton,
  EditorialLink,
  MotionToggle,
  TransmissionRow,
  useMotionPreference,
} from "./primitives/InteractionPrimitives.jsx";
import { useDisclosureMenu } from "./primitives/useDisclosureMenu.js";

const systems = [
  {
    index: "01",
    signal: "capital",
    title: { en: "Capital", zh: "资本" },
    description: {
      en: "Model bounds, closed-cycle velocity and drawdown discipline for decisions that must survive uncertainty.",
      zh: "以模型边界、闭环速度与回撤纪律，约束必须穿越不确定性的决策。",
    },
    href: "/capital/",
    action: { en: "Open field record", zh: "查看现场记录" },
  },
  {
    index: "02",
    signal: "software",
    title: { en: "Software", zh: "软件" },
    description: {
      en: "Field guides for recoverable agents, evidence-led delivery and durable operating loops.",
      zh: "面向可恢复智能体、证据驱动交付与持久运行闭环的实战指南。",
    },
    href: "/field-notes/",
    action: { en: "Open field notes", zh: "打开现场笔记" },
  },
  {
    index: "03",
    signal: "intelligence",
    title: { en: "Intelligence", zh: "情报" },
    description: {
      en: "Market and industry intelligence with explicit provenance, uncertainty and review windows.",
      zh: "明确标注来源、不确定性与复核窗口的市场和产业情报。",
    },
    href: "/intelligence/",
    action: { en: "Open intelligence", zh: "打开情报" },
  },
];

const transmissions = [
  {
    title: { en: "The model war is price, power and distribution.", zh: "模型战争的核心是价格、算力与分发。" },
    date: "2026.08.08",
    href: "/sectors.html",
  },
  {
    title: { en: "A risk engine, not another stock picker.", zh: "这是风险引擎，不是又一个选股器。" },
    date: "2026.08.08",
    href: "/arena.html",
  },
  {
    title: { en: "The drawdown taught me what speed costs.", zh: "回撤让我看清速度的代价。" },
    date: "2026.08.08",
    href: "/portfolio.html#fy2026Performance",
  },
];

const showcaseCopy = {
  en: {
    chapters: {
      coldVoid: "Cold Void",
      approach: "The Approach",
      drift: "Parallel Drift / Operating Systems",
      aperture: "Bridge Aperture / Current Intelligence",
      wake: "The Wake / Field Record",
      departure: "Departure / Manifesto",
    },
    heroTitle: <>Systems for<br />uncertain worlds.</>,
    heroBody: "Capital, software and intelligence for long horizons.",
    heroCta: "Explore systems",
    currentSignal: "Current signal",
    currentSignalTitle: "Fed operations and the long end",
    approachTitle: "Clarity before velocity.",
    approachBody: "AFFLATUS is a personal operating system for decisions that unfold over long horizons. It joins capital discipline, software practice and evidence-led intelligence without pretending uncertainty can be removed.",
    approachStatement: "Observe the field. Define the boundary. Move only when the evidence earns motion.",
    approachStatus: "Approach vector / stable",
    systemsTitle: "Three systems, one operating posture.",
    systemsBody: "Each system remains independently useful. Together they form a repeatable loop: allocate carefully, build recoverably, and update beliefs from primary evidence.",
    intelligenceTitle: "The current picture, with its limits visible.",
    intelligenceBody: "Current posture: restrictive hold, ample-reserve implementation. The 10-year and 30-year yields remain market-priced—not administratively capped.",
    intelligenceCta: "Read the evidence-first dossier",
    relatedSignals: "Related transmissions",
    fieldTitle: "Return is not one number.",
    fieldBody: "It is a chain of assumptions: closed-cycle velocity, benchmark choice, holding duration and the drawdown required to remain on the route.",
    fieldBodyTwo: "Five completed trajectories are published without account values or live positions. The full method remains in the existing field record.",
    fieldMarker: "05 verified closed-cycle entries · method 2026.08.08",
    fieldCta: "Inspect the method",
    manifestoTitle: "Preserve capital. Build systems. Follow evidence.",
    manifestoBody: "Risk is a design constraint, not a surprise. Durable leverage comes from repeatable operating loops. Primary records come before slogans, and provenance before confidence.",
    aboutTitle: "A personal command system from Melbourne.",
    aboutBody: "Built by Feida “Bruce” Wang for capital, code, original writing and long-range research. No ads. No tips. No promises.",
    portfolioCta: "Open the portfolio",
    finalCommand: "Enter Command",
    commandTitle: "Command remains a deliberate entry.",
    commandBody: "The public Mission Room separates real objectives, trajectories and actions from the experimental flight simulation.",
    commandCta: "Open the Mission Room",
    closeCommand: "Close command preview",
    language: "Language",
    motion: "Motion · system preference",
    disclosure: "Privacy / Disclosure",
    disclosureBody: "AFFLATUS publishes methods and selected records, not account values, live positions or personal tracking profiles.",
    nominal: "ALL SYSTEMS NOMINAL",
  },
  zh: {
    chapters: {
      coldVoid: "寂静虚空",
      approach: "接近",
      drift: "平行漂移 / 运行系统",
      aperture: "舰桥光阑 / 当前情报",
      wake: "尾迹 / 现场记录",
      departure: "离航 / 宣言",
    },
    heroTitle: <>为不确定的世界<br />构建系统。</>,
    heroBody: "资本、软件与情报，为长期主义而建。",
    heroCta: "探索系统",
    currentSignal: "当前信号",
    currentSignalTitle: "美联储操作与长端市场",
    approachTitle: "先有清晰，再谈速度。",
    approachBody: "AFFLATUS 是一套面向长期决策的个人运行系统。它把资本纪律、软件实践与证据驱动的情报连接起来，同时承认不确定性无法被消除。",
    approachStatement: "观察现场，定义边界；只有证据足以支撑行动时，才开始移动。",
    approachStatus: "接近航向 / 稳定",
    systemsTitle: "三个系统，一种运行姿态。",
    systemsBody: "每个系统都能独立工作；组合起来则形成可重复闭环：谨慎配置、可恢复地构建，并依据一手证据更新判断。",
    intelligenceTitle: "呈现当前图景，也呈现它的边界。",
    intelligenceBody: "当前立场：限制性利率维持，充足准备金框架继续运行。10 年与 30 年期收益率仍由市场定价，并非行政设限。",
    intelligenceCta: "阅读证据优先档案",
    relatedSignals: "相关传输",
    fieldTitle: "回报从来不只一个数字。",
    fieldBody: "它由一连串假设构成：闭环速度、基准选择、持有时长，以及留在航线所需承受的回撤。",
    fieldBodyTwo: "五条已完成轨迹公开方法，但不公开账户数值或实时仓位。完整方法仍保留在既有现场记录中。",
    fieldMarker: "05 条已验证闭环记录 · 方法 2026.08.08",
    fieldCta: "查看方法",
    manifestoTitle: "保存资本。构建系统。遵循证据。",
    manifestoBody: "风险是设计约束，而不是意外。持久杠杆来自可重复的运行闭环。一手记录先于口号，来源先于确信。",
    aboutTitle: "一套来自墨尔本的个人指挥系统。",
    aboutBody: "由 Feida “Bruce” Wang 构建，用于资本、代码、原创写作与长期研究。无广告、无荐股、无承诺。",
    portfolioCta: "打开作品集",
    finalCommand: "进入指挥舱",
    commandTitle: "Command 始终是一次有意识的进入。",
    commandBody: "公开 Mission Room 将真实目标、轨迹与行动同实验性飞行模拟明确分开。",
    commandCta: "打开任务舱",
    closeCommand: "关闭指挥预览",
    language: "语言",
    motion: "动态效果 · 跟随系统偏好",
    disclosure: "隐私 / 披露",
    disclosureBody: "AFFLATUS 发布方法与经过选择的记录，不发布账户数值、实时仓位或个人追踪档案。",
    nominal: "所有系统正常",
  },
};

const pick = (value, language) => typeof value === "string" ? value : value[language];

function siteHref(path, language) {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  return path === "/" ? `/${language}/` : `/${language}${path}`;
}

function ChapterLabel({ index, children }) {
  return <p className="chapter-label"><span>{index}</span>{children}</p>;
}

function Header({ commandRef, language, motion, onOpenCommand }) {
  const mobileMenuRef = useRef(null);
  const mobileMenu = useDisclosureMenu(mobileMenuRef);

  const translations = language === "zh"
    ? { menu: "打开主导航", closeMenu: "关闭主导航", switcher: "切换至英文" }
    : { menu: "Open primary navigation", closeMenu: "Close primary navigation", switcher: "Switch to Chinese" };
  const languageHref = `${language === "en" ? "/zh/" : "/en/"}${window.location.search}${window.location.hash}`;

  return (
    <header className="site-header">
      <a className="brand" href={siteHref("/", language)} aria-label="AFFLATUS home">AFFLATUS</a>
      <nav id="primary-navigation" className={`desktop-nav ${mobileMenu.open ? "is-mobile-open" : ""}`} aria-label="Primary navigation" data-afflatus-nav>
        {PRIMARY_NAVIGATION.map((item) => (
          <a
            className="primary-nav-link"
            href={siteHref(item.path, language)}
            key={item.id}
            aria-current={item.routeIds?.includes("main") ? "page" : undefined}
            onClick={mobileMenu.close}
          >
            {pick(item, language)}
          </a>
        ))}
      </nav>
      <div className="header-actions">
        <MotionToggle
          className="header-motion-toggle"
          disabled={motion.locked}
          enabled={motion.enabled}
          language={language}
          onToggle={motion.setEnabled}
        />
        <CommandButton
          ref={commandRef}
          className="deck-primary"
          motionEnabled={motion.enabled}
          onCommandIntent={onOpenCommand}
          sceneSignal="command:open"
        >
          {pick(COMMAND_ENTRY, language)}
        </CommandButton>
        <a id="langBtn" className="language-switch" href={languageHref} hrefLang={language === "en" ? "zh-CN" : "en"} aria-label={translations.switcher}>
          <GlobeHemisphereEast aria-hidden="true" weight="thin" />
          {language === "en" ? "EN / 中" : "中 / EN"}
        </a>
        <button
          type="button"
          className="mobile-menu"
          ref={mobileMenuRef}
          aria-controls="primary-navigation"
          aria-label={mobileMenu.open ? translations.closeMenu : translations.menu}
          aria-expanded={mobileMenu.open}
          onClick={mobileMenu.toggle}
        >
          {mobileMenu.open ? <X weight="thin" /> : <List weight="thin" />}
        </button>
      </div>
    </header>
  );
}

function CommandPreview({ commandRef, open, onClose, language }) {
  const closeRef = useRef(null);
  const copy = showcaseCopy[language];

  if (!open) return null;
  return (
    <FocusBoundary
      className="command-preview"
      role="dialog"
      aria-modal="true"
      aria-labelledby="command-preview-title"
      bodyClass="command-preview-open"
      initialFocusRef={closeRef}
      returnFocusRef={commandRef}
      onDismiss={onClose}
    >
      <div className="deck-static-poster" data-renderer="poster" aria-hidden="true" />
      <div className="command-preview-copy">
        <p className="chapter-label"><span>COMMAND</span>AFFLATUS-01</p>
        <h2 id="command-preview-title">{copy.commandTitle}</h2>
        <p>{copy.commandBody}</p>
        <EditorialLink href={siteHref(COMMAND_ENTRY.path, language)} data-scene-signal="command:continue">{copy.commandCta}</EditorialLink>
      </div>
      <button ref={closeRef} className="command-preview-close" type="button" onClick={onClose} aria-label={copy.closeCommand}>
        <X aria-hidden="true" weight="thin" />
      </button>
    </FocusBoundary>
  );
}

export function App({ experienceMode = "cinematic", onExperienceFailure }) {
  const [commandOpen, setCommandOpen] = useState(false);
  const commandRef = useRef(null);
  const language = window.location.pathname.startsWith("/zh/") ? "zh" : "en";
  const copy = showcaseCopy[language];
  const motion = useMotionPreference(experienceMode);

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);

  const closeCommand = () => setCommandOpen(false);

  return (
    <div className="site-root">
      <a className="skip-link" href="#main-content">{language === 'zh' ? '跳至主要内容' : 'Skip to main content'}</a>
      <ExperienceRoot
        experienceMode={experienceMode}
        motionEnabled={motion.enabled}
        onUnavailable={onExperienceFailure}
      />
      <section className="chapter chapter-cold-void" data-chapter="01-cold-void" aria-labelledby="chapter-01-title" id="top">
        <Header
          commandRef={commandRef}
          language={language}
          motion={motion}
          onOpenCommand={() => setCommandOpen(true)}
        />
        <div className="chapter-inner hero-content">
          <ChapterLabel index="01">{copy.chapters.coldVoid}</ChapterLabel>
          <h1 id="chapter-01-title">{copy.heroTitle}</h1>
          <p className="chapter-lede">{copy.heroBody}</p>
          <EditorialLink className="hero-cta" href="#chapter-03-title" sceneSignal="route:systems">{copy.heroCta}</EditorialLink>
        </div>
        <a className="current-signal" href={siteHref("/signal.html", language)}>
          <span>{copy.currentSignal}</span>
          <strong>{copy.currentSignalTitle}</strong>
          <time dateTime="2026-08-21">2026.08.21</time>
        </a>
      </section>

      <main id="main-content" tabIndex="-1">
        <section className="chapter chapter-approach" data-chapter="02-the-approach" aria-labelledby="chapter-02-title">
          <div className="chapter-inner chapter-copy-narrow">
            <ChapterLabel index="02">{copy.chapters.approach}</ChapterLabel>
            <h2 id="chapter-02-title">{copy.approachTitle}</h2>
            <p className="chapter-lede">{copy.approachBody}</p>
            <p className="approach-statement">{copy.approachStatement}</p>
            <p className="approach-vector">{copy.approachStatus}</p>
          </div>
        </section>

        <section className="chapter chapter-systems" data-chapter="03-parallel-drift" aria-labelledby="chapter-03-title">
          <div className="chapter-inner">
            <ChapterLabel index="03">{copy.chapters.drift}</ChapterLabel>
            <div className="chapter-intro">
              <h2 id="chapter-03-title">{copy.systemsTitle}</h2>
              <p>{copy.systemsBody}</p>
            </div>
            <div className="system-routes">
              {systems.map((system) => (
                <article className="system-route" data-system={system.signal} key={system.index}>
                  <span className="system-index">{system.index}</span>
                  <h3>{pick(system.title, language)}</h3>
                  <p>{pick(system.description, language)}</p>
                  <EditorialLink
                    href={siteHref(system.href, language)}
                    sceneSignal={`system:${system.signal}`}
                  >
                    {pick(system.action, language)}
                  </EditorialLink>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="chapter chapter-intelligence" data-chapter="04-bridge-aperture" aria-labelledby="chapter-04-title">
          <div className="chapter-inner">
            <ChapterLabel index="04">{copy.chapters.aperture}</ChapterLabel>
            <article className="intelligence-feature">
              <div>
                <h2 id="chapter-04-title">{copy.intelligenceTitle}</h2>
                <p>{copy.intelligenceBody}</p>
                <EditorialLink href={siteHref("/signal.html", language)}>{copy.intelligenceCta}</EditorialLink>
              </div>
              <div className="signal-context" aria-label={`${copy.currentSignal}: ${copy.currentSignalTitle}`}>
                <span>{copy.currentSignal}</span>
                <strong>{copy.currentSignalTitle}</strong>
                <time dateTime="2026-08-21">2026.08.21</time>
              </div>
            </article>
            <div className="transmission-stubs" aria-label={copy.relatedSignals}>
              <p>{copy.relatedSignals}</p>
              {transmissions.map((item) => (
                <TransmissionRow
                  href={siteHref(item.href, language)}
                  date={item.date}
                  key={item.title.en}
                  sceneSignal="route:transmission"
                >
                  {pick(item.title, language)}
                </TransmissionRow>
              ))}
            </div>
          </div>
        </section>

        <section className="chapter chapter-field-record" data-chapter="05-the-wake" aria-labelledby="chapter-05-title">
          <div className="chapter-inner field-record-layout">
            <div>
              <ChapterLabel index="05">{copy.chapters.wake}</ChapterLabel>
              <h2 id="chapter-05-title">{copy.fieldTitle}</h2>
            </div>
            <div className="field-record-copy">
              <p className="chapter-lede">{copy.fieldBody}</p>
              <p>{copy.fieldBodyTwo}</p>
              <p className="field-marker">{copy.fieldMarker}</p>
              <EditorialLink href={siteHref("/capital/fy25-26/", language)}>{copy.fieldCta}</EditorialLink>
            </div>
          </div>
        </section>

        <section className="chapter chapter-manifesto" data-chapter="06-departure" aria-labelledby="chapter-06-title" id="about">
          <div className="chapter-inner manifesto-layout">
            <ChapterLabel index="06">{copy.chapters.departure}</ChapterLabel>
            <h2 id="chapter-06-title">{copy.manifestoTitle}</h2>
            <p className="manifesto-copy">{copy.manifestoBody}</p>
            <div className="about-block">
              <h3>{copy.aboutTitle}</h3>
              <p>{copy.aboutBody}</p>
              <EditorialLink href={siteHref("/capital/", language)}>{copy.portfolioCta}</EditorialLink>
            </div>
            <EditorialLink
              className="manifesto-command"
              href={siteHref(COMMAND_ENTRY.path, language)}
              sceneSignal="command:continue"
            >
              {copy.finalCommand}
            </EditorialLink>
            <p className="disclosure-copy" id="disclosure">{copy.disclosureBody}</p>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <a href={siteHref("/", language)}>AFFLATUS</a>
          <span>MELBOURNE, AUSTRALIA</span>
          <a href={language === "en" ? `/zh/${window.location.search}${window.location.hash}` : `/en/${window.location.search}${window.location.hash}`}>{copy.language} · {language === "en" ? "EN / 中" : "中 / EN"}</a>
          <a href="#disclosure">{copy.disclosure}</a>
          <span className="nominal-status">{copy.nominal}</span>
        </div>
      </footer>

      <CommandPreview
        commandRef={commandRef}
        open={commandOpen}
        onClose={closeCommand}
        language={language}
      />
    </div>
  );
}
