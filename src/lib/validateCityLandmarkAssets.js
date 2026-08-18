import { createHash } from 'node:crypto';

const SHA256_RE = /^[a-f0-9]{64}$/;
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOCAL_GLB_RE = /^\/assets\/city\/packages\/[a-z0-9-/]+\.glb$/;
const LOCAL_GOLDEN_RE = /^\/assets\/city\/packages\/[a-z0-9-/]+\.(?:png|webp)$/;
const REQUIRED_RIGHTS = Object.freeze(['mesh', 'textures', 'signage']);

const object = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const validSha = (value) => typeof value === 'string' && SHA256_RE.test(value);

function sameArray(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
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
  if (data.schemaVersion !== 1) errors.push('schemaVersion: must be 1');
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

  const expectedGoldens = [];
  for (const cameraId of cityContract.landmarkAssetContract?.nightGoldenCameraIds || []) {
    for (const platform of cityContract.landmarkAssetContract?.nightGoldenPlatforms || []) {
      expectedGoldens.push(`${cameraId}:${platform}`);
    }
  }
  if (!Array.isArray(data.nightGoldens)) {
    errors.push('nightGoldens: must be an array');
  } else {
    const actualGoldens = data.nightGoldens.map((golden) => `${golden?.cameraId}:${golden?.platform}`);
    if (!sameArray(actualGoldens, expectedGoldens)) {
      errors.push('nightGoldens: must cover every canonical camera on desktop and mobile in order');
    }
    for (const [index, golden] of data.nightGoldens.entries()) {
      if (!validSha(golden?.sha256)) errors.push(`nightGoldens[${index}].sha256: must be SHA-256`);
      if (!LOCAL_GOLDEN_RE.test(String(golden?.uri || ''))) {
        errors.push(`nightGoldens[${index}].uri: must be a local PNG or WebP`);
      } else if (!golden.uri.startsWith(`/assets/city/packages/${data.packageId}/`)) {
        errors.push(`nightGoldens[${index}].uri: must remain inside package ${data.packageId}`);
      }
      if (!Number.isSafeInteger(golden?.byteLength) || golden.byteLength <= 0) {
        errors.push(`nightGoldens[${index}].byteLength: must be positive`);
      }
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
    const entry = assetsByUri[golden.uri];
    if (!object(entry) || !(entry.bytes instanceof Uint8Array)) {
      errors.push(`${field}: staged image bytes are required`);
      continue;
    }
    const actualSha = createHash('sha256').update(entry.bytes).digest('hex');
    if (actualSha !== golden.sha256) errors.push(`${field}: SHA-256 does not match admission manifest`);
    if (entry.bytes.byteLength !== golden.byteLength) {
      errors.push(`${field}: byte length does not match admission manifest`);
    }
    const png = entry.bytes.byteLength >= 8
      && entry.bytes[0] === 0x89 && entry.bytes[1] === 0x50
      && entry.bytes[2] === 0x4e && entry.bytes[3] === 0x47;
    const webp = entry.bytes.byteLength >= 12
      && new TextDecoder().decode(entry.bytes.subarray(0, 4)) === 'RIFF'
      && new TextDecoder().decode(entry.bytes.subarray(8, 12)) === 'WEBP';
    if (!png && !webp) errors.push(`${field}: bytes are not PNG or WebP`);
  }
  return { ok: errors.length === 0, errors };
}
