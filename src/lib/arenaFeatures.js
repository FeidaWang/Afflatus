/* ============================================================
   ARENA AUTOPILOT — Model P (PULSE) intraday structure features
   (Part 4 §17.1 row 2 / §17.3).

   Pure functions only (no DOM/fetch/Date.now()) — the LLM step never
   computes this math itself (it could hallucinate it); this module
   computes the feature vector in code and the payload carries the
   result, same "code settles" discipline as arenaRules.js. Reuses
   classicPivots from technicals.js rather than re-deriving pivot math.

   Honest scope note (urgent.md Part 4 §16.2): this is a free-data-tier
   proxy for "deep learning on Limit Order Book micro-structure", not
   actual LOB depth or a trained model — see the mapping table in
   urgent.md §17.1.

   Shapes:
     quote           Finnhub /api/quote passthrough: { c, pc, o, h, l, ... }
     dailyCandles     ascending oldest-first: { t, o, h, l, c, v } (technicals.js shape)
     intradayCandles  ascending oldest-first, today's session so far:
                      { datetime, open, high, low, close, volume } (Twelve Data 5min shape)
   ============================================================ */
import { classicPivots } from './technicals.js';

// Gap between today's open and yesterday's close, in percent.
export function openGapPct(quote) {
  if (!quote || !(quote.pc > 0) || quote.o == null) return null;
  return Number((((quote.o - quote.pc) / quote.pc) * 100).toFixed(3));
}

// Today's intraday range so far (high-low) as a percent of prior close —
// a proxy for realized micro-volatility ("first N minutes range" widens
// to "range so far" once real intraday candles aren't available).
export function intradayRangePct(quote) {
  if (!quote || !(quote.pc > 0) || quote.h == null || quote.l == null) return null;
  return Number((((quote.h - quote.l) / quote.pc) * 100).toFixed(3));
}

// Volume-weighted average price from a run of intraday candles.
export function computeVWAP(intradayCandles) {
  let pv = 0, vol = 0;
  for (const k of intradayCandles || []) {
    const typical = (k.high + k.low + k.close) / 3;
    pv += typical * (k.volume || 0);
    vol += k.volume || 0;
  }
  if (!(vol > 0)) return null;
  return Number((pv / vol).toFixed(4));
}

// Current price's drift from session VWAP, in percent — positive means
// trading above the volume-weighted average (momentum-confirming).
export function vwapDriftPct(price, vwap) {
  if (!(vwap > 0) || price == null) return null;
  return Number((((price - vwap) / vwap) * 100).toFixed(3));
}

// Today's volume vs its own trailing N-session average (default 20) —
// a ratio, not a raw count, so it's comparable across symbols of very
// different size.
export function volumeSurgeRatio(todayVolume, dailyCandles, lookback = 20) {
  const recent = (dailyCandles || []).slice(-lookback);
  if (!recent.length || !(todayVolume > 0)) return null;
  const avg = recent.reduce((sum, k) => sum + (k.v || 0), 0) / recent.length;
  if (!(avg > 0)) return null;
  return Number((todayVolume / avg).toFixed(3));
}

// Which classic pivot level (derived from the prior COMPLETED session) the
// current price sits nearest to, and whether it's already broken through.
export function pivotBreakState(dailyCandles, price) {
  if (!dailyCandles || !dailyCandles.length || price == null) return null;
  const prior = dailyCandles[dailyCandles.length - 1];
  const piv = classicPivots(prior);
  const levels = [
    ['r3', piv.r3], ['r2', piv.r2], ['r1', piv.r1], ['pp', piv.pp],
    ['s1', piv.s1], ['s2', piv.s2], ['s3', piv.s3],
  ];
  let nearest = levels[0];
  for (const lvl of levels) {
    if (Math.abs(price - lvl[1]) < Math.abs(price - nearest[1])) nearest = lvl;
  }
  return {
    nearest: nearest[0],
    level: Number(nearest[1].toFixed(4)),
    side: price >= nearest[1] ? 'above' : 'below',
    distPct: Number((((price - nearest[1]) / nearest[1]) * 100).toFixed(3)),
  };
}

/**
 * Full feature vector for one candidate symbol — what Model P's payload
 * carries per symbol; the LLM ranks/sizes candidates from this, it never
 * derives the numbers itself. `dailyCandles` should exclude today's
 * in-progress bar (see technicals.js normalizeDaily upstream).
 */
export function buildPulseFeatures({ quote, dailyCandles, intradayCandles, price } = {}) {
  const p = price != null ? price : quote ? quote.c : null;
  const vwap = computeVWAP(intradayCandles);
  const todayVolume = (intradayCandles || []).reduce((sum, k) => sum + (k.volume || 0), 0);
  return {
    openGapPct: openGapPct(quote),
    intradayRangePct: intradayRangePct(quote),
    vwap,
    vwapDriftPct: vwapDriftPct(p, vwap),
    volumeSurgeRatio: volumeSurgeRatio(todayVolume, dailyCandles),
    pivotBreak: pivotBreakState(dailyCandles, p),
  };
}
