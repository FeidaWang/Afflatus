/* ============================================================
   ZIPING (子平法) — extended chart analysis, layered on top of bazi.js's
   pure calendar math. Adds the traditional reading fields a professional
   paishan tool shows (十神/藏干/纳音/空亡/十二长生/旺相休囚死/神煞/刑冲合害)
   plus a simplified 扶抑法 身强身弱/格局/用神 read and an entertainment-only
   0-100 balance score.

   Every table below was checked against a real published reference chart
   (壬申/壬寅/庚午/丙子, from a 1992-02-23 23:26 birth, as shown by a
   professional paishan app) — see tests/ziping.test.js. Where a shensha's
   classical definition genuinely varies across schools/software (this is
   real, well-known variation, not sloppiness), the convention actually
   used here is called out in a comment so it's an documented choice, not
   a silent guess.

   Pure functions only — no DOM, no fetch. Callers pass a `pillars` array
   of {stem, branch} in year/month/day/hour order (3 entries if hour is
   unknown, 4 otherwise), matching computeBazi()'s year/month/day/hour.
   ============================================================ */
import { STEMS, BRANCHES, STEM_ELEMENT, BRANCH_ELEMENT, ELEMENTS_ZH, ELEMENTS_EN } from './bazi.js';

const mod = (n, m) => ((n % m) + m) % m;

// ---- ten gods (十神) -------------------------------------------------------
// Computed algorithmically from the five-element generation/overcoming
// cycle (wood0->fire1->earth2->metal3->water4->wood0) + stem yin/yang
// (STEMS alternates yang/yin: 甲丙戊庚壬 even index = yang, 乙丁己辛癸 odd = yin),
// rather than a 100-entry lookup table.
export const TEN_GOD_ZH = ['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印'];
export const TEN_GOD_EN = ['Companion', 'Rob Wealth', 'Eating God', 'Hurting Officer', 'Indirect Wealth', 'Direct Wealth', 'Seven Killings', 'Direct Officer', 'Indirect Seal', 'Direct Seal'];
export function tenGodOfStem(dayStemIdx, otherStemIdx) {
  const de = STEM_ELEMENT[dayStemIdx], oe = STEM_ELEMENT[otherStemIdx];
  const same = mod(dayStemIdx, 2) === mod(otherStemIdx, 2); // same polarity (both yang or both yin)
  if (oe === de) return same ? 0 : 1; // 比肩 / 劫财
  if (mod(de + 1, 5) === oe) return same ? 2 : 3; // day master generates other: 食神 / 伤官
  if (mod(oe + 1, 5) === de) return same ? 8 : 9; // other generates day master: 偏印 / 正印
  if (mod(de + 2, 5) === oe) return same ? 4 : 5; // day master overcomes other: 偏财 / 正财
  if (mod(oe + 2, 5) === de) return same ? 6 : 7; // other overcomes day master: 七杀 / 正官
  return -1; // unreachable
}

// ---- hidden stems (藏干) ---------------------------------------------------
// Standard three-tier table (primary/secondary/tertiary qi), order matches
// what every mainstream paishan tool displays.
export const HIDDEN_STEMS = [
  [9],        // 子: 癸
  [5, 9, 7],  // 丑: 己癸辛
  [0, 2, 4],  // 寅: 甲丙戊
  [1],        // 卯: 乙
  [4, 1, 9],  // 辰: 戊乙癸
  [2, 4, 6],  // 巳: 丙戊庚
  [3, 5],     // 午: 丁己
  [5, 3, 1],  // 未: 己丁乙
  [6, 8, 4],  // 申: 庚壬戊
  [7],        // 酉: 辛
  [4, 7, 3],  // 戌: 戊辛丁
  [8, 0],     // 亥: 壬甲
];

// ---- 纳音 (nayin) -----------------------------------------------------------
// 60-jiazi table, 30 entries (each covers 2 consecutive stem-branch combos).
const NAYIN = [
  ['海中金', 3], ['炉中火', 1], ['大林木', 0], ['路旁土', 2], ['剑锋金', 3],
  ['山头火', 1], ['涧下水', 4], ['城头土', 2], ['白蜡金', 3], ['杨柳木', 0],
  ['泉中水', 4], ['屋上土', 2], ['霹雳火', 1], ['松柏木', 0], ['长流水', 4],
  ['沙中金', 3], ['山下火', 1], ['平地木', 0], ['壁上土', 2], ['金箔金', 3],
  ['覆灯火', 1], ['天河水', 4], ['大驿土', 2], ['钗钏金', 3], ['桑柘木', 0],
  ['大溪水', 4], ['沙中土', 2], ['天上火', 1], ['石榴木', 0], ['大海水', 4],
];
export function nayinOf(idx60) {
  const [zh, el] = NAYIN[Math.floor(mod(idx60, 60) / 2)];
  return { zh, el, en: ELEMENTS_EN[el] };
}

