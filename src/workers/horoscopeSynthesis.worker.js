import { runHoroscopeSynthesis } from '../lib/horoscopeSynthesis.js';

self.addEventListener('message', (event) => {
  const { id, kind, payload } = event.data || {};
  if (!id) return;
  try {
    self.postMessage({ id, ok: true, value: runHoroscopeSynthesis(kind, payload) });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
