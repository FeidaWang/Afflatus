#!/usr/bin/env node
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, resolve } from 'node:path';
import {
  vicgrid94ToGda2020,
  wgs84ToLocalEnu,
} from '../../src/city/projection.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const PACKAGE_ID = 'melbourne-flinders-federation-v1';
const PACKAGE_DIR = resolve(ROOT, 'data/city/candidates', PACKAGE_ID);
const ASSET_BASE_URI = `/assets/city/packages/${PACKAGE_ID}`;
const LEDGER_PATH = resolve(ROOT, 'data/city/city-data-ledger.json');
const QA_PATH = resolve(ROOT, 'data/city/qa/melbourne-flinders-federation-cross-layer-v1.json');
const TILE_SIZE_METRES = 250;
const LODS = Object.freeze([0, 1, 2]);
const GENERATED_AT = '2026-08-16T18:00:00.000+10:00';
const PACKAGE_VERSION = '2026.08.16+engineering.1';
const WORK = Object.freeze({
  'melbourne-buildings-2023': 'data/city/work/melbourne-buildings-flinders-federation-v1.enu.json',
  'melbourne-vicmap-roads': 'data/city/work/melbourne-roads-flinders-federation-v1.enu.json',
  'melbourne-pedestrian-network': 'data/city/work/melbourne-pedestrian-network-complete-v1.enu.json',
  'melbourne-vicmap-hydro': 'data/city/work/melbourne-hydro-flinders-federation-v1.enu.json',
  'melbourne-urban-forest-trees': 'data/city/work/melbourne-trees-flinders-federation-v1.enu.json',
  'melbourne-vicmap-survey-control': 'data/city/work/melbourne-survey-control-flinders-federation-v1.enu.json',
  'melbourne-vicmap-dem10m': 'data/city/work/melbourne-dem10m-flinders-federation-v1.native.json',
});
const RUNTIME_LAYER_KEYS = Object.freeze({
  'melbourne-buildings-2023': 'buildings',
  'melbourne-vicmap-roads': 'roads',
  'melbourne-pedestrian-network': 'pedestrian',
  'melbourne-vicmap-hydro': 'water',
  'melbourne-urban-forest-trees': 'trees',
  'melbourne-vicmap-survey-control': 'control',
  'melbourne-vicmap-dem10m': 'terrain',
});

const readJson = (path) => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8'));
const round = (value, places = 3) => {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
};
const jsonBytes = (value, pretty = false) => Buffer.from(
  `${JSON.stringify(value, null, pretty ? 2 : undefined)}\n`,
);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const stableHash = (value) => {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

function tileBoundsForPrecinct(boundsWgs84, anchor) {
  const points = [
    [boundsWgs84.west, boundsWgs84.south],
    [boundsWgs84.west, boundsWgs84.north],
    [boundsWgs84.east, boundsWgs84.south],
    [boundsWgs84.east, boundsWgs84.north],
  ].map(([longitude, latitude]) => {
    const position = wgs84ToLocalEnu({ longitude, latitude, ellipsoidHeight: 0 }, anchor);
    return { x: position.east, z: -position.north };
  });
  const values = (key) => points.map((point) => point[key]);
  return Object.freeze({
    minX: Math.floor(Math.min(...values('x')) / TILE_SIZE_METRES) * TILE_SIZE_METRES,
    maxX: Math.ceil(Math.max(...values('x')) / TILE_SIZE_METRES) * TILE_SIZE_METRES,
    minZ: Math.floor(Math.min(...values('z')) / TILE_SIZE_METRES) * TILE_SIZE_METRES,
    maxZ: Math.ceil(Math.max(...values('z')) / TILE_SIZE_METRES) * TILE_SIZE_METRES,
  });
}

function createTiles(bounds) {
  const columns = (bounds.maxX - bounds.minX) / TILE_SIZE_METRES;
  const rows = (bounds.maxZ - bounds.minZ) / TILE_SIZE_METRES;
  const tiles = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const id = `tile-c${String(column).padStart(2, '0')}-r${String(row).padStart(2, '0')}`;
      tiles.push({
        id,
        column,
        row,
        boundsLocal: {
          minX: bounds.minX + column * TILE_SIZE_METRES,
          maxX: bounds.minX + (column + 1) * TILE_SIZE_METRES,
          minZ: bounds.minZ + row * TILE_SIZE_METRES,
          maxZ: bounds.minZ + (row + 1) * TILE_SIZE_METRES,
        },
        vectorEntities: Object.fromEntries(Object.values(RUNTIME_LAYER_KEYS)
          .filter((key) => key !== 'terrain')
          .map((key) => [key, []])),
        terrainCells: [],
      });
    }
  }
  return { tiles, columns, rows };
}

