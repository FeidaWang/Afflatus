import { createHash } from 'node:crypto';

const SHA256_RE = /^[a-f0-9]{64}$/;
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOCAL_GLB_RE = /^\/assets\/city\/packages\/[a-z0-9-/]+\.glb$/;
const LOCAL_GOLDEN_RE = /^\/assets\/city\/packages\/[a-z0-9-/]+\.(?:png|webp)$/;
const LOCAL_TRACE_RE = /^\/assets\/city\/packages\/[a-z0-9-/]+\.json$/;
const REQUIRED_RIGHTS = Object.freeze(['mesh', 'textures', 'signage']);
const PERFORMANCE_TRACE_MINIMUM_DURATION_MS = 30 * 60 * 1_000;
const MAX_ACTIVE_GPU_BYTES = Object.freeze({
  desktop: 220 * 1024 * 1024,
  mobile: 140 * 1024 * 1024,
});
const RENDER_BUDGETS = Object.freeze({
  desktop: Object.freeze({ drawCalls: 120, triangles: 350_000, p95Ms: 18 }),
  mobile: Object.freeze({ drawCalls: 70, triangles: 120_000, p95Ms: 34 }),
});

const object = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const validSha = (value) => typeof value === 'string' && SHA256_RE.test(value);

function sameArray(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function cameraPlatformPairs(cityContract) {
  const pairs = [];
  for (const cameraId of cityContract.landmarkAssetContract?.nightGoldenCameraIds || []) {
    for (const platform of cityContract.landmarkAssetContract?.nightGoldenPlatforms || []) {
      pairs.push(`${cameraId}:${platform}`);
    }
  }
  return pairs;
}

function validateArtifactReference(artifact, {
  field,
  packageId,
  uriPattern,
  kind,
}, errors) {
  if (!validSha(artifact?.sha256)) errors.push(`${field}.sha256: must be SHA-256`);
  if (!uriPattern.test(String(artifact?.uri || ''))) {
    errors.push(`${field}.uri: must be a local ${kind}`);
  } else if (!artifact.uri.startsWith(`/assets/city/packages/${packageId}/`)) {
    errors.push(`${field}.uri: must remain inside package ${packageId}`);
  }
  if (!Number.isSafeInteger(artifact?.byteLength) || artifact.byteLength <= 0) {
    errors.push(`${field}.byteLength: must be positive`);
  }
}

function validateAnchor(anchor, bounds, field, errors) {
  if (!object(anchor)) {
    errors.push(`${field}: must be an object`);
    return;
  }
  if (!Number.isFinite(anchor.longitude) || !Number.isFinite(anchor.latitude)) {
    errors.push(`${field}: longitude and latitude must be finite`);
  } else if (
    object(bounds)
    && (anchor.longitude < bounds.west || anchor.longitude > bounds.east
      || anchor.latitude < bounds.south || anchor.latitude > bounds.north)
  ) {
    errors.push(`${field}: must remain inside the frozen AOI`);
  }
  if (!Number.isFinite(anchor.yawDegrees)) errors.push(`${field}.yawDegrees: must be finite`);
  if (anchor.metresPerUnit !== 1) errors.push(`${field}.metresPerUnit: must be 1`);
  if (anchor.localFrame !== 'ENU' || anchor.upAxis !== 'Y') {
    errors.push(`${field}: localFrame ENU and upAxis Y are required`);
  }
  if (!text(anchor.groundReference)) errors.push(`${field}.groundReference: must be explicit`);
}

function validateAsset(asset, landmark, cityContract, packageId, index, errors) {
  const field = `assets[${index}]`;
  if (!object(asset)) {
    errors.push(`${field}: must be an object`);
    return;
  }
  if (asset.landmarkId !== landmark.id) {
    errors.push(`${field}.landmarkId: must be ${landmark.id}`);
  }
  const expectedSourceKind = landmark.assetClass === 'terrain-hero'
    ? 'approved-terrain-source'
    : 'authored-original';
  if (asset.sourceKind !== expectedSourceKind) {
    errors.push(`${field}.sourceKind: must be ${expectedSourceKind}`);
  }
  validateAnchor(asset.anchor, cityContract.precinct?.boundsWgs84, `${field}.anchor`, errors);

  if (!Array.isArray(asset.lods) || !sameArray(asset.lods.map((lod) => lod?.level), [0, 1, 2])) {
    errors.push(`${field}.lods: must contain ordered LOD0, LOD1 and LOD2`);
  } else {
    for (const [lodIndex, lod] of asset.lods.entries()) {
      const lodField = `${field}.lods[${lodIndex}]`;
      if (!LOCAL_GLB_RE.test(String(lod.uri || ''))) {
        errors.push(`${lodField}.uri: must be a local immutable CityPackage GLB`);
      } else if (!lod.uri.startsWith(`/assets/city/packages/${packageId}/`)) {
        errors.push(`${lodField}.uri: must remain inside package ${packageId}`);
      }
      if (!validSha(lod.sha256)) errors.push(`${lodField}.sha256: must be SHA-256`);
      if (!Number.isSafeInteger(lod.byteLength) || lod.byteLength <= 0) {
        errors.push(`${lodField}.byteLength: must be positive`);
      }
    }
  }

  if (asset.wholeEnvelopeEmission !== false) {
    errors.push(`${field}.wholeEnvelopeEmission: must be false`);
  }
  const requiredGroups = cityContract.landmarkAssetContract
    ?.requiredMaterialGroupsByLandmark?.[landmark.id] || [];
  if (!Array.isArray(asset.lightMaterialGroups)) {
    errors.push(`${field}.lightMaterialGroups: must be an array`);
  } else {
    const names = asset.lightMaterialGroups.map((group) => group?.name);
    for (const required of requiredGroups) {
      if (!names.includes(required)) errors.push(`${field}.lightMaterialGroups: missing ${required}`);
    }
    const seen = new Set();
    for (const [groupIndex, group] of asset.lightMaterialGroups.entries()) {
      const groupField = `${field}.lightMaterialGroups[${groupIndex}]`;
      if (!object(group) || typeof group.name !== 'string' || !ID_RE.test(group.name)) {
        errors.push(`${groupField}.name: invalid material group`);
        continue;
      }
      const prefixes = cityContract.landmarkAssetContract?.allowedLightMaterialPrefixes || [];
      if (!prefixes.some((prefix) => group.name.startsWith(prefix))) {
        errors.push(`${groupField}.name: unknown authored light prefix`);
      }
      if (seen.has(group.name)) errors.push(`${groupField}.name: duplicate ${group.name}`);
      seen.add(group.name);
      if (!sameArray(group.lods, cityContract.landmarkAssetContract?.requiredLightLods)) {
        errors.push(`${groupField}.lods: must cover required light LODs`);
      }
      if (group.emitsWholeEnvelope !== false) {
        errors.push(`${groupField}.emitsWholeEnvelope: must be false`);
      }
    }
  }

  if (!object(asset.rights)) {
    errors.push(`${field}.rights: must be an object`);
  } else {
    for (const right of REQUIRED_RIGHTS) {
      if (asset.rights[right] !== 'approved') errors.push(`${field}.rights.${right}: must be approved`);
    }
    if (!Array.isArray(asset.rights.evidence) || asset.rights.evidence.length === 0
      || asset.rights.evidence.some((entry) => !text(entry))) {
      errors.push(`${field}.rights.evidence: non-empty evidence is required`);
    }
  }
}

export function validateCityLandmarkAssetAdmission(data, cityContract) {
  const errors = [];
  if (!object(data)) return { ok: false, errors: ['top-level: must be an object'] };
  if (!object(cityContract)) return { ok: false, errors: ['cityContract: must be an object'] };
  if (data.schemaVersion !== 2) errors.push('schemaVersion: must be 2');
  if (!ID_RE.test(String(data.packageId || ''))) errors.push('packageId: invalid id');
  if (data.cityId !== cityContract.id) errors.push(`cityId: must be ${cityContract.id}`);
  if (data.truthClass !== 'rights-cleared-city-landmark-set') {
    errors.push('truthClass: must be rights-cleared-city-landmark-set');
  }

  const landmarks = Array.isArray(cityContract.minimumLandmarks) ? cityContract.minimumLandmarks : [];
  if (!Array.isArray(data.assets) || data.assets.length !== landmarks.length) {
    errors.push('assets: must cover every minimum landmark exactly once and in order');
  } else {
    data.assets.forEach((asset, index) => (
      validateAsset(asset, landmarks[index], cityContract, data.packageId, index, errors)
    ));
  }

  const expectedGoldens = cameraPlatformPairs(cityContract);
  if (!Array.isArray(data.nightGoldens)) {
    errors.push('nightGoldens: must be an array');
  } else {
    const actualGoldens = data.nightGoldens.map((golden) => `${golden?.cameraId}:${golden?.platform}`);
    if (!sameArray(actualGoldens, expectedGoldens)) {
      errors.push('nightGoldens: must cover every canonical camera on desktop and mobile in order');
    }
    for (const [index, golden] of data.nightGoldens.entries()) {
      validateArtifactReference(golden, {
        field: `nightGoldens[${index}]`,
        packageId: data.packageId,
        uriPattern: LOCAL_GOLDEN_RE,
        kind: 'PNG or WebP',
      }, errors);
    }
  }

  if (!Array.isArray(data.silhouetteMasks)) {
    errors.push('silhouetteMasks: must be an array');
  } else {
    const actualMasks = data.silhouetteMasks.map((mask) => `${mask?.cameraId}:${mask?.platform}`);
    if (!sameArray(actualMasks, expectedGoldens)) {
      errors.push('silhouetteMasks: must cover every canonical camera on desktop and mobile in order');
    }
    for (const [index, mask] of data.silhouetteMasks.entries()) {
      validateArtifactReference(mask, {
        field: `silhouetteMasks[${index}]`,
        packageId: data.packageId,
        uriPattern: LOCAL_GOLDEN_RE,
        kind: 'PNG or WebP',
      }, errors);
    }
  }

  const expectedPlatforms = cityContract.landmarkAssetContract?.nightGoldenPlatforms || [];
  if (!Array.isArray(data.performanceTraces)) {
    errors.push('performanceTraces: must be an array');
  } else {
    if (!sameArray(data.performanceTraces.map((trace) => trace?.platform), expectedPlatforms)) {
      errors.push('performanceTraces: must contain ordered desktop and mobile traces');
    }
    for (const [index, trace] of data.performanceTraces.entries()) {
      validateArtifactReference(trace, {
        field: `performanceTraces[${index}]`,
        packageId: data.packageId,
        uriPattern: LOCAL_TRACE_RE,
        kind: 'JSON trace',
      }, errors);
    }
  }
  return { ok: errors.length === 0, errors };
}

function parseGlbJson(bytes, field, errors) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 20) {
    errors.push(`${field}: valid GLB bytes are required`);
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const jsonLength = view.getUint32(12, true);
  const jsonEnd = 20 + jsonLength;
  if (
    view.getUint32(0, true) !== 0x46546c67
    || view.getUint32(4, true) !== 2
    || view.getUint32(8, true) !== bytes.byteLength
    || view.getUint32(16, true) !== 0x4e4f534a
    || jsonEnd > bytes.byteLength
  ) {
    errors.push(`${field}: invalid glTF 2.0 binary header or JSON chunk`);
    return null;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes.subarray(20, jsonEnd)).trim());
  } catch {
    errors.push(`${field}: invalid glTF JSON`);
    return null;
  }
}

