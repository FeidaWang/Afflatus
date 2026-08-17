#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  geographicToMga2020Zone55,
  packedDmsToDecimalDegrees,
  wgs84ToCityScenePoint,
  wgs84ToLocalEnu,
} from '../../src/city/projection.ts';

const INVENTORY_PATH = 'data/city/inventory/melbourne-survey-control-flinders-federation-v1.json';
const WORK_PATH = 'data/city/work/melbourne-survey-control-flinders-federation-v1.enu.json';
const FIXTURE_PATH = 'tests/fixtures/city/melbourne-survey-control-golden-v1.json';
const QA_PATH = 'data/city/qa/melbourne-survey-control-flinders-federation-v1.json';
const ANCHOR = Object.freeze({ longitude: 144.963, latitude: -37.815, ellipsoidHeight: 0 });
const VERTICAL_ORIGIN_AHD = 0;
const PIPELINE_VERSION = 'melbourne-survey-control-enu-v1';
const MAX_PUBLISHED_COORDINATE_RESIDUAL_METRES = 0.02;
const MAX_HORIZONTAL_UNCERTAINTY_METRES = 0.02;
const MAX_VERTICAL_UNCERTAINTY_METRES = 0.02;

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const round = (value, digits = 3) => Number(value.toFixed(digits));
const finiteNumberOrNull = (value) => (
  value === null || value === undefined || value === '' || !Number.isFinite(Number(value))
    ? null
    : Number(value)
);
const counts = (values) => Object.fromEntries([...new Set(values)].sort().map((value) => [
  String(value),
  values.filter((candidate) => candidate === value).length,
]));

function eligibilityError(properties) {
  if (properties.status !== 'OK') return `status-${String(properties.status || 'missing').toLowerCase().replaceAll(' ', '-')}`;
  if (properties.scn_gda !== 'YES') return 'not-gda-adjusted';
  if (properties.adj_ahd !== 'YES') return 'not-ahd-adjusted';
  if (properties.gda2020_technique !== 'ADJUSTED') return 'gda2020-technique-not-adjusted';
  if (properties.ahd_technique !== 'SPIRIT LEVELLING') return 'ahd-technique-not-spirit-levelling';
  const requiredNumbers = [
    properties.gda2020_longitude_dms,
    properties.gda2020_latitude_dms,
    properties.mga2020_easting,
    properties.mga2020_northing,
    properties.ahd_height,
    properties.gda94_uncertainty,
    properties.v_uncertainty,
  ].map(finiteNumberOrNull);
  if (requiredNumbers.some((value) => value === null)) return 'missing-authoritative-coordinate-or-uncertainty';
  if (Number(properties.gda94_uncertainty) > MAX_HORIZONTAL_UNCERTAINTY_METRES) {
    return 'horizontal-uncertainty-over-threshold';
  }
  if (Number(properties.v_uncertainty) > MAX_VERTICAL_UNCERTAINTY_METRES) {
    return 'vertical-uncertainty-over-threshold';
  }
  return null;
}

