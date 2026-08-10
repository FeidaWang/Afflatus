import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const entry = readFileSync('src/main.js', 'utf8');
const experience = readFileSync('src/homeExperience.js', 'utf8');
const forge = readFileSync('src/scene/alphardForge.js', 'utf8');
const worker = readFileSync('src/scene/backgroundScene.worker.js', 'utf8');

describe('homepage render performance contract', () => {
  it('keeps black-hole quality adaptive and delays the forge until it intersects', () => {
    expect(entry).not.toContain("sourceUrl.searchParams.set('bhQuality'");
    expect(entry).not.toContain("sourceUrl.searchParams.set('bhRenderScale'");
    expect(entry).toContain("rootMargin: '0px'");
    expect(entry).toContain('entry.intersectionRatio >= 0.35');
    expect(entry).toContain('threshold: 0.35');
    expect(entry).toContain('poster.hidden = !FLAGSHIP_UPGRADE_ENABLED');
  });

  it('keeps the forge inside the shared pixel budget', () => {
    expect(forge).toContain('renderPolicy.computeDpr(W, H');
    expect(forge).not.toContain("renderPolicy.qualityTier === 'high'\n      ? Math.min(nativeDpr, 2)");
    expect(forge).toContain('function targetFrameRate()');
  });

  it('runs visible cruise work at 30fps, offscreen cruise at 15fps, and combat or warp at 60fps', () => {
    expect(experience).toContain('function masterLoopTargetFps()');
    expect(experience).toContain('if(!cruiseModeActive()||warpTarget>=.45||warpIntensity>=.45) return 60;');
    expect(experience).toContain('return heroSectionVisible||stardriveSectionVisible?30:15;');
    expect(experience).toContain('eventLayerDirty');
    expect(experience).toContain('reportFrame(performance.now()-frameStartedAt)');
    expect(worker).toContain('warpIntensity > 0.45 ? 60 : 30');
  });

  it('pauses the black hole while the Command renderer owns the hero', () => {
    expect(experience).toContain("cruiseModeActive()?'black-hole-observatory:play':'black-hole-observatory:pause'");
    expect(experience).toContain("document.querySelector('#blackhole-stage.home-flagship-playback-active')");
  });

  it('avoids decoding the flagship twice in the default Command path', () => {
    const narrative = readFileSync('src/scene/homeFlagshipNarrative.js', 'utf8');
    expect(narrative).toContain('!enabled && (force3D || flagshipExperiment)');
    expect(narrative).toContain("requestPlayback('command-intent')");
  });

  it('reports real render submission cost instead of animation-frame spacing', () => {
    const combat = readFileSync('src/scene/topdownCombat.js', 'utf8');
    expect(combat).toContain('const renderStartedAt = performance.now();');
    expect(combat).toContain('reportFrame(performance.now() - renderStartedAt');
    expect(combat).toContain('const renderStartedAt=performance.now();');
    expect(combat).toContain('reportFrame(performance.now()-renderStartedAt');
    expect(combat).not.toContain('reportFrame(frameMs');
  });
});
