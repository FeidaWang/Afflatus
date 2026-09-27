// Per-region counts for the S1 card (moved from the retired geography map, spec §2.3 item 2):
// configurations with a reported overall index, how many are open-weight, and their median index.
export function regionCounts(snapshot) {
  const score = new Map(snapshot.observations
    .filter((o) => o.metric_id === 'intelligence' && o.evidence_status === 'reported_snapshot' && Number.isFinite(o.value))
    .map((o) => [o.model_id, o.value]));
  const scored = snapshot.models.filter((m) => m.status === 'reported_snapshot' && score.has(m.id));
  return ['US', 'CN'].map((id) => {
    const models = scored.filter((m) => m.lab_geography === id);
    const v = models.map((m) => score.get(m.id)).sort((a, b) => a - b);
    const median = v.length ? (v[Math.floor((v.length - 1) / 2)] + v[Math.floor(v.length / 2)]) / 2 : null;
    return { id, count: models.length, open: models.filter((m) => m.open_weights).length, median };
  });
}
