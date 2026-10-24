/* ============================================================
   RELATIONSHIPS v2 · contract (REL-010). Runtime schema for the
   Relationships kernel, after the owner's v2 package
   (contracts/relationships.types.ts), reconciled with this repo:

   - BirthInput gains `fixedOffset` for the page's legacy manual offset
     (UTC±h + "DST in effect" box); a named `timezone` and a fixed offset
     are mutually exclusive.
   - RelationshipReport gains `legacy`: the pre-v2 scores the current page
     still shows, under their own modelId, until the six-dimension scale
     replaces them (REL-070: two models are never mixed or compared).

   Pure: no DOM, network, storage or clock. Every number that cannot be
   computed is null, never 0 or 50.
   ============================================================ */

export const SCHEMA_VERSION = '2.0.0';
export const ENGINE_VERSION = 'rel-engine-0.1.0';
export const CONFIG_VERSION = 'rel-config-2026-10-24';

export const SYSTEM_IDS = ['bazi', 'ziwei', 'western', 'xiu'];
export const BASIS = ['computed', 'reported', 'unverified', 'conflicted'];
export const MODULE_STATUS = ['ready', 'partial', 'unverified', 'unsupported', 'failed'];
export const DIMENSION_IDS = ['attraction', 'emotional_support', 'communication', 'rhythm', 'building', 'growth'];
export const RULE_STATES = ['matched', 'absent', 'unknown', 'conflicted'];

export const ERROR_CODES = Object.freeze({
  REQUEST_INVALID: 'REQUEST_INVALID',
  SCHEMA_VERSION_MISMATCH: 'SCHEMA_VERSION_MISMATCH',
  REQUEST_ID_INVALID: 'REQUEST_ID_INVALID',
  FIELD_UNEXPECTED: 'FIELD_UNEXPECTED',
  DATE_INVALID: 'DATE_INVALID',
  DATE_OUT_OF_RANGE: 'DATE_OUT_OF_RANGE',
  CALENDAR_UNSUPPORTED: 'CALENDAR_UNSUPPORTED',
  TIME_INVALID: 'TIME_INVALID',
  RANGE_INVALID: 'RANGE_INVALID',
  TIMEZONE_INVALID: 'TIMEZONE_INVALID',
  TIMEZONE_CONFLICT: 'TIMEZONE_CONFLICT',
  OFFSET_INVALID: 'OFFSET_INVALID',
  PLACE_INVALID: 'PLACE_INVALID',
  ROLE_INVALID: 'ROLE_INVALID',
  CONFIG_UNSUPPORTED: 'CONFIG_UNSUPPORTED',
  MODEL_UNSUPPORTED: 'MODEL_UNSUPPORTED',
  INTERNAL: 'INTERNAL',
});

export class RelationshipError extends Error {
  constructor(code, fieldKeys = [], { retryable = false } = {}) {
    super(code);
    this.name = 'RelationshipError';
    this.code = code;
    this.fieldKeys = fieldKeys;
    this.retryable = retryable;
  }
}

// Supported method configuration. Anything else is refused with
// CONFIG_UNSUPPORTED rather than silently computed another way.
export const DEFAULT_CONFIG = Object.freeze({
  configVersion: CONFIG_VERSION,
  bazi: { dayBoundary: '23:00', timeBasis: 'civil', methodVersion: 'bazi-r0-2026-10-23' },
  ziwei: { dayBoundary: '00:00', timeBasis: 'civil', leapMonthRuleId: 'leap-as-host-month', fourTransformationsTableId: 'none', methodVersion: 'ziwei-ming-r0-2026-10-23' },
  western: { zodiac: 'tropical', ephemerisBackendId: 'meeus-sun-moon+astronomy-engine-2.1.19', aspectPolicyId: 'orbs-8-4-6-6-8' },
  xiu: { natalMethodId: 'xiuyao-month-start-27', natalDayBoundary: '00:00' },
});

// What the kernel can and cannot do (REL-010 capability statement).
export const CAPABILITIES = Object.freeze({
  dateRange: ['1900-01-01', '2100-12-31'],
  calendars: ['gregorian'],
  unsupported: [
    'chinese_lunar input calendar',
    'mean or apparent solar time',
    'sidereal zodiac, house systems',
    'ziwei four transformations, three-sides-four-corners scoring',
    'xiu automatic scoring (tables not independently verified)',
  ],
});

