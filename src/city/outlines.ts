export interface CurveLineOptions {
  radialSegments?: number;
  verticalLines?: number;
  ringFractions?: readonly number[];
}

export interface EllipsoidLineOptions {
  radialSegments?: number;
  meridians?: number;
  latitudeFractions?: readonly number[];
}

const clampInteger = (value: number | undefined, min: number, max: number, fallback: number): number => (
  Math.min(max, Math.max(min, Math.trunc(Number(value) || fallback)))
);

function rotatedPoint(
  cx: number,
  cy: number,
  cz: number,
  localX: number,
  localY: number,
  localZ: number,
  rotationY: number,
): [number, number, number] {
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  return [
    cx + localX * cos + localZ * sin,
    cy + localY,
    cz - localX * sin + localZ * cos,
  ];
}

export function appendBoxEdges(
  target: number[],
  cx: number,
  cy: number,
  cz: number,
  width: number,
  height: number,
  depth: number,
  rotationY = 0,
): void {
  if (width <= 0 || height <= 0 || depth <= 0) return;
  const hx = width / 2;
  const hz = depth / 2;
  const point = (x: number, y: number, z: number) => rotatedPoint(cx, cy, cz, x, y, z, rotationY);
  const corners = [
    point(-hx, 0, -hz), point(hx, 0, -hz), point(hx, 0, hz), point(-hx, 0, hz),
    point(-hx, height, -hz), point(hx, height, -hz), point(hx, height, hz), point(-hx, height, hz),
  ];
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  for (const [from, to] of edges) target.push(...corners[from], ...corners[to]);
}

/**
 * Appends batched isoparametric lines for an elliptical cylinder. Rings follow
 * the actual visible height and verticals follow the curved surface, avoiding
 * EdgesGeometry diagonals and the false box outline previously used by towers.
 */
export function appendEllipticCylinderLines(
  target: number[],
  cx: number,
  cy: number,
  cz: number,
  width: number,
  height: number,
  depth: number,
  rotationY = 0,
  options: CurveLineOptions = {},
): void {
  if (width <= 0 || height <= 0 || depth <= 0) return;
  const radialSegments = clampInteger(options.radialSegments, 6, 48, 12);
  const verticalLines = clampInteger(options.verticalLines, 4, 24, 8);
  const ringFractions = [...new Set(options.ringFractions ?? [0, 0.25, 0.5, 0.75, 1])]
    .map((fraction) => Math.min(1, Math.max(0, Number(fraction) || 0)))
    .sort((a, b) => a - b);
  const pointAt = (theta: number, y: number) => rotatedPoint(
    cx,
    cy,
    cz,
    Math.cos(theta) * width / 2,
    y,
    Math.sin(theta) * depth / 2,
    rotationY,
  );

  for (const fraction of ringFractions) {
    const y = height * fraction;
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const from = pointAt(segment / radialSegments * Math.PI * 2, y);
      const to = pointAt((segment + 1) / radialSegments * Math.PI * 2, y);
      target.push(...from, ...to);
    }
  }

  for (let line = 0; line < verticalLines; line += 1) {
    const theta = line / verticalLines * Math.PI * 2;
    target.push(...pointAt(theta, 0), ...pointAt(theta, height));
  }
}

export function appendEllipticFrustumLines(
  target: number[],
  cx: number,
  cy: number,
  cz: number,
  bottomWidth: number,
  bottomDepth: number,
  topWidth: number,
  topDepth: number,
  height: number,
  rotationY = 0,
  options: CurveLineOptions = {},
): void {
  if (bottomWidth <= 0 || bottomDepth <= 0 || height <= 0) return;
  const radialSegments = clampInteger(options.radialSegments, 6, 48, 12);
  const verticalLines = clampInteger(options.verticalLines, 4, 24, 8);
  const pointAt = (theta: number, y: number, top = false) => rotatedPoint(
    cx,
    cy,
    cz,
    Math.cos(theta) * (top ? topWidth : bottomWidth) / 2,
    y,
    Math.sin(theta) * (top ? topDepth : bottomDepth) / 2,
    rotationY,
  );
  for (const [y, top] of [[0, false], [height, true]] as const) {
    for (let segment = 0; segment < radialSegments; segment += 1) {
      target.push(
        ...pointAt(segment / radialSegments * Math.PI * 2, y, top),
        ...pointAt((segment + 1) / radialSegments * Math.PI * 2, y, top),
      );
    }
  }
  for (let line = 0; line < verticalLines; line += 1) {
    const theta = line / verticalLines * Math.PI * 2;
    target.push(...pointAt(theta, 0), ...pointAt(theta, height, true));
  }
}

export function appendEllipsoidLines(
  target: number[],
  cx: number,
  cy: number,
  cz: number,
  width: number,
  height: number,
  depth: number,
  rotationY = 0,
  options: EllipsoidLineOptions = {},
): void {
  if (width <= 0 || height <= 0 || depth <= 0) return;
  const radialSegments = clampInteger(options.radialSegments, 6, 48, 12);
  const meridians = clampInteger(options.meridians, 4, 24, 6);
  const latitudeFractions = [...new Set(options.latitudeFractions ?? [-0.5, 0, 0.5])]
    .map((fraction) => Math.min(0.9, Math.max(-0.9, Number(fraction) || 0)))
    .sort((a, b) => a - b);
  const pointAt = (theta: number, phi: number) => rotatedPoint(
    cx,
    cy,
    cz,
    Math.cos(theta) * Math.cos(phi) * width / 2,
    Math.sin(phi) * height / 2,
    Math.sin(theta) * Math.cos(phi) * depth / 2,
    rotationY,
  );
  for (const fraction of latitudeFractions) {
    const phi = fraction * Math.PI / 2;
    for (let segment = 0; segment < radialSegments; segment += 1) {
      target.push(
        ...pointAt(segment / radialSegments * Math.PI * 2, phi),
        ...pointAt((segment + 1) / radialSegments * Math.PI * 2, phi),
      );
    }
  }
  const verticalSegments = Math.max(4, Math.ceil(radialSegments / 2));
  for (let meridian = 0; meridian < meridians; meridian += 1) {
    const theta = meridian / meridians * Math.PI * 2;
    for (let segment = 0; segment < verticalSegments; segment += 1) {
      const fromPhi = -Math.PI / 2 + segment / verticalSegments * Math.PI;
      const toPhi = -Math.PI / 2 + (segment + 1) / verticalSegments * Math.PI;
      target.push(...pointAt(theta, fromPhi), ...pointAt(theta, toPhi));
    }
  }
}
