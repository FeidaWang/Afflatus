/* ============================================================
   BAZI PRO — 专业排盘 layer on top of bazi.js / ziping.js.

   What this adds (each rule cites its classical basis; where schools
   disagree the choice is named so the page can say so):
   - proTable(): 主星/副星 (stem & hidden-stem ten gods), 星运 (day master's
     十二长生 at each branch), 自坐 (each stem at its own branch), 空亡,
     纳音, 神煞 (existing computeShensha + the extra stars below).
   - strength(): quantified 身强身弱. Hidden stems weighted by the
     旺相休囚死-derived shares (子癸100; 丑己59辛34癸7 …), position weights
     年干8 年支4 月干12 月支40 日支12 时干12 时支12 (renormalised when the
     hour is unknown); 同党 (印+比劫) share → 从强 ≥0.80 / 身强 0.55–0.80 /
     中和 0.45–0.55 / 身弱 0.20–0.45 / 从弱 <0.20 with no 本/中气 root.
     These cut-offs are software conventions, not classical constants.
   - geju(): 《子平真诠·论用神》 — 建禄/月刃(阳干)/月劫 first; else the
     first month-branch hidden stem (本→中→余) that 透 in the year/month/
     hour stems; else the 本气. Plus 外格 detection (专旺 五格、从强、
     从财/从杀/从儿/从势、化气格 flagged "possible").
   - yongshen(): 扶抑 (《滴天髓》) + 调候 (《穷通宝鉴》 table, condensed
     edition) → 用神/喜神/忌神/仇神/闲神 as five elements.
   - careers(): 五行行业分类 from 用神/喜神 (folk table; IT/媒体 placement
     varies by school — we follow the majority: 火).
   - partner(): 配偶星 (男财女官), 夫妻宫 (day branch) and its 十神, 桃花/
     红鸾/天喜, and the "complementary" partner profile (day master of your
     用神 element; 生肖 六合/三合; 日柱 天合地合 pillar).
   - hehun(): two-chart 合婚 — 生肖, 年命纳音, 日柱 天合地合/天克地冲,
     夫妻宫 relation, 用神互补; returned as categories plus a transparent
     weighted score (weights are this site's, stated in the UI).
   - flow(): 流年/流月/流日 against the natal chart and current 大运 —
     岁运并临, 伏吟, 反吟(天克地冲), 太岁 relations.
   ENTERTAINMENT ONLY.
   ============================================================ */
import { STEMS, BRANCHES, STEM_ELEMENT, BRANCH_ELEMENT, ELEMENTS_ZH, ELEMENTS_EN, ANIMALS_ZH, ANIMALS_EN, pillarName } from './bazi.js';
import {
  tenGodOfStem, TEN_GOD_ZH, TEN_GOD_EN, HIDDEN_STEMS, twelveStage, STAGE_ZH, STAGE_EN, nayinOf, kongWangOf,
  computeShensha, SANHE_GROUPS, BRANCH_LIUHE, BRANCH_LIUCHONG, BRANCH_LIUHAI,
} from './ziping.js';
import { LIUPO } from './dayun.js';

const mod = (n, m) => ((n % m) + m) % m;
const idx60 = (s, b) => { for (let i = 0; i < 60; i++) if (i % 10 === s && i % 12 === b) return i; return -1; };
const pillarsOf = (c) => [c.year, c.month, c.day, ...(c.hour ? [c.hour] : [])];
const inPair = (list, a, b) => list.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
const el = (e) => ({ el: e, zh: ELEMENTS_ZH[e], en: ELEMENTS_EN[e] });

