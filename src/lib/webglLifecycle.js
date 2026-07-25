const DEFAULT_CONTEXT_LIMIT = 8;
const DEFAULT_LOSS_LIMIT = 2;
const LOSS_STORAGE_KEY = 'afflatus:webgl-losses:v1';

const liveContexts = new Map();
const fallbackSurfaces = new Set();

function safeDataset(canvas, value) {
  if (canvas?.dataset) canvas.dataset.renderer = value;
}

function readLosses(storage) {
  try {
    const value = JSON.parse(storage?.getItem?.(LOSS_STORAGE_KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function writeLosses(storage, losses) {
  try {
    storage?.setItem?.(LOSS_STORAGE_KEY, JSON.stringify(losses));
    return true;
  } catch {
    return false;
  }
}

function currentLanguage(doc) {
  return String(doc?.documentElement?.lang || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function createFallbackControl({ id, canvas, document: doc, reload, clearLosses, reason }) {
  if (!doc?.createElement || !canvas) return null;
  const control = doc.createElement('div');
  const message = doc.createElement('span');
  const button = doc.createElement('button');
  const zh = currentLanguage(doc) === 'zh';

  control.className = 'webgl-fallback';
  control.dataset.webglSurface = id;
  control.setAttribute('role', 'status');
  control.setAttribute('aria-live', 'polite');
  message.textContent = reason === 'context-cap'
    ? (zh ? '为保护图形内存，互动场景已暂停。' : 'Interactive scene paused to protect graphics memory.')
    : (zh ? '互动场景已切换为静态模式。' : 'Interactive scene switched to static mode.');
  button.type = 'button';
  button.textContent = zh ? '重新启用互动场景' : 'Enable interactive scene';
  button.addEventListener('click', () => {
    clearLosses();
    reload();
  });
  control.append(message, button);
  (canvas.parentElement || doc.body)?.appendChild?.(control);
  return control;
}

function call(callback, value) {
  if (typeof callback === 'function') callback(value);
}

/**
 * Owns a single browser WebGL context lease and its context-loss contract.
 * The browser/Three.js rebuilds GPU objects on the first restoration; the
 * supplied callback must reapply size/state and render a verified frame.
 */
export function createWebGLContextLifecycle(options = {}) {
  const id = String(options.id || '');
  const canvas = options.canvas;
  if (!id) throw new Error('WebGL lifecycle id is required.');
  if (!canvas?.addEventListener) throw new Error(`WebGL lifecycle "${id}" requires a canvas.`);
  if (liveContexts.has(id)) throw new Error(`WebGL lifecycle "${id}" is already registered.`);

  const win = options.window ?? (typeof window === 'undefined' ? null : window);
  const doc = options.document ?? (typeof document === 'undefined' ? null : document);
  const storage = options.storage ?? win?.sessionStorage;
  const contextLimit = Math.max(1, Number(options.contextLimit) || DEFAULT_CONTEXT_LIMIT);
  const lossLimit = Math.max(1, Number(options.lossLimit) || DEFAULT_LOSS_LIMIT);
  const abortController = new AbortController();
  const storedLosses = readLosses(storage);
  let lossCount = Math.max(0, Number(storedLosses[id]) || 0);
  let disposed = false;
  let leased = false;
  let fallback = lossCount >= lossLimit;
  let fallbackReason = fallback ? 'repeated-loss' : '';
  let fallbackControl = null;

  function clearLosses() {
    const losses = readLosses(storage);
    delete losses[id];
    writeLosses(storage, losses);
  }

  function reload() {
    if (typeof options.reload === 'function') options.reload();
    else win?.location?.reload?.();
  }

  function showFallback(reason) {
    if (fallbackControl || options.showFallback === false) return;
    fallbackControl = createFallbackControl({
      id,
      canvas,
      document: doc,
      reload,
      clearLosses,
      reason,
    });
  }

  function releaseLease() {
    if (!leased) return;
    leased = false;
    liveContexts.delete(id);
  }

  function enterFallback(reason) {
    if (fallback && fallbackReason === reason && fallbackSurfaces.has(id)) return;
    fallback = true;
    fallbackReason = reason;
    fallbackSurfaces.add(id);
    safeDataset(canvas, 'poster');
    abortController.abort(reason);
    releaseLease();
    call(options.onFallback, Object.freeze({ id, reason, lossCount }));
    showFallback(reason);
  }

  function onContextLost(event) {
    event?.preventDefault?.();
    if (disposed || fallback) return;
    lossCount += 1;
    const losses = readLosses(storage);
    losses[id] = lossCount;
    writeLosses(storage, losses);
    safeDataset(canvas, 'lost');
    call(options.onLost, Object.freeze({ id, lossCount }));
    if (lossCount >= lossLimit) enterFallback('repeated-loss');
  }

  function onContextRestored() {
    if (disposed || fallback) return;
    safeDataset(canvas, 'webgl');
    call(options.onRestore, Object.freeze({ id, lossCount }));
  }

  if (!fallback && liveContexts.size >= contextLimit) {
    fallback = true;
    fallbackReason = 'context-cap';
  }

  if (fallback) {
    fallbackSurfaces.add(id);
    safeDataset(canvas, 'poster');
    call(options.onFallback, Object.freeze({ id, reason: fallbackReason, lossCount }));
    showFallback(fallbackReason);
  } else {
    leased = true;
    liveContexts.set(id, canvas);
    safeDataset(canvas, 'webgl');
    canvas.addEventListener('webglcontextlost', onContextLost, false);
    canvas.addEventListener('webglcontextrestored', onContextRestored, false);
  }

  return Object.freeze({
    id,
    canInitialize: leased && !fallback,
    signal: abortController.signal,
    getState() {
      return Object.freeze({
        id,
        leased,
        fallback,
        fallbackReason,
        lossCount,
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      canvas.removeEventListener('webglcontextlost', onContextLost, false);
      canvas.removeEventListener('webglcontextrestored', onContextRestored, false);
      if (!abortController.signal.aborted) abortController.abort('dispose');
      releaseLease();
      fallbackSurfaces.delete(id);
      fallbackControl?.remove?.();
      fallbackControl = null;
      call(options.onDispose);
    },
  });
}

export function canAcquireWebGLContext(id, contextLimit = DEFAULT_CONTEXT_LIMIT) {
  const key = String(id || '');
  if (!key) return false;
  return liveContexts.has(key) || liveContexts.size < Math.max(1, Number(contextLimit) || DEFAULT_CONTEXT_LIMIT);
}

function disposeTextureValue(value, seenTextures, seenValues, depth = 0) {
  if (!value || depth > 3) return;
  if (value.isTexture || value.isWebGLRenderTarget) {
    if (!seenTextures.has(value)) {
      seenTextures.add(value);
      value.dispose?.();
    }
    return;
  }
  if ((typeof value !== 'object' && typeof value !== 'function') || seenValues.has(value)) return;
  seenValues.add(value);
  if (Array.isArray(value)) {
    for (const item of value) disposeTextureValue(item, seenTextures, seenValues, depth + 1);
    return;
  }
  for (const nested of Object.values(value)) {
    disposeTextureValue(nested, seenTextures, seenValues, depth + 1);
  }
}

/**
 * Disposes CPU-side Three.js object graphs as well as the renderer/context.
 * Shared geometries, materials and textures are de-duplicated by identity.
 */
export function disposeThreeScene(root, renderer, extras = []) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const textureValues = new WeakSet();

  root?.traverse?.((object) => {
    if (object?.geometry?.dispose && !geometries.has(object.geometry)) {
      geometries.add(object.geometry);
      object.geometry.dispose();
    }
    const objectMaterials = Array.isArray(object?.material) ? object.material : [object?.material];
    for (const material of objectMaterials) {
      if (!material || materials.has(material)) continue;
      materials.add(material);
      for (const value of Object.values(material)) disposeTextureValue(value, textures, textureValues);
      material.dispose?.();
    }
  });

  for (const extra of extras) disposeTextureValue(extra, textures, textureValues);
  renderer?.renderLists?.dispose?.();
  renderer?.dispose?.();
  renderer?.forceContextLoss?.();

  return Object.freeze({
    geometries: geometries.size,
    materials: materials.size,
    textures: textures.size,
  });
}

export function getWebGLContextTelemetry() {
  return Object.freeze({
    activeContexts: liveContexts.size,
    contextLimit: DEFAULT_CONTEXT_LIMIT,
    activeIds: Object.freeze([...liveContexts.keys()]),
    fallbackIds: Object.freeze([...fallbackSurfaces]),
  });
}

export function resetWebGLLifecycleForTest() {
  liveContexts.clear();
  fallbackSurfaces.clear();
}
