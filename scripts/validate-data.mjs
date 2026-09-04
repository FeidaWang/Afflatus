#!/usr/bin/env node
/* validate-data.mjs — single CI entry point that runs every data file's
 * validator in one pass (U21 Phase 1, rfcs/2026-07-12-u21-phase1-tech-audit.md
 * §2.7). Each file already has (or now has) a per-file validator in src/lib/
 * following the pattern established by validateSignalEvents.js/
 * validateSectorsData.js — this script just aggregates them for
 * .github/workflows/ci.yml. The unified publisher and settlement scripts call
 * the same validators before replacing any production artifact; this entry
 * point provides an independent full-repository check in CI.
 *
 * Exits 0 if every checked file is valid or absent (a file that doesn't
 * exist yet — e.g. before a scheduled task's first run — is not a failure).
 * Exits 1 and prints every problem if any present file is invalid. */
import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { validateSectorsData } from '../src/lib/validateSectorsData.js';
import { validateSectorsCompetition } from '../src/lib/validateSectorsCompetition.js';
import { validateSectorsRivalry } from '../src/lib/validateSectorsRivalry.js';
import { validateSignalEvents } from '../src/lib/validateSignalEvents.js';
import { validateLeaguesData } from '../src/lib/validateLeaguesData.js';
import { validateGamesData } from '../src/lib/validateGamesData.js';
import { validateNovelsIndex, validateNovelBook } from '../src/lib/validateNovelsData.js';
import { validateArenaUniverse, validateArenaUniverseArchive } from '../src/lib/validateArenaUniverse.js';
import { validateArenaPicks } from '../src/lib/validateArenaPicks.js';
import { validateArenaQuantModel } from '../src/lib/validateArenaQuantModel.js';
import { validateArenaRunlog } from '../src/lib/validateArenaRunlog.js';
import { validateArenaDigest } from '../src/lib/validateArenaDigest.js';
import { validateArenaNews } from '../src/lib/validateArenaNews.js';
import { validateArenaLedger, validateArenaLedgerArchive } from '../src/lib/validateArenaLedger.js';
import { validateArenaPredlog } from '../src/lib/validateArenaPredlog.js';
import { validateDailyTransits } from '../src/lib/validateDailyTransits.js';
import { validateSectorsEcosystem } from '../src/lib/validateSectorsEcosystem.js';
import {
  validateAudioPlaylist,
  validateNyseCalendar,
  validateSignalReleaseDates,
} from '../src/lib/validateStaticPublicData.js';
import {
  validateCityDataLedger,
  validateCityLedgerEvidenceReferences,
  validateCityLicenceEvidenceBundle,
} from '../src/lib/validateCityDataLedger.js';
import {
  canPublishCityPackage,
  validateCityPackageAssetReferences,
  validateCityPackageManifest,
  validateCityPackageRegistry,
} from '../src/lib/validateCityPackages.js';
import { validateCityPackageReleaseReferences } from '../src/lib/validateCityPackageReleases.js';
import {
  validateCityCrossLayerQaReport,
  validateCityGeometryQaReport,
  validateCityRawInventory,
} from '../src/lib/validateCityPipeline.js';
import { validateCityRealityContracts } from '../src/lib/validateCityRealityContracts.js';

