import { fetchJson } from '../lib/fetchJson.js';

export function createSectorsDataController() {
  const abortController = new AbortController();

  return Object.freeze({
    async load() {
      const [sectors, ecosystemGraph] = await Promise.all([
        fetchJson('sectors', { signal: abortController.signal }),
        fetchJson('sectors-ecosystem', { signal: abortController.signal }).catch(() => null),
      ]);
      return ecosystemGraph ? { ...sectors, ecosystemGraph } : sectors;
    },
    destroy() {
      abortController.abort();
    },
  });
}
