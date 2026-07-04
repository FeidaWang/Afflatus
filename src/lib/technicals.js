/* ============================================================
   TECHNICALS — pure daily-candle analysis for the Arena TA dashboard (V13).

   Pure functions only: no DOM, no fetch, no Date.now() — callers pass the
   candle array (ascending by date) and any "now" context explicitly, so the
   whole module is unit-testable in Node (same discipline as arenaRules.js).

   Candle shape: { t: 'YYYY-MM-DD', o, h, l, c, v }  (ascending, oldest first)
   ============================================================ */

/** Simple moving average series; null until enough data. */
export function smaSeries(values, n) {
  const out = new Array(values.length).fill(null);
  let s = 0;
  for (let i = 0; i < values.length; i++) {
    s += values[i];
    if (i >= n) s -= values[i - n];
    if (i >= n - 1) out[i] = s / n;
  }
  return out;
}

/**
 * Snapshot of the standard MA set vs a reference price.
 * slope compares the latest MA value to the value `slopeBars` bars earlier.
 */
export function maSnapshot(candles, price, periods = [5, 10, 20, 60, 200], slopeBars = 3) {
  const closes = candles.map((k) => k.c);
  return periods.map((n) => {
    const s = smaSeries(closes, n);
    const value = s[s.length - 1];
    if (value == null) return { n, value: null, slope: null, pricePos: null, distPct: null };
    const prev = s[s.length - 1 - slopeBars] ?? null;
    const slope = prev == null ? null : value > prev * 1.0005 ? 'up' : value < prev * 0.9995 ? 'down' : 'flat';
    return {
      n,
      value,
      slope,
      pricePos: price >= value ? 'above' : 'below',
      distPct: ((price - value) / value) * 100,
    };
  });
}

/** Classic floor-trader pivots from one reference candle. */
export function classicPivots({ h, l, c }) {
  const pp = (h + l + c) / 3;
  return {
    pp,
    r1: 2 * pp - l,
    s1: 2 * pp - h,
    r2: pp + (h - l),
    s2: pp - (h - l),
    r3: h + 2 * (pp - l),
    s3: l - 2 * (h - pp),
  };
}

/**
 * Review one completed session against a pivot set: which levels did its
 * range touch, and where did it close relative to each?
 */
export function reviewSession(candle, pivots) {
  const names = ['r3', 'r2', 'r1', 'pp', 's1', 's2', 's3'];
  return names.map((name) => {
    const lvl = pivots[name];
    return {
      name,
      level: lvl,
      touched: candle.l <= lvl && candle.h >= lvl,
      closedAbove: candle.c > lvl,
    };
  });
}

/**
 * Swing highs/lows via fractal detection, clustered into levels.
 * strength = bars on EACH side that must be lower (high) / higher (low).
 * Clusters levels within clusterPct of each other (average, count touches).
 * Returns supports (below price) and resistances (above price), nearest first.
 */
export function swingLevels(candles, { price, strength = 3, lookback = 120, clusterPct = 0.012 } = {}) {
  const n = candles.length;
  const from = Math.max(strength, n - lookback);
  const rawHi = [];
  const rawLo = [];
  for (let i = from; i < n - strength; i++) {
    let isHi = true;
    let isLo = true;
    for (let k = 1; k <= strength; k++) {
      if (candles[i].h <= candles[i - k].h || candles[i].h <= candles[i + k].h) isHi = false;
      if (candles[i].l >= candles[i - k].l || candles[i].l >= candles[i + k].l) isLo = false;
      if (!isHi && !isLo) break;
    }
    if (isHi) rawHi.push({ level: candles[i].h, date: candles[i].t });
    if (isLo) rawLo.push({ level: candles[i].l, date: candles[i].t });
  }
  const cluster = (raw) => {
    const sorted = [...raw].sort((a, b) => a.level - b.level);
    const out = [];
    for (const p of sorted) {
      const last = out[out.length - 1];
      if (last && Math.abs(p.level - last.level) / last.level <= clusterPct) {
        last.level = (last.level * last.touches + p.level) / (last.touches + 1);
        last.touches += 1;
        if (p.date > last.lastDate) last.lastDate = p.date;
      } else {
        out.push({ level: p.level, touches: 1, lastDate: p.date });
      }
    }
    return out;
  };
  const all = cluster(rawHi).map((x) => ({ ...x, kind: 'swingHigh' }))
    .concat(cluster(rawLo).map((x) => ({ ...x, kind: 'swingLow' })));
  const supports = all.filter((x) => x.level < price).sort((a, b) => b.level - a.level);
  const resistances = all.filter((x) => x.level >= price).sort((a, b) => a.level - b.level);
  return { supports, resistances };
}

/**
 * Psychological round-number levels near price.
 * minor grid: $10 for price ≥ $100, $5 for ≥ $25, else $1.
 * major grid: $100 / $50 / $10 / $5 by magnitude ("century" levels).
 * Per side: the nearest `keep` minors plus the nearest major (majors always
 * make the cut even when a minor is closer), capped at keep+1.
 */
