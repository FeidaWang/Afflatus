import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SITE_MANIFEST } from '../src/config/siteManifest.js';
import { transformLocalizedDocument } from '../scripts/localize-site.mjs';
const route = SITE_MANIFEST.find(item => item.id === 'main');
const source = readFileSync('index.html', 'utf8');
describe('film homepage before JavaScript', () => {
  for (const locale of ['en', 'zh']) it(`provides ${locale} content, a poster and destination links without a film download shortcut`, () => {
    const html = transformLocalizedDocument(source, route, locale);
    expect(html).toContain(`href="/${locale}/portfolio.html"`);
    expect(html).toContain('href="/zh/serial.html"');
    expect(html).not.toContain('href="/film/claude_clawd_pv/r07-mv/review/r07-stream-film-1080p-16x9.mp4"');
    expect(html).toContain('src="/assets/film/afflatus-r07-poster.jpg"');
    expect(html).toContain(locale === 'zh' ? '>从这颗星球，</span>' : '>From this world,</span>');
    expect(html).toContain(locale === 'zh' ? '开启 JavaScript 后即可播放影片。' : 'Enable JavaScript to watch the film.');
    expect(html).not.toContain('Watch the full film');
    expect(html).not.toContain('Watch the launch');
  });
});
