const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SHA256_RE = /^[a-f0-9]{64}$/;
const HTTPS_RE = /^https:\/\//;
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const CITY_IDS = Object.freeze(['shanghai', 'melbourne', 'hong-kong']);
const REQUIRED_LAYER_KINDS = Object.freeze([
  'buildings',
  'roads',
  'pedestrian',
  'water',
  'terrain',
  'vegetation',
  'imagery',
  'planning',
]);
const APPROVAL_ROLES = Object.freeze(['dataOwner', 'legal', 'engineering', 'productRelease']);
const APPROVAL_STATUSES = new Set(['review', 'approved', 'blocked', 'rejected']);
const DECISION_STATUSES = new Set(['review', 'approved', 'blocked', 'rejected']);
const RIGHT_STATUSES = new Set(['review', 'allowed', 'prohibited']);
const PRECINCT_STATUSES = new Set(['candidate-unverified', 'frozen']);
const INVENTORY_STATUSES = new Set(['not-started', 'draft', 'frozen']);
const CONTROL_POINT_STATUSES = new Set(['not-started', 'draft', 'verified']);
const GAP_STATUSES = new Set(['unresolved', 'blocked']);
const RELEASE_BLOCKER_STATUSES = new Set(['review', 'blocked', 'resolved']);

function object(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validSha(value) {
  return typeof value === 'string' && SHA256_RE.test(value);
}

function validHttps(value) {
  return typeof value === 'string' && HTTPS_RE.test(value);
}

function approvalIsComplete(value) {
  return object(value)
    && value.status === 'approved'
    && text(value.by)
    && DATE_RE.test(String(value.at || ''))
    && text(value.evidence);
}

function spatialMetadataIsVerified(spatial) {
  return object(spatial)
    && spatial.verificationStatus === 'verified'
    && text(spatial.horizontalCrs)
    && text(spatial.verticalDatum)
    && !/(?:unverified|unknown|review|resource-specific)/i.test(spatial.horizontalCrs)
    && !/(?:unverified|unknown|review|resource-specific)/i.test(spatial.verticalDatum);
}

function validateApproval(value, field, errors) {
  if (!object(value)) {
    errors.push(`${field}: must be an object`);
    return;
  }
  if (!APPROVAL_STATUSES.has(value.status)) errors.push(`${field}.status: invalid status`);
  if (value.status === 'approved' && !approvalIsComplete(value)) {
    errors.push(`${field}: approved status requires by, at and evidence`);
  }
}

function validateBounds(bounds, field, errors) {
  if (!object(bounds)) {
    errors.push(`${field}: must be an object`);
    return;
  }
  const values = ['west', 'south', 'east', 'north'];
  for (const key of values) {
    if (!Number.isFinite(bounds[key])) errors.push(`${field}.${key}: must be finite`);
  }
  if (
    values.every((key) => Number.isFinite(bounds[key]))
    && (!(bounds.west < bounds.east) || !(bounds.south < bounds.north))
  ) {
    errors.push(`${field}: must be ordered west/south/east/north`);
  }
}

export function validateCityLicenceEvidenceBundle(data) {
  const errors = [];
  if (!object(data)) return { ok: false, errors: ['top-level: must be an object'] };
  if (data.schemaVersion !== 1) errors.push('schemaVersion: must be 1');
  if (!ID_RE.test(String(data.bundleId || ''))) errors.push('bundleId: invalid id');
  if (data.snapshotKind !== 'normalized-official-record') {
    errors.push('snapshotKind: must be normalized-official-record');
  }
  if (!DATE_RE.test(String(data.retrievedAt || ''))) errors.push('retrievedAt: must be YYYY-MM-DD');
  if (data.legalApproval !== false) errors.push('legalApproval: evidence bundles must not grant legal approval');

  if (!Array.isArray(data.documents) || data.documents.length === 0) {
    errors.push('documents: must be a non-empty array');
  } else {
    const documentIds = new Set();
    data.documents.forEach((document, index) => {
      const field = `documents[${index}]`;
      if (!object(document)) {
        errors.push(`${field}: must be an object`);
        return;
      }
      if (!ID_RE.test(String(document.id || ''))) errors.push(`${field}.id: invalid id`);
      if (documentIds.has(document.id)) errors.push(`${field}.id: duplicate ${document.id}`);
      documentIds.add(document.id);
      if (!text(document.title)) errors.push(`${field}.title: must be non-empty`);
      if (!validHttps(document.url)) errors.push(`${field}.url: must be HTTPS`);
      if (!validSha(document.rawResponseSha256)) errors.push(`${field}.rawResponseSha256: must be SHA-256`);
      if (
        document.documentUpdatedAt !== null
        && !DATE_RE.test(String(document.documentUpdatedAt || ''))
      ) {
        errors.push(`${field}.documentUpdatedAt: must be null or YYYY-MM-DD`);
      }
      if (!Array.isArray(document.observations) || document.observations.length === 0) {
        errors.push(`${field}.observations: must be a non-empty array`);
      } else if (document.observations.some((observation) => !text(observation))) {
        errors.push(`${field}.observations: entries must be non-empty`);
      }
    });
  }

  if (!Array.isArray(data.records) || data.records.length === 0) {
    errors.push('records: must be a non-empty array');
  } else {
    const recordIds = new Set();
    const layerIds = new Set();
    data.records.forEach((record, index) => {
      const field = `records[${index}]`;
      if (!object(record)) {
        errors.push(`${field}: must be an object`);
        return;
      }
      if (!ID_RE.test(String(record.id || ''))) errors.push(`${field}.id: invalid id`);
      if (recordIds.has(record.id)) errors.push(`${field}.id: duplicate ${record.id}`);
      recordIds.add(record.id);
      if (!ID_RE.test(String(record.layerId || ''))) errors.push(`${field}.layerId: invalid id`);
      if (layerIds.has(record.layerId)) errors.push(`${field}.layerId: duplicate ${record.layerId}`);
      layerIds.add(record.layerId);
      if (!validHttps(record.recordEndpoint)) errors.push(`${field}.recordEndpoint: must be HTTPS`);
      if (!validSha(record.rawResponseSha256)) errors.push(`${field}.rawResponseSha256: must be SHA-256`);
      for (const key of ['datasetId', 'title', 'licenceLabel', 'publisher']) {
        if (!text(record[key])) errors.push(`${field}.${key}: must be non-empty`);
      }
      if (!validHttps(record.licenceUrl)) errors.push(`${field}.licenceUrl: must be HTTPS`);
    });
  }

  if (!Array.isArray(data.unresolved) || data.unresolved.length === 0) {
    errors.push('unresolved: must be a non-empty array');
  } else if (data.unresolved.some((item) => !text(item))) {
    errors.push('unresolved: entries must be non-empty');
  }

  return { ok: errors.length === 0, errors };
}

export function validateCityLedgerEvidenceReferences(ledger, evidenceByPath) {
  const errors = [];
  if (!object(ledger)) return { ok: false, errors: ['ledger: must be an object'] };
  if (!object(evidenceByPath)) return { ok: false, errors: ['evidenceByPath: must be an object'] };

  for (const city of ledger.cities || []) {
    for (const layer of city.layers || []) {
      if (!validSha(layer?.licence?.snapshotSha256)) continue;
      const field = `cities.${city.id}.layers.${layer.id}.licence`;
      const snapshotPath = layer.licence.snapshotPath;
      const evidence = evidenceByPath[snapshotPath];
      if (!object(evidence)) {
        errors.push(`${field}.snapshotPath: missing evidence ${snapshotPath}`);
        continue;
      }
      if (evidence.sha256 !== layer.licence.snapshotSha256) {
        errors.push(`${field}.snapshotSha256: does not match ${snapshotPath}`);
      }
      const record = evidence.data?.records?.find(({ id } = {}) => (
        id === layer.licence.snapshotRecordId
      ));
      if (!record) {
        errors.push(`${field}.snapshotRecordId: missing ${layer.licence.snapshotRecordId}`);
      } else if (record.layerId !== layer.id) {
        errors.push(`${field}.snapshotRecordId: record belongs to ${record.layerId}`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

function validateLayer(layer, city, index, errors, ids) {
  const field = `cities.${city.id}.layers[${index}]`;
  if (!object(layer)) {
    errors.push(`${field}: must be an object`);
    return;
  }
  if (!ID_RE.test(String(layer.id || ''))) errors.push(`${field}.id: invalid id`);
  if (ids.has(layer.id)) errors.push(`${field}.id: duplicate ${layer.id}`);
  ids.add(layer.id);
  for (const key of ['kind', 'role', 'provider', 'datasetId', 'title', 'datasetVersion', 'capturedAt', 'updateFrequency']) {
    if (!text(layer[key])) errors.push(`${field}.${key}: must be non-empty`);
  }
  if (!validHttps(layer.sourceUrl)) errors.push(`${field}.sourceUrl: must be HTTPS`);
  if (!DATE_RE.test(String(layer.retrievedAt || ''))) errors.push(`${field}.retrievedAt: must be YYYY-MM-DD`);
  if (layer.sourceArtifactSha256 !== null && !validSha(layer.sourceArtifactSha256)) {
    errors.push(`${field}.sourceArtifactSha256: must be null or SHA-256`);
  }
  if (validSha(layer.sourceArtifactSha256) && !/^data\/city\/inventory\/[a-z0-9-]+\.json$/.test(String(layer.sourceInventoryPath || ''))) {
    errors.push(`${field}.sourceInventoryPath: a local inventory JSON path is required`);
  }

  if (!object(layer.spatial)) {
    errors.push(`${field}.spatial: must be an object`);
  } else {
    for (const key of ['horizontalCrs', 'verticalDatum', 'verificationStatus']) {
      if (!text(layer.spatial[key])) errors.push(`${field}.spatial.${key}: must be non-empty`);
    }
  }

  if (!object(layer.licence)) {
    errors.push(`${field}.licence: must be an object`);
  } else {
    if (!text(layer.licence.id)) errors.push(`${field}.licence.id: must be non-empty`);
    if (!validHttps(layer.licence.url)) errors.push(`${field}.licence.url: must be HTTPS`);
    if (!text(layer.licence.attribution)) errors.push(`${field}.licence.attribution: must be non-empty`);
    if (layer.licence.snapshotSha256 !== null && !validSha(layer.licence.snapshotSha256)) {
      errors.push(`${field}.licence.snapshotSha256: must be null or SHA-256`);
    }
    if (validSha(layer.licence.snapshotSha256)) {
      if (!/^data\/city\/[a-z0-9-]+\.json$/.test(String(layer.licence.snapshotPath || ''))) {
        errors.push(`${field}.licence.snapshotPath: a local evidence JSON path is required`);
      }
      if (!ID_RE.test(String(layer.licence.snapshotRecordId || ''))) {
        errors.push(`${field}.licence.snapshotRecordId: invalid evidence record id`);
      }
    }
  }

  if (!object(layer.rights)) {
    errors.push(`${field}.rights: must be an object`);
  } else {
    for (const key of ['cache', 'derivatives', 'redistribution', 'commercialUse']) {
      if (!RIGHT_STATUSES.has(layer.rights[key])) errors.push(`${field}.rights.${key}: invalid status`);
    }
  }

  if (!object(layer.decisions)) {
    errors.push(`${field}.decisions: must be an object`);
  } else {
    for (const key of ['acquisition', 'production']) {
      if (!DECISION_STATUSES.has(layer.decisions[key])) errors.push(`${field}.decisions.${key}: invalid status`);
    }
  }

  if (!object(layer.approvals)) {
    errors.push(`${field}.approvals: must be an object`);
  } else {
    for (const role of APPROVAL_ROLES) validateApproval(layer.approvals[role], `${field}.approvals.${role}`, errors);
  }

  if (!object(layer.withdrawal) || !text(layer.withdrawal.ownerRole) || !text(layer.withdrawal.mechanism)) {
    errors.push(`${field}.withdrawal: ownerRole and mechanism are required`);
  }

  if (layer.decisions?.acquisition === 'approved' && !canAcquireCityLayer(layer)) {
    errors.push(`${field}: acquisition approval is missing licence snapshot or owner/legal evidence`);
  }
  if (layer.decisions?.production === 'approved' && !canPublishCityLayer(city, layer)) {
    errors.push(`${field}: production approval is missing a frozen precinct, rights, hashes, spatial QA or sign-off`);
  }
}

export function canAcquireCityLayer(layer) {
  return layer?.decisions?.acquisition === 'approved'
    && validSha(layer?.licence?.snapshotSha256)
    && approvalIsComplete(layer?.approvals?.dataOwner)
    && approvalIsComplete(layer?.approvals?.legal)
    && layer?.rights?.cache === 'allowed'
    && ['cache', 'derivatives', 'redistribution', 'commercialUse']
      .every((right) => layer?.rights?.[right] !== 'review');
}

export function canPublishCityLayer(city, layer) {
  return layer?.decisions?.production === 'approved'
    && canAcquireCityLayer(layer)
    && city?.precinct?.status === 'frozen'
    && city?.precinct?.tileInventoryStatus === 'frozen'
    && city?.precinct?.controlPointStatus === 'verified'
    && Array.isArray(city?.releaseBlockers)
    && city.releaseBlockers.every(({ status }) => status === 'resolved')
    && spatialMetadataIsVerified(layer?.spatial)
    && validSha(layer?.sourceArtifactSha256)
    && ['cache', 'derivatives', 'redistribution', 'commercialUse']
      .every((right) => layer?.rights?.[right] === 'allowed')
    && approvalIsComplete(layer?.approvals?.engineering)
    && approvalIsComplete(layer?.approvals?.productRelease);
}

export function validateCityDataLedger(data) {
  const errors = [];
  if (!object(data)) return { ok: false, errors: ['top-level: must be an object'] };
  if (data.schemaVersion !== 1) errors.push('schemaVersion: must be 1');
  if (!text(data.ledgerId)) errors.push('ledgerId: must be non-empty');
  if (!DATE_RE.test(String(data.lastReviewedAt || ''))) errors.push('lastReviewedAt: must be YYYY-MM-DD');
  if (!Array.isArray(data.requiredApprovalRoles) || data.requiredApprovalRoles.join(',') !== APPROVAL_ROLES.join(',')) {
    errors.push(`requiredApprovalRoles: must equal ${APPROVAL_ROLES.join(', ')}`);
  }
  if (!Array.isArray(data.requiredLayerKinds) || data.requiredLayerKinds.join(',') !== REQUIRED_LAYER_KINDS.join(',')) {
    errors.push(`requiredLayerKinds: must equal ${REQUIRED_LAYER_KINDS.join(', ')}`);
  }
  if (!Array.isArray(data.cities)) return { ok: false, errors: [...errors, 'cities: must be an array'] };
  if (data.cities.map(({ id } = {}) => id).join(',') !== CITY_IDS.join(',')) {
    errors.push(`cities: must equal ${CITY_IDS.join(', ')}`);
  }

  const ids = new Set();
  data.cities.forEach((city, cityIndex) => {
    const field = `cities[${cityIndex}]`;
    if (!object(city)) {
      errors.push(`${field}: must be an object`);
      return;
    }
    if (!text(city.experienceProfileId)) errors.push(`${field}.experienceProfileId: must be non-empty`);
    if (!object(city.precinct)) {
      errors.push(`${field}.precinct: must be an object`);
    } else {
      if (!text(city.precinct.labelEn) || !text(city.precinct.labelZh)) errors.push(`${field}.precinct: bilingual labels are required`);
      if (!PRECINCT_STATUSES.has(city.precinct.status)) errors.push(`${field}.precinct.status: invalid status`);
      if (!INVENTORY_STATUSES.has(city.precinct.tileInventoryStatus)) errors.push(`${field}.precinct.tileInventoryStatus: invalid status`);
      if (!CONTROL_POINT_STATUSES.has(city.precinct.controlPointStatus)) errors.push(`${field}.precinct.controlPointStatus: invalid status`);
      validateBounds(city.precinct.candidateBoundsWgs84, `${field}.precinct.candidateBoundsWgs84`, errors);
    }
    if (!Array.isArray(city.layers)) {
      errors.push(`${field}.layers: must be an array`);
      return;
    }
    if (!Array.isArray(city.releaseBlockers)) {
      errors.push(`${field}.releaseBlockers: must be an array`);
    } else {
      const blockerIds = new Set();
      city.releaseBlockers.forEach((blocker, index) => {
        const blockerField = `${field}.releaseBlockers[${index}]`;
        if (!object(blocker)) {
          errors.push(`${blockerField}: must be an object`);
          return;
        }
        if (!ID_RE.test(String(blocker.id || ''))) errors.push(`${blockerField}.id: invalid id`);
        if (blockerIds.has(blocker.id)) errors.push(`${blockerField}.id: duplicate ${blocker.id}`);
        blockerIds.add(blocker.id);
        if (!RELEASE_BLOCKER_STATUSES.has(blocker.status)) errors.push(`${blockerField}.status: invalid status`);
        if (!validHttps(blocker.evidenceUrl)) errors.push(`${blockerField}.evidenceUrl: must be HTTPS`);
        if (!text(blocker.reason)) errors.push(`${blockerField}.reason: must be non-empty`);
      });
    }
    city.layers.forEach((layer, index) => validateLayer(layer, city, index, errors, ids));
    if (!Array.isArray(city.coverageGaps)) {
      errors.push(`${field}.coverageGaps: must be an array`);
      return;
    }
    const layerKinds = new Set(city.layers.map((layer) => layer.kind));
    const gapKinds = new Set();
    city.coverageGaps.forEach((gap, index) => {
      const gapField = `${field}.coverageGaps[${index}]`;
      if (!object(gap) || !text(gap.kind) || !text(gap.reason) || !GAP_STATUSES.has(gap.status)) {
        errors.push(`${gapField}: kind, reason and valid status are required`);
        return;
      }
      if (gapKinds.has(gap.kind)) errors.push(`${gapField}.kind: duplicate ${gap.kind}`);
      gapKinds.add(gap.kind);
    });
    for (const kind of REQUIRED_LAYER_KINDS) {
      if (!layerKinds.has(kind) && !gapKinds.has(kind)) errors.push(`${field}: ${kind} needs a layer or documented gap`);
      if (layerKinds.has(kind) && gapKinds.has(kind)) errors.push(`${field}: ${kind} cannot be both a layer and a gap`);
    }
  });

  return { ok: errors.length === 0, errors };
}
