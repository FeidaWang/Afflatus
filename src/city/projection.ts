const WGS84_SEMI_MAJOR_METRES = 6_378_137;
const WGS84_FLATTENING = 1 / 298.257223563;
const WGS84_ECCENTRICITY_SQUARED = (
  WGS84_FLATTENING * (2 - WGS84_FLATTENING)
);

export interface Wgs84Coordinate {
  longitude: number;
  latitude: number;
  ellipsoidHeight?: number;
}

export interface EnuCoordinate {
  east: number;
  north: number;
  up: number;
}

export interface CitySceneCoordinate {
  x: number;
  y: number;
  z: number;
}

export interface MapGridCoordinate {
  easting: number;
  northing: number;
}

export interface GeographicCoordinate {
  longitude: number;
  latitude: number;
  ellipsoidHeight: number;
}

const radians = (degrees: number): number => degrees * Math.PI / 180;

/** Converts the packed DDD.MMSSSS representation published by Vicmap Position. */
export function packedDmsToDecimalDegrees(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value) > 180) {
    throw new Error('Packed DMS coordinate must be finite and within 180 degrees.');
  }
  const sign = value < 0 ? -1 : 1;
  const absolute = Math.abs(value);
  const degrees = Math.floor(absolute);
  const packedMinutes = (absolute - degrees) * 100;
  const minutes = Math.floor(packedMinutes + 1e-10);
  const seconds = (packedMinutes - minutes) * 100;
  if (minutes >= 60 || seconds < -1e-8 || seconds >= 60 + 1e-8) {
    throw new Error('Packed DMS coordinate has invalid minutes or seconds.');
  }
  return sign * (degrees + minutes / 60 + seconds / 3600);
}

function assertCoordinate(point: Wgs84Coordinate, field: string): void {
  if (
    !Number.isFinite(point?.longitude)
    || !Number.isFinite(point?.latitude)
    || point.longitude < -180
    || point.longitude > 180
    || point.latitude < -90
    || point.latitude > 90
  ) {
    throw new Error(`${field} must be a finite WGS84 longitude/latitude.`);
  }
  if (point.ellipsoidHeight !== undefined && !Number.isFinite(point.ellipsoidHeight)) {
    throw new Error(`${field}.ellipsoidHeight must be finite when supplied.`);
  }
}

function wgs84ToEcef(point: Wgs84Coordinate): readonly [number, number, number] {
  assertCoordinate(point, 'point');
  const longitude = radians(point.longitude);
  const latitude = radians(point.latitude);
  const height = point.ellipsoidHeight ?? 0;
  const sinLatitude = Math.sin(latitude);
  const cosLatitude = Math.cos(latitude);
  const normalRadius = WGS84_SEMI_MAJOR_METRES
    / Math.sqrt(1 - WGS84_ECCENTRICITY_SQUARED * sinLatitude * sinLatitude);
  return Object.freeze([
    (normalRadius + height) * cosLatitude * Math.cos(longitude),
    (normalRadius + height) * cosLatitude * Math.sin(longitude),
    (normalRadius * (1 - WGS84_ECCENTRICITY_SQUARED) + height) * sinLatitude,
  ]);
}

const GRS80_SEMI_MAJOR_METRES = 6_378_137;
const GRS80_FLATTENING = 1 / 298.257222101;
const GRS80_ECCENTRICITY_SQUARED = GRS80_FLATTENING * (2 - GRS80_FLATTENING);

function grs80ToEcef(point: Wgs84Coordinate): readonly [number, number, number] {
  assertCoordinate(point, 'point');
  const longitude = radians(point.longitude);
  const latitude = radians(point.latitude);
  const height = point.ellipsoidHeight ?? 0;
  const sinLatitude = Math.sin(latitude);
  const cosLatitude = Math.cos(latitude);
  const normalRadius = GRS80_SEMI_MAJOR_METRES
    / Math.sqrt(1 - GRS80_ECCENTRICITY_SQUARED * sinLatitude * sinLatitude);
  return Object.freeze([
    (normalRadius + height) * cosLatitude * Math.cos(longitude),
    (normalRadius + height) * cosLatitude * Math.sin(longitude),
    (normalRadius * (1 - GRS80_ECCENTRICITY_SQUARED) + height) * sinLatitude,
  ]);
}

