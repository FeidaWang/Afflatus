import { createHash, timingSafeEqual } from 'node:crypto';

export class ArenaError extends Error {
  constructor(code, message = code, status = 400, details = undefined) {
    super(message); this.name = 'ArenaError'; this.code = code; this.status = status; this.details = details;
  }
}
export const clone = value => structuredClone(value);
export const iso = value => new Date(value).toISOString();
export function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
}
export const hash = value => createHash('sha256').update(canonical(value)).digest('hex');
export function secretMatches(header, secret) {
  if (!secret || secret.length < 24 || typeof header !== 'string') return false;
  const a = createHash('sha256').update(header).digest();
  const b = createHash('sha256').update(`Bearer ${secret}`).digest();
  return timingSafeEqual(a, b);
}
export function assert(condition, code, message = code, status = 400) {
  if (!condition) throw new ArenaError(code, message, status);
}
export function boundedNumber(value, fallback, min, max) {
  if (value === undefined || value === '') return fallback;
  const n = Number(value); assert(Number.isFinite(n) && n >= min && n <= max, 'INVALID_CONFIG'); return n;
}
export function symbol(value) {
  const result = String(value || '').toUpperCase().trim();
  assert(/^[A-Z][A-Z0-9.\-]{0,9}$/.test(result), 'INVALID_SYMBOL'); return result;
}
export function record(value, name = 'payload') {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'INVALID_PAYLOAD', `${name} must be an object`); return value;
}
export async function fetchJSON(url, {fetcher = fetch, timeoutMs = 12000, maxBytes = 2_000_000, ...options} = {}) {
  const response = await fetcher(url, {...options, redirect: 'error', signal: AbortSignal.timeout(timeoutMs)});
  if (!response.ok) throw new ArenaError('PROVIDER_HTTP_ERROR', `Provider returned HTTP ${response.status}`, 502, {providerStatus: response.status});
  const reader = response.body?.getReader();
  let text = '';
  if (reader) {
    const decoder = new TextDecoder(); let total = 0;
    try {
      for (;;) {
        const {done, value} = await reader.read(); if (done) break;
        total += value.byteLength;
        assert(total <= maxBytes, 'PROVIDER_RESPONSE_TOO_LARGE', 'Provider response exceeds limit', 502);
        text += decoder.decode(value, {stream: true});
      }
      text += decoder.decode();
    } finally { await reader.cancel().catch(() => {}); }
  } else text = await response.text();
  try { return JSON.parse(text); } catch { throw new ArenaError('PROVIDER_INVALID_JSON', 'Provider returned invalid JSON', 502); }
}
