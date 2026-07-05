/* ============================================================
   HOROSCOPE ENGINE (V20) — daily fortune + two-person synastry.

   Pure functions, deterministic: same (chart, date) → same output. Daily
   variation is REAL — the day's actual sexagenary pillar (true calendar
   data, from bazi.js) interacts with the user's day master via the five-
   element cycle; a seeded PRNG (mulberry32, same family the site already
   uses) then picks phrasing from the bilingual fragment banks. So content
   changes every day for a real calendrical reason, never repeats verbatim
   often, and is still fully reproducible — no server, no LLM call.

   ENTERTAINMENT ONLY. Scores are clamped to 8..96: this product never
   hands out absolute answers, by design.
   ============================================================ */
import {
  computeBazi, dayPillar, STEM_ELEMENT, BRANCH_ELEMENT, ELEMENTS_ZH, ELEMENTS_EN,
  zodiacIndex, ZODIAC_TRIPLICITY,
} from './bazi.js';

// ---- seeded PRNG (deterministic) ----------------------------------------
function strHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];

// ---- five-element relation of today's element to the day master ----------
// 'same' 比和 | 'feeds' 印(today generates me) | 'drains' 食伤(I generate today)
// 'prize' 财(I control today) | 'presses' 官(today controls me)
export function elementRelation(dayMasterEl, todayEl) {
  if (todayEl === dayMasterEl) return 'same';
  if ((todayEl + 1) % 5 === dayMasterEl) return 'feeds';
  if ((dayMasterEl + 1) % 5 === todayEl) return 'drains';
  if ((dayMasterEl + 2) % 5 === todayEl) return 'prize';
  return 'presses'; // (todayEl + 2) % 5 === dayMasterEl
}

// Base score per (relation × domain). Domains: career love wealth health.
const REL_BASE = {
  feeds:   { career: 74, love: 70, wealth: 62, health: 76, overall: 72 },
  same:    { career: 64, love: 62, wealth: 58, health: 68, overall: 63 },
  drains:  { career: 58, love: 72, wealth: 54, health: 56, overall: 60 },
  prize:   { career: 66, love: 60, wealth: 78, health: 58, overall: 68 },
  presses: { career: 52, love: 50, wealth: 48, health: 50, overall: 50 },
};
const toneOf = (score) => score >= 66 ? 'up' : score >= 52 ? 'flat' : 'down';

