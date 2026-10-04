// Real localhost host/BFF/worker acceptance; no fixtures, credentials or fallback.
import { writeFile } from 'node:fs/promises';
import { setTimeout as pause } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const base = new URL(process.env.VIBE_LOCAL_ORIGIN || 'http://127.0.0.1:5175');
if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname) || base.protocol !== 'http:' || base.username || base.password) throw new Error('Local preview only');
const cost = { strategy: 'sma_cross', initial_capital: '10000', commission_bps: '10', slippage_bps: '5', participation: '0.01', fast: 5, slow: 20 };
const range = { start_date: '2025-01-01', end_date: '2025-12-31' };
const cases = [
  ...['US:AAPL', 'CRYPTO:OKX:BTC-USDT:SPOT', 'CRYPTO:BINANCE:BTC-USDT:SPOT'].map(instrument_id => ({ instrument_id, module: 'backtest', parameters: cost, ...range })),
  { instrument_id: 'US:AAPL', module: 'portfolio', parameters: { instruments: ['US:AAPL', 'US:MSFT'], weights: ['0.6', '0.4'], benchmark_weights: ['0.5', '0.5'] }, ...range },
  { instrument_id: 'US:AAPL', module: 'options_chain', parameters: {} },
  { instrument_id: 'US:AAPL', module: 'factors', parameters: { factor: 'academic_strev', commission_bps: '10', slippage_bps: '5' }, ...range },
];
async function json(path, options = {}) {
  const response = await fetch(new URL(path, base), { ...options, signal: AbortSignal.timeout(15000) });
  return { http: response.status, value: await response.json() };
}
const report = { observed_at: new Date().toISOString(), layer: 'real_localhost_host_bff_pinned_worker', synthetic_data: false, checks: [] };
for (const request of cases) {
  try {
    let response = await json('/api/vibe-quant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
    const created = response.http;
    const deadline = Date.now() + 170000;
    while (response.http < 300 && ['queued', 'running'].includes(response.value.status) && Date.now() < deadline) {
      await pause(2500); response = await json('/api/vibe-quant?id=' + response.value.id);
    }
    const result = response.value.result, data = result?.data;
    const check = { module: request.module, instrument: request.instrument_id, range: request.start_date ? range : null, created_http: created, final_http: response.http, job_status: response.value.status || null, result_status: result?.status || null, reason: result?.reason || response.value.error?.code || response.value.error || null,
      upstream_commit: result?.upstream_commit || null, request_hash: result?.request_hash || null, source_snapshots: result?.provenance || [],
      summary: data ? { fill_count: data.fills?.length, equity_count: data.equity?.length, fees: data.fees, final_equity: data.final_equity, currency: data.currency, source: data.source, quote_as_of: data.quote_as_of, call_count: data.calls?.length, put_count: data.puts?.length, ic_count: data.ic?.length, total_return: data.total_return, attribution: data.attribution } : null };
    report.checks.push(check); console.log(JSON.stringify({ module: check.module, instrument: check.instrument, status: check.result_status || check.job_status, reason: check.reason, http: check.final_http }));
  } catch { report.checks.push({ module: request.module, instrument: request.instrument_id, reason: 'LOCAL_OR_SOURCE_UNAVAILABLE' }); }
}
const today = new Date().toISOString().slice(0, 10);
for (const [module, extra] of [['earnings', { begin: today, end: today }], ['filings', {}]]) {
  const response = await json('/api/vibe-research?' + new URLSearchParams({ instrument: 'US:AAPL', module, ...extra }));
  report.checks.push({ module, http: response.http, result_status: response.value.status, reason: response.value.reason });
}
const path = fileURLToPath(new URL('../validation/p3-live-localhost.json', import.meta.url));
await writeFile(path, JSON.stringify(report, null, 2) + '\n');
console.log('Saved real localhost acceptance metadata. Unavailable cases are preserved.');
