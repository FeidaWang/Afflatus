/* ============================================================
   SYNASTRY ASTRO — V23 Phase 2 (roadmap §7.10 module 1, "双盘"). Cross-
   chart aspect scoring, a relationship-title generator, attraction/
   red-flag phrase lines, and a Davison composite (relationship-as-its-
   own-chart) reading.

   Deliberately takes plain longitude maps as input — NOT ephemeris
   objects — so this module never imports astronomy-engine and stays
   as light as astro.js itself. The caller (horoscope.js) is the one
   that dynamically imports astroPlanets.ts to fill in Mercury/Venus/
   Mars degrees before calling in here; Sun/Moon come from the existing
   light astro.js calc. This keeps the pure logic here fully unit-
   testable with synthetic inputs and keeps the bundle-weight
   discipline (roadmap module 4) entirely in horoscope.js's orchestration,
   not in this file.

   Bodies used for synastry: Sun, Moon, Mercury, Venus, Mars — the five
   "personal planets", the standard synastry-relevant set (outer planets
   move too slowly to be meaningfully personal to a two-person reading).

   Design law (same as astroReadings.js): attraction lines stay warm,
   red-flag lines stay advice-shaped and NEVER fatalistic ("注定分手"
   style wording is banned by construction — the phrase bank only ever
   describes friction + a coping action).
   ============================================================ */
import { aspectBetween, ASPECT_T, signOf } from './astro.js';

export const SYN_BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars'];

/**
 * All aspects between "their" five personal planets and "my" five personal
 * planets (25 directional pairs; aspectBetween is symmetric so the aspect
 * itself doesn't depend on direction, but which body is "theirs" vs "mine"
 * matters for the phrasing later).
 * @param {Record<string,number>} themLons - {Sun,Moon,Mercury,Venus,Mars} degrees
 * @param {Record<string,number>} meLons
 * @returns {Array<{bodyThem:string, bodyMe:string, key:string, sep:number, orb:number, tone:string}>}
 */
export function crossAspects(themLons, meLons) {
  const out = [];
  for (const bodyThem of SYN_BODIES) {
    if (themLons[bodyThem] == null) continue;
    for (const bodyMe of SYN_BODIES) {
      if (meLons[bodyMe] == null) continue;
      const a = aspectBetween(themLons[bodyThem], meLons[bodyMe]);
      if (a) out.push({ bodyThem, bodyMe, key: a.key, sep: a.sep, orb: a.orb, tone: ASPECT_T[a.key].tone });
    }
  }
  return out;
}

// ---- relationship title, keyed by unordered body pair (15 combos) ---------
const TITLE_BANK = {
  'Sun-Sun': { zh: '太阳合拍型双主角', en: 'Double Main Character' },
  'Moon-Sun': { zh: '阳光懂事型灵魂搭档', en: 'Sun-Moon Soul Sync' },
  'Mercury-Sun': { zh: '脑洞互通型话痨CP', en: 'Mind-Meld Chatterbox' },
  'Sun-Venus': { zh: '互相欣赏型双向奔赴', en: 'Mutual Admiration Society' },
  'Mars-Sun': { zh: '火花四溅型拉扯搭子', en: 'Spark & Tug Duo' },
  'Moon-Moon': { zh: '情绪同步型月亮姐妹花', en: 'Moonlight Mirror' },
  'Mercury-Moon': { zh: '有话直说型知心搭子', en: 'Heart-to-Heart Talkers' },
  'Moon-Venus': { zh: '月亮贴贴型灵魂搭子', en: 'Moon-Venus Cuddle Match' },
  'Mars-Moon': { zh: '情绪拉扯型欢喜冤家', en: 'Moon-Mars Push & Pull' },
  'Mercury-Mercury': { zh: '水星狂欢型笑友', en: 'Mercury Twins' },
  'Mercury-Venus': { zh: '甜言蜜语型撩拨搭子', en: 'Sweet-Talk Duo' },
  'Mars-Mercury': { zh: '唇枪舌剑型辩论CP', en: 'Debate Club Sparks' },
  'Venus-Venus': { zh: '审美一致型双厨狂喜', en: 'Same Taste, Double Delight' },
  'Mars-Venus': { zh: '火星拉扯型欢喜冤家', en: 'Venus-Mars Chemistry' },
  'Mars-Mars': { zh: '行动力爆表型冒险搭档', en: 'Dual Ignition' },
};
const pairKey = (a, b) => SYN_BODIES.includes(a) && SYN_BODIES.includes(b)
  ? [a, b].sort().join('-') : null;

/**
 * Pick the tightest (smallest-orb) aspect overall and return its title.
 * Falls back to a generic tone-based title if the pair is somehow missing
 * from the bank (shouldn't happen — all 15 combos are covered above).
 */
