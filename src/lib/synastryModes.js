/* ============================================================
   SYNASTRY MODES (U2, Urgent.md) — two additions to the synastry stack:

   1. relationshipScores(): ONE pair of charts, FIVE relationship lenses
      (朋友/同事/暧昧对象/情侣/夫妻). Same underlying signals — the bazi
      base + five-domain pillars (horoscopeEngine.synastry) and the cross
      aspects (synastryAstro.crossAspects) — reweighted per relationship
      type. No new divination is invented; only the mix changes, which is
      exactly how a human reader would answer "as colleagues? as spouses?"
      differently from one chart pair.

   2. synastryZiwei(): the ziwei layer of a two-person comparison — the
      relation between the two LIFE PALACE branches (six-harmony/three-
      harmony/clash/punishment/harm, reusing ziping.branchRelations) plus
      a temperament read from the two palaces' major-star groups.

   Pure functions, vitest-covered. Wording law (same as synastryAstro.js):
   friction lines describe a pattern + a coping action, never a verdict.
   ============================================================ */
import { branchRelations } from './ziping.js';
import { BRANCHES } from './bazi.js';
import { ZW_STARS_ZH } from './ziwei.js';

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

// ---- signals out of the cross-aspect list ----------------------------------
// tone: strong (conj/trine on the big pairs), soft (sextile/trine), hard
// (square/opp) — as assigned by synastryAstro.crossAspects.
const pairHas = (aspects, bodyA, bodyB) =>
  aspects.filter((a) => (a.bodyThem === bodyA && a.bodyMe === bodyB) || (a.bodyThem === bodyB && a.bodyMe === bodyA));

function aspectSignal(aspects, bodies, { softW = 12, hardW = -9 } = {}) {
  // 50-centred: each easy aspect among the given body pairs lifts, each hard
  // one drags. Conjunctions count as easy for warmth-type signals — callers
  // that treat conjunction as tension pass their own weights.
  let v = 50;
  for (const [a, b] of bodies) {
    for (const asp of pairHas(aspects, a, b)) {
      if (asp.key === 'square' || asp.key === 'opp') v += hardW;
      else v += softW;
    }
  }
  return clamp(v);
}

/**
 * @param {{base:number, pillars:Array<{id:string,score:number}>}} baziSyn - horoscopeEngine.synastry() output
 * @param {Array} aspects - synastryAstro.crossAspects() output (may be [])
 * @returns five entries, each {key, zh, en, score, line:{zh,en}}
 */
export function relationshipScores(baziSyn, aspects) {
  const pillar = (id) => { const p = (baziSyn.pillars || []).find((x) => x.id === id); return p ? p.score : 50; };
  const base = baziSyn.base ?? 50;

  const comm = aspectSignal(aspects, [['Mercury', 'Mercury'], ['Mercury', 'Sun'], ['Mercury', 'Moon']]);
  const warm = aspectSignal(aspects, [['Moon', 'Moon'], ['Moon', 'Sun'], ['Moon', 'Venus']]);
  const spark = aspectSignal(aspects, [['Venus', 'Mars'], ['Venus', 'Venus'], ['Sun', 'Venus'], ['Mars', 'Mars']], { softW: 14, hardW: 6 }); // friction still sparks for chemistry
  const grind = aspectSignal(aspects, [['Mars', 'Sun'], ['Mars', 'Moon'], ['Mars', 'Mercury']], { softW: 6, hardW: -14 }); // day-to-day friction tolerance

  const defs = [
    { key: 'friend', zh: '朋友', en: 'Friends', score: clamp(0.35 * comm + 0.3 * warm + 0.35 * base) },
    { key: 'colleague', zh: '同事', en: 'Colleagues', score: clamp(0.4 * pillar('career') + 0.3 * comm + 0.3 * grind) },
    { key: 'crush', zh: '暧昧对象', en: 'Sparks', score: clamp(0.45 * spark + 0.3 * warm + 0.25 * pillar('romance')) },
    { key: 'couple', zh: '情侣', en: 'Dating', score: clamp(0.35 * pillar('romance') + 0.3 * spark + 0.35 * warm) },
    { key: 'spouse', zh: '夫妻', en: 'Married', score: clamp(0.4 * pillar('marriage') + 0.3 * base + 0.3 * warm) },
  ];

  const LINES = {
    friend: [
      ['一拍即合的搭子，废话可以聊到天亮', 'Instant-click energy — the 2am-nonsense kind of friendship'],
      ['合得来，偶尔需要一个先开口的人', 'Easy company; someone just has to text first'],
      ['慢热型交情，共同经历是催化剂', 'A slow-burn friendship — shared experiences speed it up'],
      ['频道不完全一致，找对话题再深聊', 'Different wavelengths — find the shared topic first'],
    ],
    colleague: [
      ['分工天然互补，项目搭档首选', 'Naturally complementary at work — first-pick project partners'],
      ['合作顺畅，把节奏差说开就行', 'Smooth collaboration once you sync your pacing'],
      ['能共事，边界和分工要先讲清楚', 'Workable — agree on lanes and boundaries early'],
      ['工作风格差异大，书面沟通能救场', 'Very different work styles — put agreements in writing'],
    ],
    crush: [
      ['火花肉眼可见，气氛不用刻意营造', 'Visible sparks — zero effort needed to set a mood'],
      ['有化学反应，进展取决于谁先松口', 'Real chemistry; progress depends on who blinks first'],
      ['若即若离型引力，节奏别催', "Push-pull gravity — don't rush the tempo"],
      ['更像朋友的引力，暧昧期可能很长', 'Reads more like friendship — the maybe-phase could run long'],
    ],
    couple: [
      ['情绪同频，恋爱体验值天花板', 'Emotionally in-sync — top-shelf dating experience'],
      ['甜得起来，吵架后和好也快', 'Sweet when good, quick to make up after a fight'],
      ['需要磨合，把「我以为」换成「我说了」', 'Needs run-in time — swap "I assumed" for "I said"'],
      ['心动与安稳感来源不同步，多聊期待', 'Butterflies and security come from different places — talk expectations'],
    ],
    spouse: [
      ['过日子型契合，柴米油盐也能过成诗', 'Built-for-daily-life fit — even errands feel easy'],
      ['长跑底盘稳，大事商量着来', 'Stable long-haul base — decide the big things together'],
      ['需要经营，家务与金钱观先对表', 'Takes tending — align on chores and money early'],
      ['生活习惯差异明显，分工清单是好朋友', 'Very different daily rhythms — a chore chart is your friend'],
    ],
  };
  return defs.map((d) => {
    const band = d.score >= 80 ? 0 : d.score >= 65 ? 1 : d.score >= 50 ? 2 : 3;
    const [zh, en] = LINES[d.key][band];
    return { ...d, line: { zh, en } };
  });
}

