import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canAcquireCityLayer, canPublishCityLayer } from '../src/lib/validateCityDataLedger.js';
import {
  validateCityCrossLayerQaReport,
  validateCityGeometryQaReport,
  validateCityRawInventory,
} from '../src/lib/validateCityPipeline.js';

const rootPath = (path) => resolve(import.meta.dirname, '..', path);
const readJson = (path) => JSON.parse(readFileSync(rootPath(path), 'utf8'));
const inventory = readJson('data/city/inventory/melbourne-buildings-flinders-federation-v1.json');
const qa = readJson('data/city/qa/melbourne-buildings-flinders-federation-v1.json');
const fixturePath = rootPath('tests/fixtures/city/melbourne-buildings-golden-v1.json');
const fixtureBytes = readFileSync(fixturePath);
const fixture = JSON.parse(fixtureBytes.toString('utf8'));
const roadInventory = readJson('data/city/inventory/melbourne-roads-flinders-federation-v1.json');
const roadQa = readJson('data/city/qa/melbourne-roads-flinders-federation-v1.json');
const roadFixturePath = rootPath('tests/fixtures/city/melbourne-roads-golden-v1.json');
const roadFixtureBytes = readFileSync(roadFixturePath);
const roadFixture = JSON.parse(roadFixtureBytes.toString('utf8'));
const pedestrianInventory = readJson('data/city/inventory/melbourne-pedestrian-network-complete-v1.json');
const pedestrianQa = readJson('data/city/qa/melbourne-pedestrian-network-complete-v1.json');
const pedestrianFixturePath = rootPath('tests/fixtures/city/melbourne-pedestrian-golden-v1.json');
const pedestrianFixtureBytes = readFileSync(pedestrianFixturePath);
const pedestrianFixture = JSON.parse(pedestrianFixtureBytes.toString('utf8'));
const hydroInventory = readJson('data/city/inventory/melbourne-hydro-flinders-federation-v1.json');
const hydroQa = readJson('data/city/qa/melbourne-hydro-flinders-federation-v1.json');
const hydroFixturePath = rootPath('tests/fixtures/city/melbourne-hydro-golden-v1.json');
const hydroFixtureBytes = readFileSync(hydroFixturePath);
const hydroFixture = JSON.parse(hydroFixtureBytes.toString('utf8'));
const treeInventory = readJson('data/city/inventory/melbourne-trees-flinders-federation-v1.json');
const treeQa = readJson('data/city/qa/melbourne-trees-flinders-federation-v1.json');
const treeFixturePath = rootPath('tests/fixtures/city/melbourne-trees-golden-v1.json');
const treeFixtureBytes = readFileSync(treeFixturePath);
const treeFixture = JSON.parse(treeFixtureBytes.toString('utf8'));
const controlInventory = readJson('data/city/inventory/melbourne-survey-control-flinders-federation-v1.json');
const controlQa = readJson('data/city/qa/melbourne-survey-control-flinders-federation-v1.json');
const controlFixturePath = rootPath('tests/fixtures/city/melbourne-survey-control-golden-v1.json');
const controlFixtureBytes = readFileSync(controlFixturePath);
const controlFixture = JSON.parse(controlFixtureBytes.toString('utf8'));
const demInventory = readJson('data/city/inventory/melbourne-dem10m-vicgrid94-2021.json');
const demQa = readJson('data/city/qa/melbourne-dem10m-flinders-federation-v1.json');
const demFixturePath = rootPath('tests/fixtures/city/melbourne-dem10m-golden-v1.json');
const demFixtureBytes = readFileSync(demFixturePath);
const demFixture = JSON.parse(demFixtureBytes.toString('utf8'));
const crossLayerQa = readJson('data/city/qa/melbourne-flinders-federation-cross-layer-v1.json');

