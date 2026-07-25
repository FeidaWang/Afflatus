/* ============================================================
   SECTORS COMPETITION — pure derivations over public/sectors-competition.json
   (urgent.md Part 3, RB-P0-04). No DOM, no canvas, no fetch: this module turns
   the provenance-wrapped dataset into radar geometry, sortable table rows and
   scoreboard math, so all of it is vitest-testable without a browser.

   Two rules the rest of the page depends on:
   1. A missing value is a GAP, never a zero. Normalization returns null and the
      renderer draws a break in the polygon — a model that did not publish a
      benchmark must not look like a model that scored zero on it.
   2. Normalization is computed against the current roster's min/max at render
      time. The JSON stores native units only; no pre-normalized numbers are ever
      persisted, so adding a model cannot silently rewrite history.
   ============================================================ */

/** Blended price per 1M tokens at a 3:1 input:output mix (the industry-standard
 *  blend). Returns null when either leg is unpriced. */
export function blendedPrice(pricing, inputWeight = 0.75) {
  if (!pricing || !Number.isFinite(pricing.in_per_m) || !Number.isFinite(pricing.out_per_m)) return null;
  const w = Math.min(1, Math.max(0, inputWeight));
  return pricing.in_per_m * w + pricing.out_per_m * (1 - w);
}

function benchValue(model, id) {
  const row = (model.bench || []).find((item) => item.id === id);
  return row && Number.isFinite(row.value) ? row : null;
}

/**
 * Resolves one radar axis for one model into `{value, unit, tier, src}` or null.
 * The mapping is declared in the dataset (`axis.from`), not hardcoded here, so a
 * new axis is a data change rather than a code change.
 */
export function axisValue(axis, model) {
  const from = axis?.from;
  if (!from) return null;
  if (from.kind === 'route') {
    return { value: model.route === 'open' ? 100 : 0, unit: axis.unit, tier: 'verified', src: model.src || null };
  }
  if (from.kind === 'bench') {
    const row = benchValue(model, from.bench);
    return row ? { value: row.value, unit: row.unit || axis.unit, tier: row.tier, src: row.src || null } : null;
  }
  if (from.kind === 'ratio') {
    const numerator = benchValue(model, from.numerator);
    const denominator = from.denominator === 'blended_price'
      ? blendedPrice(model.pricing, from.input_weight)
      : null;
    if (!numerator || !Number.isFinite(denominator) || denominator <= 0) return null;
    return {
      value: Math.round((numerator.value / denominator) * 100) / 100,
      unit: axis.unit,
      tier: 'derived',
      src: null,
    };
  }
  return null;
}

/** Per-axis min/max across the models actually carrying a value. */
export function axisExtent(axis, models) {
  const values = models
    .map((model) => axisValue(axis, model))
    .filter(Boolean)
    .map((entry) => entry.value);
  if (!values.length) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

/** Maps a native value into 0..1 against the roster extent. A degenerate extent
 *  (every model identical) maps to 1 rather than dividing by zero. */
export function normalizeAxis(value, extent, higherBetter = true) {
  if (!Number.isFinite(value) || !extent) return null;
  const span = extent.max - extent.min;
  if (span <= 0) return 1;
  const raw = (value - extent.min) / span;
  return higherBetter === false ? 1 - raw : raw;
}

/**
 * Full radar model for the selected models.
 * @returns {{axes: object[], series: object[], gaps: number}}
 */
export function buildRadar(data, selectedIds) {
  const axes = Array.isArray(data?.radarAxes) ? data.radarAxes : [];
  const all = Array.isArray(data?.models) ? data.models : [];
  const chosen = all.filter((model) => selectedIds.includes(model.id));
  const extents = axes.map((axis) => axisExtent(axis, all));
  let gaps = 0;
  const series = chosen.map((model) => {
    const points = axes.map((axis, index) => {
      const entry = axisValue(axis, model);
      if (!entry) {
        gaps += 1;
        return { axisId: axis.id, value: null, normalized: null, tier: 'pending', unit: axis.unit, src: null };
      }
      return {
        axisId: axis.id,
        value: entry.value,
        normalized: normalizeAxis(entry.value, extents[index], axis.higher_better),
        tier: entry.tier,
        unit: entry.unit,
        src: entry.src,
      };
    });
    return { id: model.id, name: model.name, bloc: model.bloc, route: model.route, points };
  });
  return { axes: axes.map((axis, index) => ({ ...axis, extent: extents[index] })), series, gaps };
}

/**
 * Polygon geometry for one series. `radius` is the outer radius in px; the first
 * axis points straight up and the rest run clockwise. Null points are returned as
 * null so the caller can break the path instead of collapsing it to the centre.
 */
export function radarPolygon(series, axisCount, radius, floor = 0.12) {
  return series.points.map((point, index) => {
    if (point.normalized === null) return null;
    const angle = -Math.PI / 2 + (index / axisCount) * Math.PI * 2;
    const r = radius * (floor + (1 - floor) * Math.min(1, Math.max(0, point.normalized)));
    return { x: Math.cos(angle) * r, y: Math.sin(angle) * r, axisId: point.axisId };
  });
}

/** Axis label anchor positions at the outer ring. */
export function radarAxisPoints(axisCount, radius) {
  return Array.from({ length: axisCount }, (_, index) => {
    const angle = -Math.PI / 2 + (index / axisCount) * Math.PI * 2;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, angle };
  });
}