// ---- extra 神煞 (rules: 三命通会 / 渊海子平 lineage; variants noted) -------
const TAIJI = [[0, 6], [0, 6], [3, 9], [3, 9], [4, 10, 1, 7], [4, 10, 1, 7], [2, 11], [2, 11], [5, 8], [5, 8]]; // 太极贵人 by day/year stem
// 天德合 by month branch (寅..丑 in the source table) → re-indexed from 子.
const TIANDE_HE_BY_MONTH = (() => {
  const fromYin = [{ s: 8 }, { b: 5 }, { s: 3 }, { s: 2 }, { b: 2 }, { s: 5 }, { s: 4 }, { b: 11 }, { s: 7 }, { s: 6 }, { b: 8 }, { s: 1 }]; // 壬 巳 丁 丙 寅 己 戊 亥 辛 庚 申 乙
  const out = []; for (let b = 0; b < 12; b++) out[b] = fromYin[mod(b - 2, 12)]; return out;
})();
const YUEDE_HE_BY_MONTH = (() => { // 寅午戌→辛 申子辰→丁 亥卯未→己 巳酉丑→乙
  const out = []; for (let b = 0; b < 12; b++) out[b] = [7, 3, 5, 1][[2, 6, 10].includes(b) ? 0 : [8, 0, 4].includes(b) ? 1 : [11, 3, 7].includes(b) ? 2 : 3]; return out;
})();
const HONGLUAN = (yb) => mod(3 - yb, 12);           // 子→卯 丑→寅 …
const TIANXI = (yb) => mod(HONGLUAN(yb) + 6, 12);
const WANGSHEN = { '8,0,4': 11, '2,6,10': 5, '5,9,1': 8, '11,3,7': 2 }; // 亡神
const TIANYI_DOC = (mb) => mod(mb - 1, 12);         // 天医 = 月支前一位
const XUEREN = [6, 0, 1, 7, 2, 8, 3, 9, 4, 10, 5, 11]; // 血刃 by month branch (子..亥) [variants exist]
const YINCHA = [[2, 0], [3, 1], [4, 2], [7, 3], [8, 4], [9, 5], [2, 6], [3, 7], [4, 8], [7, 9], [8, 10], [9, 11]]; // 阴差阳错
const SHIE = [[0, 4], [1, 5], [2, 8], [3, 11], [4, 10], [5, 1], [6, 4], [7, 5], [8, 8], [9, 11]]; // 十恶大败
const GULUAN = [[0, 2], [1, 5], [2, 6], [3, 5], [4, 6], [4, 8], [7, 11], [8, 0]]; // 孤鸾 (8-day list)
const CIGUAN_NAYIN = { 3: 8, 0: 2, 4: 11, 2: 11, 1: 5 }; // 词馆 by year 纳音 element → branch
export const EXTRA_SHENSHA_EN = {
  太极贵人: 'Taiji Noble', 天德合: 'Heavenly Virtue Combo', 月德合: 'Lunar Virtue Combo', 红鸾: 'Red Phoenix',
  天喜: 'Heavenly Joy', 亡神: 'Loss Spirit', 天医: 'Heavenly Doctor', 血刃: 'Blood Blade', 阴差阳错: 'Yin-Yang Mismatch',
  十恶大败: 'Ten Great Defeats', 孤鸾: 'Lone Phoenix', 元辰: 'Yuan Chen', 勾绞: 'Hook & Snare', 披麻: 'Mourning Hemp',
  丧门: 'Mourning Door', 吊客: 'Condolence Guest', 词馆: 'Literary Hall', 天罗地网: 'Heaven Net / Earth Snare', 空亡: 'Void',
};
export function computeShenshaExtra(chart, gender) {
  const P = pillarsOf(chart);
  const tags = P.map(() => []);
  const yb = chart.year.branch, db = chart.day.branch, mb = chart.month.branch, ys = chart.year.stem, ds = chart.day.stem;
  const tagB = (targets, name, skip = -1) => P.forEach((p, i) => { if (i !== skip && targets.includes(p.branch) && !tags[i].includes(name)) tags[i].push(name); });
  const tagS = (targets, name) => P.forEach((p, i) => { if (targets.includes(p.stem) && !tags[i].includes(name)) tags[i].push(name); });
  tagB([...new Set([...TAIJI[ds], ...TAIJI[ys]])], '太极贵人');
  { const t = TIANDE_HE_BY_MONTH[mb]; if (t.s != null) tagS([t.s], '天德合'); else tagB([t.b], '天德合'); }
  tagS([YUEDE_HE_BY_MONTH[mb]], '月德合');
  tagB([HONGLUAN(yb)], '红鸾', 0); tagB([TIANXI(yb)], '天喜', 0);
  for (const base of [yb, db]) { const g = SANHE_GROUPS.find((x) => x.branches.includes(base)); if (g) tagB([WANGSHEN[g.branches.join(',')]], '亡神'); }
  tagB([TIANYI_DOC(mb)], '天医', 1);
  tagB([XUEREN[mb]], '血刃', 1);
  const dp = [chart.day.stem, chart.day.branch];
  if (YINCHA.some(([s, b]) => s === dp[0] && b === dp[1])) tags[2].push('阴差阳错');
  if (SHIE.some(([s, b]) => s === dp[0] && b === dp[1])) tags[2].push('十恶大败');
  if (GULUAN.some(([s, b]) => s === dp[0] && b === dp[1])) tags[2].push('孤鸾');
  tagB([mod(yb - 3, 12)], '披麻', 0);
  tagB([mod(yb + 2, 12)], '丧门', 0); tagB([mod(yb - 2, 12)], '吊客', 0);
  tagB([mod(yb + 3, 12), mod(yb - 3, 12)], '勾绞', 0);
  if (gender === 'M' || gender === 'F') {
    const yangYear = ys % 2 === 0;
    const forward = (gender === 'M') === yangYear;
    tagB([mod(yb + 6 + (forward ? 1 : -1), 12)], '元辰', 0);
  }
  const yn = nayinOf(idx60(chart.year.stem, chart.year.branch)).el;
  if (CIGUAN_NAYIN[yn] != null) tagB([CIGUAN_NAYIN[yn]], '词馆');
  { const bs = P.map((p) => p.branch);
    if (bs.includes(10) && bs.includes(11)) P.forEach((p, i) => { if ((p.branch === 10 || p.branch === 11) && !tags[i].includes('天罗地网')) tags[i].push('天罗地网'); });
    if (bs.includes(4) && bs.includes(5)) P.forEach((p, i) => { if ((p.branch === 4 || p.branch === 5) && !tags[i].includes('天罗地网')) tags[i].push('天罗地网'); }); }
  { const kw = kongWangOf(idx60(chart.day.stem, chart.day.branch)); P.forEach((p, i) => { if (i !== 2 && kw.includes(p.branch)) tags[i].push('空亡'); }); }
  return tags;
}

