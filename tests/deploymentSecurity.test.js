import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import historyHandler from '../api/history.js';
import quoteHandler from '../api/quote.js';

const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
const quoteApi = readFileSync('api/quote.js', 'utf8');
const historyApi = readFileSync('api/history.js', 'utf8');

describe('deployment security policy', () => {
  it('applies baseline security headers to every route', () => {
    const globalRule = vercel.headers.find((rule) => rule.source === '/(.*)');
    const headers = Object.fromEntries(globalRule.headers.map(({ key, value }) => [key, value]));

    expect(headers).toMatchObject({
      'Content-Security-Policy': "base-uri 'self'; form-action 'self'; frame-ancestors 'self'; object-src 'none'",
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
    });
    expect(vercel.headers).toContainEqual({
      source: '/api/(.*)',
      headers: [{ key: 'X-Robots-Tag', value: 'noindex' }],
    });
  });

  it('uses deployment-bundled allowlists without trusting or fetching an inbound host', () => {
    for (const source of [quoteApi, historyApi]) {
      expect(source).toContain('getPublishedArenaAllowlist()');
      expect(source).not.toMatch(/req\.headers(?:\?\.)?\.host/);
      expect(source).not.toContain('/arena-picks.json');
      expect(source).not.toContain('/arena-quant-model.json');
      expect(source).toContain("req.method !== 'GET'");
    }
  });

  it.each([
    ['quote', quoteHandler],
    ['history', historyHandler],
  ])('rejects non-GET %s requests before upstream work', async (_name, handler) => {
    const headers = {};
    let body;
    const res = {
      setHeader: (key, value) => { headers[key] = value; },
      status: vi.fn(() => res),
      json: vi.fn((value) => { body = value; }),
    };

    await handler({ method: 'POST', headers: {}, query: {} }, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(headers).toMatchObject({ Allow: 'GET', 'Cache-Control': 'private, no-store' });
    expect(body.error.code).toBe('METHOD_NOT_ALLOWED');
  });
});
