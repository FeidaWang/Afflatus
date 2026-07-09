/* ============================================================
   ASTRO READINGS — V23 Phase 1 (roadmap §7.10 module 1). L1
   personality tags + L2 five-dimension (爱情/事业/沟通/能量/成长)
   scores and blurbs. Built ONLY from Sun/Moon/Ascendant signs +
   the existing bazi five-element tally — no planets, no
   astronomy-engine import, so this file stays in the lightweight
   L1/L2 bundle per the roadmap's dynamic-import discipline
   (Mercury..Pluto are an L3-only dependency, see astroPlanets.ts).

   Pure, deterministic, bilingual fragment banks — same house
   style as horoscopeEngine.js.

   DESIGN LAW (roadmap module 1, stated twice): L1/L2 carry zero
   astrological jargon. No "square"/"house cusp"/"triplicity"
   wording in any zh/en string this file returns.
   ============================================================ */
import { ZODIAC_ZH, ZODIAC_EN, ZODIAC_TRIPLICITY } from './bazi.js';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// ---- per-sign trait phrases (index 0=Aries..11=Pisces) --------------------
const SUN_TRAIT = [
  { zh: '冲动直率', en: 'impulsive and blunt' }, { zh: '慢热踏实', en: 'slow-warming and grounded' },
  { zh: '话多点子多', en: 'chatty and idea-a-minute' }, { zh: '温柔顾家', en: 'gentle and home-oriented' },
  { zh: '自带主角光环', en: 'main-character energy' }, { zh: '挑剔较真', en: 'exacting and detail-picky' },
  { zh: '优雅社交', en: 'graceful and social' }, { zh: '神秘高冷', en: 'mysterious and aloof' },
  { zh: '自由不羁', en: 'free-roaming and untamed' }, { zh: '沉稳务实', en: 'steady and pragmatic' },
  { zh: '特立独行', en: 'independently odd (affectionately)' }, { zh: '感性梦幻', en: 'dreamy and tender-hearted' },
];
const MOON_NEED = [
  { zh: '需要新鲜感和冲刺感才安心', en: 'needs a rush of newness to feel safe' },
  { zh: '需要稳定的生活节奏才踏实', en: 'needs a steady rhythm to feel settled' },
  { zh: '需要有人陪TA把话说完', en: 'needs someone willing to hear the whole ramble' },
  { zh: '需要被记得、被惦记才安心', en: 'needs to feel remembered to feel secure' },
  { zh: '需要被看见和赞美才发光', en: 'needs to be seen and admired to shine' },
  { zh: '需要一切在掌控之中才放松', en: 'needs things in order before it can relax' },
  { zh: '需要和谐不吵架的关系才舒服', en: 'needs harmony — conflict genuinely drains it' },
  { zh: '需要绝对的信任和深度连接', en: 'needs deep, absolute trust to open up' },
  { zh: '需要留一扇随时能出走的门', en: 'needs an exit left open, even unused' },
  { zh: '需要看到实际的安全感证据', en: 'needs tangible proof of security' },
  { zh: '需要空间做自己，别管太紧', en: 'needs room to be odd without being managed' },
  { zh: '需要被温柔以待，情绪敏感', en: 'needs gentle handling — feelings run deep' },
];
const ASC_FIRST_IMPRESSION = [
  { zh: '雷厉风行，自带冲锋感', en: 'walks in like the meeting already started' },
  { zh: '慢热但让人安心', en: 'slow to open up, but instantly reassuring' },
  { zh: '自来熟，社交牛人本人', en: 'instantly chatty, a natural mingler' },
  { zh: '亲和力拉满，让人想靠近', en: 'warm enough that strangers lean in' },
  { zh: '气场很足，很难不被注意', en: 'hard to not notice in a room' },
  { zh: '干净利落，专业感很重', en: 'crisp and put-together, reads as competent' },
  { zh: '好看好相处，社交万能钥匙', en: 'easy on the eyes, easy to talk to' },
  { zh: '眼神很深，让人猜不透', en: "a gaze people can't quite read" },
  { zh: '自带松弛感，像刚旅行回来', en: 'radiates ease, like it just got back from a trip' },
  { zh: '一本正经，像随时在开会', en: "perpetually composed, like it's always mid-meeting" },
  { zh: '气质特别，一眼记住', en: 'distinct enough to remember on sight' },
  { zh: '眼神温软，让人卸下防备', en: 'soft-eyed enough to disarm people on contact' },
];
const ELEMENT_FLAVOR = [ // wood, fire, earth, metal, water (bazi.js ELEMENTS order)
  { zh: '五行木最旺，遇事先长个心眼，讲究稳步生长', en: 'Wood dominates — you grow ideas patiently before acting' },
  { zh: '五行火最旺，遇事先冲，热闹是你的舒适区', en: 'Fire dominates — you lead with heat, a little chaos feels like home' },
  { zh: '五行土最旺，遇事先稳，靠谱是刻在骨子里的', en: "Earth dominates — steadiness isn't a choice, it's just how you're built" },
  { zh: '五行金最旺，遇事先理，逻辑清楚才肯松手', en: "Metal dominates — you sort things into order before you'll let them go" },
  { zh: '五行水最旺，遇事先感受，情绪雷达比谁都灵敏', en: 'Water dominates — you feel a room before you think about it' },
];

