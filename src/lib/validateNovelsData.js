/* Pure validation for the split novels data shape (U21 Phase 1 §2.5/D4:
   public/novels-data.json — a single 485 kB file downloaded in full just to
   render the bookshelf — was split into a small public/novels-index.json
   (shelf metadata + chapterCount, no chapter bodies) plus one
   public/novels/<id>.json per book (full chapters), fetched on demand when
   a book is opened. See serial.html's boot()/selectNovel(). */

function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
// Chapter/book ids are plain numbers in the real data (e.g. chapter.id: 1),
// not strings — accept either, just not empty-string/NaN/missing.
function isValidId(v) { return isNonEmptyString(v) || (typeof v === 'number' && !Number.isNaN(v)); }
function pushErr(errors, msg) { errors.push(msg); }

/** @param {unknown} data parsed novels-index.json */
export function validateNovelsIndex(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || !Array.isArray(data.novels)) {
    return { ok: false, errors: ['top-level: must be an object with a "novels" array'] };
  }
  const ids = new Set();
  for (const [i, n] of data.novels.entries()) {
    const tag = `novels[${i}]`;
    if (!n || typeof n !== 'object') { pushErr(errors, `${tag}: not an object`); continue; }
    if (!isNonEmptyString(n.id)) pushErr(errors, `${tag}.id: missing or empty`);
    else if (ids.has(n.id)) pushErr(errors, `${tag}.id: duplicate "${n.id}"`);
    else ids.add(n.id);
    if (!n.novel || typeof n.novel !== 'object' || !isNonEmptyString(n.novel.title)) {
      pushErr(errors, `${tag}.novel.title: missing or empty`);
    }
    if (typeof n.chapterCount !== 'number' || n.chapterCount < 1) {
      pushErr(errors, `${tag}.chapterCount: must be a positive number, got ${JSON.stringify(n.chapterCount)}`);
    }
    // The index must NOT carry full chapter bodies — that's the whole point
    // of the split (D4). A stray "chapters" array here means whatever wrote
    // this file regressed back to the single-blob shape.
    if (Array.isArray(n.chapters)) pushErr(errors, `${tag}.chapters: index must not embed chapter bodies (use novels/${n.id || '<id>'}.json)`);
  }
  return { ok: errors.length === 0, errors };
}

/** @param {unknown} data parsed public/novels/<id>.json */
export function validateNovelBook(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || !isNonEmptyString(data.id) || !Array.isArray(data.chapters)) {
    return { ok: false, errors: ['top-level: must be an object with a non-empty "id" and a "chapters" array'] };
  }
  for (const [i, c] of data.chapters.entries()) {
    const tag = `chapters[${i}]`;
    if (!c || typeof c !== 'object') { pushErr(errors, `${tag}: not an object`); continue; }
    if (!isValidId(c.id)) pushErr(errors, `${tag}.id: missing or empty`);
    if (!isNonEmptyString(c.title)) pushErr(errors, `${tag}.title: missing or empty`);
    if (!Array.isArray(c.blocks)) pushErr(errors, `${tag}.blocks: must be an array`);
  }
  return { ok: errors.length === 0, errors };
}
