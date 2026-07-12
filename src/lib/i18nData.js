/* i18nData.js — U21 Phase 1 §2.1: the data layer has two bilingual field
   conventions living side by side (suffix style `note_en`/`note_zh` in
   leagues/games/sectors/signal/arena-news, and nested style
   `{ en, zh }` in sectors.weeklyTake/signal.pillarSummary), so every
   consuming page hand-rolls its own `zh() ? x.foo_zh : x.foo_en` branch.
   Two tiny helpers instead of one migration:
     - pick(obj, base, lang)  — suffix convention: pick(s, 'round', 'zh') reads s.round_zh
     - t(value, lang)         — nested convention: t({en,zh}, 'zh') reads value.zh
   Existing JSON files are NOT force-migrated (each file has exactly one
   writer — a scheduled task — so a big-bang rewrite isn't worth the
   coordination risk; see RFC §2.1's migration strategy). New data files
   and any file's next natural rewrite should prefer the nested `t()`
   convention going forward. */

/** Suffix convention: pick({round:'R1', round_zh:'第一轮'}, 'round', 'zh') -> '第一轮' */
export function pick(obj, base, lang) {
  if (!obj) return undefined;
  if (lang === 'zh') return obj[base + '_zh'] ?? obj[base];
  return obj[base + '_en'] ?? obj[base];
}

/** Nested convention: t({en:'Round 1', zh:'第一轮'}, 'zh') -> '第一轮'.
    Also accepts a plain string/other value unchanged, so callers can use
    it defensively on fields that might be either shape. */
export function t(value, lang) {
  if (value && typeof value === 'object' && ('en' in value || 'zh' in value)) {
    return lang === 'zh' ? (value.zh ?? value.en) : (value.en ?? value.zh);
  }
  return value;
}

/** Reads the page's current language the same way every other page does
    (localStorage 'afflatus:lang' via <html lang>), so callers don't each
    re-implement this check. */
export function currentLang() {
  try {
    return (document.documentElement.lang || '').toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en';
  } catch (e) {
    return 'en';
  }
}
