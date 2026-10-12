/** Deterministic research primitives. All times use explicit UTC/offset ISO strings. */
export class ResearchError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ResearchError';
    this.code = code;
    this.details = details;
  }
}

export function requireCondition(condition, code, message, details = {}) {
  if (!condition) throw new ResearchError(code, message, details);
}

export function record(value, name = 'input') {
  requireCondition(value !== null && typeof value === 'object' && !Array.isArray(value),
    'INVALID_OBJECT', `${name} must be an object.`);
  return value;
}

export function finite(value, name, { min = -Infinity, max = Infinity, exclusiveMin = false } = {}) {
  requireCondition(typeof value === 'number' && Number.isFinite(value),
    'INVALID_NUMBER', `${name} must be a finite number.`, { field: name });
  requireCondition((exclusiveMin ? value > min : value >= min) && value <= max,
    'NUMBER_OUT_OF_RANGE', `${name} is outside its supported range.`, { field: name, min, max });
  return value;
}

export function nonempty(value, name, maxLength = 5000) {
  requireCondition(typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength,
    'INVALID_STRING', `${name} must be a nonempty string of at most ${maxLength} characters.`, { field: name });
  return value.trim();
}

export function time(value, name = 'timestamp') {
  nonempty(value, name, 64);
  requireCondition(/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value),
    'INVALID_TIMESTAMP', `${name} must be an ISO date or an ISO timestamp with timezone.`, { field: name });
  const day = value.slice(0, 10);
  const dayTime = Date.parse(`${day}T00:00:00Z`);
  const result = Date.parse(value);
  requireCondition(Number.isFinite(dayTime) && new Date(dayTime).toISOString().slice(0, 10) === day && Number.isFinite(result),
    'INVALID_TIMESTAMP', `${name} is not a valid calendar date.`, { field: name });
  return result;
}

export function iso(value, name = 'timestamp') { return new Date(time(value, name)).toISOString(); }
export function copy(value) { return structuredClone(value); }

export function currency(value, name = 'currency') {
  requireCondition(typeof value === 'string' && /^[A-Z]{3}$/.test(value), 'INVALID_CURRENCY', `${name} must be a three-letter uppercase currency code.`);
  return value;
}

export const UNIT_SCALES = Object.freeze({ ones: 1, thousands: 1e3, millions: 1e6, billions: 1e9 });
export function unitScale(value) {
  requireCondition(Object.hasOwn(UNIT_SCALES, value), 'INVALID_UNITS', 'units must be ones, thousands, millions, or billions.');
  return UNIT_SCALES[value];
}

export function quantile(values, probability) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const position = (ordered.length - 1) * probability;
  const lower = Math.floor(position);
  return ordered[lower] + (ordered[Math.ceil(position)] - ordered[lower]) * (position - lower);
}

export function errorRecord(error, path = '') {
  return { code: error.code || 'INVALID_INPUT', path, message: error.message };
}
