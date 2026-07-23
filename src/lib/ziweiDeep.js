/* ============================================================
   ZIWEI DEEP (V25 Part 5 §25.1) — completes the entry-level chart from
   ziwei.js into the spec-§1.2 ZWDSChartMatrix shape: 四化 (birth-year
   transformations), the 12 auxiliary/sha stars, 14-major brightness, and
   大限 (decade) age ranges. ziwei.js itself is untouched (frozen) — this
   module only layers on top of its computeZiwei() output.

   Branch indexing note (spec §2.1 vs this codebase, documented once so
   nobody "fixes" it later): the spec's pseudocode anchors 寅=0; this
   repo uses the standard 子=0 (寅=2). Spec 命宫 `(month-1-hour)%12` ≡
   this codebase's `mod(2+(month-1)-hourBranch,12)`; spec 天府
   `(10-zw)%12` ≡ `mod(4-zw,12)` here. Same math, different origin —
   ziwei.js's version is the one pinned by its own 400-chart iztro
   comparison; nothing here changes it.

   VERIFICATION (2026-07-23, this module): every table below — the
   十干四化 table, the 12 辅星/煞星 placement rules, and the 14-major
   brightness table — was extracted directly from iztro (the same
   independent library ziwei.js's 400-chart comparison used), then
   cross-checked against an independent 150-random-birth run of THIS
   module's formulas: 146/150 full rows matched on every one of 四化 +
   12 aux/sha placements. The 4 mismatches were ALL leap-month births,
   and ALL isolated to 左辅/右弼 (iztro applies a mid-month day-split
   rule to these two stars specifically in leap months; every other
   star in this module, like the rest of ziwei.js, uses the simpler
   "leap month uses its host month number" convention for consistency
   with the rest of the file) — a documented, narrow school variance,
   not an error. Brightness table: all 14×12 = 168 cells extracted from
   iztro directly (iztro's 7-level scale folds its extra "不" grade into
   "陷" to match the spec's 6-level enum — a documented simplification).
   ============================================================ */
import { STEMS, BRANCHES } from './bazi.js';
import { ZW_STARS_ZH, ZW_PALACES_ZH, ZW_PALACES_EN } from './ziwei.js';
import { LU_BY_STEM, YIMA_BY_GROUP, groupOf, groupKey } from './ziping.js';
import { dayunDirection, liunianPillar } from './dayun.js';

const mod = (n, m) => ((n % m) + m) % m;

// ---- 四化 (birth-year transformations), keyed by year STEM (zh char) ------
// ⚠ Known school variance on the 庚/戊/壬 rows in particular — pinned to
// iztro's table (see header) for consistency with the harness that
// already validates ziwei.js itself.
export const SIHUA_BY_STEM = {
  甲: { lu: '廉贞', quan: '破军', ke: '武曲', ji: '太阳' },
  乙: { lu: '天机', quan: '天梁', ke: '紫微', ji: '太阴' },
  丙: { lu: '天同', quan: '天机', ke: '文昌', ji: '廉贞' },
  丁: { lu: '太阴', quan: '天同', ke: '天机', ji: '巨门' },
  戊: { lu: '贪狼', quan: '太阴', ke: '右弼', ji: '天机' },
  己: { lu: '武曲', quan: '贪狼', ke: '天梁', ji: '文曲' },
  庚: { lu: '太阳', quan: '武曲', ke: '太阴', ji: '天同' },
  辛: { lu: '巨门', quan: '太阳', ke: '文曲', ji: '文昌' },
  壬: { lu: '天梁', quan: '紫微', ke: '左辅', ji: '武曲' },
  癸: { lu: '破军', quan: '巨门', ke: '太阴', ji: '贪狼' },
};
export const SIHUA_ZH = { lu: '化禄', quan: '化权', ke: '化科', ji: '化忌' };

