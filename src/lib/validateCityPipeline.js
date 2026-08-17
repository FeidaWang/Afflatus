const SHA256_RE = /^[a-f0-9]{64}$/;
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RAW_PATH_RE = /^data\/city\/raw\/[a-z0-9-/]+\.(?:geojson|zip)$/;
const HEADERS_PATH_RE = /^data\/city\/raw\/[a-z0-9-/]+\.headers\.json$/;
const EVIDENCE_PATH_RE = /^data\/city\/(?:reviews|inventory)\/[a-z0-9-/]+\.(?:md|json)$/;

const object = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const validSha = (value) => typeof value === 'string' && SHA256_RE.test(value);
const validHttps = (value) => typeof value === 'string' && /^https:\/\//.test(value);
const validInstant = (value) => typeof value === 'string' && value.includes('T') && Number.isFinite(Date.parse(value));
const validArchiveMemberPath = (value) => (
  text(value)
  && !String(value).startsWith('/')
  && !String(value).includes('\\')
  && !String(value).split('/').includes('..')
  && /\.(?:docx|geojson|json|pdf|tif|txt)$/i.test(String(value))
);

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
  ) errors.push(`${field}: must be ordered`);
}

export function validateCityRawInventory(data) {
  const errors = [];
  if (!object(data)) return { ok: false, errors: ['top-level: must be an object'] };
  if (data.schemaVersion !== 1) errors.push('schemaVersion: must be 1');
  for (const key of ['artifactId', 'cityId', 'layerId', 'datasetId', 'datasetVersion']) {
    if (!ID_RE.test(String(data[key] || ''))) errors.push(`${key}: invalid id`);
  }
  for (const key of ['title', 'provider', 'sourceFormat']) {
    if (!text(data[key])) errors.push(`${key}: must be non-empty`);
  }
  if (!validHttps(data.sourceRecordUrl)) errors.push('sourceRecordUrl: must be HTTPS');
  if (!validHttps(data.acquisitionUrl)) errors.push('acquisitionUrl: must be HTTPS');
  validateBounds(data.queryBoundsWgs84, 'queryBoundsWgs84', errors);
  if (!validInstant(data.retrievedAt)) errors.push('retrievedAt: must be an ISO timestamp');
  if (!RAW_PATH_RE.test(String(data.rawPath || ''))) errors.push('rawPath: must be an isolated GeoJSON or ZIP path');
  const hasResponseHeaders = HEADERS_PATH_RE.test(String(data.responseHeadersPath || ''))
    && validSha(data.responseHeadersSha256);
  const hasDeliveryEvidence = EVIDENCE_PATH_RE.test(String(data.deliveryEvidencePath || ''))
    && text(data.deliveryOrderId);
  if (!hasResponseHeaders && !hasDeliveryEvidence) {
    errors.push('transport evidence: HTTP headers or a DataShare delivery record is required');
  }
  if (!validSha(data.rawSha256)) errors.push('rawSha256: must be SHA-256');
  if (!Number.isSafeInteger(data.rawByteLength) || data.rawByteLength <= 0) errors.push('rawByteLength: must be positive');
  if (!Number.isSafeInteger(data.featureCount) || data.featureCount <= 0) errors.push('featureCount: must be positive');
  if (!object(data.sourceCrs) || !text(data.sourceCrs.identifier) || !text(data.sourceCrs.axisOrder) || !text(data.sourceCrs.unit) || !text(data.sourceCrs.evidence)) {
    errors.push('sourceCrs: complete CRS evidence is required');
  }
  if (!object(data.verticalDatum) || !text(data.verticalDatum.identifier) || !text(data.verticalDatum.unit) || !text(data.verticalDatum.evidence)) {
    errors.push('verticalDatum: complete datum evidence is required');
  }
  if (!object(data.licence) || !validHttps(data.licence.url) || !validSha(data.licence.snapshotSha256) || !text(data.licence.attribution)) {
    errors.push('licence: URL, snapshot SHA-256 and attribution are required');
  }
  if (!EVIDENCE_PATH_RE.test(String(data.acquisitionApprovalEvidence || ''))) {
    errors.push('acquisitionApprovalEvidence: invalid evidence path');
  }
  if (data.sourceStrategyEvidence !== undefined && !EVIDENCE_PATH_RE.test(String(data.sourceStrategyEvidence))) {
    errors.push('sourceStrategyEvidence: invalid evidence path');
  }
  if (String(data.rawPath || '').endsWith('.zip')) {
    if (!Array.isArray(data.archiveMembers) || data.archiveMembers.length === 0) {
      errors.push('archiveMembers: ZIP inventory must list its members');
    } else {
      for (const [index, member] of data.archiveMembers.entries()) {
        if (!object(member) || !validArchiveMemberPath(member.path)) {
          errors.push(`archiveMembers[${index}].path: invalid safe member path`);
        }
        if (!Number.isSafeInteger(member.byteLength) || member.byteLength <= 0) {
          errors.push(`archiveMembers[${index}].byteLength: must be positive`);
        }
        if (!validSha(member.sha256)) errors.push(`archiveMembers[${index}].sha256: must be SHA-256`);
        if (/\.(?:geojson|json)$/i.test(String(member.path || ''))) {
          if (!Number.isSafeInteger(member.featureCount) || member.featureCount <= 0) {
            errors.push(`archiveMembers[${index}].featureCount: must be positive`);
          }
          if (!text(member.geometryType)) errors.push(`archiveMembers[${index}].geometryType: required`);
        } else if (/\.tif$/i.test(String(member.path || ''))) {
          if (!Number.isSafeInteger(member.cellCount) || member.cellCount <= 0) {
            errors.push(`archiveMembers[${index}].cellCount: must be positive`);
          }
          if (member.dataKind !== 'raster') errors.push(`archiveMembers[${index}].dataKind: raster required`);
        } else if (!text(member.dataKind)) {
          errors.push(`archiveMembers[${index}].dataKind: required`);
        }
      }
    }
  }
  if (data.verificationArchive !== undefined) {
    const archive = data.verificationArchive;
    if (
      !object(archive)
      || !RAW_PATH_RE.test(String(archive.rawPath || ''))
      || !validSha(archive.rawSha256)
      || !Number.isSafeInteger(archive.rawByteLength)
      || archive.rawByteLength <= 0
      || !Number.isSafeInteger(archive.memberCount)
      || archive.memberCount <= 0
    ) errors.push('verificationArchive: complete isolated archive evidence is required');
  }
  if (data.productionApproved !== false) errors.push('productionApproved: raw inventory must remain false');
  return { ok: errors.length === 0, errors };
}