function hasEmission(material) {
  return Boolean(material?.emissiveTexture)
    || material?.extras?.wholeEnvelopeEmission === true
    || (Array.isArray(material?.emissiveFactor)
      && material.emissiveFactor.some((value) => Number.isFinite(value) && value > 0));
}

function imageFormat(bytes) {
  const png = bytes.byteLength >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50
    && bytes[2] === 0x4e && bytes[3] === 0x47;
  const webp = bytes.byteLength >= 12
    && new TextDecoder().decode(bytes.subarray(0, 4)) === 'RIFF'
    && new TextDecoder().decode(bytes.subarray(8, 12)) === 'WEBP';
  return png || webp;
}

function validateReferencedBytes(reference, assetsByUri, field, errors) {
  const entry = assetsByUri[reference.uri];
  if (!object(entry) || !(entry.bytes instanceof Uint8Array)) {
    errors.push(`${field}: staged bytes are required`);
    return null;
  }
  const actualSha = createHash('sha256').update(entry.bytes).digest('hex');
  if (actualSha !== reference.sha256) errors.push(`${field}: SHA-256 does not match admission manifest`);
  if (entry.bytes.byteLength !== reference.byteLength) {
    errors.push(`${field}: byte length does not match admission manifest`);
  }
  return entry.bytes;
}