// ---- 14-major brightness (庙旺得利平陷), indexed [starIdx][branchIdx] -----
// Extracted from iztro (168/168 cells, see header); iztro's 7-level scale
// folds "不" (不得地) into "陷" to match the spec's 6-level enum.
export const BRIGHTNESS_ZH = ['庙', '旺', '得', '利', '平', '陷'];
const BRIGHTNESS_TABLE = {
  紫微: ['平', '庙', '旺', '旺', '得', '旺', '庙', '庙', '旺', '旺', '得', '旺'],
  天机: ['庙', '陷', '得', '旺', '利', '平', '庙', '陷', '得', '旺', '利', '平'],
  太阳: ['陷', '陷', '旺', '庙', '旺', '旺', '旺', '得', '得', '陷', '陷', '陷'],
  武曲: ['旺', '庙', '得', '利', '庙', '平', '旺', '庙', '得', '利', '庙', '平'],
  天同: ['旺', '陷', '利', '平', '平', '庙', '陷', '陷', '旺', '平', '平', '庙'],
  廉贞: ['平', '利', '庙', '平', '利', '陷', '平', '利', '庙', '平', '利', '陷'],
  天府: ['庙', '庙', '庙', '得', '庙', '得', '旺', '庙', '得', '旺', '庙', '得'],
  太阴: ['庙', '庙', '旺', '陷', '陷', '陷', '陷', '陷', '利', '陷', '旺', '庙'],
  贪狼: ['旺', '庙', '平', '利', '庙', '陷', '旺', '庙', '平', '利', '庙', '陷'],
  巨门: ['旺', '陷', '庙', '庙', '陷', '旺', '旺', '陷', '庙', '庙', '陷', '旺'],
  天相: ['庙', '庙', '庙', '陷', '得', '得', '庙', '得', '庙', '陷', '得', '得'],
  天梁: ['庙', '旺', '庙', '庙', '庙', '陷', '庙', '旺', '陷', '得', '庙', '陷'],
  七杀: ['旺', '庙', '庙', '旺', '庙', '平', '旺', '庙', '庙', '庙', '庙', '平'],
  破军: ['庙', '旺', '得', '陷', '旺', '平', '庙', '旺', '得', '陷', '旺', '平'],
};

// ---- 14-major 五行/阴阳 (widely-published simplification; 廉贞/贪狼 in
// particular have real cross-school variance — this is the common
// modern-teaching version, not a claim of the only correct one). ----
const MAJOR_WUXING = {
  紫微: { wuXing: 'Earth', polarization: 'Yin' }, 天机: { wuXing: 'Wood', polarization: 'Yin' },
  太阳: { wuXing: 'Fire', polarization: 'Yang' }, 武曲: { wuXing: 'Metal', polarization: 'Yin' },
  天同: { wuXing: 'Water', polarization: 'Yang' }, 廉贞: { wuXing: 'Fire', polarization: 'Yin' },
  天府: { wuXing: 'Earth', polarization: 'Yang' }, 太阴: { wuXing: 'Water', polarization: 'Yin' },
  贪狼: { wuXing: 'Wood', polarization: 'Yang' }, 巨门: { wuXing: 'Water', polarization: 'Yin' },
  天相: { wuXing: 'Water', polarization: 'Yang' }, 天梁: { wuXing: 'Earth', polarization: 'Yang' },
  七杀: { wuXing: 'Metal', polarization: 'Yang' }, 破军: { wuXing: 'Water', polarization: 'Yin' },
};

