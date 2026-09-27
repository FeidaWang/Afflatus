// tests/sectorsHeadToHead.test.js
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { headToHead, pairedScale, valueOf } from '../src/sectors/industry/head-to-head.js';

const snap = {
  metrics: [
    { id: 'intelligence', label: { en: 'Overall', zh: '综合' }, unit: 'pts', direction: 'higher' },
    { id: 'cost_task', label: { en: 'Cost', zh: '成本' }, unit: 'usd', direction: 'lower' },
    { id: 'lcr', label: { en: 'LCR', zh: '长上下文' }, unit: 'pts', direction: 'higher' },
    { id: 'hle', label: { en: 'HLE', zh: 'HLE' }, unit: 'pts', direction: 'higher' },
  ],
  observations: [
    { model_id: 'a', metric_id: 'intelligence', value: 58 }, { model_id: 'b', metric_id: 'intelligence', value: 53 },
    { model_id: 'a', metric_id: 'cost_task', value: 7.6 }, { model_id: 'b', metric_id: 'cost_task', value: 3.3 },
    { model_id: 'a', metric_id: 'lcr', value: 85 }, { model_id: 'b', metric_id: 'lcr', value: 85 },
    { model_id: 'a', metric_id: 'hle', value: null }, { model_id: 'b', metric_id: 'hle', value: 55 },
    { model_id: 'r', metric_id: 'intelligence', value: 53 },
  ],
};

describe('valueOf', () => {
  it('returns null for absent observations', () => {
    expect(valueOf(snap, 'a', 'intelligence')).toBe(58);
    expect(valueOf(snap, 'r', 'hle')).toBeNull();
  });
});

describe('headToHead', () => {
  const r = headToHead(snap, 'a', 'b', { refId: 'r' });
  it('respects metric direction', () => {
    expect(r.aLeads).toEqual(['intelligence']);
    expect(r.bLeads).toEqual(['cost_task']);
  });
  it('reports ties and missing values without picking a leader', () => {
    expect(r.ties).toEqual(['lcr']);
    expect(r.missing).toEqual(['hle']);
    expect(r.rows.find((x) => x.metricId === 'hle').delta).toBeNull();
  });
  it('carries the reference model', () => expect(r.rows[0].ref).toBe(53));
});

describe('pairedScale', () => {
  it('maps the larger value to 1 with a zero baseline', () => {
    const s = pairedScale({ a: 58, b: 53, ref: 53 });
    expect(s(58)).toBe(1);
    expect(s(53)).toBeCloseTo(53 / 58);
    expect(s(null)).toBeNull();
  });
  it('handles negative values from the omniscience metric', () => {
    const s = pairedScale({ a: -10, b: 20, ref: null });
    expect(s(-10)).toBe(0);
    expect(s(20)).toBe(1);
  });
  it('returns null when nothing is known', () => expect(pairedScale({ a: null, b: null, ref: null })).toBeNull());
});

describe('real snapshot', () => {
  it('runs on the 2026-09-27 snapshot: Opus 5.5 leads the overall index', () => {
    const real = JSON.parse(readFileSync('public/data/sectors-frontier/2026-09-27.json', 'utf8'));
    const r = headToHead(real, 'opus55-max', 'astra-max', { refId: 'fable-max' });
    expect(r.aLeads).toContain('intelligence');
    expect(r.rows).toHaveLength(real.metrics.length);
  });
});
