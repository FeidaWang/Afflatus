const LOCALES = new Set(['en', 'zh']);
const SEGMENT_RE = /^[a-z0-9-]{1,80}$/;
const CHAPTER_RE = /^[a-z0-9-]{1,40}$/i;

function safeSegment(value, pattern, label) {
  const segment = String(value ?? '').trim();
  if (!pattern.test(segment)) throw new TypeError(`Invalid ${label} route segment`);
  return segment;
}

export function parseReaderPath(pathname) {
  const normalized = String(pathname || '/').replace(/\/index\.html$/, '/');
  const match = normalized.match(/^\/(?:(en|zh)\/)?novels\/([^/]+?)(?:\/([^/]+?))?\/?$/);
  if (!match) return null;
  const [, locale, rawBookId, rawChapterId] = match;
  if (!SEGMENT_RE.test(rawBookId) || (rawChapterId && !CHAPTER_RE.test(rawChapterId))) return null;
  return {
    locale: locale || 'adaptive',
    bookId: rawBookId,
    chapterId: rawChapterId ? decodeURIComponent(rawChapterId) : null,
  };
}

export function readerPath({ locale = 'adaptive', bookId, chapterId = null }) {
  const safeBookId = safeSegment(bookId, SEGMENT_RE, 'book');
  const prefix = LOCALES.has(locale) ? `/${locale}` : '';
  const chapter = chapterId == null
    ? ''
    : `/${encodeURIComponent(safeSegment(chapterId, CHAPTER_RE, 'chapter'))}`;
  return `${prefix}/novels/${safeBookId}${chapter}/`;
}

export function readerUrl(input) {
  return `https://feida.au${readerPath(input)}`;
}

export function readerLocale(pathname, documentLocale = 'adaptive') {
  return parseReaderPath(pathname)?.locale
    || (LOCALES.has(documentLocale) ? documentLocale : 'adaptive');
}

export function chapterIdEquals(left, right) {
  return String(left) === String(right);
}