describe('Melbourne building GIS golden pipeline', () => {
  it('keeps immutable acquisition and QA evidence internally consistent', () => {
    expect(validateCityRawInventory(inventory)).toEqual({ ok: true, errors: [] });
    expect(validateCityGeometryQaReport(qa)).toEqual({ ok: true, errors: [] });
    expect(qa.rawSha256).toBe(inventory.rawSha256);
    expect(qa.rawFeatureCount).toBe(inventory.featureCount);
    expect(createHash('sha256').update(fixtureBytes).digest('hex')).toBe(qa.goldenFixtureSha256);
    expect(qa.acceptedEntityCount + qa.excludedFeatureCount).toBe(qa.rawFeatureCount);
    expect(qa.status).toBe('passed-with-exclusions');
  });

  it('keeps the full raw GIS outside Git but verifies it when present locally', () => {
    expect(inventory.rawPath).toMatch(/^data\/city\/raw\//);
    const rawPath = rootPath(inventory.rawPath);
    if (!existsSync(rawPath)) return;
    const rawBytes = readFileSync(rawPath);
    expect(rawBytes.byteLength).toBe(inventory.rawByteLength);
    expect(createHash('sha256').update(rawBytes).digest('hex')).toBe(inventory.rawSha256);
    const headerBytes = readFileSync(rootPath(inventory.responseHeadersPath));
    expect(createHash('sha256').update(headerBytes).digest('hex')).toBe(inventory.responseHeadersSha256);
  });

  it('provides a small attributed, non-production fixture with stable local entities', () => {
    expect(fixture).toMatchObject({
      schemaVersion: 1,
      fixtureId: 'melbourne-buildings-golden-v1',
      pipelineVersion: 'melbourne-buildings-enu-v1',
      truthClass: 'licensed-real-data-engineering-fixture',
      productionApproved: false,
    });
    expect(fixture.attribution).toContain('City of Melbourne');
    expect(fixture.entities).toHaveLength(24);
    expect(new Set(fixture.entities.map(({ id }) => id)).size).toBe(24);
    expect(fixture.entities.some(({ height }) => height >= 200)).toBe(true);
    expect(fixture.entities.every(({ polygons, bounds, height }) => (
      polygons.length > 0
      && Number.isFinite(bounds.minX)
      && Number.isFinite(bounds.maxZ)
      && Number.isFinite(height)
      && height >= 0
    ))).toBe(true);
  });

  it('approves only the seven named Melbourne acquisitions and no production layers', () => {
    const ledger = readJson('data/city/city-data-ledger.json');
    const acquisitionApproved = [];
    for (const city of ledger.cities) {
      for (const layer of city.layers) {
        if (canAcquireCityLayer(layer)) acquisitionApproved.push(`${city.id}:${layer.id}`);
        expect(canPublishCityLayer(city, layer), layer.id).toBe(false);
      }
    }
    expect(acquisitionApproved).toEqual([
      'melbourne:melbourne-buildings-2023',
      'melbourne:melbourne-vicmap-roads',
      'melbourne:melbourne-pedestrian-network',
      'melbourne:melbourne-vicmap-hydro',
      'melbourne:melbourne-vicmap-survey-control',
      'melbourne:melbourne-vicmap-dem10m',
      'melbourne:melbourne-urban-forest-trees',
    ]);
    expect(existsSync(rootPath(inventory.acquisitionApprovalEvidence))).toBe(true);
  });
});

describe('Melbourne road GIS golden pipeline', () => {
  it('keeps immutable WFS acquisition and linear QA evidence consistent', () => {
    expect(validateCityRawInventory(roadInventory)).toEqual({ ok: true, errors: [] });
    expect(validateCityGeometryQaReport(roadQa)).toEqual({ ok: true, errors: [] });
    expect(roadQa).toMatchObject({
      geometryKind: 'linear-network',
      rawSha256: roadInventory.rawSha256,
      rawFeatureCount: roadInventory.featureCount,
      acceptedEntityCount: 510,
      excludedFeatureCount: 8,
    });
    expect(createHash('sha256').update(roadFixtureBytes).digest('hex')).toBe(roadQa.goldenFixtureSha256);
  });

  it('keeps raw road GIS outside Git and verifies local bytes when present', () => {
    expect(roadInventory.rawPath).toMatch(/^data\/city\/raw\//);
    if (!existsSync(rootPath(roadInventory.rawPath))) return;
    const rawBytes = readFileSync(rootPath(roadInventory.rawPath));
    expect(rawBytes.byteLength).toBe(roadInventory.rawByteLength);
    expect(createHash('sha256').update(rawBytes).digest('hex')).toBe(roadInventory.rawSha256);
    const headerBytes = readFileSync(rootPath(roadInventory.responseHeadersPath));
    expect(createHash('sha256').update(headerBytes).digest('hex')).toBe(roadInventory.responseHeadersSha256);
  });

  it('preserves stable road topology identifiers and multiple feature types', () => {
    expect(roadFixture).toMatchObject({
      fixtureId: 'melbourne-roads-golden-v1',
      pipelineVersion: 'melbourne-roads-enu-v1',
      truthClass: 'licensed-real-data-engineering-fixture',
      productionApproved: false,
    });
    expect(roadFixture.attribution).toContain('State of Victoria');
    expect(roadFixture.entities).toHaveLength(32);
    expect(new Set(roadFixture.entities.map(({ sourcePfi }) => sourcePfi)).size).toBe(32);
    expect(new Set(roadFixture.entities.map(({ id }) => id)).size).toBe(32);
    expect(Object.keys(roadQa.featureTypeCounts)).toEqual(expect.arrayContaining(['bridge', 'road', 'trail', 'tunnel']));
    expect(roadQa.derivedLengthMetres.total).toBeGreaterThan(24_000);
    expect(roadFixture.entities.every(({ lines, derivedLengthMetres }) => (
      lines.length > 0
      && lines.every((line) => line.length >= 2 && line.flat().every(Number.isFinite))
      && derivedLengthMetres > 0
    ))).toBe(true);
  });
});

describe('Melbourne pedestrian GIS golden pipeline', () => {
  it('uses the complete official ZIP and keeps semantic QA evidence consistent', () => {
    expect(validateCityRawInventory(pedestrianInventory)).toEqual({ ok: true, errors: [] });
    expect(validateCityGeometryQaReport(pedestrianQa)).toEqual({ ok: true, errors: [] });
    expect(pedestrianQa).toMatchObject({
      geometryKind: 'linear-network',
      rawSha256: pedestrianInventory.rawSha256,
      rawFeatureCount: 71_060,
      acceptedEntityCount: 6_613,
      excludedFeatureCount: 64_447,
    });
    expect(createHash('sha256').update(pedestrianFixtureBytes).digest('hex'))
      .toBe(pedestrianQa.goldenFixtureSha256);
  });

  it('verifies the local archive and complete semantic member when raw bytes are present', () => {
    const rawPath = rootPath(pedestrianInventory.rawPath);
    if (!existsSync(rawPath)) return;
    const rawBytes = readFileSync(rawPath);
    expect(rawBytes.byteLength).toBe(pedestrianInventory.rawByteLength);
    expect(createHash('sha256').update(rawBytes).digest('hex')).toBe(pedestrianInventory.rawSha256);
    const member = pedestrianInventory.archiveMembers.find(({ path }) => path === 'Pedestrian_network.json');
    const memberBytes = execFileSync('unzip', ['-p', rawPath, member.path], { maxBuffer: 64 * 1024 * 1024 });
    expect(memberBytes.byteLength).toBe(member.byteLength);
    expect(createHash('sha256').update(memberBytes).digest('hex')).toBe(member.sha256);
  });

  it('keeps all nine official route classes in an attributed, non-production fixture', () => {
    expect(pedestrianFixture).toMatchObject({
      fixtureId: 'melbourne-pedestrian-golden-v1',
      pipelineVersion: 'melbourne-pedestrian-enu-v1',
      truthClass: 'licensed-real-data-engineering-fixture',
      productionApproved: false,
    });
    expect(pedestrianFixture.attribution).toContain('City of Melbourne');
    expect(pedestrianFixture.entities).toHaveLength(36);
    expect(new Set(pedestrianFixture.entities.map(({ semanticClass }) => semanticClass)).size).toBe(9);
    expect(new Set(pedestrianFixture.entities.map(({ sourceObjectId }) => sourceObjectId)).size).toBe(36);
    expect(pedestrianQa.semanticClassCounts).toMatchObject({
      arcade: 441,
      footpath: 1894,
      lane: 426,
      'tram-crossing': 7,
    });
    expect(existsSync(rootPath(pedestrianInventory.sourceStrategyEvidence))).toBe(true);
  });
});

describe('Melbourne Hydro GIS golden pipeline', () => {
  it('keeps the two official FeatureServer layers and hydrography QA consistent', () => {
    expect(validateCityRawInventory(hydroInventory)).toEqual({ ok: true, errors: [] });
    expect(validateCityGeometryQaReport(hydroQa)).toEqual({ ok: true, errors: [] });
    expect(hydroQa).toMatchObject({
      geometryKind: 'hydrography',
      rawSha256: hydroInventory.rawSha256,
      rawFeatureCount: 8,
      acceptedEntityCount: 8,
      excludedFeatureCount: 0,
      status: 'passed',
    });
    expect(hydroInventory.archiveMembers.map(({ serviceLayerId }) => serviceLayerId)).toEqual([1, 6]);
    expect(createHash('sha256').update(hydroFixtureBytes).digest('hex'))
      .toBe(hydroQa.goldenFixtureSha256);
  });

  it('verifies the isolated ZIP and both exact GeoJSON members when present', () => {
    const rawPath = rootPath(hydroInventory.rawPath);
    if (!existsSync(rawPath)) return;
    const rawBytes = readFileSync(rawPath);
    expect(rawBytes.byteLength).toBe(hydroInventory.rawByteLength);
    expect(createHash('sha256').update(rawBytes).digest('hex')).toBe(hydroInventory.rawSha256);
    for (const member of hydroInventory.archiveMembers) {
      const memberBytes = execFileSync('unzip', ['-p', rawPath, member.path], {
        maxBuffer: 4 * 1024 * 1024,
      });
      expect(memberBytes.byteLength).toBe(member.byteLength);
      expect(createHash('sha256').update(memberBytes).digest('hex')).toBe(member.sha256);
    }
  });

  it('preserves source water semantics in an attributed, non-production fixture', () => {
    expect(hydroFixture).toMatchObject({
      fixtureId: 'melbourne-hydro-golden-v1',
      pipelineVersion: 'melbourne-hydro-enu-v1',
      truthClass: 'licensed-real-data-engineering-fixture',
      productionApproved: false,
    });
    expect(hydroFixture.attribution).toContain('State of Victoria');
    expect(hydroFixture.entities).toHaveLength(8);
    expect(hydroFixture.entities.filter(({ kind }) => kind === 'water-area')).toHaveLength(1);
    expect(hydroFixture.entities.filter(({ kind }) => kind === 'water-structure-line')).toHaveLength(7);
    expect(new Set(hydroFixture.entities.map(({ sourcePfi }) => sourcePfi)).size).toBe(8);
    expect(new Set(hydroFixture.entities.map(({ id }) => id)).size).toBe(8);
    expect(hydroQa.featureTypeCounts).toEqual({
      breakwater: 6,
      watercourse_area_river: 1,
      wharf: 1,
    });
    expect(hydroQa.waterAreaSquareMetres).toBeGreaterThan(70_000);
    expect(hydroQa.sourceShorelineLengthMetres).toBeGreaterThan(1_600);
    expect(hydroQa.structureLengthMetres).toBeGreaterThan(1_600);
    expect(hydroFixture.entities.some(({ name }) => name === 'YARRA RIVER')).toBe(true);
  });
});

describe('Melbourne Urban Forest tree GIS golden pipeline', () => {
  it('keeps the official bounded export and point-inventory QA consistent', () => {
    expect(validateCityRawInventory(treeInventory)).toEqual({ ok: true, errors: [] });
    expect(validateCityGeometryQaReport(treeQa)).toEqual({ ok: true, errors: [] });
    expect(treeQa).toMatchObject({
      geometryKind: 'vegetation-point',
      rawSha256: treeInventory.rawSha256,
      rawFeatureCount: 1_039,
      acceptedEntityCount: 1_039,
      excludedFeatureCount: 0,
      status: 'passed',
    });
    expect(createHash('sha256').update(treeFixtureBytes).digest('hex'))
      .toBe(treeQa.goldenFixtureSha256);
  });

  it('keeps raw tree GIS outside Git and verifies local bytes when present', () => {
    expect(treeInventory.rawPath).toMatch(/^data\/city\/raw\//);
    if (!existsSync(rootPath(treeInventory.rawPath))) return;
    const rawBytes = readFileSync(rootPath(treeInventory.rawPath));
    expect(rawBytes.byteLength).toBe(treeInventory.rawByteLength);
    expect(createHash('sha256').update(rawBytes).digest('hex')).toBe(treeInventory.rawSha256);
    const headerBytes = readFileSync(rootPath(treeInventory.responseHeadersPath));
    expect(createHash('sha256').update(headerBytes).digest('hex'))
      .toBe(treeInventory.responseHeadersSha256);
  });

  it('preserves species and location semantics without inventing dimensions or elevation', () => {
    expect(treeFixture).toMatchObject({
      fixtureId: 'melbourne-trees-golden-v1',
      pipelineVersion: 'melbourne-trees-enu-v1',
      truthClass: 'licensed-real-data-engineering-fixture',
      productionApproved: false,
    });
    expect(treeFixture.attribution).toContain('City of Melbourne');
    expect(treeFixture.entities).toHaveLength(40);
    expect(new Set(treeFixture.entities.map(({ id }) => id)).size).toBe(40);
    expect(new Set(treeFixture.entities.map(({ sourceComId }) => sourceComId)).size).toBe(40);
    expect(new Set(treeFixture.entities.map(({ commonName }) => commonName).filter(Boolean)).size)
      .toBeGreaterThan(20);
    expect(treeFixture.entities.every(({ horizontalPosition }) => (
      horizontalPosition.length === 2 && horizontalPosition.every(Number.isFinite)
    ))).toBe(true);
    expect(treeQa.locationClassCounts).toEqual({ Park: 241, Street: 798 });
    expect(treeQa.distinctCommonNameCount).toBe(68);
    expect(treeQa.missingDiameterBreastHeightCount).toBe(311);
    expect(treeQa.diameterBreastHeightSourceValues.unit).toBe('not-declared-in-source-metadata');
    expect(treeQa.coordinateFieldResidualMetres.maximum).toBeLessThan(0.005);
    expect(treeQa.mga94FieldResidualMetres.maximum).toBeGreaterThan(7);
    expect(treeQa.mga94FieldResidualMetres.withinTwoCentimetres).toBe(993);
    expect(treeQa.mga94FieldResidualMetres.overOneMetre).toBe(35);
    expect(treeQa.mga94FieldResidualMetres.interpretation).toMatch(/not an independent/i);
    expect(treeFixture.localFrame.verticalSourceDatum.identifier)
      .toBe('not-applicable-2d-point-inventory');
  });
});

describe('Melbourne survey-control GIS golden pipeline', () => {
  it('keeps official acquisition and surveyed-coordinate QA evidence consistent', () => {
    expect(validateCityRawInventory(controlInventory)).toEqual({ ok: true, errors: [] });
    expect(validateCityGeometryQaReport(controlQa)).toEqual({ ok: true, errors: [] });
    expect(controlQa).toMatchObject({
      geometryKind: 'survey-control-point',
      rawSha256: controlInventory.rawSha256,
      rawFeatureCount: 181,
      acceptedEntityCount: 40,
      excludedFeatureCount: 141,
      status: 'passed-with-exclusions',
    });
    expect(createHash('sha256').update(controlFixtureBytes).digest('hex'))
      .toBe(controlQa.goldenFixtureSha256);
  });

  it('uses published GDA2020/AHD fields and classifies mixed service geometry', () => {
    expect(controlFixture).toMatchObject({
      fixtureId: 'melbourne-survey-control-golden-v1',
      pipelineVersion: 'melbourne-survey-control-enu-v1',
      truthClass: 'licensed-surveyed-control-engineering-fixture',
      productionApproved: false,
    });
    expect(controlFixture.entities).toHaveLength(40);
    expect(new Set(controlFixture.entities.map(({ sourceNineFigureNumber }) => sourceNineFigureNumber)).size)
      .toBe(40);
    expect(controlFixture.entities.every(({ horizontalAdjustment, verticalAdjustment }) => (
      horizontalAdjustment.datum === 'GDA2020'
      && horizontalAdjustment.technique === 'ADJUSTED'
      && verticalAdjustment.datum === 'AHD'
      && verticalAdjustment.technique === 'SPIRIT LEVELLING'
    ))).toBe(true);
    expect(controlQa.publishedCoordinateResidualMetres.maximum).toBeLessThan(0.02);
    expect(controlQa.serviceGeometryResidualMetres.gda94LikeOffsetReview).toBe(8);
    expect(controlQa.uncertaintyMetres).toEqual({ horizontalMaximum: 0.007, verticalMaximum: 0.011 });
  });
});

describe('Melbourne DEM 10m native-grid golden pipeline', () => {
  it('pins the delivered GeoTIFF archive and native-grid QA evidence', () => {
    expect(validateCityRawInventory(demInventory)).toEqual({ ok: true, errors: [] });
    expect(validateCityGeometryQaReport(demQa)).toEqual({ ok: true, errors: [] });
    expect(demQa).toMatchObject({
      geometryKind: 'terrain-raster',
      rawSha256: demInventory.rawSha256,
      rawFeatureCount: 5_095_350_000,
      acceptedEntityCount: 10_080,
      status: 'passed-with-exclusions',
    });
    expect(createHash('sha256').update(demFixtureBytes).digest('hex'))
      .toBe(demQa.goldenFixtureSha256);
    if (existsSync(rootPath(demInventory.rawPath))) {
      expect(statSync(rootPath(demInventory.rawPath)).size).toBe(demInventory.rawByteLength);
    }
  });

  it('preserves native EPSG:3111/AHD cells and verifies both delivered formats', () => {
    expect(demFixture).toMatchObject({
      fixtureId: 'melbourne-dem10m-golden-v1',
      pipelineVersion: 'melbourne-dem10m-native-v1',
      truthClass: 'licensed-real-data-native-grid-engineering-fixture',
      productionApproved: false,
      nativeGrid: {
        crs: 'EPSG:3111',
        verticalDatum: 'AHD',
        cellSizeMetres: 10,
        window: { columns: 90, rows: 112 },
      },
    });
    expect(demFixture.elevationAhd.values).toHaveLength(10_080);
    expect(demQa.formatComparison).toMatchObject({
      metadataExact: true,
      precinctCellValuesExact: true,
      comparedCellCount: 10_080,
      maximumAbsoluteDifferenceMetres: 0,
    });
    expect(demQa.surveyControlResiduals).toMatchObject({
      comparisonCount: 32,
      nearestNativeCell: { withinTwicePublishedVerticalAccuracy: 32 },
      withinPublishedHorizontalAccuracy: { withinPublishedVerticalAccuracy: 32 },
    });
    expect(demQa.surveyControlResiduals.withinPublishedHorizontalAccuracy.maximumAbsolute)
      .toBeLessThan(5);
  });
});

describe('Melbourne seven-layer spatial QA', () => {
  it('pins all seven layer work hashes with no spatial blocker findings', () => {
    expect(validateCityCrossLayerQaReport(crossLayerQa)).toEqual({ ok: true, errors: [] });
    expect(crossLayerQa).toMatchObject({
      status: 'passed-with-findings',
      releaseBlocked: false,
      productionApproved: false,
    });
    expect(crossLayerQa.sourceLayers).toHaveLength(7);
    for (const source of crossLayerQa.sourceLayers) {
      const sourceQa = readJson(source.qaPath);
      expect(source.artifactId).toBe(sourceQa.artifactId);
      expect(source.workSha256).toBe(sourceQa.workSha256);
      if (!existsSync(rootPath(source.workPath))) continue;
      const workBytes = readFileSync(rootPath(source.workPath));
      expect(createHash('sha256').update(workBytes).digest('hex')).toBe(source.workSha256);
    }
  });

  it('classifies expected waterfront structures instead of deleting them as collisions', () => {
    expect(crossLayerQa.metrics.buildingWaterOverlaps).toEqual({
      entityCount: 26,
      sourceStructureCount: 21,
      footprintTypeCounts: { Bridge: 11, Jetty: 12, Ramp: 3 },
    });
    expect(crossLayerQa.metrics.treeWaterBoundaryFindings.count).toBe(8);
    expect(crossLayerQa.metrics.treeWaterBoundaryFindings.maximumBoundaryDistanceMetres)
      .toBeLessThan(1.25);
    expect(crossLayerQa.metrics.treeBuildingBoundaryFindings.count).toBe(2);
    expect(crossLayerQa.metrics.treeBuildingBoundaryFindings.maximumBoundaryDistanceMetres)
      .toBeLessThan(0.5);
  });

  it('proves horizontal and AHD control consistency while retaining warnings', () => {
    expect(crossLayerQa.metrics.treeNetworkProximityMetres).toMatchObject({
      treeCount: 1_039,
      road: { within20Metres: 1_005 },
      pedestrian: { within20Metres: 1_018 },
    });
    expect(crossLayerQa.metrics.treeNetworkProximityMetres.road.p95).toBeLessThan(20);
    expect(crossLayerQa.metrics.treeNetworkProximityMetres.pedestrian.p95).toBeLessThan(20);
    expect(crossLayerQa.metrics.surveyControl).toMatchObject({
      trustedSetCount: 40,
      uncertaintyMetres: { horizontalMaximum: 0.007, verticalMaximum: 0.011 },
    });
    expect(crossLayerQa.metrics.terrain).toMatchObject({
      nativeGrid: { window: { columns: 90, rows: 112 } },
      formatComparison: { precinctCellValuesExact: true },
      surveyControlResiduals: {
        comparisonCount: 32,
        withinPublishedHorizontalAccuracy: { withinPublishedVerticalAccuracy: 32 },
      },
    });
    expect(crossLayerQa.findings.filter(({ severity }) => severity === 'blocker').map(({ id }) => id))
      .toEqual([]);
    expect(crossLayerQa.findings.map(({ id }) => id))
      .toContain('survey-control-service-geometry-datum-mix');
    expect(crossLayerQa.findings.map(({ id }) => id))
      .toContain('terrain-control-nearest-cell-accuracy-envelope');
  });
});
