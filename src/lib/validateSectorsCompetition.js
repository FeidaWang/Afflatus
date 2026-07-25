/* Pure validation for public/sectors-competition.json (urgent.md Part 3, RB-P0-02).

   Same contract as validateSectorsData.js / validateSignalEvents.js: this is the
   shape gate that runs between "a human or an LLM edits the weekly dataset" and
   "publish". The one rule that matters beyond shape is the provenance rule — every
   numeric leaf must declare a tier, and a leaf may only claim `verified` when it
   also carries a source URL. That is what stops an unsourced number from reaching
   the page wearing a verified badge. */

const TIERS = ['verified', 'reported', 'estimate', 'derived', 'pending'];
const BLOCS = ['US', 'CN', 'neutral'];
const ROUTES = ['closed', 'open'];
const MARKETS = ['US', 'A', 'HK'];
const LAYERS = ['compute', 'silicon', 'foundry', 'memory', 'equipment', 'cloud', 'model', 'application'];
const FAMILIES = ['intelligence', 'professional', 'operational', 'economic', 'linguistic'];
const SCORE_AXES = ['compute', 'algorithms', 'capital', 'data'];

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isNumberOrNull(v) {
  return v === null || (typeof v === 'number' && Number.isFinite(v));
}

function isUrl(v) {
  return isNonEmptyString(v) && /^https?:\/\//.test(v);
}

/** A provenance-wrapped leaf: value may be null, tier is required, and `verified`
 *  additionally requires a source URL. */
function validateLeaf(leaf, path, errors, { requireValue = false } = {}) {
  if (!leaf || typeof leaf !== 'object') {
    errors.push(`${path}: must be an object with value/tier`);
    return;
  }
  if (!TIERS.includes(leaf.tier)) {
    errors.push(`${path}.tier: must be one of ${TIERS.join('/')}, got ${JSON.stringify(leaf.tier)}`);
  }
  if (leaf.tier === 'verified' && !isUrl(leaf.src)) {
    errors.push(`${path}: tier "verified" requires an http(s) src`);
  }
  if (leaf.tier === 'pending' && leaf.value !== null && leaf.value !== undefined) {
    errors.push(`${path}: tier "pending" must not carry a value`);
  }
  if (requireValue && !Number.isFinite(leaf.value)) {
    errors.push(`${path}.value: must be a finite number`);
  }
}

function validateBilingual(item, path, keys, errors) {
  for (const key of keys) {
    if (!isNonEmptyString(item?.[`${key}_en`])) errors.push(`${path}.${key}_en: missing or empty`);
    if (!isNonEmptyString(item?.[`${key}_zh`])) errors.push(`${path}.${key}_zh: missing or empty`);
  }
}

function validateRadarAxes(axes, errors) {
  if (!Array.isArray(axes) || axes.length < 3) {
    errors.push('radarAxes: must be an array of at least 3 axes');
    return [];
  }
  const ids = [];
  for (const [i, axis] of axes.entries()) {
    const tag = `radarAxes[${i}]`;
    if (!isNonEmptyString(axis?.id)) { errors.push(`${tag}.id: missing`); continue; }
    if (ids.includes(axis.id)) errors.push(`${tag}.id: duplicate "${axis.id}"`);
    ids.push(axis.id);
    validateBilingual(axis, tag, ['label', 'metric'], errors);
    if (!isNonEmptyString(axis.unit)) errors.push(`${tag}.unit: missing`);
  }
  return ids;
}

function validateBenchColumns(columns, errors) {
  if (!Array.isArray(columns) || !columns.length) {
    errors.push('benchColumns: must be a non-empty array');
    return [];
  }
  const ids = [];
  for (const [i, column] of columns.entries()) {
    const tag = `benchColumns[${i}]`;
    if (!isNonEmptyString(column?.id)) { errors.push(`${tag}.id: missing`); continue; }
    if (ids.includes(column.id)) errors.push(`${tag}.id: duplicate "${column.id}"`);
    ids.push(column.id);
    validateBilingual(column, tag, ['label'], errors);
    if (!FAMILIES.includes(column.family)) {
      errors.push(`${tag}.family: must be one of ${FAMILIES.join('/')}, got ${JSON.stringify(column.family)}`);
    }
    // A column that declares itself deliberately empty must say why, in both
    // languages — that note is the whole point of keeping the column.
    if (column.status && !isNonEmptyString(column.note_en)) {
      errors.push(`${tag}: status "${column.status}" requires note_en/note_zh`);
    }
  }
  return ids;
}

