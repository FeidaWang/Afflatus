/* Pure validation for public/arena-universe.json's v2 ("market") schema
   (Part 4 SS18.1.2). Season 1's v1 shape (fixed 30-symbol watchlist, no
   `mode` field) is archived at public/arena-universe-s1.json and is
   frozen/historical -- it is intentionally not validated here, same as
   arena-ledger.json/arena-predlog.json are excluded in
   scripts/validate-data.mjs (their own settlement code is the correctness
   gate, not a schema check). This validator only covers the live v2 file. */

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

const SYMBOL_RE = /^[A-Za-z]{1,5}([.\-][A-Za-z]{1,2})?$/;

function validateSymbols(symbols, errors) {
  if (!Array.isArray(symbols) || !symbols.length) {
    errors.push('symbols: must be a non-empty array');
    return;
  }
  const seen = new Set();
  for (const [i, s] of symbols.entries()) {
    const tag = `symbols[${i}]`;
    if (!s || typeof s !== 'object') { errors.push(`${tag}: not an object`); continue; }
    if (!isNonEmptyString(s.sym)) errors.push(`${tag}.sym: missing or empty`);
    else if (!SYMBOL_RE.test(s.sym)) errors.push(`${tag}.sym: "${s.sym}" doesn't match the API proxy's ticker shape`);
    else if (seen.has(s.sym)) errors.push(`${tag}.sym: duplicate "${s.sym}"`);
    else seen.add(s.sym);
    if (!isNonEmptyString(s.name)) errors.push(`${tag}.name: missing or empty`);
    if (!isNonEmptyString(s.bucket)) errors.push(`${tag}.bucket: missing or empty`);
  }
}

function validateTradability(t, errors) {
  if (!t || typeof t !== 'object') { errors.push('tradability: missing or not an object'); return; }
  if (typeof t.minLastClose !== 'number' || t.minLastClose < 0) errors.push('tradability.minLastClose: must be a non-negative number');
  if (typeof t.minAvgDollarVol !== 'number' || t.minAvgDollarVol < 0) errors.push('tradability.minAvgDollarVol: must be a non-negative number');
}

/** @param {unknown} data parsed JSON (caller must JSON.parse first). */
export function validateArenaUniverse(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, errors: ['top-level: must be an object'] };
  }
  if (data.mode !== 'market') errors.push(`mode: expected "market", got ${JSON.stringify(data.mode)}`);
  if (!isNonEmptyString(data.updated)) errors.push('updated: missing or empty');
  if (typeof data.version !== 'number') errors.push('version: must be a number');
  if (!Array.isArray(data.exclusions)) errors.push('exclusions: must be an array (empty is fine)');
  if (!Array.isArray(data.benchmarks) || !data.benchmarks.length) errors.push('benchmarks: must be a non-empty array of symbol strings');
  validateTradability(data.tradability, errors);
  validateSymbols(data.symbols, errors);
  // every benchmark ticker must also be present in symbols (single source of truth for names/lookups)
  if (Array.isArray(data.symbols) && Array.isArray(data.benchmarks)) {
    const symSet = new Set(data.symbols.map((s) => s && s.sym));
    for (const b of data.benchmarks) {
      if (!symSet.has(b)) errors.push(`benchmarks: "${b}" is not present in symbols[]`);
    }
  }
  return { ok: errors.length === 0, errors };
}
