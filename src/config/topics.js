// Editorial side of public/topics-index.json; scripts/site-manifest.mjs adds the
// titles, summaries and dates that the routes and content files already own.

export const TOPIC_GROUPS = Object.freeze({
  analysis: { en: 'Analysis', zh: '分析' },
  courses: { en: 'Courses', zh: '课程' },
  serials: { en: 'Serials', zh: '连载' },
  labs: { en: 'Labs', zh: '实验室' },
  about: { en: 'About', zh: '关于' },
});

export const TOPICS = Object.freeze([
  {
    id: 'ai-observatory',
    group: 'analysis',
    title: { en: 'AI Observatory', zh: 'AI 观察站' },
    summary: {
      en: 'The companies, models and economics shaping AI, with the evidence shown.',
      zh: '塑造 AI 的公司、模型与商业逻辑，并列出依据。',
    },
  },
  {
    id: 'investing',
    group: 'analysis',
    title: { en: 'Investing & macro', zh: '投资与宏观' },
    summary: {
      en: 'A portfolio record, a daily stock journal and Federal Reserve policy, read together.',
      zh: '投资记录、每日美股看板与美联储政策，放在一起读。',
    },
  },
  {
    id: 'fde-course',
    group: 'courses',
    title: { en: 'FDE 0→1', zh: 'FDE 0→1' },
    summary: {
      en: 'Twenty-four weeks of building useful tools with AI, with a guide, a handbook and a source library.',
      zh: '用 AI 做有用工具的 24 周实践课程，另有入门指南、实践手册与来源库。',
    },
  },
  {
    id: 'serials',
    group: 'serials',
    title: { en: 'Serials', zh: '连载' },
    summary: {
      en: 'Original serialised fiction, published in Chinese.',
      zh: '原创中文连载小说。',
    },
  },
  {
    id: 'labs',
    group: 'labs',
    title: { en: 'Labs', zh: '实验室' },
    summary: {
      en: 'Small experiments for entertainment: astrology charts and Worlds 2026 odds.',
      zh: '娱乐向的小实验：占星排盘与全球总决赛赔率。',
    },
  },
  {
    id: 'about',
    group: 'about',
    title: { en: 'About', zh: '关于' },
    summary: {
      en: 'The person behind this site, and the main things built here.',
      zh: '这个站背后的人，以及在这里做出的主要作品。',
    },
  },
]);

// Listed in the order entries appear in the index, which is the order results are shown in.
// The first topic is the entry's own; the About topic also collects the main works.
export const ROUTE_TOPICS = Object.freeze({
  sectors: { group: 'analysis', topic: ['ai-observatory', 'about'], cover: '/assets/topics/sectors.webp' },
  signal: { group: 'analysis', topic: ['investing', 'about'], cover: '/assets/topics/signal.webp' },
  arena: { group: 'analysis', topic: ['investing'], cover: '/assets/topics/arena.webp' },
  portfolio: { group: 'analysis', topic: ['investing'], cover: '/assets/topics/home.webp' },
  course: { group: 'courses', topic: ['fde-course', 'about'], cover: '/assets/topics/learn-courses.webp' },
  serial: { group: 'serials', topic: ['serials', 'about'], cover: '/assets/topics/serial.webp' },
  horoscope: { group: 'labs', topic: ['labs'], cover: '/assets/topics/learn-astrology.webp' },
  worlds: { group: 'labs', topic: ['labs'], cover: '/assets/topics/learn-worlds.webp' },
  about: { group: 'about', topic: ['about'], cover: '/assets/topics/learn-about.webp' },
  main: { group: 'about', topic: ['about'], cover: '/assets/topics/home.webp' },
});

// Chapters of /sectors.html that stand on their own; ids match its section anchors.
export const OBSERVATORY_CHAPTERS = Object.freeze([
  {
    id: 'overview',
    title: { en: 'The ecosystem', zh: '产业全景' },
    summary: {
      en: 'Who depends on whom across chips, cloud, models and applications.',
      zh: '芯片、云、模型与应用之间，谁依赖谁。',
    },
  },
  {
    id: 'models',
    cover: '/assets/labs/observatory-moon.webp',
    title: { en: 'The models', zh: '模型前沿' },
    summary: {
      en: 'How frontier models compare on capability and cost, by vendor.',
      zh: '按厂商比较前沿模型的能力与成本。',
    },
  },
  {
    id: 'rivalry',
    title: { en: 'US & China', zh: '中美竞逐' },
    summary: {
      en: 'Two powers competing inside one interdependent industry.',
      zh: '两个大国，在同一个相互依存的产业里竞逐。',
    },
  },
  {
    id: 'sources',
    cover: '/assets/labs/reading-landscape-480.webp',
    title: { en: 'Evidence, not a moving headline', zh: '依据，而不只是一条滚动标题' },
    summary: {
      en: 'Where the numbers come from, and what each claim rests on.',
      zh: '数字从哪里来，每项判断依据什么。',
    },
  },
]);

// Copy for the course companion pages; the pages themselves are rendered by
// scripts/generate-course-pages.mjs.
export const COURSE_COMPANIONS = Object.freeze({
  guide: {
    title: { en: 'Start with a useful question', zh: '从这里开始' },
    summary: { en: 'From vibe coding to a personal FDE: a 24-week practice route.', zh: '从 Vibe Coding 到个人 FDE：24 周实践路线。' },
  },
  handbook: {
    title: { en: 'A handbook for the work ahead', zh: '一本随身的实践手册' },
    summary: { en: 'From vibe coding to a personal FDE: a 24-week practice route.', zh: '从 Vibe Coding 到个人 FDE：24 周实践路线。' },
  },
  resources: {
    title: { en: 'Back to the sources', zh: '回到原始来源' },
    summary: { en: '78 courses, official documents and original research sources, with verification scope.', zh: '78 项公开课、官方文档与原始研究，附核对范围。' },
  },
});