function validateModels(models, axisIds, benchIds, errors) {
  if (!Array.isArray(models) || !models.length) {
    errors.push('models: must be a non-empty array');
    return [];
  }
  const ids = [];
  for (const [i, model] of models.entries()) {
    const tag = `models[${i}]`;
    if (!isNonEmptyString(model?.id)) { errors.push(`${tag}.id: missing`); continue; }
    if (ids.includes(model.id)) errors.push(`${tag}.id: duplicate "${model.id}"`);
    ids.push(model.id);
    if (!isNonEmptyString(model.vendor)) errors.push(`${tag}.vendor: missing`);
    if (!isNonEmptyString(model.name)) errors.push(`${tag}.name: missing`);
    if (!BLOCS.includes(model.bloc)) errors.push(`${tag}.bloc: must be one of ${BLOCS.join('/')}`);
    if (!ROUTES.includes(model.route)) errors.push(`${tag}.route: must be one of ${ROUTES.join('/')}`);
    validateBilingual(model, tag, ['notes'], errors);

    validateLeaf(model.pricing, `${tag}.pricing`, errors);
    if (model.pricing && typeof model.pricing === 'object') {
      if (!isNumberOrNull(model.pricing.in_per_m)) errors.push(`${tag}.pricing.in_per_m: must be a number or null`);
      if (!isNumberOrNull(model.pricing.out_per_m)) errors.push(`${tag}.pricing.out_per_m: must be a number or null`);
      if (model.pricing.tier !== 'pending' && !Number.isFinite(model.pricing.in_per_m)) {
        errors.push(`${tag}.pricing: a non-pending price must have a numeric in_per_m`);
      }
    }

    if (!Array.isArray(model.bench)) {
      errors.push(`${tag}.bench: must be an array`);
    } else {
      const seen = new Set();
      for (const [j, row] of model.bench.entries()) {
        const rowTag = `${tag}.bench[${j}]`;
        if (!benchIds.includes(row?.id)) {
          errors.push(`${rowTag}.id: "${row?.id}" is not a declared benchColumns id`);
          continue;
        }
        if (seen.has(row.id)) errors.push(`${rowTag}.id: duplicate "${row.id}" for this model`);
        seen.add(row.id);
        if (!isNumberOrNull(row.value)) errors.push(`${rowTag}.value: must be a number or null`);
        validateLeaf(row, rowTag, errors);
      }
    }

    if (!Array.isArray(model.speed)) errors.push(`${tag}.speed: must be an array`);
    else {
      for (const [j, row] of model.speed.entries()) {
        const rowTag = `${tag}.speed[${j}]`;
        if (!isNonEmptyString(row?.provider)) errors.push(`${rowTag}.provider: missing`);
        if (!isNumberOrNull(row?.ttft_s)) errors.push(`${rowTag}.ttft_s: must be a number or null`);
        if (!isNumberOrNull(row?.tpot_tps)) errors.push(`${rowTag}.tpot_tps: must be a number or null`);
        validateLeaf(row, rowTag, errors);
      }
    }

    // Radar axes are declared once; a model that carries a radar block may only
    // reference declared axes. Missing axes are a legitimate gap, not an error.
    if (model.radar && typeof model.radar === 'object') {
      for (const key of Object.keys(model.radar)) {
        if (!axisIds.includes(key)) errors.push(`${tag}.radar.${key}: not a declared radarAxes id`);
      }
    }
  }
  return ids;
}

