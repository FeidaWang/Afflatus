import { afterEach, describe, expect, it, vi } from 'vitest';
import { enforceRateLimit } from '../src/lib/distributedRateLimit.js';

const options = { limit: 2, windowMs: 60000 };
function response() {
  const res = { setHeader: vi.fn(), json: vi.fn() };
  res.status = vi.fn(() => res);
  return res;
}
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
function configured() {
  vi.stubEnv('VERCEL', '1');
  vi.stubEnv('VERCEL_ENV', 'production');
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example.test');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token');
}
describe('distributed quotas', () => {
  it('shares an atomic counter across independent instance stores and hashes trusted IPs', async () => {
    configured();
    let count = 0;
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ result: [++count, 59000] }) }));
    vi.stubGlobal('fetch', fetch);
    const req = { headers: { 'x-vercel-forwarded-for': '1.2.3.4', 'x-forwarded-for': 'spoofed' } };
    const results = await Promise.all(Array.from({ length: 3 }, () => enforceRateLimit(req, response(), 'request-id', new Map(), 'model:ip', options)));
    expect(results).toEqual([true, true, false]);
    const bodies = fetch.mock.calls.map(([, init]) => JSON.parse(init.body));
    expect(new Set(bodies.map(body => body[3])).size).toBe(1);
    expect(bodies[0][0]).toBe('EVAL');
    expect(bodies[0][1]).toContain('PEXPIRE');
    expect(bodies[0][3]).not.toContain('1.2.3.4');
  });
  it.each(['missing', 'timeout', 'error', 'malformed'])('fails closed on %s without using the local map', async mode => {
    configured();
    if (mode === 'missing') vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (mode === 'timeout') throw new Error('secret must not leak');
      return { ok: true, json: async () => mode === 'error' ? { error: 'secret' } : { result: [1, -1] } };
    }));
    const res = response();
    const store = new Map();
    expect(await enforceRateLimit({ headers: {} }, res, 'request-id', store, 'quote:ip', options)).toBe(false);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: 'RATE_LIMIT_UNAVAILABLE' }) }));
    expect(store.size).toBe(0);
  });
  it('returns Retry-After for a full window', async () => {
    configured();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ result: [3, 59999] }) })));
    const res = response();
    expect(await enforceRateLimit({ headers: {} }, res, 'request-id', new Map(), 'quote:ip', options)).toBe(false);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '60');
  });
});
