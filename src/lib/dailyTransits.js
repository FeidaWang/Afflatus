/* ============================================================
   DAILY TRANSITS — V23 Phase 3 (roadmap §7.10 module 2, "双人今日天象").

   Crosses TODAY's real transiting planets (fetched from the precomputed
   public/transits-daily.json — see scripts/gen-transits-daily.mjs) against
   each person's NATAL Sun/Moon (the existing light astro.js calc). Neither
   side of this computation needs astronomy-engine client-side: the transit
   side is precomputed server-side once a day, the natal side only ever
   uses Sun/Moon — this is the whole point of module 4's "连星历库都不用
   为日运加载" requirement. (Full natal Mercury/Venus/Mars only enter the
   picture in the Phase 2 synastry PRO layer, which already dynamic-imports
   astroPlanets.ts on demand — unrelated to this file.)

   Pure, deterministic given the day's transiting-planet input. No PRNG —
   unlike dailyPull() (horoscopeEngine.js's seeded daily-couple-pull number,
   reused as-is by horoscope.js for the 7-day fate calendar), the "weather"
   here is real transit-to-natal aspect geometry, not a seeded pick.
   ============================================================ */
import { aspectBetween, ASPECT_T } from './astro.js';

const TRANSIT_BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
const NATAL_BODIES = ['Sun', 'Moon'];

const BODY_ZH = { Sun: '太阳', Moon: '月亮', Mercury: '水星', Venus: '金星', Mars: '火星', Jupiter: '木星', Saturn: '土星' };
const BODY_EN = { Sun: 'Sun', Moon: 'Moon', Mercury: 'Mercury', Venus: 'Venus', Mars: 'Mars', Jupiter: 'Jupiter', Saturn: 'Saturn' };
const NATAL_ZH = { Sun: '太阳', Moon: '月亮' };

// what a transiting body touching a natal point tends to feel like today
const TRANSIT_MEANING = {
  Sun: { zh: '今天更容易被看见、被认可', en: 'today brings a little more visibility and recognition' },
  Moon: { zh: '今天情绪比较敏感，多一点安抚会很有用', en: 'today runs emotionally tender — a little extra reassurance goes a long way' },
  Mercury: { zh: '今天适合聊正事，表达比平时顺', en: "today's a good day to talk things through — words come easier than usual" },
  Venus: { zh: '今天适合约饭、送点小礼物', en: 'today favors a date, or a small unprompted gift' },
  Mars: { zh: '今天精力和冲劲都比较足，适合行动', en: "today runs high-energy — good for actually doing the thing" },
  Jupiter: { zh: '今天格局比较大方，适合做决定', en: "today's expansive — a good day for a bigger decision" },
  Saturn: { zh: '今天适合谈现实问题，别硬撑气氛', en: "today favors practical talk — don't force the mood" },
};

/**
 * @param {Record<string,number>} transitPlanets - today's degrees, from transits-daily.json's "planets" field
 * @param {{Sun:number, Moon:number}} meNatal
 * @param {{Sun:number, Moon:number}} themNatal
 * @returns {{hits:Array, lines:Array<{zh,en}>}} up to 2 lines, tightest orb first
 */
export function dailyCoupleWeather(transitPlanets, meNatal, themNatal) {
  const hits = [];
  const owners = [['me', meNatal, { zh: '你的', en: 'your' }], ['them', themNatal, { zh: 'TA 的', en: "TA's" }]];
  for (const tBody of TRANSIT_BODIES) {
    if (transitPlanets[tBody] == null) continue;
    for (const [owner, natal, who] of owners) {
      for (const nBody of NATAL_BODIES) {
        if (natal[nBody] == null) continue;
        const a = aspectBetween(transitPlanets[tBody], natal[nBody]);
        if (a) hits.push({ tBody, owner, nBody, who, key: a.key, orb: a.orb, tone: ASPECT_T[a.key].tone });
      }
    }
  }
  hits.sort((a, b) => a.orb - b.orb);
  const lines = hits.slice(0, 2).map((h) => ({
    zh: `今日${BODY_ZH[h.tBody]}触动${h.who.zh}${NATAL_ZH[h.nBody]}：${TRANSIT_MEANING[h.tBody].zh}`,
    en: `Today's transiting ${BODY_EN[h.tBody]} touches ${h.who.en} ${h.nBody}: ${TRANSIT_MEANING[h.tBody].en}`,
  }));
  return { hits, lines };
}