// ---- bilingual fragment banks --------------------------------------------
const OVERALL_TXT = {
  feeds:   { zh: '今日之气生养日主，如春雨润木。顺水行舟的一天，宜进不宜疑。', en: 'Today\'s element nourishes your day master — like spring rain on young wood. A day to move with the current, not to second-guess it.' },
  same:    { zh: '今日与你同气相求，平稳笃定。不求大破大立，稳住即是赢。', en: 'Today shares your element: steady, familiar ground. No need for grand moves — holding your line is the win.' },
  drains:  { zh: '你的气今日外泄为文采与表达，锋芒宜露三分，留七分养神。', en: 'Your energy flows outward today as expression and craft. Show a third of the blade; rest the rest.' },
  prize:   { zh: '日主克今日之气，是「我取之象」。主动出手者得筹，观望者过站。', en: 'Your day master commands today\'s element — a taking day. Those who reach, receive; those who watch, wait another cycle.' },
  presses: { zh: '今日之气压日主，宜守不宜攻。把节奏放慢，让别人先出牌。', en: 'Today\'s element presses on yours. A defending day: slow the tempo and let others show their hand first.' },
};
const DOMAIN_TXT = {
  career: {
    up:   [{ zh: '贵人在侧，方案易过——把压箱底的提议今天递出去。', en: 'Allies are near and proposals land — submit the idea you\'ve been sitting on.' },
           { zh: '事有顺风之势，宜收尾旧务，再启新局。', en: 'A tailwind day: close old threads first, then open the new front.' },
           { zh: '你说的话今天有分量，会议上别坐最后一排。', en: 'Your words carry today. Don\'t sit in the back row of the meeting.' }],
    flat: [{ zh: '按部就班即可，勿在琐事上与人争先。', en: 'Routine serves you well; skip the small races.' },
           { zh: '进展平缓不代表停滞——今日适合磨刀，不适合砍柴。', en: 'Slow is not stalled — today is for sharpening, not chopping.' }],
    down: [{ zh: '文书合同细读三遍，今日易漏细节。', en: 'Read every document three times; details slip today.' },
           { zh: '锋头且让一让，硬顶的事放到后天再谈。', en: 'Yield the spotlight; push the hard conversation to another day.' }],
  },
  love: {
    up:   [{ zh: '桃花气旺，久未联系的人不妨今日问候。', en: 'Peach-blossom energy runs high — a good day to message someone you\'ve let drift.' },
           { zh: '心意易通，适合说平时说不出口的那句。', en: 'Hearts translate easily today. Say the sentence you usually swallow.' },
           { zh: '同行者与你步调相合，宜共餐、宜散步。', en: 'Your companion walks in step with you today — share a meal, take the long way home.' }],
    flat: [{ zh: '情感平流缓进，陪伴胜过表白。', en: 'Feelings move on slow water — presence beats declarations.' },
           { zh: '不冷不热是常态，别把安静误读成疏远。', en: 'Lukewarm is normal today; don\'t read silence as distance.' }],
    down: [{ zh: '口舌之象隐现，玩笑话留半句。', en: 'Words spark easily — leave half the joke unsaid.' },
           { zh: '旧事勿翻，今日翻旧账必翻船。', en: 'Do not reopen old ledgers today; that boat will tip.' }],
  },
  wealth: {
    up:   [{ zh: '财气当令，谈钱不伤感情——该报的价今天报。', en: 'Wealth element in season: talk numbers without flinching. Quote the price today.' },
           { zh: '正财稳进，偏财勿贪，见好即收。', en: 'Steady income flows; windfalls tempt — take the good and stop.' },
           { zh: '适合盘点资产、调仓布局，账越清运越顺。', en: 'A day for balancing books and positions — clear ledgers invite clear luck.' }],
    flat: [{ zh: '财来财去打平手，控制小额冲动消费。', en: 'Money in, money out — watch the small impulse buys.' },
           { zh: '不是进场的日子，是做功课的日子。', en: 'Not a day to enter the market; a day to study it.' }],
    down: [{ zh: '破财星虚晃一枪，大额支出缓一缓。', en: 'The spendthrift star feints today — postpone the big purchase.' },
           { zh: '借出与担保之事，今日一律三思。', en: 'Loans and guarantees: think three times, then don\'t.' }],
  },
  health: {
    up:   [{ zh: '气血调和，适合早起舒展、补一个好觉。', en: 'Qi and blood run smooth — stretch early, sleep deep.' },
           { zh: '身体轻盈之日，久搁的锻炼计划今天重启最顺。', en: 'A light-body day: the workout plan you shelved restarts easiest today.' }],
    flat: [{ zh: '无大碍，唯久坐伤神，每小时起身走两步。', en: 'Nothing looms — but sitting drains you today. Stand and walk each hour.' },
           { zh: '脾胃偏弱，饮食七分饱为宜。', en: 'Digestion runs soft; stop at seven-tenths full.' }],
    down: [{ zh: '注意休息，今日莫熬夜硬扛。', en: 'Guard your rest; don\'t muscle through a late night.' },
           { zh: '情绪耗损大于体力，给自己留一段无人打扰的时间。', en: 'The drain is emotional more than physical — reserve an hour that belongs to no one else.' }],
  },
};
const YI_BANK = [
  { zh: '静坐片刻', en: 'Sit in stillness' }, { zh: '整理案头', en: 'Clear your desk' },
  { zh: '拜访长辈', en: 'Visit an elder' }, { zh: '早睡', en: 'Sleep early' },
  { zh: '写字读帖', en: 'Practice calligraphy' }, { zh: '饮茶', en: 'Brew tea slowly' },
  { zh: '散步观云', en: 'Walk and watch clouds' }, { zh: '复盘旧账', en: 'Review old ledgers' },
  { zh: '赠人一物', en: 'Give something away' }, { zh: '修剪绿植', en: 'Tend your plants' },
];
const JI_BANK = [
  { zh: '口舌之争', en: 'Pointless argument' }, { zh: '冲动下单', en: 'Impulse buying' },
  { zh: '熬夜', en: 'Staying up late' }, { zh: '翻旧账', en: 'Reopening old scores' },
  { zh: '轻诺', en: 'Easy promises' }, { zh: '远行涉水', en: 'Long travel over water' },
  { zh: '签字画押', en: 'Signing in haste' }, { zh: '暴饮暴食', en: 'Overeating' },
];
const LUCKY_COLORS = [
  { zh: '青碧', en: 'Verdant green', css: '#7aa874' },  // wood
  { zh: '朱赤', en: 'Vermilion red', css: '#c8553d' },  // fire
  { zh: '琥珀黄', en: 'Amber gold', css: '#c9a227' },   // earth
  { zh: '月白', en: 'Moon white', css: '#d8d3c4' },     // metal
  { zh: '黛蓝', en: 'Indigo blue', css: '#5b7d99' },    // water
];
const DIRECTIONS = [
  { zh: '东', en: 'East' }, { zh: '南', en: 'South' }, { zh: '中宫', en: 'Centre' },
  { zh: '西', en: 'West' }, { zh: '北', en: 'North' },
];

