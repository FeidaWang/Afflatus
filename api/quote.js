/* Vercel serverless proxy for Finnhub real-time quotes.
   Keeps the API key server-side (set FINNHUB_KEY in Vercel → Project → Settings →
   Environment Variables). The browser calls /api/quote?symbol=NVDA — no key ever
   reaches the client. Returns the raw Finnhub quote shape { c, pc, o, h, l, ... }.

   D1 (2026-07-04): tightened the symbol shape to a real-ticker pattern (was an
   open `.{1,12}` proxy) and added a per-IP rate limit — this endpoint has no
   auth and the free-tier Finnhub quota is shared across every site visitor.
   V13 lets users load ANY US ticker (not just the Arena watchlist), so this is
   deliberately NOT a fixed symbol whitelist — see ROADMAP §1 D1 for why.

   Part 4 (urgent.md §18.4/§20, 2026-07-23; QF-01 extension 2026-08-05):
   a symbol outside the explicit public research allowlist (today's picks plus
   Q-Foundry's manifest universe) now requires an `x-arena-key`
   header matching ARENA_ADMIN_KEY (Vercel env var) — a quota gate, not real
   auth. Set ARENA_ADMIN_KEY in Vercel → Project → Settings → Environment
   Variables to enable admin unlock; until it's set, checkAdminKey() fails
   closed for everyone (the allowlist-permitted symbols are unaffected
   either way). */
import { checkRateLimit, clientIp } from '../src/lib/rateLimit.js';
import { isSymbolAllowed, checkAdminKey } from '../src/lib/arenaAccess.js';
import { getPublishedArenaAllowlist } from '../src/lib/arenaPublishedAccess.js';
import { fetchWithTimeout, getRequestId, isAbortError, sendApiError, setApiHeaders } from '../src/lib/apiHttp.js';

const SYMBOL_RE = /^[A-Za-z]{1,5}([.\-][A-Za-z]{1,2})?$/;
const RATE_LIMIT = { limit: 60, windowMs: 60000 };
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
  if (!symbol || !SYMBOL_RE.test(symbol)) { sendApiError(res, 400, 'INVALID_SYMBOL', requestId); return; }
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

  const key = process.env.FINNHUB_KEY;
  if (!key) { sendApiError(res, 500, 'SERVICE_NOT_CONFIGURED', requestId); return; }
  try {
    const r = await fetchWithTimeout(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`, {}, 5000);
    if (!r.ok) { sendApiError(res, 502, 'UPSTREAM_HTTP', requestId, { upstreamStatus: r.status }); return; }
    const q = await r.json();
    if (!q || !Number.isFinite(Number(q.c))) { sendApiError(res, 502, 'UPSTREAM_SCHEMA', requestId); return; }
    res.setHeader('Cache-Control', 's-maxage=12, stale-while-revalidate=24');
    res.status(200).json(q);
  } catch (e) {
    sendApiError(res, isAbortError(e) ? 504 : 502, isAbortError(e) ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_FETCH', requestId);
  }
}
