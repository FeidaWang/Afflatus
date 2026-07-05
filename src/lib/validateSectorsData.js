/* Pure validation for public/sectors-data.json's schema (V9-V11, ROADMAP §7.2).
   Same purpose as validateSignalEvents.js: the sectors-watch scheduled task runs two
   LLM prompts unattended (prompts/sectors-watch.md then prompts/postmemory-top10.md,
   same weekly run) and nobody reviews the diff before it commits+pushes — this is the
   syntax/shape gate that runs between "LLM drafts" and "publish". Field names here
   intentionally match the two prompts' own JSON schemas verbatim (see prompts/), since
   those are the literal output contract the model is instructed to produce. */

const VENDORS = ['anthropic', 'openai', 'zhipu', 'alibaba'];
const ROUTES = ['closed', 'open'];
const MARKETS = ['US', 'CN'];
const RELATIONS = ['direct', 'supplier', 'infra', 'competitor'];
const TRACK_IDS = ['T1', 'T2', 'T3'];
const CARD_STATUS = ['unchanged', 'updated'];
const PM_MODES = ['weekly', 'monthly_deep'];

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isConfidence(v) {
  return typeof v === 'number' && !Number.isNaN(v) && v >= 0 && v <= 1;
}

function pushErr(errors, msg) {
  errors.push(msg);
}

function validateDevelopments(devs, path, errors) {
  if (!Array.isArray(devs)) { pushErr(errors, `${path}: must be an array`); return; }
  if (devs.length > 3) pushErr(errors, `${path}: at most 3 developments allowed, got ${devs.length}`);
  for (const [i, d] of devs.entries()) {
    const tag = `${path}[${i}]`;
    if (!d || typeof d !== 'object') { pushErr(errors, `${tag}: not an object`); continue; }
    if (!isNonEmptyString(d.t_zh)) pushErr(errors, `${tag}.t_zh: missing or empty`);
    if (!isNonEmptyString(d.t_en)) pushErr(errors, `${tag}.t_en: missing or empty`);
    if (!isNonEmptyString(d.src)) pushErr(errors, `${tag}.src: missing or empty`);
    if (!isConfidence(d.confidence)) pushErr(errors, `${tag}.confidence: must be a number in [0,1], got ${JSON.stringify(d.confidence)}`);
  }
}

function validateModelWatch(modelWatch, errors) {
  if (!Array.isArray(modelWatch)) { pushErr(errors, 'modelWatch: must be an array'); return; }
  const seen = new Set();
  for (const [i, card] of modelWatch.entries()) {
    const tag = `modelWatch[${i}]`;
    if (!card || typeof card !== 'object') { pushErr(errors, `${tag}: not an object`); continue; }
    if (!VENDORS.includes(card.vendor)) pushErr(errors, `${tag}.vendor: must be one of ${VENDORS.join('/')}, got ${JSON.stringify(card.vendor)}`);
    else if (seen.has(card.vendor)) pushErr(errors, `${tag}.vendor: duplicate "${card.vendor}"`);
    else seen.add(card.vendor);
    if (!ROUTES.includes(card.route)) pushErr(errors, `${tag}.route: must be one of ${ROUTES.join('/')}, got ${JSON.stringify(card.route)}`);
    if (!isNonEmptyString(card.current_line)) pushErr(errors, `${tag}.current_line: missing or empty`);
    validateDevelopments(card.developments, `${tag}.developments`, errors);
    if (!isNonEmptyString(card.gap_note_zh)) pushErr(errors, `${tag}.gap_note_zh: missing or empty`);
    if (!isNonEmptyString(card.gap_note_en)) pushErr(errors, `${tag}.gap_note_en: missing or empty`);
  }
}

