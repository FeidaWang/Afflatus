/* Pure validation for public/arena-picks.json (Part 4 SS18.1.1) -- the
   daily output of the Gatherer/Analyst/Reviewer pipeline (SS17.6) and the
   frontend's "Today's Recommended Trades" board (SS18.2.1). A scheduled
   task publishes this file unattended, so a structurally-broken write must
   fail loudly here rather than reach the page (same discipline as
   validateSignalEvents.js). */

const MODELS = ['S', 'P', 'T'];
const REGIMES = ['risk-on', 'neutral', 'risk-off'];

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}
function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function validatePick(p, tag, errors) {
  if (!p || typeof p !== 'object') { errors.push(`${tag}: not an object`); return; }
  if (!isNonEmptyString(p.sym)) errors.push(`${tag}.sym: missing or empty`);
  // long-only cash account (arenaRules.js): a recommendation can only ever be a long.
  if (p.side !== 'long') errors.push(`${tag}.side: must be "long" (the system is long-only), got ${JSON.stringify(p.side)}`);
  if (!isFiniteNumber(p.confidence) || p.confidence < 0 || p.confidence > 1) errors.push(`${tag}.confidence: must be a number in [0,1]`);
  for (const f of ['entry', 'stop', 'target']) {
    if (!isFiniteNumber(p[f]) || p[f] <= 0) errors.push(`${tag}.${f}: must be a positive number`);
  }
  if (!isNonEmptyString(p.thesis_en)) errors.push(`${tag}.thesis_en: missing or empty`);
  if (!isNonEmptyString(p.thesis_zh)) errors.push(`${tag}.thesis_zh: missing or empty`);
  if (!Array.isArray(p.signals) || !p.signals.length || !p.signals.every(isNonEmptyString)) {
    errors.push(`${tag}.signals: must be a non-empty array of non-empty strings`);
  }
}

/** @param {unknown} data parsed JSON (caller must JSON.parse first). */
export function validateArenaPicks(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, errors: ['top-level: must be an object'] };
  }
  if (!isNonEmptyString(data.date)) errors.push('date: missing or empty');
  if (!isNonEmptyString(data.generatedAt)) errors.push('generatedAt: missing or empty');
  if (!REGIMES.includes(data.regime)) errors.push(`regime: must be one of ${REGIMES.join('/')}, got ${JSON.stringify(data.regime)}`);
  if (!data.models || typeof data.models !== 'object') {
    errors.push('models: missing or not an object');
  } else {
    for (const key of MODELS) {
      const list = data.models[key];
      if (!Array.isArray(list)) { errors.push(`models.${key}: must be an array (empty is fine -- a model can propose nothing)`); continue; }
      list.forEach((p, i) => validatePick(p, `models.${key}[${i}]`, errors));
    }
  }
  if (!Array.isArray(data.quoteAllowlist)) {
    errors.push('quoteAllowlist: must be an array');
  } else if (!data.quoteAllowlist.every(isNonEmptyString)) {
    errors.push('quoteAllowlist: every entry must be a non-empty string');
  }
  // the allowlist is the whole point of SS18.4 API gating -- every picked symbol
  // must actually be reachable without an admin key, or the picks board would
  // render cards the page can't fetch quotes for.
  if (data.models && typeof data.models === 'object' && Array.isArray(data.quoteAllowlist)) {
    const allow = new Set(data.quoteAllowlist);
    for (const key of MODELS) {
      for (const p of data.models[key] || []) {
        if (p && p.sym && !allow.has(p.sym)) errors.push(`quoteAllowlist: missing "${p.sym}" which models.${key} recommends`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}
