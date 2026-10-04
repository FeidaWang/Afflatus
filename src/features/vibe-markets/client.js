import { validateSeries } from '../../lib/vibeMarketContract.js';
import { parseResearchQuery, validateResearch } from '../../lib/vibeResearchContract.js';

export async function getDailyBars({ instrument, start, end, signal, headers = {} }) {
  const query = new URLSearchParams({ instrument, start, end });
  const response = await fetch(`/api/vibe-market?${query}`, { signal, headers, credentials: 'same-origin' });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.code || 'DATA_UNAVAILABLE');
  if (!validateSeries(data, instrument, { start_date: start, end_date: end })) throw new Error('INVALID_RESPONSE');
  return data;
}

export async function getResearch({ instrument, module, cadence, cutoff, manager, begin, end, signal, headers = {} }) {
  const values = { instrument, module };
  for (const [key, value] of Object.entries({ cadence, cutoff, manager, begin, end })) if (value) values[key] = value;
  const request = parseResearchQuery(values);
  const response = await fetch(`/api/vibe-research?${new URLSearchParams(values)}`, { signal, headers, credentials: 'same-origin' });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.code || 'DATA_UNAVAILABLE');
  if (!validateResearch(data, request)) throw new Error('INVALID_RESPONSE');
  return data;
}