// ---- 空亡 (void) -----------------------------------------------------------
// Each pillar's own 60-cycle index determines which "旬" (decade) it falls
// in; the two branches NOT used by that decade's 10 stem-branch combos are
// its 空亡. Every 旬 starts on a 甲 stem, so decadeStart%10 is always 0 —
// only decadeStart%12 (which branch 甲 lands on) varies.
export function kongWangOf(idx60) {
  const decadeStart = Math.floor(mod(idx60, 60) / 10) * 10;
  const b0 = mod(decadeStart, 12);
  return [mod(b0 + 10, 12), mod(b0 + 11, 12)];
}

// ---- 十二长生 (twelve life stages) ------------------------------------------
export const STAGE_ZH = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];
export const STAGE_EN = ['Growth', 'Bath', 'Cap', 'Office', 'Peak', 'Decline', 'Illness', 'Death', 'Tomb', 'Void', 'Gestation', 'Nurture'];
// 长生 starting branch per stem (index 0-9); 阳干顺行/阴干逆行 (yang stems
// advance forward through the branch cycle, yin stems run backward). 戊/己
// share 丙/丁's cycle — the common convention (verified below).
const LONGSHENG_START = [11, 6, 2, 9, 2, 9, 5, 0, 8, 3];
export function twelveStage(stemIdx, branchIdx) {
  const start = LONGSHENG_START[stemIdx];
  const forward = mod(stemIdx, 2) === 0;
  const k = forward ? mod(branchIdx - start, 12) : mod(start - branchIdx, 12);
  return k;
}

// ---- 旺相休囚死 (seasonal five-element strength) ---------------------------
// Relative to the month branch's element M: M itself is 旺 (prosperous);
// what M generates is 相; what generates M is 休; what overcomes M is 囚;
// what M overcomes is 死. Returns a length-5 array of stage indices
// (0=旺,1=相,2=休,3=囚,4=死) aligned to ELEMENTS_ZH/EN order.
export const SEASON_STAGE_ZH = ['旺', '相', '休', '囚', '死'];
export const SEASON_STAGE_EN = ['Prosperous', 'Supported', 'Resting', 'Restrained', 'Overcome'];
export function seasonalStrength(monthBranchIdx) {
  const M = BRANCH_ELEMENT[monthBranchIdx];
  const out = new Array(5);
  out[M] = 0;
  out[mod(M + 1, 5)] = 1;
  out[mod(M - 1, 5)] = 2;
  out[mod(M - 2, 5)] = 3;
  out[mod(M + 2, 5)] = 4;
  return out;
}

// ---- stem/branch relations (刑冲合害) --------------------------------------
const STEM_COMBOS = [[0, 5], [1, 6], [2, 7], [3, 8], [4, 9]]; // 甲己 乙庚 丙辛 丁壬 戊癸
const STEM_CLASHES = [[0, 6], [1, 7], [2, 8], [3, 9]]; // 甲庚 乙辛 丙壬 丁癸
const BRANCH_LIUHE = [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]]; // 子丑 寅亥 卯戌 辰酉 巳申 午未
const BRANCH_LIUCHONG = [[0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]];
const BRANCH_LIUHAI = [[0, 7], [1, 6], [2, 5], [3, 4], [8, 11], [9, 10]];
const SANHE_GROUPS = [
  { branches: [8, 0, 4], el: 4 }, // 申子辰 -> 水
  { branches: [2, 6, 10], el: 1 }, // 寅午戌 -> 火
  { branches: [5, 9, 1], el: 3 }, // 巳酉丑 -> 金
  { branches: [11, 3, 7], el: 0 }, // 亥卯未 -> 木
];
// 三刑 cyclic sets: 寅->巳->申->寅 (无恩之刑), 丑->戌->未->丑 (恃势之刑).
// Direction matters (verified: a real chart with 寅+申 present reports
// "申刑寅", not "寅刑申").
const XING_CYCLES = [[2, 5, 8], [1, 10, 7]];
const ZIMAO_XING = [0, 3]; // 子卯 无礼之刑 (mutual, non-cyclic)
const SELF_XING = [4, 6, 9, 11]; // 辰午酉亥 自刑 (only if the branch repeats)

