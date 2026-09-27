// Head-to-head comparison between two models on every metric of a frontier snapshot.
// Pure functions: the view layer renders these rows and never decides a leader itself.

/** Observation value for one model × metric, or null when absent / not a finite number. */
export function valueOf(snapshot, modelId, metricId) {
  const v = snapshot.observations.find((o) => o.model_id === modelId && o.metric_id === metricId)?.value;
  return Number.isFinite(v) ? v : null;
}

/**
 * Compare model `aId` with `bId`, honouring each metric's direction ('higher' | 'lower').
 * A metric where either side is unpublished gets `leader: null` and `delta: null`
 * and is listed in `missing`; it is never counted as a lead for anyone.
 */
export function headToHead(snapshot, aId, bId, { refId = null } = {}) {
  const rows = snapshot.metrics.map((m) => {
    const a = valueOf(snapshot, aId, m.id);
    const b = valueOf(snapshot, bId, m.id);
    const ref = refId ? valueOf(snapshot, refId, m.id) : null;
    let leader = null;
    if (a != null && b != null) leader = a === b ? 'tie' : (a > b) === (m.direction !== 'lower') ? 'a' : 'b';
    return {
      metricId: m.id, label: m.label, unit: m.unit, direction: m.direction, a, b, ref, leader,
      delta: a != null && b != null ? a - b : null,
    };
  });
  const ids = (k) => rows.filter((r) => r.leader === k).map((r) => r.metricId);
  return { rows, aLeads: ids('a'), bLeads: ids('b'), ties: ids('tie'), missing: ids(null) };
}

/**
 * Shared 0–1 scale for the bars of one row (a, b and the reference model).
 * Baseline is zero, or the lowest value when a metric goes negative. Returns null
 * when no value is known, and the scale maps a null value to null (no zero-length bar).
 */
export function pairedScale(row) {
  const vals = [row.a, row.b, row.ref].filter((v) => v != null);
  if (!vals.length) return null;
  const lo = Math.min(0, ...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || 1;
  return (v) => (v == null ? null : (v - lo) / span);
}