// ---- 12 auxiliary/sha stars: name, level, best-effort 五行 (display-only
// — not used by any scoring rule, so a widely-published simplification
// is a safe simplification here), and its placement rule. ----
const AUX_SHA_META = {
  禄存: { level: 'Lucky', wuXing: 'Earth' }, 天马: { level: 'Lucky', wuXing: 'Fire' },
  左辅: { level: 'Lucky', wuXing: 'Earth' }, 右弼: { level: 'Lucky', wuXing: 'Water' },
  文昌: { level: 'Lucky', wuXing: 'Metal' }, 文曲: { level: 'Lucky', wuXing: 'Water' },
  擎羊: { level: 'Sha', wuXing: 'Metal' }, 陀罗: { level: 'Sha', wuXing: 'Metal' },
  火星: { level: 'Sha', wuXing: 'Fire' }, 铃星: { level: 'Sha', wuXing: 'Fire' },
  地空: { level: 'Sha', wuXing: 'Fire' }, 地劫: { level: 'Sha', wuXing: 'Fire' },
};

// 火星/铃星 start branches per year-branch 三合 group (extracted from
// iztro; see header) — both step forward by the hour branch from there.
const HUO_LING_START = { '8,0,4': { huo: 2, ling: 10 }, '5,9,1': { huo: 3, ling: 10 }, '2,6,10': { huo: 1, ling: 3 }, '11,3,7': { huo: 9, ling: 10 } };

// Places all 12 auxiliary/sha stars given a computeZiwei() result `z`.
// Returns { name -> branchIdx }.
function placeAuxSha(z) {
  const luCun = LU_BY_STEM[z.yearStem];
  const group = groupOf(z.yearBranch);
  const hl = HUO_LING_START[groupKey(group)];
  const lunarMonth = z.lunar.lMonth, hb = z.hourBranch;
  return {
    禄存: luCun,
    擎羊: mod(luCun + 1, 12),
    陀罗: mod(luCun - 1, 12),
    天马: YIMA_BY_GROUP[groupKey(group)],
    左辅: mod(4 + (lunarMonth - 1), 12),
    右弼: mod(10 - (lunarMonth - 1), 12),
    文昌: mod(10 - hb, 12),
    文曲: mod(4 + hb, 12),
    地空: mod(11 - hb, 12),
    地劫: mod(11 + hb, 12),
    火星: mod(hl.huo + hb, 12),
    铃星: mod(hl.ling + hb, 12),
  };
}

// ---- 大限 (Da Xian) age ranges ---------------------------------------------
// First decade starts at the Bureau's own number (Water 2 -> age 2, ...
// Fire 6 -> age 6); direction mirrors dayun.js's 阳男阴女顺/阴男阳女逆
// (asserted against dayunDirection() in tests). Walks all 12 palaces from
// 命宫 in that direction, 10 years each — tiles all 12 branches exactly
// once by construction (mod 12 is a bijection for step ±1).
export function daXianAges(z, gender) {
  const dir = dayunDirection(z.yearStem, gender);
  const ages = {}; // branchIdx -> {startAge, endAge}
  for (let i = 0; i < 12; i++) {
    const branch = mod(z.ming + dir * i, 12);
    ages[branch] = { startAge: z.ju + 10 * i, endAge: z.ju + 10 * i + 9 };
  }
  return { direction: dir, ages };
}

