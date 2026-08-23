import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'parse5';
import {
  SITE_LOCALES,
  SOCIAL_CARD,
  localizedRouteUrl,
} from '../src/config/siteManifest.js';

const SITE_URL = 'https://feida.au';
const SITE_NAME = 'Project Afflatus';
const PROFILE_ID = `${SITE_URL}/#person`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const SEO_START = '<!-- afflatus:route-seo:start -->';
const SEO_END = '<!-- afflatus:route-seo:end -->';

const LANGUAGE_TAGS = Object.freeze({ en: 'en-AU', zh: 'zh-CN' });
const OG_LOCALES = Object.freeze({ en: 'en_AU', zh: 'zh_CN' });

const COURSE_SECTIONS = Object.freeze([
  { id: 'signal', en: '00 Orientation intelligence', zh: '00 定向情报' },
  { id: 'agent-core', en: '01 Textbook audit and agent engineering', zh: '01 教材审查与智能体工程' },
  { id: 'atlas', en: '02 Field map', zh: '02 实战地图' },
  { id: 'pathway', en: '03 52-week sequence', zh: '03 52 周学习序列' },
  { id: 'education', en: '04 Education paths', zh: '04 学习与学历路径' },
  { id: 'fieldwork', en: '05 Portfolio proofs', zh: '05 作品证据' },
  { id: 'interview', en: '06 Interview rehearsal', zh: '06 面试演练' },
  { id: 'review', en: '07 Weekly evidence loop', zh: '07 每周证据闭环' },
]);

const escapeAttribute = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

const jsonForHtml = (value) =>
  JSON.stringify(value, null, 2).replaceAll('<', '\\u003c');

const localeKey = (route, locale) => {
  if (locale === 'adaptive') return route.defaultLocale;
  const publishedLocales = route.publishedLocales || SITE_LOCALES;
  return publishedLocales.includes(locale) ? locale : route.defaultLocale;
};

const languageValue = (route, locale) =>
  locale === 'adaptive'
    ? ['en-AU', 'zh-CN']
    : LANGUAGE_TAGS[localeKey(route, locale)];

export function routeUrl(route, locale = 'adaptive') {
  if (locale === 'adaptive') return route.metadata.canonical;
  return localizedRouteUrl(route, locale);
}

const latestDate = (values) =>
  values
    .filter(Boolean)
    .map(String)
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] || null;

async function readJson(root, relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

export async function loadRouteSeoFacts(root, routes) {
  const facts = {};

  for (const route of routes.filter((entry) => entry.status === 'active')) {
    const routeFacts = { provenance: [] };
    for (const source of route.seo?.structuredData?.provenance || []) {
      const data = await readJson(root, source.path);
      const date = data[source.dateField] || null;
      routeFacts.provenance.push({
        path: source.path,
        dateField: source.dateField,
        date,
      });
    }
    routeFacts.dateModified = latestDate(
      routeFacts.provenance.map((entry) => entry.date),
    );

    if (route.id === 'sectors') {
      const ecosystem = await readJson(root, 'public/sectors-ecosystem.json');
      routeFacts.items = ecosystem.nodes.map((node) => ({
        id: node.id,
        name: node.label,
        category: node.kind,
        url: node.source,
      }));
    }

    if (route.id === 'signal') {
      const signal = await readJson(root, 'public/signal-events.json');
      routeFacts.items = signal.events.map((event) => ({
        id: event.id,
        date: event.date,
        name: event.name,
      }));
    }

    if (route.id === 'serial') {
      const catalog = await readJson(root, 'public/novels-index.json');
      routeFacts.novels = catalog.novels;
    }

    facts[route.id] = routeFacts;
  }

  return facts;
}

const localized = (value, locale) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  return value[locale] ?? value.en ?? value.zh;
};

const personNode = () => ({
  '@type': 'Person',
  '@id': PROFILE_ID,
  name: 'Feida Wang',
  alternateName: 'Bruce',
  url: `${SITE_URL}/`,
});

