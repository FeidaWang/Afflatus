import { navigationHref, navigationLabel } from '../lib/siteNavigation.js';

export const LATEST_HEADING = {
  title: { en: 'Latest', zh: '最新' },
  note: {
    en: 'Every thesis needs a way to be wrong. Keep measurements, disclosures, calculations and hypotheses separate, then make the missing evidence visible.',
    zh: '每一个判断，都需要被证伪的可能。区分测量、披露、计算与假设，让缺失的证据也清晰可见。',
  },
};

// Dates, titles and summaries come from the data files through homeLatest.generated.js.
export const LATEST_ACTIONS = {
  '/sectors.html': { en: 'Enter the observatory', zh: '进入观察站' },
  '/signal.html': { en: 'Read Fed Watch', zh: '阅读美联储观察' },
  '/serial.html': { en: 'Open the library', zh: '进入书架' },
};

export const LEARN_HEADING = { en: 'Learn more', zh: '了解更多' };

export const LEARN_CARDS = [
  {
    href: '/course.html',
    image: '/assets/home/learn-courses.webp',
    width: 640,
    height: 704,
    title: { en: 'FDE 0→1', zh: 'FDE 0→1' },
    summary: {
      en: 'A 24-week bilingual course: build useful tools, verify AI agents, and learn to deploy, recover and improve them.',
      zh: '24 周双语实践课程：构建有用工具，验证 AI 智能体，学习部署、恢复与受控改进。',
    },
  },
  {
    href: '/about.html',
    image: '/assets/home/learn-about.webp',
    width: 640,
    height: 704,
    title: { en: 'I’m Feida Wang, a software engineer in Melbourne.', zh: '我是王飞达，墨尔本的软件工程师。' },
    summary: {
      en: 'I design, build and ship working software with coding agents: AI industry research, economic updates, a course and original fiction.',
      zh: '我借助编程智能体设计、构建并上线真实运行的软件：AI 产业研究、经济动态、实践课程，还有原创小说。',
    },
  },
  {
    href: '/horoscope.html',
    image: '/assets/home/learn-astrology.webp',
    width: 573,
    height: 630,
    title: { en: 'Astrology for fun', zh: '趣味占星' },
    summary: {
      en: 'Bazi, Western astrology and two-person synastry calculated on your device. For entertainment only.',
      zh: '在你的设备上计算的八字、西方占星与双人合盘。仅供娱乐。',
    },
  },
  {
    href: '/worlds.html',
    image: '/assets/home/learn-worlds.webp',
    width: 414,
    height: 455,
    title: { en: 'Worlds 2026 odds & picks', zh: '2026 全球总决赛赔率与竞猜' },
    summary: {
      en: 'Pre-match win probabilities, champion odds and Fearless Draft pools. Entertainment only.',
      zh: '赛前胜率、夺冠概率与无畏征召英雄池。仅供娱乐。',
    },
  },
];

const escapeHtml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const text = (tag, copy, attrs = '') => `<${tag}${attrs} data-en="${escapeHtml(copy.en)}" data-zh="${escapeHtml(copy.zh)}">${escapeHtml(copy.en)}</${tag}>`;

// Static fallback for #root, written into index.html by scripts/site-manifest.mjs.
// Keep in step with the matching sections of PremiereApp.jsx.
export function renderHomeCards(latest) {
  const latestCards = latest.map(({ href, date, title, summary }) => `<article class="home-card">
            <p class="home-card-meta">${text('span', navigationLabel(href))}${date ? text('time', date.label, ` datetime="${date.iso}"`) : ''}</p>
            ${text('h3', title)}
            ${text('p', summary, ' class="home-card-summary"')}
            <a class="home-card-action" href="${navigationHref(href, 'en')}">${text('span', LATEST_ACTIONS[href])}</a>
          </article>`).join('\n          ');
  const learnCards = LEARN_CARDS.map(({ href, image, width, height, title, summary }) => `<a class="home-learn-card" href="${navigationHref(href, 'en')}">
            ${text('span', navigationLabel(href), ' class="home-learn-label"')}
            <img src="${image}" width="${width}" height="${height}" alt="" loading="lazy" decoding="async">
            ${text('h3', title)}
            ${text('p', summary)}
          </a>`).join('\n          ');
  return `<section class="home-latest section-shell" id="major-releases" aria-labelledby="latest-title">
        <div class="section-heading">${text('h2', LATEST_HEADING.title, ' id="latest-title"')}${text('p', LATEST_HEADING.note)}</div>
        <div class="home-latest-grid">
          ${latestCards}
        </div>
      </section>
      <section class="home-learn section-shell" id="learn-more" aria-labelledby="learn-title">
        ${text('h2', LEARN_HEADING, ' id="learn-title"')}
        <div class="home-learn-grid">
          ${learnCards}
        </div>
      </section>`;
}
