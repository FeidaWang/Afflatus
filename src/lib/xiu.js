/* ============================================================
   XIU (星宿) — V21 Phase 3. Two mansion systems, deliberately distinct:

   1. 值日宿 (daily mansion, 28 mansions 二十八宿): a plain 28-day cycle,
      one mansion per civil day. Anchored at 2026-07-06 = 危宿, verified
      against an independent widely-used library (lunar-javascript) over
      2,000 random days, plus the classical weekday lock (28 = 4×7, so
      each mansion always falls on the same weekday: 房虚昴星 = Sunday,
      心危毕张 = Monday, ...) which the anchor reproduces.

   2. 本命宿 (natal mansion, 27 mansions 宿曜经 system, 牛宿 excluded):
      the Xiuyao-jing convention — each LUNAR month assigns a mansion to
      day 1 (正月=室, 二月=奎, 三月=胃, 四月=毕, 五月=参, 六月=鬼,
      七月=张, 八月=角, 九月=氐, 十月=心, 十一月=斗, 十二月=虚), then
      count forward (lunar day − 1) through the 27 cycle. A leap month is
      treated as its host month (documented convention choice; schools
      differ and no independent cross-check was available in this
      environment — stated honestly here and in the page caveat).

   3. 双人宿曜关系 (三九秘法): the distance d from mansion A to mansion B
      (forward in the 27 cycle) maps to 命(0) / 業(9) / 胎(18), otherwise
      d%9 → 1栄 2衰 3安 4危 5成 6壊 7友 8親. Directional; the standard
      reading combines both directions.
   ============================================================ */
import { jdn } from './bazi.js';

const mod = (n, m) => ((n % m) + m) % m;

export const XIU28_ZH = ['角', '亢', '氐', '房', '心', '尾', '箕', '斗', '牛', '女', '虚', '危', '室', '壁', '奎', '娄', '胃', '昴', '毕', '觜', '参', '井', '鬼', '柳', '星', '张', '翼', '轸'];
// 27-mansion list for the natal system: the 28 minus 牛宿.
export const XIU27_ZH = XIU28_ZH.filter((x) => x !== '牛');

// -- 值日宿 ------------------------------------------------------------------
const DAILY_ANCHOR = { jd: jdn(2026, 7, 6), idx: 11 }; // 危宿 (verified)
export function dailyXiu(y, m, d) {
  return mod(DAILY_ANCHOR.idx + (jdn(y, m, d) - DAILY_ANCHOR.jd), 28);
}

// -- 本命宿 ------------------------------------------------------------------
// Day-1 mansion of each lunar month, as indices into XIU27_ZH.
// (室11 奎13 胃15 毕17 参19 鬼21 张24 角0 氐2 心4 斗7 虚9)
const MONTH_START_27 = [11, 13, 15, 17, 19, 21, 24, 0, 2, 4, 7, 9];
export function natalXiu(lMonth, lDay) {
  return mod(MONTH_START_27[lMonth - 1] + (lDay - 1), 27);
}

// -- 三九秘法 two-person relation --------------------------------------------
export const XIU_REL = {
  ming: { zh: '命', en: 'Destiny', descZh: '同宿而生，镜像般的缘分——彼此像看见另一个自己', descEn: 'Born under the same mansion — a mirror-like bond' },
  ye: { zh: '业', en: 'Karma', descZh: '前世业缘之说——相处有宿命感，牵绊深', descEn: 'A karmic tie — the bond feels fated and deep' },
  tai: { zh: '胎', en: 'Origin', descZh: '胎缘——像家人一样天然亲近', descEn: 'An origin tie — naturally close, like family' },
  rong: { zh: '荣', en: 'Flourish', descZh: '荣缘——同行则旺，彼此成就', descEn: 'You flourish in each other\'s company' },
  shuai: { zh: '衰', en: 'Wane', descZh: '衰缘——容易消耗对方的气，相处宜留白', descEn: 'Energy drains easily — leave each other room' },
  an: { zh: '安', en: 'Calm', descZh: '安缘——安稳踏实，是能安心相处的关系', descEn: 'A calm, steady, reassuring bond' },
  wei: { zh: '危', en: 'Peril', descZh: '危缘——刺激而不稳定，起伏大', descEn: 'Thrilling but unstable — expect swings' },
  cheng: { zh: '成', en: 'Achieve', descZh: '成缘——一起做事容易成，是好搭档', descEn: 'Things get done together — good partners' },
  huai: { zh: '坏', en: 'Break', descZh: '坏缘——容易互相打破对方的节奏，需经营', descEn: 'You disrupt each other\'s rhythm — needs care' },
  you: { zh: '友', en: 'Friend', descZh: '友缘——自然的朋友缘，轻松合拍', descEn: 'A natural, easy friendship' },
  qin: { zh: '亲', en: 'Kin', descZh: '亲缘——亲人般的照拂与依赖', descEn: 'Kin-like care and reliance' },
};
const REL_SEQ = ['rong', 'shuai', 'an', 'wei', 'cheng', 'huai', 'you', 'qin'];
// Directional relation from mansion a to mansion b (indices in XIU27).
export function xiuRelation(a, b) {
  const d = mod(b - a, 27);
  if (d === 0) return 'ming';
  if (d === 9) return 'ye';
  if (d === 18) return 'tai';
  return REL_SEQ[(d % 9) - 1];
}