const websiteNode = (language) => ({
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  url: `${SITE_URL}/`,
  name: SITE_NAME,
  inLanguage: language,
  publisher: { '@id': PROFILE_ID },
});

const imageNode = (route, locale, url) => {
  const key = localeKey(route, locale);
  return {
    '@type': 'ImageObject',
    '@id': `${url}#primaryimage`,
    url: route.seo.social.images[key],
    contentUrl: route.seo.social.images[key],
    width: SOCIAL_CARD.width,
    height: SOCIAL_CARD.height,
    caption: route.seo.social.alt[key],
    inLanguage: LANGUAGE_TAGS[key],
  };
};

const breadcrumbNode = (route, locale, url) => {
  const key = localeKey(route, locale);
  const homeUrl = locale === 'adaptive' ? `${SITE_URL}/` : `${SITE_URL}/${key}/`;
  const homeName = key === 'zh' ? '首页' : 'Home';
  return {
    '@type': 'BreadcrumbList',
    '@id': `${url}#breadcrumb`,
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: homeName,
        item: homeUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: route.nav?.[key] || route.locales[key].title,
        item: url,
      },
    ],
  };
};

const basePageNode = (route, locale, facts, url, type = 'WebPage') => {
  const key = localeKey(route, locale);
  return {
    '@type': type,
    '@id': `${url}#webpage`,
    url,
    name: route.locales[key].title,
    description: route.locales[key].description,
    inLanguage: languageValue(route, locale),
    isPartOf: { '@id': WEBSITE_ID },
    primaryImageOfPage: { '@id': `${url}#primaryimage` },
    ...(route.id === 'main' ? {} : { breadcrumb: { '@id': `${url}#breadcrumb` } }),
    ...(facts.dateModified ? { dateModified: facts.dateModified } : {}),
  };
};

const datasetDistribution = (name, relativeUrl) => ({
  '@type': 'DataDownload',
  name,
  encodingFormat: 'application/json',
  contentUrl: `${SITE_URL}${relativeUrl}`,
});

const listItem = (position, item) => ({
  '@type': 'ListItem',
  position,
  item,
});

function buildProfileGraph(route, locale, facts, url) {
  const page = basePageNode(route, locale, facts, url, 'ProfilePage');
  page.mainEntity = { '@id': PROFILE_ID };
  return [
    personNode(),
    websiteNode(languageValue(route, locale)),
    imageNode(route, locale, url),
    ...(route.id === 'main' ? [] : [breadcrumbNode(route, locale, url)]),
    page,
  ];
}

function buildWebPageGraph(route, locale, facts, url) {
  return [
    personNode(),
    websiteNode(languageValue(route, locale)),
    imageNode(route, locale, url),
    basePageNode(route, locale, facts, url),
    breadcrumbNode(route, locale, url),
  ];
}

function buildContentIndexGraph(route, locale, facts, url) {
  const key = localeKey(route, locale);
  const page = basePageNode(route, locale, facts, url, 'CollectionPage');
  const list = {
    '@type': 'ItemList',
    '@id': `${url}#index`,
    name: key === 'zh' ? '内容索引' : 'Content index',
    itemListOrder: 'https://schema.org/ItemListUnordered',
    numberOfItems: 0,
  };
  page.mainEntity = { '@id': `${url}#index` };
  return [
    personNode(), websiteNode(languageValue(route, locale)), imageNode(route, locale, url),
    breadcrumbNode(route, locale, url), page, list,
  ];
}

function buildContentArticleGraph(route, locale, facts, url) {
  const key = localeKey(route, locale);
  const article = {
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: route.locales[key].title,
    description: route.locales[key].description,
    url,
    inLanguage: languageValue(route, locale),
    author: { '@id': PROFILE_ID },
    publisher: { '@id': PROFILE_ID },
    image: { '@id': `${url}#primaryimage` },
    ...(facts.dateModified ? { dateModified: facts.dateModified } : {}),
  };
  return [
    personNode(), websiteNode(languageValue(route, locale)), imageNode(route, locale, url),
    breadcrumbNode(route, locale, url), basePageNode(route, locale, facts, url), article,
  ];
}

