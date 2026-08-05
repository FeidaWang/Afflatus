import { describe, expect, it, vi } from 'vitest';
import { fetchWithTimeout, getRequestId, sendApiError, setApiHeaders, trustedSiteOrigin } from '../src/lib/apiHttp.js';

describe('API HTTP helpers', () => {
  it('keeps a safe caller request id and rejects unsafe values', () => {
    expect(getRequestId({ headers: { 'x-request-id': 'edge:abc-1234' } })).toBe('edge:abc-1234');
    expect(getRequestId({ headers: { 'x-request-id': 'bad\nheader' } })).toMatch(/^[-a-z0-9]+/i);
  });

  it('uses only platform-owned deployment origins for internal data fetches', () => {
    expect(trustedSiteOrigin({ VERCEL_URL: 'afflatus-git-main-feida.vercel.app' }))
      .toBe('https://afflatus-git-main-feida.vercel.app');
    expect(trustedSiteOrigin({ VERCEL_URL: 'evil.example' })).toBe('https://feida.au');
    expect(trustedSiteOrigin({ VERCEL_URL: 'evil.example@afflatus.vercel.app' })).toBe('https://feida.au');
    expect(trustedSiteOrigin({})).toBe('https://feida.au');
  });

  it('emits normalized non-cacheable errors with correlation id', () => {
    const headers = {};
    let body;
    const res = {
      setHeader: (key, value) => { headers[key] = value; },
      status: vi.fn(() => res),
      json: vi.fn((value) => { body = value; }),
    };
    setApiHeaders(res, 'req-12345678');
    sendApiError(res, 502, 'UPSTREAM_HTTP', 'req-12345678', { upstreamStatus: 503 });
    expect(headers).toMatchObject({
      'X-Request-Id': 'req-12345678',
      'Cache-Control': 'private, no-store',
    });
    expect(res.status).toHaveBeenCalledWith(502);
    expect(body).toEqual({
      error: { code: 'UPSTREAM_HTTP', message: 'UPSTREAM_HTTP', upstreamStatus: 503 },
      requestId: 'req-12345678',
    });
  });

  it('aborts an upstream request at the configured timeout', async () => {
    const network = vi.fn((url, init) => new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));
    vi.stubGlobal('fetch', network);
    await expect(fetchWithTimeout('https://example.test', {}, 5)).rejects.toMatchObject({ name: 'AbortError' });
    vi.unstubAllGlobals();
  });
});
