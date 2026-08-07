const MODELS = ['S', 'P', 'T'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TICKER_RE = /^[A-Z]{1,5}(?:[.-][A-Z]{1,2})?$/;

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}
function validateModel(model, tag, errors) {
  if (!model || typeof model !== 'object' || Array.isArray(model)) {
    errors.push(`${tag}: must be an object`);
    return;
  }
  for (const field of ['startEquity', 'cash', 'equity', 'dayStartEquity']) {
    if (!finite(model[field])) errors.push(`${tag}.${field}: must be a finite number`);
  }
  for (const field of ['equityHistory', 'positions', 'trades', 'rejections']) {
    if (!Array.isArray(model[field])) errors.push(`${tag}.${field}: must be an array`);
  }
  for (const [index, position] of (model.positions || []).entries()) {
    const positionTag = `${tag}.positions[${index}]`;
    if (!TICKER_RE.test(String(position?.sym || ''))) errors.push(`${positionTag}.sym: invalid ticker`);
    for (const field of ['qty', 'avgPx', 'mkPx']) {
      if (!finite(position?.[field]) || position[field] <= 0) {
        errors.push(`${positionTag}.${field}: must be a positive finite number`);
      }
    }
  }
  for (const [index, point] of (model.equityHistory || []).entries()) {
    if (!Number.isInteger(point?.day) || !finite(point?.equity)) {
      errors.push(`${tag}.equityHistory[${index}]: needs integer day and finite equity`);
    }
  }
}

function validateLedger(data, modelNames) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, errors: ['top-level: must be an object'] };
  }
  if (!DATE_RE.test(String(data.updated || ''))) errors.push('updated: must be YYYY-MM-DD');
  if (!DATE_RE.test(String(data.lastRunDate || ''))) errors.push('lastRunDate: must be YYYY-MM-DD');
  if (!Number.isInteger(data.day) || data.day < 0) errors.push('day: must be a non-negative integer');
  if (!Number.isInteger(data.season) || data.season < 1) errors.push('season: must be a positive integer');
  if (!data.models || typeof data.models !== 'object' || Array.isArray(data.models)) {
    errors.push('models: must be an object');
  } else {
    for (const model of modelNames) validateModel(data.models[model], `models.${model}`, errors);
  }
  if (!data.bench || !finite(data.bench.spyPct) || !finite(data.bench.smhPct)) {
    errors.push('bench: needs finite spyPct and smhPct');
  }
  return { ok: errors.length === 0, errors };
}

export function validateArenaLedger(data) {
  return validateLedger(data, MODELS);
}

export function validateArenaLedgerArchive(data) {
  return validateLedger(data, ['A', 'B']);
}