function buildArenaGraph(route, locale, facts, url) {
  const key = localeKey(route, locale);
  const datasetId = `${url}#dataset`;
  const appId = `${url}#application`;
  const methodologyId = `${url}#methodology`;
  const dataset = {
    '@type': 'Dataset',
    '@id': datasetId,
    name: key === 'zh' ? '竞技场公开模拟记录' : 'Arena public simulation records',
    description:
      key === 'zh'
        ? '用于竞技场界面的 QF-01 模型清单、模拟交易运行日志、预测日志与股票池。'
        : 'QF-01 model manifest, simulation run logs, prediction logs, and equity universe used by the Arena interface.',
    url,
    inLanguage: languageValue(route, locale),
    creator: { '@id': PROFILE_ID },
    measurementTechnique: [
      'rule-constrained model simulation',
      'benchmark-relative return tracking',
      'costed walk-forward factor simulation',
    ],
    variableMeasured: [
      'model prediction',
      'simulated position',
      'simulated return',
      'benchmark return',
      'factor score',
      'constrained portfolio weight',
    ],
    distribution: [
      datasetDistribution('Arena run log', '/arena-runlog.json'),
      datasetDistribution('Arena prediction log', '/arena-predlog.json'),
      datasetDistribution('Arena equity universe', '/arena-universe.json'),
      datasetDistribution('QF-01 model manifest', '/arena-quant-model.json'),
    ],
    ...(facts.dateModified ? { dateModified: facts.dateModified } : {}),
  };
  const app = {
    '@type': 'WebApplication',
    '@id': appId,
    name: route.locales[key].title,
    description: route.locales[key].description,
    url,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript',
    inLanguage: languageValue(route, locale),
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: 0, priceCurrency: 'AUD' },
    mainEntity: { '@id': datasetId },
  };
  const methodology = {
    '@type': 'Article',
    '@id': methodologyId,
    headline:
      key === 'zh' ? '竞技场模拟方法与边界' : 'Arena simulation methodology and limits',
    description:
      key === 'zh'
        ? 'QF-01 在含交易成本的无前视滚动窗口中执行因子评分、市场状态识别与组合硬约束；三套模型模拟账本另与 SPY、SMH 对照。所有结果均为研究模拟，非投资建议。'
        : 'QF-01 applies factor scoring, regime detection and hard portfolio constraints in a costed, no-look-ahead walk-forward window; three separate model ledgers are compared with SPY and SMH. All outcomes are research simulations, not investment advice.',
    url: `${url}#briefing`,
    inLanguage: languageValue(route, locale),
    author: { '@id': PROFILE_ID },
    publisher: { '@id': PROFILE_ID },
    about: { '@id': datasetId },
    isPartOf: { '@id': `${url}#webpage` },
  };
  const page = basePageNode(route, locale, facts, url);
  page.mainEntity = { '@id': appId };
  page.hasPart = { '@id': methodologyId };
  return [
    personNode(),
    websiteNode(languageValue(route, locale)),
    imageNode(route, locale, url),
    page,
    app,
    methodology,
    dataset,
    breadcrumbNode(route, locale, url),
  ];
}

function buildSectorsGraph(route, locale, facts, url) {
  const key = localeKey(route, locale);
  const itemListId = `${url}#ecosystem-list`;
  const items = (facts.items || []).map((entry, index) =>
    listItem(index + 1, {
      '@type': 'Organization',
      name: entry.name,
      ...(entry.category ? { category: entry.category } : {}),
      ...(entry.url ? { sameAs: entry.url } : {}),
    }),
  );
  const page = basePageNode(route, locale, facts, url, 'CollectionPage');
  page.mainEntity = { '@id': itemListId };
  return [
    personNode(),
    websiteNode(languageValue(route, locale)),
    imageNode(route, locale, url),
    page,
    {
      '@type': 'ItemList',
      '@id': itemListId,
      name: key === 'zh' ? '中美 AI 生态实体' : 'US–China AI ecosystem entities',
      numberOfItems: items.length,
      itemListElement: items,
    },
    breadcrumbNode(route, locale, url),
  ];
}

