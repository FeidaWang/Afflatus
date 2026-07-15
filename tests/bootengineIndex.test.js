import { describe, it, expect } from 'vitest';
import { createSimClient } from '../src/bootengine/index';

const finiteV = (v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);

describe('createSimClient — inline fallback (no Worker in this environment)', () => {
  it('tick() resolves to a finite FighterSimState', async () => {
    const client = createSimClient({ seed: 5 });
    const state = await client.tick({ x: 10, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 0.02);
    expect(finiteV(state.body.pos)).toBe(true);
    expect(finiteV(state.body.vel)).toBe(true);
  });

  it('getState() reflects the latest tick', async () => {
    const client = createSimClient({ seed: 5 });
    expect(client.getState()).toBeTruthy();
    const s1 = await client.tick({ x: 10, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 0.02);
    expect(client.getState()).toEqual(s1);
    const s2 = await client.tick({ x: 10, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 0.02);
    expect(client.getState()).toEqual(s2);
    expect(s2).not.toEqual(s1);
  });

  it('terminate() does not throw', () => {
    const client = createSimClient({ seed: 5 });
    expect(() => client.terminate()).not.toThrow();
  });

  it('same seed → identical tick sequence across two independent clients', async () => {
    const a = createSimClient({ seed: 77 });
    const b = createSimClient({ seed: 77 });
    for (let i = 0; i < 20; i++) {
      const sa = await a.tick({ x: 15, y: 1, z: -5 }, { x: 0, y: 0, z: 1 }, 0.02);
      const sb = await b.tick({ x: 15, y: 1, z: -5 }, { x: 0, y: 0, z: 1 }, 0.02);
      expect(sa).toEqual(sb);
    }
  });

  it('passing a workerUrl in a Worker-less environment still falls back cleanly', async () => {
    const client = createSimClient({ seed: 3, workerUrl: '/does-not-matter.js' });
    const state = await client.tick({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 0.02);
    expect(finiteV(state.body.pos)).toBe(true);
  });

  it('accepts fighter overrides (initial state pass-through)', async () => {
    const client = createSimClient({
      seed: 1,
      fighter: { mass: 3, energyPct: 0.5 },
    });
    const state = await client.tick({ x: 5, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 0.02);
    expect(state.energyPct).toBe(0.5);
  });
});