const CITY_LEDGER_PATH = 'data/city/city-data-ledger.json';
const CITY_PACKAGE_REGISTRY_PATH = 'data/city/city-package-registry.json';
const CITY_REALITY_CONTRACTS_PATH = 'data/city/city-reality-contracts.json';
const MELBOURNE_CANDIDATE_PACKAGE_PATH = 'data/city/candidates/melbourne-flinders-federation-v1/manifest.json';
const CITY_CROSS_LAYER_QA_PATH = 'data/city/qa/melbourne-flinders-federation-cross-layer-v1.json';
const CITY_PIPELINES = [
  {
    label: 'Melbourne building',
    inventoryPath: 'data/city/inventory/melbourne-buildings-flinders-federation-v1.json',
    qaPath: 'data/city/qa/melbourne-buildings-flinders-federation-v1.json',
    fixturePath: 'tests/fixtures/city/melbourne-buildings-golden-v1.json',
  },
  {
    label: 'Melbourne road',
    inventoryPath: 'data/city/inventory/melbourne-roads-flinders-federation-v1.json',
    qaPath: 'data/city/qa/melbourne-roads-flinders-federation-v1.json',
    fixturePath: 'tests/fixtures/city/melbourne-roads-golden-v1.json',
  },
  {
    label: 'Melbourne pedestrian',
    inventoryPath: 'data/city/inventory/melbourne-pedestrian-network-complete-v1.json',
    qaPath: 'data/city/qa/melbourne-pedestrian-network-complete-v1.json',
    fixturePath: 'tests/fixtures/city/melbourne-pedestrian-golden-v1.json',
  },
  {
    label: 'Melbourne Hydro',
    inventoryPath: 'data/city/inventory/melbourne-hydro-flinders-federation-v1.json',
    qaPath: 'data/city/qa/melbourne-hydro-flinders-federation-v1.json',
    fixturePath: 'tests/fixtures/city/melbourne-hydro-golden-v1.json',
  },
  {
    label: 'Melbourne tree',
    inventoryPath: 'data/city/inventory/melbourne-trees-flinders-federation-v1.json',
    qaPath: 'data/city/qa/melbourne-trees-flinders-federation-v1.json',
    fixturePath: 'tests/fixtures/city/melbourne-trees-golden-v1.json',
  },
  {
    label: 'Melbourne survey control',
    inventoryPath: 'data/city/inventory/melbourne-survey-control-flinders-federation-v1.json',
    qaPath: 'data/city/qa/melbourne-survey-control-flinders-federation-v1.json',
    fixturePath: 'tests/fixtures/city/melbourne-survey-control-golden-v1.json',
  },
  {
    label: 'Melbourne DEM 10m',
    inventoryPath: 'data/city/inventory/melbourne-dem10m-vicgrid94-2021.json',
    qaPath: 'data/city/qa/melbourne-dem10m-flinders-federation-v1.json',
    fixturePath: 'tests/fixtures/city/melbourne-dem10m-golden-v1.json',
  },
];
const CITY_EVIDENCE_PATHS = [
  'data/city/melbourne-p0-licence-evidence-2026-08-15.json',
  'data/city/melbourne-control-dem-licence-evidence-2026-08-16.json',
];

function sha256FileSync(path) {
  const hash = createHash('sha256');
  const descriptor = openSync(path, 'r');
  const buffer = Buffer.allocUnsafe(8 * 1024 * 1024);
  try {
    for (let bytesRead = readSync(descriptor, buffer, 0, buffer.length, null); bytesRead > 0;) {
      hash.update(buffer.subarray(0, bytesRead));
      bytesRead = readSync(descriptor, buffer, 0, buffer.length, null);
    }
  } finally {
    closeSync(descriptor);
  }
  return hash.digest('hex');
}

const CHECKS = [
  { path: 'public/sectors-data.json', validate: validateSectorsData },
  { path: 'public/sectors-competition.json', validate: validateSectorsCompetition },
  { path: 'public/sectors-rivalry.json', validate: validateSectorsRivalry },
  { path: 'public/sectors-ecosystem.json', validate: validateSectorsEcosystem },
  { path: 'public/signal-events.json', validate: validateSignalEvents },
  { path: 'public/leagues-data.json', validate: validateLeaguesData },
  { path: 'public/games-data.json', validate: validateGamesData },
  { path: 'public/novels-index.json', validate: validateNovelsIndex },
  // Live and immutable archive artifacts have distinct schemas, but both are
  // public contracts and therefore both remain checked.
  { path: 'public/arena-universe.json', validate: validateArenaUniverse },
  { path: 'public/arena-universe-s1.json', validate: validateArenaUniverseArchive },
  { path: 'public/arena-picks.json', validate: validateArenaPicks },
  { path: 'public/arena-quant-model.json', validate: validateArenaQuantModel },
  { path: 'public/arena-runlog.json', validate: validateArenaRunlog },
  { path: 'public/arena-daily-digest.json', validate: validateArenaDigest },
  { path: 'public/arena-news.json', validate: validateArenaNews },
  { path: 'public/arena-ledger.json', validate: validateArenaLedger },
  { path: 'public/arena-ledger-s1.json', validate: validateArenaLedgerArchive },
  { path: 'public/arena-predlog.json', validate: validateArenaPredlog },
  { path: 'public/transits-daily.json', validate: validateDailyTransits },
  { path: 'public/audio/playlist.json', validate: validateAudioPlaylist },
  { path: 'public/nyse-holidays-2026.json', validate: validateNyseCalendar },
  { path: 'public/signal-release-dates-2026.json', validate: validateSignalReleaseDates },
  { path: CITY_LEDGER_PATH, validate: validateCityDataLedger },
  { path: CITY_PACKAGE_REGISTRY_PATH, validate: validateCityPackageRegistry },
  { path: CITY_REALITY_CONTRACTS_PATH, validate: validateCityRealityContracts },
  { path: MELBOURNE_CANDIDATE_PACKAGE_PATH, validate: validateCityPackageManifest },
  ...CITY_PIPELINES.flatMap(({ inventoryPath, qaPath }) => [
    { path: inventoryPath, validate: validateCityRawInventory },
    { path: qaPath, validate: validateCityGeometryQaReport },
  ]),
  { path: CITY_CROSS_LAYER_QA_PATH, validate: validateCityCrossLayerQaReport },
  ...CITY_EVIDENCE_PATHS.map((path) => ({ path, validate: validateCityLicenceEvidenceBundle })),
];

