import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/* The editable novel sources stay one file per book (public/novels/<id>.json).
   Readers only need the chapter list plus the chapter they are on, so the
   build splits each book into /novels-data/<id>/toc.json and
   /novels-data/<id>/chapters/<chapterId>.json. The dev server serves the same
   paths from the sources, so the reader has a single data contract. */
export const NOVEL_DATA_DIR = 'novels-data';

export function splitNovelBook(book) {
  const files = new Map();
  files.set(`${book.id}/toc.json`, {
    id: book.id,
    chapters: book.chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      wordCount: chapter.wordCount,
      // Same measure the reader uses for in-chapter progress (UTF-16 length).
      textLength: chapter.blocks.reduce((sum, block) => sum + (block.text || '').length, 0),
    })),
  });
  for (const chapter of book.chapters) {
    files.set(`${book.id}/chapters/${chapter.id}.json`, chapter);
  }
  return files;
}

export function novelChunkFiles(root) {
  const index = JSON.parse(readFileSync(resolve(root, 'public/novels-index.json'), 'utf8'));
  const files = new Map();
  for (const entry of index.novels || []) {
    const book = JSON.parse(readFileSync(resolve(root, `public/novels/${entry.id}.json`), 'utf8'));
    for (const [path, data] of splitNovelBook(book)) files.set(path, JSON.stringify(data));
  }
  return files;
}

export function novelChunksPlugin(root) {
  return {
    name: 'novel-chunks',
    configureServer(server) {
      server.middlewares.use(`/${NOVEL_DATA_DIR}/`, (req, res, next) => {
        const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\//, '');
        const body = novelChunkFiles(root).get(path);
        if (body == null) return next();
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(body);
      });
    },
    generateBundle() {
      for (const [path, source] of novelChunkFiles(root)) {
        this.emitFile({ type: 'asset', fileName: `${NOVEL_DATA_DIR}/${path}`, source });
      }
    },
  };
}
