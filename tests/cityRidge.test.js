import { describe, expect, it } from 'vitest';
import { generateSandboxCity } from '../src/city/generate.ts';
import { createCityRidgeMeshData } from '../src/city/ridge.ts';

describe('city generated ridge backdrop', () => {
  it('keeps flat profiles empty and Hong Kong deterministic', () => {
    expect(createCityRidgeMeshData(generateSandboxCity('ridge-flat', 'shanghai'))).toMatchObject({
      peakCount: 0,
      positions: [],
      colors: [],
      indices: [],
    });
    const hongKong = generateSandboxCity('ridge-contract', 'hong-kong');
    const first = createCityRidgeMeshData(hongKong);
    expect(first).toEqual(createCityRidgeMeshData(hongKong));
    expect(first.peakCount).toBe(9);
    expect(first.positions.length).toBeGreaterThan(100);
    expect(first.colors).toHaveLength(first.positions.length);
    expect(first.indices.length).toBeGreaterThan(100);
  });

  it('emits bounded finite indexed geometry', () => {
    const plan = generateSandboxCity('ridge-bounds', 'hong-kong');
    const ridge = createCityRidgeMeshData(plan);
    const vertices = ridge.positions.length / 3;
    const yValues = ridge.positions.filter((_, index) => index % 3 === 1);

    expect([...ridge.positions, ...ridge.colors].every(Number.isFinite)).toBe(true);
    expect(ridge.indices.every((index) => Number.isInteger(index) && index >= 0 && index < vertices)).toBe(true);
    expect(Math.min(...yValues)).toBe(0);
    expect(Math.max(...yValues)).toBeLessThanOrEqual(plan.profile.ridgeBackdrop.maxHeight);
  });
});
