import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  blendedPrice,
  axisValue,
  axisExtent,
  normalizeAxis,
  buildRadar,
  radarPolygon,
  radarAxisPoints,
  buildTable,
  sortRows,
  buildScoreboard,
  buildBoards,
  countTiers,
} from '../src/lib/sectorsCompetition.js';
import { validateSectorsCompetition } from '../src/lib/validateSectorsCompetition.js';

const DATA = JSON.parse(readFileSync('public/sectors-competition.json', 'utf8'));

const AXES = [
  { id: 'intelligence', unit: 'index', higher_better: true, from: { kind: 'bench', bench: 'aa_intelligence' } },
  { id: 'cost_efficiency', unit: 'index/$', higher_better: true, from: { kind: 'ratio', numerator: 'aa_intelligence', denominator: 'blended_price', input_weight: 0.75 } },
  { id: 'openness', unit: '0/100', from: { kind: 'route' } },
];

const MODEL_A = {
  id: 'a', name: 'A', bloc: 'US', route: 'closed',
  pricing: { in_per_m: 5, out_per_m: 25, tier: 'verified', src: 'https://example.com' },
  bench: [{ id: 'aa_intelligence', value: 60, unit: 'index', tier: 'verified', src: 'https://example.com' }],
  speed: [],
};
const MODEL_B = {
  id: 'b', name: 'B', bloc: 'CN', route: 'open',
  pricing: { in_per_m: null, out_per_m: null, tier: 'pending', src: null },
  bench: [],
  speed: [],
};

describe('blendedPrice', () => {
  it('blends 3:1 input:output', () => {
    expect(blendedPrice({ in_per_m: 5, out_per_m: 25 })).toBe(10);
    expect(blendedPrice({ in_per_m: 10, out_per_m: 50 })).toBe(20);
  });

  it('returns null when either leg is unpriced', () => {
    expect(blendedPrice({ in_per_m: 5, out_per_m: null })).toBeNull();
    expect(blendedPrice(null)).toBeNull();
  });
});

describe('axisValue', () => {
  it('reads a benchmark axis and carries its tier through', () => {
    expect(axisValue(AXES[0], MODEL_A)).toEqual({ value: 60, unit: 'index', tier: 'verified', src: 'https://example.com' });
  });

  it('derives cost efficiency and marks it derived', () => {
    expect(axisValue(AXES[1], MODEL_A)).toEqual({ value: 6, unit: 'index/$', tier: 'derived', src: null });
  });

  it('treats route as a verified fact', () => {
    expect(axisValue(AXES[2], MODEL_A).value).toBe(0);
    expect(axisValue(AXES[2], MODEL_B).value).toBe(100);
  });

  it('returns null rather than zero for an unpublished metric', () => {
    expect(axisValue(AXES[0], MODEL_B)).toBeNull();
    expect(axisValue(AXES[1], MODEL_B)).toBeNull();
  });
});

describe('normalizeAxis', () => {
  it('maps into 0..1 against the roster extent', () => {
    expect(normalizeAxis(55, { min: 50, max: 60 })).toBe(0.5);
  });

  it('inverts when lower is better', () => {
    expect(normalizeAxis(55, { min: 50, max: 60 }, false)).toBe(0.5);
    expect(normalizeAxis(50, { min: 50, max: 60 }, false)).toBe(1);
  });

  it('does not divide by zero on a degenerate extent', () => {
    expect(normalizeAxis(7, { min: 7, max: 7 })).toBe(1);
  });

  it('propagates a missing value as null', () => {
    expect(normalizeAxis(null, { min: 0, max: 1 })).toBeNull();
    expect(normalizeAxis(5, null)).toBeNull();
  });
});

describe('axisExtent', () => {
  it('ignores models with no value on that axis', () => {
    expect(axisExtent(AXES[0], [MODEL_A, MODEL_B])).toEqual({ min: 60, max: 60 });
  });

  it('returns null when no model carries the metric', () => {
    expect(axisExtent(AXES[0], [MODEL_B])).toBeNull();
  });
});

describe('buildRadar', () => {
  it('emits one series per selected model and counts gaps', () => {
    const radar = buildRadar({ radarAxes: AXES, models: [MODEL_A, MODEL_B] }, ['a', 'b']);
    expect(radar.series.map((s) => s.id)).toEqual(['a', 'b']);
    // B has no intelligence and no derivable cost efficiency: exactly two gaps.
    expect(radar.gaps).toBe(2);
    const bPoints = radar.series[1].points;
    expect(bPoints[0].normalized).toBeNull();
    expect(bPoints[2].normalized).toBe(1);
  });

  it('never turns a gap into a zero-valued point', () => {
    const radar = buildRadar({ radarAxes: AXES, models: [MODEL_A, MODEL_B] }, ['b']);
    for (const point of radar.series[0].points) {
      if (point.value === null) expect(point.normalized).toBeNull();
    }
  });

  it('normalizes against the whole roster, not the selection', () => {
    const models = [MODEL_A, { ...MODEL_A, id: 'c', name: 'C', bench: [{ id: 'aa_intelligence', value: 40, unit: 'index', tier: 'reported' }] }];
    const radar = buildRadar({ radarAxes: AXES, models }, ['a']);
    expect(radar.axes[0].extent).toEqual({ min: 40, max: 60 });
    expect(radar.series[0].points[0].normalized).toBe(1);
  });
});