function validatePerformanceTrace(bytes, reference, data, cityContract, field, errors) {
  let trace;
  try {
    trace = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    errors.push(`${field}: bytes are not valid JSON`);
    return;
  }
  if (!object(trace) || trace.schemaVersion !== 1) errors.push(`${field}.schemaVersion: must be 1`);
  if (trace?.packageId !== data.packageId) errors.push(`${field}.packageId: must match admission package`);
  if (trace?.platform !== reference.platform) errors.push(`${field}.platform: must match trace reference`);
  if (!Number.isFinite(trace?.durationMs) || trace.durationMs < PERFORMANCE_TRACE_MINIMUM_DURATION_MS) {
    errors.push(`${field}.durationMs: must cover at least 30 minutes`);
  }
  const cameraIds = cityContract.landmarkAssetContract?.nightGoldenCameraIds || [];
  if (!sameArray(trace?.canonicalCameraIds, cameraIds)) {
    errors.push(`${field}.canonicalCameraIds: must cover every canonical camera in order`);
  }
  const environmentStates = ['day', 'twilight', 'night'];
  if (!sameArray(trace?.environmentStates, environmentStates)) {
    errors.push(`${field}.environmentStates: must be day, twilight, night`);
  }
  if (!Number.isSafeInteger(trace?.longTaskCount) || trace.longTaskCount < 0) {
    errors.push(`${field}.longTaskCount: must be a non-negative integer`);
  }
  if (!Number.isFinite(trace?.longTaskTotalMs) || trace.longTaskTotalMs < 0) {
    errors.push(`${field}.longTaskTotalMs: must be non-negative`);
  }
  if (!Array.isArray(trace?.samples) || trace.samples.length === 0) {
    errors.push(`${field}.samples: non-empty measured samples are required`);
    return;
  }
  const expectedPairs = cameraIds.flatMap((cameraId) => (
    environmentStates.map((environment) => `${cameraId}:${environment}`)
  ));
  const actualPairs = new Set(trace.samples.map((sample) => `${sample?.cameraId}:${sample?.environment}`));
  for (const pair of expectedPairs) {
    if (!actualPairs.has(pair)) errors.push(`${field}.samples: missing ${pair}`);
  }
  const budget = RENDER_BUDGETS[reference.platform];
  if (!budget) {
    errors.push(`${field}.platform: unsupported release platform`);
    return;
  }
  for (const [index, sample] of trace.samples.entries()) {
    const sampleField = `${field}.samples[${index}]`;
    if (!cameraIds.includes(sample?.cameraId)) errors.push(`${sampleField}.cameraId: unknown camera`);
    if (!environmentStates.includes(sample?.environment)) errors.push(`${sampleField}.environment: invalid state`);
    if (sample?.renderer !== 'webgl') errors.push(`${sampleField}.renderer: must remain webgl`);
    if (sample?.budgetWithinLimits !== true) errors.push(`${sampleField}.budgetWithinLimits: must be true`);
    for (const metric of ['drawCalls', 'triangles', 'p95Ms']) {
      if (!Number.isFinite(sample?.[metric]) || sample[metric] < 0 || sample[metric] > budget[metric]) {
        errors.push(`${sampleField}.${metric}: exceeds ${reference.platform} release budget`);
      }
    }
    if (!Number.isFinite(sample?.activeGpuBytes) || sample.activeGpuBytes < 0
      || sample.activeGpuBytes > MAX_ACTIVE_GPU_BYTES[reference.platform]) {
      errors.push(`${sampleField}.activeGpuBytes: exceeds ${reference.platform} release budget`);
    }
    if (!Number.isFinite(sample?.horizontalOverflowPx) || sample.horizontalOverflowPx < 0
      || sample.horizontalOverflowPx > 2) {
      errors.push(`${sampleField}.horizontalOverflowPx: must be between 0 and 2`);
    }
  }
}

