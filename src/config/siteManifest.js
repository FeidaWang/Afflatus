/**
 * Project Afflatus route manifest — the single source of truth for route
 * identity, build inclusion, navigation, sitemap membership and metadata.
 *
 * Browser consumers should import the derived NAV_ROUTES array. Build and CI
 * consumers may use the full SITE_MANIFEST. Keep this module platform-neutral:
 * no DOM, filesystem, process or Vite imports.
 */

const OG_IMAGE = 'https://feida.au/assets/og/og-image.jpg';
// Route-specific social cards ship in the following visual-assets module.
// Until then, every emitted document must reference the existing fallback.
const routeOgImage = () => OG_IMAGE;

export const ROUTE_SEO = Object.freeze({
  main: {
    social: {
      background: '/assets/og/backgrounds/home.png',
      eyebrow: { en: 'AFFLATUS · CAPTAIN LOG', zh: 'AFFLATUS · 舰长日志' },
      title: { en: 'Deep-space captain log', zh: '深空舰长日志' },
      subtitle: {
        en: 'AI field notes, original fiction, and data-driven experiments.',
        zh: 'AI 实践、原创连载与数据实验。',
      },
      alt: {
        en: 'Project Afflatus captain log in deep space',
        zh: '深空中的 Project Afflatus 舰长日志',
      },
      images: { en: routeOgImage('main', 'en'), zh: routeOgImage('main', 'zh') },
    },
    structuredData: { kind: 'profile' },
  },
  arena: {
    social: {
      background: '/assets/og/backgrounds/arena.png',
      eyebrow: { en: 'MARKET INTELLIGENCE', zh: '市场情报' },
      title: { en: 'Arena', zh: '竞技场' },
      subtitle: {
        en: 'US stock technical analysis and simulated model ledgers.',
        zh: '美股技术分析与模型模拟账本。',
      },
      alt: {
        en: 'Arena market intelligence data lanes',
        zh: '竞技场市场情报数据轨道',
      },
      images: { en: routeOgImage('arena', 'en'), zh: routeOgImage('arena', 'zh') },
    },
    structuredData: {
      kind: 'arena',
      provenance: [
        { path: 'public/arena-daily-digest.json', dateField: 'generatedAt' },
        { path: 'public/arena-news.json', dateField: 'generatedAt' },
      ],
    },
  },
  sectors: {
    social: {
      background: '/assets/og/backgrounds/sectors.png',
      eyebrow: { en: 'AI ECOSYSTEM', zh: 'AI 生态' },
      title: {
        en: 'Two ecosystems. One supply chain.',
        zh: '两套生态，一条供应链。',
      },
      subtitle: {
        en: 'A structured map of the US–China AI stack.',
        zh: '结构化观察中美 AI 产业链。',
      },
      alt: {
        en: 'Constellation map of the US and China AI ecosystems',
        zh: '中美 AI 生态系统交互星图',
      },
      images: {
        en: routeOgImage('sectors', 'en'),
        zh: routeOgImage('sectors', 'zh'),
      },
    },
    structuredData: {
      kind: 'sectors',
      provenance: [
        { path: 'public/sectors-ecosystem.json', dateField: 'updated' },
        { path: 'public/sectors-competition.json', dateField: 'updated' },
      ],
    },
  },
  signal: {
    social: {
      background: '/assets/og/backgrounds/signal.png',
      eyebrow: { en: 'MACRO DOSSIER', zh: '宏观档案' },
      title: { en: 'Federal Reserve watch', zh: '美联储观察' },
      subtitle: {
        en: 'Decision-relevant macro signals with explicit provenance.',
        zh: '带明示来源的决策型宏观信号。',
      },
      alt: {
        en: 'Signal macroeconomic research dossier',
        zh: 'Signal 宏观经济研究档案',
      },
      images: { en: routeOgImage('signal', 'en'), zh: routeOgImage('signal', 'zh') },
    },
    structuredData: {
      kind: 'signal',
      provenance: [{ path: 'public/signal-events.json', dateField: 'updated' }],
    },
  },
  stats: {
    social: {
      background: '/assets/og/backgrounds/stats.png',
      eyebrow: { en: 'TRACK RECORD', zh: '战绩档案' },
      title: { en: 'Prediction track record', zh: '竞猜记录存档' },
      subtitle: {
        en: 'Transparent outcomes, calibration, and model notes.',
        zh: '公开结果、置信校准与模型备注。',
      },
      alt: {
        en: 'Statistical calibration and prediction track record',
        zh: '竞猜记录的统计校准与分布图',
      },
      images: { en: routeOgImage('stats', 'en'), zh: routeOgImage('stats', 'zh') },
    },
    structuredData: {
      kind: 'stats',
      provenance: [
        { path: 'public/games-data.json', dateField: 'updated' },
        { path: 'public/leagues-data.json', dateField: 'updated' },
      ],
    },
  },
  horoscope: {
    social: {
      background: '/assets/og/backgrounds/horoscope.png',
      eyebrow: { en: 'LOCAL-FIRST', zh: '本地计算' },
      title: { en: 'Bazi & astrology', zh: '八字与西方占星' },
      subtitle: {
        en: 'A private, local-first entertainment experience.',
        zh: '隐私优先、本地计算的娱乐体验。',
      },
      alt: {
        en: 'Botanical celestial chart for Bazi and astrology',
        zh: '八字与西方占星的植物天体图',
      },
      images: {
        en: routeOgImage('horoscope', 'en'),
        zh: routeOgImage('horoscope', 'zh'),
      },
    },
    structuredData: { kind: 'horoscope' },
  },
  serial: {
    social: {
      background: '/assets/og/backgrounds/serial.png',
      eyebrow: { en: 'SERIAL FICTION', zh: '原创连载' },
      title: { en: 'Original Chinese fiction', zh: '原创中文小说连载' },
      subtitle: {
        en: 'Three serialized worlds by Feida Wang.',
        zh: '王飞达创作的三个连载世界。',
      },
      alt: {
        en: 'Retro-futurist library for original serialized fiction',
        zh: '原创连载小说的复古未来主义图书馆',
      },
      images: { en: routeOgImage('serial', 'en'), zh: routeOgImage('serial', 'zh') },
    },
    structuredData: { kind: 'serial' },
  },
  course: {
    social: {
      background: '/assets/og/backgrounds/course.png',
      eyebrow: { en: 'LIVING PLAYBOOK', zh: '持续更新' },
      title: { en: 'AI collaboration playbook', zh: 'AI 协作成长蓝图' },
      subtitle: {
        en: 'A practical path from prompts to production systems.',
        zh: '从提示词到生产系统的实践路径。',
      },
      alt: {
        en: 'Learning map for the Project Afflatus AI course',
        zh: 'Project Afflatus AI 课程学习地图',
      },
      images: { en: routeOgImage('course', 'en'), zh: routeOgImage('course', 'zh') },
    },
    structuredData: { kind: 'course' },
  },
});

