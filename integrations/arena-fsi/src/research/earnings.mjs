import { record, finite, requireCondition, copy } from './core.mjs';

function observation(value, name) {
  if (value == null) return { value: null, metadata: null, sourceIds: [] };
  if (typeof value === 'number') return { value: finite(value, name), metadata: null, sourceIds: [] };
  record(value, name);
  const metadata = Object.fromEntries(['units', 'currency', 'period', 'basis'].map(key => [key, value[key] ?? null]));
  return { value: value.value == null ? null : finite(value.value, `${name}.value`), metadata, sourceIds: copy(value.sourceIds ?? []) };
}

function comparison(actual, reference, direction) {
  if (actual.value === null || reference.value === null) return { delta: null, percent: null, result: 'missing', reason: 'MISSING_INPUT' };
  if (JSON.stringify(actual.metadata) !== JSON.stringify(reference.metadata)) {
    return { delta: null, percent: null, result: 'incomparable', reason: 'METADATA_MISMATCH' };
  }
  const delta = actual.value - reference.value;
  const percent = reference.value === 0 ? null : delta / Math.abs(reference.value);
  const directedDelta = direction === 'lower' ? -delta : delta;
  // Tolerance is limited to floating-point noise; no economic materiality is assumed.
  const tolerance = 1e-12 * Math.max(1, Math.abs(actual.value), Math.abs(reference.value));
  const result = Math.abs(delta) <= tolerance ? 'inline' : directedDelta > 0 ? 'beat' : 'miss';
  return { delta, percent, result, ...(reference.value === 0 ? { reason: 'ZERO_REFERENCE_PERCENT_UNDEFINED' } : {}) };
}

/** Actual/consensus/prior comparison. Percentages use abs(reference), including losses. */
export function analyzeEarnings({ actual = {}, consensus = {}, prior = {}, directions = {} } = {}) {
  record(actual, 'actual'); record(consensus, 'consensus'); record(prior, 'prior'); record(directions, 'directions');
  const names = [...new Set([...Object.keys(actual), ...Object.keys(consensus), ...Object.keys(prior)])].sort();
  const rows = names.map(metric => {
    const direction = directions[metric] ?? 'higher';
    requireCondition(['higher', 'lower'].includes(direction), 'INVALID_METRIC_DIRECTION', `${metric} direction must be higher or lower.`);
    const a = observation(actual[metric], `actual.${metric}`);
    const c = observation(consensus[metric], `consensus.${metric}`);
    const p = observation(prior[metric], `prior.${metric}`);
    return { metric, direction, actual: a.value, consensus: c.value, prior: p.value,
      versusConsensus: comparison(a, c, direction), versusPrior: comparison(a, p, direction),
      sourceIds: { actual: a.sourceIds, consensus: c.sourceIds, prior: p.sourceIds } };
  });
  const counts = { beat: 0, miss: 0, inline: 0, missing: 0, incomparable: 0 };
  for (const row of rows) counts[row.versusConsensus.result] += 1;
  return { status: counts.beat + counts.miss + counts.inline ? 'ready' : 'insufficient', rows, counts,
    methodology: { percentChange: '(actual-reference)/abs(reference)', negativeReference: 'directional change, not conventional growth', zeroReference: 'absolute delta only', numericInputs: 'caller-normalized units and accounting basis' } };
}
