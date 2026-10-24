/* ============================================================
   PASSPORT COPY (roadmap C) — the reading lines the "why this reading"
   passport shows for the Moon's phase, the 24 solar terms and the five
   day-master relations. Data only, no DOM.

   Every entry carries a `ruleId` and a `source` that separates the FACT
   (astronomy / calendar, computed elsewhere in src/lib) from the READING
   (a traditional symbol, worded originally for this site). Readings are
   prompts, not forecasts.
   ============================================================ */

const PHASE_SOURCE = {
  en: 'Phase: astronomy — the Moon–Sun elongation (astro.js elongation) in eight 45° bins centred on 0°, 45° … 315°. Reading: Western lunar-phase symbolism; wording original to this site.',
  zh: '月相：天文事实——月日距角（astro.js 的 elongation），按以 0°、45°……315° 为中心的八个 45° 区间划分。解读：西方月相象征；文字为本站原创。',
};

export const MOON_PHASE_COPY = [
  { ruleId: 'moon.phase.new', name: { en: 'New moon', zh: '新月' }, reading: { en: 'A blank page: name one intention.', zh: '一张白纸：写下一个心愿。' } },
  { ruleId: 'moon.phase.waxing_crescent', name: { en: 'Waxing crescent', zh: '蛾眉月' }, reading: { en: 'Start small and keep it going.', zh: '从小处开始，坚持下去。' } },
  { ruleId: 'moon.phase.first_quarter', name: { en: 'First quarter', zh: '上弦月' }, reading: { en: 'A decision point: commit or cut.', zh: '做决定的时候：投入，或者放下。' } },
  { ruleId: 'moon.phase.waxing_gibbous', name: { en: 'Waxing gibbous', zh: '盈凸月' }, reading: { en: 'Refine before you finish.', zh: '收尾之前，再打磨一遍。' } },
  { ruleId: 'moon.phase.full', name: { en: 'Full moon', zh: '满月' }, reading: { en: 'What has been growing is now visible.', zh: '一直在生长的东西，此刻看得见了。' } },
  { ruleId: 'moon.phase.waning_gibbous', name: { en: 'Waning gibbous', zh: '亏凸月' }, reading: { en: 'Share what you have learned.', zh: '把学到的分享出去。' } },
  { ruleId: 'moon.phase.last_quarter', name: { en: 'Last quarter', zh: '下弦月' }, reading: { en: 'Clear something away.', zh: '清掉一样东西。' } },
  { ruleId: 'moon.phase.waning_crescent', name: { en: 'Waning crescent', zh: '残月' }, reading: { en: 'Rest before the next start.', zh: '下一次开始之前，先休息。' } },
].map((e) => ({ ...e, basis: 'astronomy+tradition', source: PHASE_SOURCE }));

// Signed elongation (−180, 180] → index into MOON_PHASE_COPY.
export function moonPhaseIndex(elongationDeg) {
  const e = ((elongationDeg % 360) + 360) % 360;
  return Math.floor((e + 22.5) / 45) % 8;
}

const TERM_SOURCE = {
  en: 'Calendar fact: the Sun crossing each 15° of ecliptic longitude (bazi.js solar-term solver; cross-check: Hong Kong Observatory calendar tables). The twelve jie (节) open the Bazi months; Start of Spring also turns the Bazi year. Names follow the seasons of the northern Chinese plain, so in Melbourne they run opposite to the local weather.',
  zh: '历法事实：太阳每经过黄经 15° 为一个节气（bazi.js 的节气求解；可对照香港天文台历表）。十二「节」是八字换月的界线，立春同时换年。节气名对应华北平原的季节，在墨尔本与当地冷暖相反。',
};
const T = (lon, key, en, zh, kind, reading) => ({ ruleId: `calendar.solar_term.${key}`, sunLongitude: lon, kind, name: { en, zh }, reading, basis: 'calendar', source: TERM_SOURCE });
const jie = (branchZh, branchEn) => ({ en: `A jie term: the Bazi month turns to ${branchEn} (${branchZh}).`, zh: `「节」：八字月份换为${branchZh}月。` });
const qi = { en: 'A zhongqi term: the middle of the Bazi month; no pillar changes.', zh: '「中气」：八字月份的中段，四柱不变。' };

