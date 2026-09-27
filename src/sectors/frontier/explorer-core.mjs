import { rankMetric, observation, paretoFrontier } from './frontier-core.mjs';

/** Constraints apply before ranking and dominance; unknown metadata never satisfies a requirement. */
export function explore(data, { metric = 'intelligence', geography = 'all', openOnly = false, minScore = null, maxCost = null, context = 0 } = {}) {
  for (const value of [minScore, maxCost, context]) {
    if (value !== null && !Number.isFinite(value)) throw new TypeError('Constraints must be finite or null.');
  }
  if (context < 0 || (maxCost !== null && maxCost < 0)) throw new TypeError('Cost and context must be non-negative.');
  const base = rankMetric(data, metric, { geography, openOnly });
  const excluded = [...base.excluded];
  const candidates = base.ranked.filter(row => {
    const cost = observation(data, row.model.id, 'cost_task');
    let reason;
    if (context > 0 && !Number.isFinite(row.model.context_tokens)) reason = 'context_missing';
    else if (context > row.model.context_tokens) reason = 'context_limit';
    else if (minScore !== null && metric !== 'cost_task' && row.value < minScore) reason = 'score_limit';
    else if (maxCost !== null && (!Number.isFinite(cost?.value) || cost.evidence_status === 'provisional_conflict')) reason = 'cost_missing';
    else if (maxCost !== null && cost.value > maxCost) reason = 'cost_limit';
    if (reason) excluded.push({ model: row.model, reason });
    return !reason;
  });
  const ids = new Set(candidates.map(row => row.model.id));
  const subset = { ...data, models: data.models.filter(model => ids.has(model.id)) };
  const ranking = rankMetric(subset, metric);
  const pareto = paretoFrontier(subset, { qualityMetric: metric === 'cost_task' ? 'intelligence' : metric });
  return { ...ranking, scopeCount: base.scopeCount, excluded, pareto };
}
