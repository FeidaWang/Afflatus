/* ============================================================
   BAZI (四柱八字) — pure calendar math (V20, horoscope.html).

   Pure functions only — no DOM, no fetch, no Date.now() defaults; callers
   pass explicit {y,m,d,hour}. Same testing discipline as arenaRules.js:
   this is entertainment content, but WRONG calendar math is still a bug,
   so the sexagenary day cycle is verified against two independently
   documented anchors in tests/bazi.test.js (1949-10-01 = 甲子日,
   1970-01-01 = 辛巳日 — both widely published).

   Honest approximations (documented, acceptable for an entertainment page,
   labelled on the page itself):
   - Year pillar boundary uses a fixed 立春 ≈ Feb 4 (true instant varies
     ±1 day by year).
   - Month pillar boundaries use fixed approximate solar-term dates
     (true 节气 instants vary ±1 day).
   - Hour pillar: 23:00–00:59 is treated as 子时 of the SAME calendar day
     (the 晚子时 day-boundary debate is out of scope).
   - No apparent-solar-time / longitude correction.
   ============================================================ */

export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
export const ANIMALS_ZH = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
export const ANIMALS_EN = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig'];

// Five elements: 0 wood 木, 1 fire 火, 2 earth 土, 3 metal 金, 4 water 水
export const ELEMENTS_ZH = ['木', '火', '土', '金', '水'];
export const ELEMENTS_EN = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'];
export const STEM_ELEMENT = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
export const BRANCH_ELEMENT = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4]; // 子水丑土寅卯木辰土巳午火未土申酉金戌土亥水

// ---- Julian Day Number (civil calendar) --------------------------------
export function jdn(y, m, d) {
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

// Anchor: 1949-10-01 was a 甲子 day (sexagenary index 0) — verified against
// the independent 1970-01-01 = 辛巳 (index 17) anchor in tests.
const DAY_ANCHOR_JDN = jdn(1949, 10, 1);

const mod = (n, m) => ((n % m) + m) % m;
const pillar = (idx60) => ({ stem: mod(idx60, 10), branch: mod(idx60, 12), idx: mod(idx60, 60) });

// ---- day pillar ----------------------------------------------------------
export function dayPillar(y, m, d) {
  return pillar(jdn(y, m, d) - DAY_ANCHOR_JDN);
}

// ---- year pillar (立春 ≈ Feb 4 boundary) ---------------------------------
export function baziYear(y, m, d) {
  return (m < 2 || (m === 2 && d < 4)) ? y - 1 : y;
}
export function yearPillar(y, m, d) {
  const by = baziYear(y, m, d);
  return { stem: mod(by - 4, 10), branch: mod(by - 4, 12), baziYear: by };
}

// ---- month pillar (approximate solar-term boundaries) --------------------
// Each entry: from {m, d} (inclusive) the branch-month is `b`.
const MONTH_TERMS = [
  { m: 1, d: 6, b: 1 },   // 小寒 → 丑月
  { m: 2, d: 4, b: 2 },   // 立春 → 寅月
  { m: 3, d: 6, b: 3 },   // 惊蛰 → 卯月
  { m: 4, d: 5, b: 4 },   // 清明 → 辰月
  { m: 5, d: 6, b: 5 },   // 立夏 → 巳月
  { m: 6, d: 6, b: 6 },   // 芒种 → 午月
  { m: 7, d: 7, b: 7 },   // 小暑 → 未月
  { m: 8, d: 8, b: 8 },   // 立秋 → 申月
  { m: 9, d: 8, b: 9 },   // 白露 → 酉月
  { m: 10, d: 8, b: 10 }, // 寒露 → 戌月
  { m: 11, d: 7, b: 11 }, // 立冬 → 亥月
  { m: 12, d: 7, b: 0 },  // 大雪 → 子月
];
export function monthBranch(m, d) {
  let b = 0; // dates before Jan 6 fall in the 子月 that started the previous Dec 7
  for (const t of MONTH_TERMS) {
    if (m > t.m || (m === t.m && d >= t.d)) b = t.b;
  }
  return b;
}
// 五虎遁: the 寅-month stem starts from 丙 for 甲/己 years, advancing 2 per pair.
export function monthPillar(y, m, d) {
  const yp = yearPillar(y, m, d);
  const b = monthBranch(m, d);
  const startStem = mod((yp.stem % 5) * 2 + 2, 10);
  const offsetFromYin = mod(b - 2, 12);
  return { stem: mod(startStem + offsetFromYin, 10), branch: b };
}

// ---- hour pillar (五鼠遁) -------------------------------------------------
export function hourBranchOf(hour) {
  return Math.floor(mod(hour + 1, 24) / 2);
}
export function hourPillar(dayStemIdx, hour) {
  const hb = hourBranchOf(hour);
  const startStem = mod((dayStemIdx % 5) * 2, 10);
  return { stem: mod(startStem + hb, 10), branch: hb };
}

// ---- full chart -----------------------------------------------------------
// hour: 0-23, or null/undefined for "hour unknown" (three-pillar chart).
export function computeBazi({ y, m, d, hour }) {
  const yp = yearPillar(y, m, d);
  const mp = monthPillar(y, m, d);
  const dp = dayPillar(y, m, d);
  const hp = (hour == null) ? null : hourPillar(dp.stem, hour);
  const pillars = [yp, mp, dp, ...(hp ? [hp] : [])];
  const elements = [0, 0, 0, 0, 0];
  for (const p of pillars) { elements[STEM_ELEMENT[p.stem]]++; elements[BRANCH_ELEMENT[p.branch]]++; }
  return {
    year: yp, month: mp, day: dp, hour: hp,
    dayMaster: dp.stem,
    dayMasterElement: STEM_ELEMENT[dp.stem],
    animal: yp.branch,
    elements,
  };
}

export const pillarName = (p) => STEMS[p.stem] + BRANCHES[p.branch];

// ---- western zodiac --------------------------------------------------------
export const ZODIAC_ZH = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
export const ZODIAC_EN = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
// triplicity: 0 fire 1 earth 2 air 3 water — Aries fire, Taurus earth, ...
export const ZODIAC_TRIPLICITY = [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3];
const ZODIAC_STARTS = [[3, 21], [4, 20], [5, 21], [6, 22], [7, 23], [8, 23], [9, 23], [10, 24], [11, 23], [12, 22], [1, 20], [2, 19]];
export function zodiacIndex(m, d) {
  // latest sign whose start date (within the calendar year) is <= (m, d);
  // dates before Jan 20 fall through to Capricorn (wrapped from Dec 22).
  let best = 9, bestKey = -1;
  for (let i = 0; i < 12; i++) {
    const [sm, sd] = ZODIAC_STARTS[i], key = sm * 100 + sd;
    if ((m > sm || (m === sm && d >= sd)) && key > bestKey) { best = i; bestKey = key; }
  }
  return best;
}