function validateBaskets(baskets, errors) {
  if (!Array.isArray(baskets)) { pushErr(errors, 'baskets: must be an array'); return; }
  for (const [i, b] of baskets.entries()) {
    const tag = `baskets[${i}]`;
    if (!b || typeof b !== 'object') { pushErr(errors, `${tag}: not an object`); continue; }
    if (!VENDORS.includes(b.vendor)) pushErr(errors, `${tag}.vendor: must be one of ${VENDORS.join('/')}, got ${JSON.stringify(b.vendor)}`);
    if (!MARKETS.includes(b.market)) pushErr(errors, `${tag}.market: must be one of ${MARKETS.join('/')}, got ${JSON.stringify(b.market)}`);
    if (!Array.isArray(b.equities)) { pushErr(errors, `${tag}.equities: must be an array`); continue; }
    for (const [j, e] of b.equities.entries()) {
      const etag = `${tag}.equities[${j}]`;
      if (!e || typeof e !== 'object') { pushErr(errors, `${etag}: not an object`); continue; }
      if (!isNonEmptyString(e.ticker)) pushErr(errors, `${etag}.ticker: missing or empty`);
      if (!RELATIONS.includes(e.relation)) pushErr(errors, `${etag}.relation: must be one of ${RELATIONS.join('/')}, got ${JSON.stringify(e.relation)}`);
      if (e.correlation_note_zh != null && typeof e.correlation_note_zh !== 'string') pushErr(errors, `${etag}.correlation_note_zh: must be a string`);
      if (!isConfidence(e.confidence)) pushErr(errors, `${etag}.confidence: must be a number in [0,1], got ${JSON.stringify(e.confidence)}`);
      // Ticker mapping discipline (prompts/sectors-watch.md): never a numeric correlation coefficient.
      if (typeof e.correlation === 'number') pushErr(errors, `${etag}.correlation: numeric correlation coefficients are not allowed here (qualitative correlation_note_zh only)`);
    }
  }
}

function validateTracks(tracks, errors) {
  if (!Array.isArray(tracks)) { pushErr(errors, 'postMemory.tracks: must be an array'); return; }
  const seen = new Set();
  for (const [i, t] of tracks.entries()) {
    const tag = `postMemory.tracks[${i}]`;
    if (!t || typeof t !== 'object') { pushErr(errors, `${tag}: not an object`); continue; }
    if (!TRACK_IDS.includes(t.id)) pushErr(errors, `${tag}.id: must be one of ${TRACK_IDS.join('/')}, got ${JSON.stringify(t.id)}`);
    else if (seen.has(t.id)) pushErr(errors, `${tag}.id: duplicate "${t.id}"`);
    else seen.add(t.id);
    if (!isNonEmptyString(t.state_zh)) pushErr(errors, `${tag}.state_zh: missing or empty`);
    if (!isNonEmptyString(t.state_en)) pushErr(errors, `${tag}.state_en: missing or empty`);
  }
}

function validateCatalysts(catalysts, path, errors) {
  if (!Array.isArray(catalysts)) { pushErr(errors, `${path}: must be an array`); return; }
  for (const [i, c] of catalysts.entries()) {
    const tag = `${path}[${i}]`;
    if (!c || typeof c !== 'object') { pushErr(errors, `${tag}: not an object`); continue; }
    if (!isNonEmptyString(c.what)) pushErr(errors, `${tag}.what: missing or empty`);
    if (!isNonEmptyString(c.when)) pushErr(errors, `${tag}.when: missing or empty`);
    if (c.src != null && typeof c.src !== 'string') pushErr(errors, `${tag}.src: must be a string`);
  }
}

function validateCards(cards, errors) {
  if (!Array.isArray(cards)) { pushErr(errors, 'postMemory.cards: must be an array'); return; }
  const seen = new Set();
  for (const [i, c] of cards.entries()) {
    const tag = `postMemory.cards[${i}]`;
    if (!c || typeof c !== 'object') { pushErr(errors, `${tag}: not an object`); continue; }
    if (!isNonEmptyString(c.ticker)) pushErr(errors, `${tag}.ticker: missing or empty`);
    else if (seen.has(c.ticker)) pushErr(errors, `${tag}.ticker: duplicate "${c.ticker}"`);
    else seen.add(c.ticker);
    if (!Array.isArray(c.tracks) || c.tracks.length === 0 || !c.tracks.every((t) => TRACK_IDS.includes(t))) {
      pushErr(errors, `${tag}.tracks: must be a non-empty array of ${TRACK_IDS.join('/')}, got ${JSON.stringify(c.tracks)}`);
    }
    if (!CARD_STATUS.includes(c.status)) pushErr(errors, `${tag}.status: must be one of ${CARD_STATUS.join('/')}, got ${JSON.stringify(c.status)}`);
    for (const f of ['moat_zh', 'thesis_zh', 'key_risk_zh', 'moat_en', 'thesis_en', 'key_risk_en']) {
      if (!isNonEmptyString(c[f])) pushErr(errors, `${tag}.${f}: missing or empty`);
    }
    validateCatalysts(c.catalysts, `${tag}.catalysts`, errors);
    if (!isConfidence(c.confidence)) pushErr(errors, `${tag}.confidence: must be a number in [0,1], got ${JSON.stringify(c.confidence)}`);
    if (!isNonEmptyString(c.last_reviewed)) pushErr(errors, `${tag}.last_reviewed: missing or empty`);
  }
}

