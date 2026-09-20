/* Finnhub research quote proxy. Anonymous symbols come only from the deployed
   public allowlist; other symbols require ARENA_ADMIN_KEY (a shared quota gate,
   not individual user identity). Credentialed responses are never cached.
   Keeps the legacy c/pc/o/h/l/t/d/dp shape, with strict numeric validation. */
import { checkRateLimit, clientIp } from '../src/lib/rateLimit.js';
import { isSymbolAllowed, checkAdminKey } from '../src/lib/arenaAccess.js';
import { getPublishedArenaAllowlist } from '../src/lib/arenaPublishedAccess.js';
import { fetchWithTimeout, getRequestId, isAbortError, sendApiError, setApiHeaders } from '../src/lib/apiHttp.js';
import { validateQuote, quoteCompatibilityPayload } from '../src/lib/validateQuote.js';

const SYMBOL_RE = /^[A-Z]{1,5}([.\-][A-Z]{1,2})?$/;
const RATE_LIMIT = { limit: 60, windowMs: 60_000 };
const hits = new Map();
const publicCache = new Map();
const inflight = new Map();
// Per warm instance only, NOT an account-wide or distributed quota guarantee.
// Count actual upstream calls (including failures), not coalesced consumers.
const providerCalls = [];
const PUBLIC_TTL_MS = 12_000;
let cooldownUntil = 0;

function providerRetrySeconds(now) {
  while (providerCalls.length && providerCalls[0] <= now - 60_000) providerCalls.shift();
  const reset = Math.max(cooldownUntil, providerCalls.length >= 60 ? providerCalls[0] + 60_000 : 0);
  return Math.max(0, Math.ceil((reset - now) / 1000));
}

async function loadQuote(symbol, key) {
  const retryAfter = providerRetrySeconds(Date.now());
  if (retryAfter) return { status: 429, code: 'PROVIDER_RATE_LIMITED', retryAfter };
  providerCalls.push(Date.now());
  return fetchWithTimeout(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}`, {
    headers: { 'X-Finnhub-Token': key },
  }, 5000, async response => {
    if (response.status === 429) {
      const raw = response.headers?.get('retry-after');
      const seconds = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : Math.ceil((Date.parse(raw) - Date.now()) / 1000);
      const retry = Number.isFinite(seconds) && seconds > 0 ? Math.min(3600, seconds) : 60;
      cooldownUntil = Math.max(cooldownUntil, Date.now() + retry * 1000);
      return { status: 429, code: 'PROVIDER_RATE_LIMITED', retryAfter: retry };
    }
    if (!response.ok) return { status: 502, code: 'UPSTREAM_HTTP', upstreamStatus: response.status };
    const raw = await response.json();
    if (!validateQuote(raw).ok) return { status: 502, code: 'UPSTREAM_SCHEMA' };
    return { status: 200, data: quoteCompatibilityPayload(raw) };
  });
}

export default async function handler(req, res) {
  const requestId = getRequestId(req);
  setApiHeaders(res, requestId);
  // Set the safe policy before every early return. Vary prevents an anonymous
  // public CDN hit from bypassing credentialed request handling for that URL.
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
  if (!SYMBOL_RE.test(symbol)) { sendApiError(res, 400, 'INVALID_SYMBOL', requestId); return; }
  const now = Date.now();
  // Bound expired per-IP entries in the existing process-local limiter.
  for (const [ip, entry] of hits) if (now - entry.start >= RATE_LIMIT.windowMs) hits.delete(ip);
  const ip = clientIp(req);
  if (!hits.has(ip) && hits.size >= 10_000) {
    res.setHeader('Retry-After', '60');
    sendApiError(res, 429, 'RATE_LIMITED', requestId);
    return;
  }
  const rl = checkRateLimit(hits, ip, { ...RATE_LIMIT, now });
  if (!rl.allowed) { res.setHeader('Retry-After', Math.ceil(rl.resetMs / 1000)); sendApiError(res, 429, 'RATE_LIMITED', requestId); return; }

  const allowlist = getPublishedArenaAllowlist();
  const publicSymbol = isSymbolAllowed(symbol, allowlist);
  if (!publicSymbol && !checkAdminKey(req.headers?.['x-arena-key'], process.env.ARENA_ADMIN_KEY)) {
    sendApiError(res, 403, 'ARENA_KEY_REQUIRED', requestId, { message: "symbol outside today's pool — admin unlock required" });
    return;
  }
  const privateRequest = !publicSymbol || req.headers?.['x-arena-key'] !== undefined || req.headers?.authorization !== undefined;
  const key = process.env.FINNHUB_KEY;
  if (!key) { sendApiError(res, 500, 'SERVICE_NOT_CONFIGURED', requestId); return; }
  try {
    let result;
    if (privateRequest) {
      result = await loadQuote(symbol, key);
    } else {
      for (const [ticker, entry] of publicCache) if (entry.expiresAt <= now) publicCache.delete(ticker);
      const cached = publicCache.get(symbol);
      if (cached && validateQuote(cached.result.data, now).ok) result = cached.result;
      else {
        if (!inflight.has(symbol)) {
          const pending = loadQuote(symbol, key).then(value => {
            if (value.status === 200) publicCache.set(symbol, { result: value, expiresAt: Date.now() + PUBLIC_TTL_MS });
            return value;
          }).finally(() => inflight.delete(symbol));
          inflight.set(symbol, pending);
        }
        result = await inflight.get(symbol);
      }
    }
    if (result.status !== 200) {
      if (result.retryAfter) res.setHeader('Retry-After', result.retryAfter);
      sendApiError(res, result.status, result.code, requestId, { upstreamStatus: result.upstreamStatus });
      return;
    }
    if (!privateRequest) {
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=12, stale-while-revalidate=24');
      res.setHeader('CDN-Cache-Control', 'public, s-maxage=12, stale-while-revalidate=24');
      res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=12, stale-while-revalidate=24');
    }
    res.status(200).json(result.data);
  } catch (error) {
    sendApiError(res, isAbortError(error) ? 504 : 502, isAbortError(error) ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_FETCH', requestId);
  }
}
