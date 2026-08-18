export interface CitySolarBlendWeights {
  readonly day: number;
  readonly sunset: number;
  readonly night: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function citySolarBlendWeights(altitudeDegrees: number): CitySolarBlendWeights {
  if (!Number.isFinite(altitudeDegrees)) throw new Error('Solar blend altitude must be finite.');
  const emergedFromNight = smoothstep(-12, -3, altitudeDegrees);
  const day = smoothstep(2, 15, altitudeDegrees);
  const night = 1 - emergedFromNight;
  const sunset = emergedFromNight * (1 - day);
  const total = day + sunset + night;
  return Object.freeze({
    day: day / total,
    sunset: sunset / total,
    night: night / total,
  });
}

export function blendSolarScalar(
  weights: CitySolarBlendWeights,
  values: Readonly<{ day: number; sunset: number; night: number }>,
): number {
  return (
    values.day * weights.day
    + values.sunset * weights.sunset
    + values.night * weights.night
  );
}
