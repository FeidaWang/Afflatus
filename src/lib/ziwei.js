/* ============================================================
   ZIWEI (紫微斗数, entry-level chart) — V21 Phase 6. Pure functions.

   Implements the classical 安星 sequence for the 14 major stars:
   1. 命宫/身宫 from lunar month + hour branch (寅起正月，顺数至生月；
      自生月宫起子时，逆数至生时为命宫、顺数为身宫).
   2. 命宫天干 via 五虎遁 from the year stem; 五行局 = the 命宫干支's
      nayin element (水二/木三/金四/土五/火六局).
   3. 紫微 position from (局数, lunar day): q = ceil(day/ju), r = q·ju−day;
      odd r steps back (q−r), even r steps forward (q+r), counted 1-based
      from 寅.
   4. 紫微 chain (backward): 天机 −1, 太阳 −3, 武曲 −4, 天同 −5, 廉贞 −8.
      天府 mirrors 紫微 across the 寅申 axis (tf = 4 − zw mod 12); 天府
      chain (forward): 太阴 +1, 贪狼 +2, 巨门 +3, 天相 +4, 天梁 +5,
      七杀 +6, 破军 +10.
   5. Palace names run BACKWARD from 命宫: 兄弟, 夫妻, 子女, 财帛, 疾厄,
      迁移, 仆役, 官禄, 田宅, 福德, 父母.

   VERIFIED against the iztro library (an independent, widely-used 紫微
   implementation) over 400 random births: 五行局, 命宫 stem+branch and
   all 14 major-star branches matched 400/400 (see RELEASE_NOTES V21
   Phase 6). Conventions pinned by that comparison and documented here:
   - Year stem/branch for 五虎遁 uses the LUNAR year (正月初一 boundary,
     the mainstream 紫微 convention) — NOT bazi's 立春 boundary.
   - A leap-month birth uses its host month number.
   - 晚子时 (23:xx) is treated as 子 hour of the SAME day here (iztro's
     separate "late zi" mode is a school choice; documented, not hidden).
   Minor stars (辅弼昌曲 etc.) and 四化 are out of scope for this entry
   version — the page says so.
   ============================================================ */
import { STEMS, BRANCHES } from './bazi.js';
import { nayinOf } from './ziping.js';
import { solarToLunar } from './lunar.js';
import { hourBranchOf } from './bazi.js';

const mod = (n, m) => ((n % m) + m) % m;
const ganzhiIndex = (stem, branch) => { for (let i = 0; i < 60; i++) if (i % 10 === stem && i % 12 === branch) return i; return -1; };

export const ZW_STARS_ZH = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'];
export const ZW_PALACES_ZH = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母'];
export const ZW_PALACES_EN = ['Life', 'Siblings', 'Spouse', 'Children', 'Wealth', 'Health', 'Travel', 'Friends', 'Career', 'Property', 'Fortune', 'Parents'];
const JU_BY_ELEMENT = [3, 6, 5, 4, 2]; // wood3 fire6 earth5 metal4 water2 (ELEMENTS order 木火土金水)
export const JU_ZH = { 2: '水二局', 3: '木三局', 4: '金四局', 5: '土五局', 6: '火六局' };