/**
 * L1 headline personality tags. 3-5 short bilingual phrases, zero jargon.
 * @param {{sunSign:number, moonSign:number, ascSign?:number|null, elements?:number[]|null}} input
 *   signs are 0=Aries..11=Pisces (astro.js signOf()); elements is the bazi
 *   five-element tally [wood,fire,earth,metal,water] counts, optional.
 * @returns {Array<{key:string, zh:string, en:string}>}
 */
export function personalityTags({ sunSign, moonSign, ascSign = null, elements = null }) {
  const tags = [
    {
      key: 'surface-inner',
      zh: `表面${SUN_TRAIT[sunSign].zh}，${ZODIAC_ZH[moonSign]}座月亮${MOON_NEED[moonSign].zh}`,
      en: `${SUN_TRAIT[sunSign].en} on the surface — a ${ZODIAC_EN[moonSign]} moon underneath that ${MOON_NEED[moonSign].en}`,
    },
    {
      key: 'moon-need',
      zh: `情绪引擎是${ZODIAC_ZH[moonSign]}座：${MOON_NEED[moonSign].zh}`,
      en: `Emotional engine: ${ZODIAC_EN[moonSign]} — ${MOON_NEED[moonSign].en}`,
    },
  ];
  if (ascSign != null) {
    tags.push({
      key: 'first-impression',
      zh: `上升${ZODIAC_ZH[ascSign]}，见面第一眼：${ASC_FIRST_IMPRESSION[ascSign].zh}`,
      en: `${ZODIAC_EN[ascSign]} rising — first impression: ${ASC_FIRST_IMPRESSION[ascSign].en}`,
    });
  }
  if (Array.isArray(elements) && elements.length === 5) {
    const dom = elements.indexOf(Math.max(...elements));
    tags.push({ key: 'element-flavor', zh: ELEMENT_FLAVOR[dom].zh, en: ELEMENT_FLAVOR[dom].en });
  }
  const sunTri = ZODIAC_TRIPLICITY[sunSign], moonTri = ZODIAC_TRIPLICITY[moonSign];
  if (sunTri === moonTri) {
    tags.push({
      key: 'unified',
      zh: '太阳和月亮同一挂——表里如一，情绪藏不住也不想藏',
      en: 'Sun and moon share the same core temperament — what you feel is what you show',
    });
  }
  return tags.slice(0, 5);
}

