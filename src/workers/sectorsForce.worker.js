import {
  encodeSectorsGraphPositions,
  settlePreparedSectorsGraphLayout,
} from '../lib/sectorsGraphLayout.js';

self.addEventListener('message', (event) => {
  const { id, kind, payload } = event.data || {};
  if (!id || kind !== 'settle') return;
  try {
    const value = encodeSectorsGraphPositions(settlePreparedSectorsGraphLayout(payload));
    self.postMessage({
      id,
      ok: true,
      value,
    }, [value.positions.buffer]);
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
