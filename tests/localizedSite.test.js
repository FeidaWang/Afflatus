import { describe, expect, it } from 'vitest';
import { SITE_MANIFEST } from '../src/config/siteManifest.js';
import {
  transformAdaptiveDocument,
  transformLocalizedDocument,
} from '../scripts/localize-site.mjs';

const arena = SITE_MANIFEST.find((route) => route.id === 'arena');
const fixture = `<!doctype html>
<html lang="en"><head>
<script>localStorage.getItem('afflatus:locale:v1');document.documentElement.lang='en'</script>
<title>Old title</title>
<meta name="description" content="Old description">
<meta property="og:title" content="Old OG">
<meta property="og:description" content="Old OG description">
<meta property="og:url" content="https://feida.au/arena.html">
<link rel="canonical" href="https://feida.au/arena.html">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebApplication","name":"Arena"}</script>
</head><body data-prev="/" data-next="/sectors.html">
<nav data-afflatus-nav><button class="lang-toggle" type="button">中文</button></nav>
<h1 data-en="English heading" data-zh="中文标题">English heading</h1>
<p data-i18n-html data-en="Read <b>levels</b>." data-zh="读取<b>关键位</b>。">Read <b>levels</b>.</p>
<input data-en-ph="Ticker" data-zh-ph="股票代码" placeholder="Ticker">
<a href="/sectors.html?fx=1#map">Next</a>
</body></html>`;

describe('localized site generator', () => {
  it('emits a fixed Chinese document with localized content and URL contracts', () => {
    const html = transformLocalizedDocument(fixture, arena, 'zh');
    expect(html).toContain('<html lang="zh-CN" data-afflatus-locale="zh">');
    expect(html).toContain('<title>竞技场 — QF-01 量化铸造舱与美股技术分析 · Afflatus</title>');
    expect(html).toContain('rel="canonical" href="https://feida.au/zh/arena.html"');
    expect(html).toContain('hreflang="en" href="https://feida.au/en/arena.html"');
    expect(html).toContain('hreflang="zh-CN" href="https://feida.au/zh/arena.html"');
    expect(html).toContain('hreflang="x-default" href="https://feida.au/arena.html"');
    expect(html).toContain('<h1 data-en="English heading" data-zh="中文标题">中文标题</h1>');
    expect(html).toContain('读取<b>关键位</b>。');
    expect(html).toContain('placeholder="股票代码"');
    expect(html).toContain('href="/zh/sectors.html?fx=1#map"');
    expect(html).toContain('class="lang-toggle" href="/en/arena.html" hreflang="en"');
    expect(html).toContain('"inLanguage":"zh-CN"');
    expect(html).not.toContain('document.documentElement.lang');
  });

  it('adds crawlable alternates and navigation to the adaptive document', () => {
    const html = transformAdaptiveDocument(fixture, arena);
    expect(html).toContain('data-afflatus-locale="adaptive"');
    expect(html).toContain('data-afflatus-static-nav');
    expect(html).toContain('href="/serial.html"');
    expect(html).toContain('href="/zh/arena.html" hreflang="zh-CN"');
    expect(html).toContain('document.documentElement.lang');
  });

  it('links English fixed-locale navigation directly to the Chinese-only bookshelf', () => {
    const html = transformLocalizedDocument(fixture, arena, 'en');
    expect(html).toContain('href="/zh/serial.html">Novels</a>');
    expect(html).not.toContain('href="/en/serial.html"');
  });
});
