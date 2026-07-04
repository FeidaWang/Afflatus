import { describe, it, expect } from 'vitest';
import { checkRateLimit, clientIp } from '../src/lib/rateLimit.js';

describe('checkRateLimit', () => {
  it('allows requests up to the limit within a window', () => {
    const store = new Map();
    for (let i = 1; i <= 5; i++) {
      const r = checkRateLimit(store, 'ip1', { limit: 5, windowMs: 60000, now: 1000 + i });
      expect(r.allowed).toBe(true);
    }
  });
  it('blocks once the count exceeds the limit', () => {
    const store = new Map();
    for (let i = 1; i <= 5; i++) checkRateLimit(store, 'ip1', { limit: 5, windowMs: 60000, now: 1000 + i });
    const r = checkRateLimit(store, 'ip1', { limit: 5, windowMs: 60000, now: 1010 });
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });
  it('resets the window once windowMs has elapsed', () => {
    const store = new Map();
    for (let i = 1; i <= 5; i++) checkRateLimit(store, 'ip1', { limit: 5, windowMs: 60000, now: 1000 + i });
    const r = checkRateLimit(store, 'ip1', { limit: 5, windowMs: 60000, now: 1000 + 60001 });
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(4);
  });
  it('tracks separate keys independently', () => {
    const store = new Map();
    for (let i = 0; i < 5; i++) checkRateLimit(store, 'ipA', { limit: 5, windowMs: 60000, now: 1000 });
    const r = checkRateLimit(store, 'ipB', { limit: 5, windowMs: 60000, now: 1000 });
    expect(r.allowed).toBe(true);
  });
});

describe('clientIp', () => {
  it('takes the first address from x-forwarded-for', () => {
    expect(clientIp({ headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } })).toBe('1.2.3.4');
  });
  it('falls back to socket.remoteAddress, then "unknown"', () => {
    expect(clientIp({ headers: {}, socket: { remoteAddress: '9.9.9.9' } })).toBe('9.9.9.9');
    expect(clientIp({ headers: {} })).toBe('unknown');
  });
});
