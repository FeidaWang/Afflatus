/* ============================================================
   SYNASTRY BAZI (V25 Part 5 §24.1) — the exact 地支相合相冲 cross-chart
   algorithm for 合盘: every one of A's four pillar branches checked
   against every one of B's, producing a 4×4 (or smaller, hour-unknown)
   matrix plus one 0-100 score.

   Reuses ziping.js's verified pair tables (BRANCH_LIUHE/LIUCHONG/LIUHAI/
   SANHE_GROUPS/XING_CYCLES/ZIMAO_XING) and dayun.js's LIUPO (破) —
   exported specifically for this module (§24.1) rather than duplicated.
   Pure functions, no DOM, no fetch.

   Weights (documented choice, entertainment simplification): pillar-pair
   significance mirrors classical emphasis on the DAY pillar as "the
   self"/spouse-palace axis. Relation point values (合 positive, 冲/刑/害/破
   negative) are summed pillar-pair-weighted, then mapped through a
   logistic (sigmoid) curve centred at 50 so a chart with many strong
   combos can't run away past 100, and one heavy clash can't bottom out
   below 0 — same "no absolute answers" spirit as horoscopeEngine.js.
   ============================================================ */
import { BRANCHES } from './bazi.js';
import { BRANCH_LIUHE, BRANCH_LIUCHONG, BRANCH_LIUHAI, SANHE_GROUPS, XING_CYCLES, ZIMAO_XING } from './ziping.js';
import { LIUPO } from './dayun.js';

const PILLAR_IDS = ['year', 'month', 'day', 'hour'];

// Pillar-pair significance weights (documented choice, see header): the
// day×day axis (the two people's "selves"/spouse palace) matters most.
const PAIR_WEIGHT = {
  'day,day': 1.0,
  'day,year': 0.6, 'year,day': 0.6,
  'day,month': 0.5, 'month,day': 0.5,
  'year,year': 0.5, 'month,month': 0.5,
  'year,month': 0.4, 'month,year': 0.4,
};
const DEFAULT_PAIR_WEIGHT = 0.3; // any pair involving 'hour'
const pairWeight = (ia, ib) => PAIR_WEIGHT[`${ia},${ib}`] ?? DEFAULT_PAIR_WEIGHT;
// Nominal total weight across all 16 pillar-pairs (both charts' hour
// known) — computed once, used to renormalize when hour is missing on
// either side so a 3×4/3×3 matrix isn't systematically pulled toward a
// neutral score just for having fewer pillars to compare.
const FULL_WEIGHT_TOTAL = PILLAR_IDS.reduce((s, ia) => s + PILLAR_IDS.reduce((s2, ib) => s2 + pairWeight(ia, ib), 0), 0);

const RELATION_PTS = { liuhe: 10, banhe: 6, sanhe: 10, chong: -10, xing: -7, hai: -5, po: -4 };

const inPair = (table, a, b) => table.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
const inCycle = (cyc, a, b) => cyc.some(([x, y]) => x === a && y === b); // direction matters (see ziping.js)

// Classify the relation(s) between ONE branch of A and ONE branch of B.
// Mirrors ziping.branchRelations()'s table set but pairwise (two branches
// from two DIFFERENT charts — 自刑/same-branch has no cross-chart meaning,
// so it's intentionally not checked here).
function branchPairRelations(a, b) {
  const out = [];
  if (inPair(BRANCH_LIUHE, a, b)) out.push({ type: 'liuhe', text: BRANCHES[a] + BRANCHES[b] + '合' });
  if (inPair(BRANCH_LIUCHONG, a, b)) out.push({ type: 'chong', text: BRANCHES[a] + BRANCHES[b] + '相冲' });
  if (inPair(BRANCH_LIUHAI, a, b)) out.push({ type: 'hai', text: BRANCHES[a] + BRANCHES[b] + '相害' });
  if (inPair(LIUPO, a, b)) out.push({ type: 'po', text: BRANCHES[a] + BRANCHES[b] + '相破' });
  const g = SANHE_GROUPS.find((grp) => grp.branches.includes(a) && grp.branches.includes(b));
  if (g && a !== b) out.push({ type: 'banhe', text: BRANCHES[a] + BRANCHES[b] + '半合' });
  for (const cyc of XING_CYCLES) {
    for (let i = 0; i < cyc.length; i++) {
      const from = cyc[i], to = cyc[(i + 1) % cyc.length];
      if ((a === from && b === to) || (b === from && a === to)) out.push({ type: 'xing', text: BRANCHES[from] + '刑' + BRANCHES[to] });
    }
  }
  if ((a === ZIMAO_XING[0] && b === ZIMAO_XING[1]) || (a === ZIMAO_XING[1] && b === ZIMAO_XING[0])) {
    out.push({ type: 'xing', text: BRANCHES[ZIMAO_XING[0]] + BRANCHES[ZIMAO_XING[1]] + '相刑' });
  }
  return out;
}

const sigmoid100 = (x) => 100 / (1 + Math.exp(-x / 40)); // centred: x=0 -> 50

// pillarsA/pillarsB: computeBazi() output ({year,month,day,hour} pillars,
// hour possibly null). Returns the 4×4 (or smaller) cell matrix, overall
// score, and flat lists of every combo/clash found (for UI captions).
export function crossBranchMatrix(pillarsA, pillarsB) {
  const idsA = PILLAR_IDS.filter((id) => pillarsA[id]);
  const idsB = PILLAR_IDS.filter((id) => pillarsB[id]);

  const cells = [];
  let weightedSum = 0;
  let totalWeightPresent = 0;
  const combos = [];
  const clashes = [];

  for (const ia of idsA) {
    for (const ib of idsB) {
      const a = pillarsA[ia].branch, b = pillarsB[ib].branch;
      const relations = branchPairRelations(a, b);
      const w = pairWeight(ia, ib);
      totalWeightPresent += w;
      let cellPts = 0;
      for (const r of relations) {
        const pts = RELATION_PTS[r.type] ?? 0;
        cellPts += pts;
        const entry = { pa: ia, pb: ib, type: r.type, text: r.text, w };
        if (pts > 0) combos.push(entry); else if (pts < 0) clashes.push(entry);
      }
      weightedSum += cellPts * w;
      cells.push({ pa: ia, pb: ib, relations: relations.map((r) => r.type), texts: relations.map((r) => r.text), w });
    }
  }

  const scaleFactor = totalWeightPresent > 0 ? FULL_WEIGHT_TOTAL / totalWeightPresent : 1;
  const score = Math.round(sigmoid100(weightedSum * scaleFactor));
  return { cells, score, combos, clashes, idsA, idsB };
}