function ecefToGrs80(
  x: number,
  y: number,
  z: number,
): Readonly<GeographicCoordinate> {
  const longitude = Math.atan2(y, x);
  const horizontalRadius = Math.hypot(x, y);
  let latitude = Math.atan2(z, horizontalRadius * (1 - GRS80_ECCENTRICITY_SQUARED));
  let height = 0;
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const sinLatitude = Math.sin(latitude);
    const normalRadius = GRS80_SEMI_MAJOR_METRES
      / Math.sqrt(1 - GRS80_ECCENTRICITY_SQUARED * sinLatitude * sinLatitude);
    height = horizontalRadius / Math.cos(latitude) - normalRadius;
    const nextLatitude = Math.atan2(
      z,
      horizontalRadius * (1 - GRS80_ECCENTRICITY_SQUARED * normalRadius / (normalRadius + height)),
    );
    if (Math.abs(nextLatitude - latitude) < 1e-14) {
      latitude = nextLatitude;
      break;
    }
    latitude = nextLatitude;
  }
  return Object.freeze({
    longitude: longitude * 180 / Math.PI,
    latitude: latitude * 180 / Math.PI,
    ellipsoidHeight: height,
  });
}

/**
 * Inverts EPSG:3111 (GDA94 / Vicgrid94) using its Lambert Conic Conformal
 * 2SP definition. The result remains explicitly GDA94; no datum equivalence
 * with WGS84 or GDA2020 is implied.
 */
export function vicgrid94ToGda94(
  point: MapGridCoordinate,
): Readonly<GeographicCoordinate> {
  if (!Number.isFinite(point?.easting) || !Number.isFinite(point?.northing)) {
    throw new Error('Vicgrid94 coordinate must have finite easting and northing.');
  }
  const falseEasting = 2_500_000;
  const falseNorthing = 2_500_000;
  const centralMeridian = radians(145);
  const latitudeOfOrigin = radians(-37);
  const firstStandardParallel = radians(-36);
  const secondStandardParallel = radians(-38);
  const eccentricity = Math.sqrt(GRS80_ECCENTRICITY_SQUARED);
  const m = (latitude: number): number => (
    Math.cos(latitude)
    / Math.sqrt(1 - GRS80_ECCENTRICITY_SQUARED * Math.sin(latitude) ** 2)
  );
  const t = (latitude: number): number => (
    Math.tan(Math.PI / 4 - latitude / 2)
    / ((1 - eccentricity * Math.sin(latitude)) / (1 + eccentricity * Math.sin(latitude)))
      ** (eccentricity / 2)
  );
  const t1 = t(firstStandardParallel);
  const t2 = t(secondStandardParallel);
  const n = (Math.log(m(firstStandardParallel)) - Math.log(m(secondStandardParallel)))
    / (Math.log(t1) - Math.log(t2));
  const f = m(firstStandardParallel) / (n * t1 ** n);
  const rho0 = GRS80_SEMI_MAJOR_METRES * f * t(latitudeOfOrigin) ** n;
  const deltaEasting = point.easting - falseEasting;
  const deltaNorthing = point.northing - falseNorthing;
  const rho = Math.sign(n) * Math.hypot(deltaEasting, rho0 - deltaNorthing);
  const theta = Math.atan2(
    Math.sign(n) * deltaEasting,
    Math.sign(n) * (rho0 - deltaNorthing),
  );
  const targetT = (rho / (GRS80_SEMI_MAJOR_METRES * f)) ** (1 / n);
  let latitude = Math.PI / 2 - 2 * Math.atan(targetT);
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const eccentricityTerm = (
      (1 - eccentricity * Math.sin(latitude))
      / (1 + eccentricity * Math.sin(latitude))
    ) ** (eccentricity / 2);
    const nextLatitude = Math.PI / 2 - 2 * Math.atan(targetT * eccentricityTerm);
    if (Math.abs(nextLatitude - latitude) < 1e-14) {
      latitude = nextLatitude;
      break;
    }
    latitude = nextLatitude;
  }
  return Object.freeze({
    longitude: (centralMeridian + theta / n) * 180 / Math.PI,
    latitude: latitude * 180 / Math.PI,
    ellipsoidHeight: 0,
  });
}

