import { randomUUID } from 'node:crypto';
import { secretEqual } from './vibeBridgeProxy.mjs';
import { parseQuantRequest, validateQuantJob, projectQuantJob } from './vibeQuantContract.js';

export function createQuantHandler({ env = process.env, fetchImpl = fetch, now = Date.now, calls = [], reads = [] } = {}) {
  return async function handler(req, res) {
    const requestId = randomUUID();
    for (const [key, value] of Object.entries({ 'Cache-Control': 'private, no-store', 'CDN-Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'x-arena-key, Authorization', 'X-Request-Id': requestId })) res.setHeader(key, value);
    const fail = (status, code) => res.status(status).json({ error: { code, requestId } });
    if (!['POST', 'GET', 'DELETE'].includes(req.method)) { res.setHeader('Allow', 'POST, GET, DELETE'); return fail(405, 'METHOD_NOT_ALLOWED'); }
    if (env.VIBE_FEATURE_ENABLED !== 'true' || env.VIBE_QUANT_ENABLED !== 'true') return fail(404, 'FEATURE_DISABLED');
    if (!secretEqual(req.headers?.['x-arena-key'], env.ARENA_ADMIN_KEY)) return fail(403, 'PRIVATE_RESEARCH_ONLY');
    let body, identifier, upstream;
    try {
      if (req.method === 'POST') {
        if (Object.keys(req.query || {}).length) throw new Error('INVALID_REQUEST');
        if (!req.headers?.['content-type']?.startsWith('application/json') || Buffer.byteLength(JSON.stringify(req.body) || '') > 32768) throw new Error('INVALID_REQUEST');
        body = parseQuantRequest(req.body, now());
      } else {
        if (Object.keys(req.query || {}).length !== 1 || typeof req.query.id !== 'string' || !/^[0-9a-f]{32}$/.test(req.query.id)) throw new Error('INVALID_JOB');
        identifier = req.query.id;
      }
    } catch (error) { return fail(400, error.message); }
    try {
      const base = new URL(env.VIBE_BRIDGE_URL);
      const local = env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
      if ((base.protocol !== 'https:' && !(local && base.protocol === 'http:')) || base.username || base.password || base.search || base.hash || !env.VIBE_BRIDGE_TOKEN || env.VIBE_BRIDGE_TOKEN.length < 32) throw new Error();
      upstream = new URL(`/v1/quant/jobs${identifier ? '/' + identifier : ''}`, base.origin);
    } catch { return fail(503, 'SERVICE_NOT_CONFIGURED'); }
    const budget = req.method === 'POST' ? calls : reads, limit = req.method === 'POST' ? 6 : 120;
    while (budget.length && budget[0] <= now() - 60000) budget.shift();
    if (budget.length >= limit) { res.setHeader('Retry-After', '60'); return fail(429, 'QUOTA_LIMIT'); }
    budget.push(now());
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetchImpl(upstream.href, { method: req.method, redirect: 'error', signal: controller.signal, headers: { Authorization: `Bearer ${env.VIBE_BRIDGE_TOKEN}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      if (!response.ok) return fail([403, 404, 429].includes(response.status) ? response.status : 503, response.status === 429 ? 'SERVICE_BUSY' : response.status === 404 ? 'JOB_NOT_FOUND' : 'SOURCE_UNAVAILABLE');
      if (!response.headers.get('content-type')?.includes('application/json')) return fail(502, 'UPSTREAM_SCHEMA');
      const reader = response.body.getReader(); let size = 0; const parts = [];
      while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 1048576) { await reader.cancel(); return fail(502, 'UPSTREAM_TOO_LARGE'); } parts.push(Buffer.from(value)); }
      const result = JSON.parse(Buffer.concat(parts).toString('utf8'));
      if (!validateQuantJob(result) || (identifier && result.id !== identifier) || (body && (result.module !== body.module || result.instrument_id !== body.instrument_id))) return fail(502, 'UPSTREAM_SCHEMA');
      return res.status(req.method === 'POST' ? 202 : 200).json(projectQuantJob(result));
    } catch { return fail(controller.signal.aborted ? 504 : 502, controller.signal.aborted ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_FETCH'); }
    finally { clearTimeout(timer); }
  };
}