export function relationshipTitle(aspects) {
  if (!aspects.length) return { zh: '静水流深型平行线', en: 'Quiet Waters, Parallel Lines' };
  const strongest = aspects.slice().sort((a, b) => a.orb - b.orb)[0];
  const t = TITLE_BANK[pairKey(strongest.bodyThem, strongest.bodyMe)];
  if (t) return t;
  const FALLBACK = {
    strong: { zh: '强连接型命中搭子', en: 'Strong-Link Match' },
    soft: { zh: '松弛默契型舒服搭子', en: 'Easy-Going Match' },
    hard: { zh: '拉扯磨合型成长搭子', en: 'Grow-Through-Friction Match' },
  };
  return FALLBACK[strongest.tone];
}

/**
 * Comprehensive 0-100 resonance score: blends the existing bazi synastry
 * base score (horoscopeEngine.js's synastry().base) with an astro-aspect
 * component so the astro layer actually moves the number, not just the
 * copy — per roadmap "综合分" wording.
 */
export function resonanceScore(baziBase, aspects) {
  const TONE_W = { strong: 6, soft: 4, hard: -3 };
  const astroRaw = aspects.reduce((s, a) => s + TONE_W[a.tone] * (1 - a.orb / 10), 50);
  const astroScore = Math.max(5, Math.min(96, Math.round(astroRaw)));
  return Math.max(8, Math.min(96, Math.round((baziBase + astroScore) / 2)));
}

// ---- attraction / red-flag phrase composition ------------------------------
const BODY_ZH = { Sun: '太阳', Moon: '月亮', Mercury: '水星', Venus: '金星', Mars: '火星' };
const BODY_EN = { Sun: 'Sun', Moon: 'Moon', Mercury: 'Mercury', Venus: 'Venus', Mars: 'Mars' };

// what "TA's {planet}" naturally brings, in an attraction context
const ATTRACTION_MEANING = {
  Sun: { zh: 'TA 天生的存在感能稳稳照亮你', en: "TA's presence naturally lights things up for you" },
  Moon: { zh: 'TA 天然懂你的情绪起伏', en: 'TA instinctively reads your moods' },
  Mercury: { zh: 'TA 的想法总能跟你对上频率', en: "TA's mind naturally clicks with yours" },
  Venus: { zh: 'TA 天然想对你好，愿意主动示好', en: "TA naturally wants to be good to you" },
  Mars: { zh: 'TA 的直接和冲劲能点燃你的行动力', en: "TA's drive lights a fire under you" },
};
// friction + coping advice, in a red-flag context (never fatalistic)
const FRICTION_ADVICE = {
  Sun: { zh: '各自都需要被看见的时刻，轮流当主角，别抢麦', en: 'You both need your moment in the spotlight — take turns, not the mic' },
  Moon: { zh: '累的时候先说"我需要静一静"，别憋着等对方猜', en: 'Say "I need a minute" when drained — don\'t make them guess' },
  Mercury: { zh: '文字消息容易误会，重要事打电话或见面说', en: 'Text messages misread easily — call or talk face to face for anything that matters' },
  Venus: { zh: '示爱的方式不一样，别用自己的标准判断对方冷不冷淡', en: "You show affection differently — don't measure their warmth by your own scale" },
  Mars: { zh: '争执上头时先暂停十分钟，别在气头上下结论', en: 'Pause ten minutes when it heats up — never conclude mid-flare' },
};

function attractionLine(a) {
  const m = ATTRACTION_MEANING[a.bodyThem];
  return {
    zh: `TA 的${BODY_ZH[a.bodyThem]}落在你的${BODY_ZH[a.bodyMe]}上：${m.zh}`,
    en: `TA's ${BODY_EN[a.bodyThem]} lands on your ${BODY_EN[a.bodyMe]}: ${m.en}`,
  };
}
function redFlagLine(a) {
  const advice = FRICTION_ADVICE[a.bodyThem];
  const t = ASPECT_T[a.key];
  if (a.bodyThem === a.bodyMe) {
    return {
      zh: `你们的${BODY_ZH[a.bodyThem]}${t.zh}：${advice.zh}`,
      en: `Your ${BODY_EN[a.bodyThem]}s form a ${t.en.toLowerCase()}: ${advice.en}`,
    };
  }
  return {
    zh: `TA 的${BODY_ZH[a.bodyThem]}与你的${BODY_ZH[a.bodyMe]}${t.zh}：${advice.zh}`,
    en: `TA's ${BODY_EN[a.bodyThem]} ${t.en.toLowerCase()}s your ${BODY_EN[a.bodyMe]}: ${advice.en}`,
  };
}

/** Top 3 positive (strong/soft) aspects, tightest orb first, ≤3 lines. */
export function attractionLines(aspects) {
  return aspects.filter((a) => a.tone !== 'hard').sort((a, b) => a.orb - b.orb).slice(0, 3).map(attractionLine);
}
/** Top 2 negative (hard) aspects, tightest orb first, ≤2 lines, advice-shaped. */
export function redFlagLines(aspects) {
  return aspects.filter((a) => a.tone === 'hard').sort((a, b) => a.orb - b.orb).slice(0, 2).map(redFlagLine);
}