/** EPSG:8048 coordinate-frame transformation from GDA94 to GDA2020. */
export function gda94ToGda2020(
  point: Wgs84Coordinate,
): Readonly<GeographicCoordinate> {
  const [x, y, z] = grs80ToEcef(point);
  const millimetresToMetres = 1 / 1000;
  const milliarcsecondsToRadians = Math.PI / (180 * 3_600_000);
  const partsPerBillion = 1e-9;
  const translationX = 61.55 * millimetresToMetres;
  const translationY = -10.87 * millimetresToMetres;
  const translationZ = -40.19 * millimetresToMetres;
  const rotationX = -39.4924 * milliarcsecondsToRadians;
  const rotationY = -32.7221 * milliarcsecondsToRadians;
  const rotationZ = -32.8979 * milliarcsecondsToRadians;
  const scale = 1 - 9.994 * partsPerBillion;
  return ecefToGrs80(
    translationX + scale * x + rotationZ * y - rotationY * z,
    translationY - rotationZ * x + scale * y + rotationX * z,
    translationZ + rotationY * x - rotationX * y + scale * z,
  );
}

export function vicgrid94ToGda2020(
  point: MapGridCoordinate,
): Readonly<GeographicCoordinate> {
  return gda94ToGda2020(vicgrid94ToGda94(point));
}

export function wgs84ToLocalEnu(
  point: Wgs84Coordinate,
  anchor: Wgs84Coordinate,
): Readonly<EnuCoordinate> {
  assertCoordinate(point, 'point');
  assertCoordinate(anchor, 'anchor');
  const [x, y, z] = wgs84ToEcef(point);
  const [anchorX, anchorY, anchorZ] = wgs84ToEcef(anchor);
  const longitude = radians(anchor.longitude);
  const latitude = radians(anchor.latitude);
  const deltaX = x - anchorX;
  const deltaY = y - anchorY;
  const deltaZ = z - anchorZ;
  const sinLongitude = Math.sin(longitude);
  const cosLongitude = Math.cos(longitude);
  const sinLatitude = Math.sin(latitude);
  const cosLatitude = Math.cos(latitude);
  const normalizeZero = (value: number): number => Math.abs(value) < 1e-10 ? 0 : value;
  return Object.freeze({
    east: normalizeZero(-sinLongitude * deltaX + cosLongitude * deltaY),
    north: normalizeZero(
      -sinLatitude * cosLongitude * deltaX
      - sinLatitude * sinLongitude * deltaY
      + cosLatitude * deltaZ
    ),
    up: normalizeZero(
      cosLatitude * cosLongitude * deltaX
      + cosLatitude * sinLongitude * deltaY
      + sinLatitude * deltaZ
    ),
  });
}

export function wgs84ToCityScenePoint(
  point: Wgs84Coordinate,
  anchor: Wgs84Coordinate,
  elevationAhd: number,
  verticalOriginAhd = 0,
): Readonly<CitySceneCoordinate> {
  if (!Number.isFinite(elevationAhd) || !Number.isFinite(verticalOriginAhd)) {
    throw new Error('AHD elevations must be finite.');
  }
  const enu = wgs84ToLocalEnu(point, anchor);
  return Object.freeze({
    x: enu.east,
    y: elevationAhd - verticalOriginAhd,
    z: enu.north === 0 ? 0 : -enu.north,
  });
}

