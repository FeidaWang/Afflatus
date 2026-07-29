import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('serial.html', 'utf8');
const css = readFileSync('public/styles/serial.css', 'utf8');
const entry = readFileSync('src/pages/serialLibs.js', 'utf8');
const pagedBook = readFileSync('src/lib/pagedBook.js', 'utf8');

describe('serial layout stability', () => {
  it('uses self-hosted UI fonts without a render-blocking Google font payload', () => {
    expect(html).toContain('jetbrains-mono-latin-400-normal.woff2');
    expect(html).toContain('rel="preload"');
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('fonts.gstatic.com');
  });

  it('reserves asynchronous bookshelf, HUD, hero and chapter regions', () => {
    expect(html.match(/class="book-skeleton"/g)).toHaveLength(3);
    expect(html).toContain('aria-busy="true"');
    expect(css).toMatch(/\.hero \.pad\{[^}]*min-height:/);
    expect(css).toMatch(/\.hud\{[^}]*min-height:/);
    expect(css).toMatch(/\.reader \.body\{[^}]*min-height:/);
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

  it('paginates chapters into a physical book with generated page sound', () => {
    expect(html).toContain('id="bookStage"');
    expect(html).toContain('id="bookTurn"');
    expect(html).toContain('id="pageSoundToggle"');
    expect(css).toMatch(/\.book-stage\{[^}]*width:min\(100%,560px\)[^}]*aspect-ratio:140\/203/);
    expect(css).toContain('@keyframes turnPaperNext');
    expect(css).toContain('@keyframes fadeDepartingPageText');
    expect(css).toContain('@keyframes revealArrivingPageText');
    expect(css).toContain('@keyframes openHardCover');
    expect(pagedBook).toContain('createPagedBook');
    expect(pagedBook).toContain('event.target !== turnLayer');
    expect(pagedBook).toContain('context.createBuffer');
    expect(pagedBook).toContain("stage.addEventListener('pointerdown'");
    expect(pagedBook).toContain("event.key === 'ArrowRight'");
  });
});
