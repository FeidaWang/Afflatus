/* ============================================================
   ARENA AUTOPILOT — read-only view helpers (V5, ROADMAP §7.1).

   Pure functions only (no DOM/fetch) so the display math for the frontend
   dashboard can be unit-tested the same way arenaRules.js/arenaRun.js are —
   this file never mutates a ledger, it only derives numbers to draw with.
   ============================================================ */

// Per-position unrealised P&L in dollars and percent (vs cost basis avgPx).
export function unrealizedPnl(position) {
  const { qty, avgPx, mkPx } = position;
  if (!(avgPx > 0)) return { pnl: 0, pnlPct: 0 };
  const pnl = Number(((mkPx - avgPx) * qty).toFixed(2));
  const pnlPct = Number((((mkPx - avgPx) / avgPx) * 100).toFixed(2));
  return { pnl, pnlPct };
}

// Honest benchmark reference: arena-ledger.json only stores the LATEST
// cumulative bench %, not a per-day history, so the fairest non-fabricated
// representation is a straight two-point line from the model's own first
// recorded day (startEquity) to its latest day (startEquity scaled by the
// benchmark's cumulative %) — i.e. "what $startEquity in SPY/SMH since day 0
// would be worth today", not a real historical curve.
export function benchmarkEndpoints(equityHistory, startEquity, benchPct) {
  if (!equityHistory || !equityHistory.length || !(startEquity > 0)) return [];
  const firstDay = equityHistory[0].day;
  const lastDay = equityHistory[equityHistory.length - 1].day;
  const endEquity = Number((startEquity * (1 + (benchPct || 0) / 100)).toFixed(2));
  if (firstDay === lastDay) return [{ day: firstDay, equity: startEquity }];
  return [{ day: firstDay, equity: startEquity }, { day: lastDay, equity: endEquity }];
}

// Shared day/equity domain across every series being plotted together, so
// all lines share one coordinate system. Falls back to a +/-1 pad when a
// series is degenerate (single point / flat line) to avoid a zero-height axis.
export function equityDomain(seriesList) {
  let minDay = Infinity, maxDay = -Infinity, minEq = Infinity, maxEq = -Infinity;
  for (const series of seriesList) {
    for (const pt of series || []) {
      if (pt.day < minDay) minDay = pt.day;
      if (pt.day > maxDay) maxDay = pt.day;
      if (pt.equity < minEq) minEq = pt.equity;
      if (pt.equity > maxEq) maxEq = pt.equity;
    }
  }
  if (!isFinite(minDay)) { minDay = 0; maxDay = 1; minEq = 0; maxEq = 1; }
  if (minDay === maxDay) maxDay = minDay + 1;
  if (minEq === maxEq) { minEq -= Math.max(1, Math.abs(minEq) * 0.02); maxEq += Math.max(1, Math.abs(maxEq) * 0.02); }
  // Floor the visible range at ~1% of the midpoint value so ordinary
  // fee/slippage-sized noise (a few dollars on a $10k book) doesn't get
  // stretched into a dramatic-looking cliff by the auto-scale.
  const mid = (minEq + maxEq) / 2;
  const minRange = Math.max(1, Math.abs(mid) * 0.01);
  if (maxEq - minEq < minRange) { minEq = mid - minRange / 2; maxEq = mid + minRange / 2; }
  return { minDay, maxDay, minEq, maxEq };
}

// Linear scale of one {day, equity} point into an SVG-space {x, y}, y flipped
// (SVG y grows downward) and inset by `pad` on every side of a w×h canvas.
export function scalePoint(point, domain, w, h, pad = 0) {
  const { minDay, maxDay, minEq, maxEq } = domain;
  const dayRange = maxDay - minDay || 1, eqRange = maxEq - minEq || 1;
  const x = pad + ((point.day - minDay) / dayRange) * (w - pad * 2);
  const y = pad + (1 - (point.equity - minEq) / eqRange) * (h - pad * 2);
  return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
}