export function roundLevels(price, { span = 0.12, keep = 2 } = {}) {
  const major = price >= 250 ? 100 : price >= 100 ? 50 : price >= 25 ? 10 : price >= 10 ? 5 : 1;
  const minor = price >= 100 ? 10 : price >= 25 ? 5 : 1;
  const lo = price * (1 - span);
  const hi = price * (1 + span);
  const levels = [];
  for (let v = Math.ceil(lo / minor) * minor; v <= hi + 1e-9; v += minor) {
    const level = Number(v.toFixed(2));
    if (level <= 0) continue;
    levels.push({ level, weight: Math.abs(level / major - Math.round(level / major)) < 1e-9 ? 'major' : 'minor' });
  }
  const pick = (side) => {
    const sorted = levels
      .filter((x) => (side === 'below' ? x.level < price : x.level >= price))
      .sort((a, b) => (side === 'below' ? b.level - a.level : a.level - b.level));
    const out = sorted.slice(0, keep);
    const nearestMajor = sorted.find((x) => x.weight === 'major');
    if (nearestMajor && !out.includes(nearestMajor)) out.push(nearestMajor);
    return out;
  };
  return { below: pick('below'), above: pick('above') };
}

/**
 * Gap detection on daily candles. Gap up: today's low > yesterday's high
 * (zone = [yesterday.h, today.l]); gap down mirrored. Fill status is tracked
 * against all LATER candles: 'filled' once price trades fully through the
 * zone, 'partial' if it entered the zone, else 'open'.
 * Returns newest-first.
 */
export function detectGaps(candles, { minGapPct = 0.005, lookback = 120 } = {}) {
  const n = candles.length;
  const from = Math.max(1, n - lookback);
  const gaps = [];
  for (let i = from; i < n; i++) {
    const prev = candles[i - 1];
    const cur = candles[i];
    let dir = null;
    let bottom;
    let top;
    if (cur.l > prev.h) { dir = 'up'; bottom = prev.h; top = cur.l; }
    else if (cur.h < prev.l) { dir = 'down'; bottom = cur.h; top = prev.l; }
    if (!dir) continue;
    const sizePct = ((top - bottom) / prev.c) * 100;
    if (sizePct < minGapPct * 100) continue;
    let status = 'open';
    for (let j = i + 1; j < n; j++) {
      if (dir === 'up') {
        if (candles[j].l <= bottom) { status = 'filled'; break; }
        if (candles[j].l < top) status = 'partial';
      } else {
        if (candles[j].h >= top) { status = 'filled'; break; }
        if (candles[j].h > bottom) status = 'partial';
      }
    }
    gaps.push({ date: cur.t, dir, bottom, top, sizePct, status });
  }
  return gaps.reverse();
}

/**
 * Upside consolidation-box breakouts. A box is `win` bars whose total range
 * (maxH-minL)/close stays under maxRangePct; a breakout is a close above the
 * box high, volume-confirmed when volume > volMult × box average volume.
 * status vs latest close: 'holding' (>= level) or 'lost'.
 * Returns newest-first, deduped so overlapping boxes report one breakout.
 */
export function detectBreakouts(candles, { win = 20, maxRangePct = 0.07, volMult = 1.5, lookback = 120 } = {}) {
  const n = candles.length;
  const lastClose = n ? candles[n - 1].c : 0;
  const from = Math.max(win, n - lookback);
  const out = [];
  for (let i = from; i < n; i++) {
    let hiBox = -Infinity;
    let loBox = Infinity;
    let volSum = 0;
    for (let j = i - win; j < i; j++) {
      if (candles[j].h > hiBox) hiBox = candles[j].h;
      if (candles[j].l < loBox) loBox = candles[j].l;
      volSum += candles[j].v || 0;
    }
    if ((hiBox - loBox) / candles[i - 1].c > maxRangePct) continue;
    if (candles[i].c <= hiBox) continue;
    const avgVol = volSum / win;
    const prevSame = out[out.length - 1];
    if (prevSame && Math.abs(prevSame.level - hiBox) / hiBox < 0.01) continue; // same box, later bar
    out.push({
      date: candles[i].t,
      level: hiBox,
      volConfirmed: avgVol > 0 ? (candles[i].v || 0) > volMult * avgVol : false,
      status: lastClose >= hiBox ? 'holding' : 'lost',
    });
  }
  return out.reverse();
}

/**
 * Drop a still-in-progress daily candle (Twelve Data includes the current
 * session's partial bar during market hours). Pure: caller supplies the
 * current ET date string and whether the session has completed.
 */
export function normalizeDaily(candles, { etDateStr, sessionComplete }) {
  if (!candles.length) return candles;
  const last = candles[candles.length - 1];
  const lastDate = String(last.t).slice(0, 10);
  if (lastDate === etDateStr && !sessionComplete) return candles.slice(0, -1);
  return candles;
}

/**
 * Full ticker analysis for the dashboard.
 * PRE  mode: pivots from the latest completed candle (a plan for the NEXT session).
 * POST mode: pivots from the candle before it, reviewed against the latest
 *            completed session (what actually got tested/broken).
 */
export function analyzeTicker(candles, { price } = {}) {
  if (!candles || candles.length < 2) return null;
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const p = price != null && isFinite(price) ? price : last.c;
  const prePivots = classicPivots(last);
  const postPivots = classicPivots(prev);
  return {
    price: p,
    last,
    prev,
    ma: maSnapshot(candles, p),
    pivots: { pre: prePivots, post: postPivots },
    postReview: reviewSession(last, postPivots),
    swings: swingLevels(candles, { price: p }),
    rounds: roundLevels(p),
    gaps: detectGaps(candles),
    breakouts: detectBreakouts(candles),
  };
}
