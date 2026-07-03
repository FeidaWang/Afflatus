/* Pure validation for public/signal-events.json's v2 schema (V6/V7, ROADMAP §7.3).
   Deterministic guard so an unattended scheduled task (V7) can never publish a
   syntactically-broken or structurally-wrong file — the JSON-quote bug caught by hand
   during V6 is exactly the class of mistake this exists to catch automatically, since
   nobody reviews the scheduled task's output before it commits+pushes. */

const PILLAR_KEYS = ['inflation_data', 'fed_policy', 'earnings_guidance', 'industry_tech', 'geopolitics_trade'];
const TONES = ['green', 'amber', 'red'];

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function pushErr(errors, msg) {
  errors.push(msg);
}

function validateBilingual(obj, path, errors) {
  if (!obj || typeof obj !== 'object') {
    pushErr(errors, `${path}: missing or not an object`);
    return;
  }
  if (!isNonEmptyString(obj.en)) pushErr(errors, `${path}.en: missing or empty`);
  if (!isNonEmptyString(obj.zh)) pushErr(errors, `${path}.zh: missing or empty`);
}

function validateHawkDoveCompass(hd, errors) {
  if (!hd || typeof hd !== 'object') {
    pushErr(errors, 'hawkDoveCompass: missing or not an object');
    return;
  }
  if (typeof hd.score !== 'number' || Number.isNaN(hd.score) || hd.score < -2 || hd.score > 2) {
    pushErr(errors, `hawkDoveCompass.score: must be a number in [-2, 2], got ${JSON.stringify(hd.score)}`);
  }
  for (const f of ['label_en', 'label_zh', 'rationale_en', 'rationale_zh', 'method_en', 'method_zh', 'asOf']) {
    if (!isNonEmptyString(hd[f])) pushErr(errors, `hawkDoveCompass.${f}: missing or empty`);
  }
}

function validatePillars(pillars, errors) {
  if (!Array.isArray(pillars)) {
    pushErr(errors, 'pillars: must be an array');
    return;
  }
  if (pillars.length !== 5) pushErr(errors, `pillars: expected exactly 5, got ${pillars.length}`);
  const seenIds = new Set();
  for (const [i, p] of pillars.entries()) {
    const tag = `pillars[${i}]`;
    if (!p || typeof p !== 'object') { pushErr(errors, `${tag}: not an object`); continue; }
    if (!Number.isInteger(p.id) || p.id < 1 || p.id > 5) pushErr(errors, `${tag}.id: must be an integer 1-5, got ${JSON.stringify(p.id)}`);
    else seenIds.add(p.id);
    if (p.key && !PILLAR_KEYS.includes(p.key)) pushErr(errors, `${tag}.key: unrecognized "${p.key}"`);
    if (!TONES.includes(p.tone)) pushErr(errors, `${tag}.tone: must be one of ${TONES.join('/')}, got ${JSON.stringify(p.tone)}`);
    for (const f of ['name_en', 'name_zh', 'status_en', 'status_zh', 'read_en', 'read_zh']) {
      if (!isNonEmptyString(p[f])) pushErr(errors, `${tag}.${f}: missing or empty`);
    }
  }
  if (seenIds.size !== 5 && pillars.length === 5) pushErr(errors, `pillars: ids must cover 1-5 uniquely, got [${[...seenIds].sort().join(',')}]`);
}

function validateEvents(events, errors) {
  if (!Array.isArray(events)) {
    pushErr(errors, 'events: must be an array');
    return;
  }
  const seenIds = new Set();
  for (const [i, ev] of events.entries()) {
    const tag = `events[${i}]`;
    if (!ev || typeof ev !== 'object') { pushErr(errors, `${tag}: not an object`); continue; }
    if (!isNonEmptyString(ev.id)) pushErr(errors, `${tag}.id: missing or empty`);
    else if (seenIds.has(ev.id)) pushErr(errors, `${tag}.id: duplicate id "${ev.id}"`);
    else seenIds.add(ev.id);
    if (!isNonEmptyString(ev.date)) pushErr(errors, `${tag}.date: missing or empty`);
    if (ev.pillar != null && (!Number.isInteger(ev.pillar) || ev.pillar < 1 || ev.pillar > 5)) {
      pushErr(errors, `${tag}.pillar: must be null or an integer 1-5, got ${JSON.stringify(ev.pillar)}`);
    }
    if (ev.hawkDove != null && (typeof ev.hawkDove !== 'number' || ev.hawkDove < -2 || ev.hawkDove > 2)) {
      pushErr(errors, `${tag}.hawkDove: must be null or a number in [-2, 2], got ${JSON.stringify(ev.hawkDove)}`);
    }
    validateBilingual(ev.name, `${tag}.name`, errors);
    for (const f of ['before', 'print', 'repricing', 'equityReaction', 'verdict']) {
      if (ev[f] != null) validateBilingual(ev[f], `${tag}.${f}`, errors);
    }
  }
}

/** @param {unknown} data parsed JSON (caller must JSON.parse first — a throw there means invalid JSON, report that separately). */
export function validateSignalEvents(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, errors: ['top-level: must be an object (v1 bare-array schema is no longer supported since V6)'] };
  }
  if (data.version !== 2) errors.push(`version: expected 2, got ${JSON.stringify(data.version)}`);
  if (!isNonEmptyString(data.updated)) errors.push('updated: missing or empty');
  if (!isNonEmptyString(data.as_of)) errors.push('as_of: missing or empty');
  validateHawkDoveCompass(data.hawkDoveCompass, errors);
  validateBilingual(data.pillarSummary, 'pillarSummary', errors);
  validatePillars(data.pillars, errors);
  validateEvents(data.events, errors);
  return { ok: errors.length === 0, errors };
}
