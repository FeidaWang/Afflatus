import { runHoroscopeSynthesis } from '../lib/horoscopeSynthesis.js';
import { WORKER_KIND, handleRelationshipsMessage } from '../lib/relationships/client.js';
import { computeRelationshipReport } from '../lib/relationships/kernel.js';

self.addEventListener('message', (event) => {
  const { id, kind, payload } = event.data || {};
  if (!id) return;
  try {
    const value = kind === WORKER_KIND
      ? handleRelationshipsMessage(payload, computeRelationshipReport)
      : runHoroscopeSynthesis(kind, payload);
    self.postMessage({ id, ok: true, value });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
