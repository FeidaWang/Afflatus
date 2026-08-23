export const SCENE_STATUS = Object.freeze({
  POSTER: 'poster',
  SCHEDULED: 'scheduled',
  LOADING: 'loading',
  READY: 'ready',
  PAUSED: 'paused',
  FALLBACK: 'fallback',
});

export const INITIAL_SCENE_STATE = Object.freeze({
  activeSystem: 'orientation',
  chapterId: '01-cold-void',
  loadingState: SCENE_STATUS.POSTER,
});

export function sceneStatusAllowsCanvas(status) {
  return status === SCENE_STATUS.LOADING
    || status === SCENE_STATUS.READY
    || status === SCENE_STATUS.PAUSED;
}

export function createSceneStateStore(initialState = {}) {
  let destroyed = false;
  let snapshot = Object.freeze({ ...INITIAL_SCENE_STATE, ...initialState });
  const listeners = new Set();

  return Object.freeze({
    destroy() {
      destroyed = true;
      listeners.clear();
    },
    getSnapshot() {
      return snapshot;
    },
    subscribe(listener) {
      if (destroyed || typeof listener !== 'function') return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(patch = {}) {
      if (destroyed) return snapshot;
      const next = {
        activeSystem: patch.activeSystem ?? snapshot.activeSystem,
        chapterId: patch.chapterId ?? snapshot.chapterId,
        loadingState: patch.loadingState ?? snapshot.loadingState,
      };
      if (
        next.activeSystem === snapshot.activeSystem
        && next.chapterId === snapshot.chapterId
        && next.loadingState === snapshot.loadingState
      ) return snapshot;
      snapshot = Object.freeze(next);
      listeners.forEach((listener) => listener(snapshot));
      return snapshot;
    },
  });
}
