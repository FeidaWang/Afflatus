import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Broadcast,
  CaretDown,
  Crosshair,
  GlobeHemisphereEast,
  List,
  Lightning,
  ShieldCheck,
  X,
} from "@phosphor-icons/react";

const DeckScene = lazy(() => import("./DeckScene.jsx").then((module) => ({ default: module.DeckScene })));
const RadarCanvas = lazy(() => import("./DeckScene.jsx").then((module) => ({ default: module.RadarCanvas })));

const navGroups = [
  {
    label: { en: "Markets", zh: "市场" },
    items: [
      [{ en: "Federal Reserve watch", zh: "美联储观察" }, "/signal.html"],
      [{ en: "10Y / 30Y yield monitor", zh: "10年 / 30年期收益率" }, "/signal.html#treasuryYieldBoard"],
      [{ en: "Prediction record", zh: "预测记录" }, "/stats.html"],
      [{ en: "FY25/26 flight record", zh: "FY25/26 飞行记录" }, "/portfolio.html#fy2026Performance"],
    ],
  },
  {
    label: { en: "Lab", zh: "实验室" },
    items: [
      [{ en: "QF-01 Quant Foundry", zh: "QF-01 量化铸造舱" }, "/arena.html"],
      [{ en: "US–China AI model war", zh: "中美 AI 模型战争" }, "/sectors.html"],
      [{ en: "Local-first astrology", zh: "本地优先星盘" }, "/horoscope.html"],
    ],
  },
  {
    label: { en: "Writing", zh: "写作" },
    items: [
      [{ en: "Forward Deployed Engineer 0→1", zh: "前沿部署工程师 0→1" }, "/course.html"],
      [{ en: "Original novels", zh: "原创小说" }, "/serial.html"],
    ],
  },
];

const systems = [
  {
    index: "01",
    title: { en: "Capital", zh: "资本" },
    description: { en: "Model bounds, closed-cycle velocity and drawdown discipline.", zh: "以模型上界、闭环速度与回撤纪律约束资本。" },
    meta: "05 CLOSED CYCLES · METHOD 2026.08.08",
    href: "/portfolio.html#fy2026Performance",
    action: { en: "Open flight record", zh: "查看飞行记录" },
  },
  {
    index: "02",
    title: { en: "Software", zh: "软件" },
    description: { en: "Field guides for recoverable agents and enterprise AI delivery.", zh: "面向可恢复智能体与企业 AI 交付的实战指南。" },
    meta: "36 TRANSMISSIONS · 1,268 ROLE SNAPSHOT",
    href: "/course.html",
    action: { en: "Open FDE course", zh: "打开 FDE 课程" },
  },
  {
    index: "03",
    title: { en: "Intelligence", zh: "情报" },
    description: { en: "QF-01 market intelligence with explicit provenance.", zh: "带明示来源的 QF-01 市场情报。" },
    meta: "QF-01 · SIGNAL · MODEL WAR",
    href: "/arena.html",
    action: { en: "Open research lab", zh: "进入研究实验室" },
  },
];

