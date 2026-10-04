import contract from '../../services/vibe-bridge/bridge/research-contract.json' with { type: 'json' };
import { INSTRUMENTS } from './vibeMarketContract.js';
export const RESEARCH_MODULES = contract.modules;
export const RESEARCH_COMMIT = contract.commit;
const sources = { yahoo: 'https://finance.yahoo.com/', sec_edgar: 'https://www.sec.gov/edgar/search/',
  sec_edgar_13f: 'https://www.sec.gov/edgar/search/', sec_nport: 'https://www.sec.gov/edgar/search/',
  eastmoney: 'https://quote.eastmoney.com/usstock.html', ccxt: 'https://docs.ccxt.com/',
  alternative_me: 'https://alternative.me/crypto/fear-and-greed-index/' };
export function applicableModules(instrument) {
  const item = INSTRUMENTS.get(instrument);
  if (!item) return [];
  const scopes = { us_equity: ['equity', 'us'], us_etf: ['etf', 'us'], crypto_spot: ['crypto'] };
  return Object.keys(RESEARCH_MODULES).filter(key => scopes[item.market].includes(RESEARCH_MODULES[key].scope));
}
function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function parseResearchQuery(query, now = Date.now()) {
  if (!query || Object.keys(query).some(key => !['instrument', 'module', 'cadence', 'cutoff', 'manager'].includes(key)) ||
      Object.values(query).some(value => typeof value !== 'string')) throw new Error('INVALID_QUERY');
  const { instrument, module, cadence = 'annual', cutoff, manager = 'berkshire' } = query;
  if (!applicableModules(instrument).includes(module)) throw new Error('INVALID_MODULE');
  if (!['annual', 'quarter'].includes(cadence) || (module !== 'financials' && (cadence !== 'annual' || cutoff !== undefined)) ||
      !['berkshire', 'bridgewater'].includes(manager) || (module !== 'institutions' && manager !== 'berkshire')) throw new Error('INVALID_QUERY');
  if (cutoff !== undefined && (!validDate(cutoff) || cutoff < '1990-01-01' || Date.parse(cutoff) > now)) throw new Error('INVALID_DATE');
  return { instrument_id: instrument, module, cadence, cutoff: cutoff ?? null, manager };
}
function validCell(value, type) {
  if (value === null) return true;
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'scalar' && typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'string' || value.length > 1000) return false;
  if (type === 'text' || type === 'scalar') return true;
  if (type === 'date') return validDate(value);
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      (type === 'url' || (type === 'sec_url' && url.hostname === 'www.sec.gov' && url.pathname.startsWith('/Archives/edgar/data/')));
  } catch { return false; }
}
export function validateResearch(value, request) {
  const spec = RESEARCH_MODULES[request.module];
  if (!spec || !value || value.schema_version !== 1 || value.module !== request.module || value.instrument_id !== request.instrument_id ||
      value.source !== spec.source || value.source_url !== sources[spec.source] || value.upstream_commit !== contract.commit || value.quality !== spec.quality ||
      !['available', 'partial', 'unavailable'].includes(value.status) || !(value.reason === null || contract.reasons.includes(value.reason)) ||
      typeof value.observed_at !== 'string' || !Number.isFinite(Date.parse(value.observed_at)) ||
      !(value.as_of === null || (typeof value.as_of === 'string' && Number.isFinite(Date.parse(value.as_of)))) ||
      !Array.isArray(value.notes) || value.notes.length > contract.notes.length || value.notes.some(note => !contract.notes.includes(note)) ||
      !Array.isArray(value.sections)) return false;
  if (value.sections.length === 0) return value.status === 'unavailable' && contract.reasons.includes(value.reason) && value.as_of === null;
  if (value.sections.length !== Object.keys(spec.sections).length || new Set(value.sections.map(s => s.id)).size !== value.sections.length) return false;
  let available = 0;
  for (const section of value.sections) {
    const fields = spec.sections[section.id];
    if (!fields || !Array.isArray(section.rows) || section.rows.length > 100) return false;
    if (section.rows.length) {
      if (section.status !== 'available' || section.reason !== null) return false;
      available++;
    } else if (section.status !== 'unavailable' || !contract.reasons.includes(section.reason)) return false;
    for (const row of section.rows) {
      if (!row || Object.keys(row).length !== Object.keys(fields).length || !Object.entries(fields).every(([key, type]) => Object.hasOwn(row, key) && validCell(row[key], type))) return false;
      if (request.module === 'financials' && (!row.filed_at || !row.period_end || !row.accession ||
          row.filed_at > (request.cutoff || value.observed_at.slice(0, 10)) || row.period_end > row.filed_at)) return false;
    }
  }
  if (request.module === 'orderbook' && available) {
    const snapshot = value.sections.find(s => s.id === 'snapshot').rows[0];
    const item = INSTRUMENTS.get(request.instrument_id);
    if (!snapshot || snapshot.exchange !== item.source || snapshot.symbol !== item.symbol || snapshot.timestamp !== value.as_of ||
        !['exchange', 'local_fetch_time'].includes(snapshot.timestamp_source) || snapshot.mid_price <= 0 || snapshot.spread_bps < 0 || Math.abs(snapshot.imbalance) > 1) return false;
  }
  if (request.module === 'profile' && available) {
    const listing = value.sections.find(s => s.id === 'listing').rows[0];
    if (!listing || listing.symbol !== INSTRUMENTS.get(request.instrument_id).symbol || listing.currency !== 'USD') return false;
  }
  if (request.module === 'fear_greed' && available) {
    const index = value.sections[0].rows[0];
    if (!Number.isInteger(index.value) || index.value < 0 || index.value > 100 || index.index_at !== value.as_of) return false;
  }
  const expected = available === 0 ? 'unavailable' : available === value.sections.length ? 'available' : 'partial';
  return value.status === expected && value.reason === (available ? null : 'NO_DATA');
}
export function projectResearch(value) {
  return Object.fromEntries(['schema_version', 'module', 'instrument_id', 'status', 'reason', 'source', 'source_url', 'observed_at', 'as_of', 'quality', 'upstream_commit', 'notes'].map(key => [key, value[key]]).concat([
    ['sections', value.sections.map(section => ({ id: section.id, status: section.status, reason: section.reason,
      rows: section.rows.map(row => Object.fromEntries(Object.keys(RESEARCH_MODULES[value.module].sections[section.id]).map(key => [key, row[key]]))) }))],
  ]));
}
