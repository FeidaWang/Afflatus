/* Pure validation for public/arena-daily-digest.json (Part 4 SS18.1.5) --
   the end-of-day summary the post-market Reviewer commits and the
   "while you were away" toast (SS19.4) reads. */

const MODELS = ['S', 'P', 'T'];
// Matches src/lib/arenaReconcile.js's WINDOWS -- a delayed entry names which
// window got queued while offline (SS19.4.4), so it must be one of these.
const WINDOWS = ['pre-market-gather', 'picks-publish', 'open-window', 'late-window', 'post-market', 'weekly-review'];

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}
function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function validateBook(b, tag, errors) {
  if (!b || typeof b !== 'object') { errors.push(`${tag}: not an object`); return; }
  if (!MODELS.includes(b.model)) errors.push(`${tag}.model: must be one of ${MODELS.join('/')}, got ${JSON.stringify(b.model)}`);
  if (!isFiniteNumber(b.pnlPct)) errors.push(`${tag}.pnlPct: must be a number`);
  if (!Number.isInteger(b.tradesCount) || b.tradesCount < 0) errors.push(`${tag}.tradesCount: must be a non-negative integer`);
  if (!isNonEmptyString(b.note_en)) errors.push(`${tag}.note_en: missing or empty`);
  if (!isNonEmptyString(b.note_zh)) errors.push(`${tag}.note_zh: missing or empty`);
}

/** @param {unknown} data parsed JSON (caller must JSON.parse first). */
export function validateArenaDigest(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, errors: ['top-level: must be an object'] };
  }
  if (!isNonEmptyString(data.date)) errors.push('date: missing or empty');
  if (!isNonEmptyString(data.generatedAt)) errors.push('generatedAt: missing or empty');
  if (!Array.isArray(data.books) || data.books.length !== MODELS.length) {
    errors.push(`books: must be an array with exactly ${MODELS.length} entries (one per model)`);
  } else {
    data.books.forEach((b, i) => validateBook(b, `books[${i}]`, errors));
  }
  if (!Number.isInteger(data.tomorrowPicksCount) || data.tomorrowPicksCount < 0) {
    errors.push('tomorrowPicksCount: must be a non-negative integer');
  }
  if (!Array.isArray(data.delayed)) {
    errors.push('delayed: must be an array (empty is fine -- most days have nothing delayed)');
  } else {
    data.delayed.forEach((x, i) => {
      const tag = `delayed[${i}]`;
      if (!x || typeof x !== 'object') { errors.push(`${tag}: not an object`); return; }
      if (!isNonEmptyString(x.date)) errors.push(`${tag}.date: missing or empty`);
      if (!WINDOWS.includes(x.window)) errors.push(`${tag}.window: must be one of ${WINDOWS.join('/')}, got ${JSON.stringify(x.window)}`);
      if (!MODELS.includes(x.model)) errors.push(`${tag}.model: must be one of ${MODELS.join('/')}, got ${JSON.stringify(x.model)}`);
      if (!isNonEmptyString(x.note_en) && !isNonEmptyString(x.note_zh)) errors.push(`${tag}: needs at least one of note_en/note_zh`);
    });
  }
  return { ok: errors.length === 0, errors };
}