function buildSignalGraph(route, locale, facts, url) {
  const key = localeKey(route, locale);
  const itemListId = `${url}#incident-list`;
  const items = (facts.items || []).map((entry, index) =>
    listItem(index + 1, {
      '@type': 'Event',
      '@id': `${url}#${entry.id}`,
      name: localized(entry.name, key),
      startDate: entry.date,
      eventStatus: 'https://schema.org/EventCompleted',
      eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
      location: {
        '@type': 'VirtualLocation',
        url: `${url}#incidents`,
      },
    }),
  );
  const page = basePageNode(route, locale, facts, url, 'CollectionPage');
  page.mainEntity = { '@id': itemListId };
  return [
    personNode(),
    websiteNode(languageValue(route, locale)),
    imageNode(route, locale, url),
    page,
    {
      '@type': 'ItemList',
      '@id': itemListId,
      name: key === 'zh' ? '宏观事件记录' : 'Macroeconomic incident log',
      numberOfItems: items.length,
      itemListElement: items,
    },
    breadcrumbNode(route, locale, url),
  ];
}

function buildStatsGraph(route, locale, facts, url) {
  const key = localeKey(route, locale);
  const catalogId = `${url}#catalog`;
  const datasets = [
    {
      '@type': 'Dataset',
      '@id': `${url}#world-cup-dataset`,
      name: key === 'zh' ? '2026 世界杯竞猜记录' : '2026 World Cup prediction records',
      description:
        key === 'zh'
          ? '包含赛前预测、置信度、最终比分与命中结果的可下载记录。'
          : 'Downloadable records containing pre-match predictions, confidence, final scores, and outcomes.',
      distribution: [
        datasetDistribution('World Cup prediction records', '/games-data.json'),
      ],
      variableMeasured: ['prediction', 'confidence', 'score', 'outcome'],
      measurementTechnique: ['Wilson interval', 'Brier score', 'bootstrap resampling'],
      dateModified:
        facts.provenance?.find((entry) => entry.path.endsWith('games-data.json'))?.date,
      creator: { '@id': PROFILE_ID },
      inLanguage: languageValue(route, locale),
      isPartOf: { '@id': catalogId },
    },
    {
      '@type': 'Dataset',
      '@id': `${url}#msi-dataset`,
      name: key === 'zh' ? '2026 MSI 竞猜记录' : '2026 MSI prediction records',
      description:
        key === 'zh'
          ? '包含系列赛预测、置信度、最终比分与命中结果的可下载记录。'
          : 'Downloadable records containing series predictions, confidence, final scores, and outcomes.',
      distribution: [datasetDistribution('MSI prediction records', '/leagues-data.json')],
      variableMeasured: ['prediction', 'confidence', 'score', 'outcome'],
      measurementTechnique: ['Wilson interval', 'Brier score', 'bootstrap resampling'],
      dateModified:
        facts.provenance?.find((entry) => entry.path.endsWith('leagues-data.json'))?.date,
      creator: { '@id': PROFILE_ID },
      inLanguage: languageValue(route, locale),
      isPartOf: { '@id': catalogId },
    },
  ];
  const page = basePageNode(route, locale, facts, url);
  page.mainEntity = { '@id': catalogId };
  return [
    personNode(),
    websiteNode(languageValue(route, locale)),
    imageNode(route, locale, url),
    page,
    {
      '@type': 'DataCatalog',
      '@id': catalogId,
      name: key === 'zh' ? 'Project Afflatus 竞猜数据目录' : 'Project Afflatus prediction data catalog',
      description: route.locales[key].description,
      url,
      dataset: datasets.map((dataset) => ({ '@id': dataset['@id'] })),
      ...(facts.dateModified ? { dateModified: facts.dateModified } : {}),
    },
    ...datasets,
    breadcrumbNode(route, locale, url),
  ];
}

