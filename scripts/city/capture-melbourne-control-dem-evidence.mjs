#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const SNAPSHOT_DATE = '2026-08-16';
const SNAPSHOT_PATH = `data/city/melbourne-control-dem-licence-evidence-${SNAPSHOT_DATE}.json`;
const RAW_ROOT = `data/city/raw/melbourne/evidence/control-dem-${SNAPSHOT_DATE}`;

const SOURCES = Object.freeze([
  {
    id: 'melbourne-vicmap-survey-control-record',
    layerId: 'melbourne-vicmap-survey-control',
    url: 'https://discover.data.vic.gov.au/api/3/action/package_show?id=vicmap-position-rest-api',
    rawPath: `${RAW_ROOT}/vicmap-position-rest-api.json`,
  },
  {
    id: 'melbourne-vicmap-dem10m-record',
    layerId: 'melbourne-vicmap-dem10m',
    url: 'https://discover.data.vic.gov.au/api/3/action/package_show?id=vicmap-elevation-dem-10m',
    rawPath: `${RAW_ROOT}/vicmap-elevation-dem-10m.json`,
  },
]);

const DOCUMENTS = Object.freeze([
  {
    id: 'datavic-copyright-policy-2026-08-16',
    title: 'Copyright: DataVic',
    url: 'https://www.data.vic.gov.au/copyright-datavic',
    rawPath: `${RAW_ROOT}/datavic-copyright.html`,
    observations: [
      'The dataset record page controls the licence and attribution for each dataset.',
      'DataVic says raw data is provided under CC BY 4.0 to the maximum extent possible, subject to dataset-specific and third-party exceptions.',
      'Modified or transformed data may carry additional attribution requirements stated on the dataset record.',
    ],
  },
  {
    id: 'datashare-terms-of-use-2026-08-16',
    title: 'DataShare Terms of Use',
    url: 'https://datashare.maps.vic.gov.au/terms-of-use',
    rawPath: `${RAW_ROOT}/datashare-terms-of-use.html`,
    observations: [
      'DataShare states that its terms prevail over linked general DEECA terms if inconsistent.',
      'The order flow collects contact details to provide the requested product and for administrative and audit purposes.',
      'The page directs users to the DEECA spatial-data licensing page for the licence that applies to delivered spatial data.',
    ],
  },
  {
    id: 'cc-by-4-legal-code-2026-08-16',
    title: 'Creative Commons Attribution 4.0 International — Legal Code',
    url: 'https://creativecommons.org/licenses/by/4.0/legalcode',
    rawPath: `${RAW_ROOT}/cc-by-4-legal-code.html`,
    observations: [
      'CC BY 4.0 grants reproduction, sharing and adaptation rights subject to its conditions.',
      'Shared material must retain required attribution, licence and modification information.',
      'The licence does not grant trademark, privacy, publicity or third-party rights.',
    ],
  },
  {
    id: 'vicmap-dem10m-metadata-2026-08-16',
    title: 'Vicmap Elevation DEM 10m ISO 19115 metadata',
    url: 'https://metashare.maps.vic.gov.au/geonetwork/srv/api/records/2fd9d712-5407-51df-bc75-bb13d37499af',
    rawPath: `${RAW_ROOT}/vicmap-elevation-dem-10m.xml`,
    accept: 'application/xml',
    observations: [
      'The metadata identifies EPSG:4283 (GDA94 geographic) as its reference system.',
      'It states 10 metre resolution, horizontal accuracy of 12.5 metres and vertical accuracy of 5 metres or better, with an overall vertical accuracy calculation of 2.96 metres.',
      'It warns that reprojection, format conversion or resampling changes DEM height values; delivery-file metadata must therefore be retained and verified.',
    ],
  },
]);

const hashBytes = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function fetchImmutable({ url, rawPath, accept = '*/*' }) {
  const response = await fetch(url, { headers: { Accept: accept }, redirect: 'follow' });
  if (!response.ok) throw new Error(`${url} failed: ${response.status} ${response.statusText}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await mkdir(dirname(resolve(rawPath)), { recursive: true });
  await writeFile(resolve(rawPath), bytes);
  return {
    bytes,
    finalUrl: response.url,
    contentType: response.headers.get('content-type'),
    lastModified: response.headers.get('last-modified'),
    sha256: hashBytes(bytes),
  };
}

function normalizeRecord(source, raw) {
  const payload = JSON.parse(raw.bytes.toString('utf8'));
  if (payload?.success !== true || !payload.result) {
    throw new Error(`${source.layerId} did not return a CKAN package record.`);
  }
  const record = payload.result;
  return {
    id: source.id,
    layerId: source.layerId,
    recordEndpoint: source.url,
    rawPath: source.rawPath,
    rawResponseSha256: raw.sha256,
    datasetId: record.id,
    datasetSlug: record.name,
    title: record.title,
    licenceLabel: record.license_title,
    licenceUrl: record.license_url,
    publisher: record.organization?.title?.trim() || null,
    createdAt: record.metadata_created,
    modifiedAt: record.metadata_modified,
    updateFrequency: record.update_frequency || null,
    resources: (record.resources || []).map((resource) => ({
      id: resource.id,
      name: resource.name,
      format: resource.format,
      url: resource.url,
      createdAt: resource.created,
      modifiedAt: resource.metadata_modified,
    })),
  };
}

async function main() {
  if (existsSync(resolve(SNAPSHOT_PATH))) {
    throw new Error(`${SNAPSHOT_PATH} already exists; evidence snapshots are immutable.`);
  }
  const retrievedAt = new Date().toISOString();
  const records = [];
  for (const source of SOURCES) {
    const raw = await fetchImmutable({ ...source, accept: 'application/json' });
    records.push(normalizeRecord(source, raw));
  }
  const documents = [];
  for (const document of DOCUMENTS) {
    const raw = await fetchImmutable(document);
    documents.push({
      id: document.id,
      title: document.title,
      url: document.url,
      rawPath: document.rawPath,
      rawResponseSha256: raw.sha256,
      contentType: raw.contentType,
      documentUpdatedAt: raw.lastModified && Number.isFinite(Date.parse(raw.lastModified))
        ? new Date(raw.lastModified).toISOString().slice(0, 10)
        : null,
      observations: document.observations,
    });
  }
  const snapshot = {
    schemaVersion: 1,
    bundleId: 'melbourne-control-dem-licence-evidence-2026-08-16',
    snapshotKind: 'normalized-official-record',
    retrievedAt: SNAPSHOT_DATE,
    retrievedInstant: retrievedAt,
    legalApproval: false,
    documents,
    records,
    unresolved: [
      'The evidence bundle records official terms and metadata but is not independent legal advice; the named project approval is stored separately.',
      'The linked DEECA spatial-data licensing page was reviewed in a browser but rejected non-browser capture with HTTP 403, so it is context rather than hashed evidence in this bundle.',
      'The DataShare delivery archive, its download-time terms and its internal GeoTIFF metadata must be hashed and verified after the guest order is delivered.',
      'The DEM vertical datum remains unverified until the delivered archive metadata explicitly identifies it or an authoritative written clarification is obtained.',
      'Engineering and product-release approvals remain separate from acquisition and processing approval.',
    ],
  };
  await writeFile(resolve(SNAPSHOT_PATH), `${JSON.stringify(snapshot, null, 2)}\n`);
  const snapshotBytes = Buffer.from(`${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(JSON.stringify({
    snapshotPath: SNAPSHOT_PATH,
    snapshotSha256: hashBytes(snapshotBytes),
    rawRoot: RAW_ROOT,
    recordCount: records.length,
    documentCount: documents.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
