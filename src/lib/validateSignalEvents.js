/* Pure validation for public/signal-events.json's v2 schema (V6/V7, ROADMAP §7.3).
   Deterministic guard so an unattended scheduled task (V7) can never publish a
   syntactically-broken or structurally-wrong file — the JSON-quote bug caught by hand
   during V6 is exactly the class of mistake this exists to catch automatically, since
   nobody reviews the scheduled task's output before it commits+pushes. */

const PILLAR_KEYS = ['inflation_data', 'fed_policy', 'labor_market', 'earnings_guidance', 'industry_tech', 'geopolitics_trade'];
const TONES = ['green', 'amber', 'red'];
const INDEX_TOPICS = ['fed', 'fiscal', 'government', 'macro'];
const INDEX_STATUSES = ['decision', 'record', 'speech', 'action', 'implementation', 'guidance', 'proposal', 'pledge'];
const INDUSTRIES = ['compute', 'cloud', 'power', 'applications', 'security'];

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isHttpsUrl(v) {
  if (!isNonEmptyString(v)) return false;
  try { return new URL(v).protocol === 'https:'; } catch { return false; }
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
    if (!isHttpsUrl(ev.source)) pushErr(errors, `${tag}.source: must be a valid https URL`);
    validateBilingual(ev.name, `${tag}.name`, errors);
    for (const f of ['before', 'print', 'marketWindow', 'repricing', 'equityReaction', 'industryTransmission', 'verdict']) {
      validateBilingual(ev[f], `${tag}.${f}`, errors);
    }
    if (!Array.isArray(ev.marketSources) || ev.marketSources.length === 0) {
      pushErr(errors, `${tag}.marketSources: must be a non-empty array`);
    } else {
      for (const [j, source] of ev.marketSources.entries()) {
        const sourceTag = `${tag}.marketSources[${j}]`;
        if (!source || typeof source !== 'object') { pushErr(errors, `${sourceTag}: not an object`); continue; }
        if (!isHttpsUrl(source.url)) pushErr(errors, `${sourceTag}.url: must be a valid https URL`);
        if (!isNonEmptyString(source.label_en)) pushErr(errors, `${sourceTag}.label_en: missing or empty`);
        if (!isNonEmptyString(source.label_zh)) pushErr(errors, `${sourceTag}.label_zh: missing or empty`);
      }
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
  if (data.indexVersion != null) validatePolicyIndex(data, errors);
  return { ok: errors.length === 0, errors };
}

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function validatePolicyIndex(data, errors) {
  if (data.indexVersion !== 1) errors.push('indexVersion: expected 1');
  for (const key of ['checked_at', 'coverage_start', 'updated']) {
    if (!validDate(data[key])) errors.push(`${key}: expected a real ISO date`);
  }
  if (data.coverage_start > data.checked_at) errors.push('coverage_start: must not follow checked_at');
  if (data.checked_at > data.updated) errors.push('checked_at: must not follow updated');
  validateBilingual(data.coverage_note, 'coverage_note', errors);
  validateBilingual(data.overview?.summary, 'overview.summary', errors);
  const rate = data.overview?.policyRate;
  if (!rate || !Number.isFinite(rate.lower) || !Number.isFinite(rate.upper) || rate.lower >= rate.upper || !validDate(rate.date) || !isHttpsUrl(rate.source)) {
    errors.push('overview.policyRate: requires bounds, date and HTTPS source');
  }
  const events = Array.isArray(data.events) ? data.events : [];
  for (const [i, event] of events.entries()) {
    const tag = `events[${i}]`;
    if (!event || typeof event !== 'object') continue;
    if (!validDate(event.date) || event.date < data.coverage_start || event.date > data.checked_at) errors.push(`${tag}.date: must fall within the verified coverage period`);
    if (!INDEX_TOPICS.includes(event.topic)) errors.push(`${tag}.topic: unknown topic`);
    if (!INDEX_STATUSES.includes(event.status)) errors.push(`${tag}.status: unknown policy status`);
    if (!isNonEmptyString(event.agency)) errors.push(`${tag}.agency: required`);
    if (!Array.isArray(event.sectors) || !event.sectors.length || event.sectors.some(key => !INDUSTRIES.includes(key))) errors.push(`${tag}.sectors: requires known industries`);
    if (event.rate && (event.topic !== 'fed' || event.status !== 'decision' || !Number.isFinite(event.rate.lower) || !Number.isFinite(event.rate.upper) || event.rate.lower >= event.rate.upper || !Number.isFinite(event.rate.changeBps) || !isNonEmptyString(event.rate.vote))) errors.push(`${tag}.rate: invalid FOMC decision`);
  }
  const latest = events.filter(event => event?.rate && validDate(event.date)).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!latest || latest.date !== rate?.date || latest.rate.lower !== rate?.lower || latest.rate.upper !== rate?.upper || latest.source !== rate?.source) errors.push('overview.policyRate: must match the latest recorded decision');
  if (!Array.isArray(data.schedule)) errors.push('schedule: requires an array');
  else for (const [i, item] of data.schedule.entries()) {
    if (!item || !validDate(item.date) || !isHttpsUrl(item.source)) errors.push(`schedule[${i}]: requires date and HTTPS source`);
    validateBilingual(item?.name, `schedule[${i}].name`, errors);
  }
}