let anyFail = false;
let checked = 0;
const registeredPaths = new Set(CHECKS.map(({ path }) => path));

for (const { path, validate } of CHECKS) {
  if (!existsSync(path)) { console.log(`SKIP: ${path} does not exist yet`); continue; }
  let data;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    console.error(`FAIL: ${path} is not valid JSON — ${e.message}`);
    anyFail = true; checked++;
    continue;
  }
  const { ok, errors } = validate(data);
  checked++;
  if (!ok) {
    console.error(`FAIL: ${path} (${errors.length} problem${errors.length === 1 ? '' : 's'}):`);
    for (const e of errors) console.error(`  - ${e}`);
    anyFail = true;
  } else {
    console.log(`OK: ${path}`);
  }
}

// Candidate package bytes remain outside public/ and outside the production
// registry, but their logical release URIs, hashes, tile grid and LOD payloads
// are validated exactly as staged. Product release remains a separate gate.
if (existsSync(MELBOURNE_CANDIDATE_PACKAGE_PATH)) {
  try {
    const manifest = JSON.parse(readFileSync(MELBOURNE_CANDIDATE_PACKAGE_PATH, 'utf8'));
    const packageDirectory = MELBOURNE_CANDIDATE_PACKAGE_PATH.replace(/\/manifest\.json$/, '');
    const assetsByUri = Object.fromEntries(manifest.assets.map((asset) => {
      const filename = asset.uri.split('/').at(-1);
      const path = join(packageDirectory, filename);
      if (!existsSync(path)) return [asset.uri, null];
      const bytes = readFileSync(path);
      let data = null;
      try { data = JSON.parse(bytes.toString('utf8')); } catch { data = null; }
      return [asset.uri, {
        sha256: createHash('sha256').update(bytes).digest('hex'),
        byteLength: bytes.length,
        bytes,
        data,
      }];
    }));
    const result = validateCityPackageAssetReferences(manifest, assetsByUri);
    const errors = [...result.errors];
    const ledger = JSON.parse(readFileSync(CITY_LEDGER_PATH, 'utf8'));
    const registry = JSON.parse(readFileSync(CITY_PACKAGE_REGISTRY_PATH, 'utf8'));
    const crossLayerQa = JSON.parse(readFileSync(CITY_CROSS_LAYER_QA_PATH, 'utf8'));
    const city = ledger.cities.find(({ id }) => id === manifest.cityId);
    if (
      city?.precinct?.status !== 'frozen'
      || city?.precinct?.tileInventoryStatus !== 'frozen'
      || JSON.stringify(city?.precinct?.candidateBoundsWgs84) !== JSON.stringify(manifest.precinct.boundsWgs84)
    ) errors.push('candidate precinct does not match the frozen ledger precinct');
    const expectedLayerIds = crossLayerQa.sourceLayers.map(({ layerId }) => layerId);
    if (manifest.sourceLayers.map(({ ledgerLayerId }) => ledgerLayerId).join(',') !== expectedLayerIds.join(',')) {
      errors.push('candidate source layers do not match cross-layer QA');
    }
    for (const source of manifest.sourceLayers) {
      const layer = city?.layers?.find(({ id }) => id === source.ledgerLayerId);
      if (!layer) {
        errors.push(`${source.ledgerLayerId}: missing from city ledger`);
        continue;
      }
      if (
        layer.datasetId !== source.datasetId
        || layer.datasetVersion !== source.datasetVersion
        || layer.sourceArtifactSha256 !== source.sourceArtifactSha256
        || layer.licence.snapshotSha256 !== source.licenceSnapshotSha256
        || layer.spatial.horizontalCrs !== source.sourceCrs.identifier
      ) errors.push(`${source.ledgerLayerId}: candidate provenance does not match city ledger`);
      if (
        source.verticalDatum.status === 'declared'
        && layer.spatial.verticalDatum !== source.verticalDatum.name
      ) errors.push(`${source.ledgerLayerId}: candidate vertical datum does not match city ledger`);
    }
    if (canPublishCityPackage(manifest)) errors.push('candidate package must not be publishable');
    if (manifest.status !== 'candidate') errors.push('candidate package status must remain candidate');
    if (registry.productionPackages.melbourne !== null) {
      errors.push('production registry must not reference the Melbourne candidate');
    }
    checked++;
    if (errors.length > 0) {
      console.error(`FAIL: Melbourne candidate package assets (${errors.length} problem${errors.length === 1 ? '' : 's'}):`);
      errors.forEach((error) => console.error(`  - ${error}`));
      anyFail = true;
    } else {
      console.log('OK: Melbourne candidate package assets');
    }
  } catch (error) {
    console.error(`FAIL: could not validate Melbourne candidate package assets — ${error.message}`);
    anyFail = true;
  }
}