function validateSwapProposals(proposals, errors) {
  if (proposals == null) return; // optional — most weeks propose nothing
  if (!Array.isArray(proposals)) { pushErr(errors, 'postMemory.swap_proposals: must be an array when present'); return; }
  for (const [i, p] of proposals.entries()) {
    const tag = `postMemory.swap_proposals[${i}]`;
    if (!p || typeof p !== 'object') { pushErr(errors, `${tag}: not an object`); continue; }
    if (!isNonEmptyString(p.out)) pushErr(errors, `${tag}.out: missing or empty`);
    if (!isNonEmptyString(p.in)) pushErr(errors, `${tag}.in: missing or empty`);
    if (!isNonEmptyString(p.why_zh)) pushErr(errors, `${tag}.why_zh: missing or empty`);
    if (p.src != null && typeof p.src !== 'string') pushErr(errors, `${tag}.src: must be a string`);
  }
}

function validatePostMemory(pm, errors) {
  if (!pm || typeof pm !== 'object') { pushErr(errors, 'postMemory: missing or not an object'); return; }
  if (!isNonEmptyString(pm.as_of)) pushErr(errors, 'postMemory.as_of: missing or empty');
  if (!PM_MODES.includes(pm.mode)) pushErr(errors, `postMemory.mode: must be one of ${PM_MODES.join('/')}, got ${JSON.stringify(pm.mode)}`);
  validateTracks(pm.tracks, errors);
  validateCards(pm.cards, errors);
  validateSwapProposals(pm.swap_proposals, errors);
  if (!isNonEmptyString(pm.take_zh)) pushErr(errors, 'postMemory.take_zh: missing or empty');
  if (!isNonEmptyString(pm.take_en)) pushErr(errors, 'postMemory.take_en: missing or empty');
}

/** @param {unknown} data parsed JSON (caller must JSON.parse first). */
export function validateSectorsData(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, errors: ['top-level: must be an object'] };
  }
  if (data.version !== 1) errors.push(`version: expected 1, got ${JSON.stringify(data.version)}`);

  // Empty-seed state (before the first scheduled run has ever populated the file):
  // "updated" is null and modelWatch/baskets/postMemory are all absent. That's valid —
  // the front end renders an explicit "not yet populated" empty state rather than fake data.
  const seeded = data.updated === null && data.modelWatch === undefined && data.baskets === undefined && data.postMemory === undefined;
  if (seeded) return { ok: errors.length === 0, errors };

  if (!isNonEmptyString(data.updated)) errors.push('updated: missing or empty');
  if (!isNonEmptyString(data.as_of)) errors.push('as_of: missing or empty');
  validateModelWatch(data.modelWatch, errors);
  if (Array.isArray(data.modelWatch) && data.modelWatch.length > 0 && data.modelWatch.length !== 4) {
    errors.push(`modelWatch: expected 4 vendor cards when populated, got ${data.modelWatch.length}`);
  }
  validateBaskets(data.baskets, errors);
  if (data.weeklyTake != null) {
    if (typeof data.weeklyTake !== 'object') errors.push('weeklyTake: must be an object');
    else {
      if (!isNonEmptyString(data.weeklyTake.zh)) errors.push('weeklyTake.zh: missing or empty');
      if (!isNonEmptyString(data.weeklyTake.en)) errors.push('weeklyTake.en: missing or empty');
    }
  }
  validatePostMemory(data.postMemory, errors);

  return { ok: errors.length === 0, errors };
}
