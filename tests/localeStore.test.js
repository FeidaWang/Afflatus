import { describe, expect, it } from 'vitest';
import {
  LEGACY_LOCALE_KEYS,
  LOCALE_KEY,
  localeFromPathname,
  localeSwitchHref,
  localeToHtmlLang,
  localizePathname,
  migrateLocaleStorage,
  normalizeLocale,
  resolveStoredLocale,
  stripLocalePathname,
} from '../src/lib/localeStore.js';

function memoryStorage(seed = {}, options = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem(key) {
      if (options.throwOnGet) throw new Error('read denied');
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      if (options.throwOnSet) throw new Error('write denied');
      data.set(key, String(value));
    },
    removeItem(key) {
      if (options.throwOnRemove) throw new Error('remove denied');
      data.delete(key);
    },
    snapshot: () => Object.fromEntries(data),
  };
}

describe('localeStore', () => {
  it('normalizes supported values and safe fallbacks', () => {
    expect(normalizeLocale('zh-CN')).toBe('zh');
    expect(normalizeLocale('zh')).toBe('zh');
    expect(normalizeLocale('en')).toBe('en');
    expect(normalizeLocale('fr')).toBe('en');
    expect(normalizeLocale(null, 'zh')).toBe('zh');
    expect(localeToHtmlLang('zh')).toBe('zh-CN');
    expect(localeToHtmlLang('en')).toBe('en');
  });

  it('maps fixed-locale paths without losing the underlying route', () => {
    expect(localeFromPathname('/en/arena.html')).toBe('en');
    expect(localeFromPathname('/zh/')).toBe('zh');
    expect(localeFromPathname('/arena.html')).toBeNull();
    expect(stripLocalePathname('/zh/arena.html')).toBe('/arena.html');
    expect(stripLocalePathname('/en/')).toBe('/');
    expect(localizePathname('/zh/arena.html', 'en')).toBe('/en/arena.html');
    expect(localizePathname('/', 'zh')).toBe('/zh/');
  });

  it('preserves route query and hash when switching locale URLs', () => {
    expect(localeSwitchHref({
      pathname: '/en/sectors.html',
      search: '?fx=starfield3d',
      hash: '#storyGraphSection',
    }, 'zh')).toBe('/zh/sectors.html?fx=starfield3d#storyGraphSection');
  });

  it('resolves the current key before either legacy key', () => {
    const storage = memoryStorage({
      [LOCALE_KEY]: 'en',
      [LEGACY_LOCALE_KEYS[0]]: 'zh',
      [LEGACY_LOCALE_KEYS[1]]: 'zh',
    });
    expect(resolveStoredLocale(storage)).toEqual({ locale: 'en', source: LOCALE_KEY });
  });

  it('resolves the former sub-page key before the former home key', () => {
    const storage = memoryStorage({
      [LEGACY_LOCALE_KEYS[0]]: 'zh',
      [LEGACY_LOCALE_KEYS[1]]: 'en',
    });
    expect(resolveStoredLocale(storage)).toEqual({
      locale: 'zh',
      source: LEGACY_LOCALE_KEYS[0],
    });
  });

  it('migrates a legacy value and removes both legacy keys', () => {
    const storage = memoryStorage({
      [LEGACY_LOCALE_KEYS[0]]: 'zh',
      [LEGACY_LOCALE_KEYS[1]]: 'en',
    });
    expect(migrateLocaleStorage(storage)).toBe('zh');
    expect(storage.snapshot()).toEqual({ [LOCALE_KEY]: 'zh' });
  });

  it('cleans stale legacy keys when a valid current value exists', () => {
    const storage = memoryStorage({
      [LOCALE_KEY]: 'en',
      [LEGACY_LOCALE_KEYS[0]]: 'zh',
    });
    expect(migrateLocaleStorage(storage)).toBe('en');
    expect(storage.snapshot()).toEqual({ [LOCALE_KEY]: 'en' });
  });

  it('does not delete legacy values when the current write fails', () => {
    const storage = memoryStorage(
      { [LEGACY_LOCALE_KEYS[0]]: 'zh' },
      { throwOnSet: true },
    );
    expect(migrateLocaleStorage(storage)).toBe('zh');
    expect(storage.snapshot()).toEqual({ [LEGACY_LOCALE_KEYS[0]]: 'zh' });
  });

  it('does not write a fallback when no stored preference exists', () => {
    const storage = memoryStorage();
    expect(migrateLocaleStorage(storage, 'zh')).toBe('zh');
    expect(storage.snapshot()).toEqual({});
  });

  it('degrades to the requested fallback when storage reads fail', () => {
    const storage = memoryStorage({}, { throwOnGet: true });
    expect(resolveStoredLocale(storage, 'zh')).toEqual({ locale: 'zh', source: null });
    expect(migrateLocaleStorage(storage, 'zh')).toBe('zh');
  });
});