// ---- 专业排盘表 --------------------------------------------------------------
export function proTable(chart, gender) {
  const P = pillarsOf(chart); const dm = chart.day.stem;
  const base = computeShensha(P); const extra = computeShenshaExtra(chart, gender);
  return P.map((p, i) => {
    const i60 = idx60(p.stem, p.branch);
    return {
      gz: pillarName(p),
      main: i === 2 ? { zh: gender === 'F' ? '元女' : gender === 'M' ? '元男' : '日主', en: 'Day Master' } : { zh: TEN_GOD_ZH[tenGodOfStem(dm, p.stem)], en: TEN_GOD_EN[tenGodOfStem(dm, p.stem)] },
      stem: STEMS[p.stem], branch: BRANCHES[p.branch],
      hidden: HIDDEN_STEMS[p.branch].map((h) => ({ stem: STEMS[h], el: STEM_ELEMENT[h], god: { zh: TEN_GOD_ZH[tenGodOfStem(dm, h)], en: TEN_GOD_EN[tenGodOfStem(dm, h)] } })),
      starLuck: { zh: STAGE_ZH[twelveStage(dm, p.branch)], en: STAGE_EN[twelveStage(dm, p.branch)] },
      selfSeat: { zh: STAGE_ZH[twelveStage(p.stem, p.branch)], en: STAGE_EN[twelveStage(p.stem, p.branch)] },
      kong: kongWangOf(i60).map((b) => BRANCHES[b]).join(''),
      nayin: nayinOf(i60),
      shensha: [...base[i], ...extra[i]],
    };
  });
}

// ---- 身强身弱 -----------------------------------------------------------------
// hidden-stem shares per branch (sum 100), from 旺相休囚死 recursion.
const HIDDEN_SHARE = [
  [[9, 100]], [[5, 59], [7, 34], [9, 7]], [[0, 59], [2, 34], [4, 7]], [[1, 100]],
  [[4, 76], [1, 15], [9, 9]], [[2, 59], [4, 34], [6, 7]], [[3, 63], [5, 37]], [[5, 65], [3, 22], [1, 13]],
  [[6, 52], [8, 30], [4, 18]], [[7, 100]], [[4, 52], [7, 30], [3, 18]], [[8, 63], [0, 37]],
];
const POS_W = { ys: 8, yb: 4, ms: 12, mb: 40, db: 12, hs: 12, hb: 12 };
export function elementWeights(chart) {
  const w = [0, 0, 0, 0, 0];
  const addStem = (s, k) => { w[STEM_ELEMENT[s]] += k; };
  const addBranch = (b, k) => HIDDEN_SHARE[b].forEach(([s, pct]) => { w[STEM_ELEMENT[s]] += k * pct / 100; });
  addStem(chart.year.stem, POS_W.ys); addBranch(chart.year.branch, POS_W.yb);
  addStem(chart.month.stem, POS_W.ms); addBranch(chart.month.branch, POS_W.mb);
  addBranch(chart.day.branch, POS_W.db);
  if (chart.hour) { addStem(chart.hour.stem, POS_W.hs); addBranch(chart.hour.branch, POS_W.hb); }
  const total = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / total);
}
export function strength(chart) {
  const dme = STEM_ELEMENT[chart.day.stem];
  const w = elementWeights(chart);
  const same = w[dme], seal = w[mod(dme - 1, 5)];
  const ratio = same + seal;
  const P = pillarsOf(chart);
  // 得令: month branch element is the day master's or produces it
  const mbe = BRANCH_ELEMENT[chart.month.branch];
  const deLing = mbe === dme || mbe === mod(dme - 1, 5);
  // 得地: a 本气/中气 root of the day master's element in any branch
  const roots = P.map((p) => HIDDEN_STEMS[p.branch].slice(0, 2).some((h) => STEM_ELEMENT[h] === dme));
  const deDi = roots.some(Boolean);
  // 得势: 印/比劫 among the other visible stems
  const deShi = P.filter((_, i) => i !== 2).filter((p) => { const e = STEM_ELEMENT[p.stem]; return e === dme || e === mod(dme - 1, 5); }).length >= 2;
  let key;
  if (ratio >= 0.8) key = 'congqiang';
  else if (ratio >= 0.55) key = 'strong';
  else if (ratio >= 0.45) key = 'balanced';
  else if (ratio >= 0.2 || deDi) key = 'weak';
  else key = 'congruo';
  const LABEL = {
    congqiang: ['Dominant (follow-strong)', '从强（专旺倾向）'], strong: ['Strong', '身强'], balanced: ['Balanced', '中和'],
    weak: ['Weak', '身弱'], congruo: ['Yielding (follow-weak)', '从弱倾向'],
  };
  return { key, zh: LABEL[key][1], en: LABEL[key][0], ratio, weights: w, deLing, deDi, deShi };
}

