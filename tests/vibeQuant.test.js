// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { parseQuantRequest, validateQuantJob, projectQuantJob, QUANT_COMMIT } from '../src/lib/vibeQuantContract.js';
import { createQuantHandler } from '../src/lib/vibeQuantProxy.mjs';
import { mountQuant } from '../src/features/vibe-markets/quant.js';
import ledgerFixture from '../integrations/vibe-us-crypto-kit/validation/p3-offline-ledger-fixture.json';

const request = { instrument_id: 'US:AAPL', module: 'catalogue', parameters: {} };
const result = () => ({ schema_version: 1, module: 'catalogue', instrument_id: 'US:AAPL', status: 'available', reason: null, missing: [], data: { strategies: [], factors: [], evidence_policy: 'offline fixture' }, provenance: [], observed_at: '2025-06-01T00:00:00Z', upstream_commit: QUANT_COMMIT, request_hash: 'b'.repeat(64), notes: [] });
const job = (status = 'queued') => ({ schema_version: 1, id: 'a'.repeat(32), module: 'catalogue', instrument_id: 'US:AAPL', status, created_at: '2025-06-01T00:00:00Z', error: null, result: status === 'complete' ? result() : null });
const env = { VIBE_FEATURE_ENABLED: 'true', VIBE_QUANT_ENABLED: 'true', ARENA_ADMIN_KEY: 'offline-quota-' + 'q'.repeat(32), VIBE_BRIDGE_URL: 'https://bridge.example.invalid', VIBE_BRIDGE_TOKEN: 'offline-server-' + 's'.repeat(32), NODE_ENV: 'production' };
function response() { return { statusCode: 0, body: null, headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; } }; }
async function invoke(patch = {}, fetchImpl = async () => Response.json(job())) {
  const res = response();
  await createQuantHandler({ env: { ...env, ...patch.env }, fetchImpl })({ method: 'POST', query: {}, body: request, headers: { 'content-type': 'application/json', 'x-arena-key': env.ARENA_ADMIN_KEY }, ...patch.req }, res);
  return res;
}

