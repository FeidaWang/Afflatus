#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { clipLineStringToBounds } from '../../src/city/geoGeometry.ts';
import { wgs84ToCityScenePoint, wgs84ToLocalEnu } from '../../src/city/projection.ts';

const INVENTORY_PATH = 'data/city/inventory/melbourne-pedestrian-network-complete-v1.json';
const WORK_PATH = 'data/city/work/melbourne-pedestrian-network-complete-v1.enu.json';
const FIXTURE_PATH = 'tests/fixtures/city/melbourne-pedestrian-golden-v1.json';
const QA_PATH = 'data/city/qa/melbourne-pedestrian-network-complete-v1.json';
const ARCHIVE_MEMBER = 'Pedestrian_network.json';
const ANCHOR = Object.freeze({ longitude: 144.963, latitude: -37.815, ellipsoidHeight: 0 });
const SAMPLE_SIZE = 36;
const PIPELINE_VERSION = 'melbourne-pedestrian-enu-v1';
const SEMANTIC_CLASS = Object.freeze({
  1: 'footpath',
  2: 'long-wait-crossing',
  3: 'short-wait-crossing',
  4: 'zebra-crossing',
  5: 'tram-crossing',
  6: 'arcade',
  7: 'lane',
  91: 'entrance-connector',
  92: 'centroid-connector',
});

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const round = (value, digits = 3) => Number(value.toFixed(digits));
const optionalText = (value) => String(value ?? '').trim() || null;

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
  const objectId = properties.OBJECTID;
  if (!Number.isSafeInteger(objectId)) return { error: 'missing-objectid' };
  const linkType = properties.TYPE;
  if (!Number.isSafeInteger(linkType) || !SEMANTIC_CLASS[linkType]) {
    return { error: 'unknown-link-type' };
  }
  const sourceCost = Number(properties.COST);
  const sourceShapeLength = Number(properties.Shape_Length);
  if (!Number.isFinite(sourceCost) || !Number.isFinite(sourceShapeLength)) {
    return { error: 'invalid-source-measure' };
  }
  const lines = clipLineStringToBounds(feature.geometry.coordinates, bounds)
    .map((line) => Object.freeze(line.map(localPoint)))
    .filter((line) => lineLength(line) >= 0.1);
  if (lines.length === 0) return { error: 'outside-or-empty-after-clip' };
  const derivedLengthMetres = lines.reduce((total, line) => total + lineLength(line), 0);
  return {
    entity: Object.freeze({
      id: `melbourne-pedestrian-network:${objectId}`,
      sourceObjectId: objectId,
      sourceNetId: Number.isSafeInteger(properties.NETID) ? properties.NETID : null,
      kind: 'pedestrian-link',
      linkType,
      semanticClass: SEMANTIC_CLASS[linkType],
      sourceDescription: optionalText(properties.DESCRIPTION),
      trafficClass: optionalText(properties.TRAFFIC),
      sourceCost: round(sourceCost, 6),
      sourceShapeLengthMetres: round(sourceShapeLength, 6),
      openingTime: optionalText(properties.OTIME),
      closingTime: optionalText(properties.CTIME),
      mccid: Number.isSafeInteger(properties.MCCID) ? properties.MCCID : null,
      mccidA: Number.isSafeInteger(properties.MCCID_A) ? properties.MCCID_A : null,
      mccidB: Number.isSafeInteger(properties.MCCID_B) ? properties.MCCID_B : null,
      derivedLengthMetres: round(derivedLengthMetres),
      lines: Object.freeze(lines),
      bounds: localBounds(lines),
    }),
  };
}

