#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { canAcquireCityLayer } from '../../src/lib/validateCityDataLedger.js';

const LAYER_ID = 'melbourne-vicmap-hydro';
const ARTIFACT_ID = 'melbourne-hydro-flinders-federation-v1';
const SERVICE_ENDPOINT = 'https://services-ap1.arcgis.com/P744lA0wf4LlBZ84/ArcGIS/rest/services/Vicmap_Hydro/FeatureServer';
const SERVICE_ITEM_ID = '1e37a8817bc7497da0fbe6abdf5fade5';
const BOUNDS = Object.freeze({
  west: 144.9615,
  south: -37.8205,
  east: 144.9715,
  north: -37.8105,
});
const SOURCE_LAYERS = Object.freeze([
  {
    id: 1,
    member: 'water-area.geojson',
    name: 'Water Area - Vicmap Hydro (HY_WATER_AREA_POLYGON)',
    geometryTypes: ['Polygon', 'MultiPolygon'],
    minimumFeatures: 1,
    maximumFeatures: 20,
  },
  {
    id: 6,
    member: 'water-structure-line.geojson',
    name: 'Water Structure Line - Vicmap Hydro (HY_WATER_STRUCT_LINE)',
    geometryTypes: ['LineString', 'MultiLineString'],
    minimumFeatures: 1,
    maximumFeatures: 100,
  },
]);
const RAW_PATH = `data/city/raw/melbourne/hydro/${ARTIFACT_ID}.zip`;
const HEADERS_PATH = `data/city/raw/melbourne/hydro/${ARTIFACT_ID}.headers.json`;
const INVENTORY_PATH = `data/city/inventory/${ARTIFACT_ID}.json`;
const LICENCE_SNAPSHOT_SHA256 = '6cfeacc65b1486e274ffcd225af3fd49e47e69f4c5a39f2fc2c23e6b2934fde2';
const hashBytes = (bytes) => createHash('sha256').update(bytes).digest('hex');

function queryUrl(layerId) {
  const url = new URL(`${SERVICE_ENDPOINT}/${layerId}/query`);
  url.searchParams.set('where', '1=1');
  url.searchParams.set('geometry', `${BOUNDS.west},${BOUNDS.south},${BOUNDS.east},${BOUNDS.north}`);
  url.searchParams.set('geometryType', 'esriGeometryEnvelope');
  url.searchParams.set('inSR', '4326');
  url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
  url.searchParams.set('outFields', '*');
  url.searchParams.set('returnGeometry', 'true');
  url.searchParams.set('outSR', '4326');
  url.searchParams.set('f', 'geojson');
  return url;
}

async function approvedLayer() {
  const ledger = JSON.parse(await readFile(resolve('data/city/city-data-ledger.json'), 'utf8'));
  const city = ledger.cities.find(({ id }) => id === 'melbourne');
  const layer = city?.layers.find(({ id }) => id === LAYER_ID);
  if (!layer || !canAcquireCityLayer(layer)) {
    throw new Error(`${LAYER_ID} is not acquisition-approved in the city data ledger.`);
  }
  if (layer.licence.snapshotSha256 !== LICENCE_SNAPSHOT_SHA256) {
    throw new Error(`${LAYER_ID} licence snapshot does not match the reviewed evidence bundle.`);
  }
  return layer;
}

function validateResponse(bytes, sourceLayer) {
  const data = JSON.parse(bytes.toString('utf8'));
  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
    throw new Error(`${sourceLayer.name} did not return a GeoJSON FeatureCollection.`);
  }
  if (data.features.length < sourceLayer.minimumFeatures || data.features.length > sourceLayer.maximumFeatures) {
    throw new Error(`${sourceLayer.name} returned unexpected feature count ${data.features.length}.`);
  }
  if (data.crs?.properties?.name !== 'EPSG:4326') {
    throw new Error(`${sourceLayer.name} did not declare EPSG:4326.`);
  }
  const stableIds = new Set();
  for (const [index, feature] of data.features.entries()) {
    if (!sourceLayer.geometryTypes.includes(feature.geometry?.type)) {
      throw new Error(`${sourceLayer.name} feature ${index} has unexpected geometry ${feature.geometry?.type}.`);
    }
    const pfi = String(feature.properties?.pfi || '').trim();
    if (!pfi || stableIds.has(pfi)) throw new Error(`${sourceLayer.name} has invalid or duplicate PFI ${pfi}.`);
    stableIds.add(pfi);
  }
  return data;
}

