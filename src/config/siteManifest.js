import { SITE_NAME } from './siteIdentity.js';
export { SITE_NAME } from './siteIdentity.js';
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

export const socialCardFilename = (routeId, locale) =>
  `${routeId}-${locale}${routeId === 'main' ? '-studio' : ''}.${SOCIAL_CARD.extension}`;

const routeOgImage = (routeId, locale) =>
  `https://feida.au/assets/og/${socialCardFilename(routeId, locale)}`;

export const ROUTE_SEO = Object.freeze({
  main: {
    social: {
      background: 'assets/og-backgrounds/home.jpg',
      eyebrow: { en: 'FEIDA WANG · AFFLATUS', zh: '王飞达 FEIDA WANG · AFFLATUS' },
      title: { en: 'From this world, into what comes next.', zh: '从这颗星球，驶向更远的地方。' },
      subtitle: {
        en: 'Agentic coding, AI products and research — designed, built and shipped as working software.',
        zh: '编程智能体、AI 产品与研究——设计、构建，并作为真实运行的软件上线。',
      },
      alt: {
        en: 'Feida Wang: AI engineering, agentic coding, product design and research, with a still from the homepage film',
        zh: '王飞达：AI 工程、编程智能体、产品设计与研究，配首页影片画面',
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
      eyebrow: { en: 'AI-ERA US STOCKS', zh: 'AI 时代美股' },
      title: { en: 'Stock Journal', zh: '美股看板' },
      subtitle: {
        en: 'Latest quotes and daily charts for AI-era US companies.',
        zh: 'AI 时代美股公司的最新报价与日线走势。',
      },
      alt: {
        en: 'Stock Journal market data lanes',
        zh: '美股看板市场数据轨道',
      },
      images: { en: routeOgImage('arena', 'en'), zh: routeOgImage('arena', 'zh') },
    },
    structuredData: { kind: 'arena' },
  },
  sectors: {
    social: {
      background: 'assets/og-backgrounds/sectors.jpg',
      eyebrow: { en: 'AI OBSERVATORY', zh: 'AI 观察站' },
      title: {
        en: 'The world building AI',
        zh: '谁在构建 AI 的世界',
      },
      subtitle: {
        en: 'Companies, frontier models, agentic coding and the path to AGI.',
        zh: '产业公司、前沿模型、编程智能体与通向 AGI 的能力关卡。',
      },
      alt: {
        en: 'Global AI industry observatory',
        zh: '全球 AI 产业观察站',
      },
      images: {
        en: routeOgImage('sectors', 'en'),
        zh: routeOgImage('sectors', 'zh'),
      },
    },
    structuredData: {
      kind: 'sectors',
      provenance: [
        // Resolved to the newest dated snapshot in the directory at build time.
        { directory: 'public/data/sectors-observatory', dateField: 'updated' },
      ],
    },
  },
  signal: {
    social: {
      background: 'assets/og-backgrounds/signal.jpg',
      eyebrow: { en: 'MACRO DOSSIER', zh: '宏观档案' },
      title: { en: 'Fed Watch', zh: '美联储观察' },
      subtitle: {
        en: 'Decision-relevant macro signals with explicit provenance.',
        zh: '带明示来源的决策型宏观信号。',
      },
      alt: {
        en: 'Fed Watch macroeconomic research dossier',
        zh: '美联储观察宏观经济研究档案',
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
  worlds: {
    social: {
      background: 'assets/og-backgrounds/worlds.jpg',
      eyebrow: { en: 'WORLDS 2026 · FABLE CALLS', zh: 'WORLDS 2026 · FABLE 研判' },
      title: { en: 'Worlds 2026 odds & picks', zh: '2026 全球总决赛赔率与竞猜' },
      subtitle: {
        en: 'Pre-match win probabilities, champion odds and Fearless Draft pools. Entertainment only.',
        zh: '赛前胜率、夺冠概率与无畏征召英雄池。仅供娱乐。',
      },
      alt: {
        en: 'Worlds 2026 odds and picks on an obsidian and aurora backdrop',
        zh: '曜石黑与极光蓝背景上的 2026 全球总决赛赔率与竞猜',
      },
      images: { en: routeOgImage('worlds', 'en'), zh: routeOgImage('worlds', 'zh') },
    },
    structuredData: { kind: 'worlds' },
  },
  serial: {
    social: {
      background: 'assets/og-backgrounds/serial.jpg',
      eyebrow: { en: 'SERIAL FICTION', zh: '原创连载' },
      title: { en: 'Original Chinese fiction', zh: '原创中文小说连载' },
      subtitle: {
        en: 'Three serialised worlds by Feida Wang.',
        zh: '王飞达创作的三个连载世界。',
      },
      alt: {
        en: 'Retro-futurist library for original serialised fiction',
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
  about: {
    social: {
      background: 'assets/og-backgrounds/home.jpg',
      eyebrow: { en: 'ABOUT · AFFLATUS', zh: '关于 · AFFLATUS' },
      title: { en: 'About Feida Wang', zh: '关于王飞达' },
      subtitle: {
        en: 'Software engineer in Melbourne, building AI-era products with coding agents.',
        zh: '墨尔本的软件工程师，用编程智能体构建 AI 时代的产品。',
      },
      alt: {
        en: 'About Feida Wang, software engineer in Melbourne',
        zh: '关于王飞达，墨尔本软件工程师',
      },
      images: { en: routeOgImage('about', 'en'), zh: routeOgImage('about', 'zh') },
    },
    structuredData: { kind: 'about' },
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
    themeColor: '#f0eee6',
    schema: ['WebSite', 'ProfilePage'],
    seo: ROUTE_SEO.main,
    capabilities: ['video'],
    metadata: {
      title: "Feida Wang | AI Engineering, Product Design & Research",
      description: "Explore Feida Wang’s work in full-stack development, UI/UX design, agentic coding, financial modelling and AI industry research through working products.",
      // Root URLs adapt to the visitor's language; their canonical is the
      // default-locale document (/en/…, or /zh/ for the Chinese-only serial).
      canonical: 'https://feida.au/en/',
      ogTitle: "Feida Wang — AI Engineering, Agentic Coding & Research",
      ogDescription: "A personal studio of working AI-era products, built solo with coding agents: an AI industry atlas, a Forward Deployed Engineer course, market research and original fiction.",
      ogImage: ROUTE_SEO.main.social.images.en,
    },
    locales: {
      en: {title: "Feida Wang | AI Engineering, Product Design & Research", description: "Explore Feida Wang’s work in full-stack development, UI/UX design, agentic coding, financial modelling and AI industry research through working products.", ogTitle: "Feida Wang — AI Engineering, Agentic Coding & Research", ogDescription: "A personal studio of working AI-era products, built solo with coding agents: an AI industry atlas, a Forward Deployed Engineer course, market research and original fiction."},
      zh: {title: "王飞达 Feida Wang｜AI 工程、产品设计与跨领域研究", description: "通过真实运行的产品，探索王飞达在全栈开发、UI/UX 设计、编程智能体、金融建模与 AI 产业研究中的跨领域实践。", ogTitle: "王飞达 Feida Wang — AI 工程 · 编程智能体 · 产业研究", ogDescription: "用编程智能体独立构建的 AI 时代个人工作室：AI 产业图鉴、FDE 实战课程、市场研究与原创小说。"},
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
    nav: { order: 15, group: null, en: 'Portfolio', zh: '投资组合' },
    themeColor: '#05070b',
    schema: ['ProfilePage'],
    seo: ROUTE_SEO.portfolio,
    capabilities: ['canvas', 'webgl', 'combat'],
    metadata: {
      title: "Portfolio performance atlas · AFFLATUS",
      description: "Selected positive trade examples, forward scenarios and a ten-stock research watchlist.",
      canonical: 'https://feida.au/en/portfolio.html',
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
    nav: { order: 20, group: null, en: 'Stock Journal', zh: '美股看板' },
    themeColor: '#05070e',
    schema: ['WebApplication'],
    seo: ROUTE_SEO.arena,
    capabilities: ['live-data', 'canvas', 'svg-viz', 'admin-session'],
    metadata: {
      title: "Stock Journal — US stocks of the AI era · AFFLATUS",
      description: "Follow a watchlist of AI-era US companies with the latest Finnhub quotes and Twelve Data daily charts. Quotes may be delayed. Not investment advice.",
      canonical: 'https://feida.au/en/arena.html',
      ogTitle: "Stock Journal — US stocks of the AI era · AFFLATUS",
      ogDescription: "Follow a watchlist of AI-era US companies with the latest Finnhub quotes and Twelve Data daily charts. Quotes may be delayed. Not investment advice.",
      ogImage: ROUTE_SEO.arena.social.images.en,
    },
    locales: {
      en: {"title": "Stock Journal — US stocks of the AI era · AFFLATUS", "description": "Follow a watchlist of AI-era US companies with the latest Finnhub quotes and Twelve Data daily charts. Quotes may be delayed. Not investment advice."},
      zh: {"title": "美股看板 · AFFLATUS", "description": "关注 AI 时代的美股公司：Finnhub 最新报价与 Twelve Data 日线走势。报价可能有延迟，不构成投资建议。"},
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
    nav: { order: 30, group: null, en: 'AI Observatory', zh: 'AI 观察站' },
    themeColor: '#e8e6dc',
    schema: ['CollectionPage', 'ItemList'],
    seo: ROUTE_SEO.sectors,
    capabilities: ['canvas', 'graph'],
    metadata: {
      title: "AI Observatory — The world building AI · AFFLATUS",
      description: "Explore AI companies and frontier models including Haiku 5.5, compare capability and cost, and investigate subscription economics with original analysis.",
      canonical: 'https://feida.au/en/sectors.html',
      ogTitle: "AI Observatory — The world building AI · AFFLATUS",
      ogDescription: "Explore AI companies and frontier models including Haiku 5.5, compare capability and cost, and investigate subscription economics with original analysis.",
      ogImage: ROUTE_SEO.sectors.social.images.en,
    },
    locales: {
      en: {"title": "AI Observatory — The world building AI · AFFLATUS", "description": "Explore AI companies and frontier models including Haiku 5.5, compare capability and cost, and investigate subscription economics with original analysis."},
      zh: {"title": "AI 观察站 — 谁在构建 AI 的世界 · AFFLATUS", "description": "探索全球 AI 公司与 Haiku 5.5 等前沿模型，按厂商比较能力与成本，并通过原创分析和交互实验理解订阅经济。"},
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
    nav: { order: 40, group: null, en: 'Fed Watch', zh: '美联储观察' },
    themeColor: '#faf9f5',
    schema: ['CollectionPage', 'ItemList'],
    seo: ROUTE_SEO.signal,
    capabilities: ['data-feed'],
    metadata: {
      title: "Fed Watch — Federal Reserve, fiscal policy and AI · AFFLATUS",
      description: "Explore Federal Reserve decisions, U.S. fiscal policy and AI industry transmission since January 2026, with dated primary sources.",
      canonical: 'https://feida.au/en/signal.html',
      ogTitle: "Fed Watch — Federal Reserve, fiscal policy and AI · AFFLATUS",
      ogDescription: "Explore Federal Reserve decisions, U.S. fiscal policy and AI industry transmission since January 2026, with dated primary sources.",
      ogImage: ROUTE_SEO.signal.social.images.en,
    },
    locales: {
      en: {"title": "Fed Watch — Federal Reserve, fiscal policy and AI · AFFLATUS", "description": "Explore Federal Reserve decisions, U.S. fiscal policy and AI industry transmission since January 2026, with dated primary sources."},
      zh: {"title": "美联储观察 — 货币、财政与 AI · AFFLATUS", "description": "探索2026年1月起的美联储决议、美国财政政策和AI产业传导，查看注明日期的一手来源。"},
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
    nav: { order: 60, group: 'labs', en: 'Astrology for fun', zh: '趣味占星' },
    themeColor: '#202320',
    schema: ['WebApplication'],
    seo: ROUTE_SEO.horoscope,
    capabilities: ['local-first', 'share-query', 'svg-viz'],
    metadata: {
      title: "Astrology for fun — Bazi & Western astrology · AFFLATUS",
      description: "Explore Bazi, Western astrology and two-person synastry calculated on your device. For entertainment only.",
      canonical: 'https://feida.au/en/horoscope.html',
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
    id: 'worlds',
    file: 'worlds.html',
    path: '/worlds.html',
    status: 'active',
    build: true,
    sitemap: true,
    defaultLocale: 'en',
    nav: { order: 65, group: 'labs', en: 'Worlds 2026', zh: '全球总决赛' },
    themeColor: '#05070c',
    schema: ['WebApplication'],
    seo: ROUTE_SEO.worlds,
    capabilities: ['live-data', 'local-state'],
    metadata: {
      title: "Worlds 2026 odds & picks — Fable calls · AFFLATUS",
      description: "Pre-match win probabilities, implied odds, champion odds and Fearless Draft pool depth for the 2026 League of Legends World Championship. Entertainment only, not betting advice.",
      canonical: 'https://feida.au/en/worlds.html',
      ogTitle: "Worlds 2026 odds & picks — Fable calls · AFFLATUS",
      ogDescription: "Pre-match win probabilities, implied odds, champion odds and Fearless Draft pool depth for the 2026 League of Legends World Championship. Entertainment only, not betting advice.",
      ogImage: ROUTE_SEO.worlds.social.images.en,
    },
    locales: {
      en: {"title": "Worlds 2026 odds & picks — Fable calls · AFFLATUS", "description": "Pre-match win probabilities, implied odds, champion odds and Fearless Draft pool depth for the 2026 League of Legends World Championship. Entertainment only, not betting advice."},
      zh: {"title": "2026 全球总决赛赔率与竞猜 — Fable 研判 · AFFLATUS", "description": "2026 英雄联盟全球总决赛每场赛前胜率、隐含赔率、夺冠概率与无畏征召英雄池深度。仅供娱乐，不构成博彩建议。"},
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
    nav: { order: 70, group: 'labs', en: 'Stories', zh: '故事' },
    themeColor: '#f4f0e7',
    schema: ['Book', 'CreativeWorkSeries'],
    seo: ROUTE_SEO.serial,
    capabilities: ['reader', 'local-state', 'audio'],
    metadata: {
      title: "故事 — 原创中文连载 · AFFLATUS",
      description: "原创中文连载。选一本书，从上次停下的地方继续，阅读偏好与进度保存在你的设备上。",
      // Chinese-only: the adaptive /serial.html serves the same document as
      // /zh/serial.html, so it canonicalizes there instead of to itself.
      canonical: 'https://feida.au/zh/serial.html',
      ogTitle: "故事 — 原创中文连载 · AFFLATUS",
      ogDescription: "原创中文连载。选一本书，从上次停下的地方继续，阅读偏好与进度保存在你的设备上。",
      ogImage: ROUTE_SEO.serial.social.images.zh,
    },
    locales: {
      en: {"title": "Stories — Original Chinese fiction · AFFLATUS", "description": "Original serialised fiction in Chinese. Choose a book and continue reading, with reading preferences and progress on your device."},
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
      title: "Course — Learn to build useful tools with AI · AFFLATUS",
      description: "A 24-week bilingual course: build useful tools, verify AI agents, and learn to deploy, recover and improve them.",
      canonical: 'https://feida.au/en/course.html',
      ogTitle: "Course — Learn to build useful tools with AI · AFFLATUS",
      ogDescription: "A 24-week bilingual course: build useful tools, verify AI agents, and learn to deploy, recover and improve them.",
      ogImage: ROUTE_SEO.course.social.images.en,
    },
    locales: {
      en: {"title": "Course — Learn to build useful tools with AI · AFFLATUS", "description": "A 24-week bilingual course: build useful tools, verify AI agents, and learn to deploy, recover and improve them."},
      zh: {"title": "课程 — 一步步，把 AI 做成能用的工具 · AFFLATUS", "description": "24 周双语实践课程：构建有用工具，验证 AI 智能体，学习部署、恢复与受控改进。"},
    },
  },
  {
    id: 'about',
    file: 'about.html',
    path: '/about.html',
    status: 'active',
    build: true,
    sitemap: true,
    defaultLocale: 'en',
    nav: { order: 90, group: 'labs', en: 'About', zh: '关于' },
    themeColor: '#faf9f5',
    schema: ['AboutPage', 'Person'],
    seo: ROUTE_SEO.about,
    capabilities: [],
    metadata: {
      title: "About Feida Wang · AFFLATUS",
      description: "Feida Wang is a software engineer in Melbourne who builds AI-era products with coding agents: an AI industry atlas, economic updates, a course and original fiction.",
      canonical: 'https://feida.au/en/about.html',
      ogTitle: "About Feida Wang · AFFLATUS",
      ogDescription: "Feida Wang is a software engineer in Melbourne who builds AI-era products with coding agents: an AI industry atlas, economic updates, a course and original fiction.",
      ogImage: ROUTE_SEO.about.social.images.en,
    },
    locales: {
      en: {"title": "About Feida Wang · AFFLATUS", "description": "Feida Wang is a software engineer in Melbourne who builds AI-era products with coding agents: an AI industry atlas, economic updates, a course and original fiction."},
      zh: {"title": "关于王飞达 · AFFLATUS", "description": "王飞达是墨尔本的软件工程师，用编程智能体构建 AI 时代的产品：AI 产业图谱、经济动态、实践课程与原创小说。"},
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

// Homepage grouping lives with route metadata; URLs and route labels derive from NAV_ROUTES.
// Only anchored sub-destinations carry their own label.
export const HOME_NAV_GROUPS = Object.freeze([
  { id: 'markets', label: { en: 'Markets', zh: '市场' }, items: [
    { routeId: 'signal' },
    { routeId: 'signal', hash: '#treasuryYieldBoard', label: { en: '10Y / 30Y yield monitor', zh: '10年 / 30年期收益率' } },
    { routeId: 'portfolio', hash: '#fy2026Performance', label: { en: 'FY25/26 flight record', zh: 'FY25/26 飞行记录' } },
  ] },
  { id: 'lab', label: { en: 'Lab', zh: '实验室' }, items: [
    { routeId: 'arena' },
    { routeId: 'sectors' },
    { routeId: 'horoscope' },
    { routeId: 'worlds' },
  ] },
  { id: 'writing', label: { en: 'Writing', zh: '写作' }, items: [
    { routeId: 'course' },
    { routeId: 'serial' },
  ] },
].map(group => Object.freeze({ ...group, items: group.items.map(item => {
  const route = NAV_ROUTES.find(route => route.id === item.routeId);
  if (!route) throw new Error(`Unknown navigation route: ${item.routeId}`);
  return Object.freeze({ ...item, label: item.label || { en: route.en, zh: route.zh }, href: `${route.path}${item.hash || ''}` });
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