// One-line reads for the 14 major stars (site's own text, healing tone).
export const ZW_STAR_READS = {
  紫微: { zh: '帝座——天生带主心骨，适合站在需要担当的位置', en: 'The Emperor star — a natural backbone; you suit positions of responsibility' },
  天机: { zh: '智多星——脑子转得快，靠灵活和洞察吃饭', en: 'The Strategist — quick-minded, living by agility and insight' },
  太阳: { zh: '发光体——能量向外给，照顾人也渴望被看见', en: 'The Sun — energy flows outward; you give light and wish to be seen' },
  武曲: { zh: '行动派财星——务实、执行力强，靠双手挣安全感', en: 'The Doer — pragmatic and strong-willed; security is earned by your own hands' },
  天同: { zh: '福星——天性温和知足，擅长把日子过软', en: 'The Peacemaker — gentle and content; you soften life around you' },
  廉贞: { zh: '双面星——原则与欲望并存，能量用对了很惊人', en: 'The Dual star — principle and desire coexist; aimed well, remarkable' },
  天府: { zh: '库星——稳、能守成，是众人靠得住的后方', en: 'The Treasury — steady and preserving; the reliable rear guard' },
  太阴: { zh: '月亮——细腻内敛，情感和审美都走深水区', en: 'The Moon — subtle and inward; feelings and taste run deep' },
  贪狼: { zh: '欲望星——多才多艺，对世界胃口很大', en: 'The Charmer — many talents, a large appetite for the world' },
  巨门: { zh: '口舌星——表达是天赋，也要修炼说话的温度', en: 'The Orator — expression is the gift; warmth is the practice' },
  天相: { zh: '印星——公道、得体，是天然的协调者', en: 'The Chancellor — fair and proper; a born coordinator' },
  天梁: { zh: '荫星——有长者气质，习惯替人撑伞', en: 'The Elder — an old-soul aura; you hold umbrellas for others' },
  七杀: { zh: '将星——冲劲十足，人生剧本偏爱大开大合', en: 'The General — full of drive; your script favours bold strokes' },
  破军: { zh: '先锋星——不破不立，变化就是你的养分', en: 'The Vanguard — break to rebuild; change itself feeds you' },
};

// 紫微 branch from (局数, lunar day)
export function ziweiBranch(ju, lunarDay) {
  const q = Math.ceil(lunarDay / ju);
  const r = q * ju - lunarDay;
  const pos = (r % 2 === 1) ? q - r : q + r;
  return mod(2 + pos - 1, 12);
}

// Full chart. birth = CST-normalized {y,m,d,hour}; hour REQUIRED (the hour
// branch places the life palace — callers gate on it).
// Returns null when the hour is missing or the date is outside 1900–2100.
export function computeZiwei({ y, m, d, hour }) {
  if (hour == null) return null;
  const lunar = solarToLunar(y, m, d);
  if (!lunar) return null;
  const hb = hourBranchOf(hour); // 晚子时 → 子 branch, same day (documented)
  const yearStem = mod(lunar.lYear - 4, 10);
  const yearBranch = mod(lunar.lYear - 4, 12);

  const ming = mod(2 + (lunar.lMonth - 1) - hb, 12);
  const shen = mod(2 + (lunar.lMonth - 1) + hb, 12);
  // 五虎遁 from the (lunar) year stem → 命宫天干
  const startStem = mod((yearStem % 5) * 2 + 2, 10);
  const mingStem = mod(startStem + mod(ming - 2, 12), 10);
  const ju = JU_BY_ELEMENT[nayinOf(ganzhiIndex(mingStem, ming)).el];

  const zw = ziweiBranch(ju, lunar.lDay);
  const tf = mod(4 - zw, 12); // 天府 mirrors 紫微 across the 寅申 axis
  const starBranch = [
    zw, mod(zw - 1, 12), mod(zw - 3, 12), mod(zw - 4, 12), mod(zw - 5, 12), mod(zw - 8, 12),
    tf, mod(tf + 1, 12), mod(tf + 2, 12), mod(tf + 3, 12), mod(tf + 4, 12), mod(tf + 5, 12), mod(tf + 6, 12), mod(tf + 10, 12),
  ];

  // palaces: 12 branches, each with its palace name (backward from 命宫),
  // stem (五虎遁 continued) and the major stars that landed there.
  const palaces = [];
  for (let b = 0; b < 12; b++) {
    palaces.push({
      branch: b,
      stem: mod(startStem + mod(b - 2, 12), 10),
      name: ZW_PALACES_ZH[mod(ming - b, 12)],
      nameEn: ZW_PALACES_EN[mod(ming - b, 12)],
      stars: starBranch.map((sb, si) => (sb === b ? si : -1)).filter((si) => si >= 0),
    });
  }
  return {
    lunar, hourBranch: hb, yearStem, yearBranch,
    ming, shen, mingStem, ju,
    ziwei: zw, tianfu: tf, starBranch, palaces,
    gzOfPalace: (b) => STEMS[palaces[b].stem] + BRANCHES[b],
  };
}
