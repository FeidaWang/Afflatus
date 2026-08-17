#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { geographicToMga94Zone55, wgs84ToLocalEnu } from '../../src/city/projection.ts';

const INVENTORY_PATH = 'data/city/inventory/melbourne-trees-flinders-federation-v1.json';
const WORK_PATH = 'data/city/work/melbourne-trees-flinders-federation-v1.enu.json';
const FIXTURE_PATH = 'tests/fixtures/city/melbourne-trees-golden-v1.json';
const QA_PATH = 'data/city/qa/melbourne-trees-flinders-federation-v1.json';
const ANCHOR = Object.freeze({ longitude: 144.963, latitude: -37.815, ellipsoidHeight: 0 });
const SAMPLE_SIZE = 40;
const PIPELINE_VERSION = 'melbourne-trees-enu-v1';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const round = (value, digits = 3) => Number(value.toFixed(digits));
const finiteNumberOrNull = (value) => (
  value === null || value === undefined || value === '' || !Number.isFinite(Number(value))
    ? null
    : Number(value)
);

function counts(values) {
  return Object.fromEntries([...new Set(values)].sort().map((value) => [
    String(value),
    values.filter((candidate) => candidate === value).length,
  ]));
}

function normalizeFeature(feature, bounds) {
  const properties = feature.properties || {};
  const comId = String(properties.com_id || '').trim();
  if (!comId) return { error: 'missing-com-id' };
  if (feature.geometry?.type !== 'Point') return { error: 'not-a-point' };
  const [longitude, latitude] = feature.geometry.coordinates || [];
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return { error: 'invalid-coordinate' };
  }
  if (
    longitude < bounds.west
    || longitude > bounds.east
    || latitude < bounds.south
    || latitude > bounds.north
  ) return { error: 'outside-clip-bounds' };

  const local = wgs84ToLocalEnu({ longitude, latitude, ellipsoidHeight: 0 }, ANCHOR);
  const propertyLongitude = finiteNumberOrNull(properties.longitude);
  const propertyLatitude = finiteNumberOrNull(properties.latitude);
  const propertyResidual = propertyLongitude === null || propertyLatitude === null
    ? null
    : wgs84ToLocalEnu(
      { longitude: propertyLongitude, latitude: propertyLatitude, ellipsoidHeight: 0 },
      { longitude, latitude, ellipsoidHeight: 0 },
    );
  const diameterBreastHeight = finiteNumberOrNull(properties.diameter_breast_height);
  if (diameterBreastHeight !== null && diameterBreastHeight < 0) {
    return { error: 'negative-diameter-breast-height' };
  }
  const locatedIn = String(properties.located_in || '').trim();
  if (!locatedIn) return { error: 'missing-location-class' };
  const sourceMgaEasting = finiteNumberOrNull(properties.easting);
  const sourceMgaNorthing = finiteNumberOrNull(properties.northing);
  if (sourceMgaEasting === null || sourceMgaNorthing === null) {
    return { error: 'missing-mga94-coordinate' };
  }
  const projectedMga = geographicToMga94Zone55({ longitude, latitude });

  return {
    entity: Object.freeze({
      id: `melbourne-urban-forest-trees:${comId}`,
      sourceComId: comId,
      kind: 'tree-point',
      commonName: String(properties.common_name || ''),
      scientificName: String(properties.scientific_name || ''),
      genus: String(properties.genus || ''),
      family: String(properties.family || ''),
      diameterBreastHeight,
      yearPlanted: String(properties.year_planted || ''),
      datePlanted: String(properties.date_planted || ''),
      ageDescription: String(properties.age_description || ''),
      usefulLifeExpectancy: String(properties.useful_life_expectency || ''),
      usefulLifeExpectancyValue: finiteNumberOrNull(properties.useful_life_expectency_value),
      precinct: String(properties.precinct || ''),
      locatedIn,
      sourceMga94Zone55: Object.freeze({
        easting: sourceMgaEasting,
        northing: sourceMgaNorthing,
      }),
      sourceWgs84: Object.freeze([longitude, latitude]),
      horizontalPosition: Object.freeze([round(local.east), round(-local.north)]),
      coordinateFieldResidualMetres: propertyResidual === null
        ? null
        : round(Math.hypot(propertyResidual.east, propertyResidual.north), 6),
      mga94FieldResidualMetres: round(Math.hypot(
        projectedMga.easting - sourceMgaEasting,
        projectedMga.northing - sourceMgaNorthing,
      ), 6),
    }),
  };
}