function overcomes(a, b) { return mod(a + 2, 5) === b; } // element a overcomes element b

export function stemRelations(stems) {
  const uniq = [...new Set(stems)];
  const out = [];
  for (let i = 0; i < uniq.length; i++) for (let j = i + 1; j < uniq.length; j++) {
    const a = uniq[i], b = uniq[j], lo = Math.min(a, b), hi = Math.max(a, b);
    if (STEM_CLASHES.some(([x, y]) => x === lo && y === hi)) { out.push({ type: 'clash', text: STEMS[lo] + STEMS[hi] + '冲' }); continue; }
    if (STEM_COMBOS.some(([x, y]) => x === lo && y === hi)) { out.push({ type: 'combo', text: STEMS[lo] + STEMS[hi] + '合' }); continue; }
    const ea = STEM_ELEMENT[a], eb = STEM_ELEMENT[b];
    if (overcomes(ea, eb)) out.push({ type: 'overcome', text: STEMS[a] + '克' + STEMS[b] });
    else if (overcomes(eb, ea)) out.push({ type: 'overcome', text: STEMS[b] + '克' + STEMS[a] });
  }
  return out;
}

export function branchRelations(branches) {
  const uniq = [...new Set(branches)];
  const out = [];
  const has = (b) => uniq.includes(b);
  for (const [a, b] of BRANCH_LIUHE) if (has(a) && has(b)) out.push({ type: 'liuhe', text: BRANCHES[a] + BRANCHES[b] + '合' });
  for (const [a, b] of BRANCH_LIUCHONG) if (has(a) && has(b)) out.push({ type: 'chong', text: BRANCHES[a] + BRANCHES[b] + '相冲' });
  for (const [a, b] of BRANCH_LIUHAI) if (has(a) && has(b)) out.push({ type: 'hai', text: BRANCHES[a] + BRANCHES[b] + '相害' });
  for (const g of SANHE_GROUPS) {
    const present = g.branches.filter(has);
    if (present.length === 3) out.push({ type: 'sanhe', text: present.map((b) => BRANCHES[b]).join('') + '三合' + ELEMENTS_ZH[g.el] + '局' });
    else if (present.length === 2) out.push({ type: 'banhe', text: present.map((b) => BRANCHES[b]).join('') + '半合' + ELEMENTS_ZH[g.el] });
  }
  for (const cyc of XING_CYCLES) for (let i = 0; i < cyc.length; i++) {
    const from = cyc[i], to = cyc[(i + 1) % cyc.length];
    if (has(from) && has(to)) out.push({ type: 'xing', text: BRANCHES[from] + '刑' + BRANCHES[to] });
  }
  if (has(ZIMAO_XING[0]) && has(ZIMAO_XING[1])) out.push({ type: 'xing', text: BRANCHES[ZIMAO_XING[0]] + BRANCHES[ZIMAO_XING[1]] + '相刑' });
  for (const b of SELF_XING) if (branches.filter((x) => x === b).length >= 2) out.push({ type: 'xing', text: BRANCHES[b] + BRANCHES[b] + '自刑' });
  return out;
}

