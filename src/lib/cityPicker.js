/* ============================================================
   CITY PICKER — pure helpers over cities.js's two data lists. Kept
   separate from cities.js (raw data) so the data file can be regenerated
   without touching logic, and so this file stays small/testable.

   A "picked city" always carries {zh, lat, lon} plus either isChina:true
   (no utcOffset — see cities.js header for why) or a numeric utcOffset
   for a global city. horoscope.js is responsible for mapping that into
   the existing birth-timezone form fields (bTz/bDst/bLat/bLon) — this
   module has no DOM/form knowledge.
   ============================================================ */
import { CHINA_CITIES, GLOBAL_CITIES } from './cities.js';

/**
 * Combined, search-ready city list. Each entry's `label` is what a
 * <datalist> option should show/match against — Chinese-only for China
 * cities (matches this site's existing convention of showing Chinese
 * proper nouns regardless of language toggle, e.g. ganzhi pillar names),
 * "zh en" for global cities so typing either language matches.
 * @returns {Array<{label:string, zh:string, en?:string, lat:number, lon:number, isChina:boolean, utcOffset?:number}>}
 */
export function allCityOptions() {
  const china = CHINA_CITIES.map((c) => ({ label: c.zh, zh: c.zh, lat: c.lat, lon: c.lon, isChina: true }));
  const global = GLOBAL_CITIES.map((c) => ({ label: `${c.zh} ${c.en}`, zh: c.zh, en: c.en, lat: c.lat, lon: c.lon, isChina: false, utcOffset: c.utcOffset }));
  return [...china, ...global];
}

/**
 * Exact-match lookup by the datalist `label` string (case/space-insensitive
 * fallback included since a user's typed text may not match the label's
 * exact casing). Returns null if nothing matches.
 */
export function findCityByLabel(label, options) {
  const opts = options || allCityOptions();
  const needle = String(label || '').trim();
  if (!needle) return null;
  let hit = opts.find((o) => o.label === needle);
  if (hit) return hit;
  const lower = needle.toLowerCase();
  hit = opts.find((o) => o.label.toLowerCase() === lower || o.zh === needle || (o.en && o.en.toLowerCase() === lower));
  return hit || null;
}
