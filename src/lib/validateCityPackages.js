const CITY_IDS = Object.freeze(['shanghai', 'melbourne', 'hong-kong']);
const APPROVAL_ROLES = Object.freeze(['dataOwner', 'legal', 'engineering', 'productRelease']);
const RIGHTS = Object.freeze(['cache', 'derivatives', 'redistribution', 'commercialUse']);
const DECISIONS = new Set(['review', 'approved', 'blocked', 'rejected']);
const RIGHT_STATUSES = new Set(['review', 'allowed', 'prohibited']);
const TRUTH_CLASSES = new Set(['authoritative', 'community', 'inferred', 'art-directed']);
const CONFIDENCE_LEVELS = new Set(['surveyed', 'official', 'community', 'estimated']);
const ASSET_KINDS = new Set(['entities-index', 'geometry', 'properties', 'texture', 'poster']);
const SHA256_RE = /^[a-f0-9]{64}$/;
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_PATH_RE = /^public\/assets\/city\/packages\/[a-z0-9-]+\/manifest\.json$/;
const LOCAL_ASSET_RE = /^\/assets\/city\/packages\/[a-z0-9-/]+\.[a-z0-9]+$/;
const LANDMARK_ADMISSION_RE = /^\/assets\/city\/packages\/[a-z0-9-]+\/landmark-admission\.json$/;
const TIME_ZONES = Object.freeze({
  shanghai: 'Asia/Shanghai',
  melbourne: 'Australia/Melbourne',
  'hong-kong': 'Asia/Hong_Kong',
});

const object = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const validSha = (value) => typeof value === 'string' && SHA256_RE.test(value);
const validHttps = (value) => typeof value === 'string' && /^https:\/\//.test(value);
const validDate = (value) => typeof value === 'string' && DATE_RE.test(value);
const validInstant = (value) => typeof value === 'string'
  && Number.isFinite(Date.parse(value))
  && value.includes('T');

function completeApproval(approval) {
  return object(approval)
    && approval.status === 'approved'
    && text(approval.by)
    && validDate(approval.at)
    && text(approval.evidence);
}

function validateApproval(approval, field, errors) {
  if (!object(approval)) {
    errors.push(`${field}: must be an object`);
    return;
  }
  if (!DECISIONS.has(approval.status)) errors.push(`${field}.status: invalid status`);
  if (approval.status === 'approved' && !completeApproval(approval)) {
    errors.push(`${field}: approved status requires by, at and evidence`);
  }
}

function validateBounds(bounds, field, errors) {
  if (!object(bounds)) {
    errors.push(`${field}: must be an object`);
    return;
  }
  for (const key of ['west', 'south', 'east', 'north']) {
    if (!Number.isFinite(bounds[key])) errors.push(`${field}.${key}: must be finite`);
  }
  if (
    Number.isFinite(bounds.west)
    && Number.isFinite(bounds.south)
    && Number.isFinite(bounds.east)
    && Number.isFinite(bounds.north)
    && (!(bounds.west < bounds.east) || !(bounds.south < bounds.north))
  ) {
    errors.push(`${field}: must be ordered west/south/east/north`);
  }
}

function validateLocalPoint(point, field, errors) {
  if (!object(point) || !['x', 'y', 'z'].every((key) => Number.isFinite(point[key]))) {
    errors.push(`${field}: finite x, y and z are required`);
  }
}

