import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createCombatVfx } from '../src/scene/combatVfx.js';

describe('combat VFX pool', () => {
  it('shares all effects across three bounded non-mesh draw calls', () => {
    const scene = new THREE.Scene();
    const vfx = createCombatVfx(THREE, { scene, qualityTier: 'high' });
    const now = performance.now();
    vfx.update(now);

    expect(vfx.linkedBeam({
      from: new THREE.Vector3(0, 0, 0),
      to: new THREE.Vector3(2, 0, -4),
    })).toBe(true);
    expect(vfx.charge({ at: [0, 0, -2], radius: 0.8 })).toBe(true);
    expect(vfx.fireSmoke({ at: [0, 0, -3], velocity: [0, 0.4, 0], nuclear: true })).toBe(true);
    expect(vfx.shieldArc({ center: [0, 0, -4], hitDirection: [1, 0, 0], radius: 2 })).toBe(true);
    expect(vfx.bloom({ at: [0, 0, -1], size: 1.4 })).toBe(true);
    vfx.update(now + 32, new THREE.PerspectiveCamera(55, 1, 0.1, 100));

    expect(scene.children).toHaveLength(3);
    expect(scene.children.filter((child) => child.isMesh)).toHaveLength(0);
    expect(scene.children.filter((child) => child.isPoints)).toHaveLength(2);
    expect(scene.children.filter((child) => child.isLineSegments)).toHaveLength(1);
    expect(vfx.getDiagnostics()).toMatchObject({
      qualityTier: 'high',
      drawCalls: 3,
      active: {
        linkedBeams: 1,
        shieldArcs: 1,
      },
    });

    vfx.dispose();
    expect(scene.children).toHaveLength(0);
    expect(vfx.getDiagnostics().drawCalls).toBe(0);
  });

  it('cuts low-tier capacity sharply and drops overflow instead of growing', () => {
    const scene = new THREE.Scene();
    const vfx = createCombatVfx(THREE, { scene, qualityTier: 'high' });
    const high = vfx.getDiagnostics().capacities;
    vfx.setQuality('low');
    const low = vfx.getDiagnostics().capacities;

    expect(low.energy).toBeLessThan(high.energy / 2);
    expect(low.smoke).toBeLessThan(high.smoke / 2);
    expect(low.lineVertices).toBeLessThan(high.lineVertices / 2);

    const now = performance.now();
    vfx.update(now);
    for (let index = 0; index < 120; index += 1) {
      vfx.fireSmoke({
        at: [index * 0.01, 0, -2],
        velocity: [0, 0.2, 0],
        lifeMs: 1000,
      });
      vfx.linkedBeam({ from: [0, 0, 0], to: [1, 0, -2], lifeMs: 1000 });
    }
    vfx.update(now + 16);
    const diagnostics = vfx.getDiagnostics();

    expect(diagnostics.active.energy).toBeLessThanOrEqual(low.energy);
    expect(diagnostics.active.smoke).toBeLessThanOrEqual(low.smoke);
    expect(diagnostics.active.linkedBeams + diagnostics.active.shieldArcs).toBeLessThanOrEqual(low.lineEvents);
    expect(diagnostics.dropped.energy + diagnostics.dropped.smoke + diagnostics.dropped.lines).toBeGreaterThan(0);

    vfx.update(now + 9000);
    expect(vfx.getDiagnostics().active).toEqual({
      energy: 0,
      smoke: 0,
      linkedBeams: 0,
      shieldArcs: 0,
    });
    vfx.dispose();
  });

  it('timestamps resumed-frame spawns before updating and sizes points from the viewport', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    const vfx = createCombatVfx(THREE, { scene, qualityTier: 'medium' });
    vfx.update(0, camera, 800);

    vfx.beginFrame(10_000);
    expect(vfx.bloom({ at: [0, 0, -4], lifeMs: 180 })).toBe(true);
    vfx.update(10_000, camera, 800);

    expect(vfx.getDiagnostics().active.energy).toBe(1);
    const energyLayer = scene.children.find((child) => child.isPoints && child.material.blending === THREE.AdditiveBlending);
    expect(energyLayer.material.uniforms.uCameraScale.value).toBeCloseTo(400 / Math.tan(THREE.MathUtils.degToRad(20)), 5);
    vfx.dispose();
  });

  it('keeps continuous missile plumes light enough to preserve impact smoke capacity', () => {
    const scene = new THREE.Scene();
    const vfx = createCombatVfx(THREE, { scene, qualityTier: 'medium' });
    vfx.beginFrame(500);
    for (let index = 0; index < 12; index += 1) {
      vfx.fireSmoke({
        at: [index * 0.1, 0, -3],
        velocity: [0, 0, 0.2],
        lifeMs: 900,
        continuous: true,
      });
    }
    const plumeSmoke = vfx.getDiagnostics().active.smoke;
    expect(vfx.fireSmoke({ at: [2, 0, -6], nuclear: true, scale: 2.5, lifeMs: 1800 })).toBe(true);
    const impact = vfx.getDiagnostics();

    expect(impact.active.smoke).toBeGreaterThan(plumeSmoke);
    expect(impact.dropped.smoke).toBe(0);
    vfx.dispose();
  });
});
