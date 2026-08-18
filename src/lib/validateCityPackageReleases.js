import { canPublishCityLayer } from './validateCityDataLedger.js';
import { wgs84ToLocalEnu } from '../city/projection.ts';
import {
  validateCityLandmarkAssetAdmission,
  validateCityLandmarkAssetReferences,
} from './validateCityLandmarkAssets.js';
import {
  canPublishCityPackage,
  validateCityPackageManifest,
  validateCityPackageRegistry,
} from './validateCityPackages.js';

const CITY_IDS = Object.freeze(['shanghai', 'melbourne', 'hong-kong']);
const object = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const CAMERA_HORIZONTAL_TOLERANCE_METRES = 0.05;

function validateCanonicalViews(manifest, cityContract, field, errors) {
  const views = manifest?.canonicalViews;
  const cameras = cityContract?.canonicalCameras;
  if (!Array.isArray(views) || !Array.isArray(cameras)) {
    errors.push(`${field}: canonical view contract is missing`);
    return;
  }
  const expectedIds = cameras.map(({ id }) => id);
  if (views.map(({ id } = {}) => id).join(',') !== expectedIds.join(',')) {
    errors.push(`${field}: canonical views do not match the frozen camera order`);
    return;
  }
  const anchor = manifest.precinct?.anchorWgs84;
  const frozenOrigin = cityContract.coordinateFrame?.originWgs84;
  const packageBounds = manifest.precinct?.boundsWgs84;
  const frozenBounds = cityContract.precinct?.boundsWgs84;
  if (
    !object(packageBounds)
    || !object(frozenBounds)
    || ['west', 'south', 'east', 'north'].some((key) => (
      Math.abs(packageBounds[key] - frozenBounds[key]) > 1e-9
    ))
  ) {
    errors.push(`${field}: package bounds do not match the frozen city AOI`);
  }
  if (
    !object(anchor)
    || !object(frozenOrigin)
    || Math.abs(anchor.longitude - frozenOrigin.longitude) > 1e-9
    || Math.abs(anchor.latitude - frozenOrigin.latitude) > 1e-9
  ) {
    errors.push(`${field}: package anchor does not match the frozen city origin`);
    return;
  }
  for (const [index, camera] of cameras.entries()) {
    const view = views[index];
    if (
      view.labels?.en !== camera.labels?.en
      || view.labels?.zh !== camera.labels?.zh
    ) errors.push(`${field}.${camera.id}: bilingual labels do not match camera contract`);
    const positionEnu = wgs84ToLocalEnu(camera.positionWgs84, anchor);
    const targetEnu = wgs84ToLocalEnu(camera.targetWgs84, anchor);
    const expected = {
      positionX: positionEnu.east,
      positionZ: -positionEnu.north,
      targetX: targetEnu.east,
      targetZ: -targetEnu.north,
    };
    const actual = {
      positionX: view.positionLocal?.x,
      positionZ: view.positionLocal?.z,
      targetX: view.targetLocal?.x,
      targetZ: view.targetLocal?.z,
    };
    if (Object.keys(expected).some((key) => (
      !Number.isFinite(actual[key])
      || Math.abs(actual[key] - expected[key]) > CAMERA_HORIZONTAL_TOLERANCE_METRES
    ))) errors.push(`${field}.${camera.id}: horizontal ENU pose does not match WGS84 camera contract`);
    if (view.verticalFovDegrees !== camera.verticalFovDegrees) {
      errors.push(`${field}.${camera.id}: vertical FOV does not match camera contract`);
    }
  }
}

