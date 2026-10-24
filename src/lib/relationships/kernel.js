/* ============================================================
   RELATIONSHIPS v2 · pure kernel (REL-010).
   ComputeRequest → RelationshipReport. No DOM, network, storage or
   clock: the same request always yields the same report.

   Facts are evaluated at every instant time.js returns for a person (one
   for an exact time; both ends of a range or of the unknown-time day
   window). A fact whose value differs between those instants is
   `conflicted` with value null — never the start value passed off as
   known. For bodies that move monotonically over a day (all five used
   here) an aspect or sign that agrees at the window's ends holds inside
   it too.

   `legacy` re-runs the pre-v2 engines exactly as the current page did,
   so the page renders numbers instead of computing them.
   ============================================================ */
import { computeBazi, STEM_ELEMENT } from '../bazi.js';
import { ziPingAnalysis } from '../ziping.js';
import { sunLongitude, moonLongitude, ascendant, signOf, aspectBetween } from '../astro.js';
import { planetReading } from '../astroPlanets.ts';
import { computeZiwei } from '../ziwei.js';
import { solarToLunar } from '../lunar.js';
import { natalXiu, xiuRelation } from '../xiu.js';
import { synastry, dayStemRelation } from '../horoscopeEngine.js';
import { crossBranchMatrix, branchPairRelations } from '../synastryBazi.js';
import { relationshipScores, synastryZiwei } from '../synastryModes.js';
import { computeSynastryAstro } from '../horoscopeSynthesis.js';
import {
  SCHEMA_VERSION, ENGINE_VERSION, SOURCE_IDS, ERROR_CODES, RelationshipError, assertComputeRequest,
} from './contract.js';
import { resolveBirthTime, cstOf, jdOf } from './time.js';
import { SCORE_MODEL_IDS, scoreReport } from './scale.js';

export const ADAPTER_VERSION = 'rel-adapter-0.1.0';
export const LEGACY_MODEL = Object.freeze({ modelId: 'legacy-resonance', modelVersion: 'r0-2026-10-23' });

const PILLARS = ['year', 'month', 'day', 'hour'];
const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars'];
const key = (v) => JSON.stringify(v);

// The value every evaluation agrees on, or undefined when they differ.
function agreed(values) {
  return values.every((v) => key(v) === key(values[0])) ? values[0] : undefined;
}

function makeFact(id, system, value, opts) {
  return {
    id, system,
    basis: opts.basis ?? (value === undefined ? 'conflicted' : 'computed'),
    value: value === undefined ? null : value,
    sourceIds: opts.sourceIds,
    adapterVersion: ADAPTER_VERSION,
    methodVersion: opts.methodVersion,
    limitationKeys: value === undefined ? [...(opts.limitationKeys || []), 'differs_within_time_window'] : (opts.limitationKeys || []),
  };
}

function longitudes(utcMs) {
  const jd = jdOf(utcMs);
  return {
    Sun: sunLongitude(jd), Moon: moonLongitude(jd),
    Mercury: planetReading('Mercury', jd).lonDeg, Venus: planetReading('Venus', jd).lonDeg, Mars: planetReading('Mars', jd).lonDeg,
  };
}

