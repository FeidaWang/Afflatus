/* ============================================================
   DEEP SYNTHESIS (V25 Part 5 §25.5) — the actual "deep integrated
   analysis": five concordance rules (R1-R5) cross-referencing the
   existing Bazi engine (bazi.js/ziping.js/dayun.js/horoscopeEngine.js)
   against the new ZWDS deep layer (ziweiDeep.js). Both systems read the
   same birth instant; synthesis means structured agreement/disagreement,
   never averaging two numbers into mush.

   Concordance principle (§22.4 wording law): agreement SHARPENS the
   copy, disagreement HEDGES it. A crosscurrent never renders as a
   verdict — it names both receipts and offers a coping frame, never a
   directive ("prohibited", "must", "DO NOT"). Pure functions; each
   returns { verdict: 'reinforced'|'crosscurrent', zh, en, receipts }.
   Callers (horoscope.js) supply the already-computed pieces from both
   engines — this module does no recomputation of its own.
   ============================================================ */
import { elementRelation } from './horoscopeEngine.js';

const STRENGTH_ZH = { strong: '身强', weak: '身弱', balanced: '中和' };
const STRENGTH_EN = { strong: 'strong', weak: 'weak', balanced: 'balanced' };
const REL_ZH = { feeds: '印(生我)', same: '比和', drains: '食伤(我生)', prize: '财(我克)', presses: '官杀(克我)' };
const REL_EN = { feeds: 'nourishing (印)', same: 'peer (比和)', drains: 'expressive (食伤)', prize: 'commanding (财)', presses: 'pressing (官杀)' };
const TAISUI_ZH = { zhi: '值太岁', chong: '冲太岁', xing: '刑太岁', hai: '害太岁', po: '破太岁' };
const TAISUI_EN = { zhi: 'year-lord return', chong: 'year-lord clash', xing: 'year-lord punishment', hai: 'year-lord harm', po: 'year-lord break' };
const WUXING_TO_IDX = { Wood: 0, Fire: 1, Earth: 2, Metal: 3, Water: 4 };

// ---- R1: 身强/身弱 (ziPingAnalysis) × 命宫 三方四正 score -------------------
export function synthesizeR1(ziPing, mingGongScore) {
  const baziStrong = ziPing.strength === 'strong', baziWeak = ziPing.strength === 'weak';
  const gongStrong = mingGongScore >= 60, gongWeak = mingGongScore < 40;
  const sameDirection = (baziStrong && gongStrong) || (baziWeak && gongWeak) || (!baziStrong && !baziWeak && !gongStrong && !gongWeak);
  const receipts = [
    { zh: `八字：${STRENGTH_ZH[ziPing.strength]}`, en: `Bazi: ${STRENGTH_EN[ziPing.strength]}` },
    { zh: `命宫三方四正评分：${mingGongScore}/100`, en: `Life-palace 三方四正 score: ${mingGongScore}/100` },
  ];
  if (sameDirection) {
    return {
      verdict: 'reinforced', receipts,
      zh: '八字身强弱与命宫气数走向一致——两套系统指向同一种自我掌控节奏。',
      en: 'Bazi strength and the life palace\'s reading point the same direction — both systems agree on how much you\'re steering versus being steered.',
    };
  }
  return {
    verdict: 'crosscurrent', receipts,
    zh: '八字身强弱与命宫气数走向不一致——一套系统偏强、另一套偏弱，宜两边参照，不宜只信一头。',
    en: 'Bazi strength and the life palace pull in different directions — one system reads strong, the other doesn\'t. Worth weighing both rather than trusting either alone.',
  };
}

// ---- R2: 用神 element (ziPingAnalysis.favorable) × 命宫主星 wuXing --------
export function synthesizeR2(ziPing, mingGongWuXingList) {
  const favIdxs = ziPing.favorable.map((f) => f.el);
  const gongIdxs = mingGongWuXingList.map((w) => WUXING_TO_IDX[w]).filter((i) => i != null);
  const receipts = [
    { zh: `用神：${ziPing.favorable.map((f) => f.zh).join('/')}`, en: `Favorable elements: ${ziPing.favorable.map((f) => f.en).join('/')}` },
    { zh: `命宫主星五行：${mingGongWuXingList.join('/') || '（命宫无主星，借对宫看）'}`, en: `Life-palace major-star elements: ${mingGongWuXingList.join('/') || '(no major star here — borrowed from the opposite palace)'}` },
  ];
  if (gongIdxs.length === 0) {
    return { verdict: 'reinforced', receipts, zh: '命宫无主星，此层暂无对照——以命宫三方四正评分为准。', en: 'No major star sits in the life palace — nothing to cross-reference here; the 三方四正 score stands on its own.' };
  }
  const amplifier = gongIdxs.some((g) => favIdxs.includes(g));
  if (amplifier) {
    return { verdict: 'reinforced', receipts, zh: '命宫主星五行与八字用神相合——命盘的两套系统在这一点上互相加持。', en: 'The life palace\'s major-star element matches your bazi\'s favorable element — an amplifying signal across both systems.' };
  }
  return { verdict: 'crosscurrent', receipts, zh: '命宫主星五行与八字用神不合——两套系统在喜用上各说各话，宜留意哪一层更贴近近况。', en: 'The life palace\'s major-star element doesn\'t match your bazi\'s favorable element — the two systems diverge here; notice which one feels closer to how things actually read lately.' };
}

