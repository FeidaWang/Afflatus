#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { clipClosedRingToBounds, signedRingArea } from '../../src/city/geoGeometry.ts';
import { wgs84ToCityScenePoint, wgs84ToLocalEnu } from '../../src/city/projection.ts';

const INVENTORY_PATH = 'data/city/inventory/melbourne-buildings-flinders-federation-v1.json';
const WORK_PATH = 'data/city/work/melbourne-buildings-flinders-federation-v1.enu.json';
const FIXTURE_PATH = 'tests/fixtures/city/melbourne-buildings-golden-v1.json';
const QA_PATH = 'data/city/qa/melbourne-buildings-flinders-federation-v1.json';
const ANCHOR = Object.freeze({ longitude: 144.963, latitude: -37.815, ellipsoidHeight: 0 });
const VERTICAL_ORIGIN_AHD = 0;
const SAMPLE_SIZE = 24;
const PIPELINE_VERSION = 'melbourne-buildings-enu-v1';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const round = (value, digits = 3) => Number(value.toFixed(digits));
const number = (value, field) => {
  if (!Number.isFinite(value)) throw new Error(`${field} must be finite.`);
  return value;
};

function sourcePolygons(geometry) {
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

function localRing(ring, elevationAhd) {
  return ring.map(([longitude, latitude]) => {
    const point = wgs84ToCityScenePoint(
      { longitude, latitude, ellipsoidHeight: 0 },
      ANCHOR,
      elevationAhd,
      VERTICAL_ORIGIN_AHD,
    );
    return Object.freeze([round(point.x), round(point.z)]);
  });
}

function localBounds(polygons) {
  const points = polygons.flatMap((polygon) => polygon.flatMap((ring) => ring));
  return Object.freeze({
    minX: round(Math.min(...points.map(([x]) => x))),
    maxX: round(Math.max(...points.map(([x]) => x))),
    minZ: round(Math.min(...points.map(([, z]) => z))),
    maxZ: round(Math.max(...points.map(([, z]) => z))),
  });
}

function normalizeFeature(feature, bounds) {
  const properties = feature.properties || {};
  const objectId = String(properties.objectid || '').trim();
  if (!objectId) return { error: 'missing-objectid' };
  const baseElevationAhd = number(properties.structure_min_elevation, `${objectId}.structure_min_elevation`);
  const topElevationAhd = number(properties.structure_max_elevation, `${objectId}.structure_max_elevation`);
  if (!(baseElevationAhd <= topElevationAhd)) return { error: 'inverted-height' };
  const polygons = [];
  for (const polygon of sourcePolygons(feature.geometry)) {
    const clippedOuter = clipClosedRingToBounds(polygon[0], bounds);
    if (clippedOuter.length === 0) continue;
    const localOuter = localRing(clippedOuter, baseElevationAhd);
    if (Math.abs(signedRingArea(localOuter)) < 1) continue;
    const localPolygon = [localOuter];
    for (const hole of polygon.slice(1)) {
      const clippedHole = clipClosedRingToBounds(hole, bounds);
      if (clippedHole.length === 0) continue;
      const localHole = localRing(clippedHole, baseElevationAhd);
      if (Math.abs(signedRingArea(localHole)) >= 1) localPolygon.push(localHole);
    }
    polygons.push(Object.freeze(localPolygon));
  }
  if (polygons.length === 0) return { error: 'empty-after-clip' };
  const footprintAreaSquareMetres = polygons.reduce((total, polygon) => (
    total
    + Math.abs(signedRingArea(polygon[0]))
    - polygon.slice(1).reduce((holes, ring) => holes + Math.abs(signedRingArea(ring)), 0)
  ), 0);
  return {
    entity: Object.freeze({
      id: `melbourne-buildings-2023:${objectId}`,
      sourceObjectId: objectId,
      sourceStructureId: String(properties.structure_id || ''),
      kind: 'building-part',
      footprintType: String(properties.footprint_type || 'Unknown'),
      roofType: String(properties.roof_type || 'Unknown'),
      capturedAt: String(properties.date_captured || ''),
      baseElevationAhd: round(baseElevationAhd),
      topElevationAhd: round(topElevationAhd),
      height: round(topElevationAhd - baseElevationAhd),
      footprintAreaSquareMetres: round(footprintAreaSquareMetres),
      polygons: Object.freeze(polygons),
      bounds: localBounds(polygons),
    }),
  };
}

function deterministicSample(entities) {
  const byHeight = [...entities].sort((a, b) => a.height - b.height || a.id.localeCompare(b.id));
  const selected = new Map();
  for (let index = 0; index < SAMPLE_SIZE; index += 1) {
    const sourceIndex = Math.round(index * (byHeight.length - 1) / (SAMPLE_SIZE - 1));
    selected.set(byHeight[sourceIndex].id, byHeight[sourceIndex]);
  }
  return [...selected.values()].sort((a, b) => a.id.localeCompare(b.id));
}

async function main() {
  const inventory = JSON.parse(await readFile(resolve(INVENTORY_PATH), 'utf8'));
  const rawBytes = await readFile(resolve(inventory.rawPath));
  if (rawBytes.byteLength !== inventory.rawByteLength || sha256(rawBytes) !== inventory.rawSha256) {
    throw new Error('Raw building artifact no longer matches its immutable inventory record.');
  }
  const raw = JSON.parse(rawBytes.toString('utf8'));
  if (raw.type !== 'FeatureCollection' || raw.features.length !== inventory.featureCount) {
    throw new Error('Raw building artifact feature count does not match inventory.');
  }

  const errors = new Map();
  const entities = [];
  for (const feature of raw.features) {
    const result = normalizeFeature(feature, inventory.queryBoundsWgs84);
    if (result.entity) entities.push(result.entity);
    else errors.set(result.error, (errors.get(result.error) || 0) + 1);
  }
  entities.sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(entities.map(({ id }) => id)).size !== entities.length) {
    throw new Error('Derived building entity IDs are not globally unique.');
  }
  if (entities.length < 100) throw new Error(`Only ${entities.length} valid entities survived QA.`);

  const controlPoints = Object.fromEntries(Object.entries({
    anchor: [ANCHOR.longitude, ANCHOR.latitude],
    southWest: [inventory.queryBoundsWgs84.west, inventory.queryBoundsWgs84.south],
    northEast: [inventory.queryBoundsWgs84.east, inventory.queryBoundsWgs84.north],
  }).map(([id, [longitude, latitude]]) => {
    const point = wgs84ToLocalEnu({ longitude, latitude, ellipsoidHeight: 0 }, ANCHOR);
    return [id, { east: round(point.east), north: round(point.north), up: round(point.up, 6) }];
  }));
  const work = {
    schemaVersion: 1,
    fixtureId: 'melbourne-buildings-flinders-federation-v1-enu',
    pipelineVersion: PIPELINE_VERSION,
    truthClass: 'licensed-real-data-engineering-fixture',
    productionApproved: false,
    derivedFrom: { artifactId: inventory.artifactId, rawSha256: inventory.rawSha256 },
    attribution: inventory.licence.attribution,
    localFrame: {
      horizontalSourceCrs: inventory.sourceCrs,
      verticalSourceDatum: inventory.verticalDatum,
      anchorWgs84: ANCHOR,
      axes: 'x=east,y=AHD-up,z=-north',
      verticalOriginAhd: VERTICAL_ORIGIN_AHD,
      transform: 'WGS84 ellipsoid ECEF to local ENU; AHD height retained on scene Y',
    },
    clipBoundsWgs84: inventory.queryBoundsWgs84,
    entities,
  };
  const workBytes = Buffer.from(`${JSON.stringify(work)}\n`);
  const sample = {
    ...work,
    fixtureId: 'melbourne-buildings-golden-v1',
    entities: deterministicSample(entities),
  };
  const sampleBytes = Buffer.from(`${JSON.stringify(sample, null, 2)}\n`);
  const heights = entities.map(({ height }) => height);
  const areas = entities.map(({ footprintAreaSquareMetres }) => footprintAreaSquareMetres);
  const qa = {
    schemaVersion: 1,
    reportId: 'melbourne-buildings-flinders-federation-v1-qa',
    pipelineVersion: PIPELINE_VERSION,
    geometryKind: 'building-polygon',
    status: errors.size === 0 ? 'passed' : 'passed-with-exclusions',
    artifactId: inventory.artifactId,
    rawSha256: inventory.rawSha256,
    workSha256: sha256(workBytes),
    goldenFixtureSha256: sha256(sampleBytes),
    rawFeatureCount: raw.features.length,
    acceptedEntityCount: entities.length,
    excludedFeatureCount: raw.features.length - entities.length,
    exclusions: Object.fromEntries(errors),
    duplicateEntityIds: 0,
    sourceGeometryTypes: Object.fromEntries(
      [...new Set(raw.features.map(({ geometry }) => geometry.type))]
        .sort()
        .map((type) => [type, raw.features.filter(({ geometry }) => geometry.type === type).length]),
    ),
    heightMetres: {
      minimum: round(Math.min(...heights)),
      maximum: round(Math.max(...heights)),
      average: round(heights.reduce((sum, value) => sum + value, 0) / heights.length),
    },
    footprintAreaSquareMetres: {
      minimum: round(Math.min(...areas)),
      maximum: round(Math.max(...areas)),
      total: round(areas.reduce((sum, value) => sum + value, 0)),
    },
    controlPoints,
    checks: {
      rawHashMatchesInventory: true,
      featureCountMatchesInventory: true,
      entityIdsUnique: true,
      coordinatesFinite: true,
      clippedToBounds: true,
      heightsOrdered: true,
      sourceCrsResolved: inventory.sourceCrs.identifier,
      verticalDatumResolved: inventory.verticalDatum.identifier,
      productionApproved: false,
    },
  };

  await mkdir(dirname(resolve(WORK_PATH)), { recursive: true });
  await mkdir(dirname(resolve(FIXTURE_PATH)), { recursive: true });
  await mkdir(dirname(resolve(QA_PATH)), { recursive: true });
  await writeFile(resolve(WORK_PATH), workBytes);
  await writeFile(resolve(FIXTURE_PATH), sampleBytes);
  await writeFile(resolve(QA_PATH), `${JSON.stringify(qa, null, 2)}\n`);
  console.log(JSON.stringify({
    status: qa.status,
    rawFeatureCount: qa.rawFeatureCount,
    acceptedEntityCount: qa.acceptedEntityCount,
    exclusions: qa.exclusions,
    workSha256: qa.workSha256,
    goldenFixtureSha256: qa.goldenFixtureSha256,
    workPath: WORK_PATH,
    fixturePath: FIXTURE_PATH,
    qaPath: QA_PATH,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