function entityBounds(entity) {
  if (entity.bounds) return entity.bounds;
  const position = entity.horizontalPosition || [entity.scenePosition?.[0], entity.scenePosition?.[2]];
  if (!position.every(Number.isFinite)) throw new Error(`${entity.id}: no finite local bounds or point`);
  return { minX: position[0], maxX: position[0], minZ: position[1], maxZ: position[1] };
}

function intersects(left, right) {
  return left.maxX >= right.minX && left.minX < right.maxX
    && left.maxZ >= right.minZ && left.minZ < right.maxZ;
}

function tileForPoint(tiles, x, z) {
  return tiles.find(({ boundsLocal }) => (
    x >= boundsLocal.minX && x < boundsLocal.maxX
    && z >= boundsLocal.minZ && z < boundsLocal.maxZ
  ));
}

function perpendicularDistance(point, start, end) {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  if (dx === 0 && dz === 0) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  const amount = Math.max(0, Math.min(1, (
    (point[0] - start[0]) * dx + (point[1] - start[1]) * dz
  ) / (dx * dx + dz * dz)));
  return Math.hypot(point[0] - (start[0] + amount * dx), point[1] - (start[1] + amount * dz));
}

function simplifyLine(points, tolerance) {
  if (tolerance <= 0 || points.length <= 2) return points;
  let furthestIndex = -1;
  let furthestDistance = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = perpendicularDistance(points[index], points[0], points.at(-1));
    if (distance > furthestDistance) {
      furthestIndex = index;
      furthestDistance = distance;
    }
  }
  if (furthestDistance <= tolerance) return [points[0], points.at(-1)];
  return [
    ...simplifyLine(points.slice(0, furthestIndex + 1), tolerance).slice(0, -1),
    ...simplifyLine(points.slice(furthestIndex), tolerance),
  ];
}

function simplifyRing(points, tolerance) {
  if (tolerance <= 0 || points.length <= 4) return points;
  const simplified = simplifyLine(points.slice(0, -1), tolerance);
  if (simplified.length < 3) return points;
  return [...simplified, simplified[0]];
}

function geometryForLod(entity, layerKey, lod) {
  const tolerance = [8, 2, 0][lod];
  if (layerKey === 'buildings') {
    const base = {
      id: entity.id,
      kind: entity.kind,
      bounds: entity.bounds,
      baseElevationAhd: entity.baseElevationAhd,
      topElevationAhd: entity.topElevationAhd,
    };
    if (lod === 0) return base;
    return {
      ...base,
      polygons: entity.polygons.map((polygon) => polygon
        .map((ring) => simplifyRing(ring, tolerance))),
    };
  }
  if (layerKey === 'roads' || layerKey === 'pedestrian') {
    return {
      id: entity.id,
      kind: entity.kind,
      semanticClass: entity.semanticClass,
      classCode: entity.classCode,
      lines: entity.lines.map((line) => simplifyLine(line, tolerance)),
    };
  }
  if (layerKey === 'water') {
    return {
      id: entity.id,
      kind: entity.kind,
      polygons: entity.polygons?.map((polygon) => polygon
        .map((ring) => simplifyRing(ring, tolerance))),
      shorelineLines: entity.shorelineLines?.map((line) => simplifyLine(line, tolerance)),
      structureLines: entity.structureLines?.map((line) => simplifyLine(line, tolerance)),
    };
  }
  if (layerKey === 'trees') {
    return {
      id: entity.id,
      kind: entity.kind,
      horizontalPosition: entity.horizontalPosition,
      diameterBreastHeight: entity.diameterBreastHeight,
      genus: entity.genus,
    };
  }
  return {
    id: entity.id,
    kind: entity.kind,
    scenePosition: entity.scenePosition,
    horizontalUncertaintyMetres: entity.horizontalAdjustment?.uncertaintyMetres,
    verticalUncertaintyMetres: entity.verticalAdjustment?.uncertaintyMetres,
  };
}

