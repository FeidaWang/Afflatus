import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { novelChunkFiles, splitNovelBook } from '../scripts/novel-chunks.mjs';
import { transformNovelPageDocument } from '../scripts/localize-site.mjs';
import { renderNovelBlocks } from '../src/lib/novelBlocks.js';
import { validateNovelChapter, validateNovelToc } from '../src/lib/validateNovelsData.js';

const root = resolve(import.meta.dirname, '..');
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const index = readJson('public/novels-index.json');
const source = readFileSync(resolve(root, 'serial.html'), 'utf8');

describe('build-split novel data', () => {
  it('splits every indexed book into a body-free TOC plus one valid file per chapter', () => {
    const files = novelChunkFiles(root);
    for (const { id } of index.novels) {
      const book = readJson(`public/novels/${id}.json`);
      const toc = JSON.parse(files.get(`${id}/toc.json`));
      expect(validateNovelToc(toc)).toEqual({ ok: true, errors: [] });
      expect(toc.chapters.map((chapter) => chapter.id)).toEqual(book.chapters.map((chapter) => chapter.id));
      for (const chapter of book.chapters) {
        const file = JSON.parse(files.get(`${id}/chapters/${chapter.id}.json`));
        expect(file).toEqual(chapter);
        expect(validateNovelChapter(file)).toEqual({ ok: true, errors: [] });
      }
    }
  });

  it('keeps the largest book TOC small and records each chapter text length', () => {
    const book = readJson('public/novels/yuxi-gongci.json');
    const toc = splitNovelBook(book).get('yuxi-gongci/toc.json');
    expect(JSON.stringify(toc).length).toBeLessThan(40_000);
    expect(toc.chapters[0].textLength)
      .toBe(book.chapters[0].blocks.reduce((sum, block) => sum + block.text.length, 0));
  });

  it('rejects a TOC that embeds chapter bodies and a chapter without blocks', () => {
    expect(validateNovelToc({ id: 'a', chapters: [{ id: 1, title: 'x', blocks: [] }] }).ok).toBe(false);
    expect(validateNovelChapter({ id: 1, title: 'x', wordCount: 1 }).ok).toBe(false);
  });
});

describe('prerendered chapter markup', () => {
  const indexedBook = index.novels.find((item) => item.id === 'wanjie-zhongchun');
  const book = readJson('public/novels/wanjie-zhongchun.json');
  const entry = { ...indexedBook, chapters: book.chapters };
  const sysChapter = entry.chapters.find((chapter) => chapter.blocks.some((block) => block.type === 'sys'));

  it('uses the client renderer and the neutral system-message label for every book', () => {
    const html = transformNovelPageDocument(source, [entry], entry, sysChapter, 'zh');
    expect(html).toContain(renderNovelBlocks(sysChapter.blocks).slice(0, 200));
    expect(html).toContain('data-reader-block="0"');
    expect(html).toContain('<span class="sys-tag">故事中的系统消息</span>');
    expect(html).not.toContain('同契终端 · 明幕');
  });

  it('lists hasPart only on the book landing, not on every chapter page', () => {
    const chapterHtml = transformNovelPageDocument(source, [entry], entry, entry.chapters[0], 'zh');
    const landingHtml = transformNovelPageDocument(source, [entry], entry, null, 'zh');
    expect(chapterHtml).not.toContain('"hasPart"');
    expect(chapterHtml).toContain('"@type":["Chapter","Article"]');
    expect(landingHtml).toContain('"hasPart"');
  });

  it('ships the reader as a bundled module rather than an inline script', () => {
    expect(source).not.toContain('function selectNovel');
    expect(source).toContain('<script type="module" src="/src/pages/serialLibs.js"></script>');
  });
});
