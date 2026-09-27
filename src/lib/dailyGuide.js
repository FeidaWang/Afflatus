/* ============================================================
   DAILY GUIDE (今日六事) — one fused daily reading across six life areas:
   爱情 love · 婚姻 partnership · 亲情 family · 友情 friends · 事业 career ·
   财富 wealth.

   Every point on every score comes from a named, real calendrical or
   astronomical fact for that date — there is NO random component in the
   numbers (a seeded pick only chooses which phrasing of the advice to
   show). Each domain returns its "receipts" (依据) so the page can show
   exactly why. Sources, with the weight each can contribute:

   1. 子平 · 流日 (strongest channel)
      - today's stem as a ten god of your day master → domain (±2…6)
      - today's element vs your 用神/喜神 (+) or 忌神/仇神 (−) → all (±4)
      - today's branch vs natal day branch (夫妻宫), year, month, hour
        branches: 六合/三合 (+) vs 冲/刑/害 (−) (±2…8)
      - today's branch hitting your 桃花 / 红鸾 / 天喜 / 驿马 / 天乙贵人 /
        禄 / 羊刃 (±3…6)
   2. 黄历: 建除十二神 & 黄黑道 (±1…3), 值日二十八宿 吉/凶 (±1)
   3. 宿曜道 (27 宿): today's mansion relative to your natal mansion —
      栄/親/友/安/成 lift, 衰/壊 dip, 命/業/胎 are "turning point" days (±2…4)
   4. 紫微斗数 流日四化: today's stem transforms four stars; where those
      stars sit in YOUR natal palaces decides which area lights up (±3…5).
      Needs the birth hour.
   5. Western transits (optional, passed in): today's Sun…Saturn, Juno and
      Node aspecting your natal Sun/Moon/Venus/Mars/Juno/ASC/MC within
      tight orbs, plus the transiting Moon's natal house (±2…5).
   6. 生肖: today clashes / combines your year branch (±2).
   Scores = clamp(50 + Σ points, 12, 96). Weights are this site's house
   rules (stated on the page), not a classical standard.

   DESIGN LAW (shared with starDraw.js): advice is an ACTION, never a doom
   prediction; low days read as "slow down / tend it", never as 凶.
   ENTERTAINMENT ONLY.
   ============================================================ */
import { computeBazi, dayPillar, STEMS, BRANCHES, STEM_ELEMENT, ELEMENTS_ZH, ELEMENTS_EN, ANIMALS_ZH, ANIMALS_EN, pillarName } from './bazi.js';
import { tenGodOfStem, TEN_GOD_ZH, TEN_GOD_EN, SANHE_GROUPS, LU_BY_STEM, YIMA_BY_GROUP } from './ziping.js';
import { strength, geju, yongshen, branchPairType } from './baziPro.js';
import { almanac } from './almanac.js';
import { dailyXiu, XIU28_ZH, natalXiu, XIU27_ZH } from './xiu.js';
import { solarToLunar } from './lunar.js';
import { computeZiwei } from './ziwei.js';
import { computeZiweiDeep, SIHUA_BY_STEM } from './ziweiDeep.js';

const mod = (n, m) => ((n % m) + m) % m;
export const DOMAINS = ['love', 'marriage', 'family', 'friends', 'career', 'wealth'];
export const DOMAIN_T = {
  love: ['Love', '爱情'], marriage: ['Partnership', '婚姻'], family: ['Family', '亲情'],
  friends: ['Friendship', '友情'], career: ['Career', '事业'], wealth: ['Wealth', '财富'],
};
function strHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// ---- static per-person context --------------------------------------------------
const TAOHUA = { '8,0,4': 9, '2,6,10': 3, '5,9,1': 6, '11,3,7': 0 };
const TIANYI = [[1, 7], [0, 8], [11, 9], [11, 9], [1, 7], [0, 8], [6, 2], [6, 2], [3, 5], [3, 5]];
const YANGREN = { 0: 3, 2: 6, 4: 6, 6: 9, 8: 0 };
const groupKeyOf = (b) => SANHE_GROUPS.find((g) => g.branches.includes(b)).branches.join(',');
// 宿曜 month-start mansions (index into XIU27) — same table as xiu.js natalXiu
const SUYAO_START = [11, 13, 15, 17, 19, 21, 24, 0, 2, 4, 7, 9];
export function suyaoDayMansion(y, m, d) {
  const l = solarToLunar(y, m, d);
  return l ? mod(SUYAO_START[l.lMonth - 1] + l.lDay - 1, 27) : null;
}
const SUYAO_TYPES = ['命', '栄', '衰', '安', '危', '成', '壊', '友', '親'];
export function suyaoDayType(natal, day) {
  const off = mod(day - natal, 27);
  const k = off % 9, period = Math.floor(off / 9);
  return { off, key: k === 0 ? ['命', '業', '胎'][period] : SUYAO_TYPES[k], period: ['命期', '業期', '胎期'][period] };
}