// Source registry referenced by Fact.sourceIds (licence record: docs/relationships-v2-2026-10-23/SOURCES_AND_LICENSES).
export const SOURCE_IDS = Object.freeze({
  bazi: 'src.repo.bazi',
  ziping: 'src.repo.ziping',
  meeus: 'src.meeus-low-precision',
  astronomyEngine: 'src.astronomy-engine-2.1.19-mit',
  ziwei: 'src.repo.ziwei',
  xiuyao: 'src.xiuyao-jing-unverified',
  lunar: 'src.repo.lunar-table',
  tzIntl: 'src.tzdb-via-intl',
  cnDst: 'src.repo.cn-dst-1986-1991',
  original: 'src.original-editorial',
});

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;
const MAX_TZ_LEN = 64;

export const minutesOf = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

// Gregorian date check that never lets Date roll 02-30 forward.
export function parseLocalDate(s) {
  const m = DATE_RE.exec(typeof s === 'string' ? s : '');
  if (!m) return null;
  const [y, mo, d] = m.slice(1).map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() + 1 !== mo || t.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

function unexpectedKeys(obj, allowed, field, errors) {
  for (const k of Object.keys(obj)) if (!allowed.includes(k)) errors.push({ code: ERROR_CODES.FIELD_UNEXPECTED, field: `${field}.${k}` });
}

// IANA names are checked by the platform's own tz database. The check is
// deterministic for a given browser build and needs no clock.
export function isKnownTimeZone(name) {
  if (typeof name !== 'string' || !name || name.length > MAX_TZ_LEN) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: name }); return true; } catch { return false; }
}

function validateTime(t, field, errors) {
  if (!isObj(t)) { errors.push({ code: ERROR_CODES.TIME_INVALID, field }); return; }
  if (t.kind === 'unknown') { unexpectedKeys(t, ['kind'], field, errors); return; }
  if (t.kind === 'exact') {
    unexpectedKeys(t, ['kind', 'localTime', 'precision', 'uncertaintyMinutes'], field, errors);
    if (!HHMM.test(t.localTime ?? '') || t.precision !== 'minute') errors.push({ code: ERROR_CODES.TIME_INVALID, field: `${field}.localTime` });
    if (t.uncertaintyMinutes != null && !(Number.isInteger(t.uncertaintyMinutes) && t.uncertaintyMinutes >= 0 && t.uncertaintyMinutes <= 720)) {
      errors.push({ code: ERROR_CODES.TIME_INVALID, field: `${field}.uncertaintyMinutes` });
    }
    return;
  }
  if (t.kind === 'range') {
    unexpectedKeys(t, ['kind', 'start', 'end', 'endDayOffset'], field, errors);
    if (!HHMM.test(t.start ?? '') || !HHMM.test(t.end ?? '') || (t.endDayOffset !== 0 && t.endDayOffset !== 1)) {
      errors.push({ code: ERROR_CODES.TIME_INVALID, field }); return;
    }
    const span = minutesOf(t.end) + t.endDayOffset * 1440 - minutesOf(t.start);
    if (span <= 0 || span > 1440) errors.push({ code: ERROR_CODES.RANGE_INVALID, field });
    return;
  }
  errors.push({ code: ERROR_CODES.TIME_INVALID, field: `${field}.kind` });
}

