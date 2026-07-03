/* ============================================================
   ARENA AUTOPILOT — rules engine (V3, ROADMAP §7.1).

   Pure functions only. No DOM, no fetch, no localStorage, no Date.now()
   defaults baked in (callers pass `now`/`day` explicitly) — this is the one
   module in the whole site where a silently-wrong calculation is the least
   forgivable bug class, so it must stay 100% unit-testable in plain Node
   (see tests/arenaRules.test.js).

   Design intent (see ROADMAP §7.1 for the full rationale): the LLM (Model A
   or B) only ever PROPOSES an order. Every hard risk limit below is
   enforced here, in code, before a proposed order is allowed to touch the
   ledger. The model is never trusted to "remember" a limit on its own.

   A "model" is one ledger slice, shaped like:
   {
     promptVersion, startEquity, cash, equity,
     equityHistory: [{day, equity}],
     positions: [{sym, qty, avgPx, mkPx}],
     trades: [{ts, sym, side, qty, px, fee, slipBps}],
     rejections: [{ts, order, reason}],
     metrics: {cumPct, maxDD, hitRate, exposure},
   }
   ============================================================ */

// ---- hard limits (ROADMAP §7.1) --------------------------------
export const LIMITS = {
  MAX_POSITION_PCT: 0.20,   // single symbol <= 20% of net equity
  MAX_POSITIONS: 8,         // <= 8 distinct symbols held at once
  MIN_CASH_PCT: 0.05,       // keep >= 5% cash at all times
  DAILY_LOSS_BREAKER_PCT: 0.03,   // day P&L <= -3% => HOLD/SELL only for the rest of that day
  SEASON_RESET_PCT: 0.20,   // cumulative loss >= 20% => freeze + reset
  CONFIDENCE_FLOOR: 0.65,   // new-position orders below this confidence are rejected
  STOP_LOSS: { A: 0.08, B: 0.15 },     // per-position stop, from cost basis
  SLIPPAGE_BPS: { A: 5, B: 2 },        // tiered slippage
  FEE_BPS: 0.5,
  MAX_WEEKLY_TRADES: { A: 20 },        // Model A turnover cap; Model B is day-gated instead (see ALLOWED_TRADE_DAYS)
  ALLOWED_TRADE_DAYS: { B: [2, 4] },   // Model B may only OPEN/ADD on Tue(2)/Thu(4) (JS getDay()); risk-reduction exempt
};

