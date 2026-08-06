function text(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateSectorsEcosystem(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, errors: ['top-level: must be an object'] };
  }
  if (!Number.isFinite(Date.parse(data.updated))) errors.push('updated: must be an ISO timestamp');
  if (!Number.isInteger(data.version) || data.version < 1) errors.push('version: must be a positive integer');
  for (const field of ['chapters', 'nodes', 'edges']) {
    if (!Array.isArray(data[field])) errors.push(`${field}: must be an array`);
  }
  const nodeIds = new Set();
  for (const [index, node] of (data.nodes || []).entries()) {
    const tag = `nodes[${index}]`;
    if (!text(node?.id)) errors.push(`${tag}.id: missing`);
    else if (nodeIds.has(node.id)) errors.push(`${tag}.id: duplicate ${node.id}`);
    else nodeIds.add(node.id);
    if (!text(node?.label)) errors.push(`${tag}.label: missing`);
    if (!text(node?.summary_en) || !text(node?.summary_zh)) errors.push(`${tag}: needs summary_en and summary_zh`);
  }
  for (const [index, edge] of (data.edges || []).entries()) {
    const tag = `edges[${index}]`;
    if (!nodeIds.has(edge?.source)) errors.push(`${tag}.source: unknown node`);
    if (!nodeIds.has(edge?.target)) errors.push(`${tag}.target: unknown node`);
    if (!text(edge?.type)) errors.push(`${tag}.type: missing`);
    if (!text(edge?.label_en) || !text(edge?.label_zh)) errors.push(`${tag}: needs label_en and label_zh`);
  }
  return { ok: errors.length === 0, errors };
}
