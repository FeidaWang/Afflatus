// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { parseResearchQuery, validateResearch, projectResearch, RESEARCH_MODULES, RESEARCH_COMMIT } from '../src/lib/vibeResearchContract.js';
import { createHandler } from '../src/lib/vibeBridgeProxy.mjs';
import { mountResearch, mountTextSentiment } from '../src/features/vibe-markets/research.js';
import { scoreText } from '../src/features/vibe-markets/sentiment.js';
const query = { instrument: 'US:AAPL', module: 'profile' };
const request = parseResearchQuery(query);
const fixture = () => ({ schema_version: 1, module: 'profile', instrument_id: 'US:AAPL', status: 'unavailable', reason: 'SOURCE_UNAVAILABLE',
  source: 'yahoo', source_url: 'https://finance.yahoo.com/', quality: 'provider_snapshot', upstream_commit: RESEARCH_COMMIT,
  observed_at: '2026-01-01T00:00:00Z', as_of: null, sections: [], notes: [] });
const env = { VIBE_FEATURE_ENABLED: 'true', ARENA_ADMIN_KEY: 'offline-owner-quota-' + 'x'.repeat(32),
  VIBE_BRIDGE_URL: 'https://private.example.invalid', VIBE_BRIDGE_TOKEN: 'offline-server-' + 'x'.repeat(32), NODE_ENV: 'production' };
