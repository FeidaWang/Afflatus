export const READER_STORE_KEY = 'afflatus:reader:v1';
export const READER_STORE_VERSION = 3;

const THEMES = new Set(['green', 'night']);
const LAYOUTS = new Set(['book', 'waterfall']);

export const DEFAULT_READER_STATE = Object.freeze({
  version: READER_STORE_VERSION,
  bookId: null,
  chapterId: null,
  offset: 0,
  theme: 'green',
  fontSize: 18,
  layout: 'book',
  bookmarks: Object.freeze({}),
  visited: Object.freeze({}),
  audioTrack: 0,
  narration: Object.freeze({
    rate: 1,
    positions: Object.freeze({}),
  }),
});

function finiteInteger(value, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(min, Math.min(max, Math.round(number)))
    : fallback;
}

function finiteNumber(value, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(min, Math.min(max, number))
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
  };
}

function sanitizeNarration(value) {
  const positions = {};
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};

  for (const [bookId, chapters] of Object.entries(source.positions || {})) {
    if (!bookId || !chapters || typeof chapters !== 'object' || Array.isArray(chapters)) continue;
    const cleanChapters = {};
    for (const [chapterId, position] of Object.entries(chapters)) {
      if (!chapterId || !position || typeof position !== 'object' || Array.isArray(position)) continue;
      cleanChapters[chapterId] = {
        time: finiteNumber(position.time, 0, 0, 60 * 60 * 24),
        updatedAt: finiteInteger(position.updatedAt, 0),
        assetId: typeof position.assetId === 'string' ? position.assetId.slice(0, 240) : '',
      };
    }
    if (Object.keys(cleanChapters).length) positions[bookId] = cleanChapters;
  }

  return {
    rate: finiteNumber(source.rate, 1, 0.75, 2),
    positions,
  };
}

function sanitizeState(value = {}) {
  const storedVersion = Number(value.version);
  const supportsLayout = Number.isFinite(storedVersion) && storedVersion >= 2;
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

  return {
    version: READER_STORE_VERSION,
    bookId: typeof value.bookId === 'string' && value.bookId ? value.bookId : null,
    chapterId: chapterIdentity(value.chapterId),
    offset: finiteInteger(value.offset, 0),
    theme: THEMES.has(value.theme) ? value.theme : DEFAULT_READER_STATE.theme,
    fontSize: finiteInteger(value.fontSize, DEFAULT_READER_STATE.fontSize, 15, 24),
    layout: supportsLayout && LAYOUTS.has(value.layout)
      ? value.layout
      : DEFAULT_READER_STATE.layout,
    bookmarks,
    visited,
    audioTrack: finiteInteger(value.audioTrack, 0),
    narration: sanitizeNarration(value.narration),
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

  function persist(next) {
    state = sanitizeState(next);
    writeState(adapter, state);
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
    const persisted = writeState(adapter, migration.state);
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
    update(patch) {
      const value = typeof patch === 'function' ? patch(state) : { ...state, ...patch };
      return persist(value);
    },
    setProgress(bookId, chapterId, offset = 0) {
      return persist({ ...state, bookId, chapterId, offset });
    },
    setBookmark(bookId, bookmark) {
      return persist({
        ...state,
        bookmarks: { ...state.bookmarks, [bookId]: sanitizeBookmark(bookmark) },
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
    setNarrationRate(rate) {
      return persist({
        ...state,
        narration: { ...state.narration, rate },
      });
    },
    setNarrationPosition(bookId, chapterId, time, updatedAt = Date.now(), assetId = '') {
      if (!bookId || chapterIdentity(chapterId) == null) return state;
      const chapterKey = String(chapterId);
      return persist({
        ...state,
        narration: {
          ...state.narration,
          positions: {
            ...state.narration.positions,
            [bookId]: {
              ...(state.narration.positions[bookId] || {}),
              [chapterKey]: { time, updatedAt, assetId },
            },
          },
        },
      });
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
