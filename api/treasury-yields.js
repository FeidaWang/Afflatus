/* Fixed-scope proxy for the 10Y and 30Y U.S. Treasury yield dashboard.
   CNBC's quote cache exposes Tradeweb yield quotes without a client key. The
   browser only calls this same-origin endpoint, so the upstream can be changed
   without coupling the Signal page to a third-party response shape. */
import { checkRateLimit, clientIp } from '../src/lib/rateLimit.js';
import { fetchWithTimeout, getRequestId, isAbortError, sendApiError, setApiHeaders } from '../src/lib/apiHttp.js';

const UPSTREAM_URL = 'https://quote.cnbc.com/quote-html-webservice/quote.htm?symbols=US10Y%7CUS30Y&output=json';
const RATE_LIMIT = { limit: 45, windowMs: 60000 };
const hits = new Map();

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normaliseQuote(quote) {
  const value = finite(quote?.last);
  const previousClose = finite(quote?.previous_day_closing);
  if (!quote || !['US10Y', 'US30Y'].includes(quote.symbol) || value == null || previousClose == null) return null;

  const tenor = quote.symbol === 'US10Y' ? '10Y' : '30Y';
  const change = finite(quote.change) ?? (value - previousClose);
  const asOfMs = finite(quote.last_time_msec);
  return {
    tenor,
    symbol: quote.symbol,
    value,
    changeBps: Number((change * 100).toFixed(1)),
    changePct: finite(quote.change_pct),
    open: finite(quote.open),
    high: finite(quote.high),
    low: finite(quote.low),
    previousClose,
    asOf: asOfMs == null ? null : new Date(asOfMs).toISOString(),
  };
}

export default async function handler(req, res) {
  const requestId = getRequestId(req);
  setApiHeaders(res, requestId);
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    sendApiError(res, 405, 'METHOD_NOT_ALLOWED', requestId);
    return;
  }

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
  if (!rl.allowed) {
    res.setHeader('Retry-After', Math.ceil(rl.resetMs / 1000));
    sendApiError(res, 429, 'RATE_LIMITED', requestId);
    return;
  }

  try {
    // Read the body inside the deadline so a stalled upstream body times out.
    const upstream = await fetchWithTimeout(UPSTREAM_URL, {
      headers: { Accept: 'application/json', 'User-Agent': 'Afflatus-Signal/1.0' },
    }, 6000, async (response) => (response.ok ? { ok: true, raw: await response.json() } : { ok: false, status: response.status }));
    if (!upstream.ok) {
      sendApiError(res, 502, 'UPSTREAM_HTTP', requestId, { upstreamStatus: upstream.status });
      return;
    }

    const { raw } = upstream;
    const quotes = raw?.QuickQuoteResult?.QuickQuote;
    const yields = Array.isArray(quotes) ? quotes.map(normaliseQuote).filter(Boolean) : [];
    yields.sort((a, b) => Number.parseInt(a.tenor, 10) - Number.parseInt(b.tenor, 10));
    if (yields.length !== 2 || yields[0].tenor !== '10Y' || yields[1].tenor !== '30Y') {
      sendApiError(res, 502, 'UPSTREAM_SCHEMA', requestId);
      return;
    }

    const sourceQuote = quotes.find((quote) => quote?.symbol === 'US10Y') || quotes[0];
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=45');
    res.status(200).json({
      yields,
      spread30s10sBps: Number(((yields[1].value - yields[0].value) * 100).toFixed(1)),
      marketStatus: sourceQuote.curmktstatus || 'UNKNOWN',
      source: {
        provider: sourceQuote.provider || 'CNBC Quote Cache',
        venue: sourceQuote.exchange || 'Tradeweb',
        realTime: String(sourceQuote.realTime).toLowerCase() === 'true',
      },
    });
  } catch (error) {
    sendApiError(res, isAbortError(error) ? 504 : 502, isAbortError(error) ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_FETCH', requestId);
  }
}
