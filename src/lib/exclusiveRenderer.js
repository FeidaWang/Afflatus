export function createExclusiveRenderer() {
  let revision = 0;
  let active = null;

  function dispose(handle = active?.handle) {
    try {
      handle?.destroy?.();
    } catch {
      // Renderer teardown is best-effort; ownership still moves on.
    }
  }

  async function activate(id, mount) {
    if (active?.id === id) return active.handle;
    const requestRevision = ++revision;
    dispose();
    active = null;
    const handle = await mount();
    if (requestRevision !== revision) {
      dispose(handle);
      return null;
    }
    if (!handle) return null;
    active = { id, handle };
    return handle;
  }

  function deactivate() {
    revision += 1;
    dispose();
    active = null;
  }

  return Object.freeze({
    activate,
    deactivate,
    get activeId() {
      return active?.id || null;
    },
    get handle() {
      return active?.handle || null;
    },
  });
}
