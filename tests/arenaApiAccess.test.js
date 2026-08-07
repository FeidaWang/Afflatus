import { afterEach, describe, expect, it, vi } from 'vitest';
import historyHandler from '../api/history.js';
import quoteHandler from '../api/quote.js';

function responseRecorder() {
  const headers = {};
  let status;
  let body;
  const res = {
    setHeader: (key, value) => { headers[key] = value; },
    status: vi.fn((value) => { status = value; return res; }),
    json: vi.fn((value) => { body = value; }),
  };
  return { res, read: () => ({ headers, status, body }) };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Arena API access gate', () => {
  it('lets a deployed picks symbol reach the quote provider without an admin key', async () => {
    vi.stubEnv('FINNHUB_KEY', 'test-finnhub-key');
    const upstream = vi.fn(async () => ({ ok: true, json: async () => ({ c: 123.45, pc: 122 }) }));
    vi.stubGlobal('fetch', upstream);
    const recorder = responseRecorder();

    await quoteHandler({
      method: 'GET',
      headers: { 'x-forwarded-for': '192.0.2.11' },
      query: { symbol: 'WAB' },
    }, recorder.res);

    expect(recorder.read().status).toBe(200);
    expect(recorder.read().body.c).toBe(123.45);
    expect(upstream).toHaveBeenCalledOnce();
    expect(upstream.mock.calls[0][0]).toContain('symbol=WAB');
  });

  it('lets the deployed benchmark reach the history provider without an admin key', async () => {
    vi.stubEnv('TWELVE_KEY', 'test-twelve-key');
    const values = [{ datetime: '2026-08-06', close: '100.00' }];
    const upstream = vi.fn(async () => ({ ok: true, json: async () => ({ status: 'ok', values }) }));
    vi.stubGlobal('fetch', upstream);
    const recorder = responseRecorder();

    await historyHandler({
      method: 'GET',
      headers: { 'x-forwarded-for': '192.0.2.12' },
      query: { symbol: 'SPY', interval: '1day', outputsize: '2' },
    }, recorder.res);

    expect(recorder.read().status).toBe(200);
    expect(recorder.read().body.values).toEqual(values);
    expect(upstream).toHaveBeenCalledOnce();
    expect(upstream.mock.calls[0][0]).toContain('symbol=SPY');
  });

  it.each([
    ['quote', quoteHandler, { symbol: 'AAPL' }],
    ['history', historyHandler, { symbol: 'AAPL', interval: '1day', outputsize: '2' }],
  ])('keeps an unpublished %s symbol behind the admin gate', async (_name, handler, query) => {
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    const recorder = responseRecorder();

    await handler({
      method: 'GET',
      headers: { 'x-forwarded-for': `192.0.2.${_name === 'quote' ? '13' : '14'}` },
      query,
    }, recorder.res);

    expect(recorder.read().status).toBe(403);
    expect(recorder.read().body.error.code).toBe('ARENA_KEY_REQUIRED');
    expect(upstream).not.toHaveBeenCalled();
  });
});
