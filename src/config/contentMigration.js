/**
 * M15 content ownership. The homepage may name these subjects, but published
 * research and longform work live on the quiet, addressable routes below.
 * Source routes remain intact so no conclusion, date, chart or deep link is
 * silently rewritten during the information-architecture migration.
 */
export const CONTENT_MIGRATION = Object.freeze([
  Object.freeze({
    id: 'fy25-26-field-record',
    subject: { en: 'FY25/26 field record and method', zh: 'FY25/26 现场记录与方法' },
    collection: 'capital',
    destination: '/capital/fy25-26/',
    source: '/portfolio.html#fy2026Performance',
    template: 'case-study',
  }),
  Object.freeze({
    id: 'fed-long-end',
    subject: { en: 'Federal Reserve and long-end signal', zh: '美联储与长端信号' },
    collection: 'intelligence',
    destination: '/signal.html',
    source: '/signal.html',
    template: 'dossier',
  }),
  Object.freeze({
    id: 'solar-atlas',
    subject: { en: 'AI industry Solar Atlas', zh: 'AI 产业太阳图鉴' },
    collection: 'intelligence',
    destination: '/intelligence/solar-atlas/',
    source: '/portfolio.html#solarAtlas',
    template: 'case-study',
  }),
  Object.freeze({
    id: 'qf-01',
    subject: { en: 'QF-01 research simulation', zh: 'QF-01 研究模拟' },
    collection: 'experiments',
    destination: '/arena.html',
    source: '/arena.html',
    template: 'dossier',
  }),
  Object.freeze({
    id: 'cityview',
    subject: { en: 'Cityview observatory', zh: '城市推演台' },
    collection: 'experiments',
    destination: '/cityview.html',
    source: '/cityview.html',
    template: 'application',
  }),
  Object.freeze({
    id: 'horoscope',
    subject: { en: 'Bazi and astrology', zh: '八字与西方占星' },
    collection: 'experiments',
    destination: '/horoscope.html',
    source: '/horoscope.html',
    template: 'application',
  }),
  Object.freeze({
    id: 'course',
    subject: { en: 'Forward Deployed Engineer field manual', zh: 'Forward Deployed Engineer 实战手册' },
    collection: 'field-notes',
    destination: '/course.html',
    source: '/course.html',
    template: 'longform',
  }),
  Object.freeze({
    id: 'novels',
    subject: { en: 'Original fiction', zh: '原创小说连载' },
    collection: 'field-notes',
    destination: '/serial.html',
    source: '/serial.html',
    template: 'longform',
  }),
]);

export const CONTENT_TEMPLATES = Object.freeze({
  homepage: Object.freeze({ role: 'entry', continuousThree: false }),
  index: Object.freeze({ role: 'feature-and-complete-index', continuousThree: false }),
  'case-study': Object.freeze({ role: 'wide-hero-narrow-reading-breakout', continuousThree: false }),
  dossier: Object.freeze({ role: 'evidence-led-dossier', continuousThree: false }),
  longform: Object.freeze({ role: '680-760px-reading-column', continuousThree: false }),
});