// ---- 格局 (子平真诠) -------------------------------------------------------------
const LU = [2, 3, 5, 6, 5, 6, 8, 9, 11, 0];
const YANG_REN = { 0: 3, 2: 6, 4: 6, 6: 9, 8: 0 }; // 甲卯 丙戊午 庚酉 壬子
const GEJU_ZH = ['比肩格', '劫财格', '食神格', '伤官格', '偏财格', '正财格', '七杀格', '正官格', '偏印格', '正印格'];
const GEJU_EN = ['Companion', 'Rob Wealth', 'Eating God', 'Hurting Officer', 'Indirect Wealth', 'Direct Wealth', 'Seven Killings', 'Direct Officer', 'Indirect Seal', 'Direct Seal'];
const ZHUANWANG = [
  { stems: [0, 1], zh: '曲直格', en: 'Curved-Straight (pure Wood)', sets: [[2, 3, 4], [11, 3, 7]], foe: 3 },
  { stems: [2, 3], zh: '炎上格', en: 'Blazing-Up (pure Fire)', sets: [[5, 6, 7], [2, 6, 10]], foe: 4 },
  { stems: [4, 5], zh: '稼穑格', en: 'Sowing-Reaping (pure Earth)', sets: [[4, 10, 1, 7]], foe: 0, anyThree: true },
  { stems: [6, 7], zh: '从革格', en: 'Follow-Reform (pure Metal)', sets: [[8, 9, 10], [5, 9, 1]], foe: 1 },
  { stems: [8, 9], zh: '润下格', en: 'Moistening-Down (pure Water)', sets: [[11, 0, 1], [8, 0, 4]], foe: 2 },
];
const HUA = [{ a: 0, b: 5, el: 2, months: [4, 10, 1, 7] }, { a: 1, b: 6, el: 3, months: [8, 9, 5, 1] }, { a: 2, b: 7, el: 4, months: [11, 0, 8, 4] }, { a: 3, b: 8, el: 0, months: [2, 3, 11, 7] }, { a: 4, b: 9, el: 1, months: [5, 6, 2, 10] }];
export function geju(chart, st = strength(chart)) {
  const dm = chart.day.stem, dme = STEM_ELEMENT[dm], mb = chart.month.branch;
  const P = pillarsOf(chart);
  const others = P.filter((_, i) => i !== 2);
  const visible = others.map((p) => p.stem);
  const branches = P.map((p) => p.branch);
  const notes = [];
  // --- 外格 ---
  const outer = [];
  const zw = ZHUANWANG.find((z) => z.stems.includes(dm));
  if (zw) {
    const hasSet = zw.anyThree ? branches.filter((b) => zw.sets[0].includes(b)).length >= 3 : zw.sets.some((s) => s.every((b) => branches.includes(b)));
    const foeVisible = visible.some((s) => STEM_ELEMENT[s] === zw.foe) || branches.some((b) => HIDDEN_STEMS[b][0] != null && STEM_ELEMENT[HIDDEN_STEMS[b][0]] === zw.foe);
    if (hasSet && !foeVisible && st.ratio >= 0.7) outer.push({ key: 'zhuanwang', zh: zw.zh, en: zw.en });
  }
  if (!outer.length && st.key === 'congqiang') outer.push({ key: 'congqiang', zh: '从强格', en: 'Follow-the-Strong' });
  if (st.key === 'congruo') {
    const w = st.weights;
    const groups = [{ k: 'cai', e: mod(dme + 2, 5), zh: '从财格', en: 'Follow Wealth' }, { k: 'sha', e: mod(dme - 2, 5), zh: '从杀格', en: 'Follow Power' }, { k: 'er', e: mod(dme + 1, 5), zh: '从儿格', en: 'Follow the Output' }];
    groups.sort((a, b) => w[b.e] - w[a.e]);
    outer.push(w[groups[0].e] >= 0.45 ? { key: 'cong-' + groups[0].k, zh: groups[0].zh, en: groups[0].en } : { key: 'cong-shi', zh: '从势格', en: 'Follow the Momentum' });
  }
  for (const h of HUA) {
    const partner = dm === h.a ? h.b : dm === h.b ? h.a : null;
    if (partner == null) continue;
    const adj = [chart.month.stem, chart.hour?.stem].includes(partner);
    const rivals = visible.filter((s) => s === dm).length + P.filter((p) => p.stem === partner).length;
    if (adj && h.months.includes(mb) && rivals <= 1 && !P.some((p, i) => i !== 2 && STEM_ELEMENT[p.stem] === mod(h.el - 2, 5)) && st.ratio < 0.5) {
      outer.push({ key: 'hua', zh: `化${ELEMENTS_ZH[h.el]}格（可能）`, en: `Transformation into ${ELEMENTS_EN[h.el]} (possible)` });
    }
  }
  // --- 正格 ---
  const H = HIDDEN_STEMS[mb];
  let main;
  if (LU[dm] === mb) { main = { key: 'jianlu', zh: '建禄格', en: 'Established Prosperity' }; notes.push({ zh: '月令为日主之禄，本身不作用神，另取透出之财官食伤', en: 'The month holds your own prosperity branch; the working star is taken from visible Wealth/Officer/Output' }); }
  else if (YANG_REN[dm] === mb) { main = { key: 'yueren', zh: '月刃格（阳刃格）', en: 'Month Blade' }; notes.push({ zh: '阳干生于帝旺之月，喜官杀制刃', en: 'A yang stem born at its peak month — an Officer/Power star to tame the blade helps' }); }
  else if (STEM_ELEMENT[H[0]] === dme) { main = { key: 'yuejie', zh: '月劫格', en: 'Month Rob-Wealth' }; notes.push({ zh: '月令本气为劫财，与建禄同论', en: 'The month main qi is Rob-Wealth — read like Established Prosperity' }); }
  else {
    const tou = H.find((h) => visible.includes(h) && STEM_ELEMENT[h] !== dme);
    const pick = tou ?? H[0];
    const god = tenGodOfStem(dm, pick);
    main = { key: 'god-' + god, god, zh: GEJU_ZH[god], en: GEJU_EN[god] + ' Pattern', tou: tou != null };
    notes.push(tou != null
      ? { zh: `月令藏干${STEMS[pick]}透于天干，取${GEJU_ZH[god]}`, en: `The month's hidden ${STEMS[pick]} shows in the stems → ${GEJU_EN[god]} pattern` }
      : { zh: `月令藏干未透，以本气${STEMS[pick]}论${GEJU_ZH[god]}`, en: `No hidden stem shows; the month main qi ${STEMS[pick]} gives ${GEJU_EN[god]}` });
  }
  // 三合局 includes the month branch → may transform the pattern (论用神变化)
  const ju = SANHE_GROUPS.find((g) => g.branches.includes(mb) && g.branches.every((b) => branches.includes(b)));
  if (ju) notes.push({ zh: `支成${ELEMENTS_ZH[ju.el]}局，格局或随之变化`, en: `The branches complete a ${ELEMENTS_EN[ju.el]} frame, which can shift the pattern` });
  return { main, outer, notes };
}