/**
 * One row per model for the benchmark table, in declared column order.
 * Columns marked `status` (not_published / provider_dependent) always render as a
 * labelled gap — the emptiness is the finding, so it must survive into the table.
 */
export function buildTable(data) {
  const columns = Array.isArray(data?.benchColumns) ? data.benchColumns : [];
  const models = Array.isArray(data?.models) ? data.models : [];
  const rows = models.map((model) => {
    const blended = blendedPrice(model.pricing);
    const cells = columns.map((column) => {
      if (column.id === 'price_in') {
        return cell(column, model.pricing?.in_per_m ?? null, model.pricing?.tier, model.pricing?.src);
      }
      if (column.id === 'price_out') {
        return cell(column, model.pricing?.out_per_m ?? null, model.pricing?.tier, model.pricing?.src);
      }
      if (column.id === 'price_ratio') {
        const ratio = Number.isFinite(model.pricing?.in_per_m) && model.pricing.in_per_m > 0
          ? Math.round((model.pricing.out_per_m / model.pricing.in_per_m) * 100) / 100
          : null;
        return cell(column, ratio, ratio === null ? 'pending' : 'derived', null);
      }
      const row = (model.bench || []).find((item) => item.id === column.id);
      if (!row) return cell(column, null, 'pending', null);
      return cell(column, row.value, row.tier, row.src, row.note_en, row.note_zh);
    });
    return {
      id: model.id,
      name: model.name,
      bloc: model.bloc,
      route: model.route,
      vendor: model.vendor,
      released: model.released || null,
      blendedPrice: blended,
      notes_en: model.notes_en,
      notes_zh: model.notes_zh,
      src: model.src || null,
      cells,
    };
  });
  return { columns, rows };
}

function cell(column, value, tier, src, noteEn, noteZh) {
  return {
    columnId: column.id,
    value: Number.isFinite(value) ? value : null,
    tier: column.status ? column.status : (tier || 'pending'),
    unit: column.unit,
    src: src || null,
    note_en: noteEn || column.note_en || null,
    note_zh: noteZh || column.note_zh || null,
  };
}

/**
 * Sorts table rows by one column. Rows without a value always sink to the bottom
 * regardless of direction, so an empty cell can never win a ranking.
 */
export function sortRows(rows, columnId, direction = 'desc') {
  const sign = direction === 'asc' ? 1 : -1;
  return rows.slice().sort((a, b) => {
    const av = a.cells.find((c) => c.columnId === columnId)?.value;
    const bv = b.cells.find((c) => c.columnId === columnId)?.value;
    const aMissing = !Number.isFinite(av);
    const bMissing = !Number.isFinite(bv);
    if (aMissing && bMissing) return a.name.localeCompare(b.name);
    if (aMissing) return 1;
    if (bMissing) return -1;
    if (av === bv) return a.name.localeCompare(b.name);
    return (av - bv) * sign;
  });
}

/**
 * Weighted composite for each bloc, plus the per-axis lead.
 * @returns {{us: number, cn: number, axes: object[], weights: object}}
 */
export function buildScoreboard(scoreboard) {
  const axes = Array.isArray(scoreboard?.axes) ? scoreboard.axes : [];
  const weights = scoreboard?.weights || {};
  let us = 0;
  let cn = 0;
  let weightSum = 0;
  const detailed = axes.map((axis) => {
    const weight = Number.isFinite(weights[axis.id]) ? weights[axis.id] : 0;
    us += axis.us * weight;
    cn += axis.cn * weight;
    weightSum += weight;
    return { ...axis, weight, lead: axis.us === axis.cn ? 'tie' : (axis.us > axis.cn ? 'US' : 'CN'), gap: Math.abs(axis.us - axis.cn) };
  });
  const scale = weightSum > 0 ? 1 / weightSum : 0;
  return {
    us: Math.round(us * scale * 10) / 10,
    cn: Math.round(cn * scale * 10) / 10,
    axes: detailed,
    weights,
  };
}

/** Equity boards split by bloc side, sorted by conviction then ticker. */
export function buildBoards(data) {
  const equities = Array.isArray(data?.equities) ? data.equities : [];
  const byConviction = (a, b) => (b.conviction?.value ?? 0) - (a.conviction?.value ?? 0)
    || String(a.ticker).localeCompare(String(b.ticker));
  return {
    US: equities.filter((item) => item.market === 'US').sort(byConviction),
    CN: equities.filter((item) => item.market === 'A' || item.market === 'HK').sort(byConviction),
  };
}

/** Counts leaves by provenance tier — powers the "N pending" honesty line. */
export function countTiers(data) {
  const counts = { verified: 0, reported: 0, estimate: 0, derived: 0, pending: 0 };
  const bump = (tier) => {
    if (tier && Object.prototype.hasOwnProperty.call(counts, tier)) counts[tier] += 1;
  };
  for (const model of data?.models || []) {
    bump(model.pricing?.tier);
    for (const row of model.bench || []) bump(row.tier);
    for (const row of model.speed || []) bump(row.tier);
  }
  for (const item of data?.equities || []) {
    bump(item.conviction?.tier);
    for (const kpi of item.kpis || []) bump(kpi.tier);
  }
  for (const axis of data?.scoreboard?.axes || []) bump(axis.tier);
  return counts;
}