export function validateCityGeometryQaReport(data) {
  const errors = [];
  if (!object(data)) return { ok: false, errors: ['top-level: must be an object'] };
  if (data.schemaVersion !== 1) errors.push('schemaVersion: must be 1');
  if (!ID_RE.test(String(data.reportId || ''))) errors.push('reportId: invalid id');
  if (!ID_RE.test(String(data.pipelineVersion || ''))) errors.push('pipelineVersion: invalid id');
  if (![
    'building-polygon',
    'linear-network',
    'hydrography',
    'vegetation-point',
    'survey-control-point',
    'terrain-raster',
  ].includes(data.geometryKind)) {
    errors.push('geometryKind: invalid geometry kind');
  }
  if (!['passed', 'passed-with-exclusions'].includes(data.status)) errors.push('status: invalid status');
  if (!ID_RE.test(String(data.artifactId || ''))) errors.push('artifactId: invalid id');
  for (const key of ['rawSha256', 'workSha256', 'goldenFixtureSha256']) {
    if (!validSha(data[key])) errors.push(`${key}: must be SHA-256`);
  }
  for (const key of ['rawFeatureCount', 'acceptedEntityCount', 'excludedFeatureCount', 'duplicateEntityIds']) {
    if (!Number.isSafeInteger(data[key]) || data[key] < 0) errors.push(`${key}: must be a non-negative integer`);
  }
  if (
    Number.isSafeInteger(data.rawFeatureCount)
    && data.acceptedEntityCount + data.excludedFeatureCount !== data.rawFeatureCount
  ) errors.push('feature counts: accepted + excluded must equal raw');
  if (!object(data.exclusions) || !object(data.controlPoints) || !object(data.checks)) {
    errors.push('exclusions, controlPoints and checks must be objects');
  }
  const commonChecks = [
    'rawHashMatchesInventory',
    'featureCountMatchesInventory',
    'entityIdsUnique',
    'coordinatesFinite',
    'clippedToBounds',
  ];
  const geometryChecks = {
    'building-polygon': ['heightsOrdered'],
    'linear-network': ['lengthsPositive', 'lineEndpointsFinite', 'stableTopologyIdsPresent'],
    hydrography: ['waterAreaPositive', 'shorelinePositive', 'structureLengthsPositive', 'stableTopologyIdsPresent'],
    'vegetation-point': [
          'pointCoordinatesFinite',
          'stableAssetIdsPresent',
          'dimensionsNonNegative',
          'locationClassPresent',
          'sourceCoordinateRepresentationsChecked',
    ],
    'survey-control-point': [
      'sourceDmsCoordinateFieldsChecked',
      'sourceMga2020CoordinateFieldsChecked',
      'allControlsStatusOk',
      'allControlsGda2020Adjusted',
      'allControlsAhdAdjusted',
      'uncertaintiesFinite',
      'publishedCoordinateResidualWithinTwoCentimetres',
      'serviceGeometryDatumDriftClassified',
    ],
    'terrain-raster': [
      'sourceArchivesMatchInventory',
      'nativeRasterMetadataMatches',
      'nativeRasterCellsMatch',
      'sourceCrsResolved',
      'verticalDatumResolved',
      'nativeResolutionTenMetres',
      'elevationsFinite',
      'surveyControlResidualsClassified',
      'neighbourhoodResidualsWithinPublishedVerticalAccuracy',
    ],
  }[data.geometryKind] || [];
  if (object(data.checks) && [...commonChecks, ...geometryChecks].some((key) => data.checks[key] !== true)) {
    errors.push('checks: all geometry integrity checks must pass');
  }
  if (data.checks?.productionApproved !== false) errors.push('checks.productionApproved: must remain false');
  return { ok: errors.length === 0, errors };
}

