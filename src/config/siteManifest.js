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

const LEGACY_OG_IMAGE = 'https://feida.au/assets/og/og-image.jpg';
const routeOgImage = (routeId, locale) =>
  `https://feida.au/assets/og/${routeId}-${locale}.${SOCIAL_CARD.extension}`;

export const ROUTE_SEO = Object.freeze({
  main: {
    social: {
      background: 'assets/og-backgrounds/home.jpg',
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
  stats: {
    social: {
      background: 'assets/og-backgrounds/stats.jpg',
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
  cityview: {
    social: {
      background: 'assets/og-backgrounds/cityview.jpg',
      eyebrow: { en: 'URBAN OBSERVATORY', zh: '城市推演台' },
      title: { en: 'Cityview', zh: '城市推演台' },
      subtitle: {
        en: 'Verified real-city packages, with procedural generation isolated in Sandbox.',
        zh: '真实城市须经验证，程序化生成仅存在于沙盒。',
      },
      alt: {
        en: 'Cityview reality-gated urban observatory and synthetic Sandbox',
        zh: 'Cityview 真实数据门控城市观测台与合成沙盒',
      },
      images: {
        en: routeOgImage('cityview', 'en'),
        zh: routeOgImage('cityview', 'zh'),
      },
    },
    structuredData: { kind: 'cityview' },
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
      description: "Bruce's privacy-first FY2025–26 capital flight recorder: model bounds, cycle efficiency, holding duration and risk—without position outcomes or account values. 2025–26 财年资本黑匣子 · 模型上界、周期效率、持仓时长与风险。",
      canonical: 'https://feida.au/',
      ogTitle: 'Project Afflatus · Deep-Space Captain Log',
      ogDescription: 'Privacy-first FY2025–26 capital flight recorder: modeled bounds, cycle efficiency, holding duration and risk.',
      ogImage: ROUTE_SEO.main.social.images.en,
    },
    locales: {
      en: {
        title: 'Project Afflatus — Deep-Space Captain Log',
        description: "A commander's privacy-first US-equity research, modeled bounds and risk discipline—without position outcomes or account values.",
      },
      zh: {
        title: 'Project Afflatus — 深空舰长日志',
        description: '一名独行舰长以隐私优先方式记录美股研究、模型上界与风险纪律，不公开单笔结果或账户数值。',
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
    capabilities: ['live-data', 'canvas', 'svg-viz', 'admin-session'],
    metadata: {
      title: 'Arena · QF-01 Quant Foundry + US Stock TA — Afflatus',
      description: 'Arena: QF-01, an independent browser-native factor, risk and walk-forward model lab, plus US stock technical analysis and simulated Autopilot ledgers. Not investment advice.',
      canonical: 'https://feida.au/arena.html',
      ogTitle: 'Project Afflatus · Arena',
      ogDescription: 'QF-01 factor and risk model lab + S&P 500 TA + simulated Autopilot ledgers. Not investment advice.',
      ogImage: ROUTE_SEO.arena.social.images.en,
    },
    locales: {
      en: {
        title: 'Arena — QF-01 Quant Foundry and US Stock TA · Afflatus',
        description: 'An independent browser-native factor, portfolio-risk and walk-forward research model, S&P 500 technical analysis and simulated model ledgers. Not investment advice.',
      },
      zh: {
        title: '竞技场 — QF-01 量化铸造舱与美股技术分析 · Afflatus',
        description: '独立构建的浏览器原生因子、组合风险与滚动研究模型，以及标普 500 技术分析和模拟账本。非投资建议。',
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
      title: 'Project Afflatus · US–China AI Model War',
      description: 'Kimi K3, open weights, frontier-lab rivalry and a scenario-based repricing of 10 US and 10 China-listed AI instruments. Desk view, not advice.',
      canonical: 'https://feida.au/sectors.html',
      ogTitle: 'Open Weights. Closed Frontier. · Afflatus',
      ogDescription: 'Kimi K3 and the repricing of the US–China AI stack: model margin, token volume, physical chokepoints and distribution. Not investment advice.',
      ogImage: ROUTE_SEO.sectors.social.images.en,
    },
    locales: {
      en: {
        title: 'Sectors — US–China AI Model War · Afflatus',
        description: 'Kimi K3, open weights, ten frontier labs and 20 listed AI instruments assessed across model economics, compute and distribution. Not investment advice.',
      },
      zh: {
        title: '板块 — 中美 AI 模型战争 · Afflatus',
        description: '围绕 Kimi K3、开放权重、十家前沿实验室与二十只上市 AI 标的，分析模型经济性、算力与分发。非投资建议。',
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
    capabilities: ['canvas', 'data-feed'],
    metadata: {
      title: 'Project Afflatus · Signal — O5 Reserve Containment',
      description: 'Signal: current Federal Reserve operations, live 10-year and 30-year Treasury yields, and Trump-administration industry priorities — evidence-first, bilingual and not investment advice.',
      canonical: 'https://feida.au/signal.html',
      ogTitle: 'Project Afflatus · Signal — O5 Reserve Containment',
      ogDescription: 'Current Fed operations, live 10Y/30Y Treasury yields and Trump-administration industry priorities. Desk research, not advice.',
      ogImage: ROUTE_SEO.signal.social.images.en,
    },
    locales: {
      en: {
        title: 'Signal — Federal Reserve Watch · Project Afflatus',
        description: 'Current Federal Reserve operations, live 10-year and 30-year Treasury yields, and Trump-administration industry priorities. Desk research, not advice.',
      },
      zh: {
        title: '信号 — 美联储观察 · Project Afflatus',
        description: '跟踪美联储近期操作、10年与30年期美债收益率，以及特朗普政府产业优先方向。案头研究，非投资建议。',
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
    publishedLocales: ['zh'],
    nav: { order: 70, group: 'labs', en: 'Novels', zh: '小说' },
    themeColor: '#231411',
    schema: ['Book', 'CreativeWorkSeries'],
    seo: ROUTE_SEO.serial,
    capabilities: ['reader', 'local-state', 'audio'],
    metadata: {
      title: 'Project Afflatus · 小说连载书架',
      description: 'Project Afflatus 小说书架：《万界种春》（无限流·种田·多女主）、《长夜请柬》（无限流·悬疑推理·大女主成长）等原创连载，复古未来主义视觉，纯中文护眼阅读，每日更新。',
      canonical: 'https://feida.au/serial.html',
      ogTitle: 'Project Afflatus · 小说连载书架',
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
    themeColor: '#090a0a',
    schema: ['Course', 'ItemList'],
    seo: ROUTE_SEO.course,
    capabilities: ['long-form', 'learning-map', 'local-state'],
    metadata: {
      title: 'Forward Deployed Engineer 0→1 · Project Afflatus',
      description: 'A bilingual 52-week, 36-node field map from zero to Forward Deployed Engineer: production systems, recoverable agents, evals, security, customer deployment, and weekly evidence. 从零成长为 FDE 的双语智能体工程路线图。',
      canonical: 'https://feida.au/course.html',
      ogTitle: 'Forward Deployed Engineer 0→1',
      ogDescription: 'A 36-node field map for building, breaking, evaluating and deploying agent systems that create measurable customer value.',
      ogImage: ROUTE_SEO.course.social.images.en,
    },
    locales: {
      en: {
        title: 'Forward Deployed Engineer 0→1 · Project Afflatus',
        description: 'A 52-week, 36-node field map covering production systems, recoverable agent runtimes, memory, security, evaluation and governed customer deployment.',
      },
      zh: {
        title: 'Forward Deployed Engineer 从 0 到 1 · Project Afflatus',
        description: '一条包含 36 个工程节点的 52 周双语路线，覆盖生产系统、可恢复智能体、记忆、安全、评测与受治理客户部署。',
      },
    },
  },
  {
    id: 'games',
    file: 'games.html',
    path: '/games.html',
    status: 'redirect',
    build: false,
    sitemap: false,
    defaultLocale: 'en',
    nav: null,
    redirectTo: '/stats.html',
    redirectPermanent: true,
    themeColor: '#1B2766',
    schema: [],
    capabilities: ['archived'],
    metadata: {
      title: 'Project Afflatus · World Cup 2026 Prediction Archive',
      description: 'Archived World Cup 2026 predictions and final scorecard: 56 calls, 68% outcome hit rate, 10 exact scorelines, plus the final champion and player awards. Entertainment only.',
      canonical: 'https://feida.au/games.html',
      ogTitle: 'Project Afflatus · World Cup 2026 Prediction Archive',
      ogDescription: 'The completed Fable 5 Max World Cup 2026 prediction record, with a 5.6 Sol Ultra audit: 56 calls, final results and tournament awards.',
      ogImage: LEGACY_OG_IMAGE,
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
    build: false,
    sitemap: false,
    defaultLocale: 'en',
    nav: null,
    redirectTo: '/stats.html',
    redirectPermanent: true,
    themeColor: '#0a1428',
    schema: [],
    capabilities: ['archived'],
    metadata: {
      title: 'Project Afflatus · MSI 2026 Prediction Archive',
      description: "Archived MSI 2026 bracket predictions: 14 pre-match series calls, final outcomes, confidence, Fearless Draft pools, and HLE's 3–2 championship win. Entertainment only.",
      canonical: 'https://feida.au/league.html',
      ogTitle: 'Project Afflatus · MSI 2026 Prediction Archive',
      ogDescription: "The completed Fable 5 Max MSI 2026 record, with a 5.6 Sol Ultra audit: 14 pre-match calls, HLE's title and the final 50% outcome hit rate.",
      ogImage: LEGACY_OG_IMAGE,
    },
    locales: {
      en: { title: 'MSI Prediction Archive', description: 'Archived MSI prediction experience.' },
      zh: { title: 'MSI 竞猜存档', description: '已归档的 MSI 竞猜体验。' },
    },
  },
  {
    id: 'cityview',
    file: 'cityview.html',
    path: '/cityview.html',
    status: 'active',
    build: true,
    sitemap: true,
    defaultLocale: 'en',
    nav: { order: 90, group: 'labs', en: 'Cityview', zh: '城市' },
    themeColor: '#e7e8e5',
    schema: ['WebApplication'],
    seo: ROUTE_SEO.cityview,
    capabilities: ['webgl', 'construction-timeline', 'simulated-data'],
    metadata: {
      title: 'Cityview — Reality-Gated Urban Observatory · Afflatus',
      description: 'Explore verified real-city packages only after source, licence and release approval. Procedural construction remains explicitly isolated in Sandbox.',
      canonical: 'https://feida.au/cityview.html',
      ogTitle: 'Cityview — Reality-Gated Urban Observatory',
      ogDescription: 'Real Shanghai, Melbourne and Hong Kong packages fail closed until approved; procedural construction remains in Sandbox.',
      ogImage: ROUTE_SEO.cityview.social.images.en,
    },
    locales: {
      en: { title: 'Cityview — Reality-Gated Urban Observatory', description: 'Verified real-city packages for Shanghai, Melbourne and Hong Kong, with procedural construction isolated in Sandbox.' },
      zh: { title: '城市推演台 — 真实数据门控城市观测台', description: '上海、墨尔本与香港仅加载已验证真实城市包，程序化建造仅限沙盒。' },
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
      ...(route.publishedLocales ? { publishedLocales: route.publishedLocales } : {}),
      ...(route.nav.group ? { group: route.nav.group } : {}),
    })),
);

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
  const path = typeof routeOrPath === 'string' ? routeOrPath : routeOrPath?.path;
  const base = normalizeRoutePath(String(path || '/').replace(/^\/(?:en|zh)(?=\/|$)/, ''));
  const route = typeof routeOrPath === 'string' ? findRouteByPath(base) : routeOrPath;
  const requestedLocale = locale === 'zh' ? 'zh' : 'en';
  const publishedLocales = route?.publishedLocales || SITE_LOCALES;
  const normalizedLocale = publishedLocales.includes(requestedLocale)
    ? requestedLocale
    : (publishedLocales.includes(route?.defaultLocale) ? route.defaultLocale : publishedLocales[0]);
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
