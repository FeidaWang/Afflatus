import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, DIMENSION_IDS, SCHEMA_VERSION } from '../src/lib/relationships/contract.js';
import { computeRelationshipReport } from '../src/lib/relationships/kernel.js';
import { evaluateRules, dimensionTotals, calibrate, CALIBRATION, FAMILY_TABLE, THEORETICAL_RANGE, SCORE_MODEL } from '../src/lib/relationships/scale.js';
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

  it('both exact and resolvable: values exist, stay in 0..100 and are labelled an entertainment index', () => {
    const rnd = rng(3);
    let scored = 0;
    for (let i = 0; i < 120; i++) {
      const r = run(randomBirth(rnd, 'exact'), randomBirth(rnd, 'exact'));
      if (r.overall.value == null) continue; // a rare in-window conflict (fold, solar term)
      scored++;
      expect(r.overall.status).toBe('unverified');
      expect(r.overall.reasonKeys).toEqual(['entertainment_index', 'not_externally_validated']);
      for (const d of DIMENSION_IDS) expect(r.dimensions[d].value).toBeGreaterThanOrEqual(0);
      for (const d of DIMENSION_IDS) expect(r.dimensions[d].value).toBeLessThanOrEqual(100);
    }
    expect(scored).toBeGreaterThan(100);
  });
});

describe('six-dimension scale · equal weights (0.2.0)', () => {
  const cell = (types, id = 'pair.bazi.branch.day.day') => ({ id, system: 'bazi', basis: 'computed', value: types });

  it('the rule table carries no magnitudes: every effect is a 0/1 indicator', () => {
    for (const [fam, outcomes] of Object.entries(FAMILY_TABLE)) {
      for (const [outcome, effects] of Object.entries(outcomes)) {
        for (const [d, kind] of effects) {
          expect(DIMENSION_IDS, `${fam}.${outcome}`).toContain(d);
          expect(['support', 'friction']).toContain(kind);
        }
      }
    }
    const rules = evaluateRules([cell(['liuhe', 'chong'])]);
    for (const r of rules) for (const e of Object.values(r.effects)) for (const v of Object.values(e)) expect([0, 1]).toContain(v);
  });

  it('a cell that is both 合 and 刑/破 counts once per family (COMPARISON B7)', () => {
    const rules = evaluateRules([cell(['liuhe', 'xing', 'po'])]); // 巳申
    expect(rules.filter((r) => r.state === 'matched').map((r) => r.familyId).sort()).toEqual(['bazi.branch.harmony', 'bazi.branch.tension']);
    expect(rules.find((r) => r.familyId === 'bazi.branch.tension').effects.rhythm).toEqual({ support: 0, friction: 1 });
  });

  it('families weigh equally on a dimension, however many checks each has', () => {
    const cells = ['year', 'month', 'day', 'hour'].flatMap((a) => ['year', 'month', 'day', 'hour'].map((b) => cell(['chong'], `pair.bazi.branch.${a}.${b}`)));
    const stems = { id: 'pair.bazi.dayStems', system: 'bazi', basis: 'computed', value: 'same' };
    const t = dimensionTotals(evaluateRules([...cells, stems]));
    // rhythm: day stems (1 check, support) and branch tension (16 checks, friction) count 1:1;
    // branch harmony is present with 0 of 16 matched.
    expect(t.rhythm.support).toBeCloseTo(1 / 3, 4);
    expect(t.rhythm.friction).toBeCloseTo(1 / 3, 4);
  });

  it('calibration maps the theoretical minimum to 0, the sample median to 50, the maximum to 100', () => {
    for (const d of DIMENSION_IDS) {
      const { lo, hi } = THEORETICAL_RANGE[d];
      expect(calibrate(d, lo)).toBe(0);
      expect(calibrate(d, CALIBRATION.dimensions[d].median)).toBe(50);
      expect(calibrate(d, hi)).toBe(100);
    }
    expect(CALIBRATION.sample).toMatchObject({ seed: 20261024, pairs: 100000, prng: 'mulberry32' });
  });

  it('on a fresh synthetic sample (other seed) every dimension median stays near 50', () => {
    const rnd = rng(424242);
    const vals = Object.fromEntries(DIMENSION_IDS.map((d) => [d, []]));
    for (let i = 0; i < 1500; i++) {
      const r = run(randomBirth(rnd, 'exact'), randomBirth(rnd, 'exact'));
      if (r.overall.value == null) continue;
      for (const d of DIMENSION_IDS) vals[d].push(r.dimensions[d].value);
    }
    for (const d of DIMENSION_IDS) {
      const a = vals[d].sort((x, y) => x - y);
      expect(Math.abs(a[Math.floor(a.length / 2)] - 50), d).toBeLessThanOrEqual(6);
    }
  });

  it('a one-sided dimension is reported as low rule coverage, not re-weighted', () => {
    expect(THEORETICAL_RANGE.attraction.lo).toBe(0);
    expect(CALIBRATION.dimensions.attraction.flags).toContain('rule_coverage_low');
    const r = run(randomBirth(rng(5), 'exact'), randomBirth(rng(6), 'exact'));
    expect(r.dimensions.attraction.reasonKeys).toContain('rule_coverage_low');
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