export function buildContext(me) {
  const chart = computeBazi(me);
  const st = strength(chart); const gj = geju(chart, st); const ys = yongshen(chart, st, gj);
  const yb = chart.year.branch, db = chart.day.branch, ds = chart.day.stem;
  const natalBranches = [
    { id: 'day', b: db, w: 1 }, { id: 'year', b: yb, w: 0.6 }, { id: 'month', b: chart.month.branch, w: 0.6 },
    ...(chart.hour ? [{ id: 'hour', b: chart.hour.branch, w: 0.4 }] : []),
  ];
  const stars = {
    taohua: [...new Set([TAOHUA[groupKeyOf(yb)], TAOHUA[groupKeyOf(db)]])],
    hongluan: mod(3 - yb, 12), tianxi: mod(9 - yb, 12),
    yima: [...new Set([YIMA_BY_GROUP[groupKeyOf(yb)], YIMA_BY_GROUP[groupKeyOf(db)]])],
    tianyi: TIANYI[ds], lu: LU_BY_STEM[ds], yangren: YANGREN[ds] ?? null,
  };
  let zw = null;
  if (me.hour != null) {
    const z = computeZiwei(me);
    if (z) {
      const deep = computeZiweiDeep(z, me.gender);
      const palaceOfStar = {};
      deep.palaces.forEach((p) => p.stars.forEach((s) => { palaceOfStar[s.name] = p.name; }));
      zw = { z, palaceOfStar };
    }
  }
  const lunar = solarToLunar(me.y, me.m, me.d);
  const natalSuyao = lunar ? natalXiu(lunar.lMonth, lunar.lDay) : null;
  return { me, chart, strength: st, geju: gj, yong: ys, natalBranches, stars, zw, natalSuyao };
}

