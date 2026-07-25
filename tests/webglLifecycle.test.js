import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createWebGLContextLifecycle,
  disposeThreeScene,
  getWebGLContextTelemetry,
  resetWebGLLifecycleForTest,
} from '../src/lib/webglLifecycle.js';

function eventTarget() {
  const listeners = new Map();
  return {
    dataset: {},
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatch(type) {
      const event = { preventDefault: vi.fn() };
      for (const listener of listeners.get(type) || []) listener(event);
      return event;
    },
    listenerCount(type) {
      return listeners.get(type)?.size || 0;
    },
  };
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

afterEach(() => resetWebGLLifecycleForTest());

describe('WebGL context lifecycle', () => {
  it('restores once, then falls back after the second loss in the session', () => {
    const canvas = eventTarget();
    const storage = memoryStorage();
    const onLost = vi.fn();
    const onRestore = vi.fn();
    const onFallback = vi.fn();
    const lifecycle = createWebGLContextLifecycle({
      id: 'home:test',
      canvas,
      storage,
      document: null,
      onLost,
      onRestore,
      onFallback,
    });

    expect(lifecycle.canInitialize).toBe(true);
    const firstLoss = canvas.dispatch('webglcontextlost');
    expect(firstLoss.preventDefault).toHaveBeenCalledOnce();
    canvas.dispatch('webglcontextrestored');
    expect(onRestore).toHaveBeenCalledWith(expect.objectContaining({ lossCount: 1 }));

    canvas.dispatch('webglcontextlost');
    expect(onLost).toHaveBeenCalledTimes(2);
    expect(onFallback).toHaveBeenCalledWith(expect.objectContaining({ reason: 'repeated-loss' }));
    expect(lifecycle.getState()).toMatchObject({ fallback: true, leased: false, lossCount: 2 });
    expect(canvas.dataset.renderer).toBe('poster');
    expect(lifecycle.signal.aborted).toBe(true);
  });

  it('enforces a hard simultaneous-context cap and releases leases once', () => {
    const first = createWebGLContextLifecycle({
      id: 'one',
      canvas: eventTarget(),
      contextLimit: 1,
      document: null,
    });
    const secondCanvas = eventTarget();
    const second = createWebGLContextLifecycle({
      id: 'two',
      canvas: secondCanvas,
      contextLimit: 1,
      document: null,
    });

    expect(first.canInitialize).toBe(true);
    expect(second.canInitialize).toBe(false);
    expect(second.getState().fallbackReason).toBe('context-cap');
    expect(secondCanvas.dataset.renderer).toBe('poster');
    expect(getWebGLContextTelemetry().activeContexts).toBe(1);

    first.dispose();
    first.dispose();
    expect(getWebGLContextTelemetry().activeContexts).toBe(0);
  });

  it('aborts pending work and removes listeners during disposal', () => {
    const canvas = eventTarget();
    const onDispose = vi.fn();
    const lifecycle = createWebGLContextLifecycle({
      id: 'dispose-test',
      canvas,
      document: null,
      onDispose,
    });

    lifecycle.dispose();
    lifecycle.dispose();
    expect(lifecycle.signal.aborted).toBe(true);
    expect(canvas.listenerCount('webglcontextlost')).toBe(0);
    expect(canvas.listenerCount('webglcontextrestored')).toBe(0);
    expect(onDispose).toHaveBeenCalledOnce();
  });
});

describe('Three.js resource disposal', () => {
  it('de-duplicates geometries, materials, textures and releases the context', () => {
    const geometry = { dispose: vi.fn() };
    const texture = { isTexture: true, dispose: vi.fn() };
    const material = { map: texture, uniforms: { value: texture }, dispose: vi.fn() };
    const renderer = {
      renderLists: { dispose: vi.fn() },
      dispose: vi.fn(),
      forceContextLoss: vi.fn(),
    };
    const root = {
      traverse(callback) {
        callback({ geometry, material });
        callback({ geometry, material: [material] });
      },
    };

    expect(disposeThreeScene(root, renderer)).toEqual({
      geometries: 1,
      materials: 1,
      textures: 1,
    });
    expect(geometry.dispose).toHaveBeenCalledOnce();
    expect(material.dispose).toHaveBeenCalledOnce();
    expect(texture.dispose).toHaveBeenCalledOnce();
    expect(renderer.dispose).toHaveBeenCalledOnce();
    expect(renderer.forceContextLoss).toHaveBeenCalledOnce();
  });
});