function buildHoroscopeGraph(route, locale, facts, url) {
  const key = localeKey(route, locale);
  const appId = `${url}#application`;
  const page = basePageNode(route, locale, facts, url);
  page.mainEntity = { '@id': appId };
  return [
    personNode(),
    websiteNode(languageValue(route, locale)),
    imageNode(route, locale, url),
    page,
    {
      '@type': 'WebApplication',
      '@id': appId,
      name: route.locales[key].title,
      description: route.locales[key].description,
      url,
      applicationCategory: 'EntertainmentApplication',
      operatingSystem: 'Any',
      browserRequirements: 'Requires JavaScript',
      inLanguage: languageValue(route, locale),
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: 0, priceCurrency: 'AUD' },
      audience: {
        '@type': 'Audience',
        audienceType: key === 'zh' ? '仅供娱乐' : 'Entertainment only',
      },
    },
    breadcrumbNode(route, locale, url),
  ];
}

function buildCityviewGraph(route, locale, facts, url) {
  const key = localeKey(route, locale);
  const appId = `${url}#application`;
  const page = basePageNode(route, locale, facts, url);
  page.mainEntity = { '@id': appId };
  return [
    personNode(),
    websiteNode(languageValue(route, locale)),
    imageNode(route, locale, url),
    page,
    {
      '@type': 'WebApplication',
      '@id': appId,
      name: route.locales[key].title,
      description: route.locales[key].description,
      url,
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Any',
      browserRequirements: 'Requires JavaScript; WebGL is optional',
      inLanguage: languageValue(route, locale),
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: 0, priceCurrency: 'AUD' },
    },
    breadcrumbNode(route, locale, url),
  ];
}

function buildSerialGraph(route, locale, facts, url) {
  const key = localeKey(route, locale);
  const series = (facts.novels || []).map((entry) => {
    const novel = entry.novel;
    const seriesUrl =
      locale === 'adaptive'
        ? `${SITE_URL}/novels/${entry.id}/`
        : `${SITE_URL}/${key}/novels/${entry.id}/`;
    return {
      '@type': ['Book', 'CreativeWorkSeries'],
      '@id': `${seriesUrl}#series`,
      url: seriesUrl,
      name: novel.title,
      alternativeHeadline: novel.subtitle,
      description: novel.intro,
      author: { '@type': 'Person', name: novel.author },
      inLanguage: 'zh-CN',
      datePublished: novel.startDate,
      numberOfItems: entry.chapterCount,
      genre: novel.tags,
      isPartOf: { '@id': `${url}#bookshelf` },
    };
  });
  const listItems = series.map((entry, index) =>
    listItem(index + 1, { '@id': entry['@id'] }),
  );
  const page = basePageNode(route, locale, facts, url, 'CollectionPage');
  page.inLanguage = 'zh-CN';
  page.mainEntity = { '@id': `${url}#bookshelf` };
  return [
    personNode(),
    websiteNode('zh-CN'),
    imageNode(route, locale, url),
    page,
    {
      '@type': 'ItemList',
      '@id': `${url}#bookshelf`,
      name: '原创连载书架',
      numberOfItems: listItems.length,
      itemListElement: listItems,
    },
    ...series,
    breadcrumbNode(route, locale, url),
  ];
}

function buildCourseGraph(route, locale, facts, url) {
  const key = localeKey(route, locale);
  const courseId = `${url}#course`;
  const outlineId = `${url}#outline`;
  const outline = COURSE_SECTIONS.map((section, index) =>
    listItem(index + 1, {
      '@type': 'LearningResource',
      name: section[key],
      url: `${url}#${section.id}`,
      inLanguage: LANGUAGE_TAGS[key],
      isPartOf: { '@id': courseId },
    }),
  );
  const page = basePageNode(route, locale, facts, url);
  page.mainEntity = { '@id': courseId };
  return [
    personNode(),
    websiteNode(languageValue(route, locale)),
    imageNode(route, locale, url),
    page,
    {
      '@type': 'Course',
      '@id': courseId,
      name: route.locales[key].title,
      description: route.locales[key].description,
      url,
      provider: { '@id': PROFILE_ID },
      inLanguage: languageValue(route, locale),
      isAccessibleForFree: true,
      hasPart: { '@id': outlineId },
    },
    {
      '@type': 'ItemList',
      '@id': outlineId,
      name: key === 'zh' ? '课程章节' : 'Course outline',
      numberOfItems: outline.length,
      itemListElement: outline,
    },
    breadcrumbNode(route, locale, url),
  ];
}