function deterministicSample(entities) {
  const selected = new Map();
  const byClass = Object.values(SEMANTIC_CLASS).map((semanticClass) => (
    entities.filter((entity) => entity.semanticClass === semanticClass)
      .sort((a, b) => a.derivedLengthMetres - b.derivedLengthMetres || a.id.localeCompare(b.id))
  ));
  for (const group of byClass) {
    if (group.length === 0) continue;
    for (const ratio of [0, 0.5, 1]) {
      const entity = group[Math.round(ratio * (group.length - 1))];
      selected.set(entity.id, entity);
    }
  }
  const all = [...entities].sort((a, b) => a.id.localeCompare(b.id));
  for (let index = 0; selected.size < SAMPLE_SIZE && index < SAMPLE_SIZE * 4; index += 1) {
    const entity = all[Math.round(index * (all.length - 1) / (SAMPLE_SIZE * 4 - 1))];
    selected.set(entity.id, entity);
  }
  return [...selected.values()].slice(0, SAMPLE_SIZE).sort((a, b) => a.id.localeCompare(b.id));
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
    throw new Error('Raw pedestrian archive no longer matches its immutable inventory record.');
  }
  const memberInventory = inventory.archiveMembers.find(({ path }) => path === ARCHIVE_MEMBER);
  if (!memberInventory) throw new Error(`${ARCHIVE_MEMBER} is missing from the inventory.`);
  const memberBytes = execFileSync('unzip', ['-p', resolve(inventory.rawPath), ARCHIVE_MEMBER], {
    maxBuffer: 64 * 1024 * 1024,
  });
  if (memberBytes.byteLength !== memberInventory.byteLength || sha256(memberBytes) !== memberInventory.sha256) {
    throw new Error(`${ARCHIVE_MEMBER} no longer matches its immutable member inventory.`);
  }
  const raw = JSON.parse(memberBytes.toString('utf8'));
  if (raw.type !== 'FeatureCollection' || raw.features.length !== inventory.featureCount) {
    throw new Error('Pedestrian feature count does not match inventory.');
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
    throw new Error('Derived pedestrian entity IDs are not globally unique.');
  }
  if (entities.length < 1_000) throw new Error(`Only ${entities.length} pedestrian entities survived precinct QA.`);

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
    fixtureId: 'melbourne-pedestrian-network-complete-v1-enu',
    pipelineVersion: PIPELINE_VERSION,
    truthClass: 'licensed-real-data-engineering-fixture',
    productionApproved: false,
    derivedFrom: {
      artifactId: inventory.artifactId,
      rawSha256: inventory.rawSha256,
      archiveMember: ARCHIVE_MEMBER,
      archiveMemberSha256: memberInventory.sha256,
    },
    attribution: inventory.licence.attribution,
    sourceStrategyEvidence: inventory.sourceStrategyEvidence,
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
    fixtureId: 'melbourne-pedestrian-golden-v1',
    entities: deterministicSample(entities),
  };
  const sampleBytes = Buffer.from(`${JSON.stringify(sample, null, 2)}\n`);
  const lengths = entities.map(({ derivedLengthMetres }) => derivedLengthMetres);
  const qa = {
    schemaVersion: 1,
    reportId: 'melbourne-pedestrian-network-complete-v1-qa',
    pipelineVersion: PIPELINE_VERSION,
    geometryKind: 'linear-network',
    status: errors.size === 0 ? 'passed' : 'passed-with-exclusions',
    artifactId: inventory.artifactId,
    rawSha256: inventory.rawSha256,
    archiveMemberSha256: memberInventory.sha256,
    workSha256: sha256(workBytes),
    goldenFixtureSha256: sha256(sampleBytes),
    rawFeatureCount: raw.features.length,
    acceptedEntityCount: entities.length,
    excludedFeatureCount: raw.features.length - entities.length,
    exclusions: Object.fromEntries(errors),
    duplicateEntityIds: 0,
    sourceGeometryTypes: { LineString: raw.features.length },
    semanticClassCounts: counts(entities.map(({ semanticClass }) => semanticClass)),
    trafficClassCounts: counts(entities.map(({ trafficClass }) => trafficClass ?? 'unknown')),
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
      stableTopologyIdsPresent: entities.every(({ sourceObjectId }) => Number.isSafeInteger(sourceObjectId)),
      sourceSemanticFieldsPresent: entities.every(({ semanticClass, sourceCost }) => (
        Boolean(semanticClass) && Number.isFinite(sourceCost)
      )),
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
    semanticClassCounts: qa.semanticClassCounts,
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