function person(P, input, config) {
  const t = resolveBirthTime(input);
  const facts = [];
  const hourKnown = t.kind !== 'unknown';
  const baziOpts = { sourceIds: [SOURCE_IDS.bazi], methodVersion: config.bazi.methodVersion };

  // ---- bazi: date-based three pillars when the time is unknown (Q1) ----
  const charts = hourKnown ? t.points.map((u) => computeBazi(cstOf(u))) : [computeBazi(t.legacy)];
  const pillar = {};
  for (const id of PILLARS) {
    const flagged = charts.some((c) => c.boundaryUnstable && (c.boundaryUnstable.pillar === id || (c.boundaryUnstable.pillar === 'year' && id === 'month')));
    const v = flagged ? undefined : agreed(charts.map((c) => (c[id] ? { stem: c[id].stem, branch: c[id].branch } : null)));
    pillar[id] = v;
    const limits = id === 'hour' && !hourKnown ? ['time_unknown'] : flagged ? ['solar_term_boundary'] : [];
    facts.push(makeFact(`${P}.bazi.pillar.${id}`, 'bazi', v, { ...baziOpts, limitationKeys: limits }));
  }
  const known = PILLARS.filter((id) => pillar[id]);
  const settled = PILLARS.every((id) => pillar[id] !== undefined);
  const dayMaster = pillar.day ? pillar.day.stem : undefined;
  const favourable = settled ? ziPingAnalysis(known.map((id) => pillar[id])).favorable.map((f) => f.el) : undefined;
  facts.push(makeFact(`${P}.bazi.favourable`, 'bazi', favourable, { sourceIds: [SOURCE_IDS.ziping], methodVersion: config.bazi.methodVersion, limitationKeys: hourKnown ? [] : ['three_pillars'] }));
  const baziStatus = !settled ? 'partial' : hourKnown ? 'ready' : 'partial';
  const baziReasons = [...(hourKnown ? [] : ['time_unknown']), ...(settled ? [] : ['pillar_unstable'])];

  // ---- western: five bodies at every evaluation instant ----
  const lons = t.points.map(longitudes);
  const westOpts = (body) => ({ sourceIds: [body === 'Sun' || body === 'Moon' ? SOURCE_IDS.meeus : SOURCE_IDS.astronomyEngine], methodVersion: config.western.aspectPolicyId });
  const sign = {};
  for (const body of BODIES) {
    sign[body] = agreed(lons.map((l) => signOf(l[body])));
    facts.push(makeFact(`${P}.western.${body}.sign`, 'western', sign[body], westOpts(body)));
  }
  let asc;
  let ascLimits = [];
  if (!hourKnown) { asc = null; ascLimits = ['time_unknown']; }
  else if (!input.place) { asc = null; ascLimits = ['place_unknown']; }
  else {
    const degs = t.points.map((u) => ascendant(jdOf(u), input.place.latitude, input.place.longitude));
    const s = agreed(degs.map(signOf));
    asc = s === undefined ? undefined : t.points.length === 1 ? { sign: s, degree: Math.round(degs[0] * 10) / 10 } : { sign: s, degree: null };
    if (t.points.length > 1 && s !== undefined) ascLimits = ['degree_withheld_for_window'];
  }
  facts.push(makeFact(`${P}.western.ascendant`, 'western', asc, { sourceIds: [SOURCE_IDS.meeus], methodVersion: config.western.aspectPolicyId, limitationKeys: ascLimits }));

  // ---- ziwei: needs a birth time ----
  let ming;
  let ziweiStatus = 'unsupported';
  let ziweiReasons = ['time_unknown'];
  let zw = null;
  if (hourKnown) {
    const zs = t.points.map((u) => computeZiwei(cstOf(u)));
    if (zs.some((z) => !z)) { ziweiStatus = 'failed'; ziweiReasons = ['lunar_out_of_range']; }
    else {
      const view = (z) => {
        const own = z.palaces[z.ming].stars;
        return { branch: z.ming, stars: own, borrowedStars: own.length ? [] : z.palaces[(z.ming + 6) % 12].stars };
      };
      ming = agreed(zs.map(view));
      zw = ming === undefined ? null : zs[0];
      ziweiStatus = ming === undefined ? 'partial' : 'ready';
      ziweiReasons = ming === undefined ? ['life_palace_unstable'] : [];
    }
    facts.push(makeFact(`${P}.ziwei.lifePalace`, 'ziwei', ming, { sourceIds: [SOURCE_IDS.ziwei, SOURCE_IDS.lunar], methodVersion: config.ziwei.methodVersion, limitationKeys: ming && !ming.stars.length ? ['no_major_star_borrow_opposite'] : [] }));
  }

  // ---- xiu: natal mansion from the civil (CST) birth date ----
  // Month-start table and three-nine mapping checked against T1299 (see
  // SOURCES_AND_LICENSES); a leap-month birth uses the host month, a site
  // convention the scripture does not state, so only that stays unverified.
  const dates = hourKnown ? t.points.map((u) => { const c = cstOf(u); return [c.y, c.m, c.d]; }) : [[t.legacy.y, t.legacy.m, t.legacy.d]];
  const lunars = dates.map(([y, m, d]) => solarToLunar(y, m, d));
  const mansion = agreed(lunars.map((l) => (l ? natalXiu(l.lMonth, l.lDay) : null)));
  const leapMonth = lunars.some((l) => l?.isLeap);
  facts.push(makeFact(`${P}.xiu.natal`, 'xiu', mansion, {
    basis: mansion === undefined ? 'conflicted' : leapMonth ? 'unverified' : 'computed',
    sourceIds: [SOURCE_IDS.xiuyao, SOURCE_IDS.lunar], methodVersion: config.xiu.natalMethodId,
    limitationKeys: leapMonth ? ['leap_month_site_convention'] : [],
  }));

  return {
    t, facts, pillar, dayMaster, favourable, sign, lons, ming, zw, mansion, leapMonth,
    modules: {
      bazi: { status: baziStatus, reasonKeys: baziReasons },
      // A time window is only 'partial' once a western fact actually differs
      // inside it (checked in computeRelationshipReport).
      western: { status: hourKnown ? 'ready' : 'partial', reasonKeys: hourKnown ? [] : ['time_unknown'] },
      ziwei: { status: ziweiStatus, reasonKeys: ziweiReasons },
      xiu: mansion == null ? { status: 'failed', reasonKeys: ['lunar_out_of_range'] }
        : leapMonth ? { status: 'unverified', reasonKeys: ['leap_month_site_convention'] } : { status: 'ready', reasonKeys: [] },
    },
  };
}