const transmissions = [
  {
    title: { en: "Long-end live monitor: 10Y / 30Y Treasury yields.", zh: "长端实时监控：10年与30年期美国国债收益率。" },
    date: "2026.08.21",
    category: { en: "Markets", zh: "市场" },
    href: "/signal.html#treasuryYieldBoard",
  },
  {
    title: { en: "The model war is price, power and distribution.", zh: "模型战争的核心是价格、算力与分发。" },
    date: "2026.08.08",
    category: { en: "Lab", zh: "实验室" },
    href: "/sectors.html",
  },
  {
    title: { en: "A risk engine, not another stock picker.", zh: "这是风险引擎，不是又一个选股器。" },
    date: "2026.08.08",
    category: { en: "Lab", zh: "实验室" },
    href: "/arena.html",
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
      eyebrow: "QUIET TACTICAL ATLAS · 2026.08.22",
      title: <><span className="hero-title-line">Systems for</span><br /><span className="hero-title-line">uncertain worlds.</span></>,
      subtitle: "Capital, software and intelligence for long horizons.",
      cta: "Open the deck",
    },
    systems: "OPERATING SYSTEMS",
    systemAxis: "CAPITAL · SOFTWARE · INTELLIGENCE",
    transmissions: "LATEST TRANSMISSIONS",
    archive: "Open archive",
    featureEyebrow: "FEATURE · MARKET SIGNAL",
    featureTitle: <>Fed operations<br />&amp; the long end.</>,
    featureBody: "Current posture: restrictive hold, ample-reserve implementation. The 10-year and 30-year yields remain market-priced—not administratively capped.",
    featureCta: "Read the evidence-first dossier",
    policyRange: "POLICY RANGE",
    deskWindow: "CURRENT DESK WINDOW",
    reinvestment: "reinvestment purchases",
    newRmps: "NEW RMPs",
    zero: "ZERO",
    asOf: "AS OF",
    fieldEyebrow: "FIELD NOTE · FY25/26 FLIGHT RECORD",
    fieldTitle: "Return is not one number.",
    fieldBody: "It is a chain of assumptions: closed-cycle velocity, benchmark choice, holding duration and the drawdown required to stay in the route.",
    fieldBodyTwo: "Five completed trajectories are published without account values or live positions.",
    fieldCta: "Inspect the method",
    chartTitle: "CLOSED-CYCLE TRAJECTORY OVERVIEW",
    chartReference: "REFERENCE: AFFLATUS / METHOD 2026.08.08",
    longRoute: "LONG ROUTE",
    shortCycles: "SHORT CYCLES",
    verifiedEntries: "05 VERIFIED ENTRIES",
    signatureEyebrow: "SIGNATURE DECK · AFFLATUS-01",
    signatureTitle: <>Long range by design.<br />Built to survive uncertainty.</>,
    signatureBody: "Open the adaptive Three.js command simulation: navigation, tactical radar, ship status, energy allocation and combat lock.",
    signatureCta: "Enter full command deck",
    principles: "OPERATING PRINCIPLES",
    about: "ABOUT AFFLATUS",
    aboutTitle: "A personal command system.",
    aboutBody: "Built by Feida “Bruce” Wang in Melbourne for capital, code, original writing and long-range research. No ads. No tips. No promises.",
    portfolioCta: "Open the portfolio",
    uplink: "SIGNAL UPLINK",
    uplinkTitle: "Follow the evidence.",
    uplinkBody: "Start with the latest Federal Reserve dossier, the QF-01 risk engine, or the Forward Deployed Engineer course.",
    updatedLabel: "UPDATED",
    heroUpdate: "FED OPERATIONS & THE LONG END",
    systemNominal: "ALL SYSTEMS NOMINAL",
  },
  zh: {
    hero: {
      eyebrow: "安静的战术星图 · 2026.08.22",
      title: <><span className="hero-title-line">为不确定的世界</span><br /><span className="hero-title-line">构建系统。</span></>,
      subtitle: "资本、软件与情报，为长期主义而建。",
      cta: "开启指挥舱",
    },
    systems: "运行系统",
    systemAxis: "资本 · 软件 · 情报",
    transmissions: "最新传输",
    archive: "打开档案",
    featureEyebrow: "重点 · 市场信号",
    featureTitle: <>美联储操作<br />与长端市场。</>,
    featureBody: "当前立场：限制性利率维持，充足准备金框架继续运行。10年与30年期收益率仍由市场定价，并非行政设限。",
    featureCta: "阅读证据优先档案",
    policyRange: "政策区间",
    deskWindow: "当前交易台窗口",
    reinvestment: "再投资购买",
    newRmps: "新增 RMP",
    zero: "零",
    asOf: "截至",
    fieldEyebrow: "现场笔记 · FY25/26 飞行记录",
    fieldTitle: "回报从来不只一个数字。",
    fieldBody: "它由一连串假设构成：闭环速度、基准选择、持有时长，以及留在航线所需承受的回撤。",
    fieldBodyTwo: "五条已完成轨迹均公开方法，但不公开账户数值或实时仓位。",
    fieldCta: "查看方法",
    chartTitle: "闭环轨迹总览",
    chartReference: "参考：AFFLATUS / 方法 2026.08.08",
    longRoute: "长航线",
    shortCycles: "短周期",
    verifiedEntries: "05 条已验证记录",
    signatureEyebrow: "标志性甲板 · AFFLATUS-01",
    signatureTitle: <>为远航而设计。<br />为不确定性而生存。</>,
    signatureBody: "进入自适应 Three.js 指挥模拟：星际航行、战术雷达、舰船状态、能源分配与战斗锁定。",
    signatureCta: "进入完整指挥舱",
    principles: "运行原则",
    about: "关于 AFFLATUS",
    aboutTitle: "一套个人指挥系统。",
    aboutBody: "由 Feida “Bruce” Wang 在墨尔本构建，用于资本、代码、原创写作与长期研究。无广告、无荐股、无承诺。",
    portfolioCta: "打开作品集",
    uplink: "信号上行",
    uplinkTitle: "遵循证据。",
    uplinkBody: "从最新美联储档案、QF-01 风险引擎或前沿部署工程师课程开始。",
    updatedLabel: "更新于",
    heroUpdate: "美联储操作与长端市场",
    systemNominal: "所有系统正常",
  },
};

