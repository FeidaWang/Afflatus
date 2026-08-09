import { describe, expect, it, vi } from 'vitest';
import { createProgressiveRenderer, webGPUAvailable } from '../src/lib/renderBackendSelector.js';

function canvasFixture() {
  const listeners = new Map();
  const canvas = {
    width: 640,
    height: 360,
    dataset: {},
    addEventListener: vi.fn((type, listener) => listeners.set(type, listener)),
    removeEventListener: vi.fn((type) => listeners.delete(type)),
  };
  return { canvas, listeners };
}

describe('progressive render backend selection', () => {
  it('requires a secure WebGPU-capable scope', () => {
    expect(webGPUAvailable({ isSecureContext: true, navigator: { gpu: { requestAdapter() {} } } })).toBe(true);
    expect(webGPUAvailable({ isSecureContext: false, navigator: { gpu: { requestAdapter() {} } } })).toBe(false);
    expect(webGPUAvailable({ isSecureContext: true, navigator: {} })).toBe(false);
  });

  it('selects WebGPU and replaces its canvas with WebGL2 after device loss', async () => {
    const original = canvasFixture();
    const replacement = canvasFixture();
    let loseDevice;
    const lost = new Promise((resolve) => { loseDevice = resolve; });
    const webgpuRenderer = { backend: { device: { lost } }, dispose: vi.fn() };
    const webglRenderer = { dispose: vi.fn() };
    const changes = [];
    const controller = await createProgressiveRenderer({
      canvas: original.canvas,
      scope: { isSecureContext: true, navigator: { gpu: { requestAdapter() {} } } },
      createWebGPU: vi.fn(async () => webgpuRenderer),
      createWebGL2: vi.fn(async () => webglRenderer),
      replaceCanvas: vi.fn(() => replacement.canvas),
      onBackendChange: (state) => changes.push(state.backend),
    });
    expect(controller.backend).toBe('webgpu');
    loseDevice({ reason: 'destroyed' });
    await vi.waitFor(() => expect(controller.backend).toBe('webgl2'));
    expect(controller.canvas).toBe(replacement.canvas);
    expect(webgpuRenderer.dispose).toHaveBeenCalledOnce();
    expect(changes).toEqual(['webgpu', 'webgl2']);
  });

  it('uses WebGL2 when WebGPU init fails, then falls through to poster on context loss', async () => {
    const original = canvasFixture();
    const replacement = canvasFixture();
    const controller = await createProgressiveRenderer({
      canvas: original.canvas,
      scope: { isSecureContext: true, navigator: { gpu: { requestAdapter() {} } } },
      createWebGPU: vi.fn(async () => { throw new Error('adapter failed'); }),
      createWebGL2: vi.fn(async () => ({ dispose: vi.fn() })),
      replaceCanvas: () => replacement.canvas,
    });
    expect(controller.getState()).toMatchObject({ backend: 'webgl2', reason: 'webgpu-init-failed' });
    const event = { preventDefault: vi.fn() };
    replacement.listeners.get('webglcontextlost')(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(controller.backend).toBe('poster');
  });

  it('is abortable and disposes exactly once', async () => {
    const fixture = canvasFixture();
    const abortController = new AbortController();
    const renderer = { dispose: vi.fn(), forceContextLoss: vi.fn() };
    const controller = await createProgressiveRenderer({
      canvas: fixture.canvas,
      signal: abortController.signal,
      preferWebGPU: false,
      createWebGL2: vi.fn(async () => renderer),
      replaceCanvas: () => fixture.canvas,
    });
    abortController.abort();
    expect(controller.backend).toBe('poster');
    controller.dispose();
    controller.dispose();
    expect(renderer.dispose).toHaveBeenCalledOnce();
    expect(renderer.forceContextLoss).toHaveBeenCalledOnce();
  });
});
