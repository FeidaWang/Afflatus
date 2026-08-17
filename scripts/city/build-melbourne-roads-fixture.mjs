#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { clipLineStringToBounds } from '../../src/city/geoGeometry.ts';
import { wgs84ToCityScenePoint, wgs84ToLocalEnu } from '../../src/city/projection.ts';

const INVENTORY_PATH = 'data/city/inventory/melbourne-roads-flinders-federation-v1.json';
const WORK_PATH = 'data/city/work/melbourne-roads-flinders-federation-v1.enu.json';
const FIXTURE_PATH = 'tests/fixtures/city/melbourne-roads-golden-v1.json';
const QA_PATH = 'data/city/qa/melbourne-roads-flinders-federation-v1.json';
const ANCHOR = Object.freeze({ longitude: 144.963, latitude: -37.815, ellipsoidHeight: 0 });
const SAMPLE_SIZE = 32;
const PIPELINE_VERSION = 'melbourne-roads-enu-v1';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const round = (value, digits = 3) => Number(value.toFixed(digits));
const sourceLines = (geometry) => geometry.type === 'LineString'
  ? [geometry.coordinates]
  : geometry.coordinates;

function localPoint([longitude, latitude]) {
  const point = wgs84ToCityScenePoint(
    { longitude, latitude, ellipsoidHeight: 0 },
    ANCHOR,
    0,
    0,
  );
  return Object.freeze([round(point.x), round(point.z)]);
}

function lineLength(line) {
  return line.slice(1).reduce((total, point, index) => (
    total + Math.hypot(point[0] - line[index][0], point[1] - line[index][1])
  ), 0);
}

function localBounds(lines) {
  const points = lines.flat();
  return Object.freeze({
    minX: round(Math.min(...points.map(([x]) => x))),
    maxX: round(Math.max(...points.map(([x]) => x))),
    minZ: round(Math.min(...points.map(([, z]) => z))),
    maxZ: round(Math.max(...points.map(([, z]) => z))),
  });
}

function normalizeFeature(feature, bounds) {
  const properties = feature.properties || {};
  const pfi = String(properties.pfi || '').trim();
  if (!pfi) return { error: 'missing-pfi' };
  const lines = sourceLines(feature.geometry)
    .flatMap((line) => clipLineStringToBounds(line, bounds))
    .map((line) => Object.freeze(line.map(localPoint)))
    .filter((line) => lineLength(line) >= 0.1);
  if (lines.length === 0) return { error: 'empty-after-clip' };
  const derivedLengthMetres = lines.reduce((total, line) => total + lineLength(line), 0);
  return {
    entity: Object.freeze({
      id: `melbourne-vicmap-roads:${pfi}`,
      sourcePfi: pfi,
      sourceUfi: Number.isSafeInteger(properties.ufi) ? properties.ufi : null,
      fromUfi: Number.isSafeInteger(properties.from_ufi) ? properties.from_ufi : null,
      toUfi: Number.isSafeInteger(properties.to_ufi) ? properties.to_ufi : null,
      kind: 'road-centreline',
      featureType: String(properties.feature_type_code || 'unknown'),
      roadName: String(properties.ezi_road_name_label || properties.road_name || ''),
      roadType: String(properties.road_type || ''),
      classCode: Number.isSafeInteger(properties.class_code) ? properties.class_code : null,
      directionCode: String(properties.direction_code || ''),
      roadStatus: String(properties.road_status || ''),
      vehicularAccess: String(properties.vehicular_access || ''),
      structureName: String(properties.structure_name || ''),
      derivedLengthMetres: round(derivedLengthMetres),
      lines: Object.freeze(lines),
      bounds: localBounds(lines),
    }),
  };
}