const pick = (value, language) => typeof value === "string" ? value : value[language];

function siteHref(path, language) {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  if (path === "/serial.html") return "/zh/serial.html";
  return path === "/" ? `/${language}/` : `/${language}${path}`;
}

function ExternalLink({ href, language, className = "", children, onClick }) {
  return (
    <a className={className} href={siteHref(href, language)} onClick={onClick}>
      {children}
      <ArrowRight aria-hidden="true" weight="thin" />
    </a>
  );
}

function Header({ onOpenDeck, language }) {
  const [openGroup, setOpenGroup] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [deckMenuOpen, setDeckMenuOpen] = useState(false);

  useEffect(() => {
    const close = (event) => {
      if (!event.target.closest("[data-nav-popover]")) {
        setOpenGroup(null);
        setDeckMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const translations = language === "zh"
    ? { about: "关于", deck: "开启指挥舱", deckOptions: "指挥舱选项", home: "AFFLATUS 首页", menu: "打开导航", primaryNavigation: "主导航", switcher: "切换至英文", simulation: "指挥模拟", strategy: "策略甲板", research: "研究甲板", capital: "资本甲板" }
    : { about: "About", deck: "Open Deck", deckOptions: "Deck options", home: "AFFLATUS home", menu: "Open navigation", primaryNavigation: "Primary navigation", switcher: "Switch to Chinese", simulation: "Command simulation", strategy: "Strategy deck", research: "Research deck", capital: "Capital deck" };
  const languageHref = `${language === "en" ? "/zh/" : "/en/"}${window.location.search}${window.location.hash}`;

  return (
    <header className="site-header">
      <a className="brand" href={siteHref("/", language)} aria-label={translations.home}>
        AFFLATUS
      </a>

      <nav className={`desktop-nav ${mobileOpen ? "is-mobile-open" : ""}`} aria-label={translations.primaryNavigation}>
        {navGroups.map((group) => (
          <div className="nav-cluster" data-nav-popover key={group.label.en}>
            <button
              type="button"
              className="nav-trigger"
              aria-expanded={openGroup === group.label.en}
              onClick={() => setOpenGroup(openGroup === group.label.en ? null : group.label.en)}
            >
              {pick(group.label, language)}
              <CaretDown aria-hidden="true" weight="thin" />
            </button>
            {openGroup === group.label.en && (
              <div className="nav-popover">
                {group.items.map(([label, href]) => (
                  <ExternalLink key={label.en} href={href} language={language}>{pick(label, language)}</ExternalLink>
                ))}
              </div>
            )}
          </div>
        ))}
        <a className="nav-about" href="#about" onClick={() => setMobileOpen(false)}>{translations.about}</a>
      </nav>

      <div className="header-actions">
        <div className="deck-split" data-nav-popover>
          <button type="button" className="deck-main" onClick={onOpenDeck}>{translations.deck}</button>
          <button
            type="button"
            className="deck-more"
            aria-label={translations.deckOptions}
            aria-expanded={deckMenuOpen}
            onClick={() => setDeckMenuOpen(!deckMenuOpen)}
          >
            <CaretDown aria-hidden="true" weight="thin" />
          </button>
          {deckMenuOpen && (
            <div className="nav-popover deck-popover">
              <button type="button" onClick={onOpenDeck}><span>{translations.simulation}</span><ArrowRight weight="thin" /></button>
              <ExternalLink href="/signal.html" language={language}>{translations.strategy}</ExternalLink>
              <ExternalLink href="/arena.html" language={language}>{translations.research}</ExternalLink>
              <ExternalLink href="/portfolio.html#fy2026Performance" language={language}>{translations.capital}</ExternalLink>
            </div>
          )}
        </div>
        <a
          id="langBtn"
          className="language-switch"
          href={languageHref}
          hreflang={language === "en" ? "zh-CN" : "en"}
          aria-label={translations.switcher}
        >
          <GlobeHemisphereEast aria-hidden="true" weight="thin" />
          {language === "en" ? "EN / 中" : "中 / EN"}
        </a>
        <button
          type="button"
          className="mobile-menu"
          aria-label={translations.menu}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X weight="thin" /> : <List weight="thin" />}
        </button>
      </div>
    </header>
  );
}

function CycleChart({ language }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    const data = [
      { hold: 17.5, velocity: 260.4 },
      { hold: 3, velocity: 208.5 },
      { hold: 11.2, velocity: 257.9 },
      { hold: 246, velocity: 32.6 },
      { hold: 5.6, velocity: 85.6 },
    ];

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const width = rect.width;
      const height = rect.height;
      const pad = { top: 38, right: 34, bottom: 42, left: 54 };
      const plotW = width - pad.left - pad.right;
      const plotH = height - pad.top - pad.bottom;

      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(17, 19, 21, .14)";
      ctx.fillStyle = "#4d5258";
      ctx.lineWidth = 1;
      ctx.font = "10px 'IBM Plex Mono', monospace";
      ctx.textAlign = "right";
      for (let row = 0; row <= 4; row += 1) {
        const y = pad.top + (plotH / 4) * row;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(width - pad.right, y);
        ctx.stroke();
        ctx.fillText(`${Math.round(300 - row * 75)}%`, pad.left - 9, y + 3);
      }
      ctx.textAlign = "center";
      for (let col = 0; col <= 5; col += 1) {
        const x = pad.left + (plotW / 5) * col;
        ctx.beginPath();
        ctx.moveTo(x, pad.top);
        ctx.lineTo(x, height - pad.bottom);
        ctx.stroke();
        ctx.fillText(`${Math.round((246 / 5) * col)}`, x, height - 18);
      }

      data.forEach((route, index) => {
        const endX = pad.left + (route.hold / 246) * plotW;
        const endY = pad.top + (1 - route.velocity / 300) * plotH;
        const startY = pad.top + plotH * (0.72 + index * 0.045);
        ctx.strokeStyle = index === 3 ? "#111315" : "rgba(17, 19, 21, .48)";
        ctx.setLineDash(index === 3 ? [] : [4 + index, 5]);
        ctx.lineWidth = index === 3 ? 1.7 : 1.05;
        ctx.beginPath();
        ctx.moveTo(pad.left, startY);
        ctx.bezierCurveTo(pad.left + plotW * .25, startY - 70, endX - plotW * .14, endY + 44, endX, endY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#111315";
        ctx.beginPath();
        ctx.arc(endX, endY, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "9px 'IBM Plex Mono', monospace";
        ctx.textAlign = "left";
        ctx.fillText(`0${index + 1}`, Math.min(endX + 8, width - 48), endY - 7);
      });

      ctx.fillStyle = "#111315";
      ctx.font = "9px 'IBM Plex Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText("HOLDING DAYS", pad.left + plotW / 2, height - 2);
      ctx.save();
      ctx.translate(12, pad.top + plotH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText("ANNUALISED CYCLE EFFICIENCY", 0, 0);
      ctx.restore();
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  return <canvas className="cycle-chart" ref={canvasRef} aria-label={language === "zh" ? "五个已结清周期的持有时长与效率轨迹" : "Five closed-cycle holding-duration and efficiency trajectories"} />;
}

function DeckOverlay({ open, onClose, language }) {
  const [mode, setMode] = useState("nav");
  const [fps, setFps] = useState(60);
  const overlayRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const overlay = overlayRef.current;
    const background = overlay?.parentElement
      ? Array.from(overlay.parentElement.children).filter((node) => node !== overlay)
      : [];
    const previousInert = background.map((node) => node.inert);
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    background.forEach((node) => { node.inert = true; });

    const handleKeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !overlay) return;
      const focusable = Array.from(overlay.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'))
        .filter((node) => !node.hasAttribute("hidden") && node.getClientRects().length > 0);
      if (!focusable.length) {
        event.preventDefault();
        overlay.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.classList.add("deck-open");
    window.addEventListener("keydown", handleKeydown);
    requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      document.body.classList.remove("deck-open");
      window.removeEventListener("keydown", handleKeydown);
      background.forEach((node, index) => { node.inert = previousInert[index]; });
      previousFocusRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const combat = mode === "combat";
  const deckCopy = language === "zh" ? {
    titleNav: "远程航行",
    titleCombat: "战术截击",
    shipStatus: "舰船状态",
    tacticalSphere: "战术球面",
    tracks: "3 个目标",
    passive: "静默监听",
    power: "能源管理",
    intercept: "截击航向已获取",
    stable: "黑洞弹弓窗口稳定",
    combatNote: "仅限模拟 · 武器保险已启用",
    navNote: "自适应渲染 · 后台暂停 · 支持减少动态效果",
    close: "关闭指挥舱",
    dialog: "AFFLATUS 指挥舱模拟",
    mode: "模拟模式",
  } : {
    titleNav: "LONG-RANGE NAVIGATION",
    titleCombat: "TACTICAL INTERCEPT",
    shipStatus: "SHIP STATUS",
    tacticalSphere: "TACTICAL SPHERE",
    tracks: "3 TRACKS",
    passive: "PASSIVE",
    power: "POWER MANAGEMENT",
    intercept: "INTERCEPT VECTOR ACQUIRED",
    stable: "BLACK-HOLE SLINGSHOT WINDOW STABLE",
    combatNote: "Simulation only · weapons safed",
    navNote: "Adaptive renderer · visibility-suspended · reduced-motion ready",
    close: "Close command deck",
    dialog: "AFFLATUS command deck simulation",
    mode: "Simulation mode",
  };
  const segments = (active, total = 10) => Array.from({ length: total }, (_, index) => (
    <i className={index < active ? "is-active" : ""} key={index} />
  ));

  return (
    <section
      className={`deck-overlay ${combat ? "is-combat" : ""}`}
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="deck-overlay-title"
      aria-label={deckCopy.dialog}
      tabIndex="-1"
    >
      <Suspense fallback={<div className="deck-scene deck-loading" aria-hidden="true" />}>
        <DeckScene mode={mode} onFpsChange={setFps} />
      </Suspense>
      <div className="deck-atmosphere" aria-hidden="true" />
      <header className="deck-header">
        <div>
          <span className="eyebrow">AFFLATUS · COMMAND DECK / SIMULATION</span>
          <strong id="deck-overlay-title">{combat ? deckCopy.titleCombat : deckCopy.titleNav}</strong>
        </div>
        <div className="deck-mode-switch" role="group" aria-label={deckCopy.mode}>
          <button type="button" className={mode === "nav" ? "is-active" : ""} onClick={() => setMode("nav")}>NAV</button>
          <button type="button" className={mode === "combat" ? "is-active" : ""} onClick={() => setMode("combat")}>COMBAT</button>
        </div>
        <div className="deck-header-meta">
          <span><i /> {fps} FPS</span>
          <span>SOL-3 · MELBOURNE</span>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label={deckCopy.close}><X weight="thin" /></button>
        </div>
      </header>

      <aside className="deck-panel deck-panel-left">
        <div className="deck-panel-heading"><ShieldCheck weight="thin" /><span>{deckCopy.shipStatus}</span><b>AFFLATUS-01</b></div>
        {[
          ["HULL", 10, "100%"],
          ["SHIELD", combat ? 7 : 9, combat ? "74%" : "92%"],
          ["REACTOR", combat ? 9 : 6, combat ? "91%" : "62%"],
        ].map(([label, active, value]) => (
          <div className="mfd-row" key={label}>
            <span>{label}</span><div className="segment-bar">{segments(active)}</div><b>{value}</b>
          </div>
        ))}
        <div className="deck-readout-grid">
          <span><i>HDG</i><b>{combat ? "081.4°" : "274.3°"}</b></span>
          <span><i>VEL</i><b>{combat ? "18.72" : "12.40"}<small> km/s</small></b></span>
          <span><i>PITCH</i><b>{combat ? "+12.8°" : "+03.2°"}</b></span>
          <span><i>G-FORCE</i><b>{combat ? "2.4 G" : "0.18 G"}</b></span>
        </div>
      </aside>

      <div className="flight-reticle" aria-hidden="true">
        <Crosshair weight="thin" />
        <span>{combat ? "LOCK / 82%" : "VECTOR / STABLE"}</span>
      </div>

      <aside className="deck-panel deck-panel-right">
        <div className="deck-panel-heading"><Broadcast weight="thin" /><span>{deckCopy.tacticalSphere}</span><b>{combat ? deckCopy.tracks : deckCopy.passive}</b></div>
        <Suspense fallback={<div className="radar-canvas" aria-hidden="true" />}>
          <RadarCanvas combat={combat} language={language} />
        </Suspense>
        <div className="target-list">
          <span><i className="friend" />AFF-02<b>0.84 AU</b></span>
          <span><i className={combat ? "hostile" : "unknown"} />{combat ? "RED-01" : "UNKNOWN"}<b>{combat ? "14.2 KM" : "2.40 AU"}</b></span>
          <span><i className="friend" />LAGRANGE L1<b>LOCK</b></span>
        </div>
      </aside>

      <footer className="deck-footer">
        <div className="power-strip">
          <span><Lightning weight="thin" /> {deckCopy.power}</span>
          <div><i>ENGINES</i><b style={{ "--power": combat ? "84%" : "62%" }} /></div>
          <div><i>SHIELDS</i><b style={{ "--power": combat ? "76%" : "48%" }} /></div>
          <div><i>WEAPONS</i><b style={{ "--power": combat ? "91%" : "12%" }} /></div>
        </div>
        <div className="deck-message">
          <span>{combat ? deckCopy.intercept : deckCopy.stable}</span>
          <small>{combat ? deckCopy.combatNote : deckCopy.navNote}</small>
        </div>
      </footer>
    </section>
  );
}

export function App() {
  const [deckOpen, setDeckOpen] = useState(false);
  const language = window.location.pathname.startsWith("/zh/") ? "zh" : "en";
  const copy = showcaseCopy[language];

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);

  return (
    <div className="site-root">
      <section className="hero" id="top">
        <img className="hero-image" src="/assets/showcase/blackhole-hero.jpg" alt="" fetchPriority="high" decoding="async" />
        <div className="hero-shade" aria-hidden="true" />
        <Header
          onOpenDeck={() => setDeckOpen(true)}
          language={language}
        />
        <div className="hero-content">
          <span className="eyebrow">{copy.hero.eyebrow}</span>
          <h1>{copy.hero.title}</h1>
          <p>{copy.hero.subtitle}</p>
          <button type="button" className="editorial-link hero-cta" onClick={() => setDeckOpen(true)}>
            <span>{copy.hero.cta}</span><ArrowRight aria-hidden="true" weight="thin" />
          </button>
        </div>
        <div className="hero-telemetry" aria-label={language === "zh" ? "最新已验证信号快照" : "Latest verified signal snapshot"}>
          <span><i>POSITION</i><b>MELBOURNE / 37.8136° S</b></span>
          <span><i>FOMC RANGE</i><b>3.50–3.75%</b></span>
          <span><i>DESK WINDOW</i><b>$17.0BN REINVESTMENT</b></span>
          <span><i>LONG END</i><b>MARKET-PRICED</b></span>
        </div>
        <a className="hero-update" href={siteHref("/signal.html", language)}>
          <span>{copy.updatedLabel} 2026.08.21</span>
          <b>{copy.heroUpdate}</b>
        </a>
      </section>

      <main>
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
                <small>{system.meta}</small>
                <ExternalLink href={system.href} language={language} className="editorial-link">{pick(system.action, language)}</ExternalLink>
              </article>
            ))}
          </div>
        </section>

        <section className="transmissions section-shell" aria-labelledby="transmissions-title">
          <div className="section-heading">
            <span className="eyebrow" id="transmissions-title">{copy.transmissions}</span>
          </div>
          <article className="featured-transmission">
            <div>
              <span className="eyebrow">{copy.featureEyebrow}</span>
              <h2>{copy.featureTitle}</h2>
              <p>{copy.featureBody}</p>
              <ExternalLink href="/signal.html" language={language} className="editorial-link">{copy.featureCta}</ExternalLink>
            </div>
            <div className="feature-facts">
              <span><i>{copy.policyRange}</i><b>3.50–3.75%</b></span>
              <span><i>{copy.deskWindow}</i><b>$17.0BN</b><small>{copy.reinvestment}</small></span>
              <span><i>{copy.newRmps}</i><b>{copy.zero}</b><small>14 Aug–14 Sep</small></span>
              <span><i>{copy.asOf}</i><b>2026.08.21</b></span>
            </div>
          </article>
          <div className="transmission-list">
            {transmissions.map((item) => (
              <ExternalLink href={item.href} language={language} key={item.title.en}>
                <span className="transmission-title">{pick(item.title, language)}</span>
                <time>{item.date}</time>
                <em>{pick(item.category, language)}</em>
              </ExternalLink>
            ))}
          </div>
        </section>

        <section className="field-note" aria-labelledby="field-note-title">
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
            <div className="chart-legend">
              <span><i className="legend-solid" />{copy.longRoute}</span>
              <span><i className="legend-dash" />{copy.shortCycles}</span>
              <span>{copy.verifiedEntries}</span>
            </div>
          </div>
        </section>

        <section className="signature-deck" aria-labelledby="signature-title">
          <img className="signature-image" src="/assets/showcase/signature-vanguard.jpg" alt="" loading="lazy" decoding="async" />
          <div className="signature-shade" aria-hidden="true" />
          <div className="signature-copy">
            <span className="eyebrow">{copy.signatureEyebrow}</span>
            <h2 id="signature-title">{copy.signatureTitle}</h2>
            <p>{copy.signatureBody}</p>
            <button type="button" className="editorial-link signature-cta" onClick={() => setDeckOpen(true)}>
              <span>{copy.signatureCta}</span><ArrowRight weight="thin" />
            </button>
          </div>
          <div className="signature-facts">
            <span><i>FED RANGE</i><b>3.50–3.75%</b></span>
            <span><i>DESK WINDOW</i><b>$17.0BN</b></span>
            <span><i>{copy.updatedLabel}</i><b>2026.08.21</b></span>
          </div>
          <div className="signature-status"><i /> {copy.systemNominal}</div>
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
          <span><i /> {copy.systemNominal}</span>
          <span>MELBOURNE, AUSTRALIA — EARTH / SOL-3</span>
        </div>
      </footer>

      <DeckOverlay open={deckOpen} onClose={() => setDeckOpen(false)} language={language} />
    </div>
  );
}
