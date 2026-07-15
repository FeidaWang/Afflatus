import { describe, it, expect } from 'vitest';
import {
  selector, sequence, condition, action,
  createBlackboard, createTacticalTree, selectIntent,
} from '../src/bootengine/hbt';

describe('BT combinators', () => {
  it('selector returns the first non-failure child', () => {
    const calls = [];
    const tree = selector(
      (bb) => { calls.push('a'); return 'failure'; },
      (bb) => { calls.push('b'); return 'success'; },
      (bb) => { calls.push('c'); return 'success'; },
    );
    expect(tree({})).toBe('success');
    expect(calls).toEqual(['a', 'b']); // 'c' never reached
  });

  it('selector returns failure if all children fail', () => {
    const tree = selector(() => 'failure', () => 'failure');
    expect(tree({})).toBe('failure');
  });

  it('sequence requires every child to succeed', () => {
    const calls = [];
    const tree = sequence(
      (bb) => { calls.push('a'); return 'success'; },
      (bb) => { calls.push('b'); return 'failure'; },
      (bb) => { calls.push('c'); return 'success'; },
    );
    expect(tree({})).toBe('failure');
    expect(calls).toEqual(['a', 'b']); // short-circuits, 'c' never reached
  });

  it('condition maps a predicate to success/failure', () => {
    expect(condition((bb) => bb.x > 0)({ x: 1 })).toBe('success');
    expect(condition((bb) => bb.x > 0)({ x: -1 })).toBe('failure');
  });

  it('action always returns success and can mutate the blackboard', () => {
    const bb = { count: 0 };
    const status = action((b) => { b.count += 1; })(bb);
    expect(status).toBe('success');
    expect(bb.count).toBe(1);
  });
});

describe('createTacticalTree / selectIntent — intent switching coverage', () => {
  const cases = [
    // [description, overrides, expected intent]
    ['critical energy overrides even a tail chaser', { energyPct: 0.1, targetOnTail: true, range: 10 }, 'disengage'],
    ['being chased at close range → scissors', { targetOnTail: true, range: 20, energyPct: 1 }, 'scissors'],
    ['being chased at long range → breakTurn', { targetOnTail: true, range: 80, energyPct: 1 }, 'breakTurn'],
    ['good gun position → tailChase', { targetOnTail: false, range: 25, aspectDeg: 10, energyPct: 1 }, 'tailChase'],
    ['drifted far from formation → formationRejoin', { targetOnTail: false, range: 250, aspectDeg: 90, energyPct: 1 }, 'formationRejoin'],
    ['nothing urgent → holdFormation', { targetOnTail: false, range: 100, aspectDeg: 90, energyPct: 1 }, 'holdFormation'],
  ];

  for (const [desc, overrides, expected] of cases) {
    it(desc, () => {
      const bb = createBlackboard(overrides);
      expect(selectIntent(bb)).toBe(expected);
      expect(bb.intent).toBe(expected); // tree writes into the blackboard too
    });
  }

  it('is deterministic given the same blackboard (golden-set requirement)', () => {
    const tree = createTacticalTree();
    const a = selectIntent(createBlackboard({ targetOnTail: true, range: 80 }), tree);
    const b = selectIntent(createBlackboard({ targetOnTail: true, range: 80 }), tree);
    expect(a).toBe(b);
  });

  it('never returns null/undefined — the tree always resolves to an intent', () => {
    // an "impossible" blackboard should still fall through to holdFormation
    const bb = createBlackboard({ range: -5, aspectDeg: NaN, energyPct: 1, targetOnTail: false });
    expect(selectIntent(bb)).toBe('holdFormation');
  });
});
