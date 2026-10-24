/* ============================================================
   RELATIONSHIPS v2 · six-dimension scale (REL-070), model rel-six-dim.
   Entertainment index — not a prediction, not a probability.

   0.2.0 (owner ruling 2026-10-24, "use the most objective data"):
   - No hand-set magnitudes. A rule only says WHICH dimension it touches
     and whether as support or friction (FAMILY_TABLE, categories from
     the traditions). Every matched outcome counts 1.
   - Each family's contribution to a dimension is the share of its
     decided checks that support (s) and that cause friction (f).
     Families touching a dimension are equally weighted:
       support_d = mean_f s_f,  friction_d = mean_f f_f,
       raw_d = support_d − friction_d
   - Calibration, not weighting: raw_d is mapped piecewise-linearly so the
     table's theoretical minimum → 0, the median of a fixed synthetic
     sample (CALIBRATION, scripts/calibrate-rel-six-dim.mjs) → 50, and
     the theoretical maximum → 100.
   - A dimension with fewer than two families, whose net range is
     one-sided (nothing can push it below or above "no rule matched"), or
     whose calibrated sample spreads less than 20 points between p5 and
     p95, is flagged `rule_coverage_low` — reported, never patched with
     weights.
   - De-duplication (COMPARISON B7): a branch cell that is both 合 and 刑
     counts once for the harmony family and once for the tension family.
   - Unknown facts give state 'unknown', never 'absent'. The model needs
     bazi, western and ziwei all 'ready' for both people; otherwise every
     dimension and the overall index are null (no silent reweighting).
   - Xiu is classification only (unverified tables) and never scored.
   - Archetypes are directional: A_to_B is what A meets in B. Swapping A
     and B swaps them exactly; all six dimensions are symmetric.
   ============================================================ */
import { DIMENSION_IDS } from './contract.js';

export const SCORE_MODEL = Object.freeze({ modelId: 'rel-six-dim', modelVersion: '0.2.0' });
export const SCORE_MODEL_IDS = [SCORE_MODEL.modelId];
export const RULE_VERSION = 'rules-0.2.0';
export const REQUIRED_MODULES = ['bazi', 'western', 'ziwei'];

const S = (d) => [d, 'support'];
const F = (d) => [d, 'friction'];

// ---- family → outcome → effects (categorical only) ----------------------------
export const FAMILY_TABLE = {
  'bazi.day_stems': {
    combo: [S('attraction'), S('rhythm')],
    feeds: [S('emotional_support'), S('building')],
    same: [S('rhythm'), S('communication'), F('growth')],
    guan: [F('rhythm'), S('growth')],
    sha: [F('rhythm'), S('growth')],
    clash: [F('rhythm'), F('communication')],
  },
  'bazi.favours': { matched: [S('emotional_support'), S('building')] },
  'bazi.branch.harmony': { matched: [S('building'), S('rhythm')] },
  'bazi.branch.tension': { matched: [F('rhythm'), F('building')] },
  'western.sun_elements': { same: [S('attraction'), S('communication')], complement: [S('communication'), S('building')] },
  'ziwei.life_palaces': {
    liuhe: [S('building'), S('emotional_support')], sanhe: [S('building')], banhe: [S('building')],
    same: [S('rhythm')], hai: [F('communication')], xing: [F('rhythm')], chong: [F('rhythm'), F('building')],
  },
  'western.attraction': { soft: [S('attraction')], hard: [S('attraction'), F('attraction')] },
  'western.moon': { soft: [S('emotional_support')], hard: [F('emotional_support')] },
  'western.mercury': { soft: [S('communication')], hard: [F('communication')] },
  'western.mars': { soft: [S('growth')], hard: [F('rhythm'), S('growth')] },
  'western.sun': { soft: [S('building')], hard: [S('growth'), F('rhythm')] },
};
// Unordered body pair → aspect family. Conjunction counts with the easy aspects.
const ASPECT_FAMILY = {
  'Sun-Sun': 'sun', 'Moon-Sun': 'moon', 'Mercury-Sun': 'mercury', 'Sun-Venus': 'attraction', 'Mars-Sun': 'mars',
  'Moon-Moon': 'moon', 'Mercury-Moon': 'mercury', 'Moon-Venus': 'moon', 'Mars-Moon': 'mars',
  'Mercury-Mercury': 'mercury', 'Mercury-Venus': 'mercury', 'Mars-Mercury': 'mars',
  'Venus-Venus': 'attraction', 'Mars-Venus': 'attraction', 'Mars-Mars': 'attraction',
};
const HARMONY = ['liuhe', 'banhe'];
const TENSION = ['chong', 'xing', 'hai', 'po'];

function effectsOf(familyId, outcome) {
  const out = {};
  for (const [d, kind] of FAMILY_TABLE[familyId][outcome] || []) {
    const e = (out[d] ||= { support: 0, friction: 0 });
    e[kind] = 1;
  }
  return out;
}