// ---- order validation -------------------------------------------
// order: { sym, side: 'buy'|'sell', qty, refPx, confidence, reduceOnly }
// ctx:   { model: 'A'|'B', universe: string[], weekday, weeklyTradeCount }
// Returns { ok: true } or { ok: false, reason }
export function validateOrder(order, modelLedger, ctx) {
  if (!order || typeof order !== 'object') return { ok: false, reason: 'malformed order' };
  const { sym, side, qty, refPx, confidence, reduceOnly } = order;
  if (!sym || (side !== 'buy' && side !== 'sell')) return { ok: false, reason: 'malformed order: sym/side' };
  if (!(qty > 0) || !(refPx > 0)) return { ok: false, reason: 'malformed order: qty/refPx must be positive' };

  // cash-account, long-only: 'sell' can only ever reduce/close an existing long,
  // never open a short. There is no borrow, no options, no leverage.
  const existing = modelLedger.positions.find((p) => p.sym === sym);
  if (side === 'sell') {
    if (!existing || existing.qty < qty) return { ok: false, reason: 'no shorting: cannot sell more than the existing long position' };
  }

  // fixed trading universe
  if (ctx.universe && !ctx.universe.includes(sym)) return { ok: false, reason: `outside fixed trading universe: ${sym}` };

  // risk-reducing sells always pass the throttles below; only opens/adds are gated
  const isRiskReduction = side === 'sell';
  if (!isRiskReduction) {
    // confidence floor (new positions only — adding to an existing winner also gated,
    // matching "新开仓订单 confidence<0.65 一律拒单" read literally as any buy order)
    if (typeof confidence === 'number' && confidence < LIMITS.CONFIDENCE_FLOOR) {
      return { ok: false, reason: `confidence ${confidence} below floor ${LIMITS.CONFIDENCE_FLOOR}` };
    }

    // turnover cap (Model A: weekly trade count; Model B: day-gated instead)
    if (ctx.model === 'A' && ctx.weeklyTradeCount != null && ctx.weeklyTradeCount >= LIMITS.MAX_WEEKLY_TRADES.A) {
      return { ok: false, reason: `Model A weekly turnover cap reached (${LIMITS.MAX_WEEKLY_TRADES.A}/week)` };
    }
    if (ctx.model === 'B' && ctx.weekday != null) {
      const allowed = LIMITS.ALLOWED_TRADE_DAYS.B;
      if (!allowed.includes(ctx.weekday)) return { ok: false, reason: 'Model B may only open/add positions on Tue/Thu runs' };
    }

    // single-position cap: check the resulting position value against equity AFTER the trade
    const notional = qty * refPx;
    const newQty = (existing ? existing.qty : 0) + qty;
    const newPositionValue = newQty * refPx;
    if (modelLedger.equity > 0 && newPositionValue / modelLedger.equity > LIMITS.MAX_POSITION_PCT) {
      return { ok: false, reason: `position would exceed ${LIMITS.MAX_POSITION_PCT * 100}% of equity` };
    }

    // max distinct positions (only matters if this order opens a brand-new symbol)
    if (!existing && modelLedger.positions.length >= LIMITS.MAX_POSITIONS) {
      return { ok: false, reason: `already at max ${LIMITS.MAX_POSITIONS} distinct positions` };
    }

    // min cash buffer after the buy
    const feeEst = notional * (LIMITS.FEE_BPS / 10000);
    const cashAfter = modelLedger.cash - notional - feeEst;
    if (cashAfter / modelLedger.equity < LIMITS.MIN_CASH_PCT) {
      return { ok: false, reason: `would breach minimum ${LIMITS.MIN_CASH_PCT * 100}% cash buffer` };
    }
    if (cashAfter < 0) return { ok: false, reason: 'insufficient cash' };
  }

  return { ok: true };
}

// ---- simulated matching -----------------------------------------
// Reference price +/- slippage (buys pay up, sells receive less), plus a flat fee.
export function simulateFill(order, model /* 'A'|'B' */) {
  const slipBps = LIMITS.SLIPPAGE_BPS[model] ?? 5;
  const feeBps = LIMITS.FEE_BPS;
  const slipMult = order.side === 'buy' ? (1 + slipBps / 10000) : (1 - slipBps / 10000);
  const execPx = Number((order.refPx * slipMult).toFixed(4));
  const notional = execPx * order.qty;
  const fee = Number((notional * (feeBps / 10000)).toFixed(4));
  return { execPx, fee, slipBps, notional };
}

// ---- apply a fill to a ledger slice (pure — returns a new object) -------
export function applyFill(modelLedger, order, fill, ts) {
  const positions = modelLedger.positions.map((p) => ({ ...p }));
  let idx = positions.findIndex((p) => p.sym === order.sym);
  let cashDelta = 0;
  let realizedPnl = null;

  if (order.side === 'buy') {
    const cost = fill.execPx * order.qty + fill.fee;
    cashDelta = -cost;
    if (idx >= 0) {
      const p = positions[idx];
      const newQty = p.qty + order.qty;
      const newAvg = (p.avgPx * p.qty + fill.execPx * order.qty) / newQty;
      positions[idx] = { ...p, qty: newQty, avgPx: Number(newAvg.toFixed(4)) };
    } else {
      positions.push({ sym: order.sym, qty: order.qty, avgPx: fill.execPx, mkPx: fill.execPx });
    }
  } else {
    const proceeds = fill.execPx * order.qty - fill.fee;
    cashDelta = proceeds;
    const p = positions[idx];
    realizedPnl = Number(((fill.execPx - p.avgPx) * order.qty - fill.fee).toFixed(4));
    const remaining = p.qty - order.qty;
    if (remaining <= 1e-9) positions.splice(idx, 1);
    else positions[idx] = { ...p, qty: remaining };
  }

  const trade = { ts, sym: order.sym, side: order.side, qty: order.qty, px: fill.execPx, fee: fill.fee, slipBps: fill.slipBps, realizedPnl };
  return {
    ...modelLedger,
    cash: Number((modelLedger.cash + cashDelta).toFixed(4)),
    positions,
    trades: [...modelLedger.trades, trade],
  };
}