// ---- 调候 (穷通宝鉴, condensed) — rows 甲..癸, columns 寅..丑 --------------------
const TIAOHOU_FROM_YIN = [
  ['丙癸', '庚丙丁戊己', '庚丁壬', '癸庚丁', '癸庚丁', '癸庚丁', '庚丁壬', '庚丁丙', '庚甲丁壬癸', '庚丁丙戊', '丁庚丙', '丁庚丙'],
  ['丙癸', '丙癸', '癸丙戊', '癸', '癸丙', '癸丙', '丙癸己', '癸丙丁', '癸辛', '丙戊', '丙', '丙'],
  ['壬庚', '壬己', '壬甲', '壬癸庚', '壬庚', '壬庚', '壬戊', '壬癸', '甲壬', '甲戊庚壬', '壬戊己', '壬甲'],
  ['甲庚', '庚甲', '甲庚', '甲庚', '壬庚癸', '甲壬庚', '甲庚丙戊', '甲庚丙戊', '甲庚戊', '甲庚', '甲庚', '甲庚'],
  ['丙甲癸', '丙甲癸', '甲丙癸', '甲丙癸', '壬甲丙', '癸丙甲', '丙癸甲', '丙癸', '甲丙癸', '甲丙', '丙甲', '丙甲'],
  ['丙庚甲', '甲癸丙', '丙癸甲', '癸丙', '癸丙', '癸丙', '丙癸', '丙癸', '甲丙癸', '丙甲戊', '丙甲戊', '丙甲戊'],
  ['戊甲壬丙丁', '丁甲庚丙', '甲丁壬癸', '壬戊丙丁', '壬癸', '丁甲', '丁甲', '丁甲丙', '甲壬', '丁丙', '丁甲丙', '丙丁甲'],
  ['己壬庚', '壬甲', '壬甲', '壬甲癸', '壬己癸', '壬庚甲', '壬甲戊', '壬甲', '壬甲', '壬丙', '丙戊壬甲', '丙壬戊己'],
  ['庚丙戊', '戊辛庚', '甲庚', '壬辛庚癸', '癸庚辛', '辛甲', '戊丁', '甲庚', '甲丙', '戊丙庚', '戊丙', '丙丁甲'],
  ['辛丙', '庚辛', '丙辛甲', '辛', '庚辛壬癸', '庚辛壬癸', '丁', '辛丙', '辛甲壬癸', '庚辛戊丁', '丙辛', '丙丁'],
];
export function tiaohou(chart) {
  const s = TIAOHOU_FROM_YIN[chart.day.stem][mod(chart.month.branch - 2, 12)];
  return [...s].map((c) => STEMS.indexOf(c));
}