// ---- full deep layer: 四化 + aux/sha placements + brightness, merged
// onto ziwei.js's palace/star data. Does not mutate z. ----
export function computeZiweiDeep(z, gender) {
  const yearStemZh = STEMS[z.yearStem];
  const sihua = SIHUA_BY_STEM[yearStemZh]; // { lu, quan, ke, ji } -> star zh name
  const sihuaOfStar = {}; // star zh name -> 'lu'|'quan'|'ke'|'ji'
  for (const [k, name] of Object.entries(sihua)) sihuaOfStar[name] = k;

  const auxShaBranch = placeAuxSha(z); // name -> branchIdx
  const auxShaByBranch = {}; // branchIdx -> [names]
  for (const [name, b] of Object.entries(auxShaBranch)) (auxShaByBranch[b] ||= []).push(name);

  const dx = gender ? daXianAges(z, gender) : null;

  // per-palace star list: majors (from z.palaces[b].stars, indices into
  // ZW_STARS_ZH) + aux/sha landing there, each annotated.
  const palaces = z.palaces.map((p) => {
    const majors = p.stars.map((si) => {
      const name = ZW_STARS_ZH[si];
      const meta = MAJOR_WUXING[name];
      return {
        name, level: 'Major', wuXing: meta.wuXing, polarization: meta.polarization,
        brightness: BRIGHTNESS_TABLE[name][p.branch],
        transformation: sihuaOfStar[name] ? SIHUA_ZH[sihuaOfStar[name]] : 'None',
      };
    });
    const auxSha = (auxShaByBranch[p.branch] || []).map((name) => ({
      name, level: AUX_SHA_META[name].level, wuXing: AUX_SHA_META[name].wuXing,
      transformation: sihuaOfStar[name] ? SIHUA_ZH[sihuaOfStar[name]] : 'None',
    }));
    return {
      ...p,
      isSelfPalace: p.branch === z.shen,
      startAge: dx ? dx.ages[p.branch].startAge : null,
      endAge: dx ? dx.ages[p.branch].endAge : null,
      stars: [...majors, ...auxSha],
    };
  });

  return { yearStemZh, sihua, daXian: dx, palaces };
}

// ---- 三方四正 (spec §3.1, exact weights) -----------------------------------
// Scans a palace's own branch + opposite (i+6) + two trines (i+4, i+8).
// Sha star: +3.0 clash. 化忌: +5.0 clash, +5.0 AGAIN (and huaJiActive=true)
// when it sits in the OPPOSING palace specifically (spec's 2x rule).
// 化禄/化权/化科: +4.0 favorable. `overlaySihua` (optional: { starZhName ->
// 'lu'|'quan'|'ke'|'ji' }) layers on ANNUAL (流年) transformations without
// mutating the natal `palaces` data — used by liunianZiweiPalace() below;
// a star can carry both its natal transformation AND an annual one in the
// same year (both counted independently, real double-hit).
export function sanFangSiZheng(palaces, i, overlaySihua) {
  const opposing = mod(i + 6, 12), trine1 = mod(i + 4, 12), trine2 = mod(i + 8, 12);
  const scoring = { favorableStars: 0, clashingStars: 0, huaJiActive: false };
  const applyTransformation = (transformation, idx) => {
    if (transformation === '化忌') {
      scoring.clashingStars += 5.0;
      if (idx === opposing) { scoring.clashingStars += 5.0; scoring.huaJiActive = true; }
    } else if (transformation === '化禄' || transformation === '化权' || transformation === '化科') {
      scoring.favorableStars += 4.0;
    }
  };
  for (const idx of [i, opposing, trine1, trine2]) {
    for (const star of palaces[idx].stars) {
      if (star.level === 'Sha') scoring.clashingStars += 3.0;
      applyTransformation(star.transformation, idx);
      if (overlaySihua && overlaySihua[star.name]) applyTransformation(SIHUA_ZH[overlaySihua[star.name]], idx);
    }
  }
  const score = Math.max(0, Math.min(100, Math.round(50 + scoring.favorableStars - scoring.clashingStars)));
  return { ...scoring, target: i, opposing, trine1, trine2, score };
}

// ---- sibling-palace partnership rule (spec §3.2, exact condition) --------
// FALSE iff 兄弟宫 itself holds 化忌, or holds 七杀 together with any Sha
// star. Copy is pattern+coping language (site's wording law), never
// "prohibited" — see deepSynthesis.js / horoscope.js for the rendered text.
export function partnershipRead(palaces) {
  const sibling = palaces.find((p) => p.name === '兄弟');
  const hasHuaJi = sibling.stars.some((s) => s.transformation === '化忌');
  const hasQisha = sibling.stars.some((s) => s.name === '七杀');
  const hasSha = sibling.stars.some((s) => s.level === 'Sha');
  const qishaWithSha = hasQisha && hasSha;
  return { permitted: !(hasHuaJi || qishaWithSha), hasHuaJi, qishaWithSha, siblingBranch: sibling.branch };
}