function validateSourceLayer(layer, index, errors, ids) {
  const field = `sourceLayers[${index}]`;
  if (!object(layer)) {
    errors.push(`${field}: must be an object`);
    return;
  }
  if (!ID_RE.test(String(layer.ledgerLayerId || ''))) errors.push(`${field}.ledgerLayerId: invalid id`);
  if (ids.has(layer.ledgerLayerId)) errors.push(`${field}.ledgerLayerId: duplicate ${layer.ledgerLayerId}`);
  ids.add(layer.ledgerLayerId);
  for (const key of ['datasetId', 'provider', 'datasetVersion', 'attribution']) {
    if (!text(layer[key])) errors.push(`${field}.${key}: must be non-empty`);
  }
  if (!validHttps(layer.sourceUrl)) errors.push(`${field}.sourceUrl: must be HTTPS`);
  if (!validDate(layer.retrievedAt)) errors.push(`${field}.retrievedAt: must be YYYY-MM-DD`);
  if (layer.capturedAt !== null && !text(layer.capturedAt)) errors.push(`${field}.capturedAt: must be null or text`);
  if (!object(layer.sourceCrs) || !['declared', 'review'].includes(layer.sourceCrs.status)) {
    errors.push(`${field}.sourceCrs: invalid status`);
  } else if (layer.sourceCrs.status === 'declared' && (
    !text(layer.sourceCrs.identifier)
    || !text(layer.sourceCrs.axisOrder)
    || !['degree', 'metre'].includes(layer.sourceCrs.unit)
  )) {
    errors.push(`${field}.sourceCrs: declared CRS requires identifier, axisOrder and unit`);
  }
  if (!object(layer.verticalDatum) || !['declared', 'not-applicable', 'review'].includes(layer.verticalDatum.status)) {
    errors.push(`${field}.verticalDatum: invalid status`);
  } else if (layer.verticalDatum.status === 'declared' && (
    !text(layer.verticalDatum.name)
    || layer.verticalDatum.unit !== 'metre'
    || !text(layer.verticalDatum.transformPipeline)
  )) {
    errors.push(`${field}.verticalDatum: declared datum requires name, metre unit and transformPipeline`);
  }
  if (!['review', 'verified'].includes(layer.spatialVerification)) {
    errors.push(`${field}.spatialVerification: invalid status`);
  }
  if (!validHttps(layer.licenceUrl)) errors.push(`${field}.licenceUrl: must be HTTPS`);
  if (!validSha(layer.licenceSnapshotSha256)) errors.push(`${field}.licenceSnapshotSha256: must be SHA-256`);
  if (!validSha(layer.sourceArtifactSha256)) errors.push(`${field}.sourceArtifactSha256: must be SHA-256`);
  if (!object(layer.rights)) {
    errors.push(`${field}.rights: must be an object`);
  } else {
    for (const right of RIGHTS) {
      if (!RIGHT_STATUSES.has(layer.rights[right])) errors.push(`${field}.rights.${right}: invalid status`);
    }
  }
  if (!TRUTH_CLASSES.has(layer.truthClass)) errors.push(`${field}.truthClass: invalid value`);
  if (!CONFIDENCE_LEVELS.has(layer.confidence)) errors.push(`${field}.confidence: invalid value`);
  if (!Array.isArray(layer.transformHistory) || layer.transformHistory.some((item) => !text(item))) {
    errors.push(`${field}.transformHistory: must be an array of text`);
  }
}

function parseAnalysisGlb(bytes, field, errors) {
  if (!(bytes instanceof Uint8Array)) {
    errors.push(`${field}: staged GLB bytes are required`);
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    bytes.byteLength < 28
    || view.getUint32(0, true) !== 0x46546c67
    || view.getUint32(4, true) !== 2
    || view.getUint32(8, true) !== bytes.byteLength
  ) {
    errors.push(`${field}: invalid glTF 2.0 binary header`);
    return null;
  }
  const jsonLength = view.getUint32(12, true);
  const jsonEnd = 20 + jsonLength;
  if (
    view.getUint32(16, true) !== 0x4e4f534a
    || jsonEnd + 8 > bytes.byteLength
    || view.getUint32(jsonEnd + 4, true) !== 0x004e4942
    || jsonEnd + 8 + view.getUint32(jsonEnd, true) !== bytes.byteLength
  ) {
    errors.push(`${field}: invalid GLB JSON or BIN chunk`);
    return null;
  }
  let gltf;
  try {
    gltf = JSON.parse(new TextDecoder().decode(bytes.subarray(20, jsonEnd)));
  } catch {
    errors.push(`${field}: invalid glTF JSON`);
    return null;
  }
  if (
    !gltf.extensionsUsed?.includes('EXT_meshopt_compression')
    || !gltf.extensionsRequired?.includes('EXT_meshopt_compression')
    || gltf.buffers?.length !== 2
    || gltf.buffers[0].byteLength !== view.getUint32(jsonEnd, true)
    || gltf.buffers[1].extensions?.EXT_meshopt_compression?.fallback !== true
  ) errors.push(`${field}: invalid Meshopt buffer contract`);
  for (const [index, bufferView] of (gltf.bufferViews || []).entries()) {
    const meshopt = bufferView.extensions?.EXT_meshopt_compression;
    if (
      bufferView.buffer !== 1
      || meshopt?.buffer !== 0
      || !['ATTRIBUTES', 'TRIANGLES', 'INDICES'].includes(meshopt?.mode)
      || meshopt?.filter !== 'NONE'
      || !Number.isSafeInteger(meshopt?.count)
      || meshopt.count <= 0
      || !Number.isSafeInteger(meshopt?.byteStride)
      || meshopt.byteStride <= 0
      || meshopt.byteOffset + meshopt.byteLength > gltf.buffers?.[0]?.byteLength
      || bufferView.byteOffset + bufferView.byteLength > gltf.buffers?.[1]?.byteLength
    ) errors.push(`${field}: bufferView ${index} has invalid Meshopt metadata`);
  }
  let triangles = 0;
  let lineSegments = 0;
  let points = 0;
  for (const primitive of gltf.meshes?.[0]?.primitives || []) {
    const position = gltf.accessors?.[primitive.attributes?.POSITION];
    const feature = gltf.accessors?.[primitive.attributes?._FEATURE_ID_0];
    const indices = primitive.indices === undefined ? null : gltf.accessors?.[primitive.indices];
    if (!position || !feature || position.count !== feature.count) {
      errors.push(`${field}: primitive is missing position or feature-id accessors`);
      continue;
    }
    if (primitive.mode === 4 && indices && indices.count % 3 === 0) triangles += indices.count / 3;
    else if (primitive.mode === 1 && indices && indices.count % 2 === 0) lineSegments += indices.count / 2;
    else if (primitive.mode === 0 && !indices) points += position.count;
    else errors.push(`${field}: primitive has an invalid mode or index count`);
  }
  const statistics = gltf.extras?.statistics;
  if (
    !object(statistics)
    || statistics.drawCalls !== gltf.meshes?.[0]?.primitives?.length
    || statistics.triangles !== triangles
    || statistics.lineSegments !== lineSegments
    || statistics.points !== points
    || statistics.featureCount !== gltf.extras?.features?.length
  ) errors.push(`${field}: embedded statistics do not match primitives`);
  return { gltf, statistics };
}