// ---- tables mapping signals to domains ------------------------------------------
// ten god of today's stem → points per domain (gender-aware spouse stars)
function tenGodPoints(god, gender) {
  const p = {};
  const add = (k, v) => { p[k] = (p[k] || 0) + v; };
  switch (god) {
    case 0: add('friends', 5); add('wealth', -2); break;
    case 1: add('friends', 3); add('wealth', -4); add('love', -1); break;
    case 2: add('love', 4); add('friends', 3); add('wealth', 2); break;
    case 3: add('love', 3); add('career', -4); if (gender === 'F') add('marriage', -3); break;
    case 4: add('wealth', 6); if (gender === 'M') add('love', 4); break;
    case 5: add('wealth', 5); add('family', 1); if (gender === 'M') add('marriage', 5); break;
    case 6: add('career', 3); add('friends', -2); if (gender === 'F') add('love', 4); break;
    case 7: add('career', 6); if (gender === 'F') add('marriage', 5); break;
    case 8: add('family', 1); add('friends', -2); add('career', 1); break;
    case 9: add('family', 6); add('career', 2); break;
    default: break;
  }
  return p;
}
const PILLAR_DOMAINS = { day: ['marriage', 'love'], year: ['family', 'friends'], month: ['family', 'career'], hour: ['family'] };
const PILLAR_T = { day: ['your spouse palace (day branch)', '夫妻宫（日支）'], year: ['your year branch', '年支'], month: ['your month branch', '月支'], hour: ['your hour branch', '时支'] };
const REL_PTS = { liuhe: 6, sanhe: 4, same: 1, none: 0, po: -2, hai: -3, xing: -4, chong: -6 };
const REL_T = { liuhe: ['six-harmony with', '六合'], sanhe: ['triad-harmony with', '三合'], chong: ['clashes with', '相冲'], xing: ['punishes', '相刑'], hai: ['harms', '相害'], po: ['breaks', '相破'], same: ['repeats', '伏吟'] };
const PALACE_DOMAINS = {
  命宫: ['career', 'love', 'friends', 'family', 'marriage', 'wealth'], 夫妻: ['marriage', 'love'], 财帛: ['wealth'], 官禄: ['career'],
  田宅: ['family', 'wealth'], 父母: ['family'], 兄弟: ['friends', 'family'], 仆役: ['friends'], 子女: ['love', 'family'],
  迁移: ['career', 'friends'], 福德: ['love', 'wealth'], 疾厄: [],
};
const HUA_PTS = { lu: 5, quan: 3, ke: 3, ji: -5 };
const HUA_T = { lu: ['Lu (flow)', '化禄'], quan: ['Quan (drive)', '化权'], ke: ['Ke (grace)', '化科'], ji: ['Ji (snag)', '化忌'] };
const SUYAO_PTS = {
  栄: { career: 3, wealth: 3, love: 2 }, 親: { family: 4, friends: 3 }, 友: { friends: 4, love: 1 }, 安: { family: 3, marriage: 2 },
  成: { career: 4, wealth: 1 }, 危: { friends: 2, wealth: -2 }, 衰: { career: -2, wealth: -2, love: -1 }, 壊: { career: -3, love: -2, marriage: -2 },
  命: {}, 業: {}, 胎: {},
};
const SUYAO_EN = { 命: 'Destiny', 業: 'Karma', 胎: 'Origin', 栄: 'Flourish', 衰: 'Wane', 安: 'Calm', 危: 'Edge', 成: 'Achieve', 壊: 'Break', 友: 'Friend', 親: 'Kin' };
// western: transiting body × natal point → domains
const TR_MAP = {
  Venus: { Sun: ['love'], Moon: ['love', 'family'], Venus: ['love', 'wealth'], Mars: ['love'], ASC: ['love', 'friends'], Juno: ['marriage'], MC: ['career'] },
  Mars: { Venus: ['love'], Sun: ['career'], MC: ['career'], Mars: ['career'], Moon: ['family'] },
  Sun: { Sun: ['career'], MC: ['career'], Moon: ['family'], Venus: ['love'], Juno: ['marriage'], ASC: ['friends'] },
  Moon: { Moon: ['family'], Sun: ['family'], Venus: ['love'], Juno: ['marriage'] },
  Mercury: { Sun: ['friends', 'career'], Mercury: ['friends'], Moon: ['family'], MC: ['career'] },
  Jupiter: { Sun: ['career', 'wealth'], Venus: ['wealth', 'love'], Moon: ['family'], MC: ['career'], Juno: ['marriage'], ASC: ['friends'] },
  Saturn: { Sun: ['career'], Moon: ['family'], Venus: ['love', 'marriage'], MC: ['career'], Juno: ['marriage'] },
  Juno: { Sun: ['marriage'], Moon: ['marriage'], Venus: ['marriage', 'love'], ASC: ['marriage'] },
  Node: { Sun: ['career'], Moon: ['family'], Venus: ['love'] },
};
const BENEFIC = new Set(['Venus', 'Jupiter', 'Sun', 'Moon', 'Juno', 'Mercury', 'Node']);
const MOON_HOUSE = { 5: ['love'], 7: ['marriage', 'love'], 4: ['family'], 11: ['friends'], 3: ['friends'], 10: ['career'], 6: ['career'], 2: ['wealth'], 8: ['wealth'] };
const BODY_ZH = { Sun: '太阳', Moon: '月亮', Mercury: '水星', Venus: '金星', Mars: '火星', Jupiter: '木星', Saturn: '土星', Juno: '婚神星', Node: '北交点', ASC: '上升', MC: '天顶' };

