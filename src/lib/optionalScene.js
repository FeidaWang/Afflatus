// Explicit entry owns one scene. Import completion may outlive the caller.
export function createOptionalScene({ load, onState = () => {} }) {
  let scene, pending, paused = false, reduced = false, disposed = false, generation = 0;
  const publish = () => { if (!disposed) onState(reduced ? 'reduced' : scene ? (paused ? 'paused' : 'playing') : pending ? 'loading' : 'poster'); };
  return {
    async toggle() {
      if (disposed || reduced || pending) return;
      if (scene) { this.setPaused(!paused); return; }
      const current = ++generation;
      pending = true;
      publish();
      try {
        const loaded = await load();
        if (disposed || reduced || current !== generation) { loaded.destroy(); return; }
        scene = loaded;
        scene.setPaused(paused);
        pending = false;
        publish();
      } catch {
        if (disposed || current !== generation) return;
        pending = false;
        onState('failed');
      }
    },
    setPaused(value) { paused = Boolean(value); scene?.setPaused(paused); publish(); },
    setReduced(value) {
      reduced = Boolean(value);
      if (reduced) { generation++; pending = false; scene?.destroy(); scene = null; }
      publish();
    },
    destroy() { disposed = true; generation++; scene?.destroy(); scene = null; },
  };
}
