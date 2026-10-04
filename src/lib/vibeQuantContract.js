import contract from '../../services/vibe-bridge/bridge/quant-contract.json' with { type: 'json' };
import { INSTRUMENTS, parseQuery } from './vibeMarketContract.js';

export const QUANT_MODULES = contract.modules;
export const QUANT_COMMIT = contract.commit;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) => object(value) && Object.keys(value).every(key => keys.includes(key));
const timestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
export function boundedValue(value, depth = 0, output = false) {
  if (depth > (output ? 16 : 8)) return false;
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value) && Math.abs(value) <= 1e15;
  if (typeof value === 'string') return value.length <= 12000;
  if (Array.isArray(value)) return value.length <= 400 && value.every(item => boundedValue(item, depth + 1, output));
  return object(value) && Object.keys(value).length <= 64 && Object.entries(value).every(([key, item]) => key.length <= 64 && !['__proto__', 'constructor', 'prototype'].includes(key) && boundedValue(item, depth + 1, output));
}

export function applicableQuantModules(instrument) {
  const item = INSTRUMENTS.get(instrument);
  return item ? Object.entries(QUANT_MODULES).filter(([, spec]) => !spec.local_only && spec.markets.includes(item.market)).map(([name]) => name) : [];
}

export function parseQuantRequest(value, now = Date.now()) {
  const keys = ['instrument_id', 'module', 'start_date', 'end_date', 'parameters'];
  if (!exactKeys(value, keys) || typeof value.module !== 'string' || !Object.hasOwn(QUANT_MODULES, value.module) || !applicableQuantModules(value.instrument_id).includes(value.module)) throw new Error('INVALID_REQUEST');
  const spec = QUANT_MODULES[value.module], parameters = value.parameters ?? {};
  if (!exactKeys(parameters, spec.parameters) || !boundedValue(parameters) || new TextEncoder().encode(JSON.stringify(parameters)).length > 24000) throw new Error('INVALID_PARAMETERS');
  const result = { instrument_id: value.instrument_id, module: value.module, parameters };
  if (spec.history) {
    const range = parseQuery({ instrument: value.instrument_id, start: value.start_date, end: value.end_date }, now);
    result.start_date = range.start_date; result.end_date = range.end_date;
  } else if (value.start_date != null || value.end_date != null) throw new Error('INVALID_RANGE');
  return result;
}

const decimalPattern = /^-?\d{1,16}(?:\.\d{1,8})?$/;
function units(value) {
  if (typeof value !== 'string' || !decimalPattern.test(value)) throw new Error('INVALID_DECIMAL');
  const negative = value.startsWith('-'), [integer, fraction = ''] = value.replace(/^-/, '').split('.');
  const result = BigInt(integer) * 100000000n + BigInt(fraction.padEnd(8, '0'));
  return negative ? -result : result;
}
function multiply(x, y, cash = 0n) {
  // Round the complete equity value once. Half-even rounding of a product
  // alone changes tie parity when an odd number of cash units is then added.
  const product = x * y + cash * 100000000n, whole = product / 100000000n, tail = product % 100000000n;
  return whole + (tail > 50000000n || (tail === 50000000n && whole % 2n !== 0n) ? 1n : 0n);
}
function ledgerValid(data) {
  try {
    if (!Array.isArray(data.fills) || !Array.isArray(data.equity) || !data.equity.length || data.equity.length > 366 || data.fills.length > 366 || !object(data.assumptions)) return false;
    let cash = units(data.assumptions.initial_capital), quantity = 0n, fees = 0n, index = 0, previous = '';
    for (const row of data.equity) {
      if (!exactKeys(row, ['date', 'close', 'cash', 'quantity', 'equity']) || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || row.date <= previous) return false;
      const fill = data.fills[index];
      if (fill && fill.date === row.date) {
        if (!exactKeys(fill, ['date', 'signal_date', 'side', 'quantity', 'price', 'notional', 'fee', 'cash_after', 'quantity_after']) || !/^\d{4}-\d{2}-\d{2}$/.test(fill.signal_date) || fill.signal_date >= fill.date || !['buy', 'sell'].includes(fill.side)) return false;
        const size = units(fill.quantity), notional = units(fill.notional), fee = units(fill.fee), price = units(fill.price);
        if (size <= 0n || price <= 0n || fee < 0n || multiply(size, price) !== notional) return false;
        const side = fill.side === 'buy' ? 1n : -1n;
        cash -= side * notional + fee; quantity += side * size; fees += fee;
        if (cash !== units(fill.cash_after) || quantity !== units(fill.quantity_after)) return false;
        index++;
      }
      if (cash < 0n || quantity < 0n || units(row.close) <= 0n || units(row.cash) !== cash || units(row.quantity) !== quantity || units(row.equity) !== multiply(quantity, units(row.close), cash)) return false;
      previous = row.date;
    }
    return index === data.fills.length && units(data.fees) === fees && data.final_equity === data.equity.at(-1).equity && data.shorting === false && data.leverage === '1' && data.funding === false && data.liquidation === false;
  } catch { return false; }
}

