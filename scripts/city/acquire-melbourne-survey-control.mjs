#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { canAcquireCityLayer } from '../../src/lib/validateCityDataLedger.js';

const LAYER_ID = 'melbourne-vicmap-survey-control';
const ARTIFACT_ID = 'melbourne-survey-control-flinders-federation-v1';
const SERVICE_ENDPOINT = 'https://services-ap1.arcgis.com/P744lA0wf4LlBZ84/ArcGIS/rest/services/Vicmap_Position/FeatureServer/0';
const BOUNDS = Object.freeze({
  west: 144.9615,
  south: -37.8205,
  east: 144.9715,
  north: -37.8105,
});
const RAW_PATH = `data/city/raw/melbourne/survey-control/${ARTIFACT_ID}.geojson`;
const METADATA_PATH = `data/city/raw/melbourne/survey-control/${ARTIFACT_ID}.metadata.json`;
const HEADERS_PATH = `data/city/raw/melbourne/survey-control/${ARTIFACT_ID}.headers.json`;
const INVENTORY_PATH = `data/city/inventory/${ARTIFACT_ID}.json`;
const LICENCE_SNAPSHOT_SHA256 = '7c5072b65f38636b87df656a792e9d62d38b65192f84fa7fb11ee1ce6aea5373';

const hashBytes = (bytes) => createHash('sha256').update(bytes).digest('hex');
const counts = (values) => Object.fromEntries([...new Set(values)].sort().map((value) => [
  String(value),
  values.filter((candidate) => candidate === value).length,
]));

function acquisitionUrl() {
  const url = new URL(`${SERVICE_ENDPOINT}/query`);
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

async function fetchBytes(url, accept) {
  const response = await fetch(url, { headers: { Accept: accept }, redirect: 'follow' });
  if (!response.ok) throw new Error(`${url} failed: ${response.status} ${response.statusText}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return {
    bytes,
    finalUrl: response.url,
    headers: Object.fromEntries([
      'content-type',
      'content-length',
      'content-disposition',
      'etag',
      'last-modified',
    ].map((name) => [name, response.headers.get(name)])),
  };
}

function validateGeoJson(data) {
  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
    throw new Error('Official FeatureServer did not return a GeoJSON FeatureCollection.');
  }
  if (data.features.length < 100 || data.features.length > 500) {
    throw new Error(`Unexpected precinct survey-control count: ${data.features.length}.`);
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
    const stableId = String(feature.properties?.nine_figure_no || '').trim();
    if (!/^\d{9}$/.test(stableId)) throw new Error(`Feature ${index} has no valid nine-figure mark number.`);
    if (stableIds.has(stableId)) throw new Error(`Duplicate survey-control mark ${stableId}.`);
    stableIds.add(stableId);
  }
}

function validateMetadata(metadata) {
  if (
    metadata?.type !== 'Feature Layer'
    || metadata.geometryType !== 'esriGeometryPoint'
    || metadata.objectIdField !== 'OBJECTID'
  ) throw new Error('Official FeatureServer layer metadata does not match the expected survey-control schema.');
  const fields = new Set((metadata.fields || []).map(({ name }) => name));
  const required = [
    'nine_figure_no',
    'status',
    'scn_gda',
    'adj_ahd',
    'mga2020_easting',
    'mga2020_northing',
    'gda2020_technique',
    'gda94_uncertainty',
    'ahd_height',
    'ahd_technique',
    'v_uncertainty',
  ];
  if (required.some((field) => !fields.has(field))) {
    throw new Error('Official FeatureServer layer metadata is missing required GDA2020/AHD control fields.');
  }
}

async function main() {
  if ([RAW_PATH, METADATA_PATH, HEADERS_PATH, INVENTORY_PATH].some((path) => existsSync(resolve(path)))) {
    throw new Error(`${ARTIFACT_ID} already exists. Raw inventory artifacts are immutable; use a new artifact id.`);
  }
  const layer = await approvedLayer();
  const url = acquisitionUrl();
  const metadataUrl = new URL(SERVICE_ENDPOINT);
  metadataUrl.searchParams.set('f', 'pjson');
  const [source, metadataSource] = await Promise.all([
    fetchBytes(url, 'application/geo+json, application/json'),
    fetchBytes(metadataUrl, 'application/json'),
  ]);
  const data = JSON.parse(source.bytes.toString('utf8'));
  const metadata = JSON.parse(metadataSource.bytes.toString('utf8'));
  validateGeoJson(data);
  validateMetadata(metadata);

  const retrievedAt = new Date().toISOString();
  const rawSha256 = hashBytes(source.bytes);
  const metadataSha256 = hashBytes(metadataSource.bytes);
  const headersBytes = Buffer.from(`${JSON.stringify({
    retrievedAt,
    query: { finalUrl: source.finalUrl, headers: source.headers },
    metadata: { finalUrl: metadataSource.finalUrl, headers: metadataSource.headers },
  }, null, 2)}\n`);
  const trustedCandidateCount = data.features.filter(({ properties = {} }) => (
    properties.status === 'OK'
    && properties.scn_gda === 'YES'
    && properties.adj_ahd === 'YES'
    && properties.gda2020_technique === 'ADJUSTED'
    && properties.ahd_technique === 'SPIRIT LEVELLING'
    && Number.isFinite(Number(properties.ahd_height))
    && Number.isFinite(Number(properties.v_uncertainty))
  )).length;
  if (trustedCandidateCount < 12) {
    throw new Error(`Only ${trustedCandidateCount} adjusted GDA2020/AHD controls were available.`);
  }
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
    sourceMetadataUrl: metadataUrl.toString(),
    queryBoundsWgs84: BOUNDS,
    retrievedAt,
    rawPath: RAW_PATH,
    sourceMetadataPath: METADATA_PATH,
    sourceMetadataSha256: metadataSha256,
    responseHeadersPath: HEADERS_PATH,
    responseHeadersSha256: hashBytes(headersBytes),
    rawSha256,
    rawByteLength: source.bytes.byteLength,
    featureCount: data.features.length,
    trustedCandidateCount,
    statusCounts: counts(data.features.map(({ properties }) => properties?.status || 'missing')),
    sourceFormat: 'GeoJSON from ArcGIS FeatureServer query with separate PJSON layer metadata',
    sourceCrs: {
      identifier: 'EPSG:4326 GeoJSON output with published GDA2020/MGA2020 coordinate attributes',
      axisOrder: 'longitude,latitude in GeoJSON',
      unit: 'degree; MGA2020 fields in metre',
      evidence: 'The official query fixes outSR=4326 and returns GeoJSON; the layer schema supplies explicit MGA2020 coordinate fields for independent residual checking.',
    },
    verticalDatum: {
      identifier: 'AHD',
      unit: 'metre',
      evidence: 'The official Vicmap Position schema publishes ahd_height, AHD technique, adjusted-AHD flag and vertical uncertainty fields.',
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
  await writeFile(resolve(RAW_PATH), source.bytes);
  await writeFile(resolve(METADATA_PATH), metadataSource.bytes);
  await writeFile(resolve(HEADERS_PATH), headersBytes);
  await writeFile(resolve(INVENTORY_PATH), `${JSON.stringify(inventory, null, 2)}\n`);
  console.log(JSON.stringify({
    artifactId: ARTIFACT_ID,
    featureCount: data.features.length,
    trustedCandidateCount,
    rawByteLength: source.bytes.byteLength,
    rawSha256,
    metadataSha256,
    rawPath: RAW_PATH,
    inventoryPath: INVENTORY_PATH,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