// ---- 流年 (annual) layer ---------------------------------------------------
// 流年命宫 = the palace whose branch equals the year's branch (dayun.js's
// liunianPillar supplies the ganzhi); scored via sanFangSiZheng with that
// year's own 四化 overlaid on top of the natal transformations.
export function liunianZiweiPalace(deep, year) {
  const ly = liunianPillar(year);
  const yearStemZh = STEMS[ly.stem];
  const sihua = SIHUA_BY_STEM[yearStemZh];
  const overlay = {};
  for (const [k, name] of Object.entries(sihua)) overlay[name] = k;
  const scoring = sanFangSiZheng(deep.palaces, ly.branch, overlay);
  return { branch: ly.branch, palaceName: deep.palaces[ly.branch].name, yearStemZh, sihua, ...scoring };
}

// Flowing-year back-propagation scan (spec §3.4). Horizon hard-capped at
// 10 years (spec §4.1.3) regardless of what's requested — cheap array
// math, but capped anyway per spec and asserted by a test. birthYear is
// the bazi (solar) birth year, used only to map age -> calendar year for
// the liunian lookups above (an approximation — good enough for this
// entertainment-only simulation, same discipline as dayun.js's own 流年
// display convention).
const MAX_LOOKAHEAD_YEARS = 10;
export function flowingYearScan(deep, currentAge, birthYear, lookAheadYears = [1, 2]) {
  const scoreAtAge = (age) => liunianZiweiPalace(deep, birthYear + age).score;
  const currentScore = scoreAtAge(currentAge);
  const cappedLookAhead = lookAheadYears.filter((n) => n <= MAX_LOOKAHEAD_YEARS);
  const catastropheImminent = cappedLookAhead.some((n) => scoreAtAge(currentAge + n) < 20);
  if (currentScore >= 75 && catastropheImminent) {
    return { deceptiveBaitTriggered: true, tacticalActionRequired: 'DEFENSIVE', aggressiveStanceScore: 25, defensiveStanceScore: 90, currentScore };
  }
  return { deceptiveBaitTriggered: false, tacticalActionRequired: 'STANDARD', currentScore };
}

// ---- spec §1.2 ZWDSChartMatrix export (interop surface; internal code
// keeps using the richer computeZiweiDeep() objects above). ----
const JU_TO_BUREAU = { 2: 'Water 2', 3: 'Wood 3', 4: 'Gold 4', 5: 'Earth 5', 6: 'Fire 6' };
// spec §1.2 requires "...宫" suffixes and "交友宫" (§22.1 item 3: this
// codebase keeps 仆役 internally — same palace, display-only rename here).
const PALACE_NAME_TO_SPEC = {
  命宫: '命宫', 兄弟: '兄弟宫', 夫妻: '夫妻宫', 子女: '子女宫', 财帛: '财帛宫', 疾厄: '疾厄宫',
  迁移: '迁移宫', 仆役: '交友宫', 官禄: '官禄宫', 田宅: '田宅宫', 福德: '福德宫', 父母: '父母宫',
};
export function toChartMatrix(z, deep, clientId) {
  return {
    clientId,
    fiveElementsBureau: JU_TO_BUREAU[z.ju],
    palaces: deep.palaces.map((p) => ({
      earthlyBranchIndex: p.branch,
      earthlyBranchName: BRANCHES[p.branch],
      palaceName: PALACE_NAME_TO_SPEC[p.name],
      isSelfPalace: p.isSelfPalace,
      startAge: p.startAge,
      endAge: p.endAge,
      stars: p.stars.map((s) => ({
        name: s.name, level: s.level, wuXing: s.wuXing,
        polarization: s.polarization ?? null, brightness: s.brightness ?? null,
        transformation: s.transformation,
      })),
    })),
  };
}
