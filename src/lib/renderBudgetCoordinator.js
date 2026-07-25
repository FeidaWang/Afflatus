import {
  computeBudgetDpr,
  detectInitialQuality,
  estimateRefreshRate,
  evaluateFrameWindow,
  pixelBudgetFor,
  stepQualityTier,
} from './renderBudget.js';

const noop = () => {};

function callSafely(callback, value, label) {
  if (typeof callback !== 'function') return;
  try {
    callback(value);
  } catch (error) {
    console.warn(`[render-budget] ${label} callback failed`, error);
  }
}

function connectionSaveData(win) {
  return Boolean(win?.navigator?.connection?.saveData);
}

function reducedMotion(win) {
  try {
    return Boolean(win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  } catch {
    return false;
  }
}

export function createRenderBudgetCoordinator(options = {}) {
  const win = options.window ?? (typeof window === 'undefined' ? null : window);
  const doc = options.document ?? (typeof document === 'undefined' ? null : document);
  const requestFrame = options.requestAnimationFrame
    ?? win?.requestAnimationFrame?.bind(win)
    ?? ((callback) => setTimeout(() => callback(Date.now()), 16));
  const cancelFrame = options.cancelAnimationFrame
    ?? win?.cancelAnimationFrame?.bind(win)
    ?? clearTimeout;
  const mobileOverride = options.mobile;
  const initialTier = options.initialQualityTier ?? detectInitialQuality({
    viewportWidth: win?.innerWidth,
    deviceMemory: win?.navigator?.deviceMemory,
    hardwareConcurrency: win?.navigator?.hardwareConcurrency,
    saveData: connectionSaveData(win),
    reducedMotion: reducedMotion(win),
  });

  const records = new Map();
  const recordIdByElement = new WeakMap();
  let qualityTier = initialTier;
  let refreshHz = 60;
  let pageFrozen = Boolean(doc?.hidden);
  let listenersAttached = false;
  let resizeFrame = 0;
  let refreshFrame = 0;
  let refreshLast = 0;
  let refreshIntervals = [];

  const IntersectionObserverClass = options.IntersectionObserver
    ?? win?.IntersectionObserver
    ?? null;
  const observer = IntersectionObserverClass
    ? new IntersectionObserverClass((entries) => {
      for (const entry of entries) {
        const record = records.get(recordIdByElement.get(entry.target));
        if (!record) continue;
        record.inViewport = Boolean(entry.isIntersecting);
        record.intersectionRatio = Number(entry.intersectionRatio) || 0;
        reconcile(record);
      }
    }, { threshold: [0, 0.01, 0.25] })
    : null;

  function policyFor(record = {}) {
    const cost = record.cost || 'medium';
    const isMobile = mobileOverride ?? (
      (win?.innerWidth || 1440) < 768
      || Boolean(win?.matchMedia?.('(pointer: coarse)').matches)
    );
    const pixelBudget = pixelBudgetFor({ qualityTier, mobile: isMobile, cost });
    const deviceDpr = win?.devicePixelRatio || 1;
    return Object.freeze({
      qualityTier,
      refreshHz,
      pixelBudget,
      targetFps: record.targetFps || 60,
      reducedMotion: reducedMotion(win),
      computeDpr(cssWidth, cssHeight, limits = {}) {
        return computeBudgetDpr({
          cssWidth,
          cssHeight,
          deviceDpr,
          pixelBudget,
          minDpr: limits.minDpr,
          maxDpr: limits.maxDpr,
        });
      },
    });
  }

  function emitPolicy(record) {
    callSafely(record.onQualityChange, policyFor(record), `${record.id}:quality`);
  }

  function shouldRun(record) {
    return record.enabled && !pageFrozen && (record.observe === false || record.inViewport);
  }

  function reconcile(record) {
    const active = shouldRun(record);
    if (active === record.active) return;
    record.active = active;
    callSafely(active ? record.onResume : record.onPause, undefined, `${record.id}:${active ? 'resume' : 'pause'}`);
  }

  function reconcileAll() {
    for (const record of records.values()) reconcile(record);
  }

  function emitResize() {
    resizeFrame = 0;
    const viewport = Object.freeze({
      width: Math.max(1, win?.innerWidth || 1),
      height: Math.max(1, win?.innerHeight || 1),
      deviceDpr: win?.devicePixelRatio || 1,
    });
    for (const record of records.values()) {
      callSafely(record.onResize, viewport, `${record.id}:resize`);
    }
  }

  function queueResize() {
    if (!resizeFrame) resizeFrame = requestFrame(emitResize);
  }

  function setPageFrozen(next) {
    pageFrozen = Boolean(next);
    if (pageFrozen && refreshFrame) {
      cancelFrame(refreshFrame);
      refreshFrame = 0;
    }
    reconcileAll();
    if (!pageFrozen && refreshIntervals.length < 36) startRefreshSampling();
  }

  function onVisibilityChange() {
    setPageFrozen(Boolean(doc?.hidden));
  }

  function onPageHide() {
    setPageFrozen(true);
  }

  function onPageShow() {
    setPageFrozen(Boolean(doc?.hidden));
    queueResize();
  }

  function onDocumentFreeze() {
    setPageFrozen(true);
  }

  function onDocumentResume() {
    setPageFrozen(Boolean(doc?.hidden));
    queueResize();
  }

  function sampleRefresh(timestamp) {
    if (refreshLast) refreshIntervals.push(timestamp - refreshLast);
    refreshLast = timestamp;
    if (refreshIntervals.length >= 36) {
      refreshHz = estimateRefreshRate(refreshIntervals);
      refreshFrame = 0;
      for (const record of records.values()) emitPolicy(record);
      return;
    }
    refreshFrame = requestFrame(sampleRefresh);
  }

  function startRefreshSampling() {
    if (refreshFrame || pageFrozen || refreshIntervals.length >= 36) return;
    refreshLast = 0;
    refreshFrame = requestFrame(sampleRefresh);
  }

  function attachListeners() {
    if (listenersAttached) return;
    listenersAttached = true;
    pageFrozen = Boolean(doc?.hidden);
    doc?.addEventListener?.('visibilitychange', onVisibilityChange);
    doc?.addEventListener?.('freeze', onDocumentFreeze);
    doc?.addEventListener?.('resume', onDocumentResume);
    win?.addEventListener?.('resize', queueResize, { passive: true });
    win?.addEventListener?.('orientationchange', queueResize, { passive: true });
    win?.addEventListener?.('pagehide', onPageHide);
    win?.addEventListener?.('pageshow', onPageShow);
    startRefreshSampling();
  }

  function detachListeners() {
    if (!listenersAttached) return;
    listenersAttached = false;
    doc?.removeEventListener?.('visibilitychange', onVisibilityChange);
    doc?.removeEventListener?.('freeze', onDocumentFreeze);
    doc?.removeEventListener?.('resume', onDocumentResume);
    win?.removeEventListener?.('resize', queueResize);
    win?.removeEventListener?.('orientationchange', queueResize);
    win?.removeEventListener?.('pagehide', onPageHide);
    win?.removeEventListener?.('pageshow', onPageShow);
    if (resizeFrame) cancelFrame(resizeFrame);
    if (refreshFrame) cancelFrame(refreshFrame);
    resizeFrame = 0;
    refreshFrame = 0;
  }

  function setQualityTier(nextTier) {
    const next = stepQualityTier(nextTier, 0, initialTier);
    if (next === qualityTier) return;
    qualityTier = next;
    for (const record of records.values()) emitPolicy(record);
    queueResize();
  }

  function evaluateRecord(record) {
    const result = evaluateFrameWindow({
      samples: record.frameSamples,
      refreshHz,
      targetFps: record.targetFps,
    });
    record.p95Ms = result.p95Ms;
    record.frameSamples.length = 0;
    if (result.state === 'over-budget') {
      record.slowWindows += 1;
      record.headroomWindows = 0;
      if (record.slowWindows >= 2) {
        record.slowWindows = 0;
        setQualityTier(stepQualityTier(qualityTier, -1, initialTier));
      }
    } else if (result.state === 'headroom') {
      record.headroomWindows += 1;
      record.slowWindows = 0;
      if (record.headroomWindows >= 8) {
        record.headroomWindows = 0;
        setQualityTier(stepQualityTier(qualityTier, 1, initialTier));
      }
    } else {
      record.slowWindows = 0;
      record.headroomWindows = 0;
    }
  }

  function register(spec = {}) {
    const id = String(spec.id || '');
    if (!id) throw new Error('Render surface id is required.');
    if (records.has(id)) throw new Error(`Render surface "${id}" is already registered.`);

    const record = {
      id,
      element: spec.element || null,
      observe: spec.observe !== false,
      cost: spec.cost || 'medium',
      targetFps: Math.max(1, Number(spec.targetFps) || 60),
      enabled: spec.enabled !== false,
      inViewport: spec.observe === false || !observer || !spec.element,
      intersectionRatio: spec.observe === false || !observer || !spec.element ? 1 : 0,
      active: false,
      onPause: spec.onPause || noop,
      onResume: spec.onResume || noop,
      onResize: spec.onResize || noop,
      onQualityChange: spec.onQualityChange || noop,
      onDispose: spec.onDispose || noop,
      frameSamples: [],
      p95Ms: 0,
      slowWindows: 0,
      headroomWindows: 0,
    };

    records.set(id, record);
    if (record.element && record.observe && observer) {
      recordIdByElement.set(record.element, id);
      observer.observe(record.element);
    }
    attachListeners();
    emitPolicy(record);
    callSafely(record.onResize, {
      width: Math.max(1, win?.innerWidth || 1),
      height: Math.max(1, win?.innerHeight || 1),
      deviceDpr: win?.devicePixelRatio || 1,
    }, `${id}:resize`);
    reconcile(record);

    let released = false;
    function release(dispose) {
      if (released) return;
      released = true;
      record.enabled = false;
      reconcile(record);
      if (record.element && record.observe && observer) {
        observer.unobserve(record.element);
        recordIdByElement.delete(record.element);
      }
      records.delete(id);
      if (dispose) callSafely(record.onDispose, undefined, `${id}:dispose`);
      if (!records.size) detachListeners();
    }

    return Object.freeze({
      id,
      pause() {
        record.enabled = false;
        reconcile(record);
      },
      resume() {
        record.enabled = true;
        reconcile(record);
      },
      unregister() {
        release(false);
      },
      dispose() {
        release(true);
      },
      reportFrame(durationMs) {
        if (!record.active || !Number.isFinite(durationMs) || durationMs <= 0 || durationMs > 250) return;
        record.frameSamples.push(durationMs);
        if (record.frameSamples.length >= 90) evaluateRecord(record);
      },
      getPolicy() {
        return policyFor(record);
      },
    });
  }

  function destroy() {
    for (const record of [...records.values()]) {
      record.enabled = false;
      reconcile(record);
      if (record.element && record.observe && observer) {
        observer.unobserve(record.element);
        recordIdByElement.delete(record.element);
      }
      callSafely(record.onDispose, undefined, `${record.id}:dispose`);
    }
    records.clear();
    observer?.disconnect?.();
    detachListeners();
  }

  return Object.freeze({
    register,
    destroy,
    getPolicy(spec = {}) {
      return policyFor(spec);
    },
    getTelemetry() {
      return Object.freeze({
        qualityTier,
        qualityCeiling: initialTier,
        refreshHz,
        pageFrozen,
        activeSurfaces: [...records.values()].filter((record) => record.active).length,
        surfaces: [...records.values()].map((record) => Object.freeze({
          id: record.id,
          active: record.active,
          cost: record.cost,
          targetFps: record.targetFps,
          p95Ms: record.p95Ms,
        })),
      });
    },
  });
}

let singleton;

export function getRenderBudgetCoordinator() {
  if (!singleton) singleton = createRenderBudgetCoordinator();
  return singleton;
}
