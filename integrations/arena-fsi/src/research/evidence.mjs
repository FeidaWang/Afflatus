import { record, nonempty, finite, requireCondition, time, iso, copy, errorRecord } from './core.mjs';

const SOURCE_KINDS = new Set(['filing', 'market_data', 'news', 'transcript', 'user', 'dataset', 'research_report']);

/** Structural and point-in-time validation. This does not authenticate source content. */
export function validateEvidence(sources, { asOf } = {}) {
  const cutoff = time(asOf, 'asOf');
  const errors = [];
  const accepted = [];
  const seen = new Set();
  if (!Array.isArray(sources)) return { valid: false, asOf: iso(asOf), accepted, errors: [{ code: 'INVALID_SOURCES', path: 'sources', message: 'sources must be an array.' }], assurance: 'structure-and-time-only' };
  sources.forEach((source, index) => {
    const path = `sources[${index}]`;
    try {
      record(source, path);
      const id = nonempty(source.id, `${path}.id`, 128);
      requireCondition(!seen.has(id), 'DUPLICATE_SOURCE_ID', `Source ID ${id} is duplicated.`);
      seen.add(id);
      nonempty(source.title, `${path}.title`, 1000);
      requireCondition(SOURCE_KINDS.has(source.kind), 'INVALID_SOURCE_KIND', `${path}.kind is not supported.`);
      if (source.kind !== 'user' || source.url !== undefined) {
        const parsed = new URL(nonempty(source.url, `${path}.url`, 4096));
        requireCondition(['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password,
          'INVALID_SOURCE_URL', 'Source URLs must be HTTP(S) and cannot contain credentials.');
      }
      const publishedAt = time(source.publishedAt, `${path}.publishedAt`);
      const availableAt = time(source.availableAt, `${path}.availableAt`);
      requireCondition(availableAt >= publishedAt, 'INVALID_AVAILABILITY_ORDER', 'availableAt cannot precede publishedAt.');
      requireCondition(publishedAt <= cutoff && availableAt <= cutoff, 'FUTURE_EVIDENCE', 'Evidence was not publicly/locally available by this snapshot.');
      if (source.versionAt !== undefined) {
        const versionAt = time(source.versionAt, `${path}.versionAt`);
        requireCondition(versionAt >= publishedAt && versionAt <= availableAt && versionAt <= cutoff,
          'INVALID_SOURCE_VINTAGE', 'The exact source version must predate both availability and the snapshot.');
      }
      if (source.retrievedAt !== undefined) requireCondition(time(source.retrievedAt, `${path}.retrievedAt`) >= availableAt,
        'INVALID_RETRIEVAL_ORDER', 'retrievedAt cannot precede source availability.');
      accepted.push(copy(source));
    } catch (error) { errors.push(errorRecord(error, path)); }
  });
  return { valid: errors.length === 0, asOf: iso(asOf), accepted, errors, assurance: 'structure-and-time-only' };
}

function validateSourceIds(value, known, path, errors, required = true) {
  if (!Array.isArray(value) || (required && value.length === 0)) {
    errors.push({ code: 'SOURCE_IDS_REQUIRED', path, message: 'Supply a nonempty sourceIds array.' });
    return;
  }
  const seen = new Set();
  value.forEach((id, index) => {
    if (typeof id !== 'string' || !known.has(id)) errors.push({ code: 'UNKNOWN_SOURCE_ID', path: `${path}[${index}]`, message: `Source ID ${String(id)} is unavailable at the snapshot.` });
    if (seen.has(id)) errors.push({ code: 'DUPLICATE_SOURCE_REFERENCE', path: `${path}[${index}]`, message: 'Repeated source reference.' });
    seen.add(id);
  });
}

function list(value, name, errors) {
  if (!Array.isArray(value)) {
    errors.push({ code: 'INVALID_RESEARCH_SECTION', path: name, message: `${name} must be an array, even when empty.` });
    return [];
  }
  return value;
}

function onlyKeys(value, keys, path) {
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) requireCondition(allowed.has(key), 'UNRECOGNIZED_RESEARCH_FIELD',
    `${path}.${key} is not in the research contract; factual numbers belong in numericClaims.`, { field: `${path}.${key}` });
}