// ---- advice banks (actions, never verdicts) -------------------------------------
const ADVICE = {
  love: {
    up: [['Say the warm thing out loud today — it lands.', '今天把心里的好感说出口，对方接得住。'], ['Suggest a plan instead of waiting to be asked.', '别等对方开口，主动提一个约会计划。'], ['Wear something that makes you feel like yourself; attraction follows ease.', '穿让自己最自在的那一身，吸引力来自松弛。']],
    flat: [['Keep it light: one small check-in beats a long talk.', '保持轻松：一句问候胜过一场长谈。'], ['Listen for what they did not say.', '多听对方没说出口的部分。']],
    down: [['Not a day for big declarations — tend the small things.', '不宜重大表白，把小事照顾好就好。'], ['If a message stings, wait an hour before replying.', '收到扎心的话，先等一小时再回。']],
  },
  marriage: {
    up: [['A good day to talk about the next shared plan.', '适合聊聊下一个共同计划。'], ['Do one chore they usually do, unasked.', '主动做一件平时是对方做的家务。'], ['Commitments made today tend to stick.', '今天做出的约定更容易兑现。']],
    flat: [['Routine is the relationship today; keep it kind.', '今天的相处就是日常，温和就好。'], ['Share a meal without screens.', '一起吃顿不看手机的饭。']],
    down: [['Park the hard topic for another day.', '难谈的话题先放一放。'], ['Assume good intent before you react.', '先假设对方是好意，再回应。']],
  },
  family: {
    up: [['Call an elder — they will remember it.', '给长辈打个电话，他们会记很久。'], ['Plan a small family moment this week.', '这周安排一个小小的家庭时刻。']],
    flat: [['A quick message in the family chat goes far.', '在家庭群里说一句近况就很好。'], ['Tidy one corner of home.', '收拾家里的一个角落。']],
    down: [['Keep advice to yourself unless asked.', '没被问到时，少给建议。'], ['Give family news a day before responding.', '家里的消息，缓一天再回应。']],
  },
  friends: {
    up: [['Reach out first — reunions land well today.', '主动联系老朋友，今天的重逢很顺。'], ['Say yes to the group plan.', '答应那个聚会邀约吧。'], ['Introduce two people who should know each other.', '介绍两个应该认识的朋友。']],
    flat: [['A one-to-one chat beats a crowd today.', '今天一对一聊天比热闹聚会更好。'], ['Reply to the message you have been putting off.', '回复那条一直拖着的消息。']],
    down: [['Keep money and favours separate from friendship today.', '今天别把钱和人情混在友情里。'], ['Skip the group debate.', '群里的争论，今天不参与。']],
  },
  career: {
    up: [['Put your best idea in front of a decision-maker.', '把最好的想法递到能拍板的人面前。'], ['Ask for the responsibility you want.', '主动争取你想要的那份责任。'], ['Close an open loop before lunch.', '午饭前收掉一件悬而未决的事。']],
    flat: [['Sharpen, don\'t chop: prep beats pushing today.', '今天磨刀胜过砍柴，准备重于推进。'], ['Batch the small tasks and protect one deep-work hour.', '把琐事打包处理，护住一小时专注时间。']],
    down: [['Read documents twice; send once.', '文件读两遍，再发出去。'], ['Let others go first in meetings today.', '今天会上让别人先出牌。']],
  },
  wealth: {
    up: [['Good day to review, invoice or negotiate — quote the number.', '适合对账、开票、谈价——该报的价今天报。'], ['Move one savings goal forward.', '把一个储蓄目标往前推一步。']],
    flat: [['Study before you spend; add it to a list first.', '先研究再花钱，想买的先放进清单。'], ['Check one subscription you forgot about.', '检查一个被遗忘的订阅扣费。']],
    down: [['Delay the big purchase 48 hours.', '大额支出延后 48 小时。'], ['No lending or guaranteeing today.', '今天不借钱、不担保。']],
  },
};
// light 16-type personalisation (never changes a score)
const TYPE_TIP = {
  I: ['(Your way: a thoughtful message beats a crowded room.)', '（适合你的方式：一条用心的消息，胜过人多的场合。）'],
  E: ['(Your way: say it in person — your energy carries it.)', '（适合你的方式：当面说，你的热情会帮你加分。）'],
  T: ['(Frame it as a plan with one clear next step.)', '（把它变成一个有明确下一步的计划。）'],
  F: ['(Lead with how it feels, then the details.)', '（先说感受，再说细节。）'],
};

