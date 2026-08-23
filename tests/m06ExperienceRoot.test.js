import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  profileSupportsWebGL,
  probeWebGLCapability,
  RENDER_BUDGETS,
  resolveQualityProfile,
  sceneDiagnostic,
} from '../src/showcase/experience/qualityProfile.js';
import { SCENE_STATUS, sceneStatusAllowsCanvas } from '../src/showcase/experience/sceneState.js';

const experienceSource = readFileSync('src/showcase/experience/ExperienceRoot.jsx', 'utf8');
const sceneSource = readFileSync('src/showcase/experience/SignatureScene.jsx', 'utf8');
const appSource = readFileSync('src/showcase/App.jsx', 'utf8');

const capable = {
  deviceMemory: 8,
  experienceMode: 'cinematic',
  hardwareConcurrency: 8,
  motionEnabled: true,
  reducedMotion: false,
  saveData: false,
  viewportHeight: 900,
  viewportWidth: 1440,
  webglAvailable: true,
};

describe('M06 unified quality profile', () => {
  it('resolves every public profile from capability signals', () => {
    expect(resolveQualityProfile(capable)).toBe('high');
    expect(resolveQualityProfile({ ...capable, hardwareConcurrency: 4 })).toBe('medium');
    expect(resolveQualityProfile({ ...capable, viewportWidth: 700 })).toBe('mobile');
    expect(resolveQualityProfile({ ...capable, experienceMode: 'static' })).toBe('static');
    expect(resolveQualityProfile({ ...capable, experienceMode: 'reduced' })).toBe('reduced');
  });

  it('prioritizes motion, data and hard capability guardrails', () => {
    expect(resolveQualityProfile({ ...capable, motionEnabled: false })).toBe('reduced');
    expect(resolveQualityProfile({ ...capable, reducedMotion: true })).toBe('reduced');
    expect(resolveQualityProfile({ ...capable, saveData: true })).toBe('reduced');
    expect(resolveQualityProfile({ ...capable, webglAvailable: false })).toBe('static');
    expect(resolveQualityProfile({ ...capable, deviceMemory: 2 })).toBe('static');
    expect(resolveQualityProfile({ ...capable, hardwareConcurrency: 1 })).toBe('static');
    expect(resolveQualityProfile({ ...capable, hardwareConcurrency: 2 })).toBe('medium');
    expect(resolveQualityProfile({ ...capable, viewportWidth: 320 })).toBe('static');
  });

  it('assigns bounded budgets only to animated profiles', () => {
    expect(profileSupportsWebGL('high')).toBe(true);
    expect(profileSupportsWebGL('static')).toBe(false);
    expect(profileSupportsWebGL('reduced')).toBe(false);
    expect(RENDER_BUDGETS.high.dpr).toBeLessThanOrEqual(1.5);
    expect(RENDER_BUDGETS.mobile.fps).toBeLessThan(RENDER_BUDGETS.high.fps);
    expect(RENDER_BUDGETS.static).toBeUndefined();
  });

  it('probes WebGL without retaining the temporary context', () => {
    const loseContext = vi.fn();
    const context = { getExtension: () => ({ loseContext }) };
    const documentScope = { createElement: () => ({ getContext: vi.fn(() => context) }) };
    expect(probeWebGLCapability(documentScope)).toBe(true);
    expect(loseContext).toHaveBeenCalledOnce();
    expect(probeWebGLCapability({ createElement: () => ({ getContext: () => null }) })).toBe(false);
  });

  it('keeps failure diagnostics local-only', () => {
    expect(sceneDiagnostic({ hostname: 'localhost', search: '?scene=unavailable' })).toBe('unavailable');
    expect(sceneDiagnostic({ hostname: '127.0.0.1', search: '?scene=resource-error' })).toBe('resource-error');
    expect(sceneDiagnostic({ hostname: 'feida.au', search: '?scene=unavailable' })).toBeNull();
  });
});

describe('M06 single-canvas lifecycle contract', () => {
  it('keeps the scene state surface deliberately smaller than M07', () => {
    expect(SCENE_STATUS).toEqual({
      POSTER: 'poster',
      SCHEDULED: 'scheduled',
      LOADING: 'loading',
      READY: 'ready',
      PAUSED: 'paused',
      FALLBACK: 'fallback',
    });
    expect(sceneStatusAllowsCanvas(SCENE_STATUS.READY)).toBe(true);
    expect(sceneStatusAllowsCanvas(SCENE_STATUS.POSTER)).toBe(false);
  });

  it('defers the Three.js module until after two paint opportunities', () => {
    expect(experienceSource.match(/requestAnimationFrame/g)?.length).toBeGreaterThanOrEqual(2);
    expect(experienceSource).toContain("import('./SignatureScene.jsx')");
    expect(appSource).not.toMatch(/from ['"]three|SignatureScene/);
  });

  it('owns one decorative canvas and all required lifecycle fallbacks', () => {
    expect(sceneSource).toContain("setAttribute('aria-hidden', 'true')");
    expect(sceneSource).toContain("addEventListener('webglcontextlost'");
    expect(sceneSource).toContain("addEventListener('visibilitychange'");
    expect(sceneSource).toContain('TextureLoader');
    expect(sceneSource).toContain('forceContextLoss');
    expect(appSource.match(/<ExperienceRoot/g)).toHaveLength(1);
    expect(appSource).not.toContain('<canvas');
  });
});