// The ledger stores immutable evidence hashes and record ids. Validate those
// references against the bytes on disk so editing or replacing an evidence
// bundle cannot silently preserve an earlier approval trail.
if (existsSync(CITY_LEDGER_PATH)) {
  try {
    const ledger = JSON.parse(readFileSync(CITY_LEDGER_PATH, 'utf8'));
    const evidenceByPath = Object.fromEntries(CITY_EVIDENCE_PATHS
      .filter((path) => existsSync(path))
      .map((path) => {
        const bytes = readFileSync(path);
        return [path, {
          sha256: createHash('sha256').update(bytes).digest('hex'),
          data: JSON.parse(bytes.toString('utf8')),
        }];
      }));
    const { ok, errors } = validateCityLedgerEvidenceReferences(ledger, evidenceByPath);
    checked++;
    if (!ok) {
      console.error(`FAIL: city evidence references (${errors.length} problem${errors.length === 1 ? '' : 's'}):`);
      errors.forEach((error) => console.error(`  - ${error}`));
      anyFail = true;
    } else {
      console.log('OK: city evidence references');
    }
  } catch (error) {
    console.error(`FAIL: could not cross-check city evidence references — ${error.message}`);
    anyFail = true;
  }
}

// A production CityPackage reference is publishable only when its immutable
// manifest, the package approvals and every referenced ledger layer all pass.
// The empty registry is intentional while the three cities remain concepts.
if (
  existsSync(CITY_PACKAGE_REGISTRY_PATH)
  && existsSync(CITY_LEDGER_PATH)
  && existsSync(CITY_REALITY_CONTRACTS_PATH)
) {
  try {
    const registry = JSON.parse(readFileSync(CITY_PACKAGE_REGISTRY_PATH, 'utf8'));
    const ledger = JSON.parse(readFileSync(CITY_LEDGER_PATH, 'utf8'));
    const realityContracts = JSON.parse(readFileSync(CITY_REALITY_CONTRACTS_PATH, 'utf8'));
    const manifestPaths = Object.values(registry.productionPackages || {})
      .filter(Boolean)
      .map(({ manifestPath }) => manifestPath);
    manifestPaths.forEach((path) => registeredPaths.add(path));
    const packagesByPath = Object.fromEntries(manifestPaths
      .filter((path) => existsSync(path))
      .map((path) => {
        const bytes = readFileSync(path);
        return [path, {
          sha256: createHash('sha256').update(bytes).digest('hex'),
          data: JSON.parse(bytes.toString('utf8')),
        }];
      }));
    const releaseArtifactsByUri = {};
    for (const { data: manifest } of Object.values(packagesByPath)) {
      const admissionUri = manifest?.landmarkAssets?.admissionUri;
      if (typeof admissionUri !== 'string') continue;
      const admissionPath = `public${admissionUri}`;
      registeredPaths.add(admissionPath);
      if (!existsSync(admissionPath)) continue;
      const admissionBytes = readFileSync(admissionPath);
      let admissionData = null;
      try { admissionData = JSON.parse(admissionBytes.toString('utf8')); } catch { admissionData = null; }
      releaseArtifactsByUri[admissionUri] = {
        sha256: createHash('sha256').update(admissionBytes).digest('hex'),
        byteLength: admissionBytes.length,
        bytes: admissionBytes,
        data: admissionData,
      };
      const assetUris = [
        ...(admissionData?.assets || []).flatMap((asset) => (asset?.lods || []).map(({ uri }) => uri)),
        ...(admissionData?.nightGoldens || []).map(({ uri }) => uri),
        ...(admissionData?.silhouetteMasks || []).map(({ uri }) => uri),
        ...(admissionData?.performanceTraces || []).map(({ uri }) => uri),
      ].filter((uri) => typeof uri === 'string');
      for (const uri of assetUris) {
        const path = `public${uri}`;
        registeredPaths.add(path);
        if (!existsSync(path)) continue;
        const bytes = readFileSync(path);
        releaseArtifactsByUri[uri] = { bytes };
      }
    }
    const { ok, errors } = validateCityPackageReleaseReferences(
      registry,
      packagesByPath,
      ledger,
      realityContracts,
      releaseArtifactsByUri,
    );
    checked++;
    if (!ok) {
      console.error(`FAIL: city package release references (${errors.length} problem${errors.length === 1 ? '' : 's'}):`);
      errors.forEach((error) => console.error(`  - ${error}`));
      anyFail = true;
    } else {
      console.log('OK: city package release references');
    }
  } catch (error) {
    console.error(`FAIL: could not cross-check CityPackage releases — ${error.message}`);
    anyFail = true;
  }
}

