/* ============================================================
   CITY PICKER — pure helpers over cities.js's two data lists. Kept
   separate from cities.js (raw data) so the data file can be regenerated
   without touching logic, and so this file stays small/testable.

   2026-07-10: switched from a single flat searchable list (526 options in
   one <datalist>, too long to browse) to a two-step region → city picker:
   allRegions() returns China's 34 provinces + every country present in
   GLOBAL_CITIES, in each list's natural (roughly geographic) order;
   citiesInRegion() returns just the handful of cities inside one chosen
   region.

   A "picked city" always carries {zh, lat, lon} plus either isChina:true
   (no utcOffset — see cities.js header for why) or a numeric utcOffset
   for a global city. horoscope.js is responsible for mapping that into
   the existing birth-timezone form fields (bTz/bDst/bLat/bLon) — this
   module has no DOM/form knowledge.
   ============================================================ */
import { CHINA_CITIES, GLOBAL_CITIES } from './cities.js';

/**
 * @returns {{provinces:Array<{key:string,zh:string,isChina:true}>,
 *            countries:Array<{key:string,zh:string,en:string,isChina:false}>}}
 */
export function allRegions() {
  const provinces = [];
  const seenP = new Set();
  for (const c of CHINA_CITIES) {
    if (seenP.has(c.province)) continue;
    seenP.add(c.province);
    provinces.push({ key: c.province, zh: c.province, isChina: true });
  }
  const countries = [];
  const seenC = new Set();
  for (const c of GLOBAL_CITIES) {
    if (seenC.has(c.country)) continue;
    seenC.add(c.country);
    countries.push({ key: c.country, zh: c.countryZh, en: c.country, isChina: false });
  }
  return { provinces, countries };
}

/**
 * Cities inside one chosen region (a province key from the `provinces`
 * list, or a country key from the `countries` list above).
 * @returns {Array<{label:string, zh:string, en?:string, lat:number, lon:number, isChina:boolean, utcOffset?:number}>}
 */
export function citiesInRegion(regionKey, isChina) {
  if (isChina) {
    return CHINA_CITIES.filter((c) => c.province === regionKey)
      .map((c) => ({ label: c.zh, zh: c.zh, lat: c.lat, lon: c.lon, isChina: true }));
  }
  return GLOBAL_CITIES.filter((c) => c.country === regionKey)
    .map((c) => ({ label: `${c.zh} ${c.en}`, zh: c.zh, en: c.en, lat: c.lat, lon: c.lon, isChina: false, utcOffset: c.utcOffset }));
}

/** Look up one city by its zh name inside an already-resolved region's city list. */
export function findCityInRegion(regionKey, isChina, cityZh) {
  return citiesInRegion(regionKey, isChina).find((c) => c.zh === cityZh) || null;
}