// ---- 用神 -------------------------------------------------------------------
export function yongshen(chart, st = strength(chart), gj = geju(chart, st)) {
  const dme = STEM_ELEMENT[chart.day.stem];
  const w = st.weights;
  const E = { bi: dme, yin: mod(dme - 1, 5), shi: mod(dme + 1, 5), cai: mod(dme + 2, 5), guan: mod(dme - 2, 5) };
  let yong, reason;
  const outerKey = gj.outer[0]?.key;
  if (outerKey === 'zhuanwang' || outerKey === 'congqiang') { yong = w[E.yin] > w[E.bi] ? E.yin : E.bi; reason = { zh: '专旺/从强，顺其旺势，以印比为用', en: 'Dominant chart — go with the flow: Seal/Companion elements help' }; }
  else if (outerKey && outerKey.startsWith('cong')) {
    const dom = [E.cai, E.guan, E.shi].sort((a, b) => w[b] - w[a])[0];
    yong = dom; reason = { zh: '从弱，顺从最旺之异党为用', en: 'Yielding chart — follow the strongest outside element' };
  } else if (st.key === 'strong' || st.key === 'balanced' && st.ratio >= 0.5) {
    if (w[E.yin] >= w[E.bi]) { yong = E.cai; reason = { zh: '身强印重，以财破印', en: 'Strong with heavy Seal — Wealth breaks the Seal' }; }
    else if (w[E.guan] > 0.08) { yong = E.guan; reason = { zh: '身强比劫重，以官杀制之', en: 'Strong with heavy Companions — Officer restrains them' }; }
    else { yong = E.shi; reason = { zh: '身强无官，以食伤泄秀', en: 'Strong, no Officer — Output drains the surplus' }; }
  } else {
    const heavy = [['guan', E.guan], ['shi', E.shi], ['cai', E.cai]].sort((a, b) => w[b[1]] - w[a[1]])[0];
    if (heavy[0] === 'cai') { yong = E.bi; reason = { zh: '身弱财重，以比劫帮身', en: 'Weak under heavy Wealth — Companions share the load' }; }
    else { yong = E.yin; reason = { zh: heavy[0] === 'guan' ? '身弱杀重，以印化杀' : '身弱食伤重，以印制之', en: heavy[0] === 'guan' ? 'Weak under pressure — Seal transforms it' : 'Weak and over-drained — Seal restores it' }; }
  }
  const th = tiaohou(chart);
  const cold = [11, 0, 1].includes(chart.month.branch), hot = [5, 6, 7].includes(chart.month.branch);
  let climate = null;
  if ((cold || hot) && !(outerKey && outerKey.startsWith('cong'))) {
    const first = STEM_ELEMENT[th[0]];
    climate = { el: el(first), zh: `${cold ? '冬令' : '夏令'}出生，《穷通宝鉴》调候首取${STEMS[th[0]]}${ELEMENTS_ZH[first]}`, en: `${cold ? 'Winter' : 'Summer'} birth — the classic climate table (Qiong Tong Bao Jian) puts ${ELEMENTS_EN[first]} (${STEMS[th[0]]}) first` };
  }
  // 喜神 supports the 用神 from the same side; 忌神 is the heaviest element
  // on the opposing side; 仇神 feeds the 忌神; the rest are 闲神.
  const helpers = [E.bi, E.yin], opponents = [E.shi, E.cai, E.guan];
  const selfSide = helpers.includes(yong);
  let xi = selfSide ? helpers.find((e) => e !== yong) : (mod(yong - 1, 5) !== E.bi && mod(yong - 1, 5) !== E.yin ? mod(yong - 1, 5) : opponents.find((e) => e !== yong));
  const ji = (selfSide ? opponents : helpers).slice().sort((a, b) => w[b] - w[a])[0];
  if (xi === ji) xi = (selfSide ? helpers : opponents).find((e) => e !== yong && e !== ji);
  const chou = mod(ji - 1, 5) === yong || mod(ji - 1, 5) === xi ? [0, 1, 2, 3, 4].find((e) => ![yong, xi, ji].includes(e)) : mod(ji - 1, 5);
  const xian = [0, 1, 2, 3, 4].filter((e) => ![yong, xi, ji, chou].includes(e));
  if (st.key === 'balanced') reason = { zh: '中和之命，' + reason.zh, en: 'Balanced chart; ' + reason.en };
  return {
    yong: el(yong), xi: el(xi), ji: el(ji), chou: el(chou), xian: xian.map(el), reason, climate,
    tiaohouStems: th.map((s) => STEMS[s]).join(''),
    favorable: [yong, xi, ...(climate && climate.el.el !== ji && climate.el.el !== chou ? [climate.el.el] : [])].filter((x, i, a) => a.indexOf(x) === i),
  };
}

// ---- 行业 -----------------------------------------------------------------------
const INDUSTRY = [
  { zh: '教育培训、文化出版、设计策展、园艺林业、医药康养、服装纺织、公益与社会工作', en: 'education, publishing & culture, design, horticulture, health & pharma, fashion & textiles, social impact' },
  { zh: '互联网与电子、能源电力、传媒广告、演艺娱乐、餐饮、美妆时尚、心理咨询', en: 'tech & electronics, energy, media & advertising, entertainment, food service, beauty, psychology' },
  { zh: '房地产与建筑、农业、仓储物流中转、中介咨询、人力资源、保险、公共管理', en: 'property & construction, agriculture, warehousing, brokerage & consulting, HR, insurance, public administration' },
  { zh: '金融证券、法律司法、机械汽车、珠宝五金、工程制造、军警安防、外科与精密技术', en: 'finance & investing, law, machinery & auto, jewellery & metals, engineering, security, precision work' },
  { zh: '贸易与跨境、物流航运、旅游酒店、饮品水产、传播沟通、研究咨询、销售与市场', en: 'trade & cross-border, logistics & shipping, travel & hospitality, beverages, communications, research, sales & marketing' },
];
export function careers(ys) {
  return [ys.yong, ys.xi].map((e) => ({ ...e, industries: INDUSTRY[e.el] }));
}

