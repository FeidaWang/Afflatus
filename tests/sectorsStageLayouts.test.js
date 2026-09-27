// tests/sectorsStageLayouts.test.js
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SCENES, buildDots, sceneTargets, interpolate } from '../src/sectors/stage/layouts.js';

const snapshot = JSON.parse(readFileSync('public/data/sectors-frontier/2026-09-27.json', 'utf8'));
const industry = JSON.parse(readFileSync('public/data/sectors-industry/2026-09-27.json', 'utf8'));
const dots = buildDots(snapshot);
const ctx = { dots, snapshot, industry, width: 1200, height: 800 };

describe('stage layouts', () => {
  it('has one dot per model × metric', () => expect(dots).toHaveLength(snapshot.models.length * snapshot.metrics.length));
  it.each(SCENES)('%s conserves dots and stays on canvas', (scene) => {
    const t = sceneTargets(scene, ctx);
    expect(t).toHaveLength(dots.length);
    for (const p of t) {
      expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThanOrEqual(1200);
      expect(p.y).toBeGreaterThanOrEqual(0); expect(p.y).toBeLessThanOrEqual(800);
    }
  });
  it('colours dots by geography with the flag tokens in the ecosystems scene', () => {
    const t = sceneTargets('ecosystems', ctx);
    dots.forEach((d, i) => expect(t[i].color).toBe(d.geo === 'US' ? '#0A3161' : '#EE1C25'));
  });
  it('stacks equal values vertically without overlap in the distributions scene', () => {
    const t = sceneTargets('distributions', ctx);
    const seen = new Set();
    t.forEach((p, i) => { if (p.alpha > 0) { const k = `${Math.round(p.x)}|${Math.round(p.y)}`; expect(seen.has(k), `dot ${i}`).toBe(false); seen.add(k); } });
  });
  it('interpolates endpoints exactly', () => {
    const a = { x: 0, y: 0, r: 2, color: '#0A3161', alpha: 1 }, b = { x: 10, y: 20, r: 4, color: '#EE1C25', alpha: 0 };
    expect(interpolate(a, b, 0, 0, 10)).toMatchObject({ x: 0, y: 0 });
    expect(interpolate(a, b, 1, 9, 10)).toMatchObject({ x: 10, y: 20, color: '#EE1C25' });
  });

  // Amendments (Task 8 rulings): the globe must actually face both ecosystems in S1,
  // and S5 highlights the four issuers named in #issuers (spec §2.1), not labs.
  it('turns the globe so both US and China dots are on the visible hemisphere in the ecosystems scene', () => {
    const t = sceneTargets('ecosystems', ctx);
    for (const geo of ['US', 'CN']) {
      const shown = dots.filter((d, i) => d.geo === geo && t[i].alpha === 1);
      expect(shown.length, geo).toBe(dots.filter((d) => d.geo === geo).length);
    }
  });
  it('lights exactly the four listed issuers in the value scene, each with a label', () => {
    const t = sceneTargets('value', ctx);
    const labels = [...new Set(t.filter((p) => p.alpha === 1).map((p) => p.label))].sort();
    expect(labels).toEqual(['Alibaba', 'Broadcom', 'Micron', 'Xiaomi']);
    expect(t.filter((p) => p.alpha === 1 && p.labelAnchor).map((p) => p.label).sort()).toEqual(['Alibaba', 'Broadcom', 'Micron', 'Xiaomi']);
  });
});

// §2.3 item 2: the geography module's country counts now live on the S1 card.
import { regionCounts } from '../src/sectors/stage/region-counts.js';
describe('regionCounts', () => {
  it('counts scored configurations, open weights and the median index per region', () => {
    const rows = regionCounts(snapshot);
    expect(rows.map((r) => r.id)).toEqual(['US', 'CN']);
    const scored = snapshot.models.filter((m) => m.status === 'reported_snapshot' && snapshot.observations.some((o) =>
      o.model_id === m.id && o.metric_id === 'intelligence' && o.evidence_status === 'reported_snapshot' && Number.isFinite(o.value)));
    expect(rows.reduce((n, r) => n + r.count, 0)).toBe(scored.filter((m) => ['US', 'CN'].includes(m.lab_geography)).length);
    for (const r of rows) expect(r.open).toBe(scored.filter((m) => m.lab_geography === r.id && m.open_weights).length);
  });
  it('takes the middle of an even list', () => {
    const tiny = { models: ['a', 'b'].map((id) => ({ id, status: 'reported_snapshot', lab_geography: 'US', open_weights: false })),
      observations: [['a', 40], ['b', 50]].map(([model_id, value]) => ({ model_id, value, metric_id: 'intelligence', evidence_status: 'reported_snapshot' })) };
    expect(regionCounts(tiny)[0]).toMatchObject({ id: 'US', count: 2, open: 0, median: 45 });
    expect(regionCounts(tiny)[1]).toMatchObject({ id: 'CN', count: 0, median: null });
  });
});