export const SITE_MANIFEST = Object.freeze([
  {
    id: 'main',
    file: 'index.html',
    path: '/',
    status: 'active',
    build: true,
    sitemap: true,
    defaultLocale: 'en',
    nav: { order: 10, group: null, en: 'Home', zh: '首页' },
    themeColor: '#05070b',
    schema: ['WebSite', 'ProfilePage'],
    seo: ROUTE_SEO.main,
    capabilities: ['canvas', 'webgl', 'combat'],
    metadata: {
      title: 'Project Afflatus - Deep-Space Captain Log',
      description: "Bruce's deep-space captain log: a lone commander disclosing his US-equity positions, allocation logic and risk discipline. 深空舰长日志 · 个人美股持仓与纪律公开。No ads, no tips, no promises.",
      canonical: 'https://feida.au/',
      ogTitle: 'Project Afflatus · Deep-Space Captain Log',
      ogDescription: "A lone commander's US-equity captain log: positions, allocation logic, discipline. No ads, no tips, no promises.",
      ogImage: ROUTE_SEO.main.social.images.en,
    },
    locales: {
      en: {
        title: 'Project Afflatus — Deep-Space Captain Log',
        description: "A lone commander's US-equity positions, allocation logic, and risk discipline. No ads, tips, or promises.",
      },
      zh: {
        title: 'Project Afflatus — 深空舰长日志',
        description: '一名独行舰长公开记录美股持仓、配置逻辑与风险纪律。不投放广告，不荐股，不承诺收益。',
      },
    },
  },
  {
    id: 'arena',
    file: 'arena.html',
    path: '/arena.html',
    status: 'active',
    build: true,
    sitemap: true,
    defaultLocale: 'en',
    nav: { order: 20, group: null, en: 'Arena', zh: '竞技场' },
    themeColor: '#05070e',
    schema: ['WebApplication', 'Article', 'Dataset'],
    seo: ROUTE_SEO.arena,
    capabilities: ['live-data', 'svg-viz', 'admin-session'],
    metadata: {
      title: 'Arena · US Stock TA + Autopilot — Afflatus',
      description: 'Arena: self-serve US stock technical analysis (key levels, MAs, pivots, pre/post-market) across the full S&P 500, plus Autopilot — three rule-constrained LLM ledgers (sentiment/event, intraday structure, alt-data fusion) trading vs SPY/SMH. Not investment advice.',
      canonical: 'https://feida.au/arena.html',
      ogTitle: 'Project Afflatus · Arena',
      ogDescription: 'S&P 500 TA dashboard + three simulated LLM trading ledgers (Autopilot) scored against SPY/SMH. Not investment advice.',
      ogImage: ROUTE_SEO.arena.social.images.en,
    },
    locales: {
      en: {
        title: 'Arena — US Stock TA and Autopilot · Afflatus',
        description: 'S&P 500 technical analysis and three rule-constrained simulated model ledgers scored against SPY and SMH. Not investment advice.',
      },
      zh: {
        title: '竞技场 — 美股技术分析与自动驾驶模拟盘 · Afflatus',
        description: '覆盖标普 500 的技术分析，以及三套受规则约束、对照 SPY 与 SMH 的模型模拟账本。非投资建议。',
      },
    },
  },
  {
    id: 'sectors',
    file: 'sectors.html',
    path: '/sectors.html',
    status: 'active',
    build: true,
    sitemap: true,
    defaultLocale: 'en',
    nav: { order: 30, group: null, en: 'Sectors', zh: '板块' },
    themeColor: '#000000',
    schema: ['CollectionPage', 'ItemList'],
    seo: ROUTE_SEO.sectors,
    capabilities: ['canvas', 'webgl', 'graph'],
    metadata: {
      title: 'Project Afflatus · Sectors',
      description: 'Sector analysis from the Afflatus captain log: US-equity convictions across the AI-infrastructure stack — NVDA, AVGO, MU, SKHY, TSM, ASML. Desk view, not advice.',
      canonical: 'https://feida.au/sectors.html',
      ogTitle: 'Project Afflatus · Sectors',
      ogDescription: 'One frontier worth paying up for: the AI-infrastructure stack — compute, custom silicon, memory, foundry and the toolmakers. Desk view, not advice.',
      ogImage: ROUTE_SEO.sectors.social.images.en,
    },
    locales: {
      en: {
        title: 'Sectors — AI Infrastructure · Project Afflatus',
        description: 'A desk view of the AI-infrastructure stack from compute and custom silicon to memory, foundry, and equipment. Not investment advice.',
      },
      zh: {
        title: '板块 — AI 基础设施 · Project Afflatus',
        description: '从算力、定制芯片、存储、晶圆代工到设备制造商的 AI 基础设施个人案头观点。非投资建议。',
      },
    },
  },
  {
    id: 'signal',
    file: 'signal.html',
    path: '/signal.html',
    status: 'active',
    build: true,
    sitemap: true,
    defaultLocale: 'en',
    nav: { order: 40, group: null, en: 'Signal', zh: '信号' },
    themeColor: '#0c0d0a',
    schema: ['CollectionPage', 'ItemList'],
    seo: ROUTE_SEO.signal,
    capabilities: ['canvas', 'data-feed', 'audio'],
    metadata: {
      title: 'Project Afflatus · Signal — O5 Reserve Containment',
      description: 'Signal: a Federal Reserve watch rendered as an SCP-style O5 Council dossier — FOMC containment review, rate-decision directive and Fable 5 Max sector calls (AI, memory, optical, semis, space). Desk view, not advice.',
      canonical: 'https://feida.au/signal.html',
      ogTitle: 'Project Afflatus · Signal — O5 Reserve Containment',
      ogDescription: 'A Fed watch as an SCP O5 dossier: FOMC containment + Fable sector calls. Desk view, not advice.',
      ogImage: ROUTE_SEO.signal.social.images.en,
    },
    locales: {
      en: {
        title: 'Signal — Federal Reserve Watch · Project Afflatus',
        description: 'An SCP-styled Federal Reserve watch covering the FOMC, rate scenarios, and sector implications. Desk view, not advice.',
      },
      zh: {
        title: '信号 — 美联储观察 · Project Afflatus',
        description: '以 SCP 档案形式呈现美联储、利率情景与板块影响的个人案头观点。非投资建议。',
      },
    },
  },
  {
    id: 'stats',
    file: 'stats.html',
    path: '/stats.html',
    status: 'active',
    build: true,
    sitemap: true,
    defaultLocale: 'zh',
    nav: { order: 50, group: 'labs', en: 'Stats', zh: '战绩' },
    themeColor: '#070a12',
    schema: ['DataCatalog', 'Dataset'],
    seo: ROUTE_SEO.stats,
    capabilities: ['svg-viz', 'statistics'],
    metadata: {
      title: 'Project Afflatus · Stats — 竞猜战绩存档',
      description: 'Project Afflatus 竞猜战绩存档：英雄联盟 MSI 2026 与 FIFA 世界杯 2026 全部预测的命中率、Wilson 置信区间、Brier 评分、可靠性校准图与 bootstrap 重采样，数据全部可回溯。',
      canonical: 'https://feida.au/stats.html',
      ogTitle: 'Project Afflatus · Stats — 竞猜战绩存档',
      ogDescription: 'MSI 2026 与世界杯 2026 预测战绩全量图表：Wilson 区间、Brier 评分、可靠性校准、bootstrap 重采样。仅供娱乐。',
      ogImage: ROUTE_SEO.stats.social.images.zh,
    },
    locales: {
      en: {
        title: 'Stats — Prediction Track Record · Project Afflatus',
        description: 'A traceable MSI 2026 and World Cup 2026 prediction archive with Wilson intervals, Brier scores, calibration, and bootstrap analysis.',
      },
      zh: {
        title: '战绩 — 竞猜记录存档 · Project Afflatus',
        description: '可回溯的 MSI 2026 与世界杯 2026 竞猜记录，包含 Wilson 区间、Brier 评分、可靠性校准和 bootstrap 分析。',
      },
    },
  },
  {
    id: 'horoscope',
    file: 'horoscope.html',
    path: '/horoscope.html',
    status: 'active',
    build: true,
    sitemap: true,
    defaultLocale: 'en',
    nav: { order: 60, group: 'labs', en: 'Horoscope', zh: '观星' },
    themeColor: '#F6EFE3',
    schema: ['WebApplication'],
    seo: ROUTE_SEO.horoscope,
    capabilities: ['local-first', 'share-query', 'svg-viz'],
    metadata: {
      title: 'Project Afflatus · Horoscope — 观星台 · Bazi & Astrology',
      description: '观星台: a warm, botanical Bazi (Four Pillars) + Western astrology playground — daily fortune from the real sexagenary calendar, two-person synastry with a shareable link. Entertainment only, not divination advice.',
      canonical: 'https://feida.au/horoscope.html',
      ogTitle: 'Project Afflatus · 观星台 Horoscope',
      ogDescription: 'Daily Bazi + astrology readings and two-person synastry, in warm botanical colors. Entertainment only.',
      ogImage: ROUTE_SEO.horoscope.social.images.en,
    },
    locales: {
      en: {
        title: 'Horoscope — Bazi and Astrology · Project Afflatus',
        description: 'A local-first Bazi and Western astrology playground with daily readings and two-person synastry. For entertainment only.',
      },
      zh: {
        title: '观星台 — 八字与西方占星 · Project Afflatus',
        description: '本地计算的八字与西方占星体验，包含日运与双人合盘。仅供娱乐。',
      },
    },
  },
  {
    id: 'serial',
    file: 'serial.html',
    path: '/serial.html',
    status: 'active',
    build: true,
    sitemap: true,
    defaultLocale: 'zh',
    nav: { order: 70, group: 'labs', en: 'Novels', zh: '小说' },
    themeColor: '#231411',
    schema: ['Book', 'CreativeWorkSeries'],
    seo: ROUTE_SEO.serial,
    capabilities: ['reader', 'local-state', 'audio'],
    metadata: {
      title: 'Project Afflatus · Novels — 小说连载书架',
      description: 'Project Afflatus 小说书架：《万界种春》（无限流·种田·多女主）、《长夜请柬》（无限流·悬疑推理·大女主成长）等原创连载，复古未来主义视觉，纯中文护眼阅读，每日更新。',
      canonical: 'https://feida.au/serial.html',
      ogTitle: 'Project Afflatus · Novels — 小说连载书架',
      ogDescription: '多部无限流原创小说连载，护眼阅读，每日更新。',
      ogImage: ROUTE_SEO.serial.social.images.zh,
    },
    locales: {
      en: {
        title: 'Novels — Serialized Fiction · Project Afflatus',
        description: 'Original Chinese serialized fiction in an eye-friendly retro-futurist reader.',
      },
      zh: {
        title: '小说 — 原创连载书架 · Project Afflatus',
        description: '多部原创小说连载，以复古未来主义视觉提供纯中文护眼阅读体验。',
      },
    },
  },
  {
    id: 'course',
    file: 'course.html',
    path: '/course.html',
    status: 'active',
    build: true,
    sitemap: true,
    defaultLocale: 'en',
    nav: { order: 80, group: 'labs', en: 'Course', zh: '课程' },
    themeColor: '#05060a',
    schema: ['Course', 'ItemList'],
    seo: ROUTE_SEO.course,
    capabilities: ['long-form', 'glossary'],
    metadata: {
      title: 'Project Afflatus · Course — My Personal AI-Collaboration Playbook',
      description: "A radically transparent, living playbook built from one real developer's own git history: strengths, weaknesses, a curated AI/CS/math curriculum, a Codeforces + 2026 job-prep track, a data-analyst path, and an infrastructure/MTS career track for top AI labs. 一份基于真实 git 记录、公开透明的个人 AI 协作成长蓝图。",
      canonical: 'https://feida.au/course.html',
      ogTitle: 'Project Afflatus · Course — My Personal AI-Collaboration Playbook',
      ogDescription: "A living, evidence-based playbook built from one developer's real git history — strengths, weaknesses, curriculum, and a career track toward top AI labs.",
      ogImage: ROUTE_SEO.course.social.images.en,
    },
    locales: {
      en: {
        title: 'Course — My AI-Collaboration Playbook · Project Afflatus',
        description: 'A living, evidence-based engineering and career playbook built from real development history.',
      },
      zh: {
        title: '课程 — 我的 AI 协作成长蓝图 · Project Afflatus',
        description: '一份基于真实开发记录、持续更新的工程学习与职业成长蓝图。',
      },
    },
  },
  {
    id: 'games',
    file: 'games.html',
    path: '/games.html',
    status: 'redirect',
    build: true,
    sitemap: false,
    defaultLocale: 'en',
    nav: null,
    redirectTo: '/stats.html',
    redirectPermanent: false,
    themeColor: '#1B2766',
    schema: [],
    capabilities: ['archived'],
    metadata: {
      title: 'Project Afflatus · Games — World Cup Prediction Arena',
      description: 'A cyberpunk World Cup 2026 prediction arena: pick match winners before kickoff against Fable 5 Max, with daily champion and best-player probabilities. For fun, not betting advice.',
      canonical: 'https://feida.au/games.html',
      ogTitle: 'Project Afflatus · Games — World Cup Prediction',
      ogDescription: 'Cyberpunk World Cup 2026 prediction vs Fable 5 Max + daily champion / best-player odds. For fun, not betting advice.',
      ogImage: OG_IMAGE,
    },
    locales: {
      en: { title: 'World Cup Prediction Archive', description: 'Archived World Cup prediction experience.' },
      zh: { title: '世界杯竞猜存档', description: '已归档的世界杯竞猜体验。' },
    },
  },
  {
    id: 'league',
    file: 'league.html',
    path: '/league.html',
    status: 'redirect',
    build: true,
    sitemap: false,
    defaultLocale: 'en',
    nav: null,
    redirectTo: '/stats.html',
    redirectPermanent: false,
    themeColor: '#0a1428',
    schema: [],
    capabilities: ['archived'],
    metadata: {
      title: 'Project Afflatus · Leagues — MSI 2026 Prediction Arena',
      description: "A Hextech-styled MSI 2026 prediction arena: Fable 5 Max's Bo5 bracket-stage calls, real book odds, and Fearless Draft pool tracking. For fun, not betting advice.",
      canonical: 'https://feida.au/league.html',
      ogTitle: 'Project Afflatus · Leagues — MSI 2026 Prediction',
      ogDescription: 'Hextech-styled MSI 2026 prediction vs Fable 5 Max + Fearless Draft pool tracking. For fun, not betting advice.',
      ogImage: OG_IMAGE,
    },
    locales: {
      en: { title: 'MSI Prediction Archive', description: 'Archived MSI prediction experience.' },
      zh: { title: 'MSI 竞猜存档', description: '已归档的 MSI 竞猜体验。' },
    },
  },
  {
    id: 'boot',
    file: 'boot.html',
    path: '/boot.html',
    status: 'prototype',
    build: true,
    sitemap: false,
    defaultLocale: 'en',
    nav: null,
    themeColor: '#04060a',
    schema: [],
    capabilities: ['noindex', 'webgl', 'prototype'],
    metadata: {
      title: 'AFFLATUS OS — Bridge Simulation (Prototype)',
      description: null,
      canonical: null,
      ogTitle: null,
      ogDescription: null,
      ogImage: null,
      robots: 'noindex,nofollow',
    },
    locales: {
      en: { title: 'AFFLATUS OS — Bridge Simulation Prototype', description: 'A noindex bridge simulation prototype.' },
      zh: { title: 'AFFLATUS OS — 舰桥模拟原型', description: '不参与索引的舰桥模拟原型。' },
    },
  },
  {
    id: 'not-found',
    file: 'public/404.html',
    path: '/404.html',
    status: 'system',
    build: false,
    sitemap: false,
    defaultLocale: 'en',
    nav: null,
    themeColor: '#05070b',
    schema: [],
    capabilities: ['noindex'],
    metadata: {
      title: '404 — Signal Lost · Project Afflatus',
      description: null,
      canonical: null,
      ogTitle: null,
      ogDescription: null,
      ogImage: null,
      robots: 'noindex',
    },
    locales: {
      en: { title: '404 — Signal Lost', description: 'The requested coordinates do not exist.' },
      zh: { title: '404 — 信号丢失', description: '请求的坐标不存在。' },
    },
  },
]);