function propertyRecord(entity, layerId) {
  const copy = structuredClone(entity);
  delete copy.polygons;
  delete copy.lines;
  delete copy.shorelineLines;
  delete copy.structureLines;
  return { layerId, ...copy };
}

function terrainCells(dem, boundsWgs84, anchor) {
  const [a, b, c, d, e, f] = dem.nativeGrid.transform;
  const { rows, columns } = dem.nativeGrid.window;
  const cells = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const easting = a * (column + 0.5) + b * (row + 0.5) + c;
      const northing = d * (column + 0.5) + e * (row + 0.5) + f;
      const geographic = vicgrid94ToGda2020({ easting, northing });
      if (
        geographic.longitude < boundsWgs84.west
        || geographic.longitude > boundsWgs84.east
        || geographic.latitude < boundsWgs84.south
        || geographic.latitude > boundsWgs84.north
      ) continue;
      const local = wgs84ToLocalEnu(geographic, anchor);
      cells.push({
        row,
        column,
        x: round(local.east),
        z: round(-local.north),
        elevationAhd: dem.elevationAhd.values[row * columns + column],
      });
    }
  }
  return cells;
}

function provenanceForLayer(layer, work) {
  const sourceCrs = work.localFrame.horizontalSourceCrs;
  const vertical = work.localFrame.verticalSourceDatum;
  const notApplicable = vertical.identifier.startsWith('not-applicable');
  const isTerrain = layer.id === 'melbourne-vicmap-dem10m';
  return {
    ledgerLayerId: layer.id,
    datasetId: layer.datasetId,
    provider: layer.provider,
    sourceUrl: layer.sourceUrl,
    datasetVersion: layer.datasetVersion,
    capturedAt: layer.capturedAt,
    retrievedAt: layer.retrievedAt,
    sourceCrs: {
      status: 'declared',
      identifier: layer.spatial.horizontalCrs,
      axisOrder: sourceCrs.axisOrder,
      unit: isTerrain ? 'metre' : 'degree',
    },
    verticalDatum: notApplicable
      ? { status: 'not-applicable', name: null, unit: null, transformPipeline: null }
      : {
        status: 'declared',
        name: layer.spatial.verticalDatum,
        unit: 'metre',
        transformPipeline: isTerrain
          ? 'EPSG:3111 inverse; EPSG:8048 GDA94 to GDA2020; GDA2020 ECEF to local ENU; AHD retained'
          : `${work.localFrame.transform}; AHD retained`,
      },
    spatialVerification: layer.spatial.verificationStatus,
    licenceSpdx: 'CC-BY-4.0',
    licenceUrl: layer.licence.url,
    licenceSnapshotSha256: layer.licence.snapshotSha256,
    attribution: layer.licence.attribution,
    sourceArtifactSha256: layer.sourceArtifactSha256,
    rights: layer.rights,
    truthClass: 'authoritative',
    confidence: layer.kind === 'control' ? 'surveyed' : 'official',
    transformHistory: [
      work.localFrame.transform,
      isTerrain ? 'Native 10 m AHD cells retained without height resampling' : 'Clipped to frozen precinct and partitioned on a 250 m local ENU grid',
    ],
  };
}

function writeAsset(filename, data, kind, lod, assets) {
  const bytes = jsonBytes(data);
  const path = resolve(PACKAGE_DIR, filename);
  writeFileSync(path, bytes);
  const id = filename.replace(/\.json$/, '');
  const asset = {
    id,
    kind,
    uri: `${ASSET_BASE_URI}/${filename}`,
    sha256: sha256(bytes),
    byteLength: bytes.length,
    lod,
  };
  assets.push(asset);
  return asset;
}

