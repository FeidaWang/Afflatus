/**
 * Shared locale persistence and one-time legacy migration.
 *
 * Resolution order is deliberately deterministic:
 *   1. afflatus:locale:v1 (current)
 *   2. afflatus:lang      (legacy sub-pages)
 *   3. afflatus-lang      (legacy home page)
 *
 * Legacy keys are removed only after the current key is confirmed written.
 * All functions accept a storage adapter so the migration is unit-testable
 * without touching real localStorage.
 */

export const LOCALE_KEY = 'afflatus:locale:v1';
export const LEGACY_LOCALE_KEYS = Object.freeze(['afflatus:lang', 'afflatus-lang']);

export function normalizeLocale(value, fallback = 'en') {
  if (value === 'zh' || value === 'zh-CN') return 'zh';
  if (value === 'en') return 'en';
  return fallback === 'zh' ? 'zh' : 'en';
}

export function localeToHtmlLang(locale) {
  return normalizeLocale(locale) === 'zh' ? 'zh-CN' : 'en';
}

function safeGet(storage, key) {
  try {
    return storage?.getItem?.(key) ?? null;
  } catch {
    return null;
  }
}

function validStoredLocale(value) {
  return value === 'en' || value === 'zh' || value === 'zh-CN';
}

export function resolveStoredLocale(storage, fallback = 'en') {
  const current = safeGet(storage, LOCALE_KEY);
  if (validStoredLocale(current)) {
    return { locale: normalizeLocale(current, fallback), source: LOCALE_KEY };
  }

  for (const key of LEGACY_LOCALE_KEYS) {
    const value = safeGet(storage, key);
    if (validStoredLocale(value)) {
      return { locale: normalizeLocale(value, fallback), source: key };
    }
  }

  return { locale: normalizeLocale(fallback), source: null };
}

export function migrateLocaleStorage(storage, fallback = 'en') {
  const resolved = resolveStoredLocale(storage, fallback);
  if (!storage || !resolved.source) return resolved.locale;

  let currentWritten = resolved.source === LOCALE_KEY;
  if (!currentWritten) {
    try {
      storage.setItem(LOCALE_KEY, resolved.locale);
      currentWritten = safeGet(storage, LOCALE_KEY) === resolved.locale;
    } catch {
      currentWritten = false;
    }
  }

  if (currentWritten) {
    for (const key of LEGACY_LOCALE_KEYS) {
      try {
        storage.removeItem(key);
      } catch {
        // A privacy-restricted store can reject cleanup after a valid read.
      }
    }
  }

  return resolved.locale;
}

export function getLocale(fallback = 'en') {
  try {
    return migrateLocaleStorage(window.localStorage, fallback);
  } catch {
    return normalizeLocale(fallback);
  }
}

export function setLocale(locale) {
  const next = normalizeLocale(locale);
  try {
    window.localStorage.setItem(LOCALE_KEY, next);
    if (safeGet(window.localStorage, LOCALE_KEY) === next) {
      for (const key of LEGACY_LOCALE_KEYS) {
        try {
          window.localStorage.removeItem(key);
        } catch {}
      }
    }
  } catch {}
  return next;
}
