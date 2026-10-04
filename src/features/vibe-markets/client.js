import { validateSeries } from '../../lib/vibeMarketContract.js';

export async function getDailyBars({ instrument, start, end, signal, headers = {} }) {
  const query = new URLSearchParams({ instrument, start, end });
  const response = await fetch(`/api/vibe-market?${query}`, { signal, headers, credentials: 'same-origin' });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.code || 'DATA_UNAVAILABLE');
  if (!validateSeries(data, instrument, { start_date: start, end_date: end })) throw new Error('INVALID_RESPONSE');
  return data;
}