export const SOLAR_TERM_COPY = [
  T(315, 'lichun', 'Start of Spring', '立春', 'jie', { en: 'A jie term: the Bazi year turns here, and the month becomes Yin (寅).', zh: '「节」：八字在此换年，月份换为寅月。' }),
  T(330, 'yushui', 'Rain Water', '雨水', 'qi', qi),
  T(345, 'jingzhe', 'Awakening of Insects', '惊蛰', 'jie', jie('卯', 'Mao')),
  T(0, 'chunfen', 'Spring Equinox', '春分', 'qi', qi),
  T(15, 'qingming', 'Clear and Bright', '清明', 'jie', jie('辰', 'Chen')),
  T(30, 'guyu', 'Grain Rain', '谷雨', 'qi', qi),
  T(45, 'lixia', 'Start of Summer', '立夏', 'jie', jie('巳', 'Si')),
  T(60, 'xiaoman', 'Grain Buds', '小满', 'qi', qi),
  T(75, 'mangzhong', 'Grain in Ear', '芒种', 'jie', jie('午', 'Wu')),
  T(90, 'xiazhi', 'Summer Solstice', '夏至', 'qi', qi),
  T(105, 'xiaoshu', 'Minor Heat', '小暑', 'jie', jie('未', 'Wei')),
  T(120, 'dashu', 'Major Heat', '大暑', 'qi', qi),
  T(135, 'liqiu', 'Start of Autumn', '立秋', 'jie', jie('申', 'Shen')),
  T(150, 'chushu', 'End of Heat', '处暑', 'qi', qi),
  T(165, 'bailu', 'White Dew', '白露', 'jie', jie('酉', 'You')),
  T(180, 'qiufen', 'Autumn Equinox', '秋分', 'qi', qi),
  T(195, 'hanlu', 'Cold Dew', '寒露', 'jie', jie('戌', 'Xu')),
  T(210, 'shuangjiang', 'Frost Descent', '霜降', 'qi', qi),
  T(225, 'lidong', 'Start of Winter', '立冬', 'jie', jie('亥', 'Hai')),
  T(240, 'xiaoxue', 'Minor Snow', '小雪', 'qi', qi),
  T(255, 'daxue', 'Major Snow', '大雪', 'jie', jie('子', 'Zi')),
  T(270, 'dongzhi', 'Winter Solstice', '冬至', 'qi', qi),
  T(285, 'xiaohan', 'Minor Cold', '小寒', 'jie', jie('丑', 'Chou')),
  T(300, 'dahan', 'Major Cold', '大寒', 'qi', qi),
];

const RELATION_SOURCE = {
  en: 'Rule: Ziping five-element generation and control between today’s stem element and the natal day master (horoscopeEngine.js elementRelation). Ten-god group names are traditional; this is cultural symbolism, not a validated forecast. Wording original to this site.',
  zh: '规则：子平五行生克——今日天干五行与命局日主的关系（horoscopeEngine.js 的 elementRelation）。十神分组名称来自传统；这是文化象征，不是经过验证的预测。文字为本站原创。',
};

// Keys match elementRelation(): feeds | same | drains | prize | presses.
export const DAY_RELATION_COPY = {
  feeds: { ruleId: 'bazi.relation.feeds', group: { en: 'Resource day (Seal)', zh: '印' }, rule: { en: 'Today’s stem generates your day master.', zh: '今日天干生日主。' }, reading: { en: 'Support comes in; take what is offered.', zh: '有扶持进来，别人给的就接住。' } },
  same: { ruleId: 'bazi.relation.same', group: { en: 'Companion day (Peer)', zh: '比劫' }, rule: { en: 'Today’s stem shares your day master’s element.', zh: '今日天干与日主同五行。' }, reading: { en: 'Familiar ground; your own pace works.', zh: '熟悉的地面，按自己的步子走。' } },
  drains: { ruleId: 'bazi.relation.drains', group: { en: 'Output day (Expression)', zh: '食伤' }, rule: { en: 'Your day master generates today’s stem.', zh: '日主生今日天干。' }, reading: { en: 'Energy goes out as words and work; pace it.', zh: '力气化作言语和作品流出去，注意节制。' } },
  prize: { ruleId: 'bazi.relation.prize', group: { en: 'Wealth day', zh: '财' }, rule: { en: 'Your day master controls today’s stem.', zh: '日主克今日天干。' }, reading: { en: 'A day for reaching: ask, quote, decide.', zh: '适合伸手的一天：开口、报价、拍板。' } },
  presses: { ruleId: 'bazi.relation.presses', group: { en: 'Officer day (Pressure)', zh: '官杀' }, rule: { en: 'Today’s stem controls your day master.', zh: '今日天干克日主。' }, reading: { en: 'Pressure from outside; slow the tempo.', zh: '外来压力在，把节奏放慢。' } },
};
for (const k of Object.keys(DAY_RELATION_COPY)) Object.assign(DAY_RELATION_COPY[k], { basis: 'tradition', source: RELATION_SOURCE });
