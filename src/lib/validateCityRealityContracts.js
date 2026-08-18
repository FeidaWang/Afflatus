const CITY_IDS = Object.freeze(['shanghai', 'melbourne', 'hong-kong']);
const TRUTH_MODES = Object.freeze(['reality', 'construction-scenario', 'sandbox']);
const ENVIRONMENT_STATES = Object.freeze(['day', 'twilight', 'night']);
const REQUIRED_LAYERS = Object.freeze(['terrain', 'shoreline', 'roads', 'building-parts', 'landmarks']);
const REQUIRED_LANDMARK_LODS = Object.freeze([0, 1, 2]);
const REQUIRED_LIGHT_LODS = Object.freeze([0, 1]);
const LIGHT_MATERIAL_PREFIXES = Object.freeze(['street-light-', 'aviation-light-', 'landmark-light-']);
const NIGHT_GOLDEN_PLATFORMS = Object.freeze(['desktop', 'mobile']);
const SHANGHAI_CORE_LIGHT_GROUPS = Object.freeze({
  'oriental-pearl': Object.freeze(['landmark-light-oriental-pearl', 'aviation-light-oriental-pearl']),
  'shanghai-tower': Object.freeze(['landmark-light-shanghai-tower-crown', 'aviation-light-shanghai-tower']),
  'shanghai-world-financial-center': Object.freeze(['landmark-light-swfc-crown', 'aviation-light-swfc']),
  'jin-mao-tower': Object.freeze(['landmark-light-jin-mao-crown', 'aviation-light-jin-mao']),
  'bund-52-building-ensemble': Object.freeze(['landmark-light-bund-facade']),
});
const REVIEW_STATUSES = new Set(['blocked', 'review', 'approved']);
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const object = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value) => typeof value === 'string' && value.trim().length > 0;

function validateBounds(bounds, field, errors) {
  if (!object(bounds)) {
    errors.push(`${field}: must be an object`);
    return false;
  }
  for (const key of ['west', 'south', 'east', 'north']) {
    if (!Number.isFinite(bounds[key])) errors.push(`${field}.${key}: must be finite`);
  }
  const valid = Number.isFinite(bounds.west)
    && Number.isFinite(bounds.south)
    && Number.isFinite(bounds.east)
    && Number.isFinite(bounds.north)
    && bounds.west < bounds.east
    && bounds.south < bounds.north;
  if (!valid) errors.push(`${field}: must be ordered west/south/east/north`);
  return valid;
}

function validatePoint(point, bounds, field, errors) {
  if (!object(point) || !Number.isFinite(point.longitude) || !Number.isFinite(point.latitude)) {
    errors.push(`${field}: must contain finite longitude and latitude`);
    return;
  }
  if (
    bounds
    && (point.longitude < bounds.west || point.longitude > bounds.east
      || point.latitude < bounds.south || point.latitude > bounds.north)
  ) errors.push(`${field}: must remain inside the frozen AOI`);
}

