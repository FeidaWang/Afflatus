/* Vercel serverless proxy for Twelve Data historical candles.
   Keeps the API key server-side (set TWELVE_KEY in Vercel env vars). The browser
   calls /api/history?symbol=NVDA&interval=1day&outputsize=120 — no key on client.
   Returns the raw Twelve Data time_series JSON { status, values:[...] }.

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
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    sendApiError(res, 405, 'METHOD_NOT_ALLOWED', requestId);
    return;
  }
  const symbol = (req.query.symbol || '').toString().trim();
  const interval = (req.query.interval || '').toString().trim();
  const outputsize = Math.min(5000, parseInt(req.query.outputsize, 10) || 100);
  if (!symbol || !SYMBOL_RE.test(symbol) || !/^[0-9a-z]{1,6}$/.test(interval)) { sendApiError(res, 400, 'INVALID_PARAMS', requestId); return; }
  const rl = checkRateLimit(hits, clientIp(req), { ...RATE_LIMIT, now: Date.now() });
  if (!rl.allowed) { res.setHeader('Retry-After', Math.ceil(rl.resetMs / 1000)); sendApiError(res, 429, 'RATE_LIMITED', requestId); return; }

  const allowlist = getPublishedArenaAllowlist();
  if (!isSymbolAllowed(symbol, allowlist)) {
    const adminKey = (req.headers?.['x-arena-key'] || '').toString();
    if (!checkAdminKey(adminKey, process.env.ARENA_ADMIN_KEY)) {
      sendApiError(res, 403, 'ARENA_KEY_REQUIRED', requestId, { message: "symbol outside today's pool — admin unlock required" });
      return;
    }
  }

  const key = process.env.TWELVE_KEY;
  if (!key) { sendApiError(res, 500, 'SERVICE_NOT_CONFIGURED', requestId); return; }
  try {
    const u = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&outputsize=${outputsize}&apikey=${key}`;
    const r = await fetchWithTimeout(u, {}, 7000);
    if (!r.ok) { sendApiError(res, 502, 'UPSTREAM_HTTP', requestId, { upstreamStatus: r.status }); return; }
    const j = await r.json();
    if (!j || j.status !== 'ok' || !Array.isArray(j.values)) { sendApiError(res, 502, 'UPSTREAM_SCHEMA', requestId); return; }
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json(j);
  } catch (e) {
    sendApiError(res, isAbortError(e) ? 504 : 502, isAbortError(e) ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_FETCH', requestId);
  }
}
