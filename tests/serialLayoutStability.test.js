import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('serial.html', 'utf8');
const css = readFileSync('public/styles/serial.css', 'utf8');
const entry = readFileSync('src/pages/serialLibs.js', 'utf8');

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
});
