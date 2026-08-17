import { describe, expect, it } from 'vitest';
import {
  CITY_SCENE_RENDER_BUDGET,
  cityBudgetClassForDevice,
  evaluateCityRenderBudget,
} from '../src/city/budget.ts';

describe('city sandbox render budget', () => {
  it('selects the mobile contract for narrow or coarse-pointer devices', () => {
    expect(cityBudgetClassForDevice(1440, false)).toBe('desktop');
    expect(cityBudgetClassForDevice(640, false)).toBe('mobile');
    expect(cityBudgetClassForDevice(1440, true)).toBe('mobile');
  });

  it('keeps the P0 ceiling below the site-wide warning ceiling', () => {
    expect(CITY_SCENE_RENDER_BUDGET.desktop.drawCalls).toBeLessThan(120);
    expect(CITY_SCENE_RENDER_BUDGET.desktop.triangles).toBeLessThan(300_000);
    expect(CITY_SCENE_RENDER_BUDGET.mobile.targetFps).toBe(30);
  });

  it('reports every exceeded or invalid signal', () => {
    expect(evaluateCityRenderBudget({ drawCalls: 30, triangles: 70_000, p95Ms: 17 }, 'desktop')).toMatchObject({
      withinBudget: true,
      violations: [],
    });
    expect(evaluateCityRenderBudget({ drawCalls: 41, triangles: Number.NaN, p95Ms: 19 }, 'desktop')).toMatchObject({
      withinBudget: false,
      violations: ['drawCalls', 'triangles', 'p95Ms'],
    });
  });
});
