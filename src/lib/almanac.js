/* ============================================================
   ALMANAC (黄历) — 建除十二神 and 黄黑道十二神 for a civil date.
   Pure calendar arithmetic, cross-checked day-by-day against
   lunar-javascript's getZhiXing() / getDayTianShen() in
   tests/dailyGuide.test.js.
   - 建除: 建 falls on the day whose branch equals the (节-based) month
     branch; the other eleven follow in order.
   - 黄黑道: 青龙 starts at 申(子午月) 戌(丑未) 子(寅申) 寅(卯酉) 辰(辰戌)
     午(巳亥), then 明堂 天刑 朱雀 金匮 天德 白虎 玉堂 天牢 玄武 司命 勾陈;
     青龙 明堂 金匮 天德 玉堂 司命 are 黄道 (auspicious).
   The 宜/忌 lines summarise the common reading of each 建除 day
   (协纪辨方书 lineage), phrased as light suggestions.
   ============================================================ */
import { dayPillar, monthBranch } from './bazi.js';

const mod = (n, m) => ((n % m) + m) % m;
export const JIANCHU_ZH = ['建', '除', '满', '平', '定', '执', '破', '危', '成', '收', '开', '闭'];
export const JIANCHU_EN = ['Establish', 'Remove', 'Full', 'Balance', 'Settle', 'Hold', 'Break', 'Danger', 'Success', 'Receive', 'Open', 'Close'];
const JIANCHU_TONE = [0, 1, 1, 0, 1, 0, -1, -1, 1, 1, 1, -1];
const JIANCHU_ADVICE = [
  { yi: ['谋划开局', '出行'], ji: ['动土', '大额借贷'], yiEn: ['plan a new start', 'travel'], jiEn: ['breaking ground', 'large loans'] },
  { yi: ['断舍离', '看诊调养'], ji: ['远行', '大宴'], yiEn: ['declutter', 'health check-ups'], jiEn: ['long trips', 'big parties'] },
  { yi: ['交易纳财', '聚会'], ji: ['开刀服重药', '贸然栽种'], yiEn: ['deals & collecting', 'gatherings'], jiEn: ['elective surgery', 'hasty planting'] },
  { yi: ['修缮整理', '商量事情'], ji: ['开沟挖渠', '冒进'], yiEn: ['repairs & tidying', 'talking things over'], jiEn: ['digging', 'rushing'] },
  { yi: ['签约订婚', '定计划'], ji: ['诉讼争执', '临时出行'], yiEn: ['contracts & commitments', 'set a plan'], jiEn: ['disputes', 'last-minute trips'] },
  { yi: ['执行落地', '收账'], ji: ['搬家开市', '大笔支出'], yiEn: ['execute', 'collect what is owed'], jiEn: ['moving house', 'big spending'] },
  { yi: ['拆旧破局', '就医'], ji: ['嫁娶签约', '开张'], yiEn: ['clear the old', 'see a doctor'], jiEn: ['weddings & signing', 'launches'] },
  { yi: ['谨慎低调', '安床休整'], ji: ['登高涉险', '冲动决定'], yiEn: ['keep a low profile', 'rest'], jiEn: ['risky heights & water', 'impulsive calls'] },
  { yi: ['开业嫁娶', '入学签约'], ji: ['诉讼'], yiEn: ['launches & weddings', 'enrolling & signing'], jiEn: ['lawsuits'] },
  { yi: ['收获纳财', '储蓄'], ji: ['放贷', '远行'], yiEn: ['harvest & save', 'build reserves'], jiEn: ['lending money', 'long trips'] },
  { yi: ['开张求职', '交际出行'], ji: ['丧葬之事'], yiEn: ['launch or apply', 'socialise & travel'], jiEn: ['funerals'] },
  { yi: ['收敛休养', '储藏'], ji: ['开张', '远行'], yiEn: ['rest & recharge', 'store things away'], jiEn: ['launches', 'long trips'] },
];
export const TIANSHEN_ZH = ['青龙', '明堂', '天刑', '朱雀', '金匮', '天德', '白虎', '玉堂', '天牢', '玄武', '司命', '勾陈'];
export const TIANSHEN_EN = ['Azure Dragon', 'Bright Hall', 'Heaven Punish', 'Vermilion Bird', 'Golden Coffer', 'Heaven Virtue', 'White Tiger', 'Jade Hall', 'Heaven Prison', 'Black Tortoise', 'Life Command', 'Hook'];
const HUANGDAO = new Set([0, 1, 4, 5, 7, 10]);
const QINGLONG_START = [8, 10, 0, 2, 4, 6, 8, 10, 0, 2, 4, 6]; // by month branch 子..亥

export function almanac(y, m, d) {
  const mb = monthBranch(y, m, d);
  const dp = dayPillar(y, m, d);
  const jc = mod(dp.branch - mb, 12);
  const ts = mod(dp.branch - QINGLONG_START[mb], 12);
  const a = JIANCHU_ADVICE[jc];
  return {
    monthBranch: mb, dayPillar: dp,
    jianchu: { idx: jc, zh: JIANCHU_ZH[jc], en: JIANCHU_EN[jc], tone: JIANCHU_TONE[jc] },
    tianshen: { idx: ts, zh: TIANSHEN_ZH[ts], en: TIANSHEN_EN[ts], huangdao: HUANGDAO.has(ts) },
    yi: a.yi.map((zh, i) => ({ zh, en: a.yiEn[i] })), ji: a.ji.map((zh, i) => ({ zh, en: a.jiEn[i] })),
    chong: mod(dp.branch + 6, 12), // the zodiac animal this day clashes (冲)
  };
}
