import { randomUUID, timingSafeEqual } from 'node:crypto';

import { INSTRUMENT_IDS, parseQuery, validateSeries, projectSeries } from './vibeMarketContract.js';
import { parseResearchQuery, validateResearch, projectResearch } from './vibeResearchContract.js';
export { INSTRUMENT_IDS, parseQuery, validateSeries };
export function secretEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || b.length < 32) return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
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

export function createHandler({ env = process.env, fetchImpl = fetch, now = Date.now, research = false, calls = [] } = {}) {
  // Warm-instance budget only. The private bridge supplies the second cap.
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
    try { body = (research ? parseResearchQuery : parseQuery)(req.query, now()); } catch (error) { return fail(400, error.message); }
    const privateAllowed = secretEqual(req.headers?.['x-arena-key'], env.ARENA_ADMIN_KEY);
    const publicIds = new Set((env.VIBE_PUBLIC_INSTRUMENTS || '').split(',').map(x => x.trim()).filter(Boolean));
    const publicAllowed = !research && env.VIBE_ENABLE_PUBLIC_MARKET_DATA === 'true' &&
      env.VIBE_PUBLIC_DATA_RIGHTS_ACK === 'APPROVED' && publicIds.has(body.instrument_id);
    if (!privateAllowed && !publicAllowed) return fail(403, 'PRIVATE_RESEARCH_ONLY');
    let upstream;
    try {
      upstream = new URL(env.VIBE_BRIDGE_URL);
      const local = env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1', '[::1]'].includes(upstream.hostname);
      if (upstream.protocol !== 'https:' && !(local && upstream.protocol === 'http:')) throw new Error();
      if (upstream.username || upstream.password || upstream.search || upstream.hash) throw new Error();
      if (!env.VIBE_BRIDGE_TOKEN || env.VIBE_BRIDGE_TOKEN.length < 32) throw new Error();
      upstream = new URL(research ? '/v1/research' : '/v1/bars', upstream.origin);
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
      if (!(research ? validateResearch(result, body) : validateSeries(result, body.instrument_id, body))) return fail(502, 'UPSTREAM_SCHEMA');
      return res.status(200).json(research ? projectResearch(result) : projectSeries(result));
    } catch (error) {
      return fail(controller.signal.aborted ? 504 : 502, controller.signal.aborted ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_FETCH');
    } finally { clearTimeout(timer); }
  };
}