export function validateCityPackageManifest(data) {
  const errors = [];
  if (!object(data)) return { ok: false, errors: ['top-level: must be an object'] };
  if (data.schemaVersion !== 1) errors.push('schemaVersion: must be 1');
  if (!ID_RE.test(String(data.packageId || ''))) errors.push('packageId: invalid id');
  if (!text(data.packageVersion)) errors.push('packageVersion: must be non-empty');
  if (!CITY_IDS.includes(data.cityId)) errors.push('cityId: invalid city');
  if (data.truthClass !== 'licensed-real-data') errors.push('truthClass: must be licensed-real-data');
  if (!['candidate', 'production-approved'].includes(data.status)) errors.push('status: invalid status');

  if (!object(data.precinct)) {
    errors.push('precinct: must be an object');
  } else {
    if (!['candidate-unverified', 'frozen'].includes(data.precinct.status)) errors.push('precinct.status: invalid status');
    if (!text(data.precinct.labels?.en) || !text(data.precinct.labels?.zh)) errors.push('precinct.labels: bilingual labels are required');
    validateBounds(data.precinct.boundsWgs84, 'precinct.boundsWgs84', errors);
    const anchor = data.precinct.anchorWgs84;
    if (!object(anchor) || !['longitude', 'latitude', 'ellipsoidHeight'].every((key) => Number.isFinite(anchor[key]))) {
      errors.push('precinct.anchorWgs84: longitude, latitude and ellipsoidHeight must be finite');
    } else if (
      object(data.precinct.boundsWgs84)
      && (
        anchor.longitude < data.precinct.boundsWgs84.west
        || anchor.longitude > data.precinct.boundsWgs84.east
        || anchor.latitude < data.precinct.boundsWgs84.south
        || anchor.latitude > data.precinct.boundsWgs84.north
      )
    ) {
      errors.push('precinct.anchorWgs84: must be inside bounds');
    }
    if (data.precinct.localFrame !== 'ENU') errors.push('precinct.localFrame: must be ENU');
    if (CITY_IDS.includes(data.cityId) && data.precinct.ianaTimeZone !== TIME_ZONES[data.cityId]) {
      errors.push(`precinct.ianaTimeZone: must be ${TIME_ZONES[data.cityId]}`);
    }
  }

  if (!Array.isArray(data.sourceLayers) || data.sourceLayers.length === 0) {
    errors.push('sourceLayers: must be a non-empty array');
  } else {
    const ids = new Set();
    data.sourceLayers.forEach((layer, index) => validateSourceLayer(layer, index, errors, ids));
  }

  if (!Array.isArray(data.assets) || data.assets.length === 0) {
    errors.push('assets: must be a non-empty array');
  } else {
    const ids = new Set();
    data.assets.forEach((asset, index) => {
      const field = `assets[${index}]`;
      if (!object(asset)) {
        errors.push(`${field}: must be an object`);
        return;
      }
      if (!ID_RE.test(String(asset.id || ''))) errors.push(`${field}.id: invalid id`);
      if (ids.has(asset.id)) errors.push(`${field}.id: duplicate ${asset.id}`);
      ids.add(asset.id);
      if (!ASSET_KINDS.has(asset.kind)) errors.push(`${field}.kind: invalid kind`);
      if (!LOCAL_ASSET_RE.test(String(asset.uri || ''))) errors.push(`${field}.uri: must be a local CityPackage asset`);
      if (!validSha(asset.sha256)) errors.push(`${field}.sha256: must be SHA-256`);
      if (!Number.isSafeInteger(asset.byteLength) || asset.byteLength <= 0) errors.push(`${field}.byteLength: must be positive`);
      if (asset.lod !== null && ![0, 1, 2].includes(asset.lod)) errors.push(`${field}.lod: must be null, 0, 1 or 2`);
    });
    if (!data.assets.some(({ kind } = {}) => kind === 'entities-index')) {
      errors.push('assets: an entities-index is required');
    }
  }

  if (data.landmarkAssets === null) {
    if (data.status === 'production-approved') {
      errors.push('landmarkAssets: production packages require an admitted landmark asset set');
    }
  } else if (!object(data.landmarkAssets)) {
    errors.push('landmarkAssets: must be null or an object');
  } else {
    if (!LANDMARK_ADMISSION_RE.test(String(data.landmarkAssets.admissionUri || ''))) {
      errors.push('landmarkAssets.admissionUri: must be a local landmark-admission.json');
    } else if (!data.landmarkAssets.admissionUri.startsWith(`/assets/city/packages/${data.packageId}/`)) {
      errors.push('landmarkAssets.admissionUri: must remain inside this package');
    }
    if (!validSha(data.landmarkAssets.sha256)) {
      errors.push('landmarkAssets.sha256: must be SHA-256');
    }
    if (!Number.isSafeInteger(data.landmarkAssets.byteLength) || data.landmarkAssets.byteLength <= 0) {
      errors.push('landmarkAssets.byteLength: must be positive');
    }
  }

  if (data.canonicalViews === null) {
    if (data.status === 'production-approved') {
      errors.push('canonicalViews: production packages require frozen canonical views');
    }
  } else if (!Array.isArray(data.canonicalViews) || data.canonicalViews.length < 5) {
    errors.push('canonicalViews: must be null or contain at least five views');
  } else {
    const ids = new Set();
    for (const [index, view] of data.canonicalViews.entries()) {
      const field = `canonicalViews[${index}]`;
      if (!object(view)) {
        errors.push(`${field}: must be an object`);
        continue;
      }
      if (!ID_RE.test(String(view.id || ''))) errors.push(`${field}.id: invalid id`);
      if (ids.has(view.id)) errors.push(`${field}.id: duplicate ${view.id}`);
      ids.add(view.id);
      if (!text(view.labels?.en) || !text(view.labels?.zh)) {
        errors.push(`${field}.labels: bilingual labels are required`);
      }
      validateLocalPoint(view.positionLocal, `${field}.positionLocal`, errors);
      validateLocalPoint(view.targetLocal, `${field}.targetLocal`, errors);
      if (
        object(view.positionLocal)
        && object(view.targetLocal)
        && ['x', 'y', 'z'].every((key) => view.positionLocal[key] === view.targetLocal[key])
      ) errors.push(`${field}: position and target must differ`);
      if (!Number.isFinite(view.verticalFovDegrees)
        || view.verticalFovDegrees <= 0 || view.verticalFovDegrees >= 90) {
        errors.push(`${field}.verticalFovDegrees: must be between 0 and 90`);
      }
      if (view.verticalBasis !== 'local-datum-metres') {
        errors.push(`${field}.verticalBasis: must be local-datum-metres`);
      }
      if (!text(view.verticalEvidence)) errors.push(`${field}.verticalEvidence: required`);
    }
  }

  if (!validInstant(data.generatedAt)) errors.push('generatedAt: must be an ISO timestamp');
  if (!object(data.approvals)) {
    errors.push('approvals: must be an object');
  } else {
    APPROVAL_ROLES.forEach((role) => validateApproval(data.approvals[role], `approvals.${role}`, errors));
  }
  if (!object(data.release) || !text(data.release.featureFlag) || !text(data.release.withdrawalOwner)) {
    errors.push('release: featureFlag and withdrawalOwner are required');
  } else if (data.release.rollbackPackageId !== null && !ID_RE.test(String(data.release.rollbackPackageId || ''))) {
    errors.push('release.rollbackPackageId: must be null or a valid id');
  }

  return { ok: errors.length === 0, errors };
}