export function validateQuantResult(value, module, instrument) {
  const spec = QUANT_MODULES[module];
  if (!spec || !object(value) || value.schema_version !== 1 || value.module !== module || value.instrument_id !== instrument || value.upstream_commit !== QUANT_COMMIT || !timestamp(value.observed_at) || !/^[0-9a-f]{64}$/.test(value.request_hash) || !Array.isArray(value.missing) || !value.missing.every(x => typeof x === 'string' && /^[a-z_]+$/.test(x)) || !Array.isArray(value.notes) || !Array.isArray(value.provenance) || value.provenance.length > 8 || !exactKeys(value.data, spec.output_keys) || !boundedValue(value.data, 0, true)) return false;
  if (value.status === 'unavailable') return contract.reasons.includes(value.reason) && Object.keys(value.data).length === 0 && value.provenance.length === 0;
  if (value.status !== 'available' || value.reason !== null || value.missing.length || Object.keys(value.data).length !== spec.output_keys.length) return false;
  if (!value.notes.every(x => typeof x === 'string' && x.length <= 200)) return false;
  for (const source of value.provenance) {
    if (!object(source) || !['yahoo', 'okx', 'binance'].includes(source.source) || !['USD', 'USDT'].includes(source.quote_currency) || source.fallback_used !== false || !timestamp(source.observed_at) || !/^[0-9a-f]{64}$/.test(source.bars_sha256)) return false;
  }
  if (module === 'backtest' && !ledgerValid(value.data)) return false;
  if (module === 'options_chain' && (value.data.source !== 'yahoo' || value.data.source_url !== 'https://finance.yahoo.com/' || !(value.data.quote_as_of === null || timestamp(value.data.quote_as_of)) || value.data.theoretical_model !== false)) return false;
  return true;
}

export function validateQuantJob(value) {
  if (!object(value) || value.schema_version !== 1 || !/^[0-9a-f]{32}$/.test(value.id) || !applicableQuantModules(value.instrument_id).includes(value.module) || !timestamp(value.created_at) || !['queued', 'running', 'complete', 'cancelled', 'failed'].includes(value.status)) return false;
  if (value.status === 'complete') return value.error === null && validateQuantResult(value.result, value.module, value.instrument_id);
  return value.result === null && (value.status === 'failed' ? value.error === 'SOURCE_UNAVAILABLE' : value.error === null);
}

export function projectQuantJob(value) {
  const result = Object.fromEntries(['schema_version', 'id', 'module', 'instrument_id', 'status', 'created_at', 'result', 'error'].map(key => [key, value[key]]));
  if (result.result) {
    result.result = Object.fromEntries(['schema_version', 'module', 'instrument_id', 'status', 'reason', 'missing', 'data', 'provenance', 'observed_at', 'upstream_commit', 'request_hash', 'notes'].map(key => [key, result.result[key]]));
    const sourceFields = ['source', 'requested_source', 'quote_currency', 'currency_basis', 'adjustment', 'volume_unit', 'bar_timezone', 'date_label_basis', 'quality', 'interval', 'bar_time_semantics', 'observed_at', 'last_bar_date', 'delay_status', 'is_realtime_quote', 'fallback_used', 'bars_sha256', 'volume_unit_basis', 'volume_unit_source_url'];
    result.result.provenance = result.result.provenance.map(source => Object.fromEntries(sourceFields.filter(key => Object.hasOwn(source, key)).map(key => [key, source[key]])));
  }
  return result;
}
