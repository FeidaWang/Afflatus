export const INSTRUMENT_IDS = new Set([
  'US:AAPL', 'US:MSFT', 'US:NVDA', 'US:MU', 'US:SPY', 'US:QQQ',
  'CRYPTO:OKX:BTC-USDT:SPOT', 'CRYPTO:OKX:ETH-USDT:SPOT', 'CRYPTO:OKX:SOL-USDT:SPOT',
]);
const allowedQuery = new Set(['instrument', 'start', 'end']);
const DAY = 86_400_000;

function validDate(text) {
  if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const time = Date.parse(text);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === text;
}
export function parseQuery(query, now = Date.now()) {
  if (!query || Object.keys(query).some(k => !allowedQuery.has(k))) throw new Error('INVALID_QUERY');
  const { instrument, start, end } = query;
  if (typeof instrument !== 'string' || !INSTRUMENT_IDS.has(instrument)) throw new Error('INVALID_INSTRUMENT');
  if (!validDate(start) || !validDate(end)) throw new Error('INVALID_DATE');
  const span = (Date.parse(end) - Date.parse(start)) / DAY;
  if (span < 1 || span > 366 || Date.parse(end) > Math.floor(now / DAY) * DAY) throw new Error('INVALID_RANGE');
  return { instrument_id: instrument, start_date: start, end_date: end, interval: '1D' };
}
export function validateSeries(value, requestedId, request = null) {
  const crypto = requestedId.startsWith('CRYPTO:OKX:');
  const currency = crypto ? 'USDT' : 'USD';
  const market = crypto ? 'crypto_spot' : ['US:SPY', 'US:QQQ'].includes(requestedId) ? 'us_etf' : 'us_equity';
  const source = crypto ? 'okx' : 'yahoo';
  const p = value?.provenance;
  if (!value || value.schema_version !== 1 || value.instrument?.id !== requestedId ||
      value.instrument?.market !== market || value.instrument?.quote_currency !== currency ||
      !Array.isArray(value.bars) || !value.bars.length || value.bars.length > 400 ||
      p?.is_realtime_quote !== false || p?.source !== source || p?.quote_currency !== currency ||
      p?.fallback_used !== false || p?.interval !== '1D' || !validDate(p?.last_bar_date) ||
      typeof p?.observed_at !== 'string' || !Number.isFinite(Date.parse(p.observed_at))) return false;
  if (p.adjustment !== undefined && !['split_dividend', 'split', 'raw', 'none', 'unknown', 'na'].includes(p.adjustment)) return false;
  if (p.volume_unit !== undefined && p.volume_unit !== null && !['shares', 'lots', 'base_asset', 'quote_asset', 'contracts'].includes(p.volume_unit)) return false;
  let previous = '';
  const valid = value.bars.every(row => {
    if (!row || !validDate(row.date) || row.date <= previous) return false;
    if (request && (row.date < request.start_date || row.date >= request.end_date)) return false;
    previous = row.date;
    if (!['open', 'high', 'low', 'close'].every(k => typeof row[k] === 'number' && Number.isFinite(row[k]) && row[k] > 0)) return false;
    if (row.volume !== null && !(typeof row.volume === 'number' && Number.isFinite(row.volume) && row.volume >= 0)) return false;
    return row.low <= Math.min(row.open, row.close) && Math.max(row.open, row.close) <= row.high;
  });
  return valid && p.last_bar_date === previous && (!value.technical || validateTechnical(value.technical, value));
}

const technicalFields = { rsi_14: 15, macd: 35, bollinger: 20, sma_20: 20, sma_50: 50, sma_200: 200, ema_20: 20, volume: 20 };
const valueFields = { macd: ['macd_line', 'signal_line', 'histogram'], bollinger: ['upper', 'middle', 'lower'], volume: ['latest', 'sma_20', 'ratio_20'] };
export function validateTechnical(t, series) {
  if (t.upstream_commit !== '251b094320c1f97d1486626d3618113526914d4c' ||
      t.implementation !== 'src.tools.technical_indicator_tool' ||
      t.as_of !== series.provenance.last_bar_date || t.source !== series.provenance.source ||
      t.bar_count !== series.bars.length || t.calculation_basis !== 'all_validated_bars_before_display_sampling' ||
      !t.indicators || Object.keys(t.indicators).length !== Object.keys(technicalFields).length) return false;
  return Object.entries(technicalFields).every(([name, minimum]) => {
    const item = t.indicators[name];
    if (!item || item.minimum_bars !== minimum) return false;
    if (item.status === 'unavailable') return item.value === null && item.reason === 'INSUFFICIENT_BARS' && t.bar_count < minimum;
    if (item.status !== 'available' || item.reason !== null || t.bar_count < minimum) return false;
    if (!valueFields[name]) return typeof item.value === 'number' && Number.isFinite(item.value);
    const fields = valueFields[name];
    return item.value && Object.keys(item.value).length === fields.length && fields.every(key =>
      item.value[key] === null || (typeof item.value[key] === 'number' && Number.isFinite(item.value[key])));
  });
}

/** Fixed DTO projection; arbitrary upstream fields never cross the BFF. */
export function projectSeries(value) {
  const pick = (data, keys) => Object.fromEntries(keys.filter(key => Object.hasOwn(data, key)).map(key => [key, data[key]]));
  const result = {
    schema_version: 1,
    instrument: pick(value.instrument, ['id', 'market', 'symbol', 'source', 'quote_currency', 'venue', 'label']),
    bars: value.bars.map(row => pick(row, ['date', 'open', 'high', 'low', 'close', 'volume', 'bar_open_at', 'bar_close_at'])),
    provenance: pick(value.provenance, ['source', 'requested_source', 'quote_currency', 'currency_basis', 'adjustment',
      'volume_unit', 'bar_timezone', 'date_label_basis', 'quality', 'interval', 'bar_time_semantics', 'observed_at',
      'last_bar_date', 'delay_status', 'is_realtime_quote', 'fallback_used']),
  };
  if (value.technical) result.technical = {
    ...pick(value.technical, ['upstream_commit', 'implementation', 'bar_count', 'as_of', 'source', 'calculation_basis']),
    indicators: Object.fromEntries(Object.keys(technicalFields).map(name => [name,
      pick(value.technical.indicators[name], ['minimum_bars', 'value', 'status', 'reason'])])),
  };
  return result;
}
