export const READER_STORE_KEY = 'afflatus:reader:v1';
export const READER_STORE_VERSION = 3;

const THEMES = new Set(['paper', 'green', 'night']);
const LAYOUTS = new Set(['book', 'waterfall']);

export const DEFAULT_READER_STATE = Object.freeze({
  version: READER_STORE_VERSION,
  bookId: null,
  chapterId: null,
  offset: 0,
  theme: 'paper',
  fontSize: 19,
  lineHeight: 1.85,
  motion: 'gentle',
  anchor: null,
  positions: Object.freeze({}),
  savedBookmarks: Object.freeze([]),
  layout: 'book',
  bookmarks: Object.freeze({}),
  visited: Object.freeze({}),
  audioTrack: 0,
});

function finiteInteger(value, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (value == null || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(min, Math.min(max, Math.round(number)))
    : fallback;
}

function chapterIdentity(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}

function sanitizeBookmark(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const chapterId = chapterIdentity(value.chapterId);
  if (chapterId == null) return null;
  return {
    chapterId,
    chapterTitle: String(value.chapterTitle || ''),
    offset: finiteInteger(value.offset ?? value.scrollY, 0),
    updatedAt: finiteInteger(value.updatedAt ?? value.ts, 0),
    ...(sanitizeAnchor(value.anchor) ? { anchor: sanitizeAnchor(value.anchor) } : {}),
  };
}

function sanitizeAnchor(value) {
  if (!value || typeof value !== 'object' || !Number.isFinite(value.offset)) return null;
  return { offset: finiteInteger(value.offset, 0), quote: String(value.quote || '').slice(0, 80) };
}

function sanitizeState(value = {}) {
  const isCurrentVersion = Number(value.version) >= 2;
  const bookmarks = {};
  for (const [bookId, bookmark] of Object.entries(value.bookmarks || {})) {
    const clean = sanitizeBookmark(bookmark);
    if (bookId && clean) bookmarks[bookId] = clean;
  }

  const visited = {};
  for (const [bookId, chapterIds] of Object.entries(value.visited || {})) {
    if (!bookId || !Array.isArray(chapterIds)) continue;
    visited[bookId] = [...new Set(chapterIds.map(chapterIdentity).filter((id) => id != null))];
  }

  const positions = {};
  for (const [bookId, position] of Object.entries(value.positions || {})) {
    const clean = sanitizeBookmark(position);
    if (bookId && clean) positions[bookId] = clean;
  }
  const savedBookmarks = (Array.isArray(value.savedBookmarks) ? value.savedBookmarks : Object.entries(bookmarks).map(([bookId, entry]) => ({ ...entry, bookId })))
    .map((entry) => { const clean = sanitizeBookmark(entry); return clean && typeof entry.bookId === 'string' ? { ...clean, bookId: entry.bookId } : null; })
    .filter(Boolean);
  return {
    version: READER_STORE_VERSION,
    bookId: typeof value.bookId === 'string' && value.bookId ? value.bookId : null,
    chapterId: chapterIdentity(value.chapterId),
    offset: finiteInteger(value.offset, 0),
    theme: THEMES.has(value.theme) ? value.theme : DEFAULT_READER_STATE.theme,
    fontSize: finiteInteger(value.fontSize, DEFAULT_READER_STATE.fontSize, 16, 28),
    lineHeight: Math.max(1.6, Math.min(2.2, Number(value.lineHeight) || 1.85)),
    motion: value.motion === 'none' ? 'none' : 'gentle',
    anchor: sanitizeAnchor(value.anchor),
    positions,
    savedBookmarks,
    layout: isCurrentVersion && LAYOUTS.has(value.layout)
      ? value.layout
      : DEFAULT_READER_STATE.layout,
    bookmarks,
    visited,
    audioTrack: finiteInteger(value.audioTrack, 0),
  };
}

function readJson(adapter, key) {
  try {
    const raw = adapter.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeState(adapter, state) {
  try {
    const serialized = JSON.stringify(state);
    adapter.setItem(READER_STORE_KEY, serialized);
    return adapter.getItem(READER_STORE_KEY) === serialized;
  } catch {
    return false;
  }
}

function migrateLegacy(adapter, bookIds) {
  const legacyTheme = adapter.getItem('afflatus:novels:theme');
  const legacyFont = adapter.getItem('afflatus:novels:fs');
  const legacyBook = adapter.getItem('afflatus:novels:lastNovel');
  const legacyAudio = adapter.getItem('afflatus:novels:player:idx');
  const next = sanitizeState({
    theme: legacyTheme,
    fontSize: legacyFont,
    bookId: legacyBook,
    audioTrack: legacyAudio,
  });
  const migratedKeys = [
    'afflatus:novels:theme',
    'afflatus:novels:fs',
    'afflatus:novels:lastNovel',
    'afflatus:novels:player:idx',
  ];

  for (const bookId of bookIds) {
    const prefix = `afflatus:novels:${bookId}:`;
    const progress = readJson(adapter, `${prefix}progress`);
    const bookmark = sanitizeBookmark(readJson(adapter, `${prefix}bookmark`));
    const visited = readJson(adapter, `${prefix}visited`);
    if (bookmark) next.bookmarks[bookId] = bookmark;
    if (Array.isArray(visited)) {
      next.visited[bookId] = [...new Set(visited.map(chapterIdentity).filter((id) => id != null))];
    }
    if (bookId === next.bookId && progress?.chapterId != null) {
      next.chapterId = chapterIdentity(progress.chapterId);
      next.offset = finiteInteger(progress.scrollY, 0);
    }
    migratedKeys.push(`${prefix}progress`, `${prefix}bookmark`, `${prefix}visited`);
  }

  return { state: next, migratedKeys };
}

export function createReaderStore(adapter, options = {}) {
  if (!adapter || typeof adapter.getItem !== 'function' || typeof adapter.setItem !== 'function') {
    throw new TypeError('Reader store adapter must implement getItem/setItem');
  }
  const listeners = new Set();
  let state = sanitizeState(readJson(adapter, READER_STORE_KEY) || DEFAULT_READER_STATE);
  let migrated = readJson(adapter, READER_STORE_KEY) != null;
  let persisted = true;

  function persist(next) {
    state = sanitizeState(next);
    persisted = writeState(adapter, state);
    listeners.forEach((listener) => listener(state));
    return state;
  }

  function migrate(bookIds = []) {
    if (migrated) return state;
    let migration;
    try {
      migration = migrateLegacy(adapter, bookIds);
    } catch {
      migrated = true;
      return state;
    }
    persisted = writeState(adapter, migration.state);
    state = migration.state;
    migrated = true;
    if (persisted && typeof adapter.removeItem === 'function') {
      migration.migratedKeys.forEach((key) => {
        try { adapter.removeItem(key); } catch {}
      });
    }
    return state;
  }

  if (options.migrate !== false) migrate(options.bookIds || []);

  return {
    getState() {
      return state;
    },
    isPersisted() { return persisted; },
    update(patch) {
      const value = typeof patch === 'function' ? patch(state) : { ...state, ...patch };
      return persist(value);
    },
    setProgress(bookId, chapterId, offset = 0, anchor = null) {
      return persist({ ...state, bookId, chapterId, offset, anchor, positions: { ...state.positions, [bookId]: { chapterId, offset, anchor, updatedAt: Date.now() } } });
    },
    setBookmark(bookId, bookmark) {
      return persist({
        ...state,
        bookmarks: { ...state.bookmarks, [bookId]: sanitizeBookmark(bookmark) },
        savedBookmarks: [...state.savedBookmarks.filter((entry) => !(entry.bookId === bookId && String(entry.chapterId) === String(bookmark.chapterId) && (entry.anchor?.offset ?? entry.offset) === (bookmark.anchor?.offset ?? bookmark.offset))), { ...bookmark, bookId }],
      });
    },
    markVisited(bookId, chapterId) {
      const existing = state.visited[bookId] || [];
      if (existing.includes(chapterId)) return state;
      return persist({
        ...state,
        visited: { ...state.visited, [bookId]: [...existing, chapterId] },
      });
    },
    setAudioTrack(audioTrack) {
      return persist({ ...state, audioTrack });
    },
    migrate,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function createStorageAdapter(storage) {
  return {
    getItem: (key) => storage.getItem(key),
    setItem: (key, value) => storage.setItem(key, value),
    removeItem: (key) => storage.removeItem(key),
  };
}