export const NAV_ROUTES = Object.freeze(
  SITE_MANIFEST
    .filter((route) => route.status === 'active' && route.nav)
    .sort((a, b) => a.nav.order - b.nav.order)
    .map((route) => Object.freeze({
      id: route.id,
      path: route.path,
      en: route.nav.en,
      zh: route.nav.zh,
      ...(route.nav.group ? { group: route.nav.group } : {}),
    })),
);

export const BUILD_ROUTES = Object.freeze(
  SITE_MANIFEST.filter((route) => route.build),
);

export const SITEMAP_ROUTES = Object.freeze(
  SITE_MANIFEST.filter((route) => route.status === 'active' && route.sitemap),
);

export const SITE_LOCALES = Object.freeze(['en', 'zh']);

export function localizedRoutePath(routeOrPath, locale) {
  const path = typeof routeOrPath === 'string' ? routeOrPath : routeOrPath?.path;
  const normalizedLocale = locale === 'zh' ? 'zh' : 'en';
  const base = normalizeRoutePath(String(path || '/').replace(/^\/(?:en|zh)(?=\/|$)/, ''));
  return base === '/' ? `/${normalizedLocale}/` : `/${normalizedLocale}${base}`;
}

export function localizedRouteUrl(routeOrPath, locale) {
  return `https://feida.au${localizedRoutePath(routeOrPath, locale)}`;
}

export function normalizeRoutePath(pathname) {
  const withoutLocale = String(pathname || '/').replace(/^\/(?:en|zh)(?=\/|$)/, '') || '/';
  const path = withoutLocale.replace(/index\.html$/, '');
  return path === '' ? '/' : path;
}

export function findRouteByPath(pathname) {
  const normalized = normalizeRoutePath(pathname);
  return SITE_MANIFEST.find((route) => normalizeRoutePath(route.path) === normalized) || null;
}
