import { describe, expect, it } from 'vitest';
import { createExclusiveRenderer } from '../src/lib/exclusiveRenderer.js';

describe('exclusive renderer ownership', () => {
  it('destroys the old renderer before activating another', async () => {
    const events = [];
    const controller = createExclusiveRenderer();
    await controller.activate('2d', async () => ({
      destroy() { events.push('destroy:2d'); },
    }));
    await controller.activate('3d', async () => {
      events.push('mount:3d');
      return { destroy() { events.push('destroy:3d'); } };
    });

    expect(events).toEqual(['destroy:2d', 'mount:3d']);
    expect(controller.activeId).toBe('3d');
    controller.deactivate();
    expect(events.at(-1)).toBe('destroy:3d');
    expect(controller.activeId).toBeNull();
  });

  it('disposes a stale asynchronous mount', async () => {
    const events = [];
    const controller = createExclusiveRenderer();
    let resolveSlow;
    const slow = controller.activate('slow', () => new Promise((resolve) => {
      resolveSlow = resolve;
    }));
    const fast = controller.activate('fast', async () => ({
      destroy() { events.push('destroy:fast'); },
    }));
    resolveSlow({ destroy() { events.push('destroy:slow'); } });

    await Promise.all([slow, fast]);
    expect(events).toContain('destroy:slow');
    expect(controller.activeId).toBe('fast');
  });
});
