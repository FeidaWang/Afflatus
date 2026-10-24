/* ============================================================
   RELATIONSHIPS v2 · six-dimension scale (REL-070), model rel-six-dim.

   Facts → rule evaluations → per-dimension support and friction →
   score = 50 + 50 × (supportRatio − frictionRatio)   (v2 ALGORITHM_DELTA)

   - Categories are traditional (天干五合/冲, 地支六合/半合/冲刑害破,
     aspects, 命宫 relations); every point value is ORIGINAL editorial
     weight, version-pinned below. Draft: status 'unverified' until the
     owner signs off the weights (see SCALE_SENSITIVITY doc).
   - Support and friction are kept apart, never netted inside a rule.
   - De-duplication (COMPARISON B7): a branch cell that is both 合 and 刑
     yields at most one harmony and one tension evaluation, each taking the
     strongest relation in its family — never 合 + 刑 + 破 stacked.
   - Every family's contribution to a dimension is capped (FAMILY_CAP);
     ratios divide by a fixed per-dimension budget, so adding rules never
     rescales old ones.
   - Unknown facts give state 'unknown', never 'absent'. The model needs
     bazi, western and ziwei all 'ready' for both people; otherwise every
     dimension and the overall index are null (no silent reweighting).
   - Xiu is classification only (unverified tables) and never scored.
   - Archetypes are directional: A_to_B is what A meets in B. Swapping A
     and B swaps them exactly; all six dimensions are symmetric.
   ============================================================ */
import { DIMENSION_IDS } from './contract.js';

export const SCORE_MODEL = Object.freeze({ modelId: 'rel-six-dim', modelVersion: '0.1.0-draft' });
export const SCORE_MODEL_IDS = [SCORE_MODEL.modelId];
export const RULE_VERSION = 'rules-2026-10-24';
export const REQUIRED_MODULES = ['bazi', 'western', 'ziwei'];

const S = (n) => ({ support: n, friction: 0 });
const F = (n) => ({ support: 0, friction: n });
const SF = (s, f) => ({ support: s, friction: f });

// ---- rule tables (original weights) ---------------------------------------
const DAY_STEMS = {
  combo: { attraction: S(3), rhythm: S(1) },
  feeds: { emotional_support: S(3), building: S(1) },
  same: { rhythm: S(2), communication: S(1), growth: F(1) },
  guan: { rhythm: F(1), growth: S(1) },
  sha: { rhythm: F(2), growth: S(1) },
  clash: { rhythm: F(3), communication: F(1) },
};
const FAVOURS = { emotional_support: S(2), building: S(1) };
const HARMONY_PTS = { liuhe: 3, banhe: 2 };
const TENSION_PTS = { chong: 3, xing: 2, hai: 1.5, po: 1 };
const CELL_WEIGHT = { 'day.day': 1, 'day.year': 0.6, 'year.day': 0.6, 'day.month': 0.5, 'month.day': 0.5, 'year.year': 0.5, 'month.month': 0.5, 'year.month': 0.4, 'month.year': 0.4 };
const cellWeight = (pa, pb) => CELL_WEIGHT[`${pa}.${pb}`] ?? 0.3;
const SUN_ELEMENTS = { same: { attraction: S(1), communication: S(1) }, complement: { communication: S(1), building: S(0.5) } };
const ZIWEI = {
  liuhe: { building: S(2), emotional_support: S(1) }, sanhe: { building: S(2) }, banhe: { building: S(1) },
  same: { rhythm: S(1.5) }, hai: { communication: F(1) }, xing: { rhythm: F(1.5) }, chong: { rhythm: F(2), building: F(1) },
};
// Unordered body pair → aspect family and effects by aspect key.
const SOFT = { conj: 3, trine: 2, sextile: 1.5 };
const ASPECT_FAMILY = {
  'Sun-Sun': 'sun', 'Moon-Sun': 'moon', 'Mercury-Sun': 'mercury', 'Sun-Venus': 'attraction', 'Mars-Sun': 'mars',
  'Moon-Moon': 'moon', 'Mercury-Moon': 'mercury', 'Moon-Venus': 'moon', 'Mars-Moon': 'mars',
  'Mercury-Mercury': 'mercury', 'Mercury-Venus': 'mercury', 'Mars-Mercury': 'mars',
  'Venus-Venus': 'attraction', 'Mars-Venus': 'attraction', 'Mars-Mars': 'attraction',
};
function aspectEffects(family, key) {
  const hard = key === 'square' || key === 'opp';
  const soft = SOFT[key];
  switch (family) {
    case 'attraction': return hard ? { attraction: SF(1, 1.5) } : { attraction: S(soft) };
    case 'moon': return hard ? { emotional_support: F(2) } : { emotional_support: S(soft) };
    case 'mercury': return hard ? { communication: F(2) } : { communication: S(soft) };
    case 'mars': return hard ? { rhythm: F(2), growth: S(1) } : { growth: S(1.5) };
    default: return hard ? { growth: S(1), rhythm: F(1) } : { building: S(2) };
  }
}

// Cap per family on each dimension component, and the fixed budget each
// dimension's support / friction sum is divided by.
export const FAMILY_CAP = {
  'bazi.day_stems': 3, 'bazi.favours': 3, 'bazi.branch.harmony': 4, 'bazi.branch.tension': 4,
  'western.attraction': 5, 'western.moon': 5, 'western.mercury': 5, 'western.mars': 4, 'western.sun': 3,
  'western.sun_elements': 1, 'ziwei.life_palaces': 2,
};
export const DIMENSION_BUDGET = {
  attraction: { support: 8, friction: 6 },
  emotional_support: { support: 9, friction: 5 },
  communication: { support: 7, friction: 6 },
  rhythm: { support: 5, friction: 9 },
  building: { support: 8, friction: 4 },
  growth: { support: 6, friction: 4 },
};