// ---- daily fortune ---------------------------------------------------------
// birth: {y,m,d,hour?}; dateStr: 'YYYY-MM-DD' (the day being read).
export function dailyFortune(birth, dateStr) {
  const chart = computeBazi(birth);
  const [ty, tm, td] = dateStr.split('-').map(Number);
  const today = dayPillar(ty, tm, td);
  const todayEl = STEM_ELEMENT[today.stem];
  const rel = elementRelation(chart.dayMasterElement, todayEl);
  const rnd = mulberry32(strHash(`${dateStr}|${birth.y}-${birth.m}-${birth.d}-${birth.hour ?? 'x'}`));

  const domains = ['career', 'love', 'wealth', 'health'].map((id) => {
    const score = clamp(Math.round(REL_BASE[rel][id] + (rnd() * 22 - 11)), 8, 96);
    const tone = toneOf(score);
    const frag = pick(rnd, DOMAIN_TXT[id][tone]);
    return { id, score, tone, zh: frag.zh, en: frag.en };
  });
  const overall = clamp(Math.round(REL_BASE[rel].overall + (rnd() * 16 - 8)), 8, 96);

  // lucky color = the element that FEEDS the day master (印, the nourisher)
  const luckyEl = (chart.dayMasterElement + 4) % 5;
  const yi = []; const ji = [];
  const yiPool = YI_BANK.slice(); const jiPool = JI_BANK.slice();
  for (let i = 0; i < 2; i++) { yi.push(yiPool.splice(Math.floor(rnd() * yiPool.length), 1)[0]); ji.push(jiPool.splice(Math.floor(rnd() * jiPool.length), 1)[0]); }

  return {
    chart, todayPillar: today, relation: rel,
    overall: { score: overall, tone: toneOf(overall), zh: OVERALL_TXT[rel].zh, en: OVERALL_TXT[rel].en },
    domains,
    lucky: {
      color: LUCKY_COLORS[luckyEl],
      element: { zh: ELEMENTS_ZH[luckyEl], en: ELEMENTS_EN[luckyEl] },
      number: 1 + Math.floor(rnd() * 9),
      direction: DIRECTIONS[luckyEl],
    },
    yi, ji,
  };
}

// ---- synastry (two-person) -------------------------------------------------
// Branch relations (year + day branches of both people).
const LIUHE = [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]];            // 六合
const SANHE = [[8, 0, 4], [2, 6, 10], [5, 9, 1], [11, 3, 7]];                // 三合局
const CHONG = (a, b) => (a + 6) % 12 === b;                                   // 相冲
const HAI = [[0, 7], [1, 6], [2, 5], [3, 4], [8, 11], [9, 10]];              // 相害
const inPair = (list, a, b) => list.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
const sameTriad = (a, b) => a !== b && SANHE.some((t) => t.includes(a) && t.includes(b));

function branchAffinity(a, b) {
  if (inPair(LIUHE, a, b)) return { pts: 18, key: 'liuhe' };
  if (sameTriad(a, b)) return { pts: 12, key: 'sanhe' };
  if (CHONG(a, b)) return { pts: -16, key: 'chong' };
  if (inPair(HAI, a, b)) return { pts: -8, key: 'hai' };
  if (a === b) return { pts: 5, key: 'same' };
  return { pts: 0, key: 'none' };
}

const BRANCH_NOTE = {
  liuhe: { zh: '地支六合，天生投缘', en: 'Six-harmony branches — an innate click' },
  sanhe: { zh: '三合同局，同气连枝', en: 'Same harmony triad — branches of one tree' },
  chong: { zh: '地支相冲，磨合为课', en: 'Clashing branches — friction is the curriculum' },
  hai:   { zh: '地支相害，需留心口舌', en: 'Harming branches — mind the small cuts' },
  same:  { zh: '同支相并，习性相近', en: 'Identical branches — mirrored habits' },
  none:  { zh: '地支平和，不助不碍', en: 'Neutral branches — neither wind nor wall' },
};

