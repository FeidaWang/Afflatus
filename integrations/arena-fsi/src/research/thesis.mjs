import { record, requireCondition, nonempty, finite, time, iso, copy } from './core.mjs';

export const THESIS_TRANSITIONS = Object.freeze({
  active: Object.freeze(['challenged', 'invalidated', 'closed']),
  challenged: Object.freeze(['active', 'invalidated', 'closed']),
  invalidated: Object.freeze(['closed']),
  closed: Object.freeze([]),
});
const CONVICTIONS = new Set(['low', 'medium', 'high']);

function validatePillars(pillars) {
  requireCondition(Array.isArray(pillars) && pillars.length > 0 && pillars.length <= 20,
    'INVALID_THESIS_PILLARS', 'A thesis needs 1–20 falsifiable pillars.');
  const ids = new Set();
  return pillars.map((pillar, index) => {
    record(pillar, `pillars[${index}]`);
    const id = nonempty(pillar.id, 'pillar.id', 128);
    requireCondition(!ids.has(id), 'DUPLICATE_PILLAR', `Duplicate pillar ${id}.`); ids.add(id);
    return { id, expectation: nonempty(pillar.expectation, 'pillar.expectation', 5000),
      invalidation: nonempty(pillar.invalidation, 'pillar.invalidation', 5000), status: 'pending', evidence: [] };
  });
}

/** Create a revisioned thesis. No wall-clock defaults and no hidden portfolio mutations. */
export function createThesis(input) {
  record(input);
  const id = nonempty(input.id, 'id', 128);
  const createdAt = iso(input.createdAt, 'createdAt');
  const conviction = input.conviction ?? 'medium';
  requireCondition(input.side === undefined || ['long', 'short'].includes(input.side), 'INVALID_THESIS_SIDE', 'side must be long or short.');
  requireCondition(CONVICTIONS.has(conviction), 'INVALID_CONVICTION', 'conviction must be low, medium, or high.');
  requireCondition(Array.isArray(input.risks) && input.risks.length > 0, 'THESIS_RISKS_REQUIRED', 'A thesis must list invalidating risks.');
  const risks = input.risks.map((risk, index) => nonempty(risk, `risks[${index}]`, 5000));
  const targetPrice = input.targetPrice === undefined ? null : finite(input.targetPrice, 'targetPrice', { min: 0 });
  return { id, symbol: nonempty(input.symbol, 'symbol', 32).toUpperCase(),
    statement: nonempty(input.statement, 'statement', 10000), side: input.side === 'short' ? 'short' : 'long',
    pillars: validatePillars(input.pillars), risks, conviction, targetPrice,
    stopTrigger: nonempty(input.stopTrigger, 'stopTrigger', 5000), status: 'active', revision: 1,
    createdAt, updatedAt: createdAt, history: [{ id: `${id}:created`, type: 'created', at: createdAt, revision: 1, status: 'active' }] };
}

/** Apply one evidence/review/transition event without mutating the input or changing live weights. */
export function updateThesis(thesis, event, { asOf } = {}) {
  record(thesis, 'thesis'); record(event, 'event');
  requireCondition(Object.hasOwn(THESIS_TRANSITIONS, thesis.status), 'INVALID_THESIS_STATUS', 'Unknown thesis status.');
  requireCondition(thesis.status !== 'closed', 'THESIS_CLOSED', 'Closed theses are immutable; create a new thesis ID to reopen the idea.');
  finite(thesis.revision, 'thesis.revision', { min: 1 });
  requireCondition(Number.isInteger(thesis.revision) && Array.isArray(thesis.history) && Array.isArray(thesis.pillars), 'INVALID_THESIS_STATE', 'Thesis revision/history/pillars are invalid.');
  const id = nonempty(event.id, 'event.id', 128);
  requireCondition(!thesis.history.some(item => item.id === id), 'DUPLICATE_THESIS_EVENT', `Event ${id} has already been applied.`);
  const at = time(event.at, 'event.at');
  requireCondition(at >= time(thesis.updatedAt, 'thesis.updatedAt'), 'OUT_OF_ORDER_THESIS_EVENT', 'Thesis events must arrive in chronological order.');
  if (asOf !== undefined) requireCondition(at <= time(asOf, 'asOf'), 'FUTURE_THESIS_EVENT', 'This event was not known at the snapshot.');
  requireCondition(['evidence', 'review', 'transition'].includes(event.type), 'INVALID_THESIS_EVENT', 'event.type must be evidence, review, or transition.');
  nonempty(event.description, 'event.description', 10000);
  const next = copy(thesis);
  let requestedStatus = event.nextStatus;
  if (event.type === 'evidence') {
    requireCondition(Array.isArray(event.sourceIds) && event.sourceIds.length > 0
      && event.sourceIds.every(source => typeof source === 'string' && source.trim()), 'THESIS_EVIDENCE_REQUIRED', 'Evidence events require sourceIds.');
    requireCondition(['strengthens', 'weakens', 'neutral'].includes(event.impact), 'INVALID_THESIS_IMPACT', 'Evidence impact must be strengthens, weakens, or neutral.');
    const pillar = next.pillars.find(item => item.id === event.pillarId);
    requireCondition(pillar, 'UNKNOWN_PILLAR', `Unknown pillar ${event.pillarId}.`);
    pillar.evidence.push({ eventId: id, at: new Date(at).toISOString(), impact: event.impact, description: event.description, sourceIds: copy(event.sourceIds) });
    if (event.impact === 'strengthens') pillar.status = 'supported';
    if (event.impact === 'weakens') pillar.status = 'challenged';
    if (event.impact === 'weakens' && thesis.status === 'active' && requestedStatus === undefined) requestedStatus = 'challenged';
    requireCondition(requestedStatus !== 'active' || thesis.status === 'active', 'REVIEW_REQUIRED_TO_RESTORE_THESIS', 'A review event must explicitly restore a challenged thesis.');
  }
  if (event.type === 'transition') requireCondition(requestedStatus !== undefined, 'THESIS_STATUS_REQUIRED', 'Transition events require nextStatus.');
  if (requestedStatus !== undefined && requestedStatus !== thesis.status) {
    requireCondition(THESIS_TRANSITIONS[thesis.status].includes(requestedStatus), 'INVALID_THESIS_TRANSITION',
      `Cannot transition ${thesis.status} to ${requestedStatus}.`);
    next.status = requestedStatus;
  }
  if (event.conviction !== undefined) {
    requireCondition(CONVICTIONS.has(event.conviction), 'INVALID_CONVICTION', 'conviction must be low, medium, or high.');
    next.conviction = event.conviction;
  }
  if (event.targetPrice !== undefined) {
    requireCondition(event.type === 'review', 'VALUATION_REVIEW_REQUIRED', 'Target-price changes require a review event.');
    next.targetPrice = finite(event.targetPrice, 'event.targetPrice', { min: 0 });
  }
  next.revision += 1;
  next.updatedAt = new Date(at).toISOString();
  next.history.push({ ...copy(event), at: next.updatedAt, revision: next.revision, status: next.status });
  return next;
}
