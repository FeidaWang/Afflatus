import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, DIMENSION_IDS, SCHEMA_VERSION } from '../src/lib/relationships/contract.js';
import { computeRelationshipReport } from '../src/lib/relationships/kernel.js';
import { evaluateRules, dimensionTotals, FAMILY_CAP, SCORE_MODEL } from '../src/lib/relationships/scale.js';
import { slotRange } from '../src/horoscope/formDetails.js';

// Seeded synthetic births (property inputs, never real people).
function rng(seed) { return () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648; }
const pad = (n) => String(n).padStart(2, '0');
function randomBirth(rnd, mode) {
  const localDate = `${1930 + Math.floor(rnd() * 90)}-${pad(1 + Math.floor(rnd() * 12))}-${pad(1 + Math.floor(rnd() * 28))}`;
  const kind = mode ?? ['exact', 'exact', 'range', 'unknown'][Math.floor(rnd() * 4)];
  const time = kind === 'exact' ? { kind, localTime: `${pad(Math.floor(rnd() * 24))}:${pad(Math.floor(rnd() * 60))}`, precision: 'minute' }
    : kind === 'range' ? slotRange([0, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23][Math.floor(rnd() * 13)]) : { kind: 'unknown' };
  const zones = [undefined, 'Asia/Tokyo', 'Europe/London', 'America/New_York', 'Australia/Melbourne'];
  const tz = zones[Math.floor(rnd() * zones.length)];
  return { localDate, calendar: 'gregorian', time, ...(tz ? { timezone: tz } : {}) };
}
const run = (A, B) => computeRelationshipReport({ schemaVersion: SCHEMA_VERSION, requestId: 'req-scale-001', A, B, config: structuredClone(DEFAULT_CONFIG), scoreModelId: SCORE_MODEL.modelId });
const ruleBag = (r) => r.rules.map((x) => `${x.ruleId}|${x.state}`).sort();

describe('six-dimension scale · role swap', () => {
  it('symmetric dimensions match and directional archetypes swap, over 300 random pairs', () => {
    const rnd = rng(20261024);
    for (let i = 0; i < 300; i++) {
      const A = randomBirth(rnd), B = randomBirth(rnd);
      const ab = run(A, B), ba = run(B, A);
      for (const d of DIMENSION_IDS) {
        expect(ba.dimensions[d].value).toBe(ab.dimensions[d].value);
        expect(ba.dimensions[d].support).toBeCloseTo(ab.dimensions[d].support, 6);
        expect(ba.dimensions[d].friction).toBeCloseTo(ab.dimensions[d].friction, 6);
      }
      expect(ba.overall.value).toBe(ab.overall.value);
      expect(ruleBag(ba)).toEqual(ruleBag(ab));
      expect(ba.archetypes.B_to_A).toEqual({ ...ab.archetypes.A_to_B, evidenceIds: ba.archetypes.B_to_A.evidenceIds });
      expect(ba.archetypes.A_to_B.themeIds).toEqual(ab.archetypes.B_to_A.themeIds);
    }
  });
});

describe('six-dimension scale · unknown propagation', () => {
  it('a missing birth time makes every dimension and the overall null, never 0 or 50', () => {
    const rnd = rng(7);
    for (let i = 0; i < 120; i++) {
      const r = run(randomBirth(rnd, 'unknown'), randomBirth(rnd));
      expect(r.overall.value).toBeNull();
      expect(r.overall.status).toBe('insufficient');
      expect(r.overall.reasonKeys).toContain('module_ziwei_unsupported');
      for (const d of DIMENSION_IDS) expect(r.dimensions[d].value).toBeNull();
    }
  });

  it('a conflicted fact is evaluated as unknown, never absent, and contributes nothing', () => {
    const rnd = rng(99);
    for (let i = 0; i < 150; i++) {
      const r = run(randomBirth(rnd), randomBirth(rnd));
      const conflicted = new Set(r.facts.filter((f) => f.basis === 'conflicted').map((f) => f.id));
      for (const rule of r.rules) {
        if (rule.evidenceIds.some((id) => conflicted.has(id))) {
          expect(rule.state).toBe('unknown');
          expect(rule.effects).toEqual({});
        }
      }
    }
  });

  it('both exact and resolvable: values exist, stay in 0..100 and are marked draft', () => {
    const rnd = rng(3);
    let scored = 0;
    for (let i = 0; i < 120; i++) {
      const r = run(randomBirth(rnd, 'exact'), randomBirth(rnd, 'exact'));
      if (r.overall.value == null) continue; // a rare in-window conflict (fold, solar term)
      scored++;
      expect(r.overall.status).toBe('unverified');
      expect(r.overall.reasonKeys).toContain('draft_weights');
      for (const d of DIMENSION_IDS) expect(r.dimensions[d].value).toBeGreaterThanOrEqual(0);
      for (const d of DIMENSION_IDS) expect(r.dimensions[d].value).toBeLessThanOrEqual(100);
    }
    expect(scored).toBeGreaterThan(100);
  });
});

describe('six-dimension scale · de-duplication and caps', () => {
  const cell = (types, id = 'pair.bazi.branch.day.day') => ({ id, system: 'bazi', basis: 'computed', value: types });

  it('a cell that is both 合 and 刑/破 counts once per family (COMPARISON B7)', () => {
    const rules = evaluateRules([cell(['liuhe', 'xing', 'po'])]); // 巳申
    expect(rules.filter((r) => r.state === 'matched').map((r) => r.familyId).sort()).toEqual(['bazi.branch.harmony', 'bazi.branch.tension']);
    const tension = rules.find((r) => r.familyId === 'bazi.branch.tension');
    expect(tension.effects.rhythm.friction).toBe(2); // the strongest (刑 2), not 刑 + 破
  });

  it('a family never exceeds its cap on any dimension', () => {
    const many = ['day.day', 'day.year', 'year.day', 'year.year', 'month.month', 'day.month'].map((k) => cell(['chong'], `pair.bazi.branch.${k}`));
    const totals = dimensionTotals(evaluateRules(many));
    expect(totals.rhythm.friction).toBe(FAMILY_CAP['bazi.branch.tension']);
  });

  it('support and friction stay separate rather than netting to a middling number', () => {
    const r = evaluateRules([cell(['liuhe', 'chong'])]);
    const t = dimensionTotals(r);
    expect(t.rhythm.support).toBeGreaterThan(0);
    expect(t.rhythm.friction).toBeGreaterThan(0);
  });

  it('xiu facts never become scoring rules', () => {
    const rules = evaluateRules([{ id: 'pair.xiu.A_to_B', system: 'xiu', basis: 'unverified', value: 'ming' }]);
    expect(rules).toEqual([]);
  });
});

describe('six-dimension scale · determinism and labels', () => {
  it('same input, same output; the legacy and new models carry different ids', () => {
    const rnd = rng(11);
    const A = randomBirth(rnd, 'exact'), B = randomBirth(rnd, 'exact');
    expect(run(A, B)).toEqual(run(A, B));
    const r = run(A, B);
    expect(r.overall.modelId).toBe('rel-six-dim');
    expect(r.legacy.modelId).toBe('legacy-resonance');
  });
});