function deterministicSample(entities) {
  const ordered = [...entities].sort((a, b) => (
    (a.classCode ?? 999) - (b.classCode ?? 999)
    || a.derivedLengthMetres - b.derivedLengthMetres
    || a.id.localeCompare(b.id)
  ));
  const selected = new Map();
  for (let index = 0; index < SAMPLE_SIZE; index += 1) {
    const sourceIndex = Math.round(index * (ordered.length - 1) / (SAMPLE_SIZE - 1));
    selected.set(ordered[sourceIndex].id, ordered[sourceIndex]);
  }
  return [...selected.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function counts(values) {
  return Object.fromEntries([...new Set(values)].sort().map((value) => [
    String(value),
    values.filter((candidate) => candidate === value).length,
  ]));
}

async function main() {
  const inventory = JSON.parse(await readFile(resolve(INVENTORY_PATH), 'utf8'));
  const rawBytes = await readFile(resolve(inventory.rawPath));
  if (rawBytes.byteLength !== inventory.rawByteLength || sha256(rawBytes) !== inventory.rawSha256) {
    throw new Error('Raw road artifact no longer matches its immutable inventory record.');
  }
  const raw = JSON.parse(rawBytes.toString('utf8'));
  if (raw.type !== 'FeatureCollection' || raw.features.length !== inventory.featureCount) {
    throw new Error('Raw road artifact feature count does not match inventory.');
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
    throw new Error('Derived road entity IDs are not globally unique.');
  }
  if (entities.length < 100) throw new Error(`Only ${entities.length} valid road entities survived QA.`);

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
    fixtureId: 'melbourne-roads-flinders-federation-v1-enu',
    pipelineVersion: PIPELINE_VERSION,
    truthClass: 'licensed-real-data-engineering-fixture',
    productionApproved: false,
    derivedFrom: { artifactId: inventory.artifactId, rawSha256: inventory.rawSha256 },
    attribution: inventory.licence.attribution,
    localFrame: {
      horizontalSourceCrs: inventory.sourceCrs,
      verticalSourceDatum: inventory.verticalDatum,
      anchorWgs84: ANCHOR,
      axes: 'x=east,y=up,z=-north',
      transform: 'WGS84 ellipsoid ECEF to local ENU; source has no elevation',
    },
    clipBoundsWgs84: inventory.queryBoundsWgs84,
    entities,
  };
  const workBytes = Buffer.from(`${JSON.stringify(work)}\n`);
  const sample = {
    ...work,
    fixtureId: 'melbourne-roads-golden-v1',
    entities: deterministicSample(entities),
  };
  const sampleBytes = Buffer.from(`${JSON.stringify(sample, null, 2)}\n`);
  const lengths = entities.map(({ derivedLengthMetres }) => derivedLengthMetres);
  const qa = {
    schemaVersion: 1,
    reportId: 'melbourne-roads-flinders-federation-v1-qa',
    pipelineVersion: PIPELINE_VERSION,
    geometryKind: 'linear-network',
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
    sourceGeometryTypes: counts(raw.features.map(({ geometry }) => geometry.type)),
    roadClassCounts: counts(entities.map(({ classCode }) => classCode ?? 'unknown')),
    featureTypeCounts: counts(entities.map(({ featureType }) => featureType)),
    derivedLengthMetres: {
      minimum: round(Math.min(...lengths)),
      maximum: round(Math.max(...lengths)),
      total: round(lengths.reduce((sum, value) => sum + value, 0)),
    },
    clippedLinePartCount: entities.reduce((total, { lines }) => total + lines.length, 0),
    controlPoints,
    checks: {
      rawHashMatchesInventory: true,
      featureCountMatchesInventory: true,
      entityIdsUnique: true,
      coordinatesFinite: true,
      clippedToBounds: true,
      lengthsPositive: entities.every(({ derivedLengthMetres }) => derivedLengthMetres > 0),
      lineEndpointsFinite: entities.every(({ lines }) => lines.every((line) => (
        line.length >= 2 && line.flat().every(Number.isFinite)
      ))),
      stableTopologyIdsPresent: entities.every(({ sourcePfi }) => sourcePfi.length > 0),
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
    totalLengthMetres: qa.derivedLengthMetres.total,
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
