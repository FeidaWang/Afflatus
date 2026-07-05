/* ============================================================
   PREDLOG ENTRY — pure functions for the V19 Arena prediction-delta signal
   layer (ROADMAP §7.7 Phase 1). No DOM/fetch/Date.now() defaults — same
   discipline as arenaRules.js/arenaRun.js: the scheduled task (LLM +
   /api/quote fetch) gathers real predictions + real O/C prices, and this
   module is the deterministic "code computes" half that
   scripts/apply-arena-predlog.mjs calls. See that script's header for the
   full gather → compute → write pipeline.
   ============================================================ */

// Percent change of `actual` vs `base` (e.g. actual close vs prevClose),
// rounded to 3dp. Returns null for missing/invalid inputs rather than
// throwing or returning NaN/Infinity — a missing quote for one ticker
// should never break the whole day's entry.
export function pctChange(actual, base) {
  if (!(base > 0) || !Number.isFinite(actual)) return null;
  return Number((((actual - base) / base) * 100).toFixed(3));
}

// Did the model's directional call (UP/DOWN) match the actual close move?
// A flat day (actualClosePct === 0) counts as a miss for either call —
// there's no "correct" direction when nothing moved.
export function directionHit(direction, actualClosePct) {
  if (actualClosePct === null || actualClosePct === undefined) return null;
  if (actualClosePct === 0) return false;
  return direction === (actualClosePct > 0 ? 'UP' : 'DOWN');
}

// Builds one day's predlog record from that morning's aiPredictions
// (already includes predOpenPct/predClosePct once the news-digest prompt
// is updated), the prevClose map (from arena-news.json's `prices`), and the
// actual { open, close } quotes fetched post-market-close. Missing actuals
// for a symbol produce null fields for that symbol rather than dropping it.
export function buildPredlogDay(dateStr, predictions, prevCloseMap, actuals) {
  const entries = {};
  for (const sym of Object.keys(predictions || {})) {
    const p = predictions[sym] || {};
    const prevClose = prevCloseMap ? prevCloseMap[sym] : undefined;
    const act = actuals ? actuals[sym] : undefined;
    const actualOpenPct = act ? pctChange(act.open, prevClose) : null;
    const actualClosePct = act ? pctChange(act.close, prevClose) : null;
    entries[sym] = {
      predOpenPct: typeof p.predOpenPct === 'number' ? p.predOpenPct : null,
      predClosePct: typeof p.predClosePct === 'number' ? p.predClosePct : null,
      actualOpenPct,
      actualClosePct,
      dirHit: directionHit(p.direction, actualClosePct),
    };
  }
  return { date: dateStr, entries };
}

// Upserts `dayEntry` into `days` by date (idempotent — a rerun for the same
// date replaces rather than duplicates), keeps the list date-sorted, and
// caps it to the last `maxDays` entries (rolling window, ROADMAP §7.7 says
// ~60 trading days).
export function appendPredlogDay(days, dayEntry, maxDays = 60) {
  const list = Array.isArray(days) ? days.slice() : [];
  const idx = list.findIndex((d) => d.date === dayEntry.date);
  if (idx >= 0) list[idx] = dayEntry;
  else list.push(dayEntry);
  list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return list.length > maxDays ? list.slice(list.length - maxDays) : list;
}
