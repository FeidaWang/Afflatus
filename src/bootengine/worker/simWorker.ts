/* ============================================================
   SIM WORKER — U29 P1: thin Worker shell around simCore.ts's
   stepSimFrame. All actual logic (HBT/maneuvers/spline/PID/6DOF) lives in
   simCore.ts and is unit-tested there (tests/bootengineSimCore.test.js) —
   this file only exists to move that work off the main thread once P2
   wires it in from boot.js. Deliberately NOT covered by its own test file:
   constructing a real Worker isn't exercisable from vitest's node
   environment, and there is no logic here that isn't already covered by
   simCore's tests — this file stays intentionally tiny ("壳" = shell).

   `self`/`postMessage` are typed locally rather than by pulling in the
   "webworker" lib (which would conflict with this project's existing
   "dom" lib entry in tsconfig.json — a tsconfig split is a bigger, less
   surgical change than this one file needs).

   Protocol:
   → { type: 'init', seed?: number, fighter?: Partial<FighterSimState> }
   → { type: 'tick', targetPos: Vec3, targetVel: Vec3, dt: number }
   ← { type: 'state', state: FighterSimState }
   ============================================================ */

import { createFighterSimState, stepSimFrame, type FighterSimState } from '../simCore';
import { createRng } from '../seed';

declare const self: {
  onmessage: ((ev: { data: any }) => void) | null;
  postMessage: (msg: unknown) => void;
};

let state: FighterSimState = createFighterSimState();
let rng: () => number = createRng(1);

self.onmessage = (ev) => {
  const msg = ev.data;
  if (msg?.type === 'init') {
    rng = createRng(msg.seed ?? 1);
    state = createFighterSimState(msg.fighter);
    return;
  }
  if (msg?.type === 'tick') {
    state = stepSimFrame(state, {
      targetPos: msg.targetPos, targetVel: msg.targetVel, dt: msg.dt, rng,
    });
    self.postMessage({ type: 'state', state });
  }
};
