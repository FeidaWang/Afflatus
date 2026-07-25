import { describe, expect, it } from 'vitest';
import {
  computeBudgetDpr,
  detectInitialQuality,
  estimateRefreshRate,
  evaluateFrameWindow,
  frameBudgetMs,
  pixelBudgetFor,
  stepQualityTier,
} from '../src/lib/renderBudget.js';

describe('render budget policy', () => {
  it('selects a conservative initial tier for constrained preferences and devices', () => {
    expect(detectInitialQuality({ viewportWidth: 1400 })).toBe('high');
    expect(detectInitialQuality({ viewportWidth: 430 })).toBe('balanced');
    expect(detectInitialQuality({ viewportWidth: 1400, deviceMemory: 4 })).toBe('low');
    expect(detectInitialQuality({ viewportWidth: 1400, saveData: true })).toBe('low');
    expect(detectInitialQuality({ viewportWidth: 1400, reducedMotion: true })).toBe('low');
  });

  it('applies device, quality, and renderer-cost pixel budgets', () => {
    expect(pixelBudgetFor({ mobile: true, qualityTier: 'high', cost: 'low' })).toBe(2_200_000);
    expect(pixelBudgetFor({ mobile: false, qualityTier: 'high', cost: 'low' })).toBe(3_600_000);
    expect(pixelBudgetFor({ mobile: false, qualityTier: 'high', cost: 'high' })).toBe(2_700_000);
  });

  it('derives DPR from an absolute backing-store budget', () => {
    expect(computeBudgetDpr({
      cssWidth: 2560,
      cssHeight: 1440,
      deviceDpr: 2,
      pixelBudget: 3_600_000,
    })).toBeCloseTo(0.988, 2);
    expect(computeBudgetDpr({
      cssWidth: 800,
      cssHeight: 600,
      deviceDpr: 2,
      pixelBudget: 3_600_000,
      maxDpr: 1.5,
    })).toBe(1.5);
    expect(computeBudgetDpr({
      cssWidth: 8000,
      cssHeight: 6000,
      deviceDpr: 2,
      pixelBudget: 1_000_000,
      minDpr: 0.6,
    })).toBe(0.6);
  });

  it('samples common 60/120 Hz refresh rates without binding policy to one device', () => {
    expect(estimateRefreshRate(Array(40).fill(16.67))).toBe(60);
    expect(estimateRefreshRate(Array(40).fill(8.33))).toBe(120);
    expect(estimateRefreshRate([Number.NaN, 0, 100])).toBe(60);
  });

  it('uses renderer target FPS when evaluating frame headroom', () => {
    expect(frameBudgetMs(120, 60)).toBeCloseTo(16.67, 1);
    expect(evaluateFrameWindow({
      samples: Array(90).fill(24),
      refreshHz: 120,
      targetFps: 60,
    }).state).toBe('over-budget');
    expect(evaluateFrameWindow({
      samples: Array(90).fill(8),
      refreshHz: 120,
      targetFps: 60,
    }).state).toBe('headroom');
  });

  it('never raises a tier above its hardware ceiling', () => {
    expect(stepQualityTier('balanced', 1, 'balanced')).toBe('balanced');
    expect(stepQualityTier('high', -1, 'high')).toBe('balanced');
    expect(stepQualityTier('low', -1, 'high')).toBe('low');
  });
});