describe('private bounded P3 job contract', () => {
  it('validates the actual Python Decimal fixture across languages and rejects ledger drift', () => {
    const value = structuredClone(ledgerFixture);
    expect(validateQuantJob(value)).toBe(true);
    value.result.data.fills[0].cash_after = '0.00000000';
    expect(validateQuantJob(value)).toBe(false);
  });
  it('rounds total equity once at a half-even tie with odd cash units', () => {
    const value = structuredClone(ledgerFixture), data = value.result.data;
    data.assumptions.initial_capital = '1'; data.fees = '0'; data.final_equity = '1.00000000';
    data.fills = [{ date: '2025-01-22', signal_date: '2025-01-21', side: 'buy', quantity: '0.01', price: '0.00000100', notional: '0.00000001', fee: '0', cash_after: '0.99999999', quantity_after: '0.01' }];
    data.equity = [{ date: '2025-01-22', close: '0.00000050', cash: '0.99999999', quantity: '0.01', equity: '1.00000000' }];
    expect(validateQuantJob(value)).toBe(true);
    data.equity[0].equity = '0.99999999'; expect(validateQuantJob(value)).toBe(false);
  });
  it('rejects arbitrary routes, symbols, code, personal inputs, and oversized parameters', () => {
    for (const patch of [{ module: 'shell' }, { instrument_id: 'HK:0700' }, { owner: 'invented' }, { parameters: { url: 'http://localhost' } }, { module: 'cashflows' }, { module: 'dcf', parameters: { inputs: { text: 'x'.repeat(24001) } } }]) expect(() => parseQuantRequest({ ...request, ...patch })).toThrow();
    expect(() => parseQuantRequest({ ...request, module: 'backtest' })).toThrow();
  });
  it('keeps separate default-off and private gates despite public market rights', async () => {
    const fetcher = vi.fn();
    expect((await invoke({ env: { VIBE_QUANT_ENABLED: 'false' } }, fetcher)).statusCode).toBe(404);
    expect((await invoke({ env: { VIBE_ENABLE_PUBLIC_MARKET_DATA: 'true', VIBE_PUBLIC_DATA_RIGHTS_ACK: 'APPROVED' }, req: { headers: { 'content-type': 'application/json' } } }, fetcher)).statusCode).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('uses fixed create/read/cancel paths and server-only credentials', async () => {
    let captured;
    const res = await invoke({}, async (url, options) => { captured = { url, options }; return Response.json({ ...job(), internalCredential: 'must-not-forward' }); });
    expect(res.statusCode).toBe(202); expect(captured.url).toBe('https://bridge.example.invalid/v1/quant/jobs');
    expect(captured.options.headers.Authorization).toBe(`Bearer ${env.VIBE_BRIDGE_TOKEN}`);
    expect(res.headers['Cache-Control']).toBe('private, no-store'); expect(JSON.stringify(res.body)).not.toContain('must-not-forward');
    for (const method of ['GET', 'DELETE']) {
      const value = await invoke({ req: { method, query: { id: 'a'.repeat(32) } } }, async (url, options) => { expect(url).toBe('https://bridge.example.invalid/v1/quant/jobs/' + 'a'.repeat(32)); expect(options.method).toBe(method); return Response.json(job(method === 'DELETE' ? 'cancelled' : 'running')); });
      expect(value.statusCode).toBe(200);
    }
  });
  it('rejects duplicate ids and mismatched/malformed completed results', async () => {
    expect((await invoke({ req: { method: 'GET', query: { id: ['a'.repeat(32)] } } })).statusCode).toBe(400);
    const value = job('complete'); expect(validateQuantJob(value)).toBe(true);
    value.result.instrument_id = 'US:MSFT'; expect(validateQuantJob(value)).toBe(false);
    value.result = result(); value.result.data = {}; expect(validateQuantJob(value)).toBe(false);
    value.result = result(); value.result.upstream_commit = 'main'; expect(validateQuantJob(value)).toBe(false);
  });
  it('limits creation without charging status reads against the creation budget', async () => {
    const handler = createQuantHandler({ env, fetchImpl: async () => Response.json(job()) });
    const req = { method: 'POST', query: {}, body: request, headers: { 'content-type': 'application/json', 'x-arena-key': env.ARENA_ADMIN_KEY } };
    for (let i = 0; i < 6; i++) { const res = response(); await handler(req, res); expect(res.statusCode).toBe(202); }
    const overflow = response(); await handler(req, overflow); expect(overflow.statusCode).toBe(429);
    const read = response(); await handler({ ...req, method: 'GET', query: { id: 'a'.repeat(32) } }, read); expect(read.statusCode).toBe(200);
  });
  it('projects metadata and blocks an inconsistent money ledger', () => {
    const value = job('complete'); value.result.secret = 'never-forward'; expect(JSON.stringify(projectQuantJob(value))).not.toContain('never-forward');
    const malformed = { ...job('complete'), module: 'backtest', result: { ...result(), module: 'backtest', data: { fills: [], equity: [{ date: '2025-01-02', close: '100', cash: '-1', quantity: '0', equity: '-1' }] } } };
    expect(validateQuantJob(malformed)).toBe(false);
  });
});

describe('P3 browser behavior', () => {
  it('reports transport failure as source unavailable and invalid JSON as input error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const root = document.createElement('div'), dispose = mountQuant(root, 'US:AAPL');
    const select = root.querySelector('select'); select.value = 'catalogue'; select.dispatchEvent(new Event('change'));
    root.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(root.textContent).toContain('The source is unavailable.'));
    select.value = 'dcf'; select.dispatchEvent(new Event('change')); root.querySelector('textarea').value = '{invalid';
    root.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(root.textContent).toContain('Check the supplied model inputs.'));
    dispose(); vi.unstubAllGlobals();
  });
  it('starts only on user action, supports model input, and clears stale results', async () => {
    let captured; vi.stubGlobal('fetch', vi.fn(async (_url, options) => { captured = JSON.parse(options.body); return Response.json(job('complete')); }));
    const root = document.createElement('div'), dispose = mountQuant(root, 'US:AAPL', { locale: 'zh' });
    expect(fetch).not.toHaveBeenCalled();
    const select = root.querySelector('select'); select.value = 'catalogue'; select.dispatchEvent(new Event('change'));
    root.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(root.textContent).toContain('已完成'));
    expect(captured).toEqual(request); expect(root.textContent).toContain('2025-06-01');
    select.value = 'option_model'; select.dispatchEvent(new Event('change')); expect(root.textContent).not.toContain('2025-06-01');
    expect(root.querySelector('[name="volatility"]')).not.toBeNull();
    dispose(); expect(root.childElementCount).toBe(0); vi.unstubAllGlobals();
  });
  it('cancels a queued task when the module changes and rejects late content', async () => {
    const calls = []; vi.stubGlobal('fetch', vi.fn(async (url, options) => { calls.push({ url, method: options.method }); return Response.json(job(options.method === 'DELETE' ? 'cancelled' : 'queued')); }));
    const root = document.createElement('div'), dispose = mountQuant(root, 'US:AAPL');
    const select = root.querySelector('select'); select.value = 'catalogue'; select.dispatchEvent(new Event('change'));
    root.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(calls.some(call => call.method === 'POST')).toBe(true));
    await new Promise(resolve => setTimeout(resolve, 0));
    select.value = 'option_model'; select.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(calls.some(call => call.method === 'DELETE')).toBe(true));
    expect(root.textContent).not.toContain('2025-06-01'); dispose(); vi.unstubAllGlobals();
  });
});
