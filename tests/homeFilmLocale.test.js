import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SITE_MANIFEST } from '../src/config/siteManifest.js';
import { transformLocalizedDocument } from '../scripts/localize-site.mjs';
const route = SITE_MANIFEST.find(item => item.id === 'main');
const source = readFileSync('index.html', 'utf8');
describe('film homepage before JavaScript', () => {
  for (const locale of ['en', 'zh']) it(`provides ${locale} content and usable media and destination links`, () => {
    const html = transformLocalizedDocument(source, route, locale);
    expect(html).toContain(`href="/${locale}/portfolio.html"`);
    expect(html).toContain('href="/zh/serial.html"');
    expect(html).toContain('href="/assets/film/afflatus-r07-1080p.mp4"');
    expect(html).toContain('src="/assets/film/afflatus-r07-poster.jpg"');
    expect(html).toContain(locale === 'zh' ? '>从这颗星球，</span>' : '>From this world,</span>');
    expect(html).toContain(locale === 'zh' ? '>打开影片</a>' : '>Open film</a>');
    expect(html).not.toContain('Watch the full film');
    expect(html).not.toContain('Watch the launch');
  });
});