export function canPublishCityPackage(data) {
  if (!validateCityPackageManifest(data).ok) return false;
  return data.status === 'production-approved'
    && data.precinct.status === 'frozen'
    && object(data.landmarkAssets)
    && Array.isArray(data.canonicalViews)
    && data.canonicalViews.length >= 5
    && data.sourceLayers.every((layer) => (
      layer.sourceCrs.status === 'declared'
      && ['declared', 'not-applicable'].includes(layer.verticalDatum.status)
      && layer.spatialVerification === 'verified'
      && RIGHTS.every((right) => layer.rights[right] === 'allowed')
      && layer.transformHistory.length > 0
    ))
    && APPROVAL_ROLES.every((role) => completeApproval(data.approvals[role]));
}

export function validateCityPackageAssetReferences(manifest, assetsByUri) {
  const errors = [];
  if (!validateCityPackageManifest(manifest).ok) return { ok: false, errors: ['manifest: invalid'] };
  if (!object(assetsByUri)) return { ok: false, errors: ['assetsByUri: must be an object'] };
  const manifestAssets = new Map(manifest.assets.map((asset) => [asset.id, asset]));
  for (const asset of manifest.assets) {
    const entry = assetsByUri[asset.uri];
    if (!object(entry)) {
      errors.push(`${asset.id}: staged asset is missing`);
      continue;
    }
    if (entry.sha256 !== asset.sha256) errors.push(`${asset.id}: SHA-256 does not match manifest`);
    if (entry.byteLength !== asset.byteLength) errors.push(`${asset.id}: byte length does not match manifest`);
  }

  const indexAsset = manifest.assets.find(({ kind }) => kind === 'entities-index');
  const index = indexAsset && assetsByUri[indexAsset.uri]?.data;
  if (!object(index)) return { ok: false, errors: [...errors, 'entities-index: valid JSON object is required'] };
  if (index.schemaVersion !== 1) errors.push('entities-index.schemaVersion: must be 1');
  if (index.packageId !== manifest.packageId) errors.push('entities-index.packageId: does not match manifest');
  if (!object(index.tileScheme)) {
    errors.push('entities-index.tileScheme: must be an object');
  } else {
    if (index.tileScheme.id !== 'local-enu-250m-v1') errors.push('entities-index.tileScheme.id: invalid scheme');
    if (index.tileScheme.tileSizeMetres !== 250) errors.push('entities-index.tileScheme.tileSizeMetres: must be 250');
    if (!Number.isSafeInteger(index.tileScheme.columns) || index.tileScheme.columns <= 0) {
      errors.push('entities-index.tileScheme.columns: must be positive');
    }
    if (!Number.isSafeInteger(index.tileScheme.rows) || index.tileScheme.rows <= 0) {
      errors.push('entities-index.tileScheme.rows: must be positive');
    }
    if (index.tileScheme.lods?.join(',') !== '0,1,2') errors.push('entities-index.tileScheme.lods: must equal 0, 1, 2');
    const bounds = index.tileScheme.boundsLocal;
    if (!object(bounds) || !['minX', 'maxX', 'minZ', 'maxZ'].every((key) => Number.isFinite(bounds[key]))) {
      errors.push('entities-index.tileScheme.boundsLocal: finite bounds are required');
    } else if (
      bounds.maxX - bounds.minX !== index.tileScheme.columns * 250
      || bounds.maxZ - bounds.minZ !== index.tileScheme.rows * 250
    ) {
      errors.push('entities-index.tileScheme.boundsLocal: does not match rows and columns');
    }
  }
  const sourceLayerIds = manifest.sourceLayers.map(({ ledgerLayerId }) => ledgerLayerId);
  if (index.sourceLayerIds?.join(',') !== sourceLayerIds.join(',')) {
    errors.push('entities-index.sourceLayerIds: does not match manifest order');
  }

  const tiles = Array.isArray(index.tiles) ? index.tiles : [];
  const expectedTileCount = index.tileScheme?.columns * index.tileScheme?.rows;
  if (tiles.length !== expectedTileCount) errors.push('entities-index.tiles: tile grid is incomplete');
  const tileIds = new Set();
  const gridSlots = new Set();
  const tilePayloads = new Map();
  const runtimeAssetIds = new Set();
  let runtimeTriangles = 0;
  let maximumRuntimeTileBytes = 0;
  for (const tile of tiles) {
    if (!ID_RE.test(String(tile?.id || ''))) errors.push('entities-index.tiles: invalid tile id');
    if (tileIds.has(tile.id)) errors.push(`entities-index.tiles: duplicate ${tile.id}`);
    tileIds.add(tile.id);
    if (!Number.isSafeInteger(tile.column) || !Number.isSafeInteger(tile.row)) {
      errors.push(`${tile.id}: tile row and column must be integers`);
    } else {
      const slot = `${tile.column}:${tile.row}`;
      if (gridSlots.has(slot)) errors.push(`${tile.id}: duplicate tile grid slot ${slot}`);
      gridSlots.add(slot);
      if (
        tile.column < 0 || tile.column >= index.tileScheme.columns
        || tile.row < 0 || tile.row >= index.tileScheme.rows
      ) errors.push(`${tile.id}: tile grid slot is outside the scheme`);
      const schemeBounds = index.tileScheme.boundsLocal;
      if (object(schemeBounds) && (
        tile.boundsLocal?.minX !== schemeBounds.minX + tile.column * 250
        || tile.boundsLocal?.maxX !== schemeBounds.minX + (tile.column + 1) * 250
        || tile.boundsLocal?.minZ !== schemeBounds.minZ + tile.row * 250
        || tile.boundsLocal?.maxZ !== schemeBounds.minZ + (tile.row + 1) * 250
      )) errors.push(`${tile.id}: tile bounds leave a gap or overlap in the 250 m grid`);
    }
    validateBounds({
      west: tile.boundsLocal?.minX,
      south: tile.boundsLocal?.minZ,
      east: tile.boundsLocal?.maxX,
      north: tile.boundsLocal?.maxZ,
    }, `${tile.id}.boundsLocal`, errors);
    if (!Array.isArray(tile.lods) || tile.lods.map(({ lod }) => lod).join(',') !== '0,1,2') {
      errors.push(`${tile.id}.lods: must contain LOD0, LOD1 and LOD2`);
      continue;
    }
    for (const reference of tile.lods) {
      const asset = manifestAssets.get(reference.assetId);
      if (!asset || asset.kind !== 'geometry' || asset.lod !== reference.lod) {
        errors.push(`${tile.id}.lod${reference.lod}: geometry asset reference is invalid`);
        continue;
      }
      if (
        reference.uri !== asset.uri
        || reference.sha256 !== asset.sha256
        || reference.byteLength !== asset.byteLength
      ) errors.push(`${tile.id}.lod${reference.lod}: asset metadata does not match manifest`);
      const payload = assetsByUri[asset.uri]?.data;
      if (!object(payload)) {
        errors.push(`${tile.id}.lod${reference.lod}: valid JSON payload is required`);
        continue;
      }
      if (
        payload.packageId !== manifest.packageId
        || payload.tileId !== tile.id
        || payload.lod !== reference.lod
      ) errors.push(`${tile.id}.lod${reference.lod}: payload identity does not match index`);
      const layerKeys = Object.keys(payload.layers || {}).sort().join(',');
      if (layerKeys !== 'buildings,control,pedestrian,roads,terrain,trees,water') {
        errors.push(`${tile.id}.lod${reference.lod}: payload layers are incomplete`);
      }
      tilePayloads.set(`${tile.id}:${reference.lod}`, payload);

      const runtimeReference = reference.runtimeAsset;
      const runtimeAsset = manifestAssets.get(runtimeReference?.assetId);
      if (
        !runtimeAsset
        || runtimeAsset.kind !== 'geometry'
        || runtimeAsset.lod !== reference.lod
        || runtimeReference.uri !== runtimeAsset.uri
        || runtimeReference.sha256 !== runtimeAsset.sha256
        || runtimeReference.byteLength !== runtimeAsset.byteLength
        || runtimeReference.format !== 'model/gltf-binary'
        || runtimeReference.compression !== 'EXT_meshopt_compression'
      ) {
        errors.push(`${tile.id}.lod${reference.lod}: runtime GLB reference is invalid`);
        continue;
      }
      runtimeAssetIds.add(runtimeAsset.id);
      const parsed = parseAnalysisGlb(
        assetsByUri[runtimeAsset.uri]?.bytes,
        `${tile.id}.lod${reference.lod}.runtimeAsset`,
        errors,
      );
      if (!parsed) continue;
      if (
        parsed.gltf.extras?.packageId !== manifest.packageId
        || parsed.gltf.extras?.tileId !== tile.id
        || parsed.gltf.extras?.lod !== reference.lod
        || JSON.stringify(parsed.statistics) !== JSON.stringify(runtimeReference.statistics)
      ) errors.push(`${tile.id}.lod${reference.lod}: runtime GLB identity or statistics mismatch`);
      if (runtimeAsset.byteLength > 400_000) errors.push(`${tile.id}.lod${reference.lod}: exceeds 400 KB runtime budget`);
      if (parsed.statistics?.drawCalls > 7) errors.push(`${tile.id}.lod${reference.lod}: exceeds seven draw calls`);
      runtimeTriangles += parsed.statistics?.triangles || 0;
      maximumRuntimeTileBytes = Math.max(maximumRuntimeTileBytes, runtimeAsset.byteLength);
    }
  }
  const glbAssets = manifest.assets.filter(({ uri }) => uri.endsWith('.glb'));
  if (glbAssets.length !== tiles.length * 3 || glbAssets.some(({ id }) => !runtimeAssetIds.has(id))) {
    errors.push('assets: runtime GLB inventory must contain exactly three assets per tile');
  }
  if (
    index.runtime?.representation !== 'Analysis GLB'
    || index.runtime?.mimeType !== 'model/gltf-binary'
    || index.runtime?.compression !== 'EXT_meshopt_compression'
    || index.runtime?.textures !== 'none'
    || index.runtime?.candidateOnly !== true
    || index.runtime?.dependencySemantics !== 'direct-entity-home-tiles'
    || index.runtime?.totalTriangleInstancesAcrossAllLods !== runtimeTriangles
    || index.runtime?.maximumTileByteLength !== maximumRuntimeTileBytes
  ) errors.push('entities-index.runtime: does not match staged GLB inventory');

  const entityIds = new Set();
  const entityLocations = new Map();
  for (const entity of index.entities || []) {
    if (!text(entity?.id)) errors.push('entities-index.entities: id must be non-empty');
    if (entityIds.has(entity.id)) errors.push(`entities-index.entities: duplicate ${entity.id}`);
    entityIds.add(entity.id);
    if (!sourceLayerIds.includes(entity.layerId)) errors.push(`${entity.id}: unknown source layer ${entity.layerId}`);
    if (!Array.isArray(entity.tileIds) || entity.tileIds.length === 0) {
      errors.push(`${entity.id}: at least one tile is required`);
    } else if (entity.tileIds.some((tileId) => !tileIds.has(tileId))) {
      errors.push(`${entity.id}: references an unknown tile`);
    }
    if (!tileIds.has(entity.homeTileId) || !entity.tileIds?.includes(entity.homeTileId)) {
      errors.push(`${entity.id}: home tile must be one of its indexed tiles`);
    }
    entityLocations.set(entity.id, new Set(entity.tileIds || []));
  }
  for (const tile of tiles) {
    const expectedDependencies = [...new Set((index.entities || [])
      .filter(({ tileIds: locations, homeTileId }) => locations?.includes(tile.id) && homeTileId !== tile.id)
      .map(({ homeTileId }) => homeTileId))].sort();
    if (tile.dependencyTileIds?.join(',') !== expectedDependencies.join(',')) {
      errors.push(`${tile.id}.dependencyTileIds: does not match cross-tile entity ownership`);
    }
  }

  const propertiesReference = index.propertiesAsset;
  const propertiesAsset = manifestAssets.get(propertiesReference?.id);
  if (
    !propertiesAsset
    || propertiesAsset.kind !== 'properties'
    || propertiesReference.uri !== propertiesAsset.uri
    || propertiesReference.sha256 !== propertiesAsset.sha256
    || propertiesReference.byteLength !== propertiesAsset.byteLength
  ) {
    errors.push('entities-index.propertiesAsset: does not match manifest');
  } else {
    const properties = assetsByUri[propertiesAsset.uri]?.data;
    const records = properties?.records;
    if (!object(properties) || properties.packageId !== manifest.packageId || !Array.isArray(records)) {
      errors.push('properties: valid package records are required');
    } else {
      const propertyIds = records.map(({ id }) => id);
      if (propertyIds.length !== entityIds.size || new Set(propertyIds).size !== propertyIds.length) {
        errors.push('properties.records: must contain one unique record per indexed entity');
      } else if (propertyIds.some((id) => !entityIds.has(id))) {
        errors.push('properties.records: contains an unknown entity');
      }
    }
  }

  const layerByLedgerId = new Map([
    ['melbourne-buildings-2023', 'buildings'],
    ['melbourne-vicmap-roads', 'roads'],
    ['melbourne-pedestrian-network', 'pedestrian'],
    ['melbourne-vicmap-hydro', 'water'],
    ['melbourne-urban-forest-trees', 'trees'],
    ['melbourne-vicmap-survey-control', 'control'],
  ]);
  const seenLod2 = new Map();
  const terrainCells = new Set();
  for (const tile of tiles) {
    for (const lod of [0, 1, 2]) {
      const payload = tilePayloads.get(`${tile.id}:${lod}`);
      if (!payload) continue;
      for (const [layerKey, entities] of Object.entries(payload.layers || {})) {
        if (!Array.isArray(entities)) continue;
        const ids = entities.map(({ id }) => id).filter(Boolean);
        if (ids.length !== new Set(ids).size) errors.push(`${tile.id}.lod${lod}.${layerKey}: duplicate entity id`);
        if (lod !== 2 || layerKey === 'terrain') continue;
        ids.forEach((id) => {
          if (!entityLocations.get(id)?.has(tile.id)) errors.push(`${tile.id}.lod2.${layerKey}: ${id} is not indexed here`);
          if (!seenLod2.has(id)) seenLod2.set(id, new Set());
          seenLod2.get(id).add(tile.id);
        });
      }
      if (lod === 2) {
        for (const cell of payload.layers?.terrain || []) {
          const key = `${cell.row}:${cell.column}`;
          if (terrainCells.has(key)) errors.push(`terrain: duplicate native cell ${key}`);
          terrainCells.add(key);
          if (![cell.x, cell.z, cell.elevationAhd].every(Number.isFinite)) {
            errors.push(`terrain: ${key} has non-finite scene coordinates or AHD height`);
          }
        }
      }
    }
  }
  for (const entity of index.entities || []) {
    const layerKey = layerByLedgerId.get(entity.layerId);
    if (!layerKey) continue;
    if (seenLod2.get(entity.id)?.size !== entity.tileIds.length) {
      errors.push(`${entity.id}: LOD2 tile coverage does not match entity index`);
    }
  }
  if (index.terrain?.sourceCellValuesResampled !== false) {
    errors.push('entities-index.terrain.sourceCellValuesResampled: must be false');
  }
  if (terrainCells.size !== index.terrain?.retainedCellCount) {
    errors.push('entities-index.terrain.retainedCellCount: does not match LOD2 cells');
  }

  return { ok: errors.length === 0, errors };
}