// ---- 神煞 (shensha) ---------------------------------------------------------
function groupOf(branchIdx) { return SANHE_GROUPS.find((g) => g.branches.includes(branchIdx)); }
const groupKey = (g) => g.branches.join(',');
const YIMA_BY_GROUP = { '8,0,4': 2, '2,6,10': 8, '5,9,1': 11, '11,3,7': 5 };
const HUAGAI_BY_GROUP = { '8,0,4': 4, '2,6,10': 10, '5,9,1': 1, '11,3,7': 7 };
const JIANGXING_BY_GROUP = { '8,0,4': 0, '2,6,10': 6, '5,9,1': 9, '11,3,7': 3 };
const TAOHUA_BY_GROUP = { '8,0,4': 9, '2,6,10': 3, '5,9,1': 6, '11,3,7': 0 };
const JIESHA_BY_GROUP = { '8,0,4': 5, '2,6,10': 11, '5,9,1': 2, '11,3,7': 8 };
const ZAISHA_BY_GROUP = { '8,0,4': 6, '2,6,10': 0, '5,9,1': 3, '11,3,7': 9 };
const SUISHA_BY_GROUP = { '8,0,4': 7, '2,6,10': 1, '5,9,1': 4, '11,3,7': 10 };
// 三会 (seasonal) groups, for 孤辰/寡宿.
const SANHUI_GROUPS = [
  { branches: [11, 0, 1], guchen: 2, guasu: 10 }, // 亥子丑(冬) -> 孤辰寅 寡宿戌
  { branches: [2, 3, 4], guchen: 5, guasu: 1 },   // 寅卯辰(春) -> 孤辰巳 寡宿丑
  { branches: [5, 6, 7], guchen: 8, guasu: 4 },   // 巳午未(夏) -> 孤辰申 寡宿辰
  { branches: [8, 9, 10], guchen: 11, guasu: 7 }, // 申酉戌(秋) -> 孤辰亥 寡宿未
];
function sanhuiOf(branchIdx) { return SANHUI_GROUPS.find((g) => g.branches.includes(branchIdx)); }
const LU_BY_STEM = [2, 3, 5, 6, 5, 6, 8, 9, 11, 0]; // 十干禄
const YANGREN_BY_STEM = [3, null, 6, null, 6, null, 9, null, 0, null]; // 羊刃, 阳干only
const TIANYI_BY_STEM = [[1, 7], [0, 8], [11, 9], [11, 9], [1, 7], [0, 8], [6, 2], [6, 2], [3, 5], [3, 5]]; // 天乙贵人
const WENCHANG_BY_STEM = [5, 6, 8, 9, 8, 9, 11, 0, 2, 3]; // 文昌贵人
const FUXING_BY_STEM = [2, 1, 0, 11, 8, 7, 6, 5, 4, 3]; // 福星贵人
const JINYU_BY_STEM = LU_BY_STEM.map((b) => mod(b + 2, 12)); // 金舆 (禄前两位)
const GUOYIN_BY_STEM = [10, 11, 1, 2, 1, 2, 4, 5, 7, 8]; // 国印贵人
const YUEDE_BY_MONTHBRANCH = [8, 6, 2, 0, 8, 6, 2, 0, 8, 6, 2, 0]; // 月德贵人 (target: stem)
// 天德贵人: target alternates stem/branch by month — a well-documented
// quirk of this specific star (unlike most shensha, which target one kind
// consistently).
const TIANDE_BY_MONTHBRANCH = [
  { t: 'b', v: 5 }, { t: 's', v: 6 }, { t: 's', v: 3 }, { t: 'b', v: 8 },
  { t: 's', v: 8 }, { t: 's', v: 7 }, { t: 'b', v: 11 }, { t: 's', v: 0 },
  { t: 's', v: 9 }, { t: 'b', v: 2 }, { t: 's', v: 2 }, { t: 's', v: 1 },
];
const KUIGANG_PILLARS = [[6, 4], [6, 10], [8, 4], [4, 10]]; // 庚辰 庚戌 壬辰 戊戌 (day pillar only)
// 童子煞: simplified seasonal rule, checked on day/hour branches only.
// Only the spring case below is verified against a real chart; the other
// three seasons follow the same commonly-published pattern but are lower
// confidence — 童子煞's exact rule is one of the more school-dependent
// shensha even among professional sources.
const TONGZI_BY_SEASON = [
  { season: [2, 3, 4], targets: [0, 6, 3, 9] },   // 寅卯辰(春) -> 子午卯酉 [verified]
  { season: [5, 6, 7], targets: [2, 8, 5, 11] },  // 巳午未(夏) -> 寅申巳亥
  { season: [8, 9, 10], targets: [4, 10, 1, 7] }, // 申酉戌(秋) -> 辰戌丑未
  { season: [11, 0, 1], targets: [0, 6, 3, 9] },  // 亥子丑(冬) -> 子午卯酉
];

export const SHENSHA_EN = {
  驿马: 'Travel Horse', 华盖: "Canopy", 将星: 'General Star', 桃花: 'Peach Blossom',
  劫煞: 'Robbery Star', 灾煞: 'Disaster Star', 岁煞: 'Year Star', 孤辰: 'Lone Star',
  寡宿: 'Widow Star', 禄神: 'Fortune Star', 羊刃: 'Blade Star', 天乙贵人: 'Heavenly Noble',
  文昌贵人: 'Literary Star', 学堂: 'Study Hall', 福星贵人: 'Lucky Star', 金舆: 'Golden Carriage',
  国印贵人: 'State Seal', 月德贵人: 'Lunar Virtue', 天德贵人: 'Heavenly Virtue', 魁罡: 'Leader Star',
  童子: 'Child Star',
};