function pairFacts(A, B, config) {
  const facts = [];
  const baziOpts = { sourceIds: [SOURCE_IDS.bazi, SOURCE_IDS.ziping], methodVersion: config.bazi.methodVersion };

  facts.push(makeFact('pair.bazi.dayStems', 'bazi',
    A.dayMaster === undefined || B.dayMaster === undefined ? undefined : dayStemRelation(A.dayMaster, B.dayMaster), baziOpts));

  for (const [dir, X, Y] of [['A_to_B', A, B], ['B_to_A', B, A]]) {
    const v = X.favourable === undefined || Y.dayMaster === undefined ? undefined : X.favourable.includes(STEM_ELEMENT[Y.dayMaster]);
    facts.push(makeFact(`pair.bazi.favours.${dir}`, 'bazi', v, baziOpts));
  }

  for (const pa of PILLARS) {
    for (const pb of PILLARS) {
      const a = A.pillar[pa], b = B.pillar[pb];
      if (a === null || b === null) continue; // hour unknown: the cell doesn't exist (Q9 three-pillar comparison)
      const v = a === undefined || b === undefined ? undefined : branchPairRelations(a.branch, b.branch).map((r) => r.type);
      facts.push(makeFact(`pair.bazi.branch.${pa}.${pb}`, 'bazi', v, baziOpts));
    }
  }

  const westOpts = { sourceIds: [SOURCE_IDS.meeus, SOURCE_IDS.astronomyEngine], methodVersion: config.western.aspectPolicyId };
  for (const ba of BODIES) {
    for (const bb of BODIES) {
      const vals = [];
      for (const la of A.lons) for (const lb of B.lons) vals.push(aspectBetween(la[ba], lb[bb])?.key ?? 'none');
      facts.push(makeFact(`pair.western.aspect.${ba}.${bb}`, 'western', agreed(vals), westOpts));
    }
  }
  const tri = (s) => (s === undefined ? undefined : s % 4);
  const elA = tri(A.sign.Sun), elB = tri(B.sign.Sun);
  facts.push(makeFact('pair.western.sunElements', 'western', elA === undefined || elB === undefined ? undefined : [elA, elB].sort(), westOpts));

  if (A.t.kind !== 'unknown' && B.t.kind !== 'unknown') {
    const v = A.zw && B.zw ? synastryZiwei(A.zw, B.zw).relKey : undefined;
    facts.push(makeFact('pair.ziwei.lifePalaces', 'ziwei', v, { sourceIds: [SOURCE_IDS.ziwei], methodVersion: config.ziwei.methodVersion }));
  }

  for (const [dir, X, Y] of [['A_to_B', A, B], ['B_to_A', B, A]]) {
    const v = X.mansion == null || Y.mansion == null ? undefined : xiuRelation(X.mansion, Y.mansion);
    const leap = X.leapMonth || Y.leapMonth;
    facts.push(makeFact(`pair.xiu.${dir}`, 'xiu', v, { basis: v === undefined ? 'conflicted' : leap ? 'unverified' : 'computed', sourceIds: [SOURCE_IDS.xiuyao], methodVersion: config.xiu.natalMethodId, limitationKeys: leap ? ['leap_month_site_convention'] : [] }));
  }
  return facts;
}