const tone = (s) => (s >= 64 ? 'up' : s >= 46 ? 'flat' : 'down');
const clamp = (x) => Math.max(12, Math.min(96, Math.round(x)));

/**
 * @param ctx      buildContext(me)
 * @param dateStr  'YYYY-MM-DD' (the civil day being read)
 * @param western  optional { aspects:[{a,b,key,orb,tone}], moonHouse } from westernPro.transits
 * @param persona  optional 4-letter type
 */
export function dailyGuide(ctx, dateStr, { western = null, persona = null } = {}) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const { chart, me } = ctx;
  const today = dayPillar(y, m, d);
  const receipts = Object.fromEntries(DOMAINS.map((k) => [k, []]));
  const add = (dom, pts, src, en, zh) => { if (pts) receipts[dom].push({ pts, src, en, zh }); };
  const addAll = (pts, src, en, zh) => DOMAINS.forEach((k) => add(k, pts, src, en, zh));

  // 1. 子平 流日
  const god = tenGodOfStem(chart.day.stem, today.stem);
  for (const [k, v] of Object.entries(tenGodPoints(god, me.gender))) {
    add(k, v, 'bazi', `Today's stem ${STEMS[today.stem]} is your ${TEN_GOD_EN[god]}`, `今日天干${STEMS[today.stem]}为你的${TEN_GOD_ZH[god]}`);
  }
  const tEl = STEM_ELEMENT[today.stem];
  if (ctx.yong.favorable.includes(tEl)) addAll(3, 'bazi', `Today's ${ELEMENTS_EN[tEl]} is one of your helpful elements`, `今日之气${ELEMENTS_ZH[tEl]}为你的喜用`);
  else if (tEl === ctx.yong.ji.el) addAll(-3, 'bazi', `Today's ${ELEMENTS_EN[tEl]} is your least helpful element — go gently`, `今日之气${ELEMENTS_ZH[tEl]}为你的忌神，宜缓`);
  for (const n of ctx.natalBranches) {
    const rel = branchPairType(today.branch, n.b);
    const pts = REL_PTS[rel] ?? 0;
    if (!pts || rel === 'none') continue;
    const [en, zh] = rel === 'xing' && today.branch === n.b ? ['self-punishes with', '自刑'] : (REL_T[rel] || ['relates to', '关联']);
    for (const dom of PILLAR_DOMAINS[n.id]) add(dom, Math.round(pts * n.w), 'bazi', `Today's ${BRANCHES[today.branch]} ${en} ${PILLAR_T[n.id][0]} ${BRANCHES[n.b]}`, `今日${BRANCHES[today.branch]}与${PILLAR_T[n.id][1]}${BRANCHES[n.b]}${zh}`);
  }
  const S = ctx.stars;
  if (S.taohua.includes(today.branch)) add('love', 6, 'bazi', 'Today lands on your Peach Blossom (桃花) branch', `今日逢你的桃花位（${BRANCHES[today.branch]}）`);
  if (today.branch === S.hongluan) { add('love', 4, 'bazi', 'Red Phoenix (红鸾) day', '今日逢红鸾'); add('marriage', 4, 'bazi', 'Red Phoenix (红鸾) day', '今日逢红鸾'); }
  if (today.branch === S.tianxi) { add('marriage', 3, 'bazi', 'Heavenly Joy (天喜) day', '今日逢天喜'); add('family', 2, 'bazi', 'Heavenly Joy (天喜) day', '今日逢天喜'); }
  if (S.yima.includes(today.branch)) add('career', 2, 'bazi', 'Travel Horse (驿马) day — movement favours you', '今日逢驿马，宜动');
  if (S.tianyi.includes(today.branch)) { add('career', 4, 'bazi', 'Heavenly Noble (天乙贵人) day — help arrives', '今日逢天乙贵人，易得助力'); add('friends', 3, 'bazi', 'Heavenly Noble (天乙贵人) day', '今日逢天乙贵人'); }
  if (today.branch === S.lu) add('wealth', 4, 'bazi', 'Your Prosperity (禄) branch today', '今日逢你的禄位');
  if (S.yangren != null && today.branch === S.yangren) { add('wealth', -3, 'bazi', 'Blade (羊刃) day — keep spending tight', '今日逢羊刃，花钱收着点'); add('friends', -2, 'bazi', 'Blade (羊刃) day — soften your tone', '今日逢羊刃，语气放软'); }

  // 2. 黄历
  const alm = almanac(y, m, d);
  const jc = alm.jianchu;
  if (jc.tone) addAll(jc.tone, 'almanac', `${jc.en} (${jc.zh}) day in the almanac`, `黄历${jc.zh}日`);
  if (jc.zh === '成' || jc.zh === '定') add('marriage', 3, 'almanac', `${jc.zh} day: good for commitments`, `${jc.zh}日宜订约`);
  if (jc.zh === '破') add('marriage', -2, 'almanac', 'Break (破) day: not for signing or vows', '破日不宜签约嫁娶');
  if (jc.zh === '开') add('career', 2, 'almanac', 'Open (开) day: good for launching', '开日宜开张求职');
  if (jc.zh === '收' || jc.zh === '满') add('wealth', 2, 'almanac', `${jc.zh} day: good for collecting`, `${jc.zh}日宜纳财`);
  addAll(alm.tianshen.huangdao ? 1 : -1, 'almanac', `${alm.tianshen.en} (${alm.tianshen.zh}) — ${alm.tianshen.huangdao ? 'a bright' : 'a dark'}-path day`, `${alm.tianshen.zh}${alm.tianshen.huangdao ? '黄道' : '黑道'}日`);
  if (alm.chong === chart.year.branch) addAll(-2, 'zodiac', `Today clashes your zodiac (${ANIMALS_EN[chart.year.branch]})`, `今日冲${ANIMALS_ZH[chart.year.branch]}（你的生肖）`);
  else if (branchPairType(today.branch, chart.year.branch) === 'liuhe') addAll(1, 'zodiac', `Today harmonises with your zodiac (${ANIMALS_EN[chart.year.branch]})`, `今日与你的生肖${ANIMALS_ZH[chart.year.branch]}六合`);

  // 值日宿
  const xiu = dailyXiu(y, m, d);
  const XIU_GOOD = new Set([0, 3, 5, 6, 7, 12, 13, 15, 16, 18, 20, 21, 25, 27]);
  const xiuGood = XIU_GOOD.has(xiu);

  // 3. 宿曜
  let suyao = null;
  const dayMansion = suyaoDayMansion(y, m, d);
  if (ctx.natalSuyao != null && dayMansion != null) {
    suyao = { ...suyaoDayType(ctx.natalSuyao, dayMansion), mansion: XIU27_ZH[dayMansion], natal: XIU27_ZH[ctx.natalSuyao] };
    for (const [k, v] of Object.entries(SUYAO_PTS[suyao.key])) add(k, v, 'suyao', `${SUYAO_EN[suyao.key]} (${suyao.key}) day in the 27-mansion calendar`, `宿曜${suyao.key}日（今日${suyao.mansion}宿 / 本命${suyao.natal}宿）`);
  }

  // 4. 紫微 流日四化
  let ziwei = null;
  if (ctx.zw) {
    const sh = SIHUA_BY_STEM[STEMS[today.stem]];
    ziwei = [];
    for (const [k, star] of Object.entries(sh)) {
      const palace = ctx.zw.palaceOfStar[star];
      if (!palace) continue;
      ziwei.push({ hua: k, star, palace });
      for (const dom of PALACE_DOMAINS[palace] || []) {
        const w = palace === '命宫' ? 0.5 : 1;
        add(dom, Math.round(HUA_PTS[k] * w), 'ziwei', `Today's ${HUA_T[k][0]} on ${star} in your ${palace} palace`, `流日${star}${HUA_T[k][1]}，落你的${palace}${palace.endsWith('宫') ? '' : '宫'}`);
      }
    }
  }

  // 5. western transits
  if (western) {
    for (const asp of western.aspects || []) {
      const doms = TR_MAP[asp.a]?.[asp.b];
      if (!doms) continue;
      const lim = asp.a === 'Moon' ? 4 : ['Sun', 'Mercury', 'Venus', 'Mars'].includes(asp.a) ? 2 : 1.5;
      if (asp.orb > lim) continue;
      let v = asp.tone > 0 ? 1 : asp.tone < 0 ? -1 : (BENEFIC.has(asp.a) ? 1 : -0.5);
      if (asp.tone < 0 && (asp.a === 'Venus' || asp.a === 'Jupiter')) v = -0.3;
      const pts = Math.round(v * (asp.a === 'Moon' ? 3 : 4) * (1 - asp.orb / (lim * 2)));
      for (const dom of doms) add(dom, pts, 'western', `Transiting ${asp.a} ${asp.en} your natal ${asp.b} (orb ${asp.orb.toFixed(1)}°)`, `行运${BODY_ZH[asp.a]}${asp.zh}你的本命${BODY_ZH[asp.b] || asp.b}（容许度 ${asp.orb.toFixed(1)}°）`);
    }
    if (western.moonHouse && MOON_HOUSE[western.moonHouse]) {
      for (const dom of MOON_HOUSE[western.moonHouse]) add(dom, 3, 'western', `The Moon moves through your ${western.moonHouse}th house today`, `今日月亮行经你的第 ${western.moonHouse} 宫`);
    }
  }

  // scores
  const rndPick = (k, n) => strHash(`${dateStr}|${k}|${me.y}-${me.m}-${me.d}-${me.hour ?? 'x'}`) % n;
  const letters = persona && /^[EI][SN][TF][JP]$/.test(persona) ? persona : null;
  const domains = DOMAINS.map((k) => {
    const sum = receipts[k].reduce((s, r) => s + r.pts, 0) + (xiuGood ? 1 : -1);
    const score = clamp(50 + 1.25 * sum);
    const t = tone(score);
    const bank = ADVICE[k][t];
    const [en, zh] = bank[rndPick(k, bank.length)];
    const sorted = receipts[k].slice().sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts));
    return { id: k, score, tone: t, en, zh, tip: null, receipts: sorted };
  });
  // one 16-type tip per day, on the day's strongest area (flavour only)
  if (letters) {
    const top = domains.slice().sort((a, b) => b.score - a.score)[0];
    const key = ['friends', 'love', 'family'].includes(top.id) ? letters[0] : letters[2];
    top.tip = { en: TYPE_TIP[key][0], zh: TYPE_TIP[key][1], type: letters };
  }
  const overall = clamp(domains.reduce((s, x) => s + x.score, 0) / domains.length + (xiuGood ? 1 : -1));
  const best = domains.slice().sort((a, b) => b.score - a.score)[0];
  // lucky hours: branches that host your 天乙贵人 or 六合 your day branch
  const luckyHours = [...new Set([...S.tianyi, mod(13 - chart.day.branch, 12)])].sort((a, b) => a - b)
    .map((b) => ({ branch: BRANCHES[b], range: `${String(mod(b * 2 - 1, 24)).padStart(2, '0')}:00–${String(mod(b * 2 + 1, 24)).padStart(2, '0')}:00` }));
  return {
    date: dateStr, dayPillar: pillarName(today), god: { zh: TEN_GOD_ZH[god], en: TEN_GOD_EN[god] },
    almanac: alm, xiu: { name: XIU28_ZH[xiu], good: xiuGood }, suyao, ziwei,
    domains, overall, best, luckyHours, westernUsed: !!western,
  };
}
