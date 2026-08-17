#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  clipClosedRingToBounds,
  clipLineStringToBounds,
  signedRingArea,
} from '../../src/city/geoGeometry.ts';
import { wgs84ToCityScenePoint, wgs84ToLocalEnu } from '../../src/city/projection.ts';

const INVENTORY_PATH = 'data/city/inventory/melbourne-hydro-flinders-federation-v1.json';
const WORK_PATH = 'data/city/work/melbourne-hydro-flinders-federation-v1.enu.json';
const FIXTURE_PATH = 'tests/fixtures/city/melbourne-hydro-golden-v1.json';
const QA_PATH = 'data/city/qa/melbourne-hydro-flinders-federation-v1.json';
const WATER_MEMBER = 'water-area.geojson';
const STRUCTURE_MEMBER = 'water-structure-line.geojson';
const ANCHOR = Object.freeze({ longitude: 144.963, latitude: -37.815, ellipsoidHeight: 0 });
const PIPELINE_VERSION = 'melbourne-hydro-enu-v1';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const round = (value, digits = 3) => Number(value.toFixed(digits));
const optionalText = (value) => String(value ?? '').trim() || null;
const sourcePolygons = (geometry) => geometry.type === 'Polygon'
  ? [geometry.coordinates]
  : geometry.coordinates;
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

function localBounds(points) {
  return Object.freeze({
    minX: round(Math.min(...points.map(([x]) => x))),
    maxX: round(Math.max(...points.map(([x]) => x))),
    minZ: round(Math.min(...points.map(([, z]) => z))),
    maxZ: round(Math.max(...points.map(([, z]) => z))),
  });
}

function normalizeWaterFeature(feature, bounds) {
  const properties = feature.properties || {};
  const pfi = String(properties.pfi || '').trim();
  if (!pfi) return { error: 'water-missing-pfi' };
  const polygons = [];
  const shorelineLines = [];
  for (const polygon of sourcePolygons(feature.geometry)) {
    const clippedOuter = clipClosedRingToBounds(polygon[0], bounds);
    if (clippedOuter.length === 0) continue;
    const localOuter = Object.freeze(clippedOuter.map(localPoint));
    if (Math.abs(signedRingArea(localOuter)) < 1) continue;
    const localPolygon = [localOuter];
    for (const hole of polygon.slice(1)) {
      const clippedHole = clipClosedRingToBounds(hole, bounds);
      if (clippedHole.length === 0) continue;
      const localHole = Object.freeze(clippedHole.map(localPoint));
      if (Math.abs(signedRingArea(localHole)) >= 1) localPolygon.push(localHole);
    }
    polygons.push(Object.freeze(localPolygon));
    shorelineLines.push(...clipLineStringToBounds(polygon[0], bounds)
      .map((line) => Object.freeze(line.map(localPoint)))
      .filter((line) => lineLength(line) >= 0.1));
  }
  if (polygons.length === 0) return { error: 'water-empty-after-clip' };
  const areaSquareMetres = polygons.reduce((total, polygon) => (
    total
    + Math.abs(signedRingArea(polygon[0]))
    - polygon.slice(1).reduce((holes, ring) => holes + Math.abs(signedRingArea(ring)), 0)
  ), 0);
  const sourceShorelineLengthMetres = shorelineLines.reduce((total, line) => total + lineLength(line), 0);
  const points = polygons.flatMap((polygon) => polygon.flat());
  return {
    entity: Object.freeze({
      id: `melbourne-vicmap-hydro:water-area:${pfi}`,
      sourcePfi: pfi,
      sourceUfi: Number.isSafeInteger(properties.ufi) ? properties.ufi : null,
      kind: 'water-area',
      featureType: String(properties.feature_type_code || 'unknown'),
      name: optionalText(properties.name),
      waterUseFunction: optionalText(properties.water_use_function),
      waterbodyState: optionalText(properties.waterbody_state),
      areaSquareMetres: round(areaSquareMetres),
      sourceShorelineLengthMetres: round(sourceShorelineLengthMetres),
      polygons: Object.freeze(polygons),
      shorelineLines: Object.freeze(shorelineLines),
      bounds: localBounds(points),
    }),
  };
}

function normalizeStructureFeature(feature, bounds) {
  const properties = feature.properties || {};
  const pfi = String(properties.pfi || '').trim();
  if (!pfi) return { error: 'structure-missing-pfi' };
  const lines = sourceLines(feature.geometry)
    .flatMap((line) => clipLineStringToBounds(line, bounds))
    .map((line) => Object.freeze(line.map(localPoint)))
    .filter((line) => lineLength(line) >= 0.1);
  if (lines.length === 0) return { error: 'structure-empty-after-clip' };
  const derivedLengthMetres = lines.reduce((total, line) => total + lineLength(line), 0);
  return {
    entity: Object.freeze({
      id: `melbourne-vicmap-hydro:water-structure:${pfi}`,
      sourcePfi: pfi,
      sourceUfi: Number.isSafeInteger(properties.ufi) ? properties.ufi : null,
      kind: 'water-structure-line',
      featureType: String(properties.feature_type_code || 'unknown'),
      name: optionalText(properties.name),
      constructionType: optionalText(properties.construction_type),
      structureType: optionalText(properties.structure_type),
      groundRelationship: optionalText(properties.ground_relationship),
      derivedLengthMetres: round(derivedLengthMetres),
      lines: Object.freeze(lines),
      bounds: localBounds(lines.flat()),
    }),
  };
}

