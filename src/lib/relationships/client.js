/* ============================================================
   RELATIONSHIPS v2 · Worker message protocol and client (REL-010).

   Transport is latestWorkerTask.js: one Worker per request, terminated on
   supersede/cancel, so a cancelled computation stops using CPU. Inside
   that transport the payload is a v2 WorkerMessage and the value a v2
   WorkerReply:

     → { type: 'compute', payload: ComputeRequest, generation }
     ← { type: 'result', report, generation }
       | { type: 'error', requestId, code, fieldKeys, retryable, generation }

   `cancel` and `clear_private_state` are handled on this side: the Worker
   keeps no state between messages, so terminating it is the cancel, and
   the generation counter makes any late reply from before a clear
   unusable (it is rejected, never rendered or stored).

   The fallback (Worker blocked by privacy tooling) runs the same kernel
   on the main thread through a lazy import, under the same generation
   check. It is the same algorithm, not a second scoring path.
   ============================================================ */
import { createLatestWorkerTask } from '../latestWorkerTask.js';
import { ERROR_CODES, RelationshipError, validateReport } from './contract.js';

export const WORKER_KIND = 'relationships-report';

// Worker side: one message in, one reply out. Never throws.
export function handleRelationshipsMessage(message, compute) {
  const generation = message?.generation ?? 0;
  if (message?.type !== 'compute') {
    return { type: 'error', requestId: '', code: ERROR_CODES.REQUEST_INVALID, fieldKeys: ['type'], retryable: false, generation };
  }
  try {
    return { type: 'result', report: compute(message.payload), generation };
  } catch (error) {
    const known = error instanceof RelationshipError || error?.name === 'RelationshipError';
    return {
      type: 'error',
      requestId: typeof message.payload?.requestId === 'string' ? message.payload.requestId : '',
      code: known ? error.code : ERROR_CODES.INTERNAL,
      fieldKeys: known ? error.fieldKeys : [],
      retryable: known ? !!error.retryable : false,
      generation,
    };
  }
}

function abort(reason) {
  const e = new Error(reason);
  e.name = 'AbortError';
  return e;
}

// Random task id: not derived from birth data, not a public fingerprint.
export function newRequestId(cryptoImpl = globalThis.crypto) {
  const bytes = new Uint8Array(12);
  cryptoImpl.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function createRelationshipsClient({ workerUrl, WorkerCtor, loadKernel = () => import('./kernel.js') } = {}) {
  const task = createLatestWorkerTask(workerUrl, WorkerCtor ? { WorkerCtor } : {});
  let generation = 0;
  let fallbackEpoch = 0;

  function accept(reply, request, gen) {
    if (gen !== generation || reply?.generation !== gen) throw abort('stale');
    if (reply.type === 'error') throw new RelationshipError(reply.code, reply.fieldKeys, { retryable: reply.retryable });
    if (reply.type !== 'result' || !validateReport(reply.report) || reply.report.requestId !== request.requestId) {
      throw new RelationshipError(ERROR_CODES.INTERNAL, [], { retryable: true });
    }
    return reply.report;
  }

  async function compute(request) {
    const gen = generation;
    const epoch = ++fallbackEpoch;
    let reply;
    try {
      reply = await task.run(WORKER_KIND, { type: 'compute', payload: request, generation: gen });
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      const { computeRelationshipReport } = await loadKernel();
      if (epoch !== fallbackEpoch) throw abort('superseded');
      reply = handleRelationshipsMessage({ type: 'compute', payload: request, generation: gen }, computeRelationshipReport);
    }
    return accept(reply, request, gen);
  }

  return Object.freeze({
    compute,
    cancel(reason = 'cancelled') { fallbackEpoch++; return task.cancel(reason); },
    // Deletion: stop in-flight work and make every earlier reply stale.
    clearPrivateState() {
      generation++;
      fallbackEpoch++;
      task.cancel('cleared');
      return generation;
    },
    destroy() { fallbackEpoch++; task.destroy(); },
    get generation() { return generation; },
  });
}
