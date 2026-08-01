#!/usr/bin/env node
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import {
  SITE_LOCALES,
  SITE_MANIFEST,
  SOCIAL_CARD,
} from '../src/config/siteManifest.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'public/assets/og');
const FONT_DIR = path.join(ROOT, 'public/assets/fonts');

const ACCENTS = Object.freeze({
  main: '#9bd7ff',
  arena: '#38f2c5',
  sectors: '#77b9ff',
  signal: '#f5d56a',
  stats: '#71a7ff',
  horoscope: '#9a5a3d',
  serial: '#ffc4a0',
  course: '#729cff',
});

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
  monoFont,
  displayFont,
}) => {
  const social = route.seo.social;
  if (social.precomposed) {
    return `<!doctype html>
<html lang="${locale === 'zh' ? 'zh-CN' : 'en-AU'}">
<head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{width:${SOCIAL_CARD.width}px;height:${SOCIAL_CARD.height}px;margin:0;overflow:hidden}img{display:block;width:100%;height:100%;object-fit:cover}</style></head>
<body><img src="${backgroundDataUrl}" alt=""></body>
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
@font-face { font-family: "Afflatus Display"; src: url("${displayFont}") format("woff2"); font-weight: 400; }
@font-face { font-family: "Afflatus Mono"; src: url("${monoFont}") format("woff2"); font-weight: 700; }
* { box-sizing: border-box; }
html, body { width: ${SOCIAL_CARD.width}px; height: ${SOCIAL_CARD.height}px; margin: 0; overflow: hidden; }
body {
  color: ${light ? '#24170f' : '#f5f7fb'};
  background: ${light ? '#f6efe3' : '#020409'};
  font-family: "Afflatus Mono", "PingFang SC", "Microsoft YaHei", sans-serif;
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
  max-width: 800px; margin: auto 0 16px; font-family: "Afflatus Display", Impact, "Arial Black", "PingFang SC", sans-serif;
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
      <span class="locale">${languageLabel} · PROJECT AFFLATUS</span>
    </div>
  </main>
</body>
</html>`;
};

await mkdir(OUTPUT_DIR, { recursive: true });
const monoFont = await asDataUrl(
  path.join(FONT_DIR, 'jetbrains-mono-latin-700-normal.woff2'),
  'font/woff2',
);
const displayFont = await asDataUrl(
  path.join(FONT_DIR, 'anton-latin-400-normal.woff2'),
  'font/woff2',
);

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
        cardHtml({ route, locale, backgroundDataUrl, monoFont, displayFont }),
        { waitUntil: 'load' },
      );
      await page.evaluate(() => document.fonts.ready);
      const outputPath = path.join(
        OUTPUT_DIR,
        `${route.id}-${locale}.${SOCIAL_CARD.extension}`,
      );
      await page.screenshot({
        path: outputPath,
        type: 'jpeg',
        quality: SOCIAL_CARD.quality,
      });
      console.log(`GENERATED: ${path.relative(ROOT, outputPath)}`);
    }
  }
} finally {
  await browser.close();
}