function deterministicSample(entities) {
  const selected = new Map();
  const bySpecies = [...entities].sort((a, b) => (
    a.commonName.localeCompare(b.commonName) || a.id.localeCompare(b.id)
  ));
  for (const entity of bySpecies) {
    if (![...selected.values()].some(({ commonName }) => commonName === entity.commonName)) {
      selected.set(entity.id, entity);
    }
    if (selected.size >= SAMPLE_SIZE / 2) break;
  }
  const spatial = [...entities].sort((a, b) => (
    a.horizontalPosition[0] - b.horizontalPosition[0]
    || a.horizontalPosition[1] - b.horizontalPosition[1]
    || a.id.localeCompare(b.id)
  ));
  for (let index = 0; index < SAMPLE_SIZE * 3 && selected.size < SAMPLE_SIZE; index += 1) {
    const sourceIndex = Math.round(index * (spatial.length - 1) / (SAMPLE_SIZE * 3 - 1));
    selected.set(spatial[sourceIndex].id, spatial[sourceIndex]);
  }
  for (const entity of spatial) {
    if (selected.size >= SAMPLE_SIZE) break;
    selected.set(entity.id, entity);
  }
  return [...selected.values()].sort((a, b) => a.id.localeCompare(b.id));
}

async function main() {
  const inventory = JSON.parse(await readFile(resolve(INVENTORY_PATH), 'utf8'));
  const rawBytes = await readFile(resolve(inventory.rawPath));
  if (rawBytes.byteLength !== inventory.rawByteLength || sha256(rawBytes) !== inventory.rawSha256) {
    throw new Error('Raw tree artifact no longer matches its immutable inventory record.');
  }
  const raw = JSON.parse(rawBytes.toString('utf8'));
  if (raw.type !== 'FeatureCollection' || raw.features.length !== inventory.featureCount) {
    throw new Error('Raw tree artifact feature count does not match inventory.');
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
    throw new Error('Derived tree entity IDs are not globally unique.');
  }
  if (entities.length < 500) throw new Error(`Only ${entities.length} valid tree entities survived QA.`);

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
    fixtureId: 'melbourne-trees-flinders-federation-v1-enu',
    pipelineVersion: PIPELINE_VERSION,
    truthClass: 'licensed-real-data-engineering-fixture',
    productionApproved: false,
    derivedFrom: { artifactId: inventory.artifactId, rawSha256: inventory.rawSha256 },
    attribution: inventory.licence.attribution,
    localFrame: {
      horizontalSourceCrs: inventory.sourceCrs,
      verticalSourceDatum: inventory.verticalDatum,
      anchorWgs84: ANCHOR,
      axes: 'horizontalPosition=[east,-north]; no source elevation',
      transform: 'WGS84 ellipsoid ECEF to local ENU; vertical placement deferred to an approved terrain/ground surface',
    },
    clipBoundsWgs84: inventory.queryBoundsWgs84,
    entities,
  };
  const workBytes = Buffer.from(`${JSON.stringify(work)}\n`);
  const fixture = {
    ...work,
    fixtureId: 'melbourne-trees-golden-v1',
    entities: deterministicSample(entities),
  };
  const fixtureBytes = Buffer.from(`${JSON.stringify(fixture, null, 2)}\n`);
  const diameters = entities
    .map(({ diameterBreastHeight }) => diameterBreastHeight)
    .filter(Number.isFinite);
  const residuals = entities
    .map(({ coordinateFieldResidualMetres }) => coordinateFieldResidualMetres)
    .filter(Number.isFinite);
  const mgaResiduals = entities.map(({ mga94FieldResidualMetres }) => mga94FieldResidualMetres);
  const qa = {
    schemaVersion: 1,
    reportId: 'melbourne-trees-flinders-federation-v1-qa',
    pipelineVersion: PIPELINE_VERSION,
    geometryKind: 'vegetation-point',
    status: errors.size === 0 ? 'passed' : 'passed-with-exclusions',
    artifactId: inventory.artifactId,
    rawSha256: inventory.rawSha256,
    workSha256: sha256(workBytes),
    goldenFixtureSha256: sha256(fixtureBytes),
    rawFeatureCount: raw.features.length,
    acceptedEntityCount: entities.length,
    excludedFeatureCount: raw.features.length - entities.length,
    exclusions: Object.fromEntries(errors),
    duplicateEntityIds: 0,
    sourceGeometryTypes: counts(raw.features.map(({ geometry }) => geometry?.type || 'missing')),
    locationClassCounts: counts(entities.map(({ locatedIn }) => locatedIn)),
    ageDescriptionCounts: counts(entities.map(({ ageDescription }) => ageDescription)),
    precinctCounts: counts(entities.map(({ precinct }) => precinct)),
    distinctCommonNameCount: new Set(entities.map(({ commonName }) => commonName)).size,
    distinctGenusCount: new Set(entities.map(({ genus }) => genus)).size,
    distinctFamilyCount: new Set(entities.map(({ family }) => family)).size,
    missingDiameterBreastHeightCount: entities.length - diameters.length,
    diameterBreastHeightSourceValues: {
      unit: 'not-declared-in-source-metadata',
      minimum: round(Math.min(...diameters)),
      maximum: round(Math.max(...diameters)),
      average: round(diameters.reduce((sum, value) => sum + value, 0) / diameters.length),
    },
    coordinateFieldResidualMetres: {
      maximum: round(Math.max(...residuals), 6),
      average: round(residuals.reduce((sum, value) => sum + value, 0) / residuals.length, 6),
    },
    mga94FieldResidualMetres: {
      maximum: round(Math.max(...mgaResiduals), 6),
      average: round(mgaResiduals.reduce((sum, value) => sum + value, 0) / mgaResiduals.length, 6),
      withinTwoCentimetres: mgaResiduals.filter((value) => value <= 0.02).length,
      overOneMetre: mgaResiduals.filter((value) => value > 1).length,
      interpretation: 'Dual-coordinate source-field consistency check; mismatches are preserved and this is not an independent surveyed control point residual.',
    },
    controlPoints,
    checks: {
      rawHashMatchesInventory: true,
      featureCountMatchesInventory: true,
      entityIdsUnique: true,
      coordinatesFinite: true,
      clippedToBounds: true,
      pointCoordinatesFinite: entities.every(({ horizontalPosition }) => (
        horizontalPosition.length === 2 && horizontalPosition.every(Number.isFinite)
      )),
      stableAssetIdsPresent: entities.every(({ sourceComId }) => sourceComId.length > 0),
      dimensionsNonNegative: entities.every(({ diameterBreastHeight }) => (
        diameterBreastHeight === null || diameterBreastHeight >= 0
      )),
      locationClassPresent: entities.every(({ locatedIn }) => locatedIn.length > 0),
      sourceCoordinateRepresentationsChecked: true,
      sourceCrsResolved: inventory.sourceCrs.identifier,
      verticalDatumResolved: inventory.verticalDatum.identifier,
      productionApproved: false,
    },
  };

  await mkdir(dirname(resolve(WORK_PATH)), { recursive: true });
  await mkdir(dirname(resolve(FIXTURE_PATH)), { recursive: true });
  await mkdir(dirname(resolve(QA_PATH)), { recursive: true });
  await writeFile(resolve(WORK_PATH), workBytes);
  await writeFile(resolve(FIXTURE_PATH), fixtureBytes);
  await writeFile(resolve(QA_PATH), `${JSON.stringify(qa, null, 2)}\n`);
  console.log(JSON.stringify({
    status: qa.status,
    rawFeatureCount: qa.rawFeatureCount,
    acceptedEntityCount: qa.acceptedEntityCount,
    exclusions: qa.exclusions,
    locationClassCounts: qa.locationClassCounts,
    distinctCommonNameCount: qa.distinctCommonNameCount,
    missingDiameterBreastHeightCount: qa.missingDiameterBreastHeightCount,
    maximumCoordinateResidualMetres: qa.coordinateFieldResidualMetres.maximum,
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
