/* Vercel serverless proxy for Twelve Data historical candles.
   Keeps the API key server-side (set TWELVE_KEY in Vercel env vars). The browser
   calls /api/history?symbol=NVDA&interval=1day&outputsize=120 — no key on client.
   Returns an allowlisted Twelve Data time_series projection { status, meta, values }.

   D1 (2026-07-04): tightened the symbol shape to a real-ticker pattern (was an
   open `.{1,12}` proxy) and added a per-IP rate limit — this endpoint has no
   auth and the free-tier Twelve Data quota is shared across every site visitor.
   V13 lets users load ANY US ticker (not just the Arena watchlist), so this is
   deliberately NOT a fixed symbol whitelist — see ROADMAP §1 D1 for why.

   Part 4 (urgent.md §18.4/§20, 2026-07-23): same allowlist + admin-key gate
   as api/quote.js — see that file's header for the full rationale. */
import { checkRateLimit, clientIp } from '../src/lib/rateLimit.js';
import { isSymbolAllowed, checkAdminKey } from '../src/lib/arenaAccess.js';
import { getPublishedArenaAllowlist } from '../src/lib/arenaPublishedAccess.js';
import { fetchWithTimeout, getRequestId, isAbortError, sendApiError, setApiHeaders } from '../src/lib/apiHttp.js';

const SYMBOL_RE = /^[A-Za-z]{1,5}([.\-][A-Za-z]{1,2})?$/;
const RATE_LIMIT = { limit: 20, windowMs: 60000 };
const hits = new Map();
// Every caller (fetchJson, the Arena scripts) asks for daily bars with these
// parameters only. Anything else would only vary the CDN cache key.
const QUERY_KEYS = new Set(['symbol', 'interval', 'outputsize']);
const INTERVALS = new Set(['1day']);
// Upstream is asked for the next bucket up and the response is sliced, so
// nearby sizes share one provider call in the per-instance cache below.
const OUTPUT_BUCKETS = [10, 30, 60, 120, 250, 500, 1000, 5000];
const PUBLIC_TTL_MS = 15 * 60_000;
const publicCache = new Map();
const inflight = new Map();

async function loadHistory(symbol, interval, outputsize, key) {
  const u = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&outputsize=${outputsize}`;
  return fetchWithTimeout(u, { headers: { Authorization: `apikey ${key}` } }, 7000, async (r) => {
    if (!r.ok) return { status: 502, code: 'UPSTREAM_HTTP', upstreamStatus: r.status };
    const j = await r.json();
    if (!j || j.status !== 'ok' || !Array.isArray(j.values)) return { status: 502, code: 'UPSTREAM_SCHEMA' };
    // Project known market fields only; never forward arbitrary upstream metadata.
    const pick = (value, fields) => Object.fromEntries(fields.filter(field =>
      value && ['string', 'number'].includes(typeof value[field])).map(field => [field, value[field]]));
    return {
      status: 200,
      data: {
        status: 'ok',
        meta: pick(j.meta, ['symbol', 'interval', 'currency', 'exchange_timezone', 'exchange', 'mic_code', 'type']),
        values: j.values.map(value => pick(value, ['datetime', 'open', 'high', 'low', 'close', 'volume'])),
      },
    };
  });
}

function loadPublicHistory(symbol, interval, outputsize, key) {
  const cacheKey = `${symbol}|${interval}|${outputsize}`;
  const now = Date.now();
  for (const [entryKey, entry] of publicCache) if (entry.expiresAt <= now) publicCache.delete(entryKey);
  const cached = publicCache.get(cacheKey);
  if (cached) return Promise.resolve(cached.result);
  if (!inflight.has(cacheKey)) {
    inflight.set(cacheKey, loadHistory(symbol, interval, outputsize, key).then((result) => {
      if (result.status === 200) publicCache.set(cacheKey, { result, expiresAt: Date.now() + PUBLIC_TTL_MS });
      return result;
    }).finally(() => inflight.delete(cacheKey)));
  }
  return inflight.get(cacheKey);
}

export default async function handler(req, res) {
  const requestId = getRequestId(req);
  setApiHeaders(res, requestId);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('Vary', 'x-arena-key, Authorization');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    sendApiError(res, 405, 'METHOD_NOT_ALLOWED', requestId);
    return;
  }
  const query = req.query || {};
  const symbol = typeof query.symbol === 'string' ? query.symbol.trim().toUpperCase() : '';
  const interval = typeof query.interval === 'string' ? query.interval.trim() : '';
  const rawSize = query.outputsize === undefined ? '100' : String(query.outputsize).trim();
  const requested = /^\d{1,4}$/.test(rawSize) ? Number(rawSize) : 0;
  if (Object.keys(query).some((name) => !QUERY_KEYS.has(name))
    || !symbol || !SYMBOL_RE.test(symbol) || !INTERVALS.has(interval)
    || !(requested >= 1 && requested <= 5000)) { sendApiError(res, 400, 'INVALID_PARAMS', requestId); return; }
  const now = Date.now();
  // Bound expired per-IP entries in the process-local limiter.
  for (const [ip, entry] of hits) if (now - entry.start >= RATE_LIMIT.windowMs) hits.delete(ip);
  const ip = clientIp(req);
  if (!hits.has(ip) && hits.size >= 10_000) {
    res.setHeader('Retry-After', '60');
    sendApiError(res, 429, 'RATE_LIMITED', requestId);
    return;
  }
  const rl = checkRateLimit(hits, ip, { ...RATE_LIMIT, now });
  if (!rl.allowed) { res.setHeader('Retry-After', Math.ceil(rl.resetMs / 1000)); sendApiError(res, 429, 'RATE_LIMITED', requestId); return; }

  const publicSymbol = isSymbolAllowed(symbol, getPublishedArenaAllowlist());
  const admin = checkAdminKey(req.headers?.['x-arena-key'], process.env.ARENA_ADMIN_KEY);
  if (!publicSymbol && !admin) {
    sendApiError(res, 403, 'ARENA_KEY_REQUIRED', requestId, { message: "symbol outside today's pool — admin unlock required" });
    return;
  }

  // Only a verified admin read is private (fresh and uncached). An unverified
  // key or Authorization header is anonymous and must not skip the caches.
  const privateRequest = admin;
  const key = process.env.TWELVE_KEY;
  if (!key) { sendApiError(res, 500, 'SERVICE_NOT_CONFIGURED', requestId); return; }
  try {
    const result = privateRequest
      ? await loadHistory(symbol, interval, requested, key)
      : await loadPublicHistory(symbol, interval, OUTPUT_BUCKETS.find((size) => size >= requested), key);
    if (result.status !== 200) {
      sendApiError(res, result.status, result.code, requestId, { upstreamStatus: result.upstreamStatus });
      return;
    }
    const data = { ...result.data, values: result.data.values.slice(0, requested) };
    if (!privateRequest) {
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
      res.setHeader('CDN-Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
      res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    }
    res.status(200).json(data);
  } catch (e) {
    sendApiError(res, isAbortError(e) ? 504 : 502, isAbortError(e) ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_FETCH', requestId);
  }
}