// ---- R3: current 大运 pillar (element vs day master) × current 大限 score -
export function synthesizeR3(dayMasterElement, dayunBranchElement, daXianScore) {
  const rel = elementRelation(dayMasterElement, dayunBranchElement);
  const dayunFavorable = rel === 'feeds' || rel === 'prize', dayunAdverse = rel === 'presses';
  const gongFavorable = daXianScore >= 60, gongAdverse = daXianScore < 40;
  const receipts = [
    { zh: `大运五行关系：${REL_ZH[rel]}`, en: `Decade (大运) element relation: ${REL_EN[rel]}` },
    { zh: `大限三方四正评分：${daXianScore}/100`, en: `Da Xian (大限) 三方四正 score: ${daXianScore}/100` },
  ];
  if (dayunFavorable && gongFavorable) {
    return { verdict: 'reinforced', receipts, zh: '大运与大限这十年同声看好——两套系统都读到顺风期。', en: 'Dayun and Da Xian both read this decade as favorable — the two systems agree on a tailwind.' };
  }
  if (dayunAdverse && gongAdverse) {
    return { verdict: 'reinforced', receipts, zh: '大运与大限这十年同声偏紧——两套系统都读到需要收着走的阶段。', en: 'Dayun and Da Xian both read this decade as tight — the two systems agree it\'s a stretch to move carefully through.' };
  }
  return { verdict: 'crosscurrent', receipts, zh: '大运与大限这十年读法不一——一套顺、一套紧，实际感受可能是喜忧参半的十年。', en: 'Dayun and Da Xian disagree on this decade — one reads easy, the other tight. The lived decade may genuinely be a mixed one.' };
}

// ---- R4: 流年 犯太岁 (taisuiRelation) × 流年宫 score/化忌 --------------------
export function synthesizeR4(taisuiTags, liunianScore, liunianHuaJiActive) {
  const hasTaisuiHit = taisuiTags.some((t) => t !== 'zhi'); // 值太岁 alone reads milder than chong/xing/hai/po
  const gongHit = liunianHuaJiActive || liunianScore < 40;
  const receipts = [
    { zh: `犯太岁标记：${taisuiTags.length ? taisuiTags.map((t) => TAISUI_ZH[t]).join('、') : '无'}`, en: `Year-lord tags: ${taisuiTags.length ? taisuiTags.map((t) => TAISUI_EN[t]).join(', ') : 'none'}` },
    { zh: `流年宫评分：${liunianScore}/100${liunianHuaJiActive ? '（对宫化忌冲入）' : ''}`, en: `Liunian palace score: ${liunianScore}/100${liunianHuaJiActive ? ' (化忌 clashing in from the opposing palace)' : ''}` },
  ];
  if (hasTaisuiHit && gongHit) {
    return { verdict: 'reinforced', receipts, zh: '犯太岁与流年宫双重命中——两套系统都指向今年宜谨慎行事、少做重大决定。', en: 'Both the year-lord clash and the liunian palace read caution this year — worth being deliberate rather than impulsive with big decisions.' };
  }
  if (hasTaisuiHit || gongHit) {
    return { verdict: 'crosscurrent', receipts, zh: '仅一套系统读到今年偏紧——另一套没有特别信号，程度上不必过度紧张。', en: 'Only one of the two systems flags this year — the other shows nothing unusual, so treat it as a mild note rather than a loud alarm.' };
  }
  return { verdict: 'reinforced', receipts, zh: '今年既未犯太岁，流年宫也未见明显冲忌——以流年宫本身评分为准。', en: 'No year-lord clash and nothing unusual in the liunian palace — this year\'s score can be read at face value.' };
}

// ---- R5: daily v2 relation (dailyFortune) × today's branch-palace score --
export function synthesizeR5(dailyRelation, todayPalaceScore) {
  const dailyFavorable = dailyRelation === 'feeds' || dailyRelation === 'prize', dailyAdverse = dailyRelation === 'presses';
  const gongFavorable = todayPalaceScore >= 60, gongAdverse = todayPalaceScore < 40;
  const agree = (dailyFavorable && gongFavorable) || (dailyAdverse && gongAdverse) || (!dailyFavorable && !dailyAdverse && !gongFavorable && !gongAdverse);
  const receipts = [
    { zh: `八字日运：${REL_ZH[dailyRelation]}`, en: `Bazi daily relation: ${REL_EN[dailyRelation]}` },
    { zh: `今日地支所在宫评分：${todayPalaceScore}/100`, en: `Today's branch-palace score: ${todayPalaceScore}/100` },
  ];
  if (agree) {
    return { verdict: 'reinforced', receipts, zh: '今日八字读法与紫微今日所在宫一致——两套系统今天说的是同一件事。', en: 'Today\'s bazi read and the ziwei palace it lights up agree — both systems are saying the same thing today.' };
  }
  return { verdict: 'crosscurrent', receipts, zh: '今日八字读法与紫微今日所在宫不一致——不妨把今天当成一个需要多方印证的普通日子。', en: 'Today\'s bazi read and the ziwei palace disagree — worth treating today as an ordinary day that needs more than one signal before acting on it.' };
}
