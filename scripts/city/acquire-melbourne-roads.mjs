#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { canAcquireCityLayer } from '../../src/lib/validateCityDataLedger.js';

const LAYER_ID = 'melbourne-vicmap-roads';
const ARTIFACT_ID = 'melbourne-roads-flinders-federation-v1';
const DATASET_ENDPOINT = 'https://opendata.maps.vic.gov.au/geoserver/wfs';
const BOUNDS = Object.freeze({
  west: 144.9615,
  south: -37.8205,
  east: 144.9715,
  north: -37.8105,
});
const RAW_PATH = `data/city/raw/melbourne/roads/${ARTIFACT_ID}.geojson`;
const HEADERS_PATH = `data/city/raw/melbourne/roads/${ARTIFACT_ID}.headers.json`;
const INVENTORY_PATH = `data/city/inventory/${ARTIFACT_ID}.json`;
const LICENCE_SNAPSHOT_SHA256 = '6cfeacc65b1486e274ffcd225af3fd49e47e69f4c5a39f2fc2c23e6b2934fde2';
const hashBytes = (bytes) => createHash('sha256').update(bytes).digest('hex');

function acquisitionUrl() {
  const url = new URL(DATASET_ENDPOINT);
  url.searchParams.set('service', 'WFS');
  url.searchParams.set('version', '2.0.0');
  url.searchParams.set('request', 'GetFeature');
  url.searchParams.set('typeNames', 'open-data-platform:tr_road');
  url.searchParams.set('outputFormat', 'application/json');
  url.searchParams.set('srsName', 'urn:ogc:def:crs:OGC:1.3:CRS84');
  url.searchParams.set(
    'bbox',
    `${BOUNDS.west},${BOUNDS.south},${BOUNDS.east},${BOUNDS.north},urn:ogc:def:crs:OGC:1.3:CRS84`,
  );
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
    throw new Error('Official WFS did not return a GeoJSON FeatureCollection.');
  }
  if (data.features.length < 100 || data.features.length > 2_000) {
    throw new Error(`Unexpected precinct feature count: ${data.features.length}.`);
  }
  const stableIds = new Set();
  for (const [index, feature] of data.features.entries()) {
    if (feature?.type !== 'Feature' || !['LineString', 'MultiLineString'].includes(feature.geometry?.type)) {
      throw new Error(`Feature ${index} is not a LineString or MultiLineString.`);
    }
    const pfi = String(feature.properties?.pfi || '').trim();
    if (!pfi) throw new Error(`Feature ${index} has no stable PFI.`);
    if (stableIds.has(pfi)) throw new Error(`Duplicate PFI ${pfi}.`);
    stableIds.add(pfi);
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
  if (!response.ok) throw new Error(`Official WFS export failed: ${response.status} ${response.statusText}`);
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
    datasetVersion: 'official-record-2026-08-15-wfs-snapshot',
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
    sourceFormat: 'GeoJSON from OGC WFS 2.0',
    sourceCrs: {
      identifier: 'OGC:CRS84',
      axisOrder: 'longitude,latitude',
      unit: 'degree',
      evidence: 'The official WFS request fixes srsName to OGC CRS84 and the response declares urn:ogc:def:crs:CRS::84.',
    },
    verticalDatum: {
      identifier: 'not-applicable-2d',
      unit: 'not-applicable',
      evidence: 'TR_ROAD is a two-dimensional road centreline layer; no source elevation is assigned.',
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