export function rejectOrder(modelLedger, order, reason, ts) {
  return { ...modelLedger, rejections: [...modelLedger.rejections, { ts, order, reason }] };
}

// ---- mark-to-market ------------------------------------------------------
// priceMap: { sym: price }. Returns a new model with updated position mkPx + equity.
export function markToMarket(modelLedger, priceMap) {
  const positions = modelLedger.positions.map((p) => ({ ...p, mkPx: priceMap[p.sym] != null ? priceMap[p.sym] : p.mkPx }));
  const posValue = positions.reduce((sum, p) => sum + p.qty * p.mkPx, 0);
  const equity = Number((modelLedger.cash + posValue).toFixed(4));
  return { ...modelLedger, positions, equity };
}

// ---- stop-loss sweep ------------------------------------------------------
// Returns an array of forced sell orders (reduceOnly) for positions breaching
// the per-model stop, in cost-basis terms — never trusts the model to "remember".
export function checkStopLoss(modelLedger, model) {
  const stopPct = LIMITS.STOP_LOSS[model] ?? 0.08;
  const orders = [];
  for (const p of modelLedger.positions) {
    const drawdown = (p.mkPx - p.avgPx) / p.avgPx;
    if (drawdown <= -stopPct) {
      orders.push({ sym: p.sym, side: 'sell', qty: p.qty, refPx: p.mkPx, reduceOnly: true, reason: `stop-loss ${(drawdown * 100).toFixed(1)}% <= -${stopPct * 100}%` });
    }
  }
  return orders;
}

// ---- daily circuit breaker ------------------------------------------------
// dayStartEquity vs current equity; if breached, caller must restrict the
// remaining run to HOLD/SELL-only order proposals (no new buys).
export function checkDailyCircuitBreaker(dayStartEquity, currentEquity) {
  if (!(dayStartEquity > 0)) return false;
  const dayPct = (currentEquity - dayStartEquity) / dayStartEquity;
  return dayPct <= -LIMITS.DAILY_LOSS_BREAKER_PCT;
}

// ---- season reset ----------------------------------------------------------
export function checkSeasonReset(modelLedger) {
  if (!(modelLedger.startEquity > 0)) return false;
  const cumPct = (modelLedger.equity - modelLedger.startEquity) / modelLedger.startEquity;
  return cumPct <= -LIMITS.SEASON_RESET_PCT;
}

export function resetSeason(modelLedger, newPromptVersion, day) {
  return {
    ...modelLedger,
    promptVersion: newPromptVersion,
    startEquity: 10000,
    cash: 10000,
    equity: 10000,
    equityHistory: [{ day, equity: 10000 }],
    positions: [],
    trades: modelLedger.trades, // trade history is kept for the post-mortem; only balances reset
    rejections: modelLedger.rejections,
    metrics: { cumPct: 0, maxDD: 0, hitRate: null, exposure: 0 },
  };
}

// ---- metrics ----------------------------------------------------------------
// Per ROADMAP §7.1: no annualized figures before 30 trading days of history —
// this module simply doesn't expose an annualization helper at all, so a
// future caller can't reach for one by accident.
export function computeMetrics(modelLedger) {
  const { startEquity, equity, equityHistory, trades, positions } = modelLedger;
  const cumPct = startEquity > 0 ? Number((((equity - startEquity) / startEquity) * 100).toFixed(3)) : 0;

  let peak = -Infinity, maxDD = 0;
  for (const pt of equityHistory) {
    peak = Math.max(peak, pt.equity);
    if (peak > 0) maxDD = Math.min(maxDD, (pt.equity - peak) / peak);
  }
  maxDD = Number((maxDD * 100).toFixed(3));

  const closed = trades.filter((t) => t.side === 'sell' && t.realizedPnl != null);
  const hitRate = closed.length ? Number(((closed.filter((t) => t.realizedPnl > 0).length / closed.length) * 100).toFixed(1)) : null;

  const posValue = positions.reduce((sum, p) => sum + p.qty * p.mkPx, 0);
  const exposure = equity > 0 ? Number(((posValue / equity) * 100).toFixed(1)) : 0;

  return { cumPct, maxDD, hitRate, exposure };
}
