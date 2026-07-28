export const ARENA_PAGE_STATUS = Object.freeze({
  LOADING: 'loading',
  READY: 'ready',
  STALE: 'stale',
  GATED: 'gated',
  PARTIAL: 'partial',
  ERROR: 'error',
});

export function initialArenaPageState() {
  return {
    status: ARENA_PAGE_STATUS.READY,
    requestId: 0,
    sym: null,
    data: null,
    error: null,
    keyRejected: false,
  };
}

export function reduceArenaPageState(current, event) {
  if (event.type === 'select') {
    return {
      status: ARENA_PAGE_STATUS.LOADING,
      requestId: event.requestId,
      sym: event.sym,
      data: null,
      error: null,
      keyRejected: false,
    };
  }

  if (event.requestId !== current.requestId) return current;

  if (event.type === 'resolve') {
    const status = event.result.history.source.startsWith('stale-')
      ? ARENA_PAGE_STATUS.STALE
      : event.result.quote
        ? ARENA_PAGE_STATUS.READY
        : ARENA_PAGE_STATUS.PARTIAL;
    return {
      ...current,
      status,
      data: event.result,
      error: event.result.quoteError || null,
    };
  }

  if (event.type === 'gated') {
    return {
      ...current,
      status: ARENA_PAGE_STATUS.GATED,
      data: null,
      error: event.error || null,
      keyRejected: Boolean(event.keyRejected),
    };
  }

  if (event.type === 'error') {
    return {
      ...current,
      status: ARENA_PAGE_STATUS.ERROR,
      data: null,
      error: event.error || new Error('Arena selection failed'),
    };
  }

  return current;
}

function abortError() {
  return new DOMException('Superseded Arena selection', 'AbortError');
}

export function isArenaAbort(error) {
  return Boolean(
    error
    && (error.name === 'AbortError' || error.code === 'ABORTED'),
  );
}

export function createLatestSelectionPipeline(worker, hooks = {}) {
  let active = null;
  let nextRequestId = 0;

  async function run(input) {
    active?.controller.abort();
    const controller = new AbortController();
    const requestId = ++nextRequestId;
    active = { requestId, controller };
    hooks.onStart?.(input, requestId);

    try {
      const value = await worker(input, {
        requestId,
        signal: controller.signal,
      });
      if (!active || active.requestId !== requestId || controller.signal.aborted) {
        throw abortError();
      }
      hooks.onResolve?.(value, input, requestId);
      return value;
    } catch (error) {
      const superseded = !active
        || active.requestId !== requestId
        || controller.signal.aborted
        || isArenaAbort(error);
      if (!superseded) hooks.onReject?.(error, input, requestId);
      throw superseded && !isArenaAbort(error) ? abortError() : error;
    } finally {
      if (active?.requestId === requestId) active = null;
    }
  }

  return {
    run,
    cancel() {
      active?.controller.abort();
      active = null;
    },
    get active() {
      return Boolean(active);
    },
  };
}
