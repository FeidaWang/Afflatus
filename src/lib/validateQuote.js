// Compatibility boundary for Finnhub's numeric quote shape. Research snapshots
// can be old (weekends/holidays); session freshness belongs to the consumer.
const PRICE_FIELDS = ['c', 'pc', 'o', 'h', 'l'];
export function validateQuote(data, now = Date.now()) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, errors: ['quote must be an object'] };
  const errors = [];
  for (const field of PRICE_FIELDS) {
    if (typeof data[field] !== 'number' || !Number.isFinite(data[field]) || data[field] <= 0) errors.push(`${field} must be a positive finite number`);
  }
  if (!Number.isSafeInteger(data.t) || data.t <= 0 || !Number.isSafeInteger(data.t * 1000) || !Number.isFinite(now) || data.t * 1000 > now) {
    errors.push('t must be a positive Unix-seconds integer no later than the observation clock');
  }
  for (const field of ['d', 'dp']) {
    if (data[field] != null && (typeof data[field] !== 'number' || !Number.isFinite(data[field]))) errors.push(`${field} must be a finite number or null`);
  }
  return { ok: errors.length === 0, errors };
}

// Explicitly export only the fields used by the existing quote consumers.
// Call only after validateQuote; missing optional changes remain unavailable.
export function quoteCompatibilityPayload(data) {
  return { c: data.c, pc: data.pc, o: data.o, h: data.h, l: data.l, t: data.t, d: data.d ?? null, dp: data.dp ?? null };
}