export function validateCityLandmarkAssetReferences(data, cityContract, assetsByUri) {
  const admission = validateCityLandmarkAssetAdmission(data, cityContract);
  if (!admission.ok) return { ok: false, errors: ['admission: invalid'] };
  if (!object(assetsByUri)) return { ok: false, errors: ['assetsByUri: must be an object'] };
  const errors = [];
  const allowedPrefixes = cityContract.landmarkAssetContract.allowedLightMaterialPrefixes;

  for (const asset of data.assets) {
    const declaredGroups = new Map(asset.lightMaterialGroups.map((group) => [group.name, group]));
    for (const lod of asset.lods) {
      const field = `${asset.landmarkId}.lod${lod.level}`;
      const entry = assetsByUri[lod.uri];
      if (!object(entry)) {
        errors.push(`${field}: staged GLB is missing`);
        continue;
      }
      if (!(entry.bytes instanceof Uint8Array)) {
        errors.push(`${field}: staged GLB bytes are required`);
        continue;
      }
      const actualSha = createHash('sha256').update(entry.bytes).digest('hex');
      if (actualSha !== lod.sha256) errors.push(`${field}: SHA-256 does not match admission manifest`);
      if (entry.bytes.byteLength !== lod.byteLength) {
        errors.push(`${field}: byte length does not match admission manifest`);
      }
      const gltf = parseGlbJson(entry.bytes, field, errors);
      if (!gltf) continue;
      const materialNames = new Set();
      const materials = Array.isArray(gltf.materials) ? gltf.materials : [];
      for (const [materialIndex, material] of materials.entries()) {
        const name = material?.name;
        if (material?.extras?.wholeEnvelopeEmission === true) {
          errors.push(`${field}: material ${name || materialIndex} declares whole-envelope emission`);
        }
        if (!text(name)) continue;
        materialNames.add(name);
        const prefix = allowedPrefixes.find((candidate) => name.startsWith(candidate));
        if (prefix) {
          const declaration = declaredGroups.get(name);
          if (!declaration || !declaration.lods.includes(lod.level)) {
            errors.push(`${field}: light material ${name} is not declared for this LOD`);
          }
        }
        if (/^(street|aviation|landmark)-lights-/.test(name)) {
          errors.push(`${field}: light material ${name} uses a forbidden plural prefix`);
        }
        if (name.startsWith('buildings-') && hasEmission(material)) {
          errors.push(`${field}: material ${name} emits a whole building envelope`);
        }
      }
      for (const group of asset.lightMaterialGroups) {
        if (group.lods.includes(lod.level) && !materialNames.has(group.name)) {
          errors.push(`${field}: missing declared light material ${group.name}`);
        }
      }
    }
  }
  for (const golden of data.nightGoldens) {
    const field = `${golden.cameraId}.${golden.platform}.nightGolden`;
    const bytes = validateReferencedBytes(golden, assetsByUri, field, errors);
    if (bytes && !imageFormat(bytes)) errors.push(`${field}: bytes are not PNG or WebP`);
  }
  for (const mask of data.silhouetteMasks) {
    const field = `${mask.cameraId}.${mask.platform}.silhouetteMask`;
    const bytes = validateReferencedBytes(mask, assetsByUri, field, errors);
    if (bytes && !imageFormat(bytes)) errors.push(`${field}: bytes are not PNG or WebP`);
  }
  for (const trace of data.performanceTraces) {
    const field = `${trace.platform}.performanceTrace`;
    const bytes = validateReferencedBytes(trace, assetsByUri, field, errors);
    if (bytes) validatePerformanceTrace(bytes, trace, data, cityContract, field, errors);
  }
  return { ok: errors.length === 0, errors };
}
