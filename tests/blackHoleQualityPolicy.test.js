import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import '../public/vendor/black-hole/quality-policy.js';

const policy = globalThis.BlackHoleQualityPolicy;

describe('black-hole quality policy', () => {
  it('defines bounded High, Balanced and Low profiles with a half-resolution default', () => {
    expect(policy.QUALITY_ORDER).toEqual(['low', 'balanced', 'high']);
    expect(policy.QUALITY_PROFILES.high.renderScale).toBe(0.5);
    expect(policy.QUALITY_PROFILES.balanced.renderScale).toBe(0.5);
    expect(policy.QUALITY_PROFILES.low.renderScale).toBeLessThan(0.5);
    expect(policy.QUALITY_PROFILES.high.particleCount).toBe(policy.MAX_PARTICLES);
    expect(policy.QUALITY_PROFILES.balanced.particleCount)
      .toBeLessThan(policy.QUALITY_PROFILES.high.particleCount);
    expect(policy.QUALITY_PROFILES.low.particleCount)
      .toBeLessThan(policy.QUALITY_PROFILES.balanced.particleCount);
    expect(policy.selectQuality({explicitTier: 'balanced', renderScale: null}))
      .toMatchObject({renderScale: 0.5, particleCount: 10_000});
  });

  it('selects tiers from bounded device hints while honoring an explicit tier', () => {
    expect(policy.selectQuality({
      deviceMemory: 16,
      hardwareConcurrency: 12,
      viewportWidth: 1440,
    }).tier).toBe('high');
    expect(policy.selectQuality({
      deviceMemory: 4,
      hardwareConcurrency: 8,
      viewportWidth: 1440,
    }).tier).toBe('low');
    expect(policy.selectQuality({
      explicitTier: 'balanced',
      deviceMemory: 2,
      hardwareConcurrency: 2,
      viewportWidth: 390,
    }).tier).toBe('balanced');
  });

  it('suppresses particles for Save-Data and reduced motion', () => {
    for (const preference of [{saveData: true}, {reducedMotion: true}]) {
      const quality = policy.selectQuality({
        ...preference,
        explicitTier: 'high',
        particleCount: Number.MAX_SAFE_INTEGER,
      });
      expect(quality.motionSuppressed).toBe(true);
      expect(quality.particleCount).toBe(0);
      expect(quality.tier).toBe('high');
    }
  });

  it('clamps render scale and particle requests to each tier budget', () => {
    const high = policy.selectQuality({
      explicitTier: 'high', renderScale: 4, particleCount: 9_000_000,
    });
    const balanced = policy.selectQuality({
      explicitTier: 'balanced', renderScale: 1, particleCount: 9_000_000,
    });
    const low = policy.selectQuality({
      explicitTier: 'low', renderScale: 0.01, particleCount: 9_000_000,
    });
    expect(high.renderScale).toBe(1);
    expect(high.particleCount).toBe(policy.MAX_PARTICLES);
    expect(balanced.renderScale).toBe(0.75);
    expect(balanced.particleCount).toBe(policy.QUALITY_PROFILES.balanced.particleCount);
    expect(low.renderScale).toBe(policy.MIN_RENDER_SCALE);
    expect(low.particleCount).toBe(policy.QUALITY_PROFILES.low.particleCount);
  });
});

describe('black-hole scaled renderer contract', () => {
  const source = readFileSync('public/vendor/black-hole/background.html', 'utf8');
  const particles = readFileSync('public/vendor/black-hole/gpu-particles.js', 'utf8');

  it('keeps the physical WebGL2 LUT path and upscales only its HDR result', () => {
    expect(source).toContain("this.canvas.getContext('webgl2')");
    expect(source).toContain('ray_deflection_texture');
    expect(source).toContain('ray_inverse_radius_texture');
    expect(source).toContain('doppler_texture');
    expect(source).toContain('this.bloom.renderWidth / 2');
    expect(source).toContain('output_delta_uv');
    expect(source).toContain('this.quality.renderScale');
  });

  it('uses one bounded GPU point-sprite draw without CPU particle buffers', () => {
    expect(particles).toContain('gl_VertexID');
    expect(particles).toContain('gl_PointCoord');
    expect(particles).toContain('gl.drawArrays(gl.POINTS, 0, this.count)');
    expect(particles).toContain('Math.min(MAX_PARTICLES');
    expect(particles).not.toContain('new Float32Array');
  });

  it('supports preference, visibility and explicit bridge pauses', () => {
    expect(source).toContain("this.setPaused('document-hidden', document.hidden)");
    expect(source).toContain("this.setPaused('intersection', !visible)");
    expect(source).toContain("this.setPaused('parent-offscreen', !this.isVisibleInParent())");
    expect(source).toContain("type === 'black-hole-observatory:pause'");
    expect(source).toContain("this.setPaused('motion-preference', true)");
  });

  it('publishes observable quality diagnostics on the render canvas', () => {
    expect(source).toContain('dataset.renderScale');
    expect(source).toContain('dataset.particleCount');
    expect(source).toContain('dataset.renderSize');
  });
});