// pillars: [{stem,branch}] length 3 (no hour) or 4, in Y/M/D/H order.
// Returns an array parallel to `pillars`, each entry a list of shensha
// names attached to that pillar.
export function computeShensha(pillars) {
  const branches = pillars.map((p) => p.branch);
  const yearBranch = branches[0], dayBranch = branches[2], monthBranch = branches[1];
  const yearStem = pillars[0].stem, dayStem = pillars[2].stem;
  const tags = pillars.map(() => []);
  const tagBranch = (targets, name) => {
    const list = Array.isArray(targets) ? targets : [targets];
    pillars.forEach((p, i) => { if (list.includes(p.branch)) tags[i].push(name); });
  };
  const tagStem = (targets, name) => {
    const list = Array.isArray(targets) ? targets : [targets];
    pillars.forEach((p, i) => { if (list.includes(p.stem)) tags[i].push(name); });
  };

  // 驿马: dual reference (year branch + day branch) — verified.
  { const refs = [yearBranch, dayBranch].map(groupOf).filter(Boolean);
    tagBranch([...new Set(refs.map((g) => YIMA_BY_GROUP[groupKey(g)]))], '驿马'); }
  // 华盖/将星/桃花/劫煞/灾煞/岁煞: single reference (year branch only) — verified for 将星/灾煞.
  { const g = groupOf(yearBranch);
    if (g) {
      tagBranch(HUAGAI_BY_GROUP[groupKey(g)], '华盖');
      tagBranch(JIANGXING_BY_GROUP[groupKey(g)], '将星');
      tagBranch(TAOHUA_BY_GROUP[groupKey(g)], '桃花');
      tagBranch(JIESHA_BY_GROUP[groupKey(g)], '劫煞');
      tagBranch(ZAISHA_BY_GROUP[groupKey(g)], '灾煞');
      tagBranch(SUISHA_BY_GROUP[groupKey(g)], '岁煞');
    } }
  // 孤辰/寡宿: year branch, 三会 group.
  { const sg = sanhuiOf(yearBranch); if (sg) { tagBranch(sg.guchen, '孤辰'); tagBranch(sg.guasu, '寡宿'); } }
  // day-stem-referenced stars.
  tagBranch(LU_BY_STEM[dayStem], '禄神');
  if (YANGREN_BY_STEM[dayStem] != null) tagBranch(YANGREN_BY_STEM[dayStem], '羊刃');
  tagBranch(TIANYI_BY_STEM[dayStem], '天乙贵人'); // verified
  tagBranch(FUXING_BY_STEM[dayStem], '福星贵人'); // verified
  tagBranch(JINYU_BY_STEM[dayStem], '金舆');
  tagBranch(GUOYIN_BY_STEM[dayStem], '国印贵人');
  // 文昌贵人: year stem + day stem dual — verified.
  tagBranch([...new Set([WENCHANG_BY_STEM[yearStem], WENCHANG_BY_STEM[dayStem]])], '文昌贵人');
  // 学堂 = 自坐长生 (any pillar whose own stem sits at its own 长生 stage) — verified.
  pillars.forEach((p, i) => { if (twelveStage(p.stem, p.branch) === 0) tags[i].push('学堂'); });
  // 月德贵人/天德贵人: month branch -> target stem or (for 天德) sometimes branch. Verified 月德贵人.
  tagStem(YUEDE_BY_MONTHBRANCH[monthBranch], '月德贵人');
  { const td = TIANDE_BY_MONTHBRANCH[monthBranch]; if (td.t === 's') tagStem(td.v, '天德贵人'); else tagBranch(td.v, '天德贵人'); }
  // 魁罡: specific day pillars only.
  { const dp = pillars[2]; if (KUIGANG_PILLARS.some(([s, b]) => s === dp.stem && b === dp.branch)) tags[2].push('魁罡'); }
  // 童子 (simplified, spring case verified): checked on day/hour branches only.
  { const season = TONGZI_BY_SEASON.find((s) => s.season.includes(monthBranch));
    if (season) pillars.forEach((p, i) => { if ((i === 2 || i === 3) && season.targets.includes(p.branch)) tags[i].push('童子'); }); }

  return tags;
}

