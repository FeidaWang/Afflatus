#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { canAcquireCityLayer } from '../../src/lib/validateCityDataLedger.js';

const LAYER_ID = 'melbourne-buildings-2023';
const ARTIFACT_ID = 'melbourne-buildings-flinders-federation-v1';
const DATASET_ENDPOINT = 'https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/2023-building-footprints/exports/geojson';
const BOUNDS = Object.freeze({
  west: 144.9615,
  south: -37.8205,
  east: 144.9715,
  north: -37.8105,
});
const RAW_PATH = `data/city/raw/melbourne/buildings-2023/${ARTIFACT_ID}.geojson`;
const HEADERS_PATH = `data/city/raw/melbourne/buildings-2023/${ARTIFACT_ID}.headers.json`;
const INVENTORY_PATH = `data/city/inventory/${ARTIFACT_ID}.json`;
const LICENCE_SNAPSHOT_SHA256 = '6cfeacc65b1486e274ffcd225af3fd49e47e69f4c5a39f2fc2c23e6b2934fde2';
const hashBytes = (bytes) => createHash('sha256').update(bytes).digest('hex');

const polygonWkt = ({ west, south, east, north }) => (
  `POLYGON ((${west} ${south}, ${east} ${south}, ${east} ${north}, ${west} ${north}, ${west} ${south}))`
);

function acquisitionUrl() {
  const url = new URL(DATASET_ENDPOINT);
  url.searchParams.set('where', `intersects(geo_shape, geom'${polygonWkt(BOUNDS)}')`);
  url.searchParams.set('lang', 'en');
  url.searchParams.set('timezone', 'Australia/Melbourne');
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
  if (data.features.length < 100 || data.features.length > 5_000) {
    throw new Error(`Unexpected precinct feature count: ${data.features.length}.`);
  }
  for (const [index, feature] of data.features.entries()) {
    if (feature?.type !== 'Feature' || !['Polygon', 'MultiPolygon'].includes(feature.geometry?.type)) {
      throw new Error(`Feature ${index} is not a Polygon or MultiPolygon.`);
    }
    if (!String(feature.properties?.objectid || '').trim()) {
      throw new Error(`Feature ${index} has no stable objectid.`);
    }
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
  if (!response.ok) throw new Error(`Official export failed: ${response.status} ${response.statusText}`);
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
  ].map((name) => [name, response.headers.get(name)]));
  const headersBytes = Buffer.from(`${JSON.stringify({ retrievedAt, finalUrl: response.url, headers: selectedHeaders }, null, 2)}\n`);
  const inventory = {
    schemaVersion: 1,
    artifactId: ARTIFACT_ID,
    cityId: 'melbourne',
    layerId: LAYER_ID,
    datasetId: layer.datasetId,
    datasetVersion: layer.datasetVersion,
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
    sourceFormat: 'GeoJSON',
    sourceCrs: {
      identifier: 'OGC:CRS84',
      axisOrder: 'longitude,latitude',
      unit: 'degree',
      evidence: 'GeoJSON RFC 7946 coordinates returned by the official Opendatasoft API.',
    },
    verticalDatum: {
      identifier: 'AHD',
      unit: 'metre',
      fields: [
        'footprint_min_elevation',
        'footprint_max_elevation',
        'structure_min_elevation',
        'structure_max_elevation',
      ],
      evidence: 'City of Melbourne 2023 Building Footprints dataset record.',
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