// ---- Davison composite (relationship-as-its-own-chart) ---------------------
// Time midpoint only (v1 scope — location midpoint/houses deferred: most
// visitors won't have both birthplaces on hand, and a Sun/Moon read needs
// no ascendant). sunLongitude/moonLongitude are passed in by the caller
// (computed at the midpoint JD via the existing light astro.js functions).
const COMPOSITE_SUN = [
  { zh: '这段关系敢想敢做，遇事先冲，不喜欢原地等待', en: 'This pairing acts first and thinks later — waiting around is not its style' },
  { zh: '这段关系稳扎稳打，靠长期积累而不是激情维持', en: 'This pairing is built on slow accumulation, not bursts of passion' },
  { zh: '这段关系话题不断，靠聊天和新鲜信息维系热度', en: 'This pairing runs on conversation — new topics keep it warm' },
  { zh: '这段关系像个安全的家，重视陪伴胜过刺激', en: 'This pairing feels like home — presence matters more than excitement' },
  { zh: '这段关系存在感很强，走到哪都容易被人注意到', en: "This pairing has real presence — hard for others not to notice" },
  { zh: '这段关系讲究细节和分寸，靠谱是它的底色', en: 'This pairing runs on precision and care for detail — reliability is its baseline' },
  { zh: '这段关系擅长社交场合，两人一起总显得游刃有余', en: 'This pairing shines socially — the two of you look effortless together' },
  { zh: '这段关系有点神秘感，外人很难完全看懂', en: "This pairing carries some mystery — outsiders never quite read it" },
  { zh: '这段关系需要留白和自由，管得太紧容易反弹', en: 'This pairing needs room to roam — hold it too tight and it pushes back' },
  { zh: '这段关系脚踏实地，靠一步步兑现承诺积累信任', en: 'This pairing earns trust step by step, promise by kept promise' },
  { zh: '这段关系有点特立独行，不太在意外界的标准答案', en: "This pairing doesn't chase the conventional script" },
  { zh: '这段关系情感细腻，容易共情也容易被彼此感动', en: 'This pairing runs tender — easy to empathize, easy to move each other' },
];
const COMPOSITE_MOON = [
  { zh: '情绪来得快去得也快，吵完很快能翻篇', en: 'Moods flare and fade fast — arguments rarely linger' },
  { zh: '情绪基调很稳，习惯用日常的仪式感彼此确认', en: 'The emotional baseline runs steady, reinforced by small daily rituals' },
  { zh: '情绪需要被说出来才算数，闷着不说容易积怨', en: 'Feelings need to be voiced — silence quietly builds resentment' },
  { zh: '情绪重感情牌，容易因为一句体贴的话就和好', en: 'Runs on sentiment — one thoughtful line can mend most things' },
  { zh: '情绪要面子，公开场合的尊重比私下的甜言更重要', en: 'Pride matters — public respect counts more than private sweet talk' },
  { zh: '情绪偏谨慎，安全感靠实际行动一点点攒出来', en: 'Cautious by nature — security is earned through concrete follow-through' },
  { zh: '情绪外放，两人在一起容易吸引旁人围观', en: 'Emotionally expressive — the two of you tend to draw an audience' },
  { zh: '情绪深藏，很多感受要很久之后才愿意说出口', en: 'Feelings run deep and private — it takes time before either says them aloud' },
  { zh: '情绪怕被束缚，吵架多半是因为有一方觉得不自由', en: 'Fears being caged — most fights trace back to one side feeling boxed in' },
  { zh: '情绪务实，很少无病呻吟，难过也想着先解决问题', en: 'Pragmatic even when upset — the instinct is to fix, not to dwell' },
  { zh: '情绪独立，就算在一起也各自保留一块私人领地', en: "Emotionally self-sufficient — each keeps a private corner even while together" },
  { zh: '情绪敏感，很容易被对方一个小动作影响一整天', en: "Sensitive enough that one small gesture can color the whole day" },
];

/**
 * @param {number} sunLon composite Sun longitude at the time-midpoint JD
 * @param {number} moonLon composite Moon longitude at the time-midpoint JD
 */
export function davisonReading(sunLon, moonLon) {
  const sunSign = signOf(sunLon), moonSign = signOf(moonLon);
  return {
    sunSign, moonSign,
    text: {
      zh: `${COMPOSITE_SUN[sunSign].zh}；${COMPOSITE_MOON[moonSign].zh}。`,
      en: `${COMPOSITE_SUN[sunSign].en}; ${COMPOSITE_MOON[moonSign].en}.`,
    },
  };
}
