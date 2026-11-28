import { boundedFetch, FeedError } from './bounded-fetch.mjs';

const KEY_PREFIX = 'afflatus:elections:v1:';
const REPLACE_IF_CURRENT = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
return 1
`;

export function redisSnapshotStore(url, token) {
  const endpoint = URL.parse(url);
  if (!endpoint || endpoint.protocol !== 'https:' || !endpoint.host.endsWith('.upstash.io') ||
      endpoint.username || endpoint.password || endpoint.pathname !== '/' || endpoint.search || endpoint.hash || !token) {
    throw new Error('An Upstash Redis REST URL and token are required for election snapshots');
  }

  async function command(args, maxBytes, fetchImpl) {
    const { bytes } = await boundedFetch(endpoint, {
      allowedHosts: [endpoint.host], timeoutMs: 15000, maxBytes, fetchImpl,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    const reply = JSON.parse(bytes.toString('utf8'));
    if (reply.error || !Object.hasOwn(reply, 'result')) throw new FeedError('http_error', 'Election snapshot storage rejected the request');
    return reply.result;
  }

  return {
    async get(path, { maxBytes, fetchImpl }) {
      const value = await command(['GET', KEY_PREFIX + path], 2 * maxBytes + 1024, fetchImpl);
      if (value === null) throw new FeedError('gone', 'Election snapshot not found');
      if (typeof value !== 'string') throw new Error('Invalid election snapshot storage value');
      const bytes = Buffer.from(value);
      if (bytes.length > maxBytes) throw new FeedError('too_large', 'Election snapshot exceeds the size limit');
      // The exact stored pointer is the compare-and-set token. Snapshots are immutable.
      return { bytes, etag: value };
    },
    async put(path, body, condition, fetchImpl) {
      const key = KEY_PREFIX + path;
      if (condition['If-None-Match'] === '*') {
        const result = await command(['SET', key, body, 'NX'], 1024, fetchImpl);
        if (result === null || result === 'OK') return result === 'OK';
      } else if (condition['If-Match']) {
        const result = await command(['EVAL', REPLACE_IF_CURRENT, '1', key, condition['If-Match'], body], 1024, fetchImpl);
        if (result === 0 || result === 1) return result === 1;
      }
      throw new Error('Invalid conditional election snapshot write');
    },
  };
}
