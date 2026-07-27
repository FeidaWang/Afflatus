import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { transformNovelPageDocument } from '../scripts/localize-site.mjs';

const root = resolve(import.meta.dirname, '..');
const source = readFileSync(resolve(root, 'serial.html'), 'utf8');
const index = JSON.parse(readFileSync(resolve(root, 'public/novels-index.json'), 'utf8'));
const indexedBook = index.novels.find((item) => item.id === 'wanjie-zhongchun');
const bookData = JSON.parse(readFileSync(
  resolve(root, 'public/novels/wanjie-zhongchun.json'),
  'utf8',
));
const entry = { ...indexedBook, chapters: bookData.chapters };
const catalog = [entry];

describe('pre-rendered novel documents', () => {
  it('keeps reading music paused until the player button is explicitly pressed', () => {
    expect(source).toContain(
      "btnPlay.addEventListener('click', function () { audio.paused ? play() : pause(); });",
    );
    expect(source).toContain('load(saved < tracks.length ? saved : 0);');
    expect(source).not.toContain('autoplayPending');
    expect(source).not.toContain('armAutoplayResume');
    expect(source).not.toContain('if (load(saved < tracks.length ? saved : 0)) play();');
  });

  it('emits a crawlable chapter with stable localized metadata and navigation', () => {
    const chapter = entry.chapters[0];
    const html = transformNovelPageDocument(source, catalog, entry, chapter, 'en');

    expect(html).toContain(
      '<link rel="canonical" href="https://feida.au/en/novels/wanjie-zhongchun/1/">',
    );
    expect(html).toContain(
      '<link rel="alternate" hreflang="zh-CN" href="https://feida.au/zh/novels/wanjie-zhongchun/1/">',
    );
    expect(html).toContain('data-reader-route="chapter"');
    expect(html).toContain('data-prerendered="chapter"');
    expect(html).toContain(chapter.title);
    expect(html).toContain(chapter.blocks[0].text);
    expect(html).toContain('"@type":["Chapter","Article"]');
    expect(html).toContain(
      '<link rel="next" href="https://feida.au/en/novels/wanjie-zhongchun/2/">',
    );
  });

  it('emits a book index using the validated chapter file rather than planned counts', () => {
    const html = transformNovelPageDocument(source, catalog, entry, null, 'zh');
    const chapterLinks = html.match(/href="\/zh\/novels\/wanjie-zhongchun\/\d+\/"/g) || [];

    expect(html).toContain(
      '<link rel="canonical" href="https://feida.au/zh/novels/wanjie-zhongchun/">',
    );
    expect(html).toContain('data-reader-route="book"');
    expect(html).toContain('data-prerendered="book"');
    expect(chapterLinks).toHaveLength(entry.chapters.length);
    expect(entry.chapters).toHaveLength(15);
  });
});
