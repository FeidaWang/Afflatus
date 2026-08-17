#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { canAcquireCityLayer } from '../../src/lib/validateCityDataLedger.js';

const LAYER_ID = 'melbourne-pedestrian-network';
const ARTIFACT_ID = 'melbourne-pedestrian-network-complete-v1';
const DATASET_ENDPOINT = 'https://data.melbourne.vic.gov.au/api/datasets/1.0/pedestrian-network/alternative_exports/pedestrian_network_zip/';
const BOUNDS = Object.freeze({
  west: 144.9615,
  south: -37.8205,
  east: 144.9715,
  north: -37.8105,
});
const RAW_PATH = `data/city/raw/melbourne/pedestrian/${ARTIFACT_ID}.zip`;
const HEADERS_PATH = `data/city/raw/melbourne/pedestrian/${ARTIFACT_ID}.headers.json`;
const INVENTORY_PATH = `data/city/inventory/${ARTIFACT_ID}.json`;
const LICENCE_SNAPSHOT_SHA256 = '6cfeacc65b1486e274ffcd225af3fd49e47e69f4c5a39f2fc2c23e6b2934fde2';
const REQUIRED_PROPERTIES = Object.freeze([
  'OBJECTID', 'NETID', 'TYPE', 'MCCID', 'MCCID_A', 'MCCID_B',
  'OTIME', 'CTIME', 'COST', 'Shape_Length', 'DESCRIPTION', 'TRAFFIC',
]);
const hashBytes = (bytes) => createHash('sha256').update(bytes).digest('hex');

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

function readArchiveMember(archivePath, member) {
  return execFileSync('unzip', ['-p', archivePath, member], { maxBuffer: 64 * 1024 * 1024 });
}

function validateFeatureCollection(bytes, expected) {
  const data = JSON.parse(bytes.toString('utf8'));
  if (data?.type !== 'FeatureCollection' || data.name !== expected.name || data.features.length !== expected.count) {
    throw new Error(`${expected.member} does not match its inspected FeatureCollection contract.`);
  }
  const stableIds = new Set();
  for (const [index, feature] of data.features.entries()) {
    if (feature?.type !== 'Feature' || feature.geometry?.type !== expected.geometryType) {
      throw new Error(`${expected.member} feature ${index} has an unexpected geometry type.`);
    }
    const objectId = feature.properties?.OBJECTID;
    if (!Number.isSafeInteger(objectId) || stableIds.has(objectId)) {
      throw new Error(`${expected.member} feature ${index} has an invalid or duplicate OBJECTID.`);
    }
    stableIds.add(objectId);
    if (expected.requiredProperties?.some((key) => !(key in feature.properties))) {
      throw new Error(`${expected.member} feature ${index} is missing a required semantic field.`);
    }
  }
  return data;
}

async function main() {
  if ([RAW_PATH, HEADERS_PATH, INVENTORY_PATH].some((path) => existsSync(resolve(path)))) {
    throw new Error(`${ARTIFACT_ID} already exists. Raw inventory artifacts are immutable; use a new artifact id.`);
  }
  const layer = await approvedLayer();
  const response = await fetch(DATASET_ENDPOINT, {
    headers: { Accept: 'application/zip' },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`Official alternative export failed: ${response.status} ${response.statusText}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'afflatus-pedestrian-'));
  const temporaryArchive = join(temporaryDirectory, `${ARTIFACT_ID}.zip`);
  let pedestrianBytes;
  let centroidBytes;
  try {
    await writeFile(temporaryArchive, bytes);
    const members = execFileSync('unzip', ['-Z1', temporaryArchive], { encoding: 'utf8' })
      .trim().split('\n').sort();
    if (JSON.stringify(members) !== JSON.stringify(['Pedestrian_network.json', 'Property_centroid.json'])) {
      throw new Error(`Official ZIP member list changed: ${members.join(', ')}.`);
    }
    pedestrianBytes = readArchiveMember(temporaryArchive, 'Pedestrian_network.json');
    centroidBytes = readArchiveMember(temporaryArchive, 'Property_centroid.json');
    validateFeatureCollection(pedestrianBytes, {
      member: 'Pedestrian_network.json', name: 'Pedestrian_network', count: 71_060,
      geometryType: 'LineString', requiredProperties: REQUIRED_PROPERTIES,
    });
    validateFeatureCollection(centroidBytes, {
      member: 'Property_centroid.json', name: 'Cadastral_centroids', count: 14_266,
      geometryType: 'Point', requiredProperties: ['OBJECTID', 'NeworkID'],
    });
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }

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
    datasetVersion: 'source-modified-2019-11-19-data-processed-2022-11-24',
    title: layer.title,
    provider: layer.provider,
    sourceRecordUrl: layer.sourceUrl,
    acquisitionUrl: DATASET_ENDPOINT,
    queryBoundsWgs84: BOUNDS,
    retrievedAt,
    rawPath: RAW_PATH,
    responseHeadersPath: HEADERS_PATH,
    responseHeadersSha256: hashBytes(headersBytes),
    rawSha256,
    rawByteLength: bytes.byteLength,
    featureCount: 71_060,
    sourceFormat: 'ZIP containing GeoJSON FeatureCollections',
    archiveMembers: [
      {
        path: 'Pedestrian_network.json',
        byteLength: pedestrianBytes.byteLength,
        sha256: hashBytes(pedestrianBytes),
        featureCount: 71_060,
        geometryType: 'LineString',
      },
      {
        path: 'Property_centroid.json',
        byteLength: centroidBytes.byteLength,
        sha256: hashBytes(centroidBytes),
        featureCount: 14_266,
        geometryType: 'Point',
      },
    ],
    sourceCrs: {
      identifier: 'OGC:CRS84',
      axisOrder: 'longitude,latitude',
      unit: 'degree',
      evidence: 'GeoJSON coordinates match the official Opendatasoft WGS84 record geometry for OBJECTID 65923 exactly.',
    },
    verticalDatum: {
      identifier: 'not-applicable-2d',
      unit: 'not-applicable',
      evidence: 'The pedestrian archive contains two-dimensional LineString and Point geometry with no source elevation.',
    },
    licence: {
      id: layer.licence.id,
      url: layer.licence.url,
      snapshotSha256: layer.licence.snapshotSha256,
      attribution: layer.licence.attribution,
    },
    acquisitionApprovalEvidence: layer.approvals.dataOwner.evidence,
    sourceStrategyEvidence: 'data/city/reviews/2026-08-15-melbourne-pedestrian-source-strategy.md',
    productionApproved: false,
  };

  await mkdir(dirname(resolve(RAW_PATH)), { recursive: true });
  await mkdir(dirname(resolve(INVENTORY_PATH)), { recursive: true });
  await writeFile(resolve(RAW_PATH), bytes);
  await writeFile(resolve(HEADERS_PATH), headersBytes);
  await writeFile(resolve(INVENTORY_PATH), `${JSON.stringify(inventory, null, 2)}\n`);
  console.log(JSON.stringify({
    artifactId: ARTIFACT_ID,
    featureCount: inventory.featureCount,
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