// Families that can move each dimension, with their theoretical range of
// (support − friction) over all outcomes, "nothing matched" (0) included.
export const DIMENSION_FAMILIES = Object.fromEntries(DIMENSION_IDS.map((d) => {
  const fams = [];
  for (const [fam, outcomes] of Object.entries(FAMILY_TABLE)) {
    const vals = [0];
    let support = false, friction = false;
    for (const o of Object.keys(outcomes)) {
      const e = effectsOf(fam, o)[d];
      if (!e) continue;
      vals.push(e.support - e.friction);
      support ||= !!e.support; friction ||= !!e.friction;
    }
    if (support || friction) fams.push({ familyId: fam, lo: Math.min(...vals), hi: Math.max(...vals), support, friction });
  }
  return [d, fams];
}));
export const THEORETICAL_RANGE = Object.fromEntries(DIMENSION_IDS.map((d) => {
  const f = DIMENSION_FAMILIES[d];
  return [d, { lo: f.reduce((s, x) => s + x.lo, 0) / f.length, hi: f.reduce((s, x) => s + x.hi, 0) / f.length }];
}));

// Fixed-sample calibration, generated by scripts/calibrate-rel-six-dim.mjs.
// Re-run and paste when FAMILY_TABLE changes; the model version moves with it.
export const CALIBRATION = Object.freeze({
  sample: { generator: 'scripts/calibrate-rel-six-dim.mjs', prng: 'mulberry32', seed: 20261024, pairs: 100000, used: 99770, dates: '1900-01-01..2100-12-31 uniform', time: 'uniform minute, China civil time' },
  dimensions: {
    attraction: { median: 0.0556, flags: ['rule_coverage_low'] },
    emotional_support: { median: 0.25, flags: [] },
    communication: { median: 0.1786, flags: [] },
    rhythm: { median: -0.0381, flags: [] },
    building: { median: 0.2054, flags: [] },
    growth: { median: 0.1111, flags: [] },
  },
});

// ---- facts → rule evaluations -----------------------------------------------
function evaluation(ruleId, familyId, direction, state, evidenceIds, outcome) {
  return { ruleId, ruleVersion: RULE_VERSION, familyId, scope: 'pair', direction, state, evidenceIds, effects: state === 'matched' ? effectsOf(familyId, outcome) : {} };
}

export function evaluateRules(facts) {
  const out = [];
  for (const f of facts) {
    const unknown = f.basis === 'conflicted';
    if (f.id === 'pair.bazi.dayStems') {
      out.push(evaluation(unknown ? 'bazi.day_stems' : `bazi.day_stems.${f.value}`, 'bazi.day_stems', 'symmetric', unknown ? 'unknown' : 'matched', [f.id], f.value));
    } else if (f.id.startsWith('pair.bazi.favours.')) {
      const dir = f.id.slice('pair.bazi.favours.'.length);
      out.push(evaluation('bazi.favours', 'bazi.favours', dir, unknown ? 'unknown' : f.value ? 'matched' : 'absent', [f.id], 'matched'));
    } else if (f.id.startsWith('pair.bazi.branch.')) {
      const types = f.value || [];
      out.push(evaluation('bazi.branch.harmony', 'bazi.branch.harmony', 'symmetric', unknown ? 'unknown' : types.some((t) => HARMONY.includes(t)) ? 'matched' : 'absent', [f.id], 'matched'));
      out.push(evaluation('bazi.branch.tension', 'bazi.branch.tension', 'symmetric', unknown ? 'unknown' : types.some((t) => TENSION.includes(t)) ? 'matched' : 'absent', [f.id], 'matched'));
    } else if (f.id.startsWith('pair.western.aspect.')) {
      const [ba, bb] = f.id.split('.').slice(3);
      const family = ASPECT_FAMILY[[ba, bb].sort().join('-')];
      const state = unknown ? 'unknown' : f.value === 'none' ? 'absent' : 'matched';
      const outcome = f.value === 'square' || f.value === 'opp' ? 'hard' : 'soft';
      out.push(evaluation(`western.aspect.${family}`, `western.${family}`, 'symmetric', state, [f.id], outcome));
    } else if (f.id === 'pair.western.sunElements') {
      const [a, b] = f.value || [];
      const kind = unknown ? null : a === b ? 'same' : a % 2 === b % 2 ? 'complement' : null;
      out.push(evaluation('western.sun_elements', 'western.sun_elements', 'symmetric', unknown ? 'unknown' : kind ? 'matched' : 'absent', [f.id], kind));
    } else if (f.id === 'pair.ziwei.lifePalaces') {
      const known = !unknown && FAMILY_TABLE['ziwei.life_palaces'][f.value];
      out.push(evaluation('ziwei.life_palaces', 'ziwei.life_palaces', 'symmetric', unknown ? 'unknown' : known ? 'matched' : 'absent', [f.id], f.value));
    }
  }
  return out;
}

