/* ============================================================
   BOOTENGINE — U29 P1: main-thread consumption interface. This is what
   boot.js will eventually import (P2+) — everything upstream (seed/pid/
   rigidBody6dof/catmullRom/maneuvers/hbt/simCore) is an internal
   implementation detail reachable through here.

   createSimClient() picks a transport and hides it behind one Promise-
   based API: if `Worker` exists AND a `workerUrl` was given, ticks run on
   worker/simWorker.ts off the main thread; otherwise (no Worker global —
   this project's SSR/test/node paths — or no workerUrl supplied yet,
   since P2 hasn't wired boot.js to one) ticks run inline via
   stepSimFrame() directly, wrapped in an already-resolved Promise so
   callers never need to branch on which transport they got. Both paths
   share the exact same simCore.ts logic — the ONLY difference is which
   thread runs it.
   ============================================================ */

import type { Vec3 } from './rigidBody6dof';
import { createFighterSimState, stepSimFrame, type FighterSimState } from './simCore';
import { createRng } from './seed';

export interface SimClient {
  tick(targetPos: Vec3, targetVel: Vec3, dt: number): Promise<FighterSimState>;
  getState(): FighterSimState;
  terminate(): void;
}

export interface CreateSimClientOptions {
  seed?: number;
  fighter?: Partial<FighterSimState>;
  workerUrl?: string | URL; // only used when a Worker is actually available
}

export function createSimClient(opts: CreateSimClientOptions = {}): SimClient {
  const seed = opts.seed ?? 1;
  let state = createFighterSimState(opts.fighter);

  const hasWorker = typeof Worker !== 'undefined' && opts.workerUrl != null;
  if (hasWorker) {
    const worker = new Worker(opts.workerUrl as string | URL, { type: 'module' });
    worker.postMessage({ type: 'init', seed, fighter: opts.fighter });
    let resolveTick: ((s: FighterSimState) => void) | null = null;
    worker.onmessage = (ev: MessageEvent) => {
      if (ev.data?.type === 'state') {
        state = ev.data.state;
        resolveTick?.(state);
        resolveTick = null;
      }
    };
    return {
      tick(targetPos, targetVel, dt) {
        return new Promise((resolve) => {
          resolveTick = resolve;
          worker.postMessage({ type: 'tick', targetPos, targetVel, dt });
        });
      },
      getState: () => state,
      terminate: () => worker.terminate(),
    };
  }

  // inline fallback — same semantics, synchronous stepSimFrame under a
  // resolved Promise. This is the path vitest (node, no Worker global)
  // and any pre-P2 caller without a workerUrl actually exercises.
  const rng = createRng(seed);
  return {
    tick(targetPos, targetVel, dt) {
      state = stepSimFrame(state, { targetPos, targetVel, dt, rng });
      return Promise.resolve(state);
    },
    getState: () => state,
    terminate() {},
  };
}

export type { FighterSimState } from './simCore';
export type { Intent, Blackboard } from './hbt';
export type { Vec3, Quat, Body6dof } from './rigidBody6dof';
