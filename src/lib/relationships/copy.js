/* ============================================================
   RELATIONSHIPS v2 · display copy for report ids (REL-070).
   The kernel returns language-free ids; this table turns them into
   bilingual lines. Rendering only — no rule or weight lives here.
   Themes are traditional symbols read as stories (原型), not statements
   about either person; each comes with an observation question.
   ============================================================ */

export const DIMENSION_COPY = {
  attraction: { zh: '吸引', en: 'Attraction' },
  emotional_support: { zh: '情感支持', en: 'Emotional support' },
  communication: { zh: '沟通', en: 'Communication' },
  rhythm: { zh: '节奏', en: 'Rhythm' },
  building: { zh: '共建', en: 'Building together' },
  growth: { zh: '成长', en: 'Growth' },
};

const PILLAR = { year: ['year', '年'], month: ['month', '月'], day: ['day', '日'], hour: ['hour', '时'] };
const BODY = { Sun: ['Sun', '太阳'], Moon: ['Moon', '月亮'], Mercury: ['Mercury', '水星'], Venus: ['Venus', '金星'], Mars: ['Mars', '火星'] };
const ASPECT = { conj: ['conjoins', '合相'], sextile: ['sextiles', '六合'], square: ['squares', '刑相'], trine: ['trines', '拱相'], opp: ['opposes', '冲相'] };
const DAY_STEMS = {
  combo: ['Day stems combine — a natural pull', '日干五合，天然相吸'],
  feeds: ['Day masters feed each other', '日主相生，相处养人'],
  same: ['Day masters of one kind', '日主比和，脾性相近'],
  guan: ['One day master checks the other — someone yields', '日主相克，一方需让'],
  sha: ['A hard check between day masters — balance takes work', '日主七杀相克，强弱需调'],
  clash: ['Day stems clash — rhythms pull apart', '日干相冲，节奏相左'],
};
const LIFE_PALACES = {
  liuhe: ['Life palaces in six-harmony', '命宫六合'], sanhe: ['Life palaces in three-harmony', '命宫三合'],
  banhe: ['Life palaces in half-harmony', '命宫半合'], same: ['Same life palace', '命宫同宫'],
  hai: ['Life palaces harm each other', '命宫相害'], xing: ['Life palaces punish each other', '命宫相刑'], chong: ['Life palaces clash', '命宫相冲'],
};

// One evidence line for a matched rule evaluation, from its fact.
export function ruleLine(rule, factsById) {
  const fact = factsById.get(rule.evidenceIds[0]);
  const id = fact?.id || '';
  if (rule.familyId === 'bazi.day_stems') { const [en, zh] = DAY_STEMS[fact.value]; return { en, zh }; }
  if (rule.familyId === 'bazi.favours') {
    return rule.direction === 'A_to_B'
      ? { en: "Their day master is an element my chart favours", zh: 'TA 的日主正是我命局所喜的五行' }
      : { en: 'My day master is an element their chart favours', zh: '我的日主正是 TA 命局所喜的五行' };
  }
  if (rule.familyId.startsWith('bazi.branch.')) {
    const [pa, pb] = id.split('.').slice(3);
    return rule.familyId === 'bazi.branch.harmony'
      ? { en: `My ${PILLAR[pa][0]} branch combines with their ${PILLAR[pb][0]} branch`, zh: `我的${PILLAR[pa][1]}支与 TA 的${PILLAR[pb][1]}支相合` }
      : { en: `My ${PILLAR[pa][0]} branch clashes, punishes, harms or breaks their ${PILLAR[pb][0]} branch`, zh: `我的${PILLAR[pa][1]}支与 TA 的${PILLAR[pb][1]}支冲刑害破` };
  }
  if (rule.familyId === 'western.sun_elements') {
    const [a, b] = fact.value;
    return a === b ? { en: 'Sun signs share an element', zh: '太阳星座同元素' } : { en: 'Sun-sign elements complement each other', zh: '太阳星座元素相成' };
  }
  if (rule.familyId.startsWith('western.')) {
    const [ba, bb] = id.split('.').slice(3);
    return { en: `My ${BODY[ba][0]} ${ASPECT[fact.value][0]} their ${BODY[bb][0]}`, zh: `我的${BODY[ba][1]}与 TA 的${BODY[bb][1]}${ASPECT[fact.value][1]}` };
  }
  if (rule.familyId === 'ziwei.life_palaces') { const [en, zh] = LIFE_PALACES[fact.value]; return { en, zh }; }
  return { en: rule.ruleId, zh: rule.ruleId };
}

export const THEME_COPY = {
  'theme.nourished': { en: 'Topped up — their day master is what my chart leans on', zh: '补位——TA 的日主正是我命局所倚' },
  'theme.understood': { en: 'Read — their Moon meets my Sun, Moon or Venus', zh: '被读懂——TA 的月亮触及我的日、月或金星' },
  'theme.heard': { en: 'Heard — their Mercury runs easy with my Sun, Moon or Mercury', zh: '被听见——TA 的水星与我的日、月或水星相顺' },
  'theme.spark': { en: 'Spark — their Venus or Mars meets my Sun, Venus or Mars', zh: '火花——TA 的金星或火星触及我的日、金或火星' },
  'theme.kindred': { en: 'Kindred — day masters of one kind', zh: '同类——两人日主比和' },
  'theme.challenged': { en: 'Pushed — their Sun or Mars squares or opposes my chart', zh: '被推动——TA 的太阳或火星与我的星体成硬相位' },
};

export const QUESTION_COPY = {
  'question.nourished': { en: 'After time together, do you come away with more energy or less?', zh: '和 TA 相处之后，你是更有精神，还是更累？' },
  'question.understood': { en: 'When did they last notice a change in your mood before you said anything?', zh: 'TA 上一次在你开口之前就察觉你的情绪变化，是什么时候？' },
  'question.heard': { en: 'When you disagree, who usually repeats the other’s point back first?', zh: '你们有分歧时，通常是谁先把对方的意思复述一遍？' },
  'question.spark': { en: 'What was the last new thing you tried together?', zh: '你们最近一次一起尝试的新事物是什么？' },
  'question.kindred': { en: 'Which of your shared habits relaxes you, and which one leaves you both stuck?', zh: '你们相似的习惯里，哪一个让你放松，哪一个让你们一起卡住？' },
  'question.challenged': { en: 'When they push you, does it feel like pressure or encouragement?', zh: 'TA 推你一把的时候，你感到的是压力还是鼓励？' },
};
