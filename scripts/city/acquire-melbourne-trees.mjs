#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { canAcquireCityLayer } from '../../src/lib/validateCityDataLedger.js';

const LAYER_ID = 'melbourne-urban-forest-trees';
const ARTIFACT_ID = 'melbourne-trees-flinders-federation-v1';
const DATASET_ID = 'trees-with-species-and-dimensions-urban-forest';
const EXPORT_ENDPOINT = `https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/${DATASET_ID}/exports/geojson`;
const BOUNDS = Object.freeze({
  west: 144.9615,
  south: -37.8205,
  east: 144.9715,
  north: -37.8105,
});
const RAW_PATH = `data/city/raw/melbourne/trees/${ARTIFACT_ID}.geojson`;
const HEADERS_PATH = `data/city/raw/melbourne/trees/${ARTIFACT_ID}.headers.json`;
const INVENTORY_PATH = `data/city/inventory/${ARTIFACT_ID}.json`;
const LICENCE_SNAPSHOT_SHA256 = '6cfeacc65b1486e274ffcd225af3fd49e47e69f4c5a39f2fc2c23e6b2934fde2';
const hashBytes = (bytes) => createHash('sha256').update(bytes).digest('hex');

function acquisitionUrl() {
  const url = new URL(EXPORT_ENDPOINT);
  url.searchParams.set(
    'where',
    `in_bbox(coordinatelocation,${BOUNDS.south},${BOUNDS.west},${BOUNDS.north},${BOUNDS.east})`,
  );
  url.searchParams.set('use_labels', 'false');
  url.searchParams.set('epsg', '4326');
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

function validateGeoJson(data) {
  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
    throw new Error('Official export did not return a GeoJSON FeatureCollection.');
  }
  if (data.features.length < 500 || data.features.length > 2_000) {
    throw new Error(`Unexpected precinct tree count: ${data.features.length}.`);
  }
  const stableIds = new Set();
  for (const [index, feature] of data.features.entries()) {
    if (feature?.type !== 'Feature' || feature.geometry?.type !== 'Point') {
      throw new Error(`Feature ${index} is not a Point.`);
    }
    const [longitude, latitude] = feature.geometry.coordinates || [];
    if (
      !Number.isFinite(longitude)
      || !Number.isFinite(latitude)
      || longitude < BOUNDS.west
      || longitude > BOUNDS.east
      || latitude < BOUNDS.south
      || latitude > BOUNDS.north
    ) throw new Error(`Feature ${index} has invalid or out-of-bounds coordinates.`);
    const comId = String(feature.properties?.com_id || '').trim();
    if (!comId) throw new Error(`Feature ${index} has no stable CoM ID.`);
    if (stableIds.has(comId)) throw new Error(`Duplicate CoM ID ${comId}.`);
    stableIds.add(comId);
  }
}

async function main() {
  if ([RAW_PATH, HEADERS_PATH, INVENTORY_PATH].some((path) => existsSync(resolve(path)))) {
    throw new Error(`${ARTIFACT_ID} already exists. Raw inventory artifacts are immutable; use a new artifact id.`);
  }
  const layer = await approvedLayer();
  const url = acquisitionUrl();
  const response = await fetch(url, {
    headers: { Accept: 'application/geo+json, application/json' },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`Official tree export failed: ${response.status} ${response.statusText}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const data = JSON.parse(bytes.toString('utf8'));
  validateGeoJson(data);

  const retrievedAt = new Date().toISOString();
  const rawSha256 = hashBytes(bytes);
  const selectedHeaders = Object.fromEntries([
    'content-type',
    'content-length',
    'content-disposition',
    'etag',
    'last-modified',
    'x-ratelimit-limit',
    'x-ratelimit-remaining',
    'x-ratelimit-reset',
  ].map((name) => [name, response.headers.get(name)]));
  const headersBytes = Buffer.from(`${JSON.stringify({
    retrievedAt,
    finalUrl: response.url,
    headers: selectedHeaders,
  }, null, 2)}\n`);
  const inventory = {
    schemaVersion: 1,
    artifactId: ARTIFACT_ID,
    cityId: 'melbourne',
    layerId: LAYER_ID,
    datasetId: layer.datasetId,
    datasetVersion: 'source-modified-2025-09-22-data-processed-2025-09-22',
    title: layer.title,
    provider: layer.provider,
    sourceRecordUrl: layer.sourceUrl,
    acquisitionUrl: url.toString(),
    queryBoundsWgs84: BOUNDS,
    retrievedAt,
    rawPath: RAW_PATH,
    responseHeadersPath: HEADERS_PATH,
    responseHeadersSha256: hashBytes(headersBytes),
    rawSha256,
    rawByteLength: bytes.byteLength,
    featureCount: data.features.length,
    sourceFormat: 'GeoJSON from Opendatasoft Explore API v2.1 export',
    sourceCrs: {
      identifier: 'EPSG:4326',
      axisOrder: 'longitude,latitude in GeoJSON',
      unit: 'degree',
      evidence: 'The official export request fixes epsg=4326; GeoJSON Point coordinates and longitude/latitude fields agree.',
    },
    verticalDatum: {
      identifier: 'not-applicable-2d-point-inventory',
      unit: 'not-applicable',
      evidence: 'The tree inventory supplies horizontal point locations and no source ground or tree-top elevation.',
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
  await writeFile(resolve(RAW_PATH), bytes);
  await writeFile(resolve(HEADERS_PATH), headersBytes);
  await writeFile(resolve(INVENTORY_PATH), `${JSON.stringify(inventory, null, 2)}\n`);
  console.log(JSON.stringify({
    artifactId: ARTIFACT_ID,
    featureCount: data.features.length,
    rawByteLength: bytes.byteLength,
    rawSha256,
    rawPath: RAW_PATH,
    inventoryPath: INVENTORY_PATH,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
