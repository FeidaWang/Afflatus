import { normalizeRoutePath, resolveRouteHref } from '../lib/routePaths.js';
export { normalizeRoutePath } from '../lib/routePaths.js';

/**
 * Project Afflatus route manifest — the single source of truth for route
 * identity, build inclusion, navigation, sitemap membership and metadata.
 *
 * Browser consumers should import the derived NAV_ROUTES array. Build and CI
 * consumers may use the full SITE_MANIFEST. Keep this module platform-neutral:
 * no DOM, filesystem, process or Vite imports.
 */

export const SOCIAL_CARD = Object.freeze({
  width: 1200,
  height: 630,
  format: 'image/jpeg',
  extension: 'jpg',
  quality: 88,
  maxBytes: 400_000,
});

const routeOgImage = (routeId, locale) =>
  `https://feida.au/assets/og/${routeId}-${locale}.${SOCIAL_CARD.extension}`;

export const ROUTE_SEO = Object.freeze({
  main: {
    social: {
      background: 'assets/og-backgrounds/home.jpg',
      eyebrow: { en: 'AFFLATUS · COMMAND ATLAS', zh: 'AFFLATUS · 指挥星图' },
      title: { en: 'Systems for uncertain worlds', zh: '为不确定的世界构建系统' },
      subtitle: {
        en: 'Capital, software and intelligence for long horizons.',
        zh: '资本、软件与情报，为长期主义而建。',
      },
      alt: {
        en: 'AFFLATUS black-hole command atlas',
        zh: 'AFFLATUS 黑洞指挥星图',
      },
      images: { en: routeOgImage('main', 'en'), zh: routeOgImage('main', 'zh') },
    },
    structuredData: { kind: 'profile' },
  },
  portfolio: {
    social: {
      background: 'assets/og-backgrounds/home.jpg',
      eyebrow: { en: 'AFFLATUS · PORTFOLIO', zh: 'AFFLATUS · 投资组合' },
      title: { en: 'Portfolio performance atlas', zh: '投资组合表现图鉴' },
      subtitle: {
        en: 'Selected trades, forward scenarios and ten research ideas.',
        zh: '精选交易、前瞻情景与十大研究标的。',
      },
      alt: {
        en: 'Afflatus portfolio performance atlas',
        zh: 'Afflatus 投资组合表现图鉴',
      },
      images: { en: routeOgImage('portfolio', 'en'), zh: routeOgImage('portfolio', 'zh') },
    },
    structuredData: { kind: 'profile' },
  },
  arena: {
    social: {
      background: 'assets/og-backgrounds/arena.jpg',
      eyebrow: { en: 'MARKET INTELLIGENCE', zh: '市场情报' },
      title: { en: 'Arena', zh: '竞技场' },
      subtitle: {
        en: 'QF-01 quant foundry, technical analysis and model ledgers.',
        zh: 'QF-01 量化铸造舱、技术分析与模型账本。',
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
        { path: 'public/arena-quant-model.json', dateField: 'updated' },
        { path: 'public/arena-daily-digest.json', dateField: 'generatedAt' },
        { path: 'public/arena-news.json', dateField: 'generatedAt' },
      ],
    },
  },
  sectors: {
    social: {
      background: 'assets/og-backgrounds/sectors.jpg',
      eyebrow: { en: 'MODEL WAR', zh: '模型战争' },
      title: {
        en: 'Open weights. Closed frontier.',
        zh: '开放权重，闭源前沿。',
      },
      subtitle: {
        en: 'Kimi K3 and the repricing of the US–China AI stack.',
        zh: 'Kimi K3 与中美 AI 产业链重估。',
      },
      alt: {
        en: 'US and China frontier AI systems in a model-war briefing',
        zh: '中美前沿 AI 体系模型战争简报',
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
        { path: 'public/sectors-rivalry.json', dateField: 'updated' },
      ],
    },
  },
  signal: {
    social: {
      background: 'assets/og-backgrounds/signal.jpg',
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
  horoscope: {
    social: {
      background: 'assets/og-backgrounds/horoscope.jpg',
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
      background: 'assets/og-backgrounds/serial.jpg',
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
      background: 'assets/og-backgrounds/course.jpg',
      precomposed: true,
      eyebrow: { en: '52-WEEK FIELD MANUAL', zh: '52 周实战手册' },
      title: { en: 'Forward Deployed Engineer 0→1', zh: 'Forward Deployed Engineer 0→1' },
      subtitle: {
        en: 'Learn the models. Ship the system. Change the workflow.',
        zh: '理解模型，交付系统，改变工作流。',
      },
      alt: {
        en: 'Forward Deployed Engineer 0 to 1 field map',
        zh: 'Forward Deployed Engineer 从 0 到 1 实战地图',
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
    themeColor: '#090d12',
    schema: ['WebSite', 'ProfilePage'],
    seo: ROUTE_SEO.main,
    capabilities: ['canvas', 'webgl', 'combat'],
    metadata: {
      title: "AFFLATUS — From this world, into what comes next.",
      description: "Stories, things I build, practical AI learning, and clear market tools.",
      canonical: 'https://feida.au/',
      ogTitle: "AFFLATUS — From this world, into what comes next.",
      ogDescription: "Stories, things I build, practical AI learning, and clear market tools.",
      ogImage: ROUTE_SEO.main.social.images.en,
    },
    locales: {
      en: {"title": "AFFLATUS — From this world, into what comes next.", "description": "Stories, things I build, practical AI learning, and clear market tools."},
      zh: {"title": "AFFLATUS — 从这颗星球，驶向更远的地方。", "description": "故事、作品、AI 学习，以及用简单图表看懂市场的工具。"},
    },
  },
  {
    id: 'portfolio',
    file: 'portfolio.html',
    path: '/portfolio.html',
    status: 'active',
    build: true,
    sitemap: true,
    defaultLocale: 'en',
    nav: { order: 15, group: null, en: 'Portfolio', zh: '作品集' },
    themeColor: '#05070b',
    schema: ['ProfilePage'],
    seo: ROUTE_SEO.portfolio,
    capabilities: ['canvas', 'webgl', 'combat'],
    metadata: {
      title: "Portfolio performance atlas · AFFLATUS",
      description: "Selected positive trade examples, forward scenarios and a ten-stock research watchlist.",
      canonical: 'https://feida.au/portfolio.html',
      ogTitle: "Portfolio performance atlas · AFFLATUS",
      ogDescription: "Selected positive trade examples, forward scenarios and a ten-stock research watchlist.",
      ogImage: ROUTE_SEO.portfolio.social.images.en,
    },
    locales: {
      en: {"title": "Portfolio performance atlas · AFFLATUS", "description": "Selected positive trade examples, forward scenarios and a ten-stock research watchlist."},
      zh: {"title": "投资组合表现图鉴 · AFFLATUS", "description": "精选正向交易案例、前瞻情景和十支美股研究观察名单。"},
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
    capabilities: ['live-data', 'canvas', 'svg-viz', 'admin-session'],
    metadata: {
      title: "Stock observation & investment simulation · AFFLATUS",
      description: "Explore stock charts, technical analysis and investment simulations using historical data. Simulated results are not account returns or investment advice.",
      canonical: 'https://feida.au/arena.html',
      ogTitle: "Stock observation & investment simulation · AFFLATUS",
      ogDescription: "Explore stock charts, technical analysis and investment simulations using historical data. Simulated results are not account returns or investment advice.",
      ogImage: ROUTE_SEO.arena.social.images.en,
    },
    locales: {
      en: {"title": "Stock observation & investment simulation · AFFLATUS", "description": "Explore stock charts, technical analysis and investment simulations using historical data. Simulated results are not account returns or investment advice."},
      zh: {"title": "股票观察与模拟投资 · AFFLATUS", "description": "查看股票图表、技术分析，并用历史数据测试模拟投资。模拟结果并非真实账户收益，非投资建议。"},
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
      title: "AI industry — From chips to useful tools · AFFLATUS",
      description: "Explore the AI industry chain, model competition and hypothetical market scenarios, with data sources and assumptions. Not investment advice.",
      canonical: 'https://feida.au/sectors.html',
      ogTitle: "AI industry — From chips to useful tools · AFFLATUS",
      ogDescription: "Explore the AI industry chain, model competition and hypothetical market scenarios, with data sources and assumptions. Not investment advice.",
      ogImage: ROUTE_SEO.sectors.social.images.en,
    },
    locales: {
      en: {"title": "AI industry — From chips to useful tools · AFFLATUS", "description": "Explore the AI industry chain, model competition and hypothetical market scenarios, with data sources and assumptions. Not investment advice."},
      zh: {"title": "AI 产业 — 从芯片到能用的工具 · AFFLATUS", "description": "从芯片、算力到模型与应用，理解 AI 产业链、模型竞争和假设情景，查看数据来源与推演条件。非投资建议。"},
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
    capabilities: ['canvas', 'data-feed'],
    metadata: {
      title: "Economic updates — Federal Reserve watch · AFFLATUS",
      description: "Read archived Federal Reserve research, dated Treasury yield observations and policy scenarios. Desk research, not investment advice.",
      canonical: 'https://feida.au/signal.html',
      ogTitle: "Economic updates — Federal Reserve watch · AFFLATUS",
      ogDescription: "Read archived Federal Reserve research, dated Treasury yield observations and policy scenarios. Desk research, not investment advice.",
      ogImage: ROUTE_SEO.signal.social.images.en,
    },
    locales: {
      en: {"title": "Economic updates — Federal Reserve watch · AFFLATUS", "description": "Read archived Federal Reserve research, dated Treasury yield observations and policy scenarios. Desk research, not investment advice."},
      zh: {"title": "经济动态 — 美联储观察 · AFFLATUS", "description": "阅读美联储历史研究、注明观测时间的美债收益率与政策情景。案头研究，非投资建议。"},
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
      title: "Astrology for fun — Bazi & Western astrology · AFFLATUS",
      description: "Explore Bazi, Western astrology and two-person synastry calculated on your device. For entertainment only.",
      canonical: 'https://feida.au/horoscope.html',
      ogTitle: "Astrology for fun — Bazi & Western astrology · AFFLATUS",
      ogDescription: "Explore Bazi, Western astrology and two-person synastry calculated on your device. For entertainment only.",
      ogImage: ROUTE_SEO.horoscope.social.images.en,
    },
    locales: {
      en: {"title": "Astrology for fun — Bazi & Western astrology · AFFLATUS", "description": "Explore Bazi, Western astrology and two-person synastry calculated on your device. For entertainment only."},
      zh: {"title": "趣味占星 — 八字与西方占星 · AFFLATUS", "description": "体验在你的设备上计算的八字、西方占星与双人合盘。仅供娱乐。"},
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
    publishedLocales: ['zh'],
    nav: { order: 70, group: 'labs', en: 'Novels', zh: '小说' },
    themeColor: '#231411',
    schema: ['Book', 'CreativeWorkSeries'],
    seo: ROUTE_SEO.serial,
    capabilities: ['reader', 'local-state', 'audio'],
    metadata: {
      title: "故事 — 原创中文连载 · AFFLATUS",
      description: "原创中文连载。选一本书，从上次停下的地方继续，阅读偏好与进度保存在你的设备上。",
      canonical: 'https://feida.au/serial.html',
      ogTitle: "故事 — 原创中文连载 · AFFLATUS",
      ogDescription: "原创中文连载。选一本书，从上次停下的地方继续，阅读偏好与进度保存在你的设备上。",
      ogImage: ROUTE_SEO.serial.social.images.zh,
    },
    locales: {
      en: {"title": "Stories — Original Chinese fiction · AFFLATUS", "description": "Original serialized fiction in Chinese. Choose a book and continue reading, with reading preferences and progress on your device."},
      zh: {"title": "故事 — 原创中文连载 · AFFLATUS", "description": "原创中文连载。选一本书，从上次停下的地方继续，阅读偏好与进度保存在你的设备上。"},
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
    themeColor: '#f7f5ef',
    schema: ['Course', 'ItemList'],
    seo: ROUTE_SEO.course,
    capabilities: ['learning-map'],
    metadata: {
      title: "Learn to build useful tools with AI · AFFLATUS",
      description: "Explore 36 illustrated FDE field notes across six themes. Each book opens a dedicated lesson page.",
      canonical: 'https://feida.au/course.html',
      ogTitle: "Learn to build useful tools with AI · AFFLATUS",
      ogDescription: "Explore 36 illustrated FDE field notes across six themes. Each book opens a dedicated lesson page.",
      ogImage: ROUTE_SEO.course.social.images.en,
    },
    locales: {
      en: {"title": "Learn to build useful tools with AI · AFFLATUS", "description": "Explore 36 illustrated FDE field notes across six themes. Each book opens a dedicated lesson page."},
      zh: {"title": "一步步，把 AI 做成能用的工具 · AFFLATUS", "description": "探索六个主题的 36 本 FDE 课程手记。每本书均有独立课程页面，内容即将更新。"},
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
      title: "404 — Page not found · AFFLATUS",
      description: null,
      canonical: null,
      ogTitle: null,
      ogDescription: null,
      ogImage: null,
      robots: 'noindex',
    },
    locales: {
      en: {"title": "404 — Page not found · AFFLATUS", "description": "This page could not be found. Return to the English or Chinese homepage."},
      zh: {"title": "404 — 页面不存在 · AFFLATUS", "description": "没有找到这个页面。返回中文或英文首页继续浏览。"},
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
      ...(route.publishedLocales ? { publishedLocales: route.publishedLocales } : {}),
      ...(route.nav.group ? { group: route.nav.group } : {}),
    })),
);

// Homepage labels and grouping live with route metadata; URLs derive from NAV_ROUTES.
export const HOME_NAV_GROUPS = Object.freeze([
  { id: 'markets', label: { en: 'Markets', zh: '市场' }, items: [
    { routeId: 'signal', label: { en: 'Federal Reserve watch', zh: '美联储观察' } },
    { routeId: 'signal', hash: '#treasuryYieldBoard', label: { en: '10Y / 30Y yield monitor', zh: '10年 / 30年期收益率' } },
    { routeId: 'portfolio', hash: '#fy2026Performance', label: { en: 'FY25/26 flight record', zh: 'FY25/26 飞行记录' } },
  ] },
  { id: 'lab', label: { en: 'Lab', zh: '实验室' }, items: [
    { routeId: 'arena', label: { en: 'QF-01 Quant Foundry', zh: 'QF-01 量化铸造舱' } },
    { routeId: 'sectors', label: { en: 'US–China AI model war', zh: '中美 AI 模型战争' } },
    { routeId: 'horoscope', label: { en: 'Local-first astrology', zh: '本地优先星盘' } },
  ] },
  { id: 'writing', label: { en: 'Writing', zh: '写作' }, items: [
    { routeId: 'course', label: { en: 'Forward Deployed Engineer 0→1', zh: '前沿部署工程师 0→1' } },
    { routeId: 'serial', label: { en: 'Original novels', zh: '原创小说' } },
  ] },
].map(group => Object.freeze({ ...group, items: group.items.map(item => {
  const route = NAV_ROUTES.find(route => route.id === item.routeId);
  if (!route) throw new Error(`Unknown navigation route: ${item.routeId}`);
  return Object.freeze({ ...item, href: `${route.path}${item.hash || ''}` });
}) })));

export const BUILD_ROUTES = Object.freeze(
  SITE_MANIFEST.filter((route) => route.build),
);

export const RELEASE_CANDIDATE_ROUTES = Object.freeze(
  SITE_MANIFEST.filter((route) => route.capabilities?.includes('release-candidate')),
);

export const SITEMAP_ROUTES = Object.freeze(
  SITE_MANIFEST.filter((route) => route.status === 'active' && route.sitemap),
);

export const SITE_LOCALES = Object.freeze(['en', 'zh']);

export function localizedRoutePath(routeOrPath, locale) {
  return resolveRouteHref(routeOrPath, locale === 'zh' ? 'zh' : 'en', SITE_MANIFEST);
}

export function localizedRouteUrl(routeOrPath, locale) {
  return `https://feida.au${localizedRoutePath(routeOrPath, locale)}`;
}


export function findRouteByPath(pathname) {
  const normalized = normalizeRoutePath(pathname);
  return SITE_MANIFEST.find((route) => normalizeRoutePath(route.path) === normalized) || null;
}
