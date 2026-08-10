import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getFullscreenCanvasDprLimits } from '../src/scene/backgroundScene.js';

describe('background scene fullscreen DPR policy', () => {
  it('caps full-viewport backing stores by quality tier', () => {
    expect(getFullscreenCanvasDprLimits('high')).toEqual({ minDpr: 0.6, maxDpr: 1.4 });
    expect(getFullscreenCanvasDprLimits('balanced')).toEqual({ minDpr: 0.6, maxDpr: 1.2 });
    expect(getFullscreenCanvasDprLimits('low')).toEqual({ minDpr: 0.6, maxDpr: 1 });
    expect(getFullscreenCanvasDprLimits('unexpected')).toBe(
      getFullscreenCanvasDprLimits('balanced'),
    );
  });

  it('keeps worker and fallback resizing on the shared adaptive calculation', () => {
    const source = readFileSync('src/scene/backgroundScene.js', 'utf8');

    expect(source).toContain('renderPolicy.computeDpr(');
    expect(source).toContain('getFullscreenCanvasDprLimits(renderPolicy.qualityTier)');
    expect(source.match(/dpr = computeDpr\(innerWidth, innerHeight\);/g)).toHaveLength(2);
    expect(source.match(/onQualityChange\(nextPolicy\)[\s\S]*?if \(sized\) resize\(\);/g))
      .toHaveLength(2);
  });

  it('reports bounded-frequency worker draw cost and cleans up the listener', () => {
    const scene = readFileSync('src/scene/backgroundScene.js', 'utf8');
    const worker = readFileSync('src/scene/backgroundScene.worker.js', 'utf8');

    expect(worker).toContain('const TELEMETRY_INTERVAL_FRAMES = 2;');
    expect(worker).toContain('const drawStartedAt = performance.now();');
    expect(worker).toContain('recordDrawDuration(drawDurationMs);');
    expect(worker).toContain("self.postMessage({ type: 'draw-duration', durationMs: telemetryPeakDurationMs });");
    expect(worker).not.toContain("type: 'draw-duration', frameMs");
    expect(scene).toContain("event.data?.type !== 'draw-duration'");
    expect(scene).toContain('surface.reportFrame(durationMs)');
    expect(scene.indexOf("new Worker(new URL('./backgroundScene.worker.js'"))
      .toBeLessThan(scene.indexOf('canvas.transferControlToOffscreen()'));
    expect(worker).toContain('1000 / targetFps - drawDurationMs');
    expect(scene).toMatch(/frameReporter = null;[\s\S]*?removeEventListener\('message', handleWorkerMessage\);[\s\S]*?worker\.terminate\(\);/);
  });
});
