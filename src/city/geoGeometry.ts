export interface GeographicBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export type Coordinate2 = readonly [number, number];

const samePoint = (a: Coordinate2, b: Coordinate2): boolean => (
  Math.abs(a[0] - b[0]) < 1e-12 && Math.abs(a[1] - b[1]) < 1e-12
);

function intersect(
  start: Coordinate2,
  end: Coordinate2,
  axis: 0 | 1,
  boundary: number,
): Coordinate2 {
  const delta = end[axis] - start[axis];
  const ratio = Math.abs(delta) < Number.EPSILON ? 0 : (boundary - start[axis]) / delta;
  return axis === 0
    ? Object.freeze([boundary, start[1] + (end[1] - start[1]) * ratio])
    : Object.freeze([start[0] + (end[0] - start[0]) * ratio, boundary]);
}

function clipEdge(
  input: readonly Coordinate2[],
  inside: (point: Coordinate2) => boolean,
  axis: 0 | 1,
  boundary: number,
): Coordinate2[] {
  if (input.length === 0) return [];
  const output: Coordinate2[] = [];
  let start = input[input.length - 1];
  for (const end of input) {
    const startInside = inside(start);
    const endInside = inside(end);
    if (endInside) {
      if (!startInside) output.push(intersect(start, end, axis, boundary));
      output.push(end);
    } else if (startInside) {
      output.push(intersect(start, end, axis, boundary));
    }
    start = end;
  }
  return output;
}

export function clipClosedRingToBounds(
  ring: readonly Coordinate2[],
  bounds: GeographicBounds,
): readonly Coordinate2[] {
  if (!(bounds.west < bounds.east && bounds.south < bounds.north)) {
    throw new Error('Clip bounds must be ordered.');
  }
  if (ring.length < 4 || ring.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) {
    return Object.freeze([]);
  }
  let points = ring.slice(0, samePoint(ring[0], ring[ring.length - 1]) ? -1 : undefined);
  points = clipEdge(points, ([x]) => x >= bounds.west, 0, bounds.west);
  points = clipEdge(points, ([x]) => x <= bounds.east, 0, bounds.east);
  points = clipEdge(points, ([, y]) => y >= bounds.south, 1, bounds.south);
  points = clipEdge(points, ([, y]) => y <= bounds.north, 1, bounds.north);
  const deduplicated = points.filter((point, index) => index === 0 || !samePoint(point, points[index - 1]));
  if (deduplicated.length < 3) return Object.freeze([]);
  return Object.freeze([...deduplicated, deduplicated[0]]);
}

function clipSegmentToBounds(
  start: Coordinate2,
  end: Coordinate2,
  bounds: GeographicBounds,
): readonly [Coordinate2, Coordinate2] | null {
  const deltaX = end[0] - start[0];
  const deltaY = end[1] - start[1];
  const p = [-deltaX, deltaX, -deltaY, deltaY];
  const q = [
    start[0] - bounds.west,
    bounds.east - start[0],
    start[1] - bounds.south,
    bounds.north - start[1],
  ];
  let startRatio = 0;
  let endRatio = 1;
  for (let index = 0; index < p.length; index += 1) {
    if (Math.abs(p[index]) < Number.EPSILON) {
      if (q[index] < 0) return null;
      continue;
    }
    const ratio = q[index] / p[index];
    if (p[index] < 0) startRatio = Math.max(startRatio, ratio);
    else endRatio = Math.min(endRatio, ratio);
    if (startRatio > endRatio) return null;
  }
  const clippedStart = Object.freeze([
    start[0] + startRatio * deltaX,
    start[1] + startRatio * deltaY,
  ]) as Coordinate2;
  const clippedEnd = Object.freeze([
    start[0] + endRatio * deltaX,
    start[1] + endRatio * deltaY,
  ]) as Coordinate2;
  return samePoint(clippedStart, clippedEnd)
    ? null
    : Object.freeze([clippedStart, clippedEnd]);
}

export function clipLineStringToBounds(
  line: readonly Coordinate2[],
  bounds: GeographicBounds,
): readonly (readonly Coordinate2[])[] {
  if (!(bounds.west < bounds.east && bounds.south < bounds.north)) {
    throw new Error('Clip bounds must be ordered.');
  }
  if (line.length < 2 || line.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) {
    return Object.freeze([]);
  }
  const clippedLines: Coordinate2[][] = [];
  for (let index = 1; index < line.length; index += 1) {
    const segment = clipSegmentToBounds(line[index - 1], line[index], bounds);
    if (!segment) continue;
    const activeLine = clippedLines[clippedLines.length - 1];
    if (activeLine && samePoint(activeLine[activeLine.length - 1], segment[0])) {
      if (!samePoint(activeLine[activeLine.length - 1], segment[1])) activeLine.push(segment[1]);
    } else {
      clippedLines.push([segment[0], segment[1]]);
    }
  }
  return Object.freeze(clippedLines.map((clippedLine) => Object.freeze(clippedLine)));
}

export function signedRingArea(ring: readonly Coordinate2[]): number {
  let twiceArea = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    twiceArea += ring[index][0] * ring[index + 1][1] - ring[index + 1][0] * ring[index][1];
  }
  return twiceArea / 2;
}
