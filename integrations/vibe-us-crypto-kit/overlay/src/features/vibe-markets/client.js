export async function getDailyBars({ instrument, start, end, signal, headers = {} }) {
  const query = new URLSearchParams({ instrument, start, end });
  const response = await fetch(`/api/vibe-market?${query}`, { signal, headers, credentials: 'same-origin' });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.code || 'DATA_UNAVAILABLE');
  if (data?.schema_version !== 1 || !Array.isArray(data.bars)) throw new Error('INVALID_RESPONSE');
  return data;
}