export function validateBirthInput(b, field, errors) {
  if (!isObj(b)) { errors.push({ code: ERROR_CODES.REQUEST_INVALID, field }); return; }
  unexpectedKeys(b, ['localDate', 'calendar', 'isLeapLunarMonth', 'time', 'place', 'timezone', 'fixedOffset', 'traditionRole'], field, errors);
  const date = parseLocalDate(b.localDate);
  if (!date) errors.push({ code: ERROR_CODES.DATE_INVALID, field: `${field}.localDate` });
  else if (b.localDate < CAPABILITIES.dateRange[0] || b.localDate > CAPABILITIES.dateRange[1]) errors.push({ code: ERROR_CODES.DATE_OUT_OF_RANGE, field: `${field}.localDate` });
  if (b.calendar !== 'gregorian') {
    errors.push({ code: b.calendar === 'chinese_lunar' ? ERROR_CODES.CALENDAR_UNSUPPORTED : ERROR_CODES.REQUEST_INVALID, field: `${field}.calendar` });
  }
  if (b.isLeapLunarMonth != null) errors.push({ code: ERROR_CODES.CALENDAR_UNSUPPORTED, field: `${field}.isLeapLunarMonth` });
  validateTime(b.time, `${field}.time`, errors);
  if (b.timezone != null && b.fixedOffset != null) errors.push({ code: ERROR_CODES.TIMEZONE_CONFLICT, field: `${field}.timezone` });
  if (b.timezone != null && !isKnownTimeZone(b.timezone)) errors.push({ code: ERROR_CODES.TIMEZONE_INVALID, field: `${field}.timezone` });
  if (b.fixedOffset != null) {
    const f = b.fixedOffset;
    if (!isObj(f) || !Number.isInteger(f.minutes) || f.minutes < -720 || f.minutes > 840 || typeof f.dst !== 'boolean' || Object.keys(f).some((k) => k !== 'minutes' && k !== 'dst')) {
      errors.push({ code: ERROR_CODES.OFFSET_INVALID, field: `${field}.fixedOffset` });
    }
  }
  if (b.place != null) {
    const p = b.place;
    const ok = isObj(p) && Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180
      && (p.precision === 'city' || p.precision === 'coordinate') && Object.keys(p).every((k) => ['latitude', 'longitude', 'precision'].includes(k));
    if (!ok) errors.push({ code: ERROR_CODES.PLACE_INVALID, field: `${field}.place` });
  }
  if (b.traditionRole != null && !['male', 'female', 'unspecified'].includes(b.traditionRole)) errors.push({ code: ERROR_CODES.ROLE_INVALID, field: `${field}.traditionRole` });
}

const sameJSON = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function validateConfig(config, errors) {
  if (!isObj(config) || config.configVersion !== CONFIG_VERSION) { errors.push({ code: ERROR_CODES.CONFIG_UNSUPPORTED, field: 'config.configVersion' }); return; }
  for (const sys of SYSTEM_IDS) {
    if (!sameJSON(config[sys], DEFAULT_CONFIG[sys])) errors.push({ code: ERROR_CODES.CONFIG_UNSUPPORTED, field: `config.${sys}` });
  }
}

/** @returns {{ok:true}|{ok:false, errors:{code:string, field:string}[]}} */
export function validateComputeRequest(req, supportedModels) {
  const errors = [];
  if (!isObj(req)) return { ok: false, errors: [{ code: ERROR_CODES.REQUEST_INVALID, field: 'request' }] };
  unexpectedKeys(req, ['schemaVersion', 'requestId', 'A', 'B', 'config', 'scoreModelId'], 'request', errors);
  if (req.schemaVersion !== SCHEMA_VERSION) errors.push({ code: ERROR_CODES.SCHEMA_VERSION_MISMATCH, field: 'schemaVersion' });
  if (typeof req.requestId !== 'string' || !REQUEST_ID.test(req.requestId)) errors.push({ code: ERROR_CODES.REQUEST_ID_INVALID, field: 'requestId' });
  validateBirthInput(req.A, 'A', errors);
  validateBirthInput(req.B, 'B', errors);
  validateConfig(req.config, errors);
  if (!supportedModels.includes(req.scoreModelId)) errors.push({ code: ERROR_CODES.MODEL_UNSUPPORTED, field: 'scoreModelId' });
  return errors.length ? { ok: false, errors } : { ok: true };
}

export function assertComputeRequest(req, supportedModels) {
  const v = validateComputeRequest(req, supportedModels);
  if (!v.ok) throw new RelationshipError(v.errors[0].code, [...new Set(v.errors.map((e) => e.field))]);
}

// Shape check for a report arriving from a Worker (version skew, truncated
// or foreign messages). Not a full schema; it guards what renderers read.
export function validateReport(r) {
  const ok = isObj(r) && r.schemaVersion === SCHEMA_VERSION && r.engineVersion === ENGINE_VERSION
    && typeof r.requestId === 'string' && MODULE_STATUS.includes(r.status)
    && isObj(r.modules) && SYSTEM_IDS.every((s) => isObj(r.modules[s]) && MODULE_STATUS.includes(r.modules[s].status))
    && Array.isArray(r.facts) && Array.isArray(r.rules) && isObj(r.dimensions)
    && isObj(r.overall) && (r.overall.value === null || Number.isFinite(r.overall.value))
    && isObj(r.archetypes) && isObj(r.archetypes.A_to_B) && isObj(r.archetypes.B_to_A) && Array.isArray(r.warnings);
  return ok;
}