/** Research document gate: facts have citations, assumptions have rationale, inferences have dependencies. */
export function validateResearch(research, { asOf, sources } = {}) {
  record(research, 'research');
  const cutoff = time(asOf ?? research.snapshotAt, 'asOf');
  const snapshotAt = new Date(cutoff).toISOString();
  const evidence = validateEvidence(sources ?? research.sources, { asOf: snapshotAt });
  const errors = [...evidence.errors];
  if (research.snapshotAt !== undefined) {
    try { requireCondition(time(research.snapshotAt, 'snapshotAt') === cutoff, 'SNAPSHOT_MISMATCH', 'Research snapshotAt must equal the evaluation cutoff.'); }
    catch (error) { errors.push(errorRecord(error, 'snapshotAt')); }
  }
  const knownSources = new Set(evidence.accepted.map(source => source.id));
  const facts = list(research.facts, 'facts', errors);
  const assumptions = list(research.assumptions, 'assumptions', errors);
  const inferences = list(research.inferences, 'inferences', errors);
  const knownClaims = new Set();
  const register = (item, path) => {
    record(item, path);
    const id = nonempty(item.id, `${path}.id`, 128);
    requireCondition(!knownClaims.has(id), 'DUPLICATE_CLAIM_ID', `Claim ID ${id} is duplicated.`);
    knownClaims.add(id);
    nonempty(item.claim, `${path}.claim`, 10000);
  };
  facts.forEach((fact, index) => {
    const path = `facts[${index}]`;
    try {
      register(fact, path);
      onlyKeys(fact, ['id', 'claim', 'sourceIds', 'numericClaims'], path);
      validateSourceIds(fact.sourceIds, knownSources, `${path}.sourceIds`, errors);
      requireCondition(!Object.hasOwn(fact, 'value'), 'FACT_VALUE_NEEDS_NUMERIC_CLAIM', 'Put numeric facts in numericClaims with explicit units and sourceIds.');
      if (fact.numericClaims !== undefined) {
        requireCondition(Array.isArray(fact.numericClaims), 'INVALID_NUMERIC_CLAIMS', 'numericClaims must be an array.');
        fact.numericClaims.forEach((number, j) => {
          const numberPath = `${path}.numericClaims[${j}]`;
          record(number, numberPath);
          onlyKeys(number, ['name', 'value', 'unit', 'sourceIds', 'availableAt'], numberPath);
          nonempty(number.name, `${numberPath}.name`, 128);
          finite(number.value, `${numberPath}.value`);
          nonempty(number.unit, `${numberPath}.unit`, 128);
          validateSourceIds(number.sourceIds, knownSources, `${numberPath}.sourceIds`, errors);
          if (number.availableAt !== undefined) requireCondition(time(number.availableAt, 'numericClaim.availableAt') <= cutoff,
            'FUTURE_NUMERIC_FACT', 'Numeric data was unavailable at the snapshot.');
        });
      }
    } catch (error) { errors.push(errorRecord(error, path)); }
  });
  assumptions.forEach((assumption, index) => {
    const path = `assumptions[${index}]`;
    try {
      register(assumption, path);
      onlyKeys(assumption, ['id', 'claim', 'rationale', 'value', 'unit', 'sourceIds'], path);
      nonempty(assumption.rationale, `${path}.rationale`, 10000);
      if (assumption.value !== undefined) { finite(assumption.value, `${path}.value`); nonempty(assumption.unit, `${path}.unit`, 128); }
      if (assumption.sourceIds !== undefined) validateSourceIds(assumption.sourceIds, knownSources, `${path}.sourceIds`, errors, false);
    } catch (error) { errors.push(errorRecord(error, path)); }
  });
  // Only facts and assumptions may feed an inference, avoiding cycles and unsupported chains.
  const baseClaimIds = new Set(knownClaims);
  inferences.forEach((inference, index) => {
    const path = `inferences[${index}]`;
    try {
      register(inference, path);
      onlyKeys(inference, ['id', 'claim', 'basedOn', 'sourceIds', 'value', 'unit', 'calculation'], path);
      requireCondition(Array.isArray(inference.basedOn) && inference.basedOn.length > 0,
        'INFERENCE_DEPENDENCIES_REQUIRED', 'Inferences must identify supporting facts/assumptions.');
      for (const id of inference.basedOn) requireCondition(baseClaimIds.has(id), 'UNKNOWN_INFERENCE_INPUT', `Unknown input claim ${id}.`);
      if (inference.sourceIds !== undefined) validateSourceIds(inference.sourceIds, knownSources, `${path}.sourceIds`, errors, false);
      if (inference.value !== undefined) {
        finite(inference.value, `${path}.value`); nonempty(inference.unit, `${path}.unit`, 128);
        record(inference.calculation, `${path}.calculation`);
        nonempty(inference.calculation.method, `${path}.calculation.method`, 1000);
        requireCondition(Array.isArray(inference.calculation.inputIds) && inference.calculation.inputIds.length > 0,
          'CALCULATION_INPUTS_REQUIRED', 'Numeric inferences need calculation.inputIds.');
        for (const id of inference.calculation.inputIds) requireCondition(baseClaimIds.has(id) && inference.basedOn.includes(id),
          'UNKNOWN_CALCULATION_INPUT', `Calculation input ${id} must appear in basedOn.`);
      }
    } catch (error) { errors.push(errorRecord(error, path)); }
  });
  if (research.decision !== undefined) {
    try {
      const decision = record(research.decision, 'decision');
      onlyKeys(decision, ['action', 'confidence', 'rationale', 'evidenceIds', 'invalidation'], 'decision');
      requireCondition(['buy', 'sell', 'hold'].includes(decision.action), 'INVALID_RESEARCH_ACTION', 'Research action must be buy, sell, or hold.');
      finite(decision.confidence, 'decision.confidence', { min: 0, max: 1 });
      nonempty(decision.rationale, 'decision.rationale', 10000);
      requireCondition(Array.isArray(decision.evidenceIds), 'DECISION_EVIDENCE_REQUIRED', 'decision.evidenceIds must be an array.');
      for (const id of decision.evidenceIds) requireCondition(knownClaims.has(id), 'UNKNOWN_DECISION_EVIDENCE', `Decision references unknown claim ${id}.`);
      if (decision.action !== 'hold') {
        requireCondition(facts.length > 0 && decision.evidenceIds.length > 0, 'UNSUPPORTED_TRADE_THESIS', 'Buy/sell research needs cited factual evidence.');
        nonempty(decision.invalidation, 'decision.invalidation', 5000);
      }
    } catch (error) { errors.push(errorRecord(error, 'decision')); }
  }
  return { valid: errors.length === 0, snapshotAt, errors, sourceCount: evidence.accepted.length,
    counts: { facts: facts.length, assumptions: assumptions.length, inferences: inferences.length },
    assurance: 'structure-and-time-only', executionAuthorized: false,
    limitations: ['Citation metadata is validated; source content and numerical extraction must be verified by the ingestion layer.',
      'A valid research object is not a trade authorization. The simulator must apply independent risk and quote-quality gates.'] };
}