// Cross-check every real GIS acquisition trail. Raw bytes stay ignored from
// Git, but when present locally they still match the committed inventories;
// small engineering fixtures are always checked in CI.
for (const pipeline of CITY_PIPELINES) {
  if (!(
    existsSync(CITY_LEDGER_PATH)
    && existsSync(pipeline.inventoryPath)
    && existsSync(pipeline.qaPath)
    && existsSync(pipeline.fixturePath)
  )) continue;
  try {
    const ledger = JSON.parse(readFileSync(CITY_LEDGER_PATH, 'utf8'));
    const inventory = JSON.parse(readFileSync(pipeline.inventoryPath, 'utf8'));
    const qa = JSON.parse(readFileSync(pipeline.qaPath, 'utf8'));
    const fixtureBytes = readFileSync(pipeline.fixturePath);
    const errors = [];
    const layer = ledger.cities
      .find(({ id }) => id === inventory.cityId)?.layers
      .find(({ id }) => id === inventory.layerId);
    if (layer?.sourceArtifactSha256 !== inventory.rawSha256) {
      errors.push('inventory raw SHA-256 does not match the city data ledger');
    }
    if (qa.rawSha256 !== inventory.rawSha256 || qa.artifactId !== inventory.artifactId) {
      errors.push('geometry QA report does not match the raw inventory');
    }
    if (createHash('sha256').update(fixtureBytes).digest('hex') !== qa.goldenFixtureSha256) {
      errors.push('golden fixture SHA-256 does not match the geometry QA report');
    }
    if (existsSync(inventory.rawPath)) {
      const rawByteLength = statSync(inventory.rawPath).size;
      if (
        rawByteLength !== inventory.rawByteLength
        || sha256FileSync(inventory.rawPath) !== inventory.rawSha256
      ) errors.push('local raw GIS bytes do not match the immutable inventory');
    }
    if (inventory.responseHeadersPath && existsSync(inventory.responseHeadersPath)) {
      const headerBytes = readFileSync(inventory.responseHeadersPath);
      if (createHash('sha256').update(headerBytes).digest('hex') !== inventory.responseHeadersSha256) {
        errors.push('local HTTP response headers do not match the immutable inventory');
      }
    }
    if (inventory.verificationArchive?.rawPath && existsSync(inventory.verificationArchive.rawPath)) {
      const verification = inventory.verificationArchive;
      if (
        statSync(verification.rawPath).size !== verification.rawByteLength
        || sha256FileSync(verification.rawPath) !== verification.rawSha256
      ) errors.push('local verification archive does not match the immutable inventory');
    }
    if (inventory.sourceStrategyEvidence && !existsSync(inventory.sourceStrategyEvidence)) {
      errors.push('source strategy evidence does not exist');
    }
    checked++;
    if (errors.length > 0) {
      console.error(`FAIL: ${pipeline.label} pipeline references (${errors.length} problem${errors.length === 1 ? '' : 's'}):`);
      errors.forEach((error) => console.error(`  - ${error}`));
      anyFail = true;
    } else {
      console.log(`OK: ${pipeline.label} pipeline references`);
    }
  } catch (error) {
    console.error(`FAIL: could not cross-check ${pipeline.label} pipeline — ${error.message}`);
    anyFail = true;
  }
}