async function invoke(config = {}, fetcher = async () => Response.json(fixture())) {
  const response = { statusCode: 0, body: null, headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; } };
  await createHandler({ research: true, env: { ...env, ...config.env }, fetchImpl: fetcher })({ method: 'GET', query, headers: { 'x-arena-key': env.ARENA_ADMIN_KEY }, ...config.req }, response);
  return response;
}
describe('P2 research boundary', () => {
  it('bounds calendar dates and checks the selected US company identity', () => {
    const now = Date.parse('2026-10-04T12:00:00Z'), q = { instrument: 'US:AAPL', module: 'earnings', begin: '2026-10-04', end: '2026-10-10' };
    const req = parseResearchQuery(q, now);
    for (const patch of [{ end: '2026-10-11' }, { begin: '2026-10-12' }, { begin: '2026-02-30' }, { host: '127.0.0.1' }, { instrument: 'US:SPY' }, { module: 'profile' }]) expect(() => parseResearchQuery({ ...q, ...patch }, now)).toThrow();
    const value = { ...fixture(), module: 'earnings', source: 'futu_opend', source_url: 'https://openapi.futunn.com/futu-api-doc/en/quote/get-earnings-calendar.html', quality: 'connector_calendar', status: 'available', reason: null,
      sections: [{ id: 'events', status: 'available', reason: null, rows: [{ symbol: 'AAPL', name: 'Apple', earnings_date: '2026-10-07', release_at: null, publish_session: 'AFTER', period: '2026Q4' }] }] };
    expect(validateResearch(value, req)).toBe(true);
    value.sections[0].rows[0].symbol = 'MSFT'; expect(validateResearch(value, req)).toBe(false);
    value.sections[0].rows[0].symbol = 'AAPL'; value.sections[0].rows[0].earnings_date = '2026-10-11'; expect(validateResearch(value, req)).toBe(false);
  });
  it('rejects duplicate arguments, foreign markets, arbitrary actions and owner placeholders', () => {
    for (const patch of [{ module: ['profile', 'news'] }, { module: 'execute' }, { url: 'https://example.com' },
      { instrument: 'HK:0700' }, { instrument: 'CRYPTO:OKX:BTC-USDT:PERP' }, { module: 'orderbook' },
      { owner: 'userA' }, { manager: 'random-manager' }, { cutoff: '2025-01-01' }]) expect(() => parseResearchQuery({ ...query, ...patch })).toThrow();
    expect(parseResearchQuery({ instrument: 'US:AAPL', module: 'financials', cadence: 'quarter', cutoff: '2025-01-01' }).cutoff).toBe('2025-01-01');
  });
  it('rejects malformed source, identity, status, timestamp and unexpected row fields', () => {
    expect(validateResearch(fixture(), request)).toBe(true);
    for (const patch of [{ source: 'eastmoney' }, { instrument_id: 'US:MSFT' }, { status: 'available' },
      { observed_at: 'missing' }, { as_of: 'unknown' }, { reason: 'upstream-secret' }, { source_url: 'https://evil.invalid' }]) {
      expect(validateResearch({ ...fixture(), ...patch }, request)).toBe(false);
    }
    const raw = fixture(); raw.internalCredential = 'never-forward';
    expect(JSON.stringify(projectResearch(raw))).not.toContain('never-forward');
  });
  it('blocks research even when public daily rights are approved', async () => {
    const fetcher = vi.fn();
    const result = await invoke({ env: { VIBE_ENABLE_PUBLIC_MARKET_DATA: 'true', VIBE_PUBLIC_DATA_RIGHTS_ACK: 'APPROVED', VIBE_PUBLIC_INSTRUMENTS: 'US:AAPL' }, req: { headers: {} } }, fetcher);
    expect(result.statusCode).toBe(403); expect(fetcher).not.toHaveBeenCalled();
  });
  it('uses one fixed endpoint and only server credentials, projects unavailable DTO', async () => {
    let captured;
    const result = await invoke({}, async (url, options) => { captured = { url, options }; return Response.json({ ...fixture(), secret: 'never-forward' }); });
    expect(captured.url).toBe('https://private.example.invalid/v1/research');
    expect(captured.options.headers.Authorization).toBe(`Bearer ${env.VIBE_BRIDGE_TOKEN}`);
    expect(JSON.parse(captured.options.body)).toEqual(request);
    expect(result.statusCode).toBe(200); expect(result.headers['Cache-Control']).toBe('private, no-store');
    expect(JSON.stringify(result.body)).not.toContain('never-forward');
  });
  it('fails closed on malformed financial fact and future filing', () => {
    const req = parseResearchQuery({ instrument: 'US:AAPL', module: 'financials', cutoff: '2024-12-31', cadence: 'quarter' });
    const value = { ...fixture(), module: 'financials', source: 'sec_edgar', source_url: 'https://www.sec.gov/edgar/search/', quality: 'filed_reports',
      status: 'partial', reason: null, as_of: '2024-12-31', sections: Object.entries(RESEARCH_MODULES.financials.sections).map(([id, fields]) => ({ id, status: 'unavailable', reason: 'NO_DATA', rows: [] })) };
    const fields = RESEARCH_MODULES.financials.sections.income;
    const row = Object.fromEntries(Object.keys(fields).map(key => [key, null]));
    Object.assign(row, { concept: 'Revenues', value: 100, period_start: '2024-01-01', period_end: '2024-03-31', filed_at: '2024-05-01', accession: 'original', form: '10-Q', unit: 'USD' });
    const income = value.sections.find(s => s.id === 'income'); income.rows = [row]; income.status = 'available'; income.reason = null;
    expect(validateResearch(value, req)).toBe(true);
    row.filed_at = '2025-05-01'; expect(validateResearch(value, req)).toBe(false);
    row.filed_at = '2024-05-01'; row.document_url = 'javascript:alert(1)'; expect(validateResearch(value, req)).toBe(false);
  });
  it('computes the pinned English lexicon without network or model calls', () => {
    expect(scoreText('Growth beats weak warning')).toEqual({ score: 0, positive: 2, negative: 2 });
    expect(scoreText('"bullish!" loss')).toEqual({ score: 0, positive: 1, negative: 1 });
    expect(scoreText('中文 123 up-side')).toEqual({ score: 0, positive: 0, negative: 0 });
    expect(scoreText('buy '.repeat(33) + 'loss '.repeat(31)).score).toBe(0.0312);
    expect(scoreText('buy '.repeat(31) + 'loss '.repeat(33)).score).toBe(-0.0312);
    const root = document.createElement('div'); mountTextSentiment(root, 'zh'); const input = root.querySelector('textarea');
    input.value = 'beats growth'; input.dispatchEvent(new Event('input'));
    expect(root.textContent).toContain('评分: 1');
  });
  it('loads only on user action and clears a completed result on selection change', async () => {
    const fetcher = vi.fn(async () => Response.json({ ...fixture(), reason: 'SEC_CONTACT_REQUIRED', module: 'filings', source: 'sec_edgar', source_url: 'https://www.sec.gov/edgar/search/', quality: 'filed_reports' }));
    vi.stubGlobal('fetch', fetcher);
    const root = document.createElement('div'); const dispose = mountResearch(root, 'US:AAPL', { locale: 'zh' });
    expect(fetcher).not.toHaveBeenCalled();
    const select = root.querySelector('select'); select.value = 'filings'; select.dispatchEvent(new Event('change'));
    root.querySelector('button').click(); await vi.waitFor(() => expect(root.textContent).toContain('真实 SEC 运营联系人'));
    expect(root.textContent).toContain('抓取时间');
    select.value = 'news'; select.dispatchEvent(new Event('change')); expect(root.textContent).not.toContain('真实 SEC 运营联系人');
    dispose(); expect(root.childElementCount).toBe(0); vi.unstubAllGlobals();
  });
  it('ignores a late response after the research module changes', async () => {
    let resolve; vi.stubGlobal('fetch', vi.fn(() => new Promise(done => { resolve = done; })));
    const root = document.createElement('div'); const dispose = mountResearch(root, 'US:AAPL');
    root.querySelector('button').click(); await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
    const select = root.querySelector('select'); select.value = 'news'; select.dispatchEvent(new Event('change'));
    resolve(Response.json(fixture())); await new Promise(done => setTimeout(done, 0));
    expect(root.textContent).not.toContain('2026-01-01'); expect(root.querySelector('button').disabled).toBe(false);
    dispose(); vi.unstubAllGlobals();
  });
});