// ---- 伴侣画像 -------------------------------------------------------------------
const SPOUSE_PALACE_GOD = {
  0: ['像朋友一样平起平坐的伴侣，也可能各自有主见', 'a partner who feels like an equal — both strong-minded'],
  1: ['热情直接、有竞争心的伴侣，金钱上宜分清', 'a direct, competitive partner — keep finances clear'],
  2: ['温和会生活、懂享受的伴侣', 'a gentle partner who knows how to enjoy life'],
  3: ['有才华、表达欲强的伴侣，相处多些包容', 'a talented, expressive partner — allow room for opinions'],
  4: ['大方、社交广、机会多的伴侣', 'a generous, sociable partner who brings opportunity'],
  5: ['务实顾家、踏实经营的伴侣', 'a practical, home-building partner'],
  6: ['有魄力、气场强的伴侣，节奏偏快', 'a bold, commanding partner with a fast tempo'],
  7: ['稳重守规矩、有责任感的伴侣', 'a steady, principled, responsible partner'],
  8: ['独立、有特别见解的伴侣，需要个人空间', 'an independent, unconventional partner who needs space'],
  9: ['体贴照顾、有包容心的伴侣', 'a caring, nurturing partner'],
};
const STEM_HE = [5, 6, 7, 8, 9, 0, 1, 2, 3, 4];
const LIUHE_OF = (b) => mod(13 - b, 12);
export function partner(chart, gender, ys) {
  const dm = chart.day.stem, P = pillarsOf(chart);
  const godsWanted = gender === 'F' ? [6, 7] : gender === 'M' ? [4, 5] : null;
  let starCount = 0;
  if (godsWanted) P.forEach((p, i) => {
    if (i !== 2 && godsWanted.includes(tenGodOfStem(dm, p.stem))) starCount += 1;
    HIDDEN_STEMS[p.branch].forEach((h, k) => { if (godsWanted.includes(tenGodOfStem(dm, h))) starCount += k === 0 ? 0.6 : 0.25; });
  });
  const palaceGod = tenGodOfStem(dm, HIDDEN_STEMS[chart.day.branch][0]);
  const yb = chart.year.branch, db = chart.day.branch;
  const trine = SANHE_GROUPS.find((g) => g.branches.includes(yb)).branches.filter((b) => b !== yb);
  return {
    spouseStar: godsWanted ? { zh: gender === 'F' ? '官杀（夫星）' : '财星（妻星）', en: gender === 'F' ? 'Officer stars (husband star)' : 'Wealth stars (wife star)', count: Math.round(starCount * 10) / 10 } : null,
    palace: { branch: BRANCHES[db], god: { zh: TEN_GOD_ZH[palaceGod], en: TEN_GOD_EN[palaceGod] }, zh: SPOUSE_PALACE_GOD[palaceGod][0], en: SPOUSE_PALACE_GOD[palaceGod][1] },
    idealDayMaster: { el: ys.yong, stems: [ys.yong.el * 2, ys.yong.el * 2 + 1].map((s) => STEMS[s]).join('') },
    tianheDihe: STEMS[STEM_HE[dm]] + BRANCHES[LIUHE_OF(db)],
    zodiac: { liuhe: { zh: ANIMALS_ZH[LIUHE_OF(yb)], en: ANIMALS_EN[LIUHE_OF(yb)] }, sanhe: trine.map((b) => ({ zh: ANIMALS_ZH[b], en: ANIMALS_EN[b] })), avoid: { zh: ANIMALS_ZH[mod(yb + 6, 12)], en: ANIMALS_EN[mod(yb + 6, 12)] } },
  };
}

