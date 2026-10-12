import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Each test gets fresh handler modules so per-instance caches start empty.
async function handlers() {
  vi.resetModules();
  return {
    history: (await import('../api/history.js')).default,
    quote: (await import('../api/quote.js')).default,
    treasury: (await import('../api/treasury-yields.js')).default,
  };
}

function call(handler, { query = {}, headers = {}, ip = '192.0.2.40' } = {}) {
  const out = { headers: {} };
  const res = {
    setHeader: (key, value) => { out.headers[key] = value; },
    status: (value) => { out.status = value; return res; },
    json: (value) => { out.body = value; },
  };
  return handler({ method: 'GET', headers: { 'x-forwarded-for': ip, ...headers }, query }, res).then(() => out);
}

const ADMIN_KEY = 'arena-admin-' + 'k'.repeat(32);
const bars = (n) => Array.from({ length: n }, (_, i) => ({ datetime: `2026-08-${String(30 - (i % 28)).padStart(2, '0')}`, close: String(100 + i) }));

function historyUpstream() {
  return vi.fn(async (url) => {
    const size = Number(new URL(url).searchParams.get('outputsize'));
    return { ok: true, json: async () => ({ status: 'ok', meta: { symbol: 'SPY' }, values: bars(size) }) };
  });
}

// A response whose body never arrives until the request is aborted.
function stalledBody() {
  return vi.fn(async (_url, { signal }) => ({
    ok: true,
    json: () => new Promise((_, reject) => signal.addEventListener('abort', () => {
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    })),
  }));
}

beforeEach(() => {
  vi.stubEnv('TWELVE_KEY', 'test-twelve-key');
  vi.stubEnv('FINNHUB_KEY', 'test-finnhub-key');
  vi.stubEnv('ARENA_ADMIN_KEY', ADMIN_KEY);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('/api/history cache-bypass protection', () => {
  it.each([
    ['an unknown query parameter', { symbol: 'SPY', interval: '1day', outputsize: '30', cb: '123' }],
    ['an interval clients never use', { symbol: 'SPY', interval: 'zzzzzz', outputsize: '30' }],
    ['a negative outputsize', { symbol: 'SPY', interval: '1day', outputsize: '-5' }],
    ['a non-numeric outputsize', { symbol: 'SPY', interval: '1day', outputsize: 'abc' }],
    ['an outputsize above 5000', { symbol: 'SPY', interval: '1day', outputsize: '5001' }],
  ])('rejects %s without calling the provider', async (_label, query) => {
    const { history } = await handlers();
    const upstream = historyUpstream();
    vi.stubGlobal('fetch', upstream);
    const out = await call(history, { query });
    expect(out.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('serves nearby outputsizes from one bucketed provider call', async () => {
    const { history } = await handlers();
    const upstream = historyUpstream();
    vi.stubGlobal('fetch', upstream);
    const a = await call(history, { query: { symbol: 'SPY', interval: '1day', outputsize: '47' } });
    const b = await call(history, { query: { symbol: 'SPY', interval: '1day', outputsize: '52' }, ip: '192.0.2.41' });
    expect(upstream).toHaveBeenCalledOnce();
    expect(new URL(upstream.mock.calls[0][0]).searchParams.get('outputsize')).toBe('60');
    expect(a.body.values).toEqual(bars(60).slice(0, 47));
    expect(b.body.values).toEqual(bars(60).slice(0, 52));
    expect(a.headers['Cache-Control']).toContain('s-maxage=3600');
  });

  it('treats an unverified x-arena-key as anonymous instead of bypassing the cache', async () => {
    const { history } = await handlers();
    const upstream = historyUpstream();
    vi.stubGlobal('fetch', upstream);
    const query = { symbol: 'SPY', interval: '1day', outputsize: '30' };
    await call(history, { query });
    const forged = await call(history, { query, headers: { 'x-arena-key': 'wrong' }, ip: '192.0.2.42' });
    const withAuth = await call(history, { query, headers: { authorization: 'Bearer x' }, ip: '192.0.2.43' });
    expect(upstream).toHaveBeenCalledOnce();
    expect(forged.status).toBe(200);
    expect(withAuth.status).toBe(200);
  });

  it('still gives a verified admin a fresh, uncached provider read', async () => {
    const { history } = await handlers();
    const upstream = historyUpstream();
    vi.stubGlobal('fetch', upstream);
    const query = { symbol: 'SPY', interval: '1day', outputsize: '30' };
    await call(history, { query });
    const admin = await call(history, { query, headers: { 'x-arena-key': ADMIN_KEY }, ip: '192.0.2.44' });
    expect(upstream).toHaveBeenCalledTimes(2);
    expect(admin.status).toBe(200);
    expect(admin.headers['Cache-Control']).toBe('private, no-store');
  });

  it('times out when the provider stalls after sending headers', async () => {
    vi.useFakeTimers();
    const { history } = await handlers();
    vi.stubGlobal('fetch', stalledBody());
    const pending = call(history, { query: { symbol: 'SPY', interval: '1day', outputsize: '30' } });
    await vi.advanceTimersByTimeAsync(7000);
    const out = await pending;
    expect(out.status).toBe(504);
    expect(out.body.error.code).toBe('UPSTREAM_TIMEOUT');
  });
});

describe('/api/quote cache-bypass protection', () => {
  const finnhub = () => vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ c: 101, pc: 100, o: 100.5, h: 102, l: 99.5, t: Math.floor(Date.now() / 1000) - 60, d: 1, dp: 1 }),
  }));

  it('treats an unverified x-arena-key as anonymous instead of bypassing the cache', async () => {
    const { quote } = await handlers();
    const upstream = finnhub();
    vi.stubGlobal('fetch', upstream);
    await call(quote, { query: { symbol: 'SPY' } });
    const forged = await call(quote, { query: { symbol: 'SPY' }, headers: { 'x-arena-key': 'wrong' }, ip: '192.0.2.45' });
    expect(upstream).toHaveBeenCalledOnce();
    expect(forged.status).toBe(200);
  });

  it('still gives a verified admin a fresh provider read', async () => {
    const { quote } = await handlers();
    const upstream = finnhub();
    vi.stubGlobal('fetch', upstream);
    await call(quote, { query: { symbol: 'SPY' } });
    const admin = await call(quote, { query: { symbol: 'SPY' }, headers: { 'x-arena-key': ADMIN_KEY }, ip: '192.0.2.46' });
    expect(upstream).toHaveBeenCalledTimes(2);
    expect(admin.headers['Cache-Control']).toBe('private, no-store');
  });
});

describe('/api/treasury-yields upstream deadline', () => {
  it('times out when the provider stalls after sending headers', async () => {
    vi.useFakeTimers();
    const { treasury } = await handlers();
    vi.stubGlobal('fetch', stalledBody());
    const pending = call(treasury);
    await vi.advanceTimersByTimeAsync(6000);
    const out = await pending;
    expect(out.status).toBe(504);
  });
});