// ---- facts → rule evaluations -----------------------------------------------
const STATE = (fact) => (fact.basis === 'conflicted' ? 'unknown' : 'matched');

function evaluation(ruleId, familyId, direction, state, evidenceIds, effects) {
  return { ruleId, ruleVersion: RULE_VERSION, familyId, scope: 'pair', direction, state, evidenceIds, effects: state === 'matched' ? effects : {} };
}

export function evaluateRules(facts) {
  const out = [];
  for (const f of facts) {
    const unknown = f.basis === 'conflicted';
    if (f.id === 'pair.bazi.dayStems') {
      out.push(evaluation(unknown ? 'bazi.day_stems' : `bazi.day_stems.${f.value}`, 'bazi.day_stems', 'symmetric', STATE(f), [f.id], unknown ? {} : DAY_STEMS[f.value]));
    } else if (f.id.startsWith('pair.bazi.favours.')) {
      const dir = f.id.slice('pair.bazi.favours.'.length);
      out.push(evaluation('bazi.favours', 'bazi.favours', dir, unknown ? 'unknown' : f.value ? 'matched' : 'absent', [f.id], FAVOURS));
    } else if (f.id.startsWith('pair.bazi.branch.')) {
      const [pa, pb] = f.id.split('.').slice(3);
      const w = cellWeight(pa, pb);
      const types = f.value || [];
      const h = Math.max(0, ...types.map((t) => HARMONY_PTS[t] ?? 0));
      const t = Math.max(0, ...types.map((x) => TENSION_PTS[x] ?? 0));
      out.push(evaluation('bazi.branch.harmony', 'bazi.branch.harmony', 'symmetric', unknown ? 'unknown' : h ? 'matched' : 'absent', [f.id], { building: S(h * w), rhythm: S(h * w * 0.5) }));
      out.push(evaluation('bazi.branch.tension', 'bazi.branch.tension', 'symmetric', unknown ? 'unknown' : t ? 'matched' : 'absent', [f.id], { rhythm: F(t * w), building: F(t * w * 0.5) }));
    } else if (f.id.startsWith('pair.western.aspect.')) {
      const [ba, bb] = f.id.split('.').slice(3);
      const family = ASPECT_FAMILY[[ba, bb].sort().join('-')];
      const state = unknown ? 'unknown' : f.value === 'none' ? 'absent' : 'matched';
      out.push(evaluation(`western.aspect.${family}`, `western.${family}`, 'symmetric', state, [f.id], state === 'matched' ? aspectEffects(family, f.value) : {}));
    } else if (f.id === 'pair.western.sunElements') {
      const [a, b] = f.value || [];
      const kind = unknown ? null : a === b ? 'same' : a % 2 === b % 2 ? 'complement' : null;
      out.push(evaluation('western.sun_elements', 'western.sun_elements', 'symmetric', unknown ? 'unknown' : kind ? 'matched' : 'absent', [f.id], kind ? SUN_ELEMENTS[kind] : {}));
    } else if (f.id === 'pair.ziwei.lifePalaces') {
      const fx = unknown ? null : ZIWEI[f.value];
      out.push(evaluation('ziwei.life_palaces', 'ziwei.life_palaces', 'symmetric', unknown ? 'unknown' : fx ? 'matched' : 'absent', [f.id], fx || {}));
    }
  }
  return out;
}

// ---- rule evaluations → dimensions ------------------------------------------
// Summed in integer hundredths so the total never depends on rule order
// (swapping A and B reorders the facts; floats would drift at x.x5).
const cents = (x) => Math.round(x * 100);
const round1 = (x) => Math.round(x * 10) / 10;

export function dimensionTotals(rules) {
  const totals = {};
  for (const d of DIMENSION_IDS) {
    const byFamily = {};
    for (const r of rules) {
      const e = r.effects[d];
      if (!e) continue;
      const fam = (byFamily[r.familyId] ||= { support: 0, friction: 0 });
      fam.support += cents(e.support); fam.friction += cents(e.friction);
    }
    let support = 0, friction = 0;
    for (const [fam, v] of Object.entries(byFamily)) {
      support += Math.min(v.support, cents(FAMILY_CAP[fam]));
      friction += Math.min(v.friction, cents(FAMILY_CAP[fam]));
    }
    totals[d] = { support: support / 100, friction: friction / 100 };
  }
  return totals;
}

// Share of rule checks that could be decided (not a prediction accuracy).
const ruleCoverage = (rules) => (rules.length ? round1(rules.filter((r) => r.state !== 'unknown').length / rules.length * 100) / 100 : null);

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
    const b = DIMENSION_BUDGET[d];
    const { support, friction } = totals[d];
    const value = ready ? Math.max(0, Math.min(100, Math.round(50 + 50 * (Math.min(1, support / b.support) - Math.min(1, friction / b.friction))))) : null;
    dimensions[d] = {
      kind: 'editorial_entertainment_index', ...SCORE_MODEL, modelId,
      status: ready ? 'unverified' : 'insufficient', value, ruleCoverage: ruleCoverage(rules),
      reasonKeys: ready ? ['draft_weights'] : missing,
      support, friction,
    };
  }
  const values = DIMENSION_IDS.map((d) => dimensions[d].value);
  const overall = {
    kind: 'editorial_entertainment_index', ...SCORE_MODEL, modelId,
    status: ready ? 'unverified' : 'insufficient',
    value: ready ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : null,
    ruleCoverage: ruleCoverage(rules),
    reasonKeys: ready ? ['draft_weights'] : missing,
  };
  return { rules, dimensions, overall, archetypes: { A_to_B: archetype(facts, 'A_to_B'), B_to_A: archetype(facts, 'B_to_A') } };
}