export function validateCityPackageRegistry(data) {
  const errors = [];
  if (!object(data)) return { ok: false, errors: ['top-level: must be an object'] };
  if (data.schemaVersion !== 1) errors.push('schemaVersion: must be 1');
  if (!ID_RE.test(String(data.registryId || ''))) errors.push('registryId: invalid id');
  if (!Array.isArray(data.cityOrder) || data.cityOrder.join(',') !== CITY_IDS.join(',')) {
    errors.push(`cityOrder: must equal ${CITY_IDS.join(', ')}`);
  }
  if (!object(data.productionPackages) || Object.keys(data.productionPackages).join(',') !== CITY_IDS.join(',')) {
    errors.push(`productionPackages: keys must equal ${CITY_IDS.join(', ')}`);
  } else {
    for (const cityId of CITY_IDS) {
      const reference = data.productionPackages[cityId];
      if (reference === null) continue;
      if (!object(reference)) {
        errors.push(`productionPackages.${cityId}: must be null or an object`);
        continue;
      }
      if (!ID_RE.test(String(reference.packageId || ''))) errors.push(`productionPackages.${cityId}.packageId: invalid id`);
      if (!LOCAL_PATH_RE.test(String(reference.manifestPath || ''))) errors.push(`productionPackages.${cityId}.manifestPath: invalid path`);
      if (!validSha(reference.manifestSha256)) errors.push(`productionPackages.${cityId}.manifestSha256: must be SHA-256`);
    }
  }
  return { ok: errors.length === 0, errors };
}