export function validateCityPackageReleaseReferences(
  registry,
  packagesByPath,
  ledger,
  realityContracts = null,
  releaseArtifactsByUri = {},
) {
  const errors = [];
  if (!validateCityPackageRegistry(registry).ok) return { ok: false, errors: ['registry: invalid'] };
  if (!object(packagesByPath)) return { ok: false, errors: ['packagesByPath: must be an object'] };
  const ledgerCities = new Map((ledger?.cities || []).map((city) => [city.id, city]));
  const realityCities = new Map((realityContracts?.cities || []).map((city) => [city.id, city]));

  for (const cityId of CITY_IDS) {
    const reference = registry.productionPackages[cityId];
    if (reference === null) continue;
    const entry = packagesByPath[reference.manifestPath];
    const field = `productionPackages.${cityId}`;
    if (!object(entry)) {
      errors.push(`${field}.manifestPath: missing ${reference.manifestPath}`);
      continue;
    }
    if (entry.sha256 !== reference.manifestSha256) errors.push(`${field}.manifestSha256: does not match manifest bytes`);
    const manifest = entry.data;
    if (!validateCityPackageManifest(manifest).ok) errors.push(`${field}: manifest schema is invalid`);
    if (!canPublishCityPackage(manifest)) errors.push(`${field}: package is not production-approved`);
    if (manifest?.packageId !== reference.packageId) errors.push(`${field}.packageId: does not match manifest`);
    if (manifest?.cityId !== cityId) errors.push(`${field}: manifest belongs to ${manifest?.cityId || 'unknown'}`);

    const cityContract = realityCities.get(cityId);
    const landmarkReference = manifest?.landmarkAssets;
    const landmarkEntry = landmarkReference && releaseArtifactsByUri?.[landmarkReference.admissionUri];
    if (!cityContract) {
      errors.push(`${field}: frozen city reality contract is missing`);
    } else if (!object(landmarkReference)) {
      errors.push(`${field}: landmark asset admission reference is missing`);
    } else if (!object(landmarkEntry)) {
      errors.push(`${field}: landmark admission artifact is missing`);
    } else {
      if (landmarkEntry.sha256 !== landmarkReference.sha256) {
        errors.push(`${field}: landmark admission SHA-256 does not match manifest`);
      }
      if (landmarkEntry.byteLength !== landmarkReference.byteLength) {
        errors.push(`${field}: landmark admission byte length does not match manifest`);
      }
      if (landmarkEntry.data?.packageId !== manifest.packageId) {
        errors.push(`${field}: landmark admission belongs to another package`);
      }
      const admission = validateCityLandmarkAssetAdmission(landmarkEntry.data, cityContract);
      if (!admission.ok) {
        errors.push(`${field}: landmark admission manifest is invalid`);
      } else {
        const references = validateCityLandmarkAssetReferences(
          landmarkEntry.data,
          cityContract,
          releaseArtifactsByUri,
        );
        if (!references.ok) errors.push(`${field}: landmark admission assets are invalid`);
      }
    }
    if (cityContract) validateCanonicalViews(manifest, cityContract, field, errors);

    const ledgerCity = ledgerCities.get(cityId);
    for (const source of manifest?.sourceLayers || []) {
      const ledgerLayer = ledgerCity?.layers?.find(({ id }) => id === source.ledgerLayerId);
      if (!ledgerLayer) {
        errors.push(`${field}: ledger layer ${source.ledgerLayerId} is missing`);
      } else if (!canPublishCityLayer(ledgerCity, ledgerLayer)) {
        errors.push(`${field}: ledger layer ${source.ledgerLayerId} is not production-approved`);
      } else if (ledgerLayer.sourceArtifactSha256 !== source.sourceArtifactSha256) {
        errors.push(`${field}: source hash for ${source.ledgerLayerId} does not match the ledger`);
      } else if (ledgerLayer.licence.snapshotSha256 !== source.licenceSnapshotSha256) {
        errors.push(`${field}: licence hash for ${source.ledgerLayerId} does not match the ledger`);
      } else if (
        ledgerLayer.datasetId !== source.datasetId
        || ledgerLayer.datasetVersion !== source.datasetVersion
      ) {
        errors.push(`${field}: dataset identity for ${source.ledgerLayerId} does not match the ledger`);
      } else if (ledgerLayer.spatial.horizontalCrs !== source.sourceCrs.identifier) {
        errors.push(`${field}: source CRS for ${source.ledgerLayerId} does not match the ledger`);
      } else if (
        source.verticalDatum.status === 'declared'
        && ledgerLayer.spatial.verticalDatum !== source.verticalDatum.name
      ) {
        errors.push(`${field}: vertical datum for ${source.ledgerLayerId} does not match the ledger`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
