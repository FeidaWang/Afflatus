import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from '../api/treasury-yields.js';

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

function quote(symbol, values) {
  return {
    symbol,
    last: values.last,
    change: values.change,
    change_pct: values.changePct,
    open: values.open,
    high: values.high,
    low: values.low,
    previous_day_closing: values.previousClose,
    last_time_msec: values.time,
    curmktstatus: 'REG_MKT',
    exchange: 'Tradeweb',
    provider: 'CNBC Quote Cache',
    realTime: 'true',
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('Treasury yield API', () => {
  it('normalises fixed 10Y and 30Y quotes and computes the curve spread', async () => {
    const upstreamPayload = { QuickQuoteResult: { QuickQuote: [
      quote('US30Y', { last: '5.236', change: '0.042', changePct: '0.8086', open: '5.189', high: '5.267', low: '5.177', previousClose: '5.194', time: '1787233724000' }),
      quote('US10Y', { last: '4.696', change: '0.043', changePct: '0.9241', open: '4.645', high: '4.714', low: '4.633', previousClose: '4.653', time: '1787233734000' }),
    ] } };
    const upstream = vi.fn(async () => ({ ok: true, json: async () => upstreamPayload }));
    vi.stubGlobal('fetch', upstream);
    const recorder = responseRecorder();

    await handler({ method: 'GET', headers: { 'x-forwarded-for': '192.0.2.61' } }, recorder.res);

    const result = recorder.read();
    expect(result.status).toBe(200);
    expect(result.headers['Cache-Control']).toBe('s-maxage=15, stale-while-revalidate=45');
    expect(result.body.yields.map(({ tenor }) => tenor)).toEqual(['10Y', '30Y']);
    expect(result.body.yields[0]).toMatchObject({ value: 4.696, changeBps: 4.3, previousClose: 4.653 });
    expect(result.body.yields[1]).toMatchObject({ value: 5.236, changeBps: 4.2, previousClose: 5.194 });
    expect(result.body.spread30s10sBps).toBe(54);
    expect(result.body.source).toEqual({ provider: 'CNBC Quote Cache', venue: 'Tradeweb', realTime: true });
    expect(upstream.mock.calls[0][0]).toContain('symbols=US10Y%7CUS30Y');
  });

  it('rejects non-GET requests before contacting the provider', async () => {
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    const recorder = responseRecorder();

    await handler({ method: 'POST', headers: {} }, recorder.res);

    expect(recorder.read().status).toBe(405);
    expect(recorder.read().headers.Allow).toBe('GET');
    expect(recorder.read().body.error.code).toBe('METHOD_NOT_ALLOWED');
    expect(upstream).not.toHaveBeenCalled();
  });

  it('fails closed when either required tenor is missing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ QuickQuoteResult: { QuickQuote: [
      quote('US10Y', { last: '4.696', change: '0.043', changePct: '0.9241', open: '4.645', high: '4.714', low: '4.633', previousClose: '4.653', time: '1787233734000' }),
    ] } }) })));
    const recorder = responseRecorder();

    await handler({ method: 'GET', headers: { 'x-forwarded-for': '192.0.2.62' } }, recorder.res);

    expect(recorder.read().status).toBe(502);
    expect(recorder.read().body.error.code).toBe('UPSTREAM_SCHEMA');
  });
});
