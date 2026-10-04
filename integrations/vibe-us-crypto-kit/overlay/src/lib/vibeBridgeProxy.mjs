import { randomUUID, timingSafeEqual } from 'node:crypto';

export const INSTRUMENT_IDS = new Set([
  'US:AAPL', 'US:MSFT', 'US:NVDA', 'US:MU', 'US:SPY', 'US:QQQ',
  'CRYPTO:OKX:BTC-USDT:SPOT', 'CRYPTO:OKX:ETH-USDT:SPOT', 'CRYPTO:OKX:SOL-USDT:SPOT',
]);
const allowedQuery = new Set(['instrument', 'start', 'end']);
const DAY = 86_400_000;

export function secretEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || b.length < 32) return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
function validDate(text) {
  if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const time = Date.parse(text);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === text;
}
export function parseQuery(query, now = Date.now()) {
  if (!query || Object.keys(query).some(k => !allowedQuery.has(k))) throw new Error('INVALID_QUERY');
  const { instrument, start, end } = query;
  if (typeof instrument !== 'string' || !INSTRUMENT_IDS.has(instrument)) throw new Error('INVALID_INSTRUMENT');
  if (!validDate(start) || !validDate(end)) throw new Error('INVALID_DATE');
  const span = (Date.parse(end) - Date.parse(start)) / DAY;
  if (span < 1 || span > 366 || Date.parse(end) > Math.floor(now / DAY) * DAY) throw new Error('INVALID_RANGE');
  return { instrument_id: instrument, start_date: start, end_date: end, interval: '1D' };
}
export function validateSeries(value, requestedId, request = null) {
  const crypto = requestedId.startsWith('CRYPTO:OKX:');
  const currency = crypto ? 'USDT' : 'USD';
  const market = crypto ? 'crypto_spot' : ['US:SPY', 'US:QQQ'].includes(requestedId) ? 'us_etf' : 'us_equity';
  const source = crypto ? 'okx' : 'yahoo';
  const p = value?.provenance;
  if (!value || value.schema_version !== 1 || value.instrument?.id !== requestedId ||
      value.instrument?.market !== market || value.instrument?.quote_currency !== currency ||
      !Array.isArray(value.bars) || !value.bars.length || value.bars.length > 400 ||
      p?.is_realtime_quote !== false || p?.source !== source || p?.quote_currency !== currency ||
      p?.fallback_used !== false || p?.interval !== '1D' || !validDate(p?.last_bar_date) ||
      typeof p?.observed_at !== 'string' || !Number.isFinite(Date.parse(p.observed_at))) return false;
  let previous = '';
  const valid = value.bars.every(row => {
    if (!row || !validDate(row.date) || row.date <= previous) return false;
    if (request && (row.date < request.start_date || row.date >= request.end_date)) return false;
    previous = row.date;
    if (!['open', 'high', 'low', 'close'].every(k => typeof row[k] === 'number' && Number.isFinite(row[k]) && row[k] > 0)) return false;
    if (row.volume !== null && !(typeof row.volume === 'number' && Number.isFinite(row.volume) && row.volume >= 0)) return false;
    return row.low <= Math.min(row.open, row.close) && Math.max(row.open, row.close) <= row.high;
  });
  return valid && p.last_bar_date === previous;
}
async function boundedJson(response) {
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('UPSTREAM_SCHEMA');
  const reader = response.body.getReader();
  const parts = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1_048_576) { await reader.cancel(); throw new Error('UPSTREAM_TOO_LARGE'); }
    parts.push(Buffer.from(value));
  }
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
}

export function createHandler({ env = process.env, fetchImpl = fetch, now = Date.now } = {}) {
  // Warm-instance budget only. The private bridge supplies the second cap.
  const calls = [];
  return async function handler(req, res) {
    const requestId = randomUUID();
    for (const [key, value] of Object.entries({
      'Cache-Control': 'private, no-store', 'CDN-Cache-Control': 'no-store',
      'Vercel-CDN-Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Vary': 'x-arena-key, Authorization', 'X-Request-Id': requestId,
    })) res.setHeader(key, value);
    const fail = (status, code) => res.status(status).json({ error: { code, requestId } });
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return fail(405, 'METHOD_NOT_ALLOWED'); }
    if (env.VIBE_FEATURE_ENABLED !== 'true') return fail(404, 'FEATURE_DISABLED');
    let body;
    try { body = parseQuery(req.query, now()); } catch (error) { return fail(400, error.message); }
    const privateAllowed = secretEqual(req.headers?.['x-arena-key'], env.ARENA_ADMIN_KEY);
    const publicIds = new Set((env.VIBE_PUBLIC_INSTRUMENTS || '').split(',').map(x => x.trim()).filter(Boolean));
    const publicAllowed = env.VIBE_ENABLE_PUBLIC_MARKET_DATA === 'true' &&
      env.VIBE_PUBLIC_DATA_RIGHTS_ACK === 'APPROVED' && publicIds.has(body.instrument_id);
    if (!privateAllowed && !publicAllowed) return fail(403, 'PRIVATE_RESEARCH_ONLY');
    let upstream;
    try {
      upstream = new URL(env.VIBE_BRIDGE_URL);
      const local = env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1', '[::1]'].includes(upstream.hostname);
      if (upstream.protocol !== 'https:' && !(local && upstream.protocol === 'http:')) throw new Error();
      if (upstream.username || upstream.password || upstream.search || upstream.hash) throw new Error();
      if (!env.VIBE_BRIDGE_TOKEN || env.VIBE_BRIDGE_TOKEN.length < 32) throw new Error();
      upstream = new URL('/v1/bars', upstream.origin);
    } catch { return fail(503, 'SERVICE_NOT_CONFIGURED'); }
    const current = now();
    while (calls.length && calls[0] <= current - 60_000) calls.shift();
    if (calls.length >= 30) { res.setHeader('Retry-After', '60'); return fail(429, 'QUOTA_LIMIT'); }
    calls.push(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 24_000);
    try {
      const response = await fetchImpl(upstream.href, {
        method: 'POST', redirect: 'error', signal: controller.signal,
        headers: { 'Authorization': `Bearer ${env.VIBE_BRIDGE_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) return fail(response.status === 429 ? 429 : 503, response.status === 429 ? 'SERVICE_BUSY' : 'SOURCE_UNAVAILABLE');
      const result = await boundedJson(response);
      if (!validateSeries(result, body.instrument_id, body)) return fail(502, 'UPSTREAM_SCHEMA');
      return res.status(200).json(result);
    } catch (error) {
      return fail(controller.signal.aborted ? 504 : 502, controller.signal.aborted ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_FETCH');
    } finally { clearTimeout(timer); }
  };
}
