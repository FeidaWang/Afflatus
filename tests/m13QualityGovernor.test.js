import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createQualityGovernor,
  GOVERNOR_THRESHOLDS,
  qualitySettingsForLevel,
} from '../src/showcase/experience/qualityGovernor.js';
import { RENDER_BUDGETS, RESOURCE_MATRIX } from '../src/showcase/experience/qualityProfile.js';
import { measureSceneResources } from '../src/showcase/experience/resourceMetrics.js';
import * as THREE from 'three';

const sceneSource = readFileSync('src/showcase/experience/SignatureScene.jsx', 'utf8');

describe('M13 resource and quality governance', () => {
  it('defines the five public resource tiers and target frame budgets', () => {
    expect(Object.keys(RESOURCE_MATRIX)).toEqual(['high', 'medium', 'mobile', 'static', 'reduced']);
    expect(RESOURCE_MATRIX.high).toMatchObject({ bloom: true, carrierLod: 'full', surfaceTextures: 'ktx2-basis' });
    expect(RESOURCE_MATRIX.mobile).toMatchObject({ bloom: false, carrierLod: 'reduced' });
    expect(RESOURCE_MATRIX.reduced.carrierLod).toBe('poster');
    expect(RENDER_BUDGETS.high.fps).toBe(60);
    expect(RENDER_BUDGETS.medium.fps).toBeGreaterThanOrEqual(40);
    expect(RENDER_BUDGETS.mobile.fps).toBe(30);
  });

  it('degrades DPR, dust, then bloom after sustained slow frames and cooldowns', () => {
    const governor = createQualityGovernor({ profile: 'high' });
    governor.sample(30, 0);
    expect(governor.sample(30, GOVERNOR_THRESHOLDS.slowSustainMs).lastChange).toBe('reduce-dpr');
    expect(governor.getSnapshot()).toMatchObject({ degradationLevel: 1, dustEnabled: true, bloomEnabled: true });

    governor.sample(30, 2_100);
    expect(governor.sample(30, 7_000).lastChange).toBe('disable-dust');
    expect(governor.getSnapshot()).toMatchObject({ degradationLevel: 2, dustEnabled: false, bloomEnabled: true });

    governor.sample(30, 7_100);
    expect(governor.sample(30, 12_000).lastChange).toBe('disable-bloom');
    expect(governor.getSnapshot()).toMatchObject({ degradationLevel: 3, dustEnabled: false, bloomEnabled: false });
  });

  it('restores resources only after a sustained fast window', () => {
    const governor = createQualityGovernor({
      profile: 'high',
      thresholds: { ...GOVERNOR_THRESHOLDS, cooldownMs: 0, restoreSustainMs: 500, slowSustainMs: 100 },
    });
    governor.sample(30, 0);
    governor.sample(30, 100);
    governor.sample(30, 200);
    governor.sample(30, 300);
    governor.sample(30, 400);
    governor.sample(30, 500);
    expect(governor.getSnapshot().degradationLevel).toBe(3);

    for (let now = 600; now <= 2_500; now += 100) governor.sample(8, now);
    expect(governor.getSnapshot().degradationLevel).toBeLessThan(3);
    expect(governor.getSnapshot().lastChange).toMatch(/^restore-/);
  });

  it('measures instanced geometry without expanding scene objects', () => {
    const scene = new THREE.Scene();
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial(),
      4,
    );
    scene.add(mesh);
    const metrics = measureSceneResources(scene, { info: { render: { calls: 0 } } });
    expect(metrics).toMatchObject({ drawables: 1, instances: 4, triangles: 48 });
  });

  it('owns KTX2 deferral, page lifecycle and context restoration in the scene boundary', () => {
    expect(sceneSource).toContain('loadVanguardSurfaceTextures');
    expect(sceneSource).toContain('requestIdleCallback');
    expect(sceneSource).toContain("addEventListener('pagehide'");
    expect(sceneSource).toContain("addEventListener('webglcontextrestored'");
    expect(sceneSource).toContain('measureSceneResources');
    expect(qualitySettingsForLevel('mobile', 3)).toMatchObject({ degradationLevel: 2, bloomEnabled: false });
  });
});