// ---- ziwei layer ------------------------------------------------------------
// Star temperament groups (classical 北派 groupings, simplified): used only
// to phrase how the two life-palace star sets get along.
const STAR_GROUP = { // index into ZW_STARS_ZH
  0: 'lead', 3: 'lead', 6: 'lead', 12: 'lead', 13: 'lead', // 紫微 武曲 天府 七杀 破军
  2: 'bright', 9: 'bright', 5: 'bright', 8: 'bright',      // 太阳 巨门 廉贞 贪狼
  1: 'soft', 4: 'soft', 7: 'soft', 10: 'soft', 11: 'soft', // 天机 天同 太阴 天相 天梁
};
const GROUP_LINE = {
  'lead+lead': ['两个主心骨，商量着来就是双引擎，抢方向盘就是内耗', 'Two captains — a twin engine when aligned, a tug-of-war when not'],
  'lead+bright': ['一个掌舵一个造势，配合起来声势很足', 'One steers, one amplifies — a loud, effective combination'],
  'lead+soft': ['一刚一柔，节奏由刚者带，情绪由柔者稳', 'Firm meets gentle — one sets the pace, the other keeps the peace'],
  'bright+bright': ['都自带光环，同台需要轮流当主角', 'Two spotlights — take turns being the main character'],
  'bright+soft': ['热闹与安静互补，能量差要互相体谅', 'Loud meets quiet — mind the energy gap kindly'],
  'soft+soft': ['温和同频，默契好但都需要人推一把', 'Gently in-tune — great rapport, both may need a push to act'],
};
const groupOfPalace = (stars) => {
  if (!stars.length) return 'soft'; // empty palace borrows the quiet read
  const counts = { lead: 0, bright: 0, soft: 0 };
  for (const s of stars) counts[STAR_GROUP[s] || 'soft']++;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
};

// life-palace branch relation → score + phrasing
const REL_SCORE = { liuhe: [88, '六合', 'six-harmony'], sanhe: [84, '三合', 'three-harmony'], banhe: [76, '半合', 'half-harmony'], same: [72, '同宫', 'same palace'], none: [60, '无明显关系', 'no marked relation'], hai: [48, '相害', 'harm'], xing: [44, '相刑', 'punishment'], chong: [40, '相冲', 'clash'] };

/**
 * @param {{ming:number, palaces:Array<{stars:number[]}>}} zA - computeZiwei() for person A
 * @param {{ming:number, palaces:Array<{stars:number[]}>}} zB
 */
export function synastryZiwei(zA, zB) {
  const bA = zA.ming, bB = zB.ming;
  let relKey = 'none';
  if (bA === bB) relKey = 'same';
  else {
    const rels = branchRelations([bA, bB]);
    // priority: harmony first, then the frictions (a pair can carry both —
    // e.g. 子丑 is both 六合 and part of a 刑 cycle; harmony leads the read)
    for (const want of ['liuhe', 'sanhe', 'banhe', 'chong', 'xing', 'hai']) {
      if (rels.some((r) => r.type === want)) { relKey = want; break; }
    }
  }
  const [score, relZh, relEn] = REL_SCORE[relKey];
  const gA = groupOfPalace(zA.palaces[bA].stars), gB = groupOfPalace(zB.palaces[bB].stars);
  const gKey = GROUP_LINE[`${gA}+${gB}`] ? `${gA}+${gB}` : `${gB}+${gA}`;
  const [tempZh, tempEn] = GROUP_LINE[gKey];
  const starsZh = (z, b) => z.palaces[b].stars.map((s) => ZW_STARS_ZH[s]).join('') || '空宫';
  return {
    relKey, score,
    mingA: { branch: BRANCHES[bA], stars: starsZh(zA, bA) },
    mingB: { branch: BRANCHES[bB], stars: starsZh(zB, bB) },
    relation: { zh: `命宫${BRANCHES[bA]}×${BRANCHES[bB]} · ${relZh}`, en: `Life palaces ${BRANCHES[bA]}×${BRANCHES[bB]} · ${relEn}` },
    temperament: { zh: tempZh, en: tempEn },
  };
}