export function validateCityCrossLayerQaReport(data) {
  const errors = [];
  if (!object(data)) return { ok: false, errors: ['top-level: must be an object'] };
  if (data.schemaVersion !== 1) errors.push('schemaVersion: must be 1');
  if (!ID_RE.test(String(data.reportId || ''))) errors.push('reportId: invalid id');
  if (!ID_RE.test(String(data.pipelineVersion || ''))) errors.push('pipelineVersion: invalid id');
  if (!['passed', 'passed-with-findings'].includes(data.status)) errors.push('status: invalid status');
  if (data.productionApproved !== false) errors.push('productionApproved: must remain false');
  if (!Array.isArray(data.sourceLayers) || data.sourceLayers.length !== 7) {
    errors.push('sourceLayers: exactly seven Melbourne source layers are required');
  } else {
    for (const [index, layer] of data.sourceLayers.entries()) {
      if (!object(layer) || !ID_RE.test(String(layer.layerId || '')) || !ID_RE.test(String(layer.artifactId || ''))) {
        errors.push(`sourceLayers[${index}]: invalid layer or artifact id`);
      }
      if (!validSha(layer.workSha256)) errors.push(`sourceLayers[${index}].workSha256: invalid SHA-256`);
      if (!/^data\/city\/qa\/[a-z0-9-/]+\.json$/.test(String(layer.qaPath || ''))) {
        errors.push(`sourceLayers[${index}].qaPath: invalid QA path`);
      }
    }
  }
  if (!object(data.metrics) || !object(data.checks)) errors.push('metrics and checks must be objects');
  const requiredChecks = [
    'sourceWorkHashesMatchQa',
    'sharedClipBounds',
    'sharedLocalAnchor',
    'coordinatesFinite',
    'buildingWaterOverlapsClassified',
    'treeNetworkProximitySane',
    'surveyControlAuthoritativeFieldsVerified',
    'terrainNativeFormatsMatch',
    'terrainSurveyControlResidualsClassified',
  ];
  if (object(data.checks) && requiredChecks.some((key) => data.checks[key] !== true)) {
    errors.push('checks: all cross-layer integrity checks must pass');
  }
  if (!Array.isArray(data.findings)) {
    errors.push('findings: must be an array');
  } else {
    const hasBlocker = data.findings.some(({ severity }) => severity === 'blocker');
    if (data.releaseBlocked !== hasBlocker) {
      errors.push('releaseBlocked: must match the presence of blocker findings');
    }
    if (data.status === 'passed' && data.findings.length > 0) {
      errors.push('status: passed reports cannot retain findings');
    }
  }
  return { ok: errors.length === 0, errors };
}
