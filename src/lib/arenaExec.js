/* ============================================================
   ARENA AUTOPILOT — execution policy (Part 4 §17.1 row 3 / §17.5.3).

   Pure functions only (no DOM/fetch/Date.now()), same discipline as
   arenaRules.js. This module is the deployable stand-in for "RL execution":
   not a trained agent, a hand-tuned deterministic policy whose OBJECTIVE
   (minimize modeled slippage/market impact for a given order) is the part
   of the reference strategy we keep — see urgent.md Part 4 §16.2/§17.1.
   Every helper here is dormant plumbing until a scheduled-task payload
   actually supplies volume data (avgDollarVol / avgVolume); until then,
   arenaRules.js's callers simply don't pass that data and behavior is
   unchanged from before this module existed.
   ============================================================ */

// An order's notional value as a fraction of the book's net equity —
// the trigger for slicing (>10% of equity gets split across remaining
// windows rather than filled in one clip).
export function orderEquityFraction(orderValue, equity) {
  if (!(equity > 0)) return 0;
  return orderValue / equity;
}

/**
 * Split one order into per-window slices when it's large relative to book
 * equity. `remainingWindows` is how many more run-windows exist today for
 * this book (>=1); a slice is never larger than the order's total qty, and
 * qty is distributed as evenly as whole shares allow (remainder to the
 * first slice, filled soonest). Below the 10% threshold, returns the whole
 * order as a single slice — no artificial fragmentation of small orders.
 */
export function sliceOrder(order, equity, { threshold = 0.10, remainingWindows = 1 } = {}) {
  const orderValue = order.qty * order.refPx;
  const frac = orderEquityFraction(orderValue, equity);
  const windows = Math.max(1, Math.floor(remainingWindows));
  if (frac <= threshold || windows <= 1) return [{ ...order }];

  const base = Math.floor(order.qty / windows);
  const remainder = order.qty - base * windows;
  const slices = [];
  for (let i = 0; i < windows; i++) {
    const qty = base + (i === 0 ? remainder : 0);
    if (qty > 0) slices.push({ ...order, qty });
  }
  return slices.length ? slices : [{ ...order }];
}

/**
 * Cap a proposed qty so a single window's participation never exceeds
 * `maxParticipation` (default 5%) of that symbol's average volume — the
 * free-tier-honest stand-in for "minimize market impact of large orders"
 * when no real order book depth is available. Returns the (possibly
 * reduced) qty; never increases it.
 */
export function capByParticipation(qty, avgVolume, { maxParticipation = 0.05 } = {}) {
  if (!(avgVolume > 0)) return qty;
  const cap = Math.floor(avgVolume * maxParticipation);
  return cap > 0 ? Math.min(qty, cap) : qty;
}

/**
 * Square-root market-impact slippage model: baseBps (the model's flat
 * tier from arenaRules.LIMITS) plus an impact term that grows with the
 * square root of participation (orderValue / avgDollarVol) — the standard
 * shape used to approximate impact when true order-book depth isn't
 * observable. `k` is a deliberately gentle coefficient (impact reaches
 * +10bps at ~4% of a day's dollar volume); clamps at a sane ceiling so a
 * pathological input (avgDollarVol near zero) can't blow up the fill price.
 */
export function impactSlippageBps(orderValue, avgDollarVol, baseBps, { k = 50, maxBps = 250 } = {}) {
  if (!(avgDollarVol > 0) || !(orderValue > 0)) return baseBps;
  const participation = orderValue / avgDollarVol;
  const impact = k * Math.sqrt(participation);
  return Math.min(maxBps, Number((baseBps + impact).toFixed(3)));
}

/**
 * Convenience wrapper combining slicing + participation cap into one
 * execution plan for a proposed order — what a book's Executioner step
 * would run once real volume data is in the payload (Part 4 §17.6).
 */
export function planExecution(order, ctx = {}) {
  const { equity, avgVolume, avgDollarVol, remainingWindows = 1, threshold, maxParticipation } = ctx;
  const rawSlices = sliceOrder(order, equity, { threshold, remainingWindows });
  const slices = rawSlices.map((s) => ({
    ...s,
    qty: capByParticipation(s.qty, avgVolume, { maxParticipation }),
  })).filter((s) => s.qty > 0);
  return {
    slices,
    totalQty: slices.reduce((sum, s) => sum + s.qty, 0),
    sliced: rawSlices.length > 1,
    estSlipBps: avgDollarVol > 0 ? impactSlippageBps(order.qty * order.refPx, avgDollarVol, ctx.baseBps ?? 5) : (ctx.baseBps ?? 5),
  };
}
