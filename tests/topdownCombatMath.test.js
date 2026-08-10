import { describe, expect, it } from 'vitest';
import {
  cometTailDirection,
  cometVisualProfile,
  phaseCameraCue,
} from '../src/scene/topdownCombatMath.js';

describe('topdown combat visual math', () => {
  it('keeps an unlocked target optically readable and intensifies it on lock', () => {
    const prelock = cometVisualProfile({ sizeClass: 'medium', radius: 54, lockProgress: 0 });
    const locked = cometVisualProfile({ sizeClass: 'medium', radius: 54, locked: true });

    expect(prelock.scale).toBe(1);
    expect(prelock.rockOpacity).toBeGreaterThanOrEqual(0.7);
    expect(prelock.ionOpacity).toBeGreaterThanOrEqual(0.78);
    expect(prelock.dustOpacity).toBeGreaterThanOrEqual(0.58);
    expect(prelock.comaOpacity).toBeGreaterThanOrEqual(0.4);
    expect(locked.rockOpacity).toBeGreaterThan(prelock.rockOpacity);
    expect(locked.ionOpacity).toBeGreaterThan(prelock.ionOpacity);
    expect(locked.dustOpacity).toBeGreaterThan(prelock.dustOpacity);
  });

  it('combines authoritative radius and threat class without unbounded scale', () => {
    expect(cometVisualProfile({ sizeClass: 'small', radius: 28 }).scale).toBeCloseTo(0.72);
    expect(cometVisualProfile({ sizeClass: 'large', radius: 96 }).scale).toBeCloseTo(1.48);
    expect(cometVisualProfile({ sizeClass: 'giant', radius: 240 }).scale).toBe(2.55);
  });

  it('points both comet wakes opposite authoritative screen velocity', () => {
    const tail = cometTailDirection({ vx: 4, vy: -3 }, 52, 32);
    expect(tail.x).toBeCloseTo(-0.8);
    expect(tail.y).toBe(0);
    expect(tail.z).toBeCloseTo(0.6);
    expect(tail.x * 4 + tail.z * -3).toBeLessThan(0);
    expect(cometTailDirection({ vx: 0, vy: 0 })).toEqual({ x: 0, y: 0, z: 1 });
  });

  it('maps named CIC phases to bounded weapon-camera cues', () => {
    expect(phaseCameraCue('ciws')).toMatchObject({ shot: 'ciwsTurret', durationMs: 3200 });
    expect(phaseCameraCue('nukeAuth')).toMatchObject({ shot: 'nukeEscort' });
    expect(phaseCameraCue('nemp')).toMatchObject({ shot: 'nukeTerminal' });
    expect(phaseCameraCue('mainGun')).toMatchObject({ shot: 'mainGunBroadside' });
    expect(phaseCameraCue('standby')).toBeNull();
  });
});
