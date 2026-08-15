import type { CityPlan } from './model';

export interface CityRidgeMeshData {
  peakCount: number;
  positions: readonly number[];
  colors: readonly number[];
  indices: readonly number[];
}

const EMPTY_RIDGE: Readonly<CityRidgeMeshData> = Object.freeze({
  peakCount: 0,
  positions: Object.freeze([]),
  colors: Object.freeze([]),
  indices: Object.freeze([]),
});

const clamp = (value: number, minimum: number, maximum: number): number => (
  Math.min(maximum, Math.max(minimum, value))
);

function appendPoint(
  target: number[],
  axis: 'x' | 'z',
  along: number,
  y: number,
  cross: number,
) {
  if (axis === 'x') target.push(along, y, cross);
  else target.push(cross, y, along);
}

/**
 * Builds one continuous, low-poly terrain ribbon. It is deliberately a
 * generated planning silhouette, not a sampled elevation surface.
 */
export function createCityRidgeMeshData(plan: CityPlan): Readonly<CityRidgeMeshData> {
  const ridge = plan.profile.ridgeBackdrop;
  if (!ridge) return EMPTY_RIDGE;

  const sampleCount = Math.max(5, ridge.peakCount * 2 + 1);
  const depth = Math.min(ridge.distance * 0.34, ridge.span * 0.2);
  const front = ridge.side * (ridge.distance - depth / 2);
  const back = ridge.side * (ridge.distance + depth / 2);
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const seedPhase = plan.seedHash * 0.0000017;

  for (let index = 0; index < sampleCount; index += 1) {
    const t = index / (sampleCount - 1);
    const along = -ridge.span / 2 + ridge.span * t;
    const wave = (
      0.58
      + Math.sin(t * Math.PI * 2.35 + seedPhase) * 0.19
      + Math.sin(t * Math.PI * 5.1 + seedPhase * 0.73) * 0.11
    );
    const edgeFade = 0.72 + Math.sin(Math.PI * t) * 0.28;
    const height = ridge.maxHeight * clamp(wave * edgeFade, 0.34, 0.94);
    const backHeight = height * (0.77 + Math.cos(t * Math.PI * 2 + seedPhase) * 0.04);

    appendPoint(positions, ridge.axis, along, 0, front);
    appendPoint(positions, ridge.axis, along, height, front);
    appendPoint(positions, ridge.axis, along, backHeight, back);
    appendPoint(positions, ridge.axis, along, 0, back);

    const shade = 0.025 * Math.sin(index * 1.31 + seedPhase);
    colors.push(
      0.53 + shade, 0.61 + shade, 0.55 + shade,
      0.61 + shade, 0.69 + shade, 0.62 + shade,
      0.66 + shade, 0.72 + shade, 0.66 + shade,
      0.49 + shade, 0.57 + shade, 0.51 + shade,
    );
  }

  for (let index = 0; index < sampleCount - 1; index += 1) {
    const left = index * 4;
    const right = (index + 1) * 4;
    indices.push(
      left, right, left + 1,
      left + 1, right, right + 1,
      left + 1, right + 1, left + 2,
      left + 2, right + 1, right + 2,
      left + 3, left + 2, right + 3,
      left + 2, right + 2, right + 3,
    );
  }
  const final = (sampleCount - 1) * 4;
  indices.push(0, 1, 3, 1, 2, 3, final, final + 3, final + 1, final + 1, final + 3, final + 2);

  return Object.freeze({
    peakCount: ridge.peakCount,
    positions: Object.freeze(positions),
    colors: Object.freeze(colors),
    indices: Object.freeze(indices),
  });
}