const BUILDERS = Object.freeze({
  webpage: buildWebPageGraph,
  'content-index': buildContentIndexGraph,
  'content-article': buildContentArticleGraph,
  profile: buildProfileGraph,
  arena: buildArenaGraph,
  sectors: buildSectorsGraph,
  signal: buildSignalGraph,
  stats: buildStatsGraph,
  horoscope: buildHoroscopeGraph,
  cityview: buildCityviewGraph,
  serial: buildSerialGraph,
  course: buildCourseGraph,
});

export function buildRouteStructuredData(route, {
  locale = 'adaptive',
  facts = {},
} = {}) {
  const kind = route.seo?.structuredData?.kind;
  const builder = BUILDERS[kind];
  if (!builder) {
    throw new Error(`No structured-data builder configured for route "${route.id}".`);
  }
  const url = routeUrl(route, locale);
  return {
    '@context': 'https://schema.org',
    '@graph': builder(route, locale, facts, url),
  };
}

export function validateRouteStructuredData(route, graph) {
  const errors = [];
  const nodes = graph?.['@graph'];
  if (graph?.['@context'] !== 'https://schema.org' || !Array.isArray(nodes)) {
    return [`${route.id}: structured data must contain a Schema.org @graph.`];
  }

  const types = new Set(
    nodes.flatMap((node) =>
      Array.isArray(node['@type']) ? node['@type'] : [node['@type']],
    ),
  );
  for (const expected of route.schema) {
    if (!types.has(expected)) {
      errors.push(`${route.id}: missing declared Schema.org type ${expected}.`);
    }
  }
  if (route.id !== 'main' && !types.has('BreadcrumbList')) {
    errors.push(`${route.id}: missing BreadcrumbList.`);
  }
  if (route.id === 'sectors' && types.has('Dataset')) {
    errors.push('sectors: must not claim Dataset without a stable download.');
  }
  if (route.id === 'signal' && types.has('NewsArticle')) {
    errors.push('signal: must not claim NewsArticle for a curated collection page.');
  }
  return errors;
}

export function renderRouteSeoBlock(route, {
  locale = 'adaptive',
  facts = {},
} = {}) {
  const key = localeKey(route, locale);
  const language = LANGUAGE_TAGS[key];
  const url = routeUrl(route, locale);
  const image =
    locale === 'adaptive' ? route.metadata.ogImage : route.seo.social.images[key];
  const alt = route.seo.social.alt[key];
  const title =
    locale === 'adaptive' ? route.metadata.ogTitle : route.locales[key].title;
  const description =
    locale === 'adaptive'
      ? route.metadata.ogDescription
      : route.locales[key].description;
  const graph = buildRouteStructuredData(route, { locale, facts });

  return [
    SEO_START,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${escapeAttribute(SITE_NAME)}">`,
    `<meta property="og:title" content="${escapeAttribute(title)}">`,
    `<meta property="og:description" content="${escapeAttribute(description)}">`,
    `<meta property="og:url" content="${escapeAttribute(url)}">`,
    `<meta property="og:locale" content="${OG_LOCALES[key]}">`,
    ...(route.id === 'serial'
      ? []
      : [`<meta property="og:locale:alternate" content="${OG_LOCALES[key === 'en' ? 'zh' : 'en']}">`]),
    `<meta property="og:image" content="${escapeAttribute(image)}">`,
    `<meta property="og:image:secure_url" content="${escapeAttribute(image)}">`,
    `<meta property="og:image:type" content="${SOCIAL_CARD.format}">`,
    `<meta property="og:image:width" content="${SOCIAL_CARD.width}">`,
    `<meta property="og:image:height" content="${SOCIAL_CARD.height}">`,
    `<meta property="og:image:alt" content="${escapeAttribute(alt)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeAttribute(title)}">`,
    `<meta name="twitter:description" content="${escapeAttribute(description)}">`,
    `<meta name="twitter:image" content="${escapeAttribute(image)}">`,
    `<meta name="twitter:image:alt" content="${escapeAttribute(alt)}">`,
    `<script type="application/ld+json" data-afflatus-route-schema="${route.id}" lang="${language}">`,
    jsonForHtml(graph),
    '</script>',
    SEO_END,
  ].join('\n  ');
}