function normalizeFeature(feature, bounds) {
  const properties = feature.properties || {};
  const eligibility = eligibilityError(properties);
  if (eligibility) return { error: eligibility };
  if (feature.geometry?.type !== 'Point') return { error: 'not-a-point' };
  const markNumber = String(properties.nine_figure_no || '').trim();
  if (!/^\d{9}$/.test(markNumber)) return { error: 'invalid-nine-figure-number' };

  const longitude = packedDmsToDecimalDegrees(Number(properties.gda2020_longitude_dms));
  const latitude = packedDmsToDecimalDegrees(Number(properties.gda2020_latitude_dms));
  if (
    longitude < bounds.west
    || longitude > bounds.east
    || latitude < bounds.south
    || latitude > bounds.north
  ) return { error: 'authoritative-coordinate-outside-clip-bounds' };
  const sourceMgaEasting = Number(properties.mga2020_easting);
  const sourceMgaNorthing = Number(properties.mga2020_northing);
  const projectedMga = geographicToMga2020Zone55({ longitude, latitude });
  const publishedCoordinateResidualMetres = Math.hypot(
    projectedMga.easting - sourceMgaEasting,
    projectedMga.northing - sourceMgaNorthing,
  );
  if (publishedCoordinateResidualMetres > MAX_PUBLISHED_COORDINATE_RESIDUAL_METRES) {
    return { error: 'gda2020-mga2020-residual-over-threshold' };
  }

  const [serviceLongitude, serviceLatitude] = feature.geometry.coordinates || [];
  if (!Number.isFinite(serviceLongitude) || !Number.isFinite(serviceLatitude)) {
    return { error: 'invalid-service-geometry' };
  }
  const serviceProjectedMga = geographicToMga2020Zone55({
    longitude: serviceLongitude,
    latitude: serviceLatitude,
  });
  const serviceGeometryResidualMetres = Math.hypot(
    serviceProjectedMga.easting - sourceMgaEasting,
    serviceProjectedMga.northing - sourceMgaNorthing,
  );
  const elevationAhd = Number(properties.ahd_height);
  const groundToMarkOffsetMetres = finiteNumberOrNull(properties.ground_to_mark_offset_m);
  const local = wgs84ToLocalEnu({ longitude, latitude, ellipsoidHeight: 0 }, ANCHOR);
  const scene = wgs84ToCityScenePoint(
    { longitude, latitude, ellipsoidHeight: 0 },
    ANCHOR,
    elevationAhd,
    VERTICAL_ORIGIN_AHD,
  );

  return {
    entity: Object.freeze({
      id: `melbourne-vicmap-survey-control:${markNumber}`,
      sourceNineFigureNumber: markNumber,
      sourceObjectId: Number(properties.OBJECTID),
      sourceUfi: Number(properties.ufi),
      name: String(properties.name || ''),
      kind: 'survey-control-point',
      status: properties.status,
      horizontalAdjustment: Object.freeze({
        flag: properties.scn_gda,
        datum: 'GDA2020',
        technique: properties.gda2020_technique,
        organisation: String(properties.gda2020_organisation || ''),
        publishedAt: properties.gda2020_published_date,
        uncertaintyMetres: Number(properties.gda94_uncertainty),
      }),
      verticalAdjustment: Object.freeze({
        flag: properties.adj_ahd,
        datum: 'AHD',
        technique: properties.ahd_technique,
        source: String(properties.ahd_source || ''),
        publishedAt: properties.ahd_published_date,
        uncertaintyMetres: Number(properties.v_uncertainty),
      }),
      sourceGda2020: Object.freeze([round(longitude, 12), round(latitude, 12)]),
      sourceMga2020Zone55: Object.freeze({
        easting: sourceMgaEasting,
        northing: sourceMgaNorthing,
      }),
      serviceGeometryEpsg4326: Object.freeze([serviceLongitude, serviceLatitude]),
      elevationAhd: round(elevationAhd, 3),
      ellipsoidHeightGda2020: finiteNumberOrNull(properties.gda2020_ellipsoid_height),
      groundToMarkOffsetMetres,
      estimatedGroundElevationAhd: groundToMarkOffsetMetres === null
        ? null
        : round(elevationAhd - groundToMarkOffsetMetres, 3),
      markType: String(properties.mark_type || ''),
      horizontalPosition: Object.freeze([round(local.east), round(-local.north)]),
      scenePosition: Object.freeze([round(scene.x), round(scene.y), round(scene.z)]),
      publishedCoordinateResidualMetres: round(publishedCoordinateResidualMetres, 6),
      serviceGeometryResidualMetres: round(serviceGeometryResidualMetres, 6),
      serviceGeometryDatumClass: serviceGeometryResidualMetres <= 0.02
        ? 'matches-published-gda2020'
        : serviceGeometryResidualMetres >= 1 && serviceGeometryResidualMetres <= 2
          ? 'gda94-like-offset-review'
          : 'unclassified-review',
    }),
  };
}