function validateLandmarkAssetContract(city, field, errors) {
  const contract = city.landmarkAssetContract;
  const assetField = `${field}.landmarkAssetContract`;
  if (!object(contract)) {
    errors.push(`${assetField}: must be an object`);
    return;
  }
  if (contract.schemaVersion !== 1) errors.push(`${assetField}.schemaVersion: must be 1`);
  if (contract.authoredGeometryOnly !== true) {
    errors.push(`${assetField}.authoredGeometryOnly: must be true`);
  }
  if (JSON.stringify(contract.requiredLods) !== JSON.stringify(REQUIRED_LANDMARK_LODS)) {
    errors.push(`${assetField}.requiredLods: must be 0, 1, 2`);
  }
  if (JSON.stringify(contract.requiredLightLods) !== JSON.stringify(REQUIRED_LIGHT_LODS)) {
    errors.push(`${assetField}.requiredLightLods: must be 0, 1`);
  }
  if (JSON.stringify(contract.allowedLightMaterialPrefixes) !== JSON.stringify(LIGHT_MATERIAL_PREFIXES)) {
    errors.push(`${assetField}.allowedLightMaterialPrefixes: only singular authored light prefixes are allowed`);
  }
  if (contract.wholeBuildingEmissionAllowed !== false) {
    errors.push(`${assetField}.wholeBuildingEmissionAllowed: must be false`);
  }
  if (JSON.stringify(contract.nightGoldenPlatforms) !== JSON.stringify(NIGHT_GOLDEN_PLATFORMS)) {
    errors.push(`${assetField}.nightGoldenPlatforms: must be desktop, mobile`);
  }

  const cameraIds = Array.isArray(city.canonicalCameras)
    ? city.canonicalCameras.map(({ id } = {}) => id)
    : [];
  if (JSON.stringify(contract.nightGoldenCameraIds) !== JSON.stringify(cameraIds)) {
    errors.push(`${assetField}.nightGoldenCameraIds: must cover every canonical camera in order`);
  }

  const landmarkById = new Map(Array.isArray(city.minimumLandmarks)
    ? city.minimumLandmarks.map((landmark) => [landmark.id, landmark])
    : []);
  const groupsByLandmark = contract.requiredMaterialGroupsByLandmark;
  if (!object(groupsByLandmark)) {
    errors.push(`${assetField}.requiredMaterialGroupsByLandmark: must be an object`);
    return;
  }
  const expectedIds = [...landmarkById.keys()];
  const actualIds = Object.keys(groupsByLandmark);
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    errors.push(`${assetField}.requiredMaterialGroupsByLandmark: must cover every minimum landmark in order`);
  }
  const ownedGroups = new Set();
  for (const landmarkId of actualIds) {
    const groupField = `${assetField}.requiredMaterialGroupsByLandmark.${landmarkId}`;
    const groups = groupsByLandmark[landmarkId];
    const landmark = landmarkById.get(landmarkId);
    if (!Array.isArray(groups)) {
      errors.push(`${groupField}: must be an array`);
      continue;
    }
    if (landmark?.assetClass !== 'terrain-hero' && groups.length === 0) {
      errors.push(`${groupField}: authored landmarks require at least one light material group`);
    }
    if (landmark?.assetClass === 'terrain-hero' && groups.length !== 0) {
      errors.push(`${groupField}: terrain heroes cannot invent landmark light geometry`);
    }
    const localGroups = new Set();
    for (const group of groups) {
      if (
        typeof group !== 'string'
        || !ID_RE.test(group)
        || !LIGHT_MATERIAL_PREFIXES.some((prefix) => group.startsWith(prefix))
      ) {
        errors.push(`${groupField}: ${String(group)} is not an allowed authored light material group`);
        continue;
      }
      if (localGroups.has(group)) errors.push(`${groupField}: duplicate ${group}`);
      if (ownedGroups.has(group)) errors.push(`${groupField}: ${group} is already owned by another landmark`);
      localGroups.add(group);
      ownedGroups.add(group);
    }
  }

  if (city.id === 'shanghai') {
    for (const [landmarkId, requiredGroups] of Object.entries(SHANGHAI_CORE_LIGHT_GROUPS)) {
      if (JSON.stringify(groupsByLandmark[landmarkId]) !== JSON.stringify(requiredGroups)) {
        errors.push(`${assetField}.requiredMaterialGroupsByLandmark.${landmarkId}: Shanghai core light groups are frozen`);
      }
    }
  }
}