function counts(values) {
  return Object.fromEntries([...new Set(values)].sort().map((value) => [
    String(value),
    values.filter((candidate) => candidate === value).length,
  ]));
}

async function archiveMember(inventory, memberName) {
  const member = inventory.archiveMembers.find(({ path }) => path === memberName);
  if (!member) throw new Error(`${memberName} is missing from the Hydro inventory.`);
  const bytes = execFileSync('unzip', ['-p', resolve(inventory.rawPath), memberName], {
    maxBuffer: 64 * 1024 * 1024,
  });
  if (bytes.byteLength !== member.byteLength || sha256(bytes) !== member.sha256) {
    throw new Error(`${memberName} no longer matches its immutable member inventory.`);
  }
  const data = JSON.parse(bytes.toString('utf8'));
  if (data.type !== 'FeatureCollection' || data.features.length !== member.featureCount) {
    throw new Error(`${memberName} feature count does not match inventory.`);
  }
  return { member, data };
}

async function main() {
  const inventory = JSON.parse(await readFile(resolve(INVENTORY_PATH), 'utf8'));
  const rawBytes = await readFile(resolve(inventory.rawPath));
  if (rawBytes.byteLength !== inventory.rawByteLength || sha256(rawBytes) !== inventory.rawSha256) {
    throw new Error('Raw Hydro archive no longer matches its immutable inventory record.');
  }
  const water = await archiveMember(inventory, WATER_MEMBER);
  const structures = await archiveMember(inventory, STRUCTURE_MEMBER);
  const errors = new Map();
  const entities = [];
  for (const feature of water.data.features) {
    const result = normalizeWaterFeature(feature, inventory.queryBoundsWgs84);
    if (result.entity) entities.push(result.entity);
    else errors.set(result.error, (errors.get(result.error) || 0) + 1);
  }
  for (const feature of structures.data.features) {
    const result = normalizeStructureFeature(feature, inventory.queryBoundsWgs84);
    if (result.entity) entities.push(result.entity);
    else errors.set(result.error, (errors.get(result.error) || 0) + 1);
  }
  entities.sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(entities.map(({ id }) => id)).size !== entities.length) {
    throw new Error('Derived Hydro entity IDs are not globally unique.');
  }
  const waterEntities = entities.filter(({ kind }) => kind === 'water-area');
  const structureEntities = entities.filter(({ kind }) => kind === 'water-structure-line');
  if (waterEntities.length === 0 || structureEntities.length === 0) {
    throw new Error('Hydro precinct must contain both water area and structure entities.');
  }

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
    fixtureId: 'melbourne-hydro-flinders-federation-v1-enu',
    pipelineVersion: PIPELINE_VERSION,
    truthClass: 'licensed-real-data-engineering-fixture',
    productionApproved: false,
    derivedFrom: {
      artifactId: inventory.artifactId,
      rawSha256: inventory.rawSha256,
      archiveMembers: inventory.archiveMembers.map(({ path, sha256: memberSha256 }) => ({ path, sha256: memberSha256 })),
    },
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
  const sample = { ...work, fixtureId: 'melbourne-hydro-golden-v1' };
  const sampleBytes = Buffer.from(`${JSON.stringify(sample, null, 2)}\n`);
  const waterAreaSquareMetres = waterEntities.reduce((total, entity) => total + entity.areaSquareMetres, 0);
  const sourceShorelineLengthMetres = waterEntities.reduce((total, entity) => total + entity.sourceShorelineLengthMetres, 0);
  const structureLengthMetres = structureEntities.reduce((total, entity) => total + entity.derivedLengthMetres, 0);
  const rawFeatureCount = water.data.features.length + structures.data.features.length;
  const qa = {
    schemaVersion: 1,
    reportId: 'melbourne-hydro-flinders-federation-v1-qa',
    pipelineVersion: PIPELINE_VERSION,
    geometryKind: 'hydrography',
    status: errors.size === 0 ? 'passed' : 'passed-with-exclusions',
    artifactId: inventory.artifactId,
    rawSha256: inventory.rawSha256,
    workSha256: sha256(workBytes),
    goldenFixtureSha256: sha256(sampleBytes),
    rawFeatureCount,
    acceptedEntityCount: entities.length,
    excludedFeatureCount: rawFeatureCount - entities.length,
    exclusions: Object.fromEntries(errors),
    duplicateEntityIds: 0,
    sourceGeometryTypes: { Polygon: water.data.features.length, LineString: structures.data.features.length },
    featureTypeCounts: counts(entities.map(({ featureType }) => featureType)),
    waterAreaSquareMetres: round(waterAreaSquareMetres),
    sourceShorelineLengthMetres: round(sourceShorelineLengthMetres),
    structureLengthMetres: round(structureLengthMetres),
    controlPoints,
    checks: {
      rawHashMatchesInventory: true,
      featureCountMatchesInventory: rawFeatureCount === inventory.featureCount,
      entityIdsUnique: true,
      coordinatesFinite: entities.every(({ bounds }) => Object.values(bounds).every(Number.isFinite)),
      clippedToBounds: true,
      waterAreaPositive: waterAreaSquareMetres > 0,
      shorelinePositive: sourceShorelineLengthMetres > 0,
      structureLengthsPositive: structureEntities.every(({ derivedLengthMetres }) => derivedLengthMetres > 0),
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
    waterAreaSquareMetres: qa.waterAreaSquareMetres,
    sourceShorelineLengthMetres: qa.sourceShorelineLengthMetres,
    structureLengthMetres: qa.structureLengthMetres,
    featureTypeCounts: qa.featureTypeCounts,
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