async function main() {
  const inventory = JSON.parse(await readFile(resolve(INVENTORY_PATH), 'utf8'));
  const rawBytes = await readFile(resolve(inventory.rawPath));
  if (rawBytes.byteLength !== inventory.rawByteLength || sha256(rawBytes) !== inventory.rawSha256) {
    throw new Error('Raw survey-control artifact no longer matches its immutable inventory record.');
  }
  const metadataBytes = await readFile(resolve(inventory.sourceMetadataPath));
  if (sha256(metadataBytes) !== inventory.sourceMetadataSha256) {
    throw new Error('Survey-control layer metadata no longer matches its immutable inventory record.');
  }
  const raw = JSON.parse(rawBytes.toString('utf8'));
  if (raw.type !== 'FeatureCollection' || raw.features.length !== inventory.featureCount) {
    throw new Error('Raw survey-control feature count does not match inventory.');
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
    throw new Error('Derived survey-control IDs are not globally unique.');
  }
  if (entities.length < 12) throw new Error(`Only ${entities.length} trusted survey controls survived QA.`);

  const work = {
    schemaVersion: 1,
    fixtureId: 'melbourne-survey-control-flinders-federation-v1-enu',
    pipelineVersion: PIPELINE_VERSION,
    truthClass: 'licensed-surveyed-control-engineering-fixture',
    productionApproved: false,
    derivedFrom: { artifactId: inventory.artifactId, rawSha256: inventory.rawSha256 },
    attribution: inventory.licence.attribution,
    localFrame: {
      horizontalSourceCrs: inventory.sourceCrs,
      verticalSourceDatum: inventory.verticalDatum,
      anchorWgs84: ANCHOR,
      axes: 'horizontalPosition=[east,-north]; scenePosition=[east,AHD-up,-north]',
      verticalOriginAhd: VERTICAL_ORIGIN_AHD,
      transform: 'Packed GDA2020 DMS to decimal degrees, checked against MGA2020 Zone 55, then geographic ECEF to local ENU; AHD retained on scene Y',
    },
    clipBoundsWgs84: inventory.queryBoundsWgs84,
    selectionRule: {
      status: 'OK',
      horizontal: 'scn_gda=YES and gda2020_technique=ADJUSTED',
      vertical: 'adj_ahd=YES and ahd_technique=SPIRIT LEVELLING',
      maximumPublishedCoordinateResidualMetres: MAX_PUBLISHED_COORDINATE_RESIDUAL_METRES,
      maximumHorizontalUncertaintyMetres: MAX_HORIZONTAL_UNCERTAINTY_METRES,
      maximumVerticalUncertaintyMetres: MAX_VERTICAL_UNCERTAINTY_METRES,
    },
    entities,
  };
  const workBytes = Buffer.from(`${JSON.stringify(work)}\n`);
  const fixture = { ...work, fixtureId: 'melbourne-survey-control-golden-v1' };
  const fixtureBytes = Buffer.from(`${JSON.stringify(fixture, null, 2)}\n`);
  const publishedResiduals = entities.map(({ publishedCoordinateResidualMetres }) => publishedCoordinateResidualMetres);
  const serviceResiduals = entities.map(({ serviceGeometryResidualMetres }) => serviceGeometryResidualMetres);
  const horizontalUncertainties = entities.map(({ horizontalAdjustment }) => horizontalAdjustment.uncertaintyMetres);
  const verticalUncertainties = entities.map(({ verticalAdjustment }) => verticalAdjustment.uncertaintyMetres);
  const qa = {
    schemaVersion: 1,
    reportId: 'melbourne-survey-control-flinders-federation-v1-qa',
    pipelineVersion: PIPELINE_VERSION,
    geometryKind: 'survey-control-point',
    status: errors.size === 0 ? 'passed' : 'passed-with-exclusions',
    artifactId: inventory.artifactId,
    rawSha256: inventory.rawSha256,
    workSha256: sha256(workBytes),
    goldenFixtureSha256: sha256(fixtureBytes),
    rawFeatureCount: raw.features.length,
    acceptedEntityCount: entities.length,
    excludedFeatureCount: raw.features.length - entities.length,
    exclusions: Object.fromEntries([...errors].sort(([a], [b]) => a.localeCompare(b))),
    duplicateEntityIds: 0,
    sourceGeometryTypes: counts(raw.features.map(({ geometry }) => geometry?.type || 'missing')),
    trustedStatusCounts: counts(entities.map(({ status }) => status)),
    publishedCoordinateResidualMetres: {
      maximum: round(Math.max(...publishedResiduals), 6),
      average: round(publishedResiduals.reduce((sum, value) => sum + value, 0) / publishedResiduals.length, 6),
      withinTwoCentimetres: publishedResiduals.filter((value) => value <= 0.02).length,
    },
    serviceGeometryResidualMetres: {
      maximum: round(Math.max(...serviceResiduals), 6),
      average: round(serviceResiduals.reduce((sum, value) => sum + value, 0) / serviceResiduals.length, 6),
      withinTwoCentimetres: serviceResiduals.filter((value) => value <= 0.02).length,
      gda94LikeOffsetReview: entities.filter(({ serviceGeometryDatumClass }) => (
        serviceGeometryDatumClass === 'gda94-like-offset-review'
      )).length,
      interpretation: 'The authoritative control coordinate is the published GDA2020 DMS/MGA2020 pair. Mixed service-geometry datum behaviour is classified and never silently substituted.',
    },
    uncertaintyMetres: {
      horizontalMaximum: round(Math.max(...horizontalUncertainties), 6),
      verticalMaximum: round(Math.max(...verticalUncertainties), 6),
    },
    ahdHeightMetres: {
      minimum: round(Math.min(...entities.map(({ elevationAhd }) => elevationAhd)), 3),
      maximum: round(Math.max(...entities.map(({ elevationAhd }) => elevationAhd)), 3),
    },
    controlPoints: {
      trustedSetCount: entities.length,
      anchor: entities.reduce((nearest, entity) => {
        const distance = Math.hypot(...entity.horizontalPosition);
        return !nearest || distance < nearest.distance
          ? { id: entity.id, distance: round(distance, 3) }
          : nearest;
      }, null),
    },
    checks: {
      rawHashMatchesInventory: true,
      featureCountMatchesInventory: true,
      entityIdsUnique: true,
      coordinatesFinite: entities.every(({ horizontalPosition, scenePosition }) => (
        [...horizontalPosition, ...scenePosition].every(Number.isFinite)
      )),
      clippedToBounds: true,
      sourceDmsCoordinateFieldsChecked: true,
      sourceMga2020CoordinateFieldsChecked: true,
      allControlsStatusOk: entities.every(({ status }) => status === 'OK'),
      allControlsGda2020Adjusted: entities.every(({ horizontalAdjustment }) => (
        horizontalAdjustment.flag === 'YES' && horizontalAdjustment.technique === 'ADJUSTED'
      )),
      allControlsAhdAdjusted: entities.every(({ verticalAdjustment }) => (
        verticalAdjustment.flag === 'YES' && verticalAdjustment.technique === 'SPIRIT LEVELLING'
      )),
      uncertaintiesFinite: [...horizontalUncertainties, ...verticalUncertainties].every(Number.isFinite),
      publishedCoordinateResidualWithinTwoCentimetres: publishedResiduals.every((value) => value <= 0.02),
      serviceGeometryDatumDriftClassified: entities.every(({ serviceGeometryDatumClass }) => (
        serviceGeometryDatumClass !== 'unclassified-review'
      )),
      sourceCrsResolved: 'GDA2020 geographic / MGA2020 Zone 55',
      verticalDatumResolved: 'AHD',
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
    acceptedEntityCount: qa.acceptedEntityCount,
    excludedFeatureCount: qa.excludedFeatureCount,
    publishedCoordinateResidualMetres: qa.publishedCoordinateResidualMetres,
    serviceGeometryResidualMetres: qa.serviceGeometryResidualMetres,
    uncertaintyMetres: qa.uncertaintyMetres,
    workPath: WORK_PATH,
    fixturePath: FIXTURE_PATH,
    qaPath: QA_PATH,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