// ---- rule evaluations → dimensions ------------------------------------------
// Integer counts per family, so the result never depends on rule order.
export function dimensionTotals(rules) {
  const totals = {};
  for (const d of DIMENSION_IDS) {
    let support = 0, friction = 0, n = 0;
    for (const { familyId } of DIMENSION_FAMILIES[d]) {
      const decided = rules.filter((r) => r.familyId === familyId && r.state !== 'unknown');
      if (!decided.length) continue;
      let s = 0, f = 0;
      for (const r of decided) { s += r.effects[d]?.support || 0; f += r.effects[d]?.friction || 0; }
      support += s / decided.length; friction += f / decided.length; n++;
    }
    const round4 = (x) => Math.round(x * 1e4) / 1e4;
    totals[d] = n ? { support: round4(support / n), friction: round4(friction / n) } : { support: null, friction: null };
  }
  return totals;
}

// raw → 0..100: theoretical min → 0, sample median → 50, theoretical max → 100.
export function calibrate(d, raw) {
  const { lo, hi } = THEORETICAL_RANGE[d];
  const m = CALIBRATION.dimensions[d].median;
  const v = raw <= m ? 50 * (raw - lo) / (m - lo) : 50 + 50 * (raw - m) / (hi - m);
  return Math.max(0, Math.min(100, Math.round(v)));
}

// Share of rule checks that could be decided (not a prediction accuracy).
const ruleCoverage = (rules) => (rules.length ? Math.round(rules.filter((r) => r.state !== 'unknown').length / rules.length * 1000) / 1000 : null);

// ---- archetypes: what X meets in Y ----------------------------------------------
// Themes are traditional symbols read as stories, not facts about a person.
const THEME_ORDER = ['nourished', 'understood', 'heard', 'spark', 'kindred', 'challenged'];
function archetype(facts, dir) {
  const [me, them] = dir === 'A_to_B' ? [0, 1] : [1, 0];
  const byId = new Map(facts.map((f) => [f.id, f]));
  const hits = {};
  const add = (theme, id) => { (hits[theme] ||= []).push(id); };
  const favour = byId.get(`pair.bazi.favours.${dir}`);
  if (favour?.value === true) add('nourished', favour.id);
  if (byId.get('pair.bazi.dayStems')?.value === 'same') add('kindred', 'pair.bazi.dayStems');
  for (const f of facts) {
    if (!f.id.startsWith('pair.western.aspect.') || f.value == null || f.value === 'none') continue;
    const bodies = f.id.split('.').slice(3); // [A body, B body]
    const mine = bodies[me], theirs = bodies[them];
    const hard = f.value === 'square' || f.value === 'opp';
    if (!hard && theirs === 'Moon' && ['Sun', 'Moon', 'Venus'].includes(mine)) add('understood', f.id);
    if (!hard && theirs === 'Mercury' && ['Sun', 'Moon', 'Mercury'].includes(mine)) add('heard', f.id);
    if (!hard && (theirs === 'Mars' || theirs === 'Venus') && ['Sun', 'Venus', 'Mars'].includes(mine) && theirs !== mine) add('spark', f.id);
    if (hard && (theirs === 'Mars' || theirs === 'Sun') && mine !== 'Mars') add('challenged', f.id);
  }
  const themes = THEME_ORDER.filter((t) => hits[t]).slice(0, 3);
  return {
    themeIds: themes.map((t) => `theme.${t}`),
    evidenceIds: [...new Set(themes.flatMap((t) => hits[t]))],
    questionIds: themes.map((t) => `question.${t}`),
  };
}

function missingReasons(modules) {
  return REQUIRED_MODULES.filter((m) => modules[m].status !== 'ready').map((m) => `module_${m}_${modules[m].status}`);
}

export function scoreReport({ modelId, facts, modules }) {
  const rules = evaluateRules(facts);
  const totals = dimensionTotals(rules);
  const missing = missingReasons(modules);
  const ready = missing.length === 0;
  const dimensions = {};
  for (const d of DIMENSION_IDS) {
    const { support, friction } = totals[d];
    const flags = CALIBRATION.dimensions[d].flags;
    dimensions[d] = {
      kind: 'editorial_entertainment_index', ...SCORE_MODEL, modelId,
      status: ready ? 'unverified' : 'insufficient',
      value: ready ? calibrate(d, support - friction) : null,
      ruleCoverage: ruleCoverage(rules),
      reasonKeys: ready ? ['entertainment_index', 'not_externally_validated', ...flags] : [...missing, ...flags],
      support, friction,
    };
  }
  const values = DIMENSION_IDS.map((d) => dimensions[d].value);
  const overall = {
    kind: 'editorial_entertainment_index', ...SCORE_MODEL, modelId,
    status: ready ? 'unverified' : 'insufficient',
    value: ready ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : null,
    ruleCoverage: ruleCoverage(rules),
    reasonKeys: ready ? ['entertainment_index', 'not_externally_validated'] : missing,
  };
  return { rules, dimensions, overall, archetypes: { A_to_B: archetype(facts, 'A_to_B'), B_to_A: archetype(facts, 'B_to_A') } };
}
