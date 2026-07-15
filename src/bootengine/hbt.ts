/* ============================================================
   HBT — U29 P1: Hierarchical Behavior Tree toolkit + the "战术意图层"
   (tactical intent layer) named in the framework: 甩尾(breakTurn) /
   剪刀(scissors) / 编队机动(formation maneuvering). No THREE.js, no DOM.

   This is stage 1 of the HBT pipeline (意图选择 → 机动库 → 样条轨迹生
   成): it looks at the current tactical situation (the Blackboard) and
   picks ONE intent. Stage 2 (maneuvers.ts) turns that intent into
   waypoints; stage 3 (catmullRom.ts) turns waypoints into a flyable curve.

   Node combinators (selector/sequence/condition/action) are the standard
   generic BT vocabulary — kept generic over the blackboard type so this
   file stays reusable for non-combat trees later (P3's "演出优先" camera
   scorer is a plausible second user), even though the only tree built here
   is the fixed-priority tactical one. Priority order encodes survival
   first, opportunism second, station-keeping last — the same instinct a
   human pilot's threat-prioritization would follow, per the "AI 行为要像
   表演，不像计算" brief: the ORDER of checks is itself dramatic logic
   (never abandon a kill shot for formation unless energy or a tail chaser
   forces it).
   ============================================================ */

export type NodeStatus = 'success' | 'failure' | 'running';
export type BTNode<B> = (blackboard: B) => NodeStatus;

export function selector<B>(...children: BTNode<B>[]): BTNode<B> {
  return (bb) => {
    for (const child of children) {
      const status = child(bb);
      if (status !== 'failure') return status;
    }
    return 'failure';
  };
}

export function sequence<B>(...children: BTNode<B>[]): BTNode<B> {
  return (bb) => {
    for (const child of children) {
      const status = child(bb);
      if (status !== 'success') return status;
    }
    return 'success';
  };
}

export function condition<B>(predicate: (bb: B) => boolean): BTNode<B> {
  return (bb) => (predicate(bb) ? 'success' : 'failure');
}

export function action<B>(fn: (bb: B) => void): BTNode<B> {
  return (bb) => { fn(bb); return 'success'; };
}

// ── tactical intent layer ────────────────────────────────────────────────
export type Intent =
  | 'disengage'       // energy critical — survival overrides everything else
  | 'scissors'        // being chased AND already merged (close range) — turning fight
  | 'breakTurn'        // being chased but not yet merged — 甩尾, shake the tail early
  | 'tailChase'        // good firing position on the target — press the attack
  | 'formationRejoin' // drifted too far from the formation — come home
  | 'holdFormation';  // nothing urgent — default/idle

export interface Blackboard {
  range: number;        // world units to target
  aspectDeg: number;    // 0 = dead astern of target (gun solution), 180 = head-on
  energyPct: number;    // 0..1, this fighter's energy state
  targetOnTail: boolean; // true if the TARGET is behind US
  intent: Intent | null; // output slot the tree writes into
}

export function createBlackboard(overrides: Partial<Blackboard> = {}): Blackboard {
  return {
    range: 100,
    aspectDeg: 90,
    energyPct: 1,
    targetOnTail: false,
    intent: null,
    ...overrides,
  };
}

function setIntent(target: Intent): BTNode<Blackboard> {
  return action((bb) => { bb.intent = target; });
}

// fixed priority order — see header for why the order itself is the design.
export function createTacticalTree(): BTNode<Blackboard> {
  return selector<Blackboard>(
    sequence(condition((bb) => bb.energyPct < 0.2), setIntent('disengage')),
    sequence(condition((bb) => bb.targetOnTail && bb.range < 30), setIntent('scissors')),
    sequence(condition((bb) => bb.targetOnTail), setIntent('breakTurn')),
    sequence(condition((bb) => bb.range < 40 && bb.aspectDeg < 30), setIntent('tailChase')),
    sequence(condition((bb) => bb.range > 200), setIntent('formationRejoin')),
    setIntent('holdFormation'), // always succeeds — the tree never returns failure
  );
}

// convenience: run the tactical tree against a blackboard, return the
// chosen intent. Resets bb.intent first so a stale value never leaks
// through if a future tree revision has a gap in its branches.
export function selectIntent(bb: Blackboard, tree: BTNode<Blackboard> = createTacticalTree()): Intent {
  bb.intent = null;
  tree(bb);
  return bb.intent ?? 'holdFormation';
}
