import { describe, expect, it, vi } from 'vitest';
import { computeKeyboardInset, mountViewportRuntime } from '../src/lib/viewportRuntime.js';

describe('viewport runtime', () => {
  it('computes only the occluded layout-viewport area', () => {
    expect(computeKeyboardInset(956, 620, 0)).toBe(336);
    expect(computeKeyboardInset(956, 900, 56)).toBe(0);
    expect(computeKeyboardInset(956, 900, -10)).toBe(56);
    expect(computeKeyboardInset(undefined, 900, 0)).toBe(0);
  });

  it('coalesces viewport updates and removes every listener on dispose', () => {
    const listeners = new Map();
    const visualListeners = new Map();
    const style = {
      setProperty: vi.fn(),
      removeProperty: vi.fn(),
    };
    const root = { dataset: {}, style };
    Object.defineProperty(root, 'clientHeight', {
      get: vi.fn(() => {
        throw new Error('clientHeight should not be read during viewport updates');
      }),
    });
    const visualViewport = {
      height: 620,
      offsetTop: 0,
      addEventListener: vi.fn((name, fn) => visualListeners.set(name, fn)),
      removeEventListener: vi.fn(),
    };
    let callback;
    const win = {
      innerHeight: 956,
      visualViewport,
      requestAnimationFrame: vi.fn((fn) => { callback = fn; return 17; }),
      cancelAnimationFrame: vi.fn(),
      addEventListener: vi.fn((name, fn) => listeners.set(name, fn)),
      removeEventListener: vi.fn(),
    };

    const dispose = mountViewportRuntime({ win, root });
    listeners.get('resize')();
    visualListeners.get('resize')();
    expect(win.requestAnimationFrame).toHaveBeenCalledTimes(1);
    callback();
    expect(style.setProperty).toHaveBeenCalledWith('--keyboard-inset', '336px');
    expect(root.dataset.keyboardOpen).toBe('true');

    dispose();
    expect(visualViewport.removeEventListener).toHaveBeenCalledTimes(2);
    expect(win.removeEventListener).toHaveBeenCalledTimes(2);
    expect(root.dataset.keyboardOpen).toBeUndefined();
  });
});
