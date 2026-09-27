// Identity mapping is exact: a company node must never stand in for its model.
export function resolveDependencies(graph, snapshot) {
  const known = new Set((graph?.nodes || []).map(node => node.id));
  const resolved = [], pending = [];
  for (const relationship of snapshot.relationships) {
    const missing = [relationship.from_entity, relationship.to_entity].filter(id => !known.has(id));
    if (missing.length) pending.push({ ...relationship, missing });
    else resolved.push({ ...relationship, source: relationship.from_entity, target: relationship.to_entity,
      type: relationship.relationship_type, semantic: true, reveal: 0 });
  }
  // Separate parallel and reciprocal facts without encoding volume in width.
  for (const edge of resolved) {
    const pair = [edge.source, edge.target].sort().join(':');
    const siblings = resolved.filter(item => [item.source, item.target].sort().join(':') === pair);
    edge.semanticBend = (siblings.indexOf(edge) - (siblings.length - 1) / 2) * 90
      * (edge.source < edge.target ? 1 : -1);
  }
  const used = new Set(resolved.flatMap(edge => [edge.source, edge.target]));
  return { resolved, pending, graph: { nodes: (graph?.nodes || []).filter(n => used.has(n.id)), edges: resolved, chapters: [] } };
}
export const STEP_KEYS = ['divide', 'frontier', 'capital', 'chokepoints', 'system'];
export const TASK_IDS = ['reason', 'code', 'documents', 'tools', 'verify', 'review'];
export function taskOwners(step, lens) {
  const index = STEP_KEYS.indexOf(step);
  if (index < 0) throw new Error('Unknown task stage');
  return TASK_IDS.map((id, i) => ({ id, owner: index === 0 || i === 5 ? 0 : index === 1 ? (i < 3 ? 1 : 0) : i === 3 || i === 4 ? 2 : (lens === 'research' && i === 1 ? 0 : 1) }));
}
