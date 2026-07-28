import { bootstrapDistribution } from '../lib/stats/statistics.js';

self.addEventListener('message', (event) => {
  const { id, kind, payload } = event.data || {};
  if (!id) return;
  try {
    if (kind !== 'bootstrap') throw new Error(`Unsupported stats task: ${kind}`);
    self.postMessage({ id, ok: true, value: bootstrapDistribution(payload) });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
