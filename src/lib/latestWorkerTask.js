function abortError(reason) {
  const error = new Error(String(reason || 'superseded'));
  error.name = 'AbortError';
  return error;
}

/**
 * Runs at most one expensive Worker request for a feature channel.
 * Superseding truly stops CPU work by terminating the old Worker rather than
 * merely dropping its eventual response.
 */
export function createLatestWorkerTask(workerUrl, options = {}) {
  const WorkerCtor = options.WorkerCtor ?? globalThis.Worker;
  let sequence = 0;
  let active = null;
  let disposed = false;

  function cancel(reason = 'superseded') {
    if (!active) return false;
    const task = active;
    active = null;
    task.worker.terminate();
    task.reject(abortError(reason));
    return true;
  }

  function run(kind, payload) {
    if (disposed) return Promise.reject(abortError('disposed'));
    cancel('superseded');
    if (typeof WorkerCtor !== 'function') {
      return Promise.reject(new Error('Worker unavailable'));
    }

    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const worker = new WorkerCtor(workerUrl, { type: 'module', name: `latest-task:${kind}` });
      active = { id, worker, reject };
      const settle = (callback, value) => {
        if (!active || active.id !== id) return;
        active = null;
        worker.terminate();
        callback(value);
      };
      worker.addEventListener('message', (event) => {
        const message = event.data || {};
        if (message.id !== id) return;
        if (message.ok) settle(resolve, message.value);
        else settle(reject, new Error(message.error || 'Worker task failed'));
      });
      worker.addEventListener('error', (event) => {
        settle(reject, new Error(event?.message || 'Worker task failed'));
      }, { once: true });
      worker.postMessage({ id, kind, payload });
    });
  }

  return Object.freeze({
    run,
    cancel,
    destroy() {
      disposed = true;
      cancel('disposed');
    },
    get active() {
      return active !== null;
    },
  });
}
