import { describe, it, expect } from 'vitest';
import { parseQuery, validateSeries, projectSeries } from '../src/lib/vibeMarketContract.js';
import { vibeDevPlugin } from '../scripts/vibe-dev-plugin.mjs';

const fixture = () => ({
  schema_version: 1, instrument: { id: 'US:AAPL', market: 'us_equity', quote_currency: 'USD' },
  bars: [{ date: '2025-01-02', open: 100, high: 105, low: 99, close: 103, volume: 1000 }],
  provenance: { source: 'yahoo', quote_currency: 'USD', is_realtime_quote: false, fallback_used: false,
    interval: '1D', last_bar_date: '2025-01-02', observed_at: '2025-01-03T00:00:00Z' },
});
describe('Vibe host boundary', () => {
  it('rejects duplicate parameters, arbitrary destinations and perpetual identities', () => {
    const query = { instrument: 'US:AAPL', start: '2025-01-01', end: '2025-01-04' };
    for (const patch of [{ instrument: ['US:AAPL', 'US:SPY'] }, { url: 'http://localhost' },
      { instrument: 'CRYPTO:OKX:BTC-USDT:PERP' }]) expect(() => parseQuery({ ...query, ...patch })).toThrow();
  });
  it('drops arbitrary fields before returning a valid DTO', () => {
    const raw = fixture(); raw.internalCredential = 'must-not-leak'; raw.instrument.secret = 'must-not-leak';
    raw.bars[0].internal = 'must-not-leak'; raw.provenance.internal = 'must-not-leak';
    expect(validateSeries(raw, 'US:AAPL')).toBe(true);
    expect(JSON.stringify(projectSeries(raw))).not.toContain('must-not-leak');
  });
  it('refuses indicators calculated for a different snapshot', () => {
    const raw = fixture(); raw.technical = { as_of: '2025-01-03' };
    expect(validateSeries(raw, 'US:AAPL')).toBe(false);
  });
  it('requires complete crypto timestamps with the selected venue alignment', () => {
    const raw = fixture();
    raw.instrument = { id: 'CRYPTO:BINANCE:BTC-USDT:SPOT', market: 'crypto_spot', quote_currency: 'USDT' };
    Object.assign(raw.provenance, { source: 'binance', quote_currency: 'USDT' });
    expect(validateSeries(raw, raw.instrument.id)).toBe(false);
    Object.assign(raw.bars[0], { bar_open_at: '2025-01-02T00:00:00Z', bar_close_at: '2025-01-03T00:00:00Z' });
    expect(validateSeries(raw, raw.instrument.id)).toBe(true);
    raw.bars[0].bar_open_at = '2025-01-02T16:00:00Z'; expect(validateSeries(raw, raw.instrument.id)).toBe(false);
  });
  it('keeps local BFF unavailable without the independent server flag', async () => {
    let middleware; vibeDevPlugin({}).configureServer({ middlewares: { use: fn => { middleware = fn; } } });
    let status, data;
    await middleware({ url: '/api/vibe-market', method: 'GET', headers: { host: '127.0.0.1:5175' },
      socket: { remoteAddress: '127.0.0.1' } }, {
      setHeader() {}, set statusCode(value) { status = value; }, end(value) { data = JSON.parse(value); },
    }, () => { throw new Error('must handle fixed endpoint'); });
    expect(status).toBe(404); expect(data.error.code).toBe('FEATURE_DISABLED');
  });
  it.each([
    { host: 'attacker.example' },
    { host: '127.0.0.1:5175', origin: 'https://attacker.example' },
    { host: '127.0.0.1:5175', 'sec-fetch-site': 'cross-site' },
  ])('rejects remote and cross-origin local research requests: %s', async headers => {
    let middleware; vibeDevPlugin({ VIBE_LOCAL_RESEARCH: 'true' }).configureServer({ middlewares: { use: fn => { middleware = fn; } } });
    let status;
    await middleware({ url: '/api/vibe-market', method: 'GET', headers, socket: { remoteAddress: '127.0.0.1' } },
      { setHeader() {}, set statusCode(value) { status = value; }, end() {} }, () => {});
    expect(status).toBe(403);
  });
});