const attrValue = (node, name) =>
  node.attrs?.find((attribute) => attribute.name === name)?.value || '';

const walk = (node, visit) => {
  visit(node);
  for (const child of node.childNodes || []) walk(child, visit);
  if (node.content) walk(node.content, visit);
};

export function transformRouteSeoSource(source, route, {
  locale = 'adaptive',
  facts = {},
} = {}) {
  const existingStart = source.indexOf(SEO_START);
  const existingEnd = source.indexOf(SEO_END, existingStart + SEO_START.length);
  if (existingStart >= 0 && existingEnd >= existingStart) {
    const lineStart = source.lastIndexOf('\n', existingStart) + 1;
    const prefix = source.slice(lineStart, existingStart);
    const replacementStart = /^\s*$/.test(prefix) ? lineStart : existingStart;
    const afterMarker = existingEnd + SEO_END.length;
    const lineEnd = source.indexOf('\n', afterMarker);
    const suffix = lineEnd >= 0 ? lineEnd + 1 : afterMarker;
    const block = `  ${renderRouteSeoBlock(route, { locale, facts })}\n`;
    return `${source.slice(0, replacementStart)}${block}${source.slice(suffix)}`;
  }

  const document = parse(source, { sourceCodeLocationInfo: true });
  let head;
  const ranges = [];

  walk(document, (node) => {
    if (node.tagName === 'head') head = node;
    const location = node.sourceCodeLocation;
    if (!location) return;

    if (node.nodeName === '#comment') {
      const value = String(node.data || '').trim();
      if (
        value === SEO_START.slice(4, -3).trim() ||
        value === SEO_END.slice(4, -3).trim()
      ) {
        ranges.push([location.startOffset, location.endOffset]);
      }
      return;
    }

    if (node.tagName === 'meta') {
      const property = attrValue(node, 'property');
      const name = attrValue(node, 'name');
      if (property.startsWith('og:') || name.startsWith('twitter:')) {
        ranges.push([location.startOffset, location.endOffset]);
      }
      return;
    }

    if (
      node.tagName === 'script' &&
      attrValue(node, 'type').toLowerCase() === 'application/ld+json'
    ) {
      ranges.push([location.startOffset, location.endOffset]);
    }
  });

  if (!head?.sourceCodeLocation?.endTag) {
    throw new Error(`${route.file}: cannot locate </head> for SEO synchronization.`);
  }

  const insertionOffset = ranges.length
    ? Math.min(...ranges.map(([start]) => start))
    : head.sourceCodeLocation.endTag.startOffset;
  const block = `  ${renderRouteSeoBlock(route, { locale, facts })}\n`;
  const removals = ranges
    .sort(([left], [right]) => right - left)
    .map(([start, end]) => ({ start, end }));

  let transformed = source;
  for (const range of removals) {
    transformed = `${transformed.slice(0, range.start)}${transformed.slice(range.end)}`;
  }

  const removedBeforeInsertion = ranges
    .filter(([start]) => start < insertionOffset)
    .reduce((total, [start, end]) => total + end - start, 0);
  const adjustedOffset = insertionOffset - removedBeforeInsertion;
  transformed = `${transformed.slice(0, adjustedOffset)}${block}${transformed.slice(adjustedOffset)}`;
  return transformed.replace(/\n[ \t]*\n[ \t]*\n/g, '\n\n');
}