// Cross-layer evidence is deliberately release-blocking: it proves that the
// Seven independently acquired layers share one frame. Survey control and DEM
// evidence close the horizontal/vertical authority gap while production gates
// remain independently fail-closed in the ledger and package registry.
if (existsSync(CITY_CROSS_LAYER_QA_PATH)) {
  try {
    const report = JSON.parse(readFileSync(CITY_CROSS_LAYER_QA_PATH, 'utf8'));
    const errors = [];
    for (const source of report.sourceLayers || []) {
      if (!existsSync(source.qaPath)) {
        errors.push(`${source.layerId}: referenced QA report is missing`);
        continue;
      }
      const qa = JSON.parse(readFileSync(source.qaPath, 'utf8'));
      if (source.artifactId !== qa.artifactId || source.workSha256 !== qa.workSha256) {
        errors.push(`${source.layerId}: cross-layer source does not match layer QA`);
      }
      if (existsSync(source.workPath)) {
        const workBytes = readFileSync(source.workPath);
        if (createHash('sha256').update(workBytes).digest('hex') !== source.workSha256) {
          errors.push(`${source.layerId}: local work artifact hash does not match cross-layer report`);
        }
      }
    }
    checked++;
    if (errors.length > 0) {
      console.error(`FAIL: Melbourne cross-layer QA references (${errors.length} problems):`);
      errors.forEach((error) => console.error(`  - ${error}`));
      anyFail = true;
    } else {
      console.log('OK: Melbourne cross-layer QA references');
    }
  } catch (error) {
    console.error(`FAIL: could not cross-check Melbourne cross-layer QA — ${error.message}`);
    anyFail = true;
  }
}

// novels/<id>.json chapter files: validate every file the index references,
// rather than hardcoding book ids here.
if (existsSync('public/novels-index.json')) {
  try {
    const idx = JSON.parse(readFileSync('public/novels-index.json', 'utf8'));
    for (const n of idx.novels || []) {
      const p = `public/novels/${n.id}.json`;
      registeredPaths.add(p);
      if (!existsSync(p)) { console.error(`FAIL: ${p} referenced by novels-index.json but missing`); anyFail = true; checked++; continue; }
      const data = JSON.parse(readFileSync(p, 'utf8'));
      const { ok, errors } = validateNovelBook(data);
      if (data.id !== n.id) errors.push(`top-level id ${JSON.stringify(data.id)} does not match index id ${JSON.stringify(n.id)}`);
      if (data.chapters.length !== n.chapterCount) {
        errors.push(`index chapterCount is ${n.chapterCount}, but the published book contains ${data.chapters.length} chapters`);
      }
      checked++;
      if (!ok || errors.length) { console.error(`FAIL: ${p} (${errors.length}):`); errors.forEach((e) => console.error(`  - ${e}`)); anyFail = true; }
      else console.log(`OK: ${p}`);
    }
  } catch (e) {
    console.error(`FAIL: could not cross-check public/novels/*.json against the index — ${e.message}`);
    anyFail = true;
  }
}

// Coverage gate: schema registration must grow in the same change as any new
// public JSON. Referenced novel books are registered dynamically above; an
// orphan book is intentionally reported here too.
function listJsonFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listJsonFiles(path));
    else if (entry.isFile() && entry.name.endsWith('.json')) files.push(path);
  }
  return files;
}
for (const path of listJsonFiles('public')) {
  if (!registeredPaths.has(path)) {
    console.error(`FAIL: ${path} has no registered schema validator`);
    anyFail = true;
  }
}

console.log(`\n${checked} file(s) checked.`);
process.exit(anyFail ? 1 : 0);
