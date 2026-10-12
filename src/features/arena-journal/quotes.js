import { fetchJson } from '../../lib/fetchJson.js';
import { normalizeDaily } from './stockChartUtils.js';

// One provider bucket covers every chart range (MAX ≈ four years of sessions);
// /api/history caches it at the CDN for an hour.
const DAILY_BARS = 1000;

export const formatPrice = (value) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const signed = (value) => `${value < 0 ? '−' : '+'}${Math.abs(value).toFixed(2)}`;

// Finnhub quote: c = last price, d = change, dp = percent change, t = Unix seconds.
export const loadQuote = (symbol) => fetchJson(`quote:${symbol}`);

export async function loadDailyCandles(symbol) {
  const data = await fetchJson(`history:${symbol}:1day:${DAILY_BARS}`);
  return normalizeDaily(data.values);
}

export function quoteTime(seconds, english) {
  return `${new Intl.DateTimeFormat(english ? 'en-US' : 'zh-CN', {
    timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(seconds * 1000)} ET`;
}
