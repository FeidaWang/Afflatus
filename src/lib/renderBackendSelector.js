function markBackend(canvas, backend) {
  if (canvas?.dataset) canvas.dataset.renderer = backend;
}

function defaultReplaceCanvas(canvas) {
  if (!canvas?.cloneNode || !canvas?.replaceWith) return null;
  const replacement = canvas.cloneNode(false);
  replacement.width = canvas.width;
  replacement.height = canvas.height;
  canvas.replaceWith(replacement);
  return replacement;
}

export function webGPUAvailable(scope = globalThis) {
  const navigator = scope?.navigator;
  return scope?.isSecureContext !== false
    && typeof navigator?.gpu?.requestAdapter === 'function';
}

async function defaultWebGPUFactory({ canvas, powerPreference }) {
  const { default: WebGPURenderer } = await import('three/addons/renderers/webgpu/WebGPURenderer.js');
  const renderer = new WebGPURenderer({ canvas, antialias: true, alpha: true, powerPreference });
  await renderer.init();
  if (!renderer.backend?.device) throw new Error('WebGPU initialized without a GPUDevice.');
  return renderer;
}

function defaultWebGL2Factory({ THREE, canvas, powerPreference }) {
  if (!THREE?.WebGLRenderer) throw new Error('Three.js is required for the WebGL2 fallback.');
  const context = canvas.getContext?.('webgl2', {
    alpha: true,
    antialias: true,
    powerPreference,
  });
  if (!context) throw new Error('WebGL2 is unavailable.');
  return new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true, powerPreference });
}

/**
 * Selects WebGPU when available, then moves to a fresh WebGL2 canvas if its
 * GPUDevice is lost. A lost WebGL2 fallback ends at the caller's poster.
 */
export async function createProgressiveRenderer({
  THREE,
  canvas: initialCanvas,
  scope = globalThis,
  signal,
  preferWebGPU = true,
  powerPreference = 'high-performance',
  createWebGPU = defaultWebGPUFactory,
  createWebGL2 = defaultWebGL2Factory,
  replaceCanvas = defaultReplaceCanvas,
  onBackendChange,
} = {}) {
  if (!initialCanvas) throw new Error('A canvas is required.');
  let canvas = initialCanvas;
  let renderer = null;
  let backend = 'poster';
  let reason = '';
  let disposed = false;
  let generation = 0;
  let webglLossHandler = null;
  let transitionPromise = null;

  function publish() {
    markBackend(canvas, backend);
    onBackendChange?.(Object.freeze({ backend, canvas, renderer, reason }));
  }

  function detachWebGLListener() {
    if (webglLossHandler) canvas?.removeEventListener?.('webglcontextlost', webglLossHandler, false);
    webglLossHandler = null;
  }

  function disposeRenderer() {
    detachWebGLListener();
    try { renderer?.dispose?.(); } catch {}
    try { renderer?.forceContextLoss?.(); } catch {}
    renderer = null;
  }

  function enterPoster(nextReason) {
    if (disposed) return;
    generation += 1;
    disposeRenderer();
    backend = 'poster';
    reason = nextReason;
    publish();
  }

  function watchWebGLContext() {
    webglLossHandler = (event) => {
      event?.preventDefault?.();
      enterPoster('webgl-context-lost');
    };
    canvas.addEventListener?.('webglcontextlost', webglLossHandler, false);
  }

  function watchWebGPUDevice(activeRenderer, activeGeneration) {
    const lost = activeRenderer?.backend?.device?.lost;
    if (!lost?.then) return;
    Promise.resolve(lost).then((info) => {
      if (disposed || backend !== 'webgpu' || generation !== activeGeneration) return;
      void fallbackToWebGL2(`webgpu-device-lost:${info?.reason || 'unknown'}`);
    }).catch(() => {
      if (!disposed && backend === 'webgpu' && generation === activeGeneration) {
        void fallbackToWebGL2('webgpu-device-lost');
      }
    });
  }

  async function fallbackToWebGL2(nextReason) {
    if (disposed) return null;
    if (transitionPromise) return transitionPromise;
    transitionPromise = (async () => {
      generation += 1;
      disposeRenderer();
      const replacement = replaceCanvas?.(canvas);
      if (!replacement) {
        enterPoster(`${nextReason}:canvas-replacement-failed`);
        return null;
      }
      canvas = replacement;
      try {
        renderer = await createWebGL2({ THREE, canvas, powerPreference });
        if (disposed) {
          disposeRenderer();
          return null;
        }
        backend = 'webgl2';
        reason = nextReason;
        watchWebGLContext();
        publish();
        return renderer;
      } catch {
        enterPoster(`${nextReason}:webgl2-unavailable`);
        return null;
      }
    })().finally(() => { transitionPromise = null; });
    return transitionPromise;
  }

  if (signal?.aborted) {
    reason = 'aborted';
    publish();
  } else if (preferWebGPU && webGPUAvailable(scope)) {
    try {
      renderer = await createWebGPU({ THREE, canvas, powerPreference });
      backend = 'webgpu';
      reason = 'selected';
      generation += 1;
      const activeGeneration = generation;
      publish();
      watchWebGPUDevice(renderer, activeGeneration);
    } catch {
      await fallbackToWebGL2('webgpu-init-failed');
    }
  } else {
    await fallbackToWebGL2(preferWebGPU ? 'webgpu-unavailable' : 'webgpu-disabled');
  }

  const abort = () => enterPoster('aborted');
  signal?.addEventListener?.('abort', abort, { once: true });

  return Object.freeze({
    get canvas() { return canvas; },
    get renderer() { return renderer; },
    get backend() { return backend; },
    getState() {
      return Object.freeze({ backend, reason, disposed });
    },
    async fallback(nextReason = 'manual-fallback') {
      if (backend === 'webgpu') return fallbackToWebGL2(nextReason);
      enterPoster(nextReason);
      return null;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      generation += 1;
      signal?.removeEventListener?.('abort', abort);
      disposeRenderer();
    },
  });
}