function build() {
  const ledger = readJson('data/city/city-data-ledger.json');
  const qa = readJson('data/city/qa/melbourne-flinders-federation-cross-layer-v1.json');
  if (qa.releaseBlocked || qa.status !== 'passed-with-findings') {
    throw new Error('Cross-layer QA must pass without blocker findings before packaging.');
  }
  const melbourne = ledger.cities.find(({ id }) => id === 'melbourne');
  const boundsWgs84 = qa.sharedFrame.clipBoundsWgs84;
  const anchor = { ...qa.sharedFrame.anchorWgs84 };
  const tileBounds = tileBoundsForPrecinct(boundsWgs84, anchor);
  const { tiles, columns, rows } = createTiles(tileBounds);
  const works = Object.fromEntries(Object.entries(WORK).map(([layerId, path]) => {
    if (!existsSync(resolve(ROOT, path))) throw new Error(`${path}: work artifact is required`);
    return [layerId, readJson(path)];
  }));
  const properties = [];
  const entityIndex = [];

  for (const [layerId, layerKey] of Object.entries(RUNTIME_LAYER_KEYS)) {
    if (layerKey === 'terrain') continue;
    for (const entity of works[layerId].entities) {
      const matchingTiles = tiles.filter((tile) => intersects(entityBounds(entity), tile.boundsLocal));
      if (matchingTiles.length === 0) throw new Error(`${entity.id}: falls outside the frozen tile inventory`);
      for (const tile of matchingTiles) tile.vectorEntities[layerKey].push(entity);
      properties.push(propertyRecord(entity, layerId));
      entityIndex.push({
        id: entity.id,
        layerId,
        homeTileId: matchingTiles[0].id,
        tileIds: matchingTiles.map(({ id }) => id),
      });
    }
  }

  const dem = works['melbourne-vicmap-dem10m'];
  for (const cell of terrainCells(dem, boundsWgs84, anchor)) {
    const tile = tileForPoint(tiles, cell.x, cell.z);
    if (!tile) throw new Error(`DEM cell ${cell.row}:${cell.column} falls outside the tile inventory`);
    tile.terrainCells.push(cell);
  }

  mkdirSync(PACKAGE_DIR, { recursive: true });
  const expectedFiles = new Set(['manifest.json']);
  const assets = [];
  const tileInventory = [];
  for (const tile of tiles) {
    const lodAssets = [];
    for (const lod of LODS) {
      const stride = [4, 2, 1][lod];
      const layers = {};
      for (const [layerKey, entities] of Object.entries(tile.vectorEntities)) {
        layers[layerKey] = entities
          .filter((entity) => !['trees', 'control'].includes(layerKey)
            || stableHash(entity.id) % stride === 0)
          .map((entity) => geometryForLod(entity, layerKey, lod));
      }
      layers.terrain = tile.terrainCells.filter(({ row, column }) => row % stride === 0 && column % stride === 0);
      const filename = `${tile.id}-lod${lod}.json`;
      expectedFiles.add(filename);
      const asset = writeAsset(filename, {
        schemaVersion: 1,
        packageId: PACKAGE_ID,
        tileId: tile.id,
        lod,
        boundsLocal: tile.boundsLocal,
        layers,
      }, 'geometry', lod, assets);
      lodAssets.push({ lod, assetId: asset.id, uri: asset.uri, sha256: asset.sha256, byteLength: asset.byteLength });
    }
    tileInventory.push({
      id: tile.id,
      column: tile.column,
      row: tile.row,
      boundsLocal: tile.boundsLocal,
      dependencyTileIds: [...new Set(entityIndex
        .filter(({ tileIds, homeTileId }) => tileIds.includes(tile.id) && homeTileId !== tile.id)
        .map(({ homeTileId }) => homeTileId))].sort(),
      lods: lodAssets,
    });
  }

  expectedFiles.add('properties.json');
  const propertiesAsset = writeAsset('properties.json', {
    schemaVersion: 1,
    packageId: PACKAGE_ID,
    records: properties.sort((left, right) => left.id.localeCompare(right.id)),
  }, 'properties', null, assets);
  expectedFiles.add('entities-index.json');
  const indexAsset = writeAsset('entities-index.json', {
    schemaVersion: 1,
    packageId: PACKAGE_ID,
    packageVersion: PACKAGE_VERSION,
    precinct: { boundsWgs84, anchorWgs84: anchor, localFrame: 'ENU' },
    tileScheme: {
      id: 'local-enu-250m-v1',
      tileSizeMetres: TILE_SIZE_METRES,
      boundsLocal: tileBounds,
      columns,
      rows,
      lods: LODS,
    },
    sourceLayerIds: Object.keys(WORK),
    propertiesAsset: {
      id: propertiesAsset.id,
      uri: propertiesAsset.uri,
      sha256: propertiesAsset.sha256,
      byteLength: propertiesAsset.byteLength,
    },
    tiles: tileInventory,
    entities: entityIndex.sort((left, right) => left.id.localeCompare(right.id)),
    terrain: {
      sourceCrs: dem.nativeGrid.crs,
      verticalDatum: dem.nativeGrid.verticalDatum,
      nativeCellSizeMetres: dem.nativeGrid.cellSizeMetres,
      retainedCellCount: tiles.reduce((total, tile) => total + tile.terrainCells.length, 0),
      sourceCellValuesResampled: false,
    },
  }, 'entities-index', null, assets);

  const layerById = new Map(melbourne.layers.map((layer) => [layer.id, layer]));
  const manifest = {
    schemaVersion: 1,
    packageId: PACKAGE_ID,
    packageVersion: PACKAGE_VERSION,
    cityId: 'melbourne',
    truthClass: 'licensed-real-data',
    status: 'candidate',
    precinct: {
      status: 'frozen',
      labels: {
        en: 'Flinders Street–Federation Square engineering precinct',
        zh: '弗林德斯街—联邦广场工程片区',
      },
      boundsWgs84,
      anchorWgs84: anchor,
      localFrame: 'ENU',
      ianaTimeZone: 'Australia/Melbourne',
    },
    sourceLayers: Object.entries(WORK).map(([layerId]) => provenanceForLayer(layerById.get(layerId), works[layerId])),
    assets: [indexAsset, ...assets.filter(({ id }) => id !== indexAsset.id)],
    generatedAt: GENERATED_AT,
    approvals: {
      dataOwner: { status: 'review', by: null, at: null, evidence: null },
      legal: { status: 'review', by: null, at: null, evidence: null },
      engineering: { status: 'review', by: null, at: null, evidence: null },
      productRelease: { status: 'review', by: null, at: null, evidence: null },
    },
    release: {
      featureFlag: 'city-melbourne-real-v1',
      withdrawalOwner: 'productRelease',
      rollbackPackageId: null,
    },
  };
  writeFileSync(resolve(PACKAGE_DIR, 'manifest.json'), jsonBytes(manifest, true));

  for (const filename of readdirSync(PACKAGE_DIR)) {
    if (!expectedFiles.has(filename)) rmSync(resolve(PACKAGE_DIR, filename));
  }
  console.log(JSON.stringify({
    packageId: PACKAGE_ID,
    packageVersion: PACKAGE_VERSION,
    candidatePath: `data/city/candidates/${PACKAGE_ID}/manifest.json`,
    tileCount: tiles.length,
    assetCount: assets.length,
    entityCount: entityIndex.length,
    terrainCellCount: tiles.reduce((total, tile) => total + tile.terrainCells.length, 0),
    manifestSha256: sha256(readFileSync(resolve(PACKAGE_DIR, 'manifest.json'))),
  }, null, 2));
}

build();
const { buildMelbourneAnalysisGlb } = await import('./build-melbourne-analysis-glb.mjs');
await buildMelbourneAnalysisGlb();
