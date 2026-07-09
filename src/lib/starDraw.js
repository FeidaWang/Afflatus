/* ============================================================
   STAR DRAW (每日星语签) — V23 Phase 3 (roadmap §7.10 module 2 point 2).
   One deterministic daily card draw per person: seed = dateStr + a hash
   of their birth data, so "everyone draws something different, but the
   same person on the same day always sees the same card" — verifiable
   without a backend, same trick horoscopeEngine.js already uses for
   dailyFortune()/dailyPull().

   Card pool is two existing collectible series, no new content needed
   for card IDENTITY (only the action-advice text below is new):
     - 28 lunar mansions (src/lib/xiu.js XIU28_ZH — matches the roadmap's
       "28 星宿" series exactly)
     - 12 zodiac signs (src/lib/bazi.js ZODIAC_ZH/EN + astroChart.js's
       ZODIAC_GLYPH)
   A streak of 7+ (reusing horoscope.js's existing STREAK_KEY counter,
   not a new mechanism) unlocks a small "hidden" bonus pool — still only
   drawn some days, so it stays a collectible rather than an instant
   unlock-everything switch.

   DESIGN LAW (same as astroReadings.js / synastryAstro.js): every card's
   advice line is an ACTION, never a fortune/doom prediction. No 吉/凶,
   no "will happen", no health/money promises.
   ============================================================ */
import { XIU28_ZH } from './xiu.js';
import { ZODIAC_ZH, ZODIAC_EN } from './bazi.js';
import { ZODIAC_GLYPH } from './astroChart.js';

function strHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export const XIU_SERIES = XIU28_ZH.map((zh, i) => ({ series: 'xiu', idx: i, glyph: '✦', zh: `${zh}宿`, en: `Mansion of ${zh}` }));
export const ZODIAC_SERIES = ZODIAC_ZH.map((zh, i) => ({ series: 'zodiac', idx: i, glyph: ZODIAC_GLYPH[i], zh: `${zh}座`, en: ZODIAC_EN[i] }));
const STANDARD_POOL = [...XIU_SERIES, ...ZODIAC_SERIES]; // 40 cards

const HIDDEN_POOL = [
  { series: 'hidden', idx: 0, glyph: '☄', zh: '归途', en: 'The Way Back' },
  { series: 'hidden', idx: 1, glyph: '✺', zh: '破晓', en: 'First Light' },
  { series: 'hidden', idx: 2, glyph: '❂', zh: '满盈', en: 'Full Bloom' },
  { series: 'hidden', idx: 3, glyph: '✵', zh: '静潮', en: 'Still Tide' },
];

// Action-only advice bank — deliberately generic enough to pair with any
// card face; the card supplies the "flavor", this supplies the "do this".
const ACTION_BANK = [
  { zh: '今天适合主动联系一个很久没聊的人', en: 'Today favors reaching out to someone you\'ve let drift' },
  { zh: '今天适合把一件拖了很久的小事处理掉', en: 'Today favors finally clearing that one small overdue task' },
  { zh: '今天适合早点睡，别把精力都花在屏幕上', en: 'Today favors an early night — save the energy from the screen' },
  { zh: '今天适合说一句平时说不出口的感谢', en: 'Today favors saying the thank-you you usually swallow' },
  { zh: '今天适合独处半小时，不用回复任何人', en: 'Today favors thirty unclaimed minutes — no replies owed to anyone' },
  { zh: '今天适合把想法写下来，而不是只放在脑子里', en: 'Today favors writing the idea down instead of just carrying it' },
  { zh: '今天适合出门走走，哪怕只是绕小区一圈', en: 'Today favors a walk outside, even just once around the block' },
  { zh: '今天适合把一个"随便吧"的决定认真做一次', en: 'Today favors actually deciding the thing you\'ve been "whatever"-ing' },
  { zh: '今天适合问一句"你还好吗"，然后认真听答案', en: 'Today favors asking "are you okay" and actually listening to the answer' },
  { zh: '今天适合整理一个乱了很久的抽屉或文件夹', en: 'Today favors tidying the one drawer or folder that\'s been chaos for weeks' },
  { zh: '今天适合喝一杯水，然后再喝一杯', en: 'Today favors a glass of water, then another one' },
  { zh: '今天适合把手机放远一点，吃一顿不看屏幕的饭', en: 'Today favors putting the phone away for one screen-free meal' },
];

/**
 * @param {{dateStr:string, birthKey:string, streak?:number}} input
 *   birthKey: any stable per-person string, e.g. `${y}-${m}-${d}-${hour}`.
 * @returns {{card:{series,idx,glyph,zh,en}, advice:{zh,en}, hidden:boolean}}
 */
export function dailyDraw({ dateStr, birthKey, streak = 0 }) {
  const rnd = mulberry32(strHash(`${dateStr}|${birthKey}`));
  const hiddenUnlocked = streak >= 7 && rnd() < 0.25;
  const pool = hiddenUnlocked ? HIDDEN_POOL : STANDARD_POOL;
  const card = pool[Math.floor(rnd() * pool.length)];
  const advice = ACTION_BANK[Math.floor(rnd() * ACTION_BANK.length)];
  return { card, advice, hidden: hiddenUnlocked };
}
