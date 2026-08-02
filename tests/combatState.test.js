import { describe, expect, it } from 'vitest';
import { createCombatState, solveIntercept } from '../src/combat/combatState.js';

describe('combat target solution', () => {
  it('solves a stationary contact in the simulation coordinate system', () => {
    const result = solveIntercept({
      shooter: { x: 0, y: 0 },
      target: { x: 100, y: 0 },
      velocity: { x: 0, y: 0 },
      projectileSpeed: 1,
    });
    expect(result.valid).toBe(true);
    expect(result.interceptMs).toBe(100);
    expect(result.aimPoint).toEqual({ x: 100, y: 0 });
  });

  it('leads a crossing contact and rejects an impossible pursuit', () => {
    const crossing = solveIntercept({
      shooter: { x: 0, y: 0 },
      target: { x: 100, y: 0 },
      velocity: { x: 0, y: 0.5 },
      projectileSpeed: 1,
    });
    expect(crossing.valid).toBe(true);
    expect(crossing.aimPoint.y).toBeGreaterThan(50);

    const escape = solveIntercept({
      shooter: { x: 0, y: 0 },
      target: { x: 100, y: 0 },
      velocity: { x: 2, y: 0 },
      projectileSpeed: 1,
    });
    expect(escape.valid).toBe(false);
  });
});

describe('authoritative combat state', () => {
  it('publishes one immutable snapshot and ordered semantic events', () => {
    let clock = 1000;
    const state = createCombatState({ now: () => clock });
    state.emit('target:acquired', { targetId: 'HALLEY-1' });
    clock += 20;
    state.emit('weapon:fire', { weapon: 'missile' });
    const snapshot = state.sync({
      now: clock,
      shooter: { x: 0, y: 100 },
      fireControl: { mode: 'manual', selectedWeapon: 'missile', activeWeapon: 'missile' },
      target: {
        id: 'HALLEY-1',
        x: 100,
        y: 0,
        vx: 0.01,
        vy: 0,
        hp: 30,
        hpMax: 34,
        lockProgress: 1,
        locked: true,
      },
      fleet: { hpPct: 92, ammoPct: 74, deckPct: 81, kills: 2 },
      escorts: [{ id: 'F47-1', type: 'f47', state: 'climb', x: 40, y: 80, vx: 1.5, vy: -2.5, hp: 96 }],
    });

    expect(snapshot.fireControl).toEqual({
      mode: 'manual',
      selectedWeapon: 'missile',
      activeWeapon: 'missile',
    });
    expect(snapshot.solution.valid).toBe(true);
    expect(snapshot.solution.lockQuality).toBe(100);
    expect(snapshot.events.map((event) => event.type)).toEqual(['target:acquired', 'weapon:fire']);
    expect(snapshot.escorts[0]).toMatchObject({ id: 'F47-1', vx: 1.5, vy: -2.5 });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(state.eventsAfter(1)).toHaveLength(1);
  });

  it('uses unavailable telemetry instead of invented instrument values', () => {
    const snapshot = createCombatState().sync({});
    expect(snapshot.telemetry.headingDeg).toBeNull();
    expect(snapshot.telemetry.speedKms).toBeNull();
    expect(snapshot.telemetry.gLoad).toBeNull();
    expect(snapshot.solution.valid).toBe(false);
  });
});
