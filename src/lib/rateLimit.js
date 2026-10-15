/* Pure fixed-window per-key rate limiter (D1, ROADMAP §1).
 * Caller owns the store (a Map) so this stays testable without touching
 * module-level state or Date.now() defaults — same discipline as
 * arenaRules.js / validateSignalEvents.js.
 *
 * Local development primitive. Production routes use distributedRateLimit.js.
 */
export function checkRateLimit(store, key, { limit, windowMs, now = Date.now() } = {}) {
  let entry = store.get(key);
  if (!entry || now - entry.start >= windowMs) entry = { start: now, count: 0 };
  entry.count += 1;
  store.set(key, entry);
  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetMs: Math.max(0, entry.start + windowMs - now),
  };
}

/** First public-looking address out of a (possibly comma-separated) x-forwarded-for header. */
export function clientIp(req) {
  const xf = req.headers && req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}