async function main() {
  if ([RAW_PATH, HEADERS_PATH, INVENTORY_PATH].some((path) => existsSync(resolve(path)))) {
    throw new Error(`${ARTIFACT_ID} already exists. Raw inventory artifacts are immutable; use a new artifact id.`);
  }
  const layer = await approvedLayer();
  const responses = [];
  for (const sourceLayer of SOURCE_LAYERS) {
    const url = queryUrl(sourceLayer.id);
    const response = await fetch(url, {
      headers: { Accept: 'application/geo+json, application/json' },
      redirect: 'follow',
    });
    if (!response.ok) throw new Error(`${sourceLayer.name} query failed: ${response.status} ${response.statusText}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const data = validateResponse(bytes, sourceLayer);
    responses.push({ sourceLayer, url, response, bytes, data });
  }

  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'afflatus-hydro-'));
  const temporaryArchive = join(temporaryDirectory, `${ARTIFACT_ID}.zip`);
  let archiveBytes;
  try {
    for (const { sourceLayer, bytes } of responses) {
      await writeFile(join(temporaryDirectory, sourceLayer.member), bytes);
    }
    execFileSync('zip', ['-X', '-q', temporaryArchive, ...SOURCE_LAYERS.map(({ member }) => member)], {
      cwd: temporaryDirectory,
    });
    archiveBytes = await readFile(temporaryArchive);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }

  const retrievedAt = new Date().toISOString();
  const responseEvidence = responses.map(({ sourceLayer, url, response }) => ({
    layerId: sourceLayer.id,
    finalUrl: response.url,
    requestUrl: url.toString(),
    headers: Object.fromEntries([
      'content-type', 'content-length', 'content-disposition', 'etag', 'last-modified',
    ].map((name) => [name, response.headers.get(name)])),
  }));
  const headersBytes = Buffer.from(`${JSON.stringify({ retrievedAt, responses: responseEvidence }, null, 2)}\n`);
  const featureCount = responses.reduce((total, { data }) => total + data.features.length, 0);
  const inventory = {
    schemaVersion: 1,
    artifactId: ARTIFACT_ID,
    cityId: 'melbourne',
    layerId: LAYER_ID,
    datasetId: layer.datasetId,
    datasetVersion: `arcgis-item-${SERVICE_ITEM_ID}-snapshot-2026-08-15`,
    title: layer.title,
    provider: layer.provider,
    sourceRecordUrl: layer.sourceUrl,
    acquisitionUrl: SERVICE_ENDPOINT,
    queryBoundsWgs84: BOUNDS,
    retrievedAt,
    rawPath: RAW_PATH,
    responseHeadersPath: HEADERS_PATH,
    responseHeadersSha256: hashBytes(headersBytes),
    rawSha256: hashBytes(archiveBytes),
    rawByteLength: archiveBytes.byteLength,
    featureCount,
    sourceFormat: 'ZIP containing exact ArcGIS FeatureServer GeoJSON responses',
    service: {
      itemId: SERVICE_ITEM_ID,
      nativeSpatialReference: 'EPSG:3857',
      maxRecordCount: 2000,
    },
    archiveMembers: responses.map(({ sourceLayer, url, bytes, data }) => ({
      path: sourceLayer.member,
      byteLength: bytes.byteLength,
      sha256: hashBytes(bytes),
      featureCount: data.features.length,
      geometryType: sourceLayer.geometryTypes.join('|'),
      serviceLayerId: sourceLayer.id,
      serviceLayerName: sourceLayer.name,
      queryUrl: url.toString(),
    })),
    sourceCrs: {
      identifier: 'EPSG:4326',
      axisOrder: 'longitude,latitude in GeoJSON',
      unit: 'degree',
      evidence: 'Each official FeatureServer query requests outSR=4326 and each GeoJSON response declares EPSG:4326.',
    },
    verticalDatum: {
      identifier: 'not-applicable-2d',
      unit: 'not-applicable',
      evidence: 'Selected water polygons and structure lines contain no source elevation.',
    },
    licence: {
      id: layer.licence.id,
      url: layer.licence.url,
      snapshotSha256: layer.licence.snapshotSha256,
      attribution: layer.licence.attribution,
    },
    acquisitionApprovalEvidence: layer.approvals.dataOwner.evidence,
    productionApproved: false,
  };

  await mkdir(dirname(resolve(RAW_PATH)), { recursive: true });
  await mkdir(dirname(resolve(INVENTORY_PATH)), { recursive: true });
  await writeFile(resolve(RAW_PATH), archiveBytes);
  await writeFile(resolve(HEADERS_PATH), headersBytes);
  await writeFile(resolve(INVENTORY_PATH), `${JSON.stringify(inventory, null, 2)}\n`);
  console.log(JSON.stringify({
    artifactId: ARTIFACT_ID,
    featureCount,
    rawByteLength: archiveBytes.byteLength,
    rawSha256: inventory.rawSha256,
    members: inventory.archiveMembers.map(({ path, featureCount: count, sha256 }) => ({ path, featureCount: count, sha256 })),
    rawPath: RAW_PATH,
    inventoryPath: INVENTORY_PATH,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
