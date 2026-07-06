/* ============================================================
   LUNAR (农历) — V21 Phase 3. Solar→lunar conversion, 1900–2100.

   LUNAR_INFO is the classic public compact table (one int per year:
   low 4 bits = leap-month number or 0; bits 0x8000>>k = 30-day flag for
   month k+1; 0x10000 = the leap month has 30 days). The table is factual
   calendar data in wide public circulation (extracted from the MIT
   solarlunar npm package, itself derived from the standard table);
   the conversion code below is written for this module. Verified against
   an independent implementation over every day of 14 spot years incl.
   all leap-month layouts + 5000 random days — see tests/lunar.test.js
   for the fixed anchors that pin the behaviour.

   Epoch: 1900-01-31 is 1900年正月初一. Valid input range:
   1900-02-01 .. 2100-12-31 (out of range returns null).
   ============================================================ */
export const LUNAR_INFO = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x05ac0, 0x0ab60, 0x096d5, 0x092e0,
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
  0x092e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a4d0, 0x0d150, 0x0f252,
  0x0d520,
];

export const LUNAR_MONTH_ZH = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
const DAY_TENS = ['初', '十', '廿', '三'];
const DAY_ONES = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
export function lunarDayZh(d) {
  if (d === 10) return '初十';
  if (d === 20) return '二十';
  if (d === 30) return '三十';
  return DAY_TENS[Math.floor((d - 1) / 10)] + DAY_ONES[(d - 1) % 10];
}

const info = (y) => LUNAR_INFO[y - 1900];
export const leapMonthOf = (y) => info(y) & 0xf;
const leapDays = (y) => (leapMonthOf(y) ? ((info(y) & 0x10000) ? 30 : 29) : 0);
const monthDays = (y, m) => ((info(y) & (0x10000 >> m)) ? 30 : 29);
function yearDays(y) {
  let sum = 348; // 12 × 29
  for (let bit = 0x8000; bit > 0x8; bit >>= 1) sum += (info(y) & bit) ? 1 : 0;
  return sum + leapDays(y);
}

// Gregorian (y,m,d) → { lYear, lMonth (1-12), lDay, isLeap, monthZh, dayZh }
export function solarToLunar(y, m, d) {
  let offset = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1900, 0, 31)) / 86400000);
  if (offset < 0 || y > 2100) return null;
  let lYear = 1900;
  while (lYear <= 2100 && offset >= yearDays(lYear)) offset -= yearDays(lYear++);
  const leap = leapMonthOf(lYear);
  let lMonth = 1, isLeap = false;
  for (;;) {
    const days = isLeap ? leapDays(lYear) : monthDays(lYear, lMonth);
    if (offset < days) break;
    offset -= days;
    if (leap && lMonth === leap && !isLeap) { isLeap = true; }
    else { isLeap = false; lMonth++; }
  }
  return {
    lYear, lMonth, lDay: offset + 1, isLeap,
    monthZh: (isLeap ? '闰' : '') + LUNAR_MONTH_ZH[lMonth - 1],
    dayZh: lunarDayZh(offset + 1),
  };
}