export function synastry(birthA, birthB) {
  const A = computeBazi(birthA), B = computeBazi(birthB);
  const parts = [];

  const yearRel = branchAffinity(A.year.branch, B.year.branch);
  parts.push({ id: 'year', pts: yearRel.pts, ...BRANCH_NOTE[yearRel.key] });
  const dayRel = branchAffinity(A.day.branch, B.day.branch);
  parts.push({ id: 'day', pts: Math.round(dayRel.pts * 1.3), ...BRANCH_NOTE[dayRel.key] }); // day pillar weighs more (the self)

  // element complementarity: partner is strong where I am weakest
  const weakA = A.elements.indexOf(Math.min(...A.elements));
  const weakB = B.elements.indexOf(Math.min(...B.elements));
  let compl = 0;
  if (B.elements[weakA] >= 2) compl += 6;
  if (A.elements[weakB] >= 2) compl += 6;
  parts.push({ id: 'elements', pts: compl, zh: compl > 0 ? '五行互补，缺处有人补位' : '五行各自成局', en: compl > 0 ? 'Elements interlock — each fills the other\'s gap' : 'Two self-contained element sets' });

  // day-master generative cycle
  const dmRel = elementRelation(A.dayMasterElement, B.dayMasterElement);
  const dmPts = { feeds: 6, drains: 6, same: 3, prize: -2, presses: -4 }[dmRel];
  parts.push({ id: 'daymaster', pts: dmPts, zh: dmPts > 0 ? '日主相生，相处养人' : dmPts < 0 ? '日主相克，强弱需让' : '日主比和', en: dmPts > 0 ? 'Day masters feed each other' : dmPts < 0 ? 'Day masters contend — someone must yield' : 'Day masters of one kind' });

  // western triplicity
  const zA = ZODIAC_TRIPLICITY[zodiacIndex(birthA.m, birthA.d)];
  const zB = ZODIAC_TRIPLICITY[zodiacIndex(birthB.m, birthB.d)];
  const zPts = zA === zB ? 8 : ((zA === 0 && zB === 2) || (zA === 2 && zB === 0) || (zA === 1 && zB === 3) || (zA === 3 && zB === 1)) ? 6 : 0;
  parts.push({ id: 'zodiac', pts: zPts, zh: zPts >= 8 ? '星座同象，火焰同色' : zPts > 0 ? '星座相成，风助火势' : '星座异象，各有天地', en: zPts >= 8 ? 'Same zodiac element — one shade of flame' : zPts > 0 ? 'Complementary elements — wind feeds fire' : 'Different skies, separate weather' });

  const base = clamp(46 + parts.reduce((s, p) => s + p.pts, 0), 8, 96);

  // per-life-pillar sub-scores: stable per pair (seed = pair, not date)
  const pairSeed = strHash(`${birthA.y}-${birthA.m}-${birthA.d}|${birthB.y}-${birthB.m}-${birthB.d}`);
  const rnd = mulberry32(pairSeed);
  const pillars = ['romance', 'marriage', 'career', 'wealth', 'health'].map((id) => ({
    id, score: clamp(Math.round(base + (rnd() * 24 - 12)), 8, 96),
  }));

  return { base, parts, pillars, chartA: A, chartB: B };
}

// Daily couple pull: changes every day (the retention hook), deterministic.
export function dailyPull(birthA, birthB, dateStr) {
  const seed = strHash(`${dateStr}#${birthA.y}-${birthA.m}-${birthA.d}#${birthB.y}-${birthB.m}-${birthB.d}`);
  const rnd = mulberry32(seed);
  const [ty, tm, td] = dateStr.split('-').map(Number);
  const today = dayPillar(ty, tm, td);
  const el = STEM_ELEMENT[today.stem];
  const score = clamp(Math.round(40 + rnd() * 56), 8, 96);
  return { score, todayElement: { zh: ELEMENTS_ZH[el], en: ELEMENTS_EN[el] } };
}

// ---- share codec (URL-safe base64 of both birthdays) -----------------------
export function encodeShare(a, b) {
  const s = JSON.stringify([a.y, a.m, a.d, a.hour ?? null, b.y, b.m, b.d, b.hour ?? null]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeShare(code) {
  try {
    const s = atob(String(code).replace(/-/g, '+').replace(/_/g, '/'));
    const v = JSON.parse(s);
    if (!Array.isArray(v) || v.length !== 8) return null;
    const num = (x, lo, hi) => (typeof x === 'number' && x >= lo && x <= hi) ? x : null;
    const a = { y: num(v[0], 1900, 2100), m: num(v[1], 1, 12), d: num(v[2], 1, 31), hour: v[3] == null ? null : num(v[3], 0, 23) };
    const b = { y: num(v[4], 1900, 2100), m: num(v[5], 1, 12), d: num(v[6], 1, 31), hour: v[7] == null ? null : num(v[7], 0, 23) };
    if (a.y == null || a.m == null || a.d == null || b.y == null || b.m == null || b.d == null) return null;
    return { a, b };
  } catch { return null; }
}
