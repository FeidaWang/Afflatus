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
  const symbol = typeof req.query?.symbol === 'string' ? req.query.symbol.trim().toUpperCase() : '';
  const interval = (req.query.interval || '').toString().trim();
  const outputsize = Math.min(5000, parseInt(req.query.outputsize, 10) || 100);
  if (!symbol || !SYMBOL_RE.test(symbol) || !/^[0-9a-z]{1,6}$/.test(interval)) { sendApiError(res, 400, 'INVALID_PARAMS', requestId); return; }
  const rl = checkRateLimit(hits, clientIp(req), { ...RATE_LIMIT, now: Date.now() });
  if (!rl.allowed) { res.setHeader('Retry-After', Math.ceil(rl.resetMs / 1000)); sendApiError(res, 429, 'RATE_LIMITED', requestId); return; }

  const allowlist = getPublishedArenaAllowlist();
  if (!isSymbolAllowed(symbol, allowlist)) {
    const adminKey = req.headers?.['x-arena-key'];
    if (!checkAdminKey(adminKey, process.env.ARENA_ADMIN_KEY)) {
      sendApiError(res, 403, 'ARENA_KEY_REQUIRED', requestId, { message: "symbol outside today's pool — admin unlock required" });
      return;
    }
  }

  const privateRequest = !isSymbolAllowed(symbol, allowlist) || req.headers?.['x-arena-key'] !== undefined || req.headers?.authorization !== undefined;
  const key = process.env.TWELVE_KEY;
  if (!key) { sendApiError(res, 500, 'SERVICE_NOT_CONFIGURED', requestId); return; }
  try {
    const u = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&outputsize=${outputsize}`;
    const r = await fetchWithTimeout(u, { headers: { Authorization: `apikey ${key}` } }, 7000);
    if (!r.ok) { sendApiError(res, 502, 'UPSTREAM_HTTP', requestId, { upstreamStatus: r.status }); return; }
    const j = await r.json();
    if (!j || j.status !== 'ok' || !Array.isArray(j.values)) { sendApiError(res, 502, 'UPSTREAM_SCHEMA', requestId); return; }
    // Project known market fields only; never forward arbitrary upstream metadata.
    const pick = (value, fields) => Object.fromEntries(fields.filter(field =>
      value && ['string', 'number'].includes(typeof value[field])).map(field => [field, value[field]]));
    const data = {
      status: 'ok',
      meta: pick(j.meta, ['symbol', 'interval', 'currency', 'exchange_timezone', 'exchange', 'mic_code', 'type']),
      values: j.values.map(value => pick(value, ['datetime', 'open', 'high', 'low', 'close', 'volume'])),
    };
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