export const CONTENT_COLLECTIONS = Object.freeze({
  capital: Object.freeze({
    routeId: 'capital',
    eyebrow: { en: 'Capital / published record', zh: '资本 / 已发布记录' },
    title: { en: 'A field record, not a live feed.', zh: '一份现场记录，不是实时行情。' },
    introduction: {
      en: 'Published trajectories, method notes and source material live here without exposing account values or live positions.',
      zh: '已发布的轨迹、方法说明与来源材料在此归档；不展示账户数值或实时仓位。',
    },
    featured: 'fy25-26-field-record',
    items: ['solar-atlas', 'qf-01'],
  }),
  intelligence: Object.freeze({
    routeId: 'intelligence',
    eyebrow: { en: 'Intelligence / dossiers', zh: '情报 / 档案' },
    title: { en: 'Signals with a destination.', zh: '每条信号都有去处。' },
    introduction: {
      en: 'Federal Reserve observations, long-end context and the AI industry atlas are separated into readable, source-aware dossiers.',
      zh: '美联储观察、长端背景与 AI 产业图鉴被拆分为可阅读、可追溯来源的档案。',
    },
    featured: 'fed-long-end',
    items: ['solar-atlas'],
  }),
  'field-notes': Object.freeze({
    routeId: 'field-notes',
    eyebrow: { en: 'Field notes / longform', zh: '现场笔记 / 长文' },
    title: { en: 'Read at the speed of thought.', zh: '以思考应有的速度阅读。' },
    introduction: {
      en: 'The field manual and original fiction keep their own quiet reading surfaces, independent of the homepage flight.',
      zh: '实战手册与原创小说拥有独立、安静的阅读界面，不依赖首页的飞行演出。',
    },
    featured: 'course',
    items: ['novels'],
  }),
  experiments: Object.freeze({
    routeId: 'experiments',
    eyebrow: { en: 'Experiments / bounded systems', zh: '实验 / 有边界的系统' },
    title: { en: 'Prototype openly. Label honestly.', zh: '开放原型，如实标注。' },
    introduction: {
      en: 'Research simulations and local-first tools remain useful when their boundaries are explicit.',
      zh: '当边界被明确说明时，研究模拟与本地优先工具依然有用。',
    },
    featured: 'qf-01',
    items: ['cityview', 'horoscope'],
  }),
});

export const CONTENT_CASES = Object.freeze({
  'capital-record': Object.freeze({
    routeId: 'capital-record',
    migration: 'fy25-26-field-record',
    eyebrow: { en: 'Capital / case study', zh: '资本 / 案例研究' },
    title: { en: 'FY25/26 Field Record', zh: 'FY25/26 现场记录' },
    lede: {
      en: 'A stable reading entry for the published capital record, its scope and the original method surface.',
      zh: '为已发布资本记录、范围与原始方法界面提供稳定的阅读入口。',
    },
    paragraphs: {
      en: [
        'This page does not add a live account view, revise a published outcome, or turn a historical field record into advice.',
        'The complete charts and source annotations remain available at their original anchored document so established links continue to resolve.',
      ],
      zh: [
        '本页不会新增实时账户视图、改写已发布结果，或把历史现场记录包装成建议。',
        '完整图表与来源注释仍保留在原有锚点文档中，既有链接可继续访问。',
      ],
    },
    breakout: {
      en: ['Published FY25/26 record', 'No account values', 'Original charts retained'],
      zh: ['已发布 FY25/26 记录', '不展示账户数值', '保留原始图表'],
    },
  }),
  'solar-atlas': Object.freeze({
    routeId: 'solar-atlas',
    migration: 'solar-atlas',
    eyebrow: { en: 'Intelligence / case study', zh: '情报 / 案例研究' },
    title: { en: 'AI Industry Solar Atlas', zh: 'AI 产业太阳图鉴' },
    lede: {
      en: 'An intelligence entry for the published AI-industry map and the original interactive atlas.',
      zh: '为已发布 AI 产业地图与原始交互图鉴建立情报入口。',
    },
    paragraphs: {
      en: [
        'The atlas is retained as a named research lens. This focused route changes neither its source material nor the published research claims.',
        'The complete interactive visualization remains at its original anchored document, preserving existing citations and direct links.',
      ],
      zh: [
        '图鉴作为具名研究视角被保留。本聚焦路由不改变其来源材料或已发布研究结论。',
        '完整交互可视化仍保留在原有锚点文档中，既有引用与直链继续有效。',
      ],
    },
    breakout: {
      en: ['Research lens', 'Source-aware', 'Interactive atlas retained'],
      zh: ['研究视角', '来源可追溯', '保留交互图鉴'],
    },
  }),
});

export function contentMigrationById(id) {
  return CONTENT_MIGRATION.find((item) => item.id === id) || null;
}