// ---- L2: five-dimension scoring (爱情/事业/沟通/能量/成长) ------------------
const DIMENSION_ORDER = ['love', 'career', 'communication', 'energy', 'growth'];
const DIMENSION_LABEL = {
  love: { zh: '爱情', en: 'Love' }, career: { zh: '事业', en: 'Career' },
  communication: { zh: '沟通', en: 'Communication' }, energy: { zh: '能量', en: 'Energy' },
  growth: { zh: '成长', en: 'Growth' },
};
// per-triplicity boost, applied at declining weight for sun/moon/rising
const TRI_BOOST = [
  { energy: 18, growth: 6 },          // fire
  { career: 18, love: 6 },            // earth
  { communication: 18, growth: 6 },   // air
  { love: 18, energy: 6 },            // water
];
const ELEM_DIM = ['growth', 'energy', 'career', 'communication', 'love']; // wood,fire,earth,metal,water
const DIMENSION_TEXT = {
  love: {
    high: { zh: '你在关系里主动又坦率，喜欢就说、想靠近就靠近，暧昧期通常很短。', en: 'You move first in relationships — short on ambiguity, long on showing up.' },
    mid: { zh: '你对感情不算急，但真心动了会很专一，只是需要一点时间确认。', en: "You're not rushing, but once you commit you're steady — you just need time to be sure." },
    low: { zh: '你对亲密关系天然带着点距离感，独处比社交更能充电。', en: 'You keep a natural distance in intimacy — solitude recharges you more than company.' },
  },
  career: {
    high: { zh: '目标感很强，能把模糊的想法拆成能执行的步骤，适合扛大项目。', en: 'Strong sense of direction — you turn vague ideas into concrete steps, built for big projects.' },
    mid: { zh: '工作上稳扎稳打，不追风口，但很少掉链子，靠谱是你的名片。', en: "You build steadily rather than chase trends — reliable is your reputation." },
    low: { zh: '比起固定路线，你更适合弹性、能自己定节奏的工作方式。', en: 'A fixed track fits you worse than something flexible you can pace yourself.' },
  },
  communication: {
    high: { zh: '表达欲很强，逻辑清楚又爱聊，是朋友圈里的话题发起人。', en: 'Expressive and logical — the one who starts the conversation, not just joins it.' },
    mid: { zh: '你话不算多，但说出口的话通常都算数，属于慢热型社交。', en: "You don't talk much, but what you say tends to stick — a slow-warm communicator." },
    low: { zh: '比起说，你更习惯用行动表达，文字消息常常一言以蔽之。', en: 'Actions over words — your messages tend to be short and to the point.' },
  },
  energy: {
    high: { zh: '精力旺盛，闲不住，一天排满行程反而比留白更有安全感。', en: "High output, restless in a good way — a packed day feels safer than an empty one." },
    mid: { zh: '你的电量属于「匀速消耗型」，忙一阵要记得留出恢复期。', en: 'Your energy drains at a steady rate — remember to schedule the recovery, not just the sprint.' },
    low: { zh: '你更适合慢节奏，硬撑高强度容易透支，恢复也需要更久。', en: 'You do better at a slower pace — pushing hard drains you fast and takes longer to recover from.' },
  },
  growth: {
    high: { zh: '你天生爱折腾，愿意为了变得更好推翻重来，成长曲线很陡。', en: "You're wired to reinvent — willing to tear it down to build it better, and it shows." },
    mid: { zh: '你的成长是慢慢积累型，不追速成，但很少走回头路。', en: 'Your growth compounds quietly — no shortcuts, but rarely a step backward.' },
    low: { zh: '你更看重稳定而不是折腾，改变通常是被推着走的，不是主动求的。', en: "You value stability over upheaval — change tends to arrive rather than get sought out." },
  },
};
const tierOf = (v) => (v >= 68 ? 'high' : v >= 42 ? 'mid' : 'low');

/**
 * L2 five-dimension scores + ≤80-character blurbs, from Sun/Moon/Ascendant
 * signs and (optionally) the bazi five-element tally.
 * @param {{sunSign:number, moonSign:number, ascSign?:number|null, elements?:number[]|null}} input
 * @returns {Array<{key:string, label:{zh,en}, value:number, text:{zh,en}}>} exactly 5 entries, DIMENSION_ORDER
 */
export function dimensionScores({ sunSign, moonSign, ascSign = null, elements = null }) {
  const dims = { love: 50, career: 50, communication: 50, energy: 50, growth: 50 };
  const applyTri = (sign, weight) => {
    const boost = TRI_BOOST[ZODIAC_TRIPLICITY[sign]];
    for (const k in boost) dims[k] += boost[k] * weight;
  };
  applyTri(sunSign, 1);
  applyTri(moonSign, 0.7);
  if (ascSign != null) applyTri(ascSign, 0.4);
  if (Array.isArray(elements) && elements.length === 5) {
    const total = elements.reduce((a, b) => a + b, 0);
    const avg = total > 0 ? total / 5 : 0;
    elements.forEach((c, i) => { dims[ELEM_DIM[i]] += (c - avg) * 5; });
  }
  for (const k in dims) dims[k] = clamp(Math.round(dims[k]), 5, 96);
  return DIMENSION_ORDER.map((key) => ({
    key, label: DIMENSION_LABEL[key], value: dims[key], text: DIMENSION_TEXT[key][tierOf(dims[key])],
  }));
}