// ---- 合婚 -----------------------------------------------------------------------
const XING = [[2, 5], [5, 8], [8, 2], [1, 10], [10, 7], [7, 1], [0, 3]];
export function branchPairType(a, b) {
  if (inPair(BRANCH_LIUHE, a, b)) return 'liuhe';
  if (a !== b && SANHE_GROUPS.some((g) => g.branches.includes(a) && g.branches.includes(b))) return 'sanhe';
  if (inPair(BRANCH_LIUCHONG, a, b)) return 'chong';
  if (inPair(XING, a, b) || (a === b && [4, 6, 9, 11].includes(a))) return 'xing';
  if (inPair(BRANCH_LIUHAI, a, b)) return 'hai';
  if (inPair(LIUPO, a, b)) return 'po';
  return a === b ? 'same' : 'none';
}
const PAIR_PTS = { liuhe: 2, sanhe: 1.5, same: 0.5, none: 0, po: -0.5, hai: -1, xing: -1, chong: -2 };
const PAIR_ZH = { liuhe: '六合', sanhe: '三合', same: '同支', none: '平', po: '相破', hai: '相害', xing: '相刑', chong: '六冲' };
const PAIR_EN = { liuhe: 'six-harmony', sanhe: 'triad harmony', same: 'same branch', none: 'neutral', po: 'break', hai: 'harm', xing: 'punishment', chong: 'clash' };
export function hehun(A, B, gA, gB) {
  const items = [];
  const zod = branchPairType(A.year.branch, B.year.branch);
  items.push({ id: 'zodiac', w: 20, v: PAIR_PTS[zod] / 2, zh: `生肖${ANIMALS_ZH[A.year.branch]}与${ANIMALS_ZH[B.year.branch]}：${PAIR_ZH[zod]}`, en: `Zodiac ${ANIMALS_EN[A.year.branch]} & ${ANIMALS_EN[B.year.branch]}: ${PAIR_EN[zod]}` });
  const na = nayinOf(idx60(A.year.stem, A.year.branch)), nb = nayinOf(idx60(B.year.stem, B.year.branch));
  const nyRel = na.el === nb.el ? 0.3 : (mod(na.el + 1, 5) === nb.el || mod(nb.el + 1, 5) === na.el) ? 1 : -0.6;
  items.push({ id: 'nayin', w: 10, v: nyRel, zh: `年命纳音${na.zh}与${nb.zh}：${nyRel === 1 ? '相生' : nyRel < 0 ? '相克' : '比和'}`, en: `Year nayin ${na.en} & ${nb.en}: ${nyRel === 1 ? 'generating' : nyRel < 0 ? 'controlling' : 'same element'}` });
  const stemHe = STEM_HE[A.day.stem] === B.day.stem;
  const stemKe = [[0, 6], [1, 7], [2, 8], [3, 9]].some(([x, y]) => (A.day.stem === x && B.day.stem === y) || (A.day.stem === y && B.day.stem === x));
  const dz = branchPairType(A.day.branch, B.day.branch);
  let dv = PAIR_PTS[dz] / 2 + (stemHe ? 0.6 : 0) - (stemKe ? 0.4 : 0);
  let dLabel = stemHe && dz === 'liuhe' ? { zh: '日柱天合地合，上上之配', en: 'Day pillars combine in stem AND branch — a classic best match' }
    : stemKe && dz === 'chong' ? { zh: '日柱天克地冲，磨合较多', en: 'Day pillars clash in stem and branch — more friction to work through' }
    : { zh: `日柱：天干${stemHe ? '相合' : stemKe ? '相冲' : '平'}，夫妻宫${PAIR_ZH[dz]}`, en: `Day pillars: stems ${stemHe ? 'combine' : stemKe ? 'clash' : 'neutral'}, spouse palaces ${PAIR_EN[dz]}` };
  dv = Math.max(-1, Math.min(1, dv));
  items.push({ id: 'day', w: 25, v: dv, ...dLabel });
  let cross = 0, n = 0;
  for (const p of pillarsOf(A)) for (const q of pillarsOf(B)) { cross += PAIR_PTS[branchPairType(p.branch, q.branch)]; n++; }
  const cv = Math.max(-1, Math.min(1, cross / n));
  items.push({ id: 'cross', w: 15, v: cv, zh: `四柱地支交叉：${cv > 0.15 ? '合多冲少' : cv < -0.15 ? '冲刑偏多' : '合冲相抵'}`, en: `Cross-chart branches: ${cv > 0.15 ? 'more harmony than clash' : cv < -0.15 ? 'clash-heavy' : 'balanced'}` });
  const yA = yongshen(A), yB = yongshen(B);
  const wA = strength(A).weights, wB = strength(B).weights;
  const give = (ys, w) => (ys.favorable.reduce((s, e) => s + w[e], 0) - w[ys.ji.el]);
  const uv = Math.max(-1, Math.min(1, (give(yA, wB) + give(yB, wA)) * 1.5));
  const pct = (ys, w) => Math.round(ys.favorable.reduce((s, e) => s + w[e], 0) * 100);
  const favZh = (ys) => ys.favorable.map((e) => ELEMENTS_ZH[e]).join(''), favEn = (ys) => ys.favorable.map((e) => ELEMENTS_EN[e]).join('/');
  items.push({ id: 'yong', w: 30, v: uv, zh: `用神互补：你喜${favZh(yA)}，在 TA 命中占 ${pct(yA, wB)}%；TA 喜${favZh(yB)}，在你命中占 ${pct(yB, wA)}%`, en: `Mutual support: your helpful elements (${favEn(yA)}) make up ${pct(yA, wB)}% of their chart; theirs (${favEn(yB)}) make up ${pct(yB, wA)}% of yours` });
  const score = Math.round(50 + items.reduce((s, it) => s + it.w * it.v, 0) / 2);
  return { score: Math.max(10, Math.min(95, score)), items };
}

// ---- 岁运流 interactions ----------------------------------------------------------
const STEM_CLASH = (a, b) => [[0, 6], [1, 7], [2, 8], [3, 9]].some(([x, y]) => (a === x && b === y) || (a === y && b === x));
/** p: {stem, branch} flowing pillar; returns notable hits against natal pillars (+ 大运 dy). */
export function flowHits(chart, p, dy) {
  const hits = [];
  const labels = ['年柱', '月柱', '日柱', '时柱'], labelsEn = ['year', 'month', 'day', 'hour'];
  pillarsOf(chart).forEach((n, i) => {
    if (n.stem === p.stem && n.branch === p.branch) hits.push({ type: 'fuyin', pillar: i, zh: `与${labels[i]}伏吟（同柱重现）`, en: `echoes your ${labelsEn[i]} pillar (伏吟)` });
    else if (STEM_CLASH(n.stem, p.stem) && inPair(BRANCH_LIUCHONG, n.branch, p.branch)) hits.push({ type: 'fanyin', pillar: i, zh: `与${labels[i]}天克地冲`, en: `stem-and-branch clash with your ${labelsEn[i]} pillar` });
  });
  if (dy && dy.stem === p.stem && dy.branch === p.branch) hits.push({ type: 'suiyun', zh: '岁运并临', en: 'year pillar equals the luck pillar (岁运并临)' });
  return hits;
}
export { pillarsOf, idx60 };
