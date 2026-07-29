import { describe, expect, it, vi } from 'vitest';
import { createRenderBudgetCoordinator } from '../src/lib/renderBudgetCoordinator.js';

function eventTarget(seed = {}) {
  const listeners = new Map();
  return {
    ...seed,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatch(type) {
      for (const listener of listeners.get(type) || []) listener({ type });
    },
    listenerCount(type) {
      return listeners.get(type)?.size || 0;
    },
  };
}

function harness() {
  let nextFrameId = 0;
  const frames = new Map();
  const document = eventTarget({ hidden: false });
  const window = eventTarget({
    innerWidth: 1440,
    innerHeight: 900,
    devicePixelRatio: 2,
    navigator: { hardwareConcurrency: 8, deviceMemory: 8 },
    matchMedia: () => ({ matches: false }),
  });
  const requestAnimationFrame = (callback) => {
    nextFrameId += 1;
    frames.set(nextFrameId, callback);
    return nextFrameId;
  };
  const cancelAnimationFrame = (id) => frames.delete(id);
  const flushFrame = (timestamp = 16.67) => {
    const queued = [...frames.values()];
    frames.clear();
    for (const callback of queued) callback(timestamp);
  };
  const coordinator = createRenderBudgetCoordinator({
    window,
    document,
    requestAnimationFrame,
    cancelAnimationFrame,
    IntersectionObserver: null,
    initialQualityTier: 'high',
  });
  return { coordinator, document, window, flushFrame };
}

describe('render budget coordinator', () => {
  it('owns shared page lifecycle and removes listeners after release', () => {
    const { coordinator, document, window } = harness();
    const onResume = vi.fn();
    const onPause = vi.fn();
    const onResize = vi.fn();
    const handle = coordinator.register({
      id: 'test:surface',
      observe: false,
      onResume,
      onPause,
      onResize,
    });

    expect(onResize).toHaveBeenCalledTimes(1);
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(document.listenerCount('visibilitychange')).toBe(1);

    document.hidden = true;
    document.dispatch('visibilitychange');
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(coordinator.getTelemetry().pageFrozen).toBe(true);

    document.hidden = false;
    document.dispatch('visibilitychange');
    expect(onResume).toHaveBeenCalledTimes(2);

    handle.unregister();
    expect(onPause).toHaveBeenCalledTimes(2);
    expect(document.listenerCount('visibilitychange')).toBe(0);
    expect(window.listenerCount('resize')).toBe(0);
  });

  it('does not start a late-registered surface while the document is already hidden', () => {
    const { coordinator, document } = harness();
    const onResume = vi.fn();
    const onPause = vi.fn();
    document.hidden = true;
    const handle = coordinator.register({
      id: 'test:late-hidden',
      observe: false,
      onResume,
      onPause,
    });

    expect(onResume).not.toHaveBeenCalled();
    document.hidden = false;
    document.dispatch('visibilitychange');
    expect(onResume).toHaveBeenCalledTimes(1);
    handle.unregister();
  });

  it('coalesces shared resize work and exposes a surface-specific DPR policy', () => {
    const { coordinator, window, flushFrame } = harness();
    const onResize = vi.fn();
    const handle = coordinator.register({
      id: 'test:webgl',
      observe: false,
      cost: 'high',
      onResize,
    });

    const dpr = handle.getPolicy().computeDpr(2560, 1440, { minDpr: 0.6, maxDpr: 2 });
    expect(dpr).toBeLessThan(1);

    window.innerWidth = 900;
    window.dispatch('resize');
    window.dispatch('resize');
    flushFrame();
    expect(onResize).toHaveBeenCalledTimes(2);
    expect(onResize).toHaveBeenLastCalledWith(expect.objectContaining({ width: 900 }));
  });

  it('uses one intersection registry to pause off-screen surfaces', () => {
    let observer;
    class FakeIntersectionObserver {
      constructor(callback) {
        this.callback = callback;
        this.observed = new Set();
        observer = this;
      }
      observe(element) { this.observed.add(element); }
      unobserve(element) { this.observed.delete(element); }
      disconnect() { this.observed.clear(); }
      emit(element, isIntersecting) {
        this.callback([{ target: element, isIntersecting, intersectionRatio: isIntersecting ? 1 : 0 }]);
      }
    }
    const document = eventTarget({ hidden: false });
    const window = eventTarget({
      innerWidth: 1200,
      innerHeight: 800,
      devicePixelRatio: 2,
      navigator: {},
      matchMedia: () => ({ matches: false }),
    });
    const coordinator = createRenderBudgetCoordinator({
      window,
      document,
      IntersectionObserver: FakeIntersectionObserver,
      requestAnimationFrame: () => 1,
      cancelAnimationFrame: () => {},
      initialQualityTier: 'high',
    });
    const element = {};
    const onResume = vi.fn();
    const onPause = vi.fn();
    const handle = coordinator.register({
      id: 'test:intersection',
      element,
      onResume,
      onPause,
    });

    expect(onResume).not.toHaveBeenCalled();
    observer.emit(element, true);
    expect(onResume).toHaveBeenCalledTimes(1);
    observer.emit(element, false);
    expect(onPause).toHaveBeenCalledTimes(1);

    handle.unregister();
    expect(observer.observed.size).toBe(0);
  });

  it('degrades only after sustained over-budget frame windows', () => {
    const { coordinator } = harness();
    const handle = coordinator.register({
      id: 'test:adaptive',
      observe: false,
      targetFps: 60,
    });

    for (let i = 0; i < 90; i += 1) handle.reportFrame(30, { drawCalls: 42, triangles: 12000 });
    expect(coordinator.getTelemetry().qualityTier).toBe('high');
    expect(coordinator.getTelemetry().surfaces[0]).toEqual(expect.objectContaining({
      drawCalls: 42,
      triangles: 12000,
      thermalState: 'warm',
    }));
    for (let i = 0; i < 90; i += 1) handle.reportFrame(30);
    expect(coordinator.getTelemetry().qualityTier).toBe('balanced');
    expect(coordinator.getTelemetry().surfaces[0].p95Ms).toBe(30);
    expect(coordinator.getTelemetry().surfaces[0].thermalState).toBe('hot');
  });

  it('rejects duplicate ids and invokes dispose hooks exactly once', () => {
    const { coordinator } = harness();
    const onDispose = vi.fn();
    const handle = coordinator.register({
      id: 'test:unique',
      observe: false,
      onDispose,
    });
    expect(() => coordinator.register({ id: 'test:unique' })).toThrow(/already registered/);
    handle.dispose();
    handle.dispose();
    expect(onDispose).toHaveBeenCalledTimes(1);
  });
});