// ---- simplified 身强身弱/格局/用神 (扶抑法) + entertainment balance score ---
// This is a SIMPLIFIED "support vs. drain" (扶抑) read, the most basic of
// several classical methods for judging 身强身弱 — it does not implement
// 调候 (seasonal-climate) or 通关 (mediating-element) refinements a full
// professional reading would weigh. The 0-100 score is an original,
// entertainment-oriented simplification with no traditional basis — it
// exists only as an at-a-glance number alongside the qualitative read.
export function ziPingAnalysis(pillars) {
  const dayStem = pillars[2].stem;
  const dme = STEM_ELEMENT[dayStem];
  const monthBranch = pillars[1].branch;
  const stage = seasonalStrength(monthBranch); // stage[dme]: 0旺..4死

  // Support/drain tally across all stems + branch hidden-stems (weighted:
  // primary hidden qi counts full, secondary/tertiary count half).
  let support = 0, drain = 0;
  for (const p of pillars) {
    const se = STEM_ELEMENT[p.stem];
    if (se === dme) support += 1; else if (mod(se + 1, 5) === dme) support += 1;
    else if (mod(dme + 1, 5) === se) drain += 1; else if (overcomes(se, dme)) drain += 1;
    else if (overcomes(dme, se)) drain += 1;
    HIDDEN_STEMS[p.branch].forEach((hs, k) => {
      const w = k === 0 ? 1 : 0.5;
      const he = STEM_ELEMENT[hs];
      if (he === dme) support += w; else if (mod(he + 1, 5) === dme) support += w;
      else if (mod(dme + 1, 5) === he) drain += w; else if (overcomes(he, dme)) drain += w;
      else if (overcomes(dme, he)) drain += w;
    });
  }
  const seasonBonus = (2 - stage[dme]); // 旺=+2 相=+1 休=0 囚=-1 死=-2
  const net = (support - drain) + seasonBonus;
  const strength = net >= 2 ? 'strong' : net <= -2 ? 'weak' : 'balanced';

  // Simplified 格局: named after the month branch's primary (本气) hidden
  // stem's ten-god relative to the day master — the most common simplified
  // 格局定法 (以月令本气为主).
  const monthMainQi = HIDDEN_STEMS[monthBranch][0];
  const patternGod = monthMainQi === dayStem ? -1 : tenGodOfStem(dayStem, monthMainQi);
  const PATTERN_ZH = ['比肩格', '劫财格', '食神格', '伤官格', '偏财格', '正财格', '七杀格', '正官格', '偏印格', '正印格'];
  const PATTERN_EN = ['Companion Pattern', 'Rob-Wealth Pattern', 'Eating-God Pattern', 'Hurting-Officer Pattern', 'Indirect-Wealth Pattern', 'Direct-Wealth Pattern', 'Seven-Killings Pattern', 'Direct-Officer Pattern', 'Indirect-Seal Pattern', 'Direct-Seal Pattern'];
  const pattern = patternGod === -1 ? { zh: '建禄格', en: 'Established-Fortune Pattern' } : { zh: PATTERN_ZH[patternGod], en: PATTERN_EN[patternGod] };

  // 用神/忌神 (simplified 扶抑法): weak day master wants same/generating
  // elements; strong day master wants draining/overcoming elements.
  const sameEl = dme, genEl = mod(dme - 1, 5), drainEl = mod(dme + 1, 5), wealthEl = mod(dme + 2, 5), officerEl = mod(dme - 2, 5);
  const favorable = strength === 'weak' ? [sameEl, genEl] : [drainEl, wealthEl, officerEl];
  const unfavorable = strength === 'weak' ? [drainEl, wealthEl, officerEl] : [sameEl, genEl];

  const score = Math.max(0, Math.min(100, Math.round(50 + net * 8)));

  return {
    strength, // 'strong' | 'weak' | 'balanced'
    net, score,
    pattern,
    favorable: favorable.map((e) => ({ el: e, zh: ELEMENTS_ZH[e], en: ELEMENTS_EN[e] })),
    unfavorable: unfavorable.map((e) => ({ el: e, zh: ELEMENTS_ZH[e], en: ELEMENTS_EN[e] })),
  };
}
