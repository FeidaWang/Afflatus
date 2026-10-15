import { createHash } from 'node:crypto';
import { checkRateLimit, clientIp } from './rateLimit.js';
import { fetchWithTimeout, sendApiError } from './apiHttp.js';

// INCR and expiry must be atomic so racing/cold instances share the quota.
export const RATE_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {count, ttl}
`;

export async function enforceRateLimit(req, res, requestId, store, scope, options) {
  const env = process.env;
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  const ip = env.VERCEL ? (req.headers?.['x-vercel-forwarded-for'] || 'unknown').split(',')[0].trim() : clientIp(req);
  let result;
  try {
    if (!url && !token && !env.VERCEL && env.VERCEL_ENV !== 'production') {
      const now = options.now ?? Date.now();
      for (const [key, value] of store) if (now - value.start >= options.windowMs) store.delete(key);
      result = !store.has(ip) && store.size >= 10000
        ? { allowed: false, resetMs: options.windowMs }
        : checkRateLimit(store, ip, { ...options, now });
    } else {
      const endpoint = new URL(url);
      if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || !token) throw new Error();
      const key = `afflatus:rl:v1:${env.VERCEL_ENV || 'development'}:${scope}:${createHash('sha256').update(ip).digest('hex')}`;
      result = await fetchWithTimeout(endpoint.href, {
        method: 'POST', redirect: 'error',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(['EVAL', RATE_SCRIPT, '1', key, String(options.windowMs)]),
      }, 2000, async response => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        const [count, ttl] = Array.isArray(data.result) ? data.result : [];
        if (data.error || data.result.length !== 2 || !Number.isSafeInteger(count) || count < 1
          || !Number.isSafeInteger(ttl) || ttl <= 0 || ttl > options.windowMs) throw new Error();
        return { allowed: count <= options.limit, resetMs: ttl };
      });
    }
  } catch {
    res.setHeader('Retry-After', '5');
    sendApiError(res, 503, 'RATE_LIMIT_UNAVAILABLE', requestId);
    return false;
  }
  if (!result.allowed) {
    res.setHeader('Retry-After', String(Math.ceil(result.resetMs / 1000)));
    sendApiError(res, 429, 'RATE_LIMITED', requestId);
    return false;
  }
  return true;
}
