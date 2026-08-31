import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('serial.html', 'utf8');
const css = readFileSync('public/styles/serial.css', 'utf8');
const brandCss = readFileSync('public/styles/afflatus-brand.css', 'utf8');
const responsiveCss = readFileSync('public/styles/responsive-primitives.css', 'utf8');
const entry = readFileSync('src/pages/serialLibs.js', 'utf8');
const pagedBook = readFileSync('src/lib/pagedBook.js', 'utf8');

describe('serial layout stability', () => {
  it('uses self-hosted UI fonts without a render-blocking Google font payload', () => {
    expect(html).toContain('jetbrains-mono-latin-400-normal.woff2');
    expect(html).toContain('rel="preload"');
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('fonts.gstatic.com');
    expect(html).not.toContain('/styles/afflatus-navigation.css');
  });

  it('reserves asynchronous bookshelf, HUD, hero and chapter regions', () => {
    expect(html.match(/class="book-skeleton"/g)).toHaveLength(3);
    expect(html).toContain('aria-busy="true"');
    expect(css).toMatch(/\.hero \.pad\{[^}]*min-height:/);
    expect(css).toMatch(/\.hud\{[^}]*min-height:/);
    expect(css).toMatch(/\.reader \.body\{[^}]*min-height:/);
  });

  it('keeps the mobile bookshelf compact and marks the active dossier boundary', () => {
    expect(html).toContain('class="dossier-bridge"');
    expect(html).toContain('当前书档');
    expect(css).toMatch(/@media\(max-width:640px\)[\s\S]*\.shelf\{[^}]*grid-auto-flow:column;[^}]*overflow-x:auto;[^}]*scroll-snap-type:x proximity;/);
    expect(css).toMatch(/\.dossier-bridge\{display:flex;/);
  });

  it('keeps both document roots out of overflow clipping so sticky chrome follows scrolling', () => {
    expect(brandCss).not.toMatch(/html\s*\{[^}]*overflow-x\s*:/s);
    expect(brandCss).not.toMatch(/body\s*\{[^}]*overflow-x\s*:/s);
    expect(responsiveCss).not.toMatch(/html\s*\{[^}]*overflow-x\s*:/s);
    expect(responsiveCss).not.toMatch(/body\s*\{[^}]*overflow-x\s*:/s);
    expect(responsiveCss).toMatch(/body\s*\{[^}]*overflow-wrap:\s*break-word;/s);
    expect(responsiveCss).not.toMatch(/body\s*\{[^}]*overflow-wrap:\s*anywhere;/s);
    expect(brandCss).toMatch(/\.site-header--follow\s*\{[^}]*position:\s*-webkit-sticky;[^}]*position:\s*sticky;/s);
    expect(css).toMatch(/\.novels-page \.site-header--follow\{position:relative;inset-block-start:auto\}/);
    expect(css).toMatch(/\.toolbar\{position:sticky;top:var\(--safe-t\);/);
    expect(css).toMatch(/\.reader-progress\{position:sticky;top:calc\(var\(--safe-t\) \+ var\(--toolbar-h\)\)/);
    expect(css).toMatch(/\.wf-chip\{position:sticky;top:calc\(var\(--safe-t\) \+ var\(--toolbar-h\) \+ 12px\)/);
    expect(html).not.toContain("style.setProperty('--site-header-h'");
    expect(html).toContain('toolbarResizeObserver.observe(toolbarEl)');
  });

  it('keeps the decorative canvas outside the reader critical path', () => {
    expect(entry).toContain("import('../ui/ambientBackdrops.js')");
    expect(entry).not.toMatch(/^import .*ambientBackdrops/m);
    expect(entry).toContain('15_000');
  });

  it('is Chinese-only and has no language switch control', () => {
    expect(html).toContain('<html lang="zh-CN">');
    expect(html).not.toContain('class="lang-toggle"');
    expect(html).not.toContain('data-en=');
    expect(entry).not.toContain("import '../lib/i18n.js'");
  });

  it('supports a physical book and progressive waterfall reading', () => {
    expect(html).toContain('id="bookStage"');
    expect(html).toContain('id="bookTurn"');
    expect(html).toContain('id="layoutToggle"');
    expect(html).toContain('id="readerWaterfall"');
    expect(html).toContain('id="wfSentinel"');
    expect(html).toContain('requestAnimationFrame(stepAutoScroll)');
    expect(html).toContain('cancelAnimationFrame(state.autoTimer)');
    expect(html).not.toContain('}, 16);');
    expect(html).not.toContain('id="pageSoundToggle"');
    expect(css).toMatch(/\.book-stage\{[^}]*width:min\(100%,560px\)[^}]*aspect-ratio:140\/203/);
    expect(css).toContain('.reader .wf-chapter .body{min-height:0}');
    expect(css).toContain('@keyframes turnPaperNext');
    expect(css).toContain('@keyframes fadeDepartingPageText');
    expect(css).toContain('@keyframes revealArrivingPageText');
    expect(css).toContain('@keyframes openHardCover');
    expect(pagedBook).toContain('createPagedBook');
    expect(pagedBook).toContain('event.target !== turnLayer');
    expect(pagedBook).toContain('context.createBuffer');
    expect(pagedBook).toContain('if (!isActive()) return');
    expect(pagedBook).not.toContain('SOUND_STORAGE_KEY');
    expect(pagedBook).not.toContain('soundButton');
    expect(pagedBook).toContain("stage.addEventListener('pointerdown'");
    expect(pagedBook).toContain("event.key === 'ArrowRight'");
  });
});