function validateCity(city, index, errors) {
  const field = `cities[${index}]`;
  if (!object(city)) {
    errors.push(`${field}: must be an object`);
    return;
  }
  if (city.id !== CITY_IDS[index]) errors.push(`${field}.id: must be ${CITY_IDS[index]}`);
  if (city.contractStatus !== 'frozen-data-blocked') {
    errors.push(`${field}.contractStatus: must be frozen-data-blocked until a package is approved`);
  }
  if (!text(city.precinct?.labels?.en) || !text(city.precinct?.labels?.zh)) {
    errors.push(`${field}.precinct.labels: bilingual labels are required`);
  }
  const boundsValid = validateBounds(city.precinct?.boundsWgs84, `${field}.precinct.boundsWgs84`, errors);
  const bounds = boundsValid ? city.precinct.boundsWgs84 : null;
  validatePoint(city.coordinateFrame?.originWgs84, bounds, `${field}.coordinateFrame.originWgs84`, errors);
  if (city.coordinateFrame?.runtimeFrame !== 'ENU' || city.coordinateFrame?.unit !== 'metre') {
    errors.push(`${field}.coordinateFrame: runtimeFrame ENU and metre units are required`);
  }
  if (!text(city.coordinateFrame?.horizontal?.sourceCrs)) {
    errors.push(`${field}.coordinateFrame.horizontal.sourceCrs: must be non-empty`);
  }
  if (!['frozen', 'unresolved'].includes(city.coordinateFrame?.vertical?.status)) {
    errors.push(`${field}.coordinateFrame.vertical.status: invalid status`);
  }
  if (!text(city.coordinateFrame?.vertical?.datum)) {
    errors.push(`${field}.coordinateFrame.vertical.datum: must be explicit`);
  }
  if (!text(city.ianaTimeZone)) errors.push(`${field}.ianaTimeZone: must be non-empty`);

  const sourceLayers = city.sourceLayerRequirements;
  if (!Array.isArray(sourceLayers)) {
    errors.push(`${field}.sourceLayerRequirements: must be an array`);
  } else {
    const layerIds = new Set(sourceLayers.map(({ id }) => id));
    for (const id of REQUIRED_LAYERS) {
      if (!layerIds.has(id)) errors.push(`${field}.sourceLayerRequirements: missing ${id}`);
    }
    for (const [layerIndex, layer] of sourceLayers.entries()) {
      if (!ID_RE.test(String(layer.id || ''))) errors.push(`${field}.sourceLayerRequirements[${layerIndex}].id: invalid id`);
      if (!['blocked', 'candidate', 'verified'].includes(layer.status)) {
        errors.push(`${field}.sourceLayerRequirements[${layerIndex}].status: invalid status`);
      }
      if (!text(layer.acceptance)) errors.push(`${field}.sourceLayerRequirements[${layerIndex}].acceptance: required`);
    }
  }

  if (!Array.isArray(city.minimumLandmarks) || city.minimumLandmarks.length < 5) {
    errors.push(`${field}.minimumLandmarks: at least five landmarks are required`);
  } else {
    const ids = new Set();
    for (const [landmarkIndex, landmark] of city.minimumLandmarks.entries()) {
      const landmarkField = `${field}.minimumLandmarks[${landmarkIndex}]`;
      if (!ID_RE.test(String(landmark.id || ''))) errors.push(`${landmarkField}.id: invalid id`);
      if (ids.has(landmark.id)) errors.push(`${landmarkField}.id: duplicate ${landmark.id}`);
      ids.add(landmark.id);
      if (!text(landmark.names?.en) || !text(landmark.names?.zh)) errors.push(`${landmarkField}.names: bilingual names required`);
      if (!['authored-asset', 'authored-ensemble', 'terrain-hero'].includes(landmark.assetClass)) {
        errors.push(`${landmarkField}.assetClass: invalid value`);
      }
      if (!['blocked', 'dimension-reference-frozen'].includes(landmark.validationStatus)) {
        errors.push(`${landmarkField}.validationStatus: invalid value`);
      }
    }
  }

  if (!Array.isArray(city.canonicalCameras) || city.canonicalCameras.length < 5) {
    errors.push(`${field}.canonicalCameras: at least five cameras are required`);
  } else {
    const ids = new Set();
    for (const [cameraIndex, camera] of city.canonicalCameras.entries()) {
      const cameraField = `${field}.canonicalCameras[${cameraIndex}]`;
      if (!ID_RE.test(String(camera.id || ''))) errors.push(`${cameraField}.id: invalid id`);
      if (ids.has(camera.id)) errors.push(`${cameraField}.id: duplicate ${camera.id}`);
      ids.add(camera.id);
      if (!text(camera.labels?.en) || !text(camera.labels?.zh)) {
        errors.push(`${cameraField}.labels: bilingual labels are required`);
      }
      validatePoint(camera.positionWgs84, bounds, `${cameraField}.positionWgs84`, errors);
      validatePoint(camera.targetWgs84, bounds, `${cameraField}.targetWgs84`, errors);
      if (!Number.isFinite(camera.verticalFovDegrees) || camera.verticalFovDegrees <= 0 || camera.verticalFovDegrees >= 90) {
        errors.push(`${cameraField}.verticalFovDegrees: must be between 0 and 90`);
      }
      if (JSON.stringify(camera.environmentStates) !== JSON.stringify(ENVIRONMENT_STATES)) {
        errors.push(`${cameraField}.environmentStates: must be day, twilight, night`);
      }
    }
  }

  validateLandmarkAssetContract(city, field, errors);

  if (!Array.isArray(city.releaseBlockers) || city.releaseBlockers.length === 0) {
    errors.push(`${field}.releaseBlockers: unresolved blockers are required`);
  } else if (!city.releaseBlockers.every((blocker) => ID_RE.test(String(blocker.id || '')) && text(blocker.reason))) {
    errors.push(`${field}.releaseBlockers: every blocker requires an id and reason`);
  }
}

export function validateCityRealityContracts(data) {
  const errors = [];
  if (!object(data)) return { ok: false, errors: ['top-level: must be an object'] };
  if (data.schemaVersion !== 1) errors.push('schemaVersion: must be 1');
  if (!text(data.contractId)) errors.push('contractId: must be non-empty');
  if (data.frozenAt !== '2026-08-18') errors.push('frozenAt: must match the Wave 0 freeze date');
  if (JSON.stringify(data.truthModes) !== JSON.stringify(TRUTH_MODES)) {
    errors.push('truthModes: must be reality, construction-scenario, sandbox');
  }
  if (!Array.isArray(data.cities) || data.cities.length !== CITY_IDS.length) {
    errors.push('cities: exactly three ordered city contracts are required');
  } else {
    data.cities.forEach((city, index) => validateCity(city, index, errors));
  }
  if (!Array.isArray(data.rightsChecklist) || data.rightsChecklist.length === 0) {
    errors.push('rightsChecklist: must be a non-empty array');
  } else {
    const ids = new Set();
    for (const [index, item] of data.rightsChecklist.entries()) {
      if (!ID_RE.test(String(item.id || ''))) errors.push(`rightsChecklist[${index}].id: invalid id`);
      if (ids.has(item.id)) errors.push(`rightsChecklist[${index}].id: duplicate ${item.id}`);
      ids.add(item.id);
      if (!REVIEW_STATUSES.has(item.status)) errors.push(`rightsChecklist[${index}].status: invalid status`);
      if (!text(item.evidenceRequired)) errors.push(`rightsChecklist[${index}].evidenceRequired: required`);
    }
  }
  return { ok: errors.length === 0, errors };
}