function validateEquities(equities, modelVendors, errors) {
  if (!Array.isArray(equities) || !equities.length) {
    errors.push('equities: must be a non-empty array');
    return;
  }
  const ids = new Set();
  for (const [i, item] of equities.entries()) {
    const tag = `equities[${i}]`;
    if (!isNonEmptyString(item?.id)) { errors.push(`${tag}.id: missing`); continue; }
    if (ids.has(item.id)) errors.push(`${tag}.id: duplicate "${item.id}"`);
    ids.add(item.id);
    if (!isNonEmptyString(item.ticker)) errors.push(`${tag}.ticker: missing`);
    if (!isNonEmptyString(item.exchange)) errors.push(`${tag}.exchange: missing`);
    if (!MARKETS.includes(item.market)) errors.push(`${tag}.market: must be one of ${MARKETS.join('/')}`);
    if (!BLOCS.includes(item.bloc)) errors.push(`${tag}.bloc: must be one of ${BLOCS.join('/')}`);
    if (!LAYERS.includes(item.layer)) errors.push(`${tag}.layer: must be one of ${LAYERS.join('/')}`);
    validateBilingual(item, tag, ['thesis', 'risk'], errors);
    validateLeaf(item.conviction, `${tag}.conviction`, errors, { requireValue: true });
    if (!Array.isArray(item.kpis)) errors.push(`${tag}.kpis: must be an array`);
    else {
      for (const [j, kpi] of item.kpis.entries()) {
        const kpiTag = `${tag}.kpis[${j}]`;
        validateBilingual(kpi, kpiTag, ['label'], errors);
        if (!isNonEmptyString(kpi.value)) errors.push(`${kpiTag}.value: missing`);
        validateLeaf(kpi, kpiTag, errors);
      }
    }
    // Dangling relationship IDs are rejected: a link must resolve to a vendor
    // that actually exists in models[] (ROADMAP Part 1 §3.3).
    if (!Array.isArray(item.links)) errors.push(`${tag}.links: must be an array`);
    else {
      for (const [j, link] of item.links.entries()) {
        const linkTag = `${tag}.links[${j}]`;
        if (!isNonEmptyString(link?.type)) errors.push(`${linkTag}.type: missing`);
        if (!isNonEmptyString(link?.to)) errors.push(`${linkTag}.to: missing`);
      }
    }
  }
}

function validateScoreboard(scoreboard, errors) {
  if (!scoreboard || typeof scoreboard !== 'object') {
    errors.push('scoreboard: must be an object');
    return;
  }
  validateBilingual(scoreboard, 'scoreboard', ['outlook', 'weights_note'], errors);
  const weights = scoreboard.weights;
  if (!weights || typeof weights !== 'object') {
    errors.push('scoreboard.weights: must be an object');
  } else {
    let total = 0;
    for (const axis of SCORE_AXES) {
      const weight = weights[axis];
      if (!Number.isFinite(weight) || weight <= 0) errors.push(`scoreboard.weights.${axis}: must be a positive number`);
      else total += weight;
    }
    if (Math.abs(total - 1) > 1e-6) errors.push(`scoreboard.weights: must sum to 1, got ${total}`);
  }
  if (!Array.isArray(scoreboard.axes) || scoreboard.axes.length !== SCORE_AXES.length) {
    errors.push(`scoreboard.axes: must contain exactly ${SCORE_AXES.length} axes`);
    return;
  }
  for (const [i, axis] of scoreboard.axes.entries()) {
    const tag = `scoreboard.axes[${i}]`;
    if (!SCORE_AXES.includes(axis?.id)) errors.push(`${tag}.id: must be one of ${SCORE_AXES.join('/')}`);
    validateBilingual(axis, tag, ['label', 'method', 'evidence'], errors);
    for (const side of ['us', 'cn']) {
      const score = axis?.[side];
      if (!Number.isFinite(score) || score < 1 || score > 100) errors.push(`${tag}.${side}: must be a number in [1,100]`);
    }
    if (!TIERS.includes(axis?.tier)) errors.push(`${tag}.tier: must be one of ${TIERS.join('/')}`);
  }
}

/**
 * @param {unknown} data parsed public/sectors-competition.json
 * @returns {{ok: boolean, errors: string[]}}
 */
export function validateSectorsCompetition(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, errors: ['top-level value must be an object'] };
  }
  if (data.schemaVersion !== 'competition/v1') {
    errors.push(`schemaVersion: must be "competition/v1", got ${JSON.stringify(data.schemaVersion)}`);
  }
  if (!isNonEmptyString(data.updated)) errors.push('updated: missing or empty');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.as_of || '')) errors.push('as_of: must be YYYY-MM-DD');
  validateBilingual(data, 'root', ['title', 'provenance_note'], errors);

  const axisIds = validateRadarAxes(data.radarAxes, errors);
  const benchIds = validateBenchColumns(data.benchColumns, errors);
  const modelIds = validateModels(data.models, axisIds, benchIds, errors);
  validateEquities(data.equities, modelIds, errors);
  validateScoreboard(data.scoreboard, errors);

  return { ok: errors.length === 0, errors };
}