describe('radar geometry', () => {
  it('places the first axis straight up and keeps nulls as nulls', () => {
    const radar = buildRadar({ radarAxes: AXES, models: [MODEL_A, MODEL_B] }, ['b']);
    const polygon = radarPolygon(radar.series[0], AXES.length, 100);
    expect(polygon[0]).toBeNull();
    expect(polygon.filter(Boolean).length).toBe(1);
    const axisPoints = radarAxisPoints(AXES.length, 100);
    expect(axisPoints[0].x).toBeCloseTo(0, 6);
    expect(axisPoints[0].y).toBeCloseTo(-100, 6);
  });

  it('keeps a floor so a minimum score is still visible', () => {
    const radar = buildRadar({ radarAxes: AXES, models: [MODEL_A, { ...MODEL_A, id: 'c', name: 'C', bench: [{ id: 'aa_intelligence', value: 10, unit: 'index', tier: 'reported' }] }] }, ['c']);
    const polygon = radarPolygon(radar.series[0], AXES.length, 100, 0.12);
    expect(polygon[0].y).toBeCloseTo(-12, 6);
  });
});

describe('buildTable and sortRows', () => {
  it('renders declared columns for every model, gaps included', () => {
    const table = buildTable(DATA);
    expect(table.rows.length).toBe(DATA.models.length);
    for (const row of table.rows) expect(row.cells.length).toBe(DATA.benchColumns.length);
  });

  it('marks deliberately-empty columns with their declared status and note', () => {
    const table = buildTable(DATA);
    const cell = table.rows[0].cells.find((c) => c.columnId === 'mmlu_pro');
    expect(cell.value).toBeNull();
    expect(cell.tier).toBe('not_published');
    expect(cell.note_en).toMatch(/published/i);
  });

  it('derives the output:input price ratio', () => {
    const table = buildTable(DATA);
    const fable = table.rows.find((row) => row.id === 'claude-fable-5');
    expect(fable.cells.find((c) => c.columnId === 'price_ratio').value).toBe(5);
    const deepseek = table.rows.find((row) => row.id === 'deepseek-v4-pro');
    expect(deepseek.cells.find((c) => c.columnId === 'price_ratio').value).toBeCloseTo(2.02, 2);
  });

  it('sinks missing values to the bottom in both directions', () => {
    const table = buildTable(DATA);
    const desc = sortRows(table.rows, 'aa_intelligence', 'desc');
    const asc = sortRows(table.rows, 'aa_intelligence', 'asc');
    expect(desc[0].id).toBe('claude-opus-5');
    expect(asc[0].id).toBe('gemini-3-6-flash');
    const lastDesc = desc[desc.length - 1].cells.find((c) => c.columnId === 'aa_intelligence').value;
    const lastAsc = asc[asc.length - 1].cells.find((c) => c.columnId === 'aa_intelligence').value;
    expect(lastDesc).toBeNull();
    expect(lastAsc).toBeNull();
  });
});

describe('buildScoreboard', () => {
  it('computes the weighted composite and per-axis lead', () => {
    const board = buildScoreboard(DATA.scoreboard);
    expect(board.us).toBeGreaterThan(board.cn);
    expect(board.axes.find((a) => a.id === 'data').lead).toBe('CN');
    expect(board.axes.find((a) => a.id === 'compute').lead).toBe('US');
    expect(board.axes.find((a) => a.id === 'compute').gap).toBe(44);
  });

  it('renormalizes if weights do not sum to one', () => {
    const board = buildScoreboard({ weights: { compute: 1, algorithms: 1 }, axes: [{ id: 'compute', us: 100, cn: 0 }, { id: 'algorithms', us: 0, cn: 100 }] });
    expect(board.us).toBe(50);
    expect(board.cn).toBe(50);
  });
});

describe('buildBoards', () => {
  it('splits ten US and ten China listings, conviction first', () => {
    const boards = buildBoards(DATA);
    expect(boards.US.length).toBe(10);
    expect(boards.CN.length).toBe(10);
    expect(boards.US[0].ticker).toBe('NVDA');
    for (const board of [boards.US, boards.CN]) {
      const values = board.map((item) => item.conviction.value);
      expect(values).toEqual(values.slice().sort((a, b) => b - a));
    }
  });

  it('keeps A-share and HKEX on the same China board', () => {
    const boards = buildBoards(DATA);
    expect(new Set(boards.CN.map((item) => item.market))).toEqual(new Set(['A', 'HK']));
  });
});

describe('shipped dataset', () => {
  it('passes its own schema validator', () => {
    expect(validateSectorsCompetition(DATA)).toEqual({ ok: true, errors: [] });
  });

  it('never labels a leaf verified without a source', () => {
    const leaves = [];
    for (const model of DATA.models) {
      leaves.push(model.pricing, ...model.bench, ...model.speed);
    }
    for (const equity of DATA.equities) leaves.push(equity.conviction, ...equity.kpis);
    for (const leaf of leaves) {
      if (leaf.tier === 'verified') expect(leaf.src).toMatch(/^https?:\/\//);
    }
  });

  it('reports its provenance mix so pending cells stay visible', () => {
    const counts = countTiers(DATA);
    expect(counts.verified).toBeGreaterThan(0);
    expect(counts.pending).toBeGreaterThan(0);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBeGreaterThan(50);
  });

  it('records Opus 5 as launched and no longer claims 4.8 is the latest', () => {
    const opus5 = DATA.models.find((model) => model.id === 'claude-opus-5');
    expect(opus5.released).toBe('2026-07-24');
    expect(opus5.src).toBe('https://www.anthropic.com/news/claude-opus-5');
    expect(opus5.bench.find((row) => row.id === 'aa_intelligence').value).toBe(61);
  });
});
