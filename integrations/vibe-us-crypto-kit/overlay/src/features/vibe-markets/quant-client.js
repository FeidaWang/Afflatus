import { parseQuantRequest, validateQuantJob } from '../../lib/vibeQuantContract.js';

async function requestJob(method, { request, id, signal, headers = {} }) {
  const response = await fetch(`/api/vibe-quant${id ? '?' + new URLSearchParams({ id }) : ''}`, {
    method, signal, credentials: 'same-origin', headers: { ...headers, 'Content-Type': 'application/json' },
    ...(request ? { body: JSON.stringify(parseQuantRequest(request)) } : {}),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value?.error?.code || 'SOURCE_UNAVAILABLE');
  if (!validateQuantJob(value) || (id && value.id !== id) || (request && (request.module !== value.module || request.instrument_id !== value.instrument_id))) throw new Error('INVALID_RESPONSE');
  return value;
}

export const createQuantJob = options => requestJob('POST', options);
export const readQuantJob = options => requestJob('GET', options);
export const cancelQuantJob = options => requestJob('DELETE', options);

export function waitForPoll(signal, delay = 2000) {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, delay);
    if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
  });
}