/**
 * Projects a source-published geographic representation of a GDA94 record
 * into MGA94 Zone 55 using the GRS80 ellipsoid. This is intentionally not a
 * GDA2020↔GDA94 datum transformation; callers must not use it to erase a
 * known datum distinction.
 */
function geographicToMgaZone55(
  point: Wgs84Coordinate,
): Readonly<MapGridCoordinate> {
  assertCoordinate(point, 'point');
  if (point.longitude < 144 || point.longitude > 150 || point.latitude >= 0 || point.latitude < -80) {
    throw new Error('point must fall inside southern-hemisphere MGA Zone 55.');
  }
  const semiMajor = 6_378_137;
  const flattening = 1 / 298.257222101;
  const eccentricitySquared = flattening * (2 - flattening);
  const secondEccentricitySquared = eccentricitySquared / (1 - eccentricitySquared);
  const scaleFactor = 0.9996;
  const centralMeridian = radians(147);
  const latitude = radians(point.latitude);
  const longitude = radians(point.longitude);
  const sinLatitude = Math.sin(latitude);
  const cosLatitude = Math.cos(latitude);
  const tangentSquared = Math.tan(latitude) ** 2;
  const secondEccentricityTerm = secondEccentricitySquared * cosLatitude ** 2;
  const longitudeTerm = cosLatitude * (longitude - centralMeridian);
  const primeVerticalRadius = semiMajor
    / Math.sqrt(1 - eccentricitySquared * sinLatitude ** 2);
  const eccentricityFourth = eccentricitySquared ** 2;
  const eccentricitySixth = eccentricitySquared ** 3;
  const meridianArc = semiMajor * (
    (1 - eccentricitySquared / 4 - 3 * eccentricityFourth / 64 - 5 * eccentricitySixth / 256)
      * latitude
    - (3 * eccentricitySquared / 8 + 3 * eccentricityFourth / 32 + 45 * eccentricitySixth / 1024)
      * Math.sin(2 * latitude)
    + (15 * eccentricityFourth / 256 + 45 * eccentricitySixth / 1024)
      * Math.sin(4 * latitude)
    - 35 * eccentricitySixth / 3072 * Math.sin(6 * latitude)
  );
  const easting = 500_000 + scaleFactor * primeVerticalRadius * (
    longitudeTerm
    + (1 - tangentSquared + secondEccentricityTerm) * longitudeTerm ** 3 / 6
    + (
      5
      - 18 * tangentSquared
      + tangentSquared ** 2
      + 72 * secondEccentricityTerm
      - 58 * secondEccentricitySquared
    ) * longitudeTerm ** 5 / 120
  );
  const northing = 10_000_000 + scaleFactor * (
    meridianArc
    + primeVerticalRadius * Math.tan(latitude) * (
      longitudeTerm ** 2 / 2
      + (5 - tangentSquared + 9 * secondEccentricityTerm + 4 * secondEccentricityTerm ** 2)
        * longitudeTerm ** 4 / 24
      + (
        61
        - 58 * tangentSquared
        + tangentSquared ** 2
        + 600 * secondEccentricityTerm
        - 330 * secondEccentricitySquared
      ) * longitudeTerm ** 6 / 720
    )
  );
  return Object.freeze({ easting, northing });
}

export function geographicToMga94Zone55(
  point: Wgs84Coordinate,
): Readonly<MapGridCoordinate> {
  return geographicToMgaZone55(point);
}

/**
 * Projects a source-published geographic GDA2020 representation into
 * MGA2020 Zone 55. GDA94 and GDA2020 both use the GRS80 ellipsoid, but this
 * separate entry point keeps their datum semantics explicit at call sites.
 */
export function geographicToMga2020Zone55(
  point: Wgs84Coordinate,
): Readonly<MapGridCoordinate> {
  return geographicToMgaZone55(point);
}
