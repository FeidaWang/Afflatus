import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  HOME_FLAGSHIP_NARRATIVE_DURATION_MS,
  homeFlagshipLayerVisible,
  homeFlagshipPlaybackAllowed,
  sampleHomeFlagshipNarrative,
} from '../src/scene/homeFlagshipNarrative.js';

describe('home flagship micro-narrative', () => {
  it('completes the emergence, ignition and shield-impact story in 4–6 seconds', () => {
    expect(HOME_FLAGSHIP_NARRATIVE_DURATION_MS).toBeGreaterThanOrEqual(4000);
    expect(HOME_FLAGSHIP_NARRATIVE_DURATION_MS).toBeLessThanOrEqual(6000);

    const emergence = sampleHomeFlagshipNarrative(1100);
    const ignition = sampleHomeFlagshipNarrative(2700);
    const impact = sampleHomeFlagshipNarrative(4000);
    const settled = sampleHomeFlagshipNarrative(HOME_FLAGSHIP_NARRATIVE_DURATION_MS);

    expect(emergence.phase).toBe('emergence');
    expect(emergence.reveal).toBeGreaterThan(0);
    expect(emergence.lensEnergy).toBeGreaterThan(0);
    expect(ignition.phase).toBe('ignition');
    expect(ignition.enginePower).toBeGreaterThan(0.7);
    expect(ignition.shieldPulse).toBe(0);
    expect(impact.phase).toBe('impact');
    expect(impact.shieldPulse).toBeGreaterThan(0);
    expect(impact.rippleProgress).toBeGreaterThan(0);
    expect(settled).toMatchObject({ phase: 'settled', reveal: 1, shieldPulse: 0 });
    expect(settled.enginePower).toBeCloseTo(0.64);
  });

  it('requires a high-tier explicit intent, while preserving the 3D query override', () => {
    expect(homeFlagshipPlaybackAllowed({ qualityTier: 'high' })).toBe(true);
    expect(homeFlagshipPlaybackAllowed({ qualityTier: 'medium' })).toBe(false);
    expect(homeFlagshipPlaybackAllowed({ qualityTier: 'high', reducedMotion: true })).toBe(false);
    expect(homeFlagshipPlaybackAllowed({ qualityTier: 'high', saveData: true })).toBe(false);
    expect(homeFlagshipPlaybackAllowed({
      qualityTier: 'low',
      reducedMotion: true,
      saveData: true,
      force3D: true,
    })).toBe(true);
  });

  it('keeps the flagship off the cruise black hole except for explicit experiments', () => {
    expect(homeFlagshipLayerVisible({ playbackState: 'standby' })).toBe(false);
    expect(homeFlagshipLayerVisible({ playbackState: 'requested' })).toBe(false);
    expect(homeFlagshipLayerVisible({ commandMode: true, playbackState: 'requested' })).toBe(true);
    expect(homeFlagshipLayerVisible({ commandMode: true, playbackState: 'loading' })).toBe(true);
    expect(homeFlagshipLayerVisible({ commandMode: true, playbackState: 'settled' })).toBe(true);
    expect(homeFlagshipLayerVisible({ playbackState: 'settled' })).toBe(false);
    expect(homeFlagshipLayerVisible({ force3D: true, playbackState: 'active' })).toBe(true);
    expect(homeFlagshipLayerVisible({ force3D: true, playbackState: 'settled' })).toBe(true);
    expect(homeFlagshipLayerVisible({ flagshipExperiment: true })).toBe(true);
  });

  it('keeps accessibility static while reserving zero-download fallback for constrained clients', () => {
    const terminal = sampleHomeFlagshipNarrative(0, { terminal: true });
    expect(terminal).toMatchObject({ phase: 'settled', reveal: 1, shieldPulse: 0 });

    const source = readFileSync('src/scene/homeFlagshipNarrative.js', 'utf8');
    const experience = readFileSync('src/homeExperience.js', 'utf8');
    const main = readFileSync('src/main.js', 'utf8');
    const combat = readFileSync('src/scene/topdownCombat.js', 'utf8');
    expect(source).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
    expect(source).toContain('navigator.connection?.saveData');
    expect(source).toContain("qualityTier === 'high'");
    expect(source).toContain("playbackState = force3D ? 'requested' : 'standby'");
    expect(source).toContain("container.querySelector('.home-flagship-poster')");
    expect(source).toContain("'static-venator-poster'");
    expect(source).toContain("id: 'home:flagship-narrative'");
    expect(source).toContain('observe: false');
    expect(source).toContain('viewportObserver.observe(observeElement)');
    expect(source).toContain('onPause()');
    expect(source).toContain('function posterAvailable()');
    expect(source).toContain('gpuNarrativePromise === pending');
    expect(source).toContain("requestPlayback('command-intent')");
    expect(source).toContain('!enabled && (force3D || flagshipExperiment)');
    expect(source).toContain("if (playbackState === 'requested') void ensureGpuNarrative()");
    expect(source).toContain('const ready = await narrative.ready');
    expect(source).toContain("finishPlayback('complete')");
    expect(source).toContain("container.classList.toggle('home-flagship-playback-active'");
    expect(source).toContain("container.classList.toggle('home-flagship-poster-restored'");
    expect(source).toContain("classList.contains('flagship-upgrade-enabled')");
    expect(source).toContain('if (enabled && playbackInFlight() && !force3D)');
    expect(source).toContain("finishPlayback('cruise-return', { cancelled: true })");
    expect(source).toContain("dismissSettledPoster(reason = 'command-feed-ready')");
    expect(source).toContain("setPlaybackState('dismissed', reason)");
    expect(source).toContain("setPlaybackState(cancelled ? 'cancelled'");
    expect(source).toMatch(/import\('\.\/homeFlagshipWebGPU\.js'\)[\s\S]*?generation !== playbackGeneration[\s\S]*?return createHomeFlagshipWebGPU/);
    expect(source).toContain('const drawStartedAt = performance.now()');
    expect(source).toContain('surface?.reportFrame(Math.max(0, performance.now() - drawStartedAt))');
    expect(source).not.toContain('reportFrame(drawInterval)');
    expect(source).toMatch(/function finishPlayback[\s\S]*?releaseGpuNarrative\(\);[\s\S]*?visible = shouldShowSurface\(\)/);
    expect(source).not.toContain('if (!terminalMode) ensureGpuNarrative()');
    expect(source).toMatch(/function finishPlayback[\s\S]*?releaseGpuNarrative\(\);[\s\S]*?setPlaybackState/);
    expect(source.match(/gpuNarrativePromise = null/g)?.length).toBeGreaterThanOrEqual(3);
    expect(source).toContain('getDiagnostics()');
    expect(experience).toContain('homeFlagshipNarrative?.setEnabled(toHudOff)');
    expect(experience).toContain("diagnostics?.shipModelStatus==='venator-ready'");
    expect(experience).toContain("dismissSettledPoster?.('venator-command-feed-ready')");
    expect(experience).toContain("classList.contains('home-combat-models-enabled')");
    expect(main).toContain("const HOME_COMBAT_MODELS_ENABLED = HERO_CRAFT_MODE !== 'off'");
    expect(main).toContain("HERO_CRAFT_MODE === '3d' ? 'forced-3d' : 'authored'");
    expect(experience).toContain("force3D:document.documentElement.dataset.heroCraft==='forced-3d'");
    expect(main).toContain("classList.toggle('home-combat-models-enabled'");
    expect(main).toContain("import './home-combat-showcase.css'");
    expect(main).toContain("poster.src = '/assets/combat/models/venator-hero-poster.webp'");
    expect(statSync('public/assets/combat/models/venator-hero-poster.webp').size).toBeLessThan(100_000);
    expect(combat).not.toContain('homeFlagshipNarrative');
  });
});
