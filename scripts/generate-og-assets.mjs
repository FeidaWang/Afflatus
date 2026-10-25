#!/usr/bin/env node
import { mkdir, readFile, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { profileCardHtml } from './og-profile-card.mjs';
import {
  SITE_LOCALES,
  SITE_MANIFEST,
  SOCIAL_CARD,
  socialCardFilename,
  SITE_NAME,
} from '../src/config/siteManifest.js';
import { novelSocialCardPath } from '../src/lib/serialRoutes.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'public/assets/og');
const FONT_DIR = path.join(ROOT, 'public/assets/fonts');

const ACCENTS = Object.freeze({
  main: '#9bd7ff',
  arena: '#38f2c5',
  sectors: '#77b9ff',
  signal: '#f5d56a',
  horoscope: '#9a5a3d',
  worlds: '#3ec6ff',
  serial: '#ffc4a0',
  course: '#729cff',
  about: '#9bd7ff',
});

// 150+ chapter cards ship in the repository; a lower quality than route cards
// keeps each around a third of their size.
const NOVEL_CARD_QUALITY = 72;

const mimeFor = (filename) => {
  if (filename.endsWith('.png')) return 'image/png';
  if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg';
  throw new Error(`Unsupported OG background format: ${filename}`);
};

const asDataUrl = async (filename, mime) =>
  `data:${mime};base64,${(await readFile(filename)).toString('base64')}`;

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const cardHtml = ({
  route,
  locale,
  backgroundDataUrl,
  sansFont,
}) => {
  const social = route.seo.social;
  if(route.id==='main')return profileCardHtml({locale,sansFont,serifFont,poster});
  if (social.precomposed) {
    // The artwork carries its English title; the Chinese card adds the
    // localized eyebrow and subtitle in the clear area above that title.
    const zhCaption = locale === 'zh'
      ? `<div style="position:absolute;left:44px;top:232px;max-width:330px;color:#efe6d6;font-family:'PingFang SC','Microsoft YaHei',sans-serif;text-shadow:0 2px 12px rgba(0,0,0,.85)"><div style="font-size:18px;letter-spacing:.18em;color:#d9483b">${escapeHtml(social.eyebrow.zh)}</div><div style="font-size:24px;line-height:1.35;margin-top:8px;max-width:250px">${escapeHtml(social.subtitle.zh)}</div></div>`
      : '';
    return `<!doctype html>
<html lang="${locale === 'zh' ? 'zh-CN' : 'en-AU'}">
<head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{width:${SOCIAL_CARD.width}px;height:${SOCIAL_CARD.height}px;margin:0;overflow:hidden;position:relative}img{display:block;width:100%;height:100%;object-fit:cover}</style></head>
<body><img src="${backgroundDataUrl}" alt="">${zhCaption}</body>
</html>`;
  }
  const light = route.id === 'horoscope';
  const accent = ACCENTS[route.id] || route.themeColor;
  const languageLabel = locale === 'zh' ? '中文' : 'ENGLISH';
  const pageLabel = route.path === '/' ? 'feida.au' : `feida.au${route.path}`;
  const direction = light
    ? 'linear-gradient(90deg, rgba(246,239,227,.98) 0%, rgba(246,239,227,.92) 40%, rgba(246,239,227,.18) 76%, transparent 100%)'
    : 'linear-gradient(90deg, rgba(2,4,9,.98) 0%, rgba(2,4,9,.9) 43%, rgba(2,4,9,.2) 77%, transparent 100%)';

  return `<!doctype html>
<html lang="${locale === 'zh' ? 'zh-CN' : 'en-AU'}">
<head>
<meta charset="utf-8">
<style>
@font-face { font-family: "Anthropic Sans"; src: url("${sansFont}") format("woff2"); font-weight: 300 800; }
* { box-sizing: border-box; }
html, body { width: ${SOCIAL_CARD.width}px; height: ${SOCIAL_CARD.height}px; margin: 0; overflow: hidden; }
body {
  color: ${light ? '#24170f' : '#f5f7fb'};
  background: ${light ? '#f6efe3' : '#020409'};
  font-family: "Anthropic Sans", "PingFang SC", "Microsoft YaHei", sans-serif;
}
.background, .wash, .grain, .frame { position: absolute; inset: 0; }
.background { width: 100%; height: 100%; object-fit: cover; }
.wash { background: ${direction}; }
.grain {
  opacity: ${light ? '.11' : '.16'};
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.3'/%3E%3C/svg%3E");
}
.frame { inset: 28px; border: 1px solid ${light ? 'rgba(49,30,18,.24)' : 'rgba(255,255,255,.2)'}; }
.frame::before, .frame::after {
  content: ""; position: absolute; width: 68px; height: 3px; top: -2px;
  background: ${accent};
}
.frame::before { left: 34px; }
.frame::after { right: 34px; }
.content { position: absolute; inset: 58px 66px 54px; display: flex; flex-direction: column; }
.eyebrow {
  display: flex; gap: 14px; align-items: center; font-size: 17px; letter-spacing: .14em;
  text-transform: uppercase; color: ${light ? '#6d402b' : accent};
}
.eyebrow::before { content: ""; width: 34px; height: 2px; background: currentColor; }
h1 {
  max-width: 800px; margin: auto 0 16px; font-family: "Anthropic Sans", "PingFang SC", sans-serif;
  font-size: ${locale === 'zh' ? '76px' : '82px'}; line-height: .98; letter-spacing: ${locale === 'zh' ? '.02em' : '.01em'};
  font-weight: 400; text-wrap: balance; text-shadow: ${light ? 'none' : '0 3px 32px rgba(0,0,0,.65)'};
}
.subtitle {
  max-width: 700px; margin: 0 0 48px; font-size: 21px; line-height: 1.45;
  color: ${light ? 'rgba(36,23,15,.74)' : 'rgba(245,247,251,.72)'};
}
.footer {
  display: flex; align-items: center; justify-content: space-between; font-size: 15px;
  letter-spacing: .08em; color: ${light ? 'rgba(36,23,15,.62)' : 'rgba(245,247,251,.55)'};
}
.route { color: ${light ? '#3c2417' : '#fff'}; }
.locale { display: flex; align-items: center; gap: 10px; }
.locale::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: ${accent}; box-shadow: 0 0 14px ${accent}; }
</style>
</head>
<body>
  <img class="background" src="${backgroundDataUrl}" alt="">
  <div class="wash"></div>
  <div class="grain"></div>
  <div class="frame"></div>
  <main class="content">
    <div class="eyebrow">${escapeHtml(social.eyebrow[locale])}</div>
    <h1>${escapeHtml(social.title[locale])}</h1>
    <p class="subtitle">${escapeHtml(social.subtitle[locale])}</p>
    <div class="footer">
      <span class="route">${escapeHtml(pageLabel)}</span>
      <span class="locale">${languageLabel} · ${SITE_NAME.toUpperCase()}</span>
    </div>
  </main>
</body>
</html>`;
};

// Each book gets its own tint of the serial background. Books without an
// entry here take a hue derived from their id.
const BOOK_HUES = Object.freeze({
  'wanjie-zhongchun': 120,
  'yuxi-gongci': 20,
  'changye-qingjian': 215,
});
const bookHue = (bookId) => BOOK_HUES[bookId]
  ?? [...bookId].reduce((hash, char) => (hash * 31 + char.codePointAt(0)) % 360, 7);

const novelCardHtml = ({ book, chapter, backgroundDataUrl }) => {
  const hue = bookHue(book.id);
  const accent = `hsl(${hue} 70% 74%)`;
  const [number, name] = chapter
    ? (chapter.title.includes(' · ') ? chapter.title.split(' · ', 2) : ['', chapter.title])
    : ['', book.novel.title];
  const nameSize = Array.from(name).length > 10 ? 64 : 84;
  const pagePath = chapter
    ? `feida.au/zh/novels/${book.id}/${chapter.id}/`
    : `feida.au/zh/novels/${book.id}/`;
  return `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><style>
* { box-sizing: border-box; }
html, body { width: ${SOCIAL_CARD.width}px; height: ${SOCIAL_CARD.height}px; margin: 0; overflow: hidden; }
body { position: relative; color: #f7f1e8; background: #08070a; font-family: "Songti SC", "STSong", "PingFang SC", serif; }
.background { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: hue-rotate(${hue}deg) saturate(.85) brightness(.75); }
.wash { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(8,7,10,.97) 0%, rgba(8,7,10,.9) 52%, rgba(8,7,10,.35) 100%); }
.frame { position: absolute; inset: 28px; border: 1px solid rgba(255,255,255,.18); }
.frame::before { content: ""; position: absolute; left: 34px; top: -2px; width: 68px; height: 3px; background: ${accent}; }
.content { position: absolute; inset: 64px 72px 56px; display: flex; flex-direction: column; }
.eyebrow { font: 20px "PingFang SC", sans-serif; letter-spacing: .2em; color: ${accent}; }
.book { margin-top: 18px; font-size: 34px; letter-spacing: .06em; color: rgba(247,241,232,.8); }
.number { margin-top: auto; font: 26px "PingFang SC", sans-serif; letter-spacing: .24em; color: ${accent}; }
h1 { margin: 10px 0 0; max-width: 960px; font-size: ${nameSize}px; line-height: 1.2; font-weight: 600; text-wrap: balance; text-shadow: 0 3px 28px rgba(0,0,0,.6); }
.subtitle { margin: 18px 0 0; font: 24px/1.5 "PingFang SC", sans-serif; color: rgba(247,241,232,.72); }
.footer { margin-top: 40px; display: flex; justify-content: space-between; font: 16px "PingFang SC", sans-serif; letter-spacing: .08em; color: rgba(247,241,232,.55); }
</style></head>
<body>
  <img class="background" src="${backgroundDataUrl}" alt="">
  <div class="wash"></div>
  <div class="frame"></div>
  <main class="content">
    <div class="eyebrow">原创中文连载 · ${escapeHtml(book.novel.author)}</div>
    ${chapter ? `<div class="book">《${escapeHtml(book.novel.title)}》</div>` : ''}
    ${chapter ? `<div class="number">${escapeHtml(number)}</div>` : '<div class="number"></div>'}
    <h1>${chapter ? escapeHtml(name) : `《${escapeHtml(name)}》`}</h1>
    ${chapter ? '' : `<p class="subtitle">${escapeHtml(book.novel.subtitle || '')}</p>`}
    <div class="footer"><span>${escapeHtml(pagePath)}</span><span>${SITE_NAME.toUpperCase()}</span></div>
  </main>
</body>
</html>`;
};

await mkdir(OUTPUT_DIR, { recursive: true });
const sansFont = await asDataUrl(
  path.join(FONT_DIR, 'anthropic-sans-roman.woff2'),
  'font/woff2',
);

const serifFont=await asDataUrl(path.join(FONT_DIR,'newsreader-var.woff2'),'font/woff2');
const poster=await asDataUrl(path.join(ROOT,'public/assets/film/afflatus-r07-poster.jpg'),'image/jpeg');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: SOCIAL_CARD.width, height: SOCIAL_CARD.height },
    deviceScaleFactor: 1,
  });

  for (const route of SITE_MANIFEST.filter((entry) => entry.status === 'active')) {
    const backgroundPath = path.join(ROOT, route.seo.social.background);
    const backgroundDataUrl = await asDataUrl(
      backgroundPath,
      mimeFor(backgroundPath),
    );

    for (const locale of SITE_LOCALES) {
      await page.setContent(
        cardHtml({ route, locale, backgroundDataUrl, sansFont }),
        { waitUntil: 'load' },
      );
      await page.evaluate(() => document.fonts.ready);
      const outputPath = path.join(
        OUTPUT_DIR,
        socialCardFilename(route.id, locale),
      );
      await page.screenshot({
        path: outputPath,
        type: 'jpeg',
        quality: SOCIAL_CARD.quality,
      });
      if(route.id==='main') {
        await copyFile(outputPath,path.join(OUTPUT_DIR,`main-${locale}.jpg`));
        if(locale==='en')await copyFile(outputPath,path.join(OUTPUT_DIR,'og-image.jpg'));
      }
      console.log(`GENERATED: ${path.relative(ROOT, outputPath)}`);
    }
  }

  // Novel cards, plus a manifest of the titles they were drawn with so
  // og:check can tell when a book or chapter title has changed since.
  const serialRoute = SITE_MANIFEST.find((route) => route.id === 'serial');
  const serialBackgroundPath = path.join(ROOT, serialRoute.seo.social.background);
  const serialBackground = await asDataUrl(serialBackgroundPath, mimeFor(serialBackgroundPath));
  const novelsIndex = JSON.parse(await readFile(path.join(ROOT, 'public/novels-index.json'), 'utf8'));
  const manifest = {};
  for (const entry of novelsIndex.novels || []) {
    const { chapters = [] } = JSON.parse(await readFile(path.join(ROOT, 'public/novels', `${entry.id}.json`), 'utf8'));
    const book = { ...entry, chapters };
    manifest[book.id] = { title: book.novel.title, chapters: {} };
    await mkdir(path.join(OUTPUT_DIR, 'novels', book.id), { recursive: true });
    for (const chapter of [null, ...chapters]) {
      await page.setContent(
        novelCardHtml({ book, chapter, backgroundDataUrl: serialBackground }),
        { waitUntil: 'load' },
      );
      await page.evaluate(() => document.fonts.ready);
      const outputPath = path.join(
        ROOT,
        'public',
        novelSocialCardPath({ bookId: book.id, ...(chapter ? { chapterId: chapter.id } : {}) }),
      );
      await page.screenshot({ path: outputPath, type: 'jpeg', quality: NOVEL_CARD_QUALITY });
      if (chapter) manifest[book.id].chapters[chapter.id] = chapter.title;
    }
    console.log(`GENERATED: ${chapters.length + 1} novel cards for ${book.id}`);
  }
  await writeFile(path.join(ROOT, 'scripts/data/novel-og-cards.json'), `${JSON.stringify(manifest, null, 2)}\n`);
} finally {
  await browser.close();
}