// The pre-v2 page outputs, computed exactly as horoscope.js used to.
function legacyScores(LA, LB) {
  const s = synastry(LA, LB);
  const astro = computeSynastryAstro({ me: LA, other: LB, baziBase: s.base });
  const zA = LA.hour == null ? null : computeZiwei(LA);
  const zB = LB.hour == null ? null : computeZiwei(LB);
  return {
    ...LEGACY_MODEL,
    base: s.base, parts: s.parts, chartA: s.chartA, chartB: s.chartB,
    matrix: crossBranchMatrix(s.chartA, s.chartB),
    astro,
    lenses: relationshipScores(s, astro.aspects),
    ziwei: zA && zB ? synastryZiwei(zA, zB) : null,
  };
}

const MODULE_ORDER = ['bazi', 'ziwei', 'western', 'xiu'];
const RANK = { failed: 0, unsupported: 1, unverified: 2, partial: 3, ready: 4 };
const worst = (a, b) => (RANK[a.status] <= RANK[b.status] ? a : b);

export function computeRelationshipReport(request) {
  assertComputeRequest(request, SCORE_MODEL_IDS);
  try {
    const A = person('A', request.A, request.config);
    const B = person('B', request.B, request.config);
    const modules = {};
    for (const sys of MODULE_ORDER) {
      const w = worst(A.modules[sys], B.modules[sys]);
      modules[sys] = { status: w.status, reasonKeys: [...new Set([...A.modules[sys].reasonKeys, ...B.modules[sys].reasonKeys])] };
    }
    const facts = [...A.facts, ...B.facts, ...pairFacts(A, B, request.config)];
    if (facts.some((f) => f.system === 'western' && f.basis === 'conflicted') && modules.western.status === 'ready') {
      modules.western = { status: 'partial', reasonKeys: [...modules.western.reasonKeys, 'differs_within_time_window'] };
    }
    const core = ['bazi', 'western', 'ziwei'];
    const status = MODULE_ORDER.every((s) => modules[s].status === 'failed') ? 'failed'
      : core.every((s) => modules[s].status === 'ready') ? 'ready' : 'partial';
    const scored = scoreReport({ modelId: request.scoreModelId, facts, modules });
    return {
      schemaVersion: SCHEMA_VERSION,
      requestId: request.requestId,
      status,
      engineVersion: ENGINE_VERSION,
      configVersion: request.config.configVersion,
      modules,
      facts,
      rules: scored.rules,
      dimensions: scored.dimensions,
      overall: scored.overall,
      archetypes: scored.archetypes,
      warnings: [...A.t.flags.map((f) => `A.${f}`), ...B.t.flags.map((f) => `B.${f}`)],
      legacy: legacyScores(A.t.legacy, B.t.legacy),
    };
  } catch (error) {
    if (error instanceof RelationshipError) throw error;
    throw new RelationshipError(ERROR_CODES.INTERNAL, [], { retryable: false });
  }
}
