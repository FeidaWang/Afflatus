/* ============================================================
   命理实验室 (Lab) — the fused daily guide (今日六事), the professional
   BaZi layer, the Western predictive techniques and the deep synastry
   block. Lazy-loaded by horoscope.js after the main reading renders.

   Rendering is two-phase: the Chinese-calendar signals are synchronous
   and render immediately; westernPro.js (astronomy-engine) is imported on
   demand and the guide re-renders with transit signals when it arrives.
   Everything runs in the browser; birth data never leaves localStorage.
   ============================================================ */
import { buildContext, dailyGuide, DOMAINS, DOMAIN_T } from '../lib/dailyGuide.js';
import { proTable, careers, partner, hehun, flowHits, EXTRA_SHENSHA_EN } from '../lib/baziPro.js';
import { computeBazi, ELEMENTS_ZH, ELEMENTS_EN, STEMS, BRANCHES } from '../lib/bazi.js';
import { SHENSHA_EN, TEN_GOD_ZH, TEN_GOD_EN, tenGodDistribution } from '../lib/ziping.js';
import { computeDayun, liunianPillar } from '../lib/dayun.js';
import { natalXiu, xiuRelation, XIU27_ZH, XIU_REL } from '../lib/xiu.js';
import { solarToLunar } from '../lib/lunar.js';
import { allRegions, citiesInRegion, findCityInRegion } from '../lib/cityPicker.js';

const CHECKIN_KEY = 'afflatus-horo:checkins';
const HERE_KEY = 'afflatus-horo:here';
const PERSONA_KEY = 'afflatus-horo:persona';
const readJSON = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const pad = (x) => String(x).padStart(2, '0');
const localDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (ds, n) => { const [y, m, d] = ds.split('-').map(Number); return localDateStr(new Date(y, m - 1, d + n)); };
const WEEKDAY_ZH = ['日', '一', '二', '三', '四', '五', '六'];
const WEEKDAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SRC_T = { bazi: ['BaZi', '八字'], almanac: ['Almanac', '黄历'], suyao: ['Mansions', '宿曜'], ziwei: ['Zi Wei', '紫微'], western: ['Transits', '星象'], zodiac: ['Zodiac', '生肖'] };
const SIGN_ZH = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
const SIGN_EN = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

let westernPromise = null;
let labSeq = 0;
const loadWestern = () => westernPromise || (westernPromise = import('../lib/westernPro.js'));

function personaType() { const r = readJSON(PERSONA_KEY, null); return r && typeof r.type === 'string' ? r.type : null; }

// ---- check-in -----------------------------------------------------------------------
function checkins() { const v = readJSON(CHECKIN_KEY, []); return Array.isArray(v) ? v : []; }
function checkIn(today) {
  const list = checkins();
  if (!list.includes(today)) { list.push(today); list.sort(); writeJSON(CHECKIN_KEY, list.slice(-120)); }
  return checkins();
}
function streakOf(list, today) {
  let n = 0; let d = today;
  const set = new Set(list);
  if (!set.has(d)) d = addDays(d, -1); // today not yet checked in: count up to yesterday
  while (set.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

// ---- natal western (cached per profile) ---------------------------------------------------
const natalCache = new Map();
function natalKey(me) { return `${me.y}-${me.m}-${me.d}-${me.hour}-${me.lat}-${me.lon}`; }
function natalOf(W, me) {
  const k = natalKey(me);
  if (!natalCache.has(k)) natalCache.set(k, W.natalChart(me));
  return natalCache.get(k);
}
function westernFor(W, natal, dateStr, here) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const jd = W.jdOf(new Date(y, m - 1, d, 12)); // local noon of the civil day
  const tr = W.transits(natal, jd, { loc: here || natal.loc });
  const targets = new Set(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Juno', 'ASC', 'MC']);
  return { aspects: tr.aspects.filter((a) => targets.has(a.b)), moonHouse: tr.points.Moon.natalHouse, tr };
}

// ---- small render helpers -------------------------------------------------------------------
const bar = (score) => `<span class="lab-bar" aria-hidden="true"><i style="width:${score}%"></i></span>`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const deg = (lon) => `${Math.floor(lon % 30)}°${pad(Math.floor((lon % 1) * 60))}′`;

// ============================================================================================
// MINE
// ============================================================================================
export async function renderLab({ me, lang, root }) {
  if (!root || !me) return;
  const T = (en, zh) => (lang === 'zh' ? zh : en);
  root.dataset.token = String(++labSeq);
  const myToken = root.dataset.token;
  const ctx = buildContext(me);
  const today = localDateStr(new Date());
  const here = readJSON(HERE_KEY, null);
  const persona = personaType();
  let W = null, natal = null;

  const guideFor = (ds) => dailyGuide(ctx, ds, { persona, western: W && natal ? westernFor(W, natal, ds, here) : null });

  function paint() {
    if (root.dataset.token !== myToken) return;
    const list = checkins();
    const checked = list.includes(today);
    const g = guideFor(today);
    const week = [0, 1, 2, 3, 4, 5, 6].map((i) => guideFor(addDays(today, i)));
    const tomorrow = week[1];
    root.innerHTML = [
      headHTML(g, list, checked),
      domainsHTML(g),
      weekHTML(week),
      teaserHTML(tomorrow, checked),
      `<details class="lab-more"><summary>${T('Professional BaZi · 八字精批', '八字精批 · 格局 · 身强弱 · 用神 · 行业 · 伴侣')}</summary>${baziHTML()}</details>`,
      `<details class="lab-more" id="labWestern"><summary>${T('Astrology · natal points & forecasting charts', '星盘推运 · 婚神/北交 · 次限 · 三限 · 日返 · 月返 · 日弧 · 法达 · 小限 · 重置')}</summary><div id="labWesternBody">${W ? westernHTML() : `<p class="lab-note">${T('Loading the ephemeris…', '正在载入星历……')}</p>`}</div></details>`,
      `<details class="lab-more"><summary>${T('Method, sources & honesty notes', '方法、出处与说明')}</summary>${methodHTML()}</details>`,
    ].join('');
    wire();
  }

  function headHTML(g, list, checked) {
    const streak = streakOf(list, today);
    const dots = [...Array(14)].map((_, i) => { const ds = addDays(today, i - 13); return `<i class="${list.includes(ds) ? 'on' : ''}" title="${ds}"></i>`; }).join('');
    const facts = [
      `${g.dayPillar}${T(' day', '日')} · ${T(g.god.en, g.god.zh)}`,
      `${T(g.almanac.jianchu.en, g.almanac.jianchu.zh + '日')} · ${T(g.almanac.tianshen.en, g.almanac.tianshen.zh)}${g.almanac.tianshen.huangdao ? T(' (bright path)', '黄道') : T(' (dark path)', '黑道')}`,
      `${T('Mansion ', '值日')}${g.xiu.name}${T('', '宿')}`,
      g.suyao ? `${T('Your 27-mansion day: ', '宿曜')}${g.suyao.key}${T('', '日')}` : '',
      g.ziwei ? `${T('Zi Wei day ', '紫微流日')}${g.ziwei.map((x) => `${x.star}${({ lu: '禄', quan: '权', ke: '科', ji: '忌' })[x.hua]}→${x.palace}`).join(' ')}` : '',
    ].filter(Boolean).map((f) => `<span>${esc(f)}</span>`).join('');
    return `<div class="lab-head">
      <div class="lab-score"><b>${g.overall}</b><small>${T('overall', '综合')}</small></div>
      <div class="lab-headtext">
        <h3>${T('Today’s six areas', '今日六事')} · ${today}</h3>
        <p class="lab-facts">${facts}</p>
        <p class="lab-best">${T(`Strongest today: ${DOMAIN_T[g.best.id][0]}`, `今日最旺：${DOMAIN_T[g.best.id][1]}`)} · ${T('Lucky hours', '吉时')} ${g.luckyHours.map((h) => `${h.branch}${T('', '时')} ${h.range}`).join(' / ')}</p>
      </div>
      <div class="lab-checkin">
        <button type="button" class="btn lab-checkin-btn" ${checked ? 'disabled' : ''}>${checked ? T('Checked in ✓', '已签到 ✓') : T('Check in', '今日签到')}</button>
        <div class="lab-dots" aria-label="${T('Last 14 days', '近 14 天')}">${dots}</div>
        <small>${T(`${streak}-day streak · ${list.length} total`, `连续 ${streak} 天 · 累计 ${list.length} 天`)}</small>
      </div>
    </div>`;
  }

  function domainsHTML(g) {
    return `<div class="lab-domains">${g.domains.map((d) => `
      <div class="lab-dom lab-${d.tone}">
        <div class="lab-dom-h"><span>${T(...DOMAIN_T[d.id])}</span><b>${d.score}</b></div>
        ${bar(d.score)}
        <p>${T(d.en, d.zh)}${d.tip ? ` <em>${T(d.tip.en, d.tip.zh)}</em>` : ''}</p>
        <details class="lab-why"><summary>${T('Why', '依据')} (${d.receipts.length})</summary><ul>${d.receipts.map((r) => `<li><span class="lab-src">${T(...SRC_T[r.src])}</span><b>${r.pts > 0 ? '+' : ''}${r.pts}</b> ${esc(T(r.en, r.zh))}</li>`).join('') || `<li>${T('No strong signal — a neutral day.', '今日无明显信号，平常之日。')}</li>`}</ul></details>
      </div>`).join('')}</div>
      <p class="lab-note">${g.westernUsed ? T('Signals: BaZi day pillar, almanac, 27 mansions, Zi Wei daily transformations and real planetary transits to your natal chart.', '信号来源：八字流日、黄历建除、宿曜、紫微流日四化，以及真实行星对你本命盘的行运相位。') : T('Chinese-calendar signals shown; planetary transits are loading.', '已显示历法信号；行星行运正在载入。')}</p>`;
  }

  function weekHTML(week) {
    const bestDay = {};
    for (const k of DOMAINS) bestDay[k] = week.slice().sort((a, b) => b.domains.find((x) => x.id === k).score - a.domains.find((x) => x.id === k).score)[0];
    const dayLabel = (ds) => { const [y, m, d] = ds.split('-').map(Number); const w = new Date(y, m - 1, d).getDay(); return T(WEEKDAY_EN[w], '周' + WEEKDAY_ZH[w]); };
    return `<div class="lab-week">
      <div class="lab-week-row">${week.map((g, i) => `<div class="lab-wd${i === 0 ? ' now' : ''}"><small>${i === 0 ? T('Today', '今天') : dayLabel(g.date)}</small><b>${g.overall}</b><span>${T(DOMAIN_T[g.best.id][0], DOMAIN_T[g.best.id][1])}</span></div>`).join('')}</div>
      <p class="lab-note">${T('Best day this week for', '本周最宜')}：${DOMAINS.map((k) => `${T(...DOMAIN_T[k])} ${dayLabel(bestDay[k].date)}`).join(' · ')}</p>
    </div>`;
  }

  function teaserHTML(t, checked) {
    if (!checked) return `<div class="lab-teaser locked">${T('Check in today to unlock tomorrow’s preview.', '今日签到后解锁「明日预告」。')}</div>`;
    const up = t.domains.slice().sort((a, b) => b.score - a.score)[0];
    const low = t.domains.slice().sort((a, b) => a.score - b.score)[0];
    return `<div class="lab-teaser"><b>${T('Tomorrow', '明日预告')} · ${t.dayPillar}</b> ${T(`${DOMAIN_T[up.id][0]} leads (${up.score}); go easy on ${DOMAIN_T[low.id][0].toLowerCase()} (${low.score}).`, `${DOMAIN_T[up.id][1]}领跑（${up.score}），${DOMAIN_T[low.id][1]}宜缓（${low.score}）。`)} ${T('See you tomorrow.', '明天见。')}</div>`;
  }

  // ---------------- 八字精批 ----------------
  function baziHTML() {
    const c = ctx.chart; const st = ctx.strength; const gj = ctx.geju; const ys = ctx.yong;
    const rows = proTable(c, me.gender);
    const labels = [T('Year', '年柱'), T('Month', '月柱'), T('Day', '日柱'), T('Hour', '时柱')];
    const cell = (f) => rows.map((r) => `<td>${f(r)}</td>`).join('');
    const shName = (n) => T(SHENSHA_EN[n] || EXTRA_SHENSHA_EN[n] || n, n);
    const table = `<div class="lab-scroll"><table class="lab-table">
      <thead><tr><th></th>${rows.map((_, i) => `<th>${labels[i]}</th>`).join('')}</tr></thead><tbody>
      <tr><th>${T('Main star', '主星')}</th>${cell((r) => T(r.main.en, r.main.zh))}</tr>
      <tr><th>${T('Stem', '天干')}</th>${cell((r) => `<b class="lab-gz">${r.stem}</b>`)}</tr>
      <tr><th>${T('Branch', '地支')}</th>${cell((r) => `<b class="lab-gz">${r.branch}</b>`)}</tr>
      <tr><th>${T('Hidden stems', '藏干')}</th>${cell((r) => r.hidden.map((h) => h.stem).join(' '))}</tr>
      <tr><th>${T('Sub stars', '副星')}</th>${cell((r) => r.hidden.map((h) => T(h.god.en, h.god.zh)).join('<br>'))}</tr>
      <tr><th>${T('Star luck', '星运')}</th>${cell((r) => T(r.starLuck.en, r.starLuck.zh))}</tr>
      <tr><th>${T('Self seat', '自坐')}</th>${cell((r) => T(r.selfSeat.en, r.selfSeat.zh))}</tr>
      <tr><th>${T('Void', '空亡')}</th>${cell((r) => r.kong)}</tr>
      <tr><th>${T('Nayin', '纳音')}</th>${cell((r) => T(r.nayin.en, r.nayin.zh))}</tr>
      <tr><th>${T('Stars', '神煞')}</th>${cell((r) => r.shensha.map(shName).join('<br>') || '—')}</tr>
      </tbody></table></div>`;
    const dist = tenGodDistribution([c.year, c.month, c.day, ...(c.hour ? [c.hour] : [])]);
    const distHTML = dist.map((v, i) => ({ v, i })).filter((x) => x.v > 0.005).sort((a, b) => b.v - a.v)
      .map((x) => `<span class="lab-chip">${T(TEN_GOD_EN[x.i], TEN_GOD_ZH[x.i])} ${Math.round(x.v * 100)}%</span>`).join('');
    const elemHTML = st.weights.map((w, i) => `<div class="lab-el"><span>${T(ELEMENTS_EN[i], ELEMENTS_ZH[i])}</span>${bar(Math.round(w * 100))}<b>${Math.round(w * 100)}%</b></div>`).join('');
    const cs = careers(ys);
    const pt = partner(c, me.gender, ys);
    let dyHTML = '';
    if (me.gender) {
      const dy = computeDayun(me, me.gender, 8);
      const yNow = new Date().getFullYear();
      const cur = dy.pillars.find((p) => yNow >= p.fromYear && yNow <= p.toYear);
      const ln = liunianPillar(yNow);
      const hits = flowHits(c, ln, cur);
      dyHTML = `<h4>${T('Luck cycles & this year', '大运 · 流年')}</h4>
        <p>${T(`Luck starts ${dy.startDate.y}-${pad(dy.startDate.m)}-${pad(dy.startDate.d)} (${dy.direction > 0 ? 'forward' : 'backward'}).`, `${dy.startDate.y} 年 ${dy.startDate.m} 月 ${dy.startDate.d} 日起运（${dy.direction > 0 ? '顺排' : '逆排'}）。`)}
        ${cur ? T(` Current luck pillar ${cur.gz} (${cur.fromYear}–${cur.toYear}).`, ` 当前大运 ${cur.gz}（${cur.fromYear}–${cur.toYear}）。`) : ''}
        ${T(` ${yNow} year pillar ${STEMS[ln.stem]}${BRANCHES[ln.branch]}`, ` ${yNow} 流年 ${STEMS[ln.stem]}${BRANCHES[ln.branch]}`)}${hits.length ? '：' + hits.map((h) => T(h.en, h.zh)).join('；') : T(' — no major echo or clash with your natal pillars.', '，与原局无伏吟反吟。')}</p>
        <div class="lab-dy">${dy.pillars.map((p) => `<span class="${p === cur ? 'now' : ''}"><b>${p.gz}</b><small>${p.fromYear}</small></span>`).join('')}</div>`;
    }
    return `<div class="lab-bazi">
      ${c.termDayAmbiguous ? `<p class="lab-warn">${T('You were born on a solar-term day and the hour is unknown — the month (and possibly year) pillar could be one earlier. Add the hour to settle it.', '你出生在节气交接当天且时辰未知——月柱（甚至年柱）可能差一位，补充时辰即可确定。')}</p>` : ''}
      ${table}
      <div class="lab-grid2">
        <div><h4>${T('Pattern', '格局')}</h4>
          <p><b>${T(gj.main.en, gj.main.zh)}</b>${gj.outer.length ? ` · ${T('outer pattern', '外格')}：${gj.outer.map((o) => `<b>${T(o.en, o.zh)}</b>`).join('、')}` : ''}</p>
          <ul class="lab-list">${gj.notes.map((n) => `<li>${T(n.en, n.zh)}</li>`).join('')}</ul></div>
        <div><h4>${T('Strength', '身强身弱')}</h4>
          <p><b>${T(st.en, st.zh)}</b> · ${T('support share', '同党占比')} ${Math.round(st.ratio * 100)}% · ${[st.deLing && T('in season', '得令'), st.deDi && T('rooted', '得地'), st.deShi && T('supported', '得势')].filter(Boolean).join(' / ') || T('no season, root or support', '不得令、不得地、不得势')}</p>
          ${elemHTML}</div>
      </div>
      <h4>${T('Useful elements', '用神 · 喜忌')}</h4>
      <p>${T('Useful', '用神')} <b>${T(ys.yong.en, ys.yong.zh)}</b> · ${T('helpful', '喜神')} <b>${T(ys.xi.en, ys.xi.zh)}</b> · ${T('unhelpful', '忌神')} <b>${T(ys.ji.en, ys.ji.zh)}</b> · ${T('its feeder', '仇神')} ${T(ys.chou.en, ys.chou.zh)} · ${T('neutral', '闲神')} ${ys.xian.map((x) => T(x.en, x.zh)).join('')}</p>
      <p class="lab-note">${T(ys.reason.en, ys.reason.zh)}${ys.climate ? `；${T(ys.climate.en, ys.climate.zh)}` : ''}${T(` (climate table: ${ys.tiaohouStems})`, `（调候表：${ys.tiaohouStems}）`)}</p>
      <h4>${T('Ten-god balance', '十神占比')}</h4><div class="lab-chips">${distHTML}</div>
      <h4>${T('Work that suits you', '适合行业')}</h4>
      ${cs.map((x) => `<p><b>${T(x.en, x.zh)}</b> — ${T(x.industries.en, x.industries.zh)}</p>`).join('')}
      <h4>${T('Partner profile', '契合伴侣')}</h4>
      <p>${pt.spouseStar ? `${T(pt.spouseStar.en, pt.spouseStar.zh)} ${T('weight', '强度')} ${pt.spouseStar.count} · ` : ''}${T(`Spouse palace ${pt.palace.branch} (${pt.palace.god.en}): ${pt.palace.en}.`, `夫妻宫${pt.palace.branch}（${pt.palace.god.zh}）：${pt.palace.zh}。`)}</p>
      <p>${T(`Most complementary: a ${pt.idealDayMaster.el.en} day master (${pt.idealDayMaster.stems}); the "heaven-and-earth combining" day pillar for yours is ${pt.tianheDihe}. Zodiac: six-harmony ${pt.zodiac.liuhe.en}, triad ${pt.zodiac.sanhe.map((z) => z.en).join(' & ')}; take extra care with ${pt.zodiac.avoid.en}.`, `最互补：日主为${pt.idealDayMaster.el.zh}（${pt.idealDayMaster.stems}）的人；与你日柱天合地合的是${pt.tianheDihe}日生人。生肖六合${pt.zodiac.liuhe.zh}，三合${pt.zodiac.sanhe.map((z) => z.zh).join('、')}；与${pt.zodiac.avoid.zh}相冲，相处多磨合。`)}</p>
      ${dyHTML}
    </div>`;
  }

  // ---------------- 星盘推运 ----------------
  function westernHTML() {
    const nowJD = W.jdOf(new Date());
    const nm = (b) => T(b, W.BODY_ZH[b] || b);
    const pos = (p) => `${T(SIGN_EN[p.sign ?? Math.floor(p.lon / 30)], SIGN_ZH[p.sign ?? Math.floor(p.lon / 30)])} ${deg(p.lon)}${p.retro ? ' ℞' : ''}${p.house ? T(` · H${p.house}`, ` · ${p.house}宫`) : ''}`;
    const ptsTable = (pts, keys) => `<div class="lab-scroll"><table class="lab-table lab-pts"><tbody>${keys.filter((k) => pts[k]).map((k) => `<tr><th>${W.BODY_GLYPH[k] || ''} ${nm(k)}</th><td>${pos(pts[k])}</td></tr>`).join('')}</tbody></table></div>`;
    const aspList = (list, n = 8) => list.length ? `<ul class="lab-list">${list.slice(0, n).map((a) => `<li>${nm(a.a)} ${a.glyph} ${nm(a.b)} · ${T(a.en, a.zh)} ${a.orb.toFixed(1)}°${a.applying != null && a.orb > 0.05 ? T(a.applying ? ' applying' : ' separating', a.applying ? ' 入相' : ' 出相') : ''}</li>`).join('')}</ul>` : `<p class="lab-note">${T('No tight aspects.', '无紧密相位。')}</p>`;
    const KEYS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Node', 'SouthNode', 'Juno', 'Lilith'];
    const noHouses = !natal.houses;
    const loc = here || natal.loc;
    const year = new Date().getFullYear();
    let sr = W.solarReturn(natal, year, loc);
    if (sr.jd > nowJD) sr = W.solarReturn(natal, year - 1, loc);
    const lr = W.currentLunarReturn(natal, nowJD, loc);
    const sp = W.secondaryProgression(natal, nowJD);
    const tp = W.tertiaryProgression(natal, nowJD);
    const sa = W.solarArc(natal, nowJD);
    const fd = W.firdaria(natal, nowJD);
    const pf = W.profection(natal, nowJD);
    const tr = W.transits(natal, nowJD, { loc });
    const rel = loc ? W.relocation(natal, loc) : null;
    const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const sub = (title, body) => `<details class="lab-sub"><summary>${title}</summary>${body}</details>`;
    const prog = (c) => ptsTable(c.points, ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars']) + (c.houses ? `<p class="lab-note">${T('Progressed ASC', '推运上升')} ${pos({ lon: c.houses.asc })} · MC ${pos({ lon: c.houses.mc })}</p>` : '') + aspList(W.aspectsBetween(Object.fromEntries(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars'].map((k) => [k, c.points[k]])), W.withAngles(natal), { maxOrb: 1 }), 6);
    return `
      <div class="lab-here">${hereControlHTML()}</div>${hereHint()}
      ${noHouses ? `<p class="lab-warn">${T('Add your birth hour and birth city above to unlock the ascendant, houses, profections and exact returns.', '在上方补充出生时辰与出生城市，即可解锁上升、宫位、小限与精确的返照盘。')}</p>` : ''}
      ${sub(T('Natal chart · 本命盘', '本命盘 · 含婚神星、北交点、莉莉丝'), ptsTable(natal.points, KEYS) + (natal.houses ? `<p class="lab-note">${T('ASC', '上升')} ${pos({ lon: natal.houses.asc })} · MC ${pos({ lon: natal.houses.mc })} · ${T(natal.sect === 'day' ? 'day chart' : 'night chart', natal.sect === 'day' ? '日生盘' : '夜生盘')} · ${natal.houses.system === 'placidus' ? T('Placidus houses', '普拉西度分宫') : T('Porphyry houses (polar latitude)', '波菲利分宫（高纬度）')}</p>` : '') + aspList(W.aspectsBetween(W.withAngles(natal), W.withAngles(natal), { same: true }).filter((a) => a.b !== 'SouthNode' && a.a !== 'SouthNode'), 10))}
      ${sub(T('Sky now · 天象盘', '天象盘 · 此刻星空'), ptsTable(tr.sky.points, KEYS.filter((k) => k !== 'Lilith')))}
      ${sub(T('Transits · 行运盘', '行运盘 · 当前行星对本命'), aspList(tr.aspects.filter((a) => a.b !== 'SouthNode'), 10))}
      ${sub(T('Secondary progressions · 次限盘', '次限盘 · 一日一年'), `<p class="lab-note">${T(`Chart for ${fmtDate(W.dateOf(sp.progressedJD))} UTC (age ${sp.years.toFixed(1)}); angles by Naibod in RA.`, `对应 ${fmtDate(W.dateOf(sp.progressedJD))}（UTC，${sp.years.toFixed(1)} 岁）；推运四轴用 Naibod 赤经法。`)}</p>` + prog(sp))}
      ${sub(T('Tertiary progressions · 三限盘', '三限盘 · 一日一月'), `<p class="lab-note">${T('1 day = 1 tropical month (Troinski).', '一日 = 一个回归月（Troinski 原法）。')}</p>` + prog(tp))}
      ${sub(T('Solar arc · 日弧盘', '日弧盘 · 太阳弧推运'), `<p class="lab-note">${T(`Arc ${sa.arc.toFixed(2)}° applied to every natal point.`, `弧度 ${sa.arc.toFixed(2)}°，全体本命点等量推进。`)}</p>` + aspList(sa.aspects.filter((a) => !['SouthNode', 'DSC', 'IC'].includes(a.a) && !['SouthNode', 'DSC', 'IC'].includes(a.b)), 8))}
      ${sub(T('Solar return · 日返盘', '日返盘 · 本年度'), `<p class="lab-note">${T(`Sun returns ${fmtDate(sr.date)} (your time)${loc ? '' : ' — no location, so no houses'}.`, `太阳回归时刻 ${fmtDate(sr.date)}（本机时间）${loc ? '' : '——未设定地点，不排宫位'}。`)}</p>` + ptsTable(sr.points, KEYS.slice(0, 10)) + (sr.houses ? `<p class="lab-note">${T('Return ASC', '返照上升')} ${pos({ lon: sr.houses.asc })} · MC ${pos({ lon: sr.houses.mc })} · ${T('Sun in return house', '太阳落返照')} ${W.houseOf(sr.points.Sun.lon, sr.houses.cusps)}${T('', '宫')}</p>` : ''))}
      ${sub(T('Lunar return · 月返盘', '月返盘 · 本月'), `<p class="lab-note">${T(`Moon returned ${fmtDate(lr.date)}.`, `月亮回归时刻 ${fmtDate(lr.date)}。`)}</p>` + ptsTable(lr.points, KEYS.slice(0, 7)) + (lr.houses ? `<p class="lab-note">${T('Moon in return house', '月亮落返照')} ${W.houseOf(lr.points.Moon.lon, lr.houses.cusps)}${T('', '宫')} · ${T('ASC', '上升')} ${pos({ lon: lr.houses.asc })}</p>` : ''))}
      ${sub(T('Firdaria · 法达盘', '法达盘 · 人生时段主星'), `<p>${T(`${natal.sect === 'night' ? 'Night' : 'Day'} chart. Current period: ${fd.current.lord}${fd.sub ? `, sub-period ${fd.sub.lord}` : ''}.`, `${natal.sect === 'night' ? '夜生' : '日生'}盘（${natal.sect ? '' : '未知时辰按日生，'}Abu Ma'shar 序）。当前主限：${nm(fd.current.lord)}${fd.sub ? `，子限：${nm(fd.sub.lord)}` : ''}。`)}</p><div class="lab-dy">${fd.periods.map((p) => `<span class="${p.lord === fd.current.lord ? 'now' : ''}"><b>${nm(p.lord)}</b><small>${Math.round(p.fromAge)}–${Math.round(p.toAge)}</small></span>`).join('')}</div>`)}
      ${pf ? sub(T('Profections · 小限盘', '小限盘 · 年度主题宫'), `<p>${T(`Age ${pf.age}: profected ${pf.house}th house, ${SIGN_EN[pf.sign]} — lord of the year ${pf.lord}. This month: ${SIGN_EN[pf.month.sign]} (${pf.month.lord}).`, `${pf.age} 岁：小限走到第 ${pf.house} 宫（${SIGN_ZH[pf.sign]}），年主星 ${nm(pf.lord)}。本月月限：${SIGN_ZH[pf.month.sign]}（${nm(pf.month.lord)}）。`)}</p>`) : ''}
      ${rel && rel.houses && here ? sub(T(`Relocation · ${here?.en || here?.zh || ''}`, `重置盘 · ${here?.zh || ''}`), `<p class="lab-note">${T('Same birth moment, houses recast for', '同一出生时刻，按此地重排宫位：')} ${here ? esc(here.zh) : T('birthplace', '出生地')}</p><p>${T('ASC', '上升')} ${pos({ lon: rel.houses.asc })} · MC ${pos({ lon: rel.houses.mc })}</p>` + ptsTable(rel.points, ['Sun', 'Moon', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Juno'])) : ''}
    `;
  }

  function hereHint() { return here ? '' : `<p class="lab-note">${T('Pick where you live now to unlock the relocation chart (重置盘) and location-true returns.', '选择现居地即可解锁重置盘，并按所在地排返照盘宫位。')}</p>`; }
  function hereControlHTML() {
    const { provinces, countries } = allRegions();
    return `<label>${T('Where you are now (for returns, relocation & transit houses)', '现居地（用于返照盘、重置盘与行运宫位）')}
      <select class="lab-region"><option value="">${T(here ? `Current: ${here.zh}` : 'Birthplace / not set', here ? `当前：${here.zh}` : '出生地 / 未设')}</option>
      <optgroup label="中国 · CHINA">${provinces.map((p) => `<option value="C|${esc(p.key)}">${esc(p.zh)}</option>`).join('')}</optgroup>
      <optgroup label="海外 · OVERSEAS">${countries.map((c) => `<option value="G|${esc(c.key)}">${esc(c.zh)} ${esc(c.en)}</option>`).join('')}</optgroup></select></label>
      <select class="lab-city" disabled></select>`;
  }

  function methodHTML() {
    return `<div class="lab-method">
      <p>${T('Everything here is computed in your browser from your birth data and today’s date. Scores add up named signals (listed under “Why”); nothing is random except which phrasing of the advice you see.', '这里的一切都在你的浏览器里，由出生资料与今天的日期计算得出。分数是“依据”里逐条列出的信号相加而成；唯一的随机只是同类建议挑哪一句。')}</p>
      <ul class="lab-list">
        <li>${T('Calendar & BaZi: exact solar-term instants; cross-checked against lunar-javascript (寿星天文历 by 许剑伟) — four pillars, lunar dates 1901–2100, luck-cycle start, 28 mansions.', '历法与八字：节气按交节时刻判断；与 lunar-javascript（许剑伟寿星天文历算法）交叉验证四柱、1901–2100 年农历、起运与二十八宿。')}</li>
        <li>${T('Zi Wei: star positions, four transformations and brightness cross-checked against iztro (default school).', '紫微斗数：星曜位置、四化、庙旺与 iztro（通行版）交叉验证。')}</li>
        <li>${T('Planets: astronomy-engine (VSOP87/ELP), within ~0.02° of Swiss Ephemeris; Placidus houses within 0.002°; true node; Juno from JPL orbital elements (≤0.07° vs Horizons 1900–2100).', '行星：astronomy-engine（VSOP87/ELP），与瑞士星历相差约 0.02° 以内；普拉西度宫位误差 0.002° 以内；北交点取真交点；婚神星以 JPL 轨道根数推算（1900–2100 年与 Horizons 相差 ≤0.07°）。')}</li>
        <li>${T('Patterns follow Zi Ping Zhen Quan; strength uses weighted hidden stems (month branch 40%); climate follows Qiong Tong Bao Jian. Schools disagree on thresholds, some shensha, and pairing heuristics — these are this site’s stated choices.', '格局依《子平真诠》；身强弱以藏干加权量化（月令占 40%）；调候依《穷通宝鉴》。各派在阈值、部分神煞与合婚权重上有分歧——这里是本站明示的取舍。')}</li>
        <li>${T('The 16-type quiz is an original, unofficial Jungian-style quiz, not the MBTI®. It only changes the wording of one tip, never a score.', '十六型人格测试为本站原创的荣格类型小测验，并非 MBTI® 官方量表；它只影响一句建议的措辞，不影响分数。')}</li>
      </ul>
      <p class="lab-warn">${T('For entertainment and self-reflection only — not advice on health, money, law or relationships. Low scores mean “go gently”, never “bad luck”.', '仅供娱乐与自我观照——不构成健康、财务、法律或情感建议。低分只意味着“放慢一点”，从不代表“运气坏”。')}</p>
    </div>`;
  }

  function wire() {
    const btn = root.querySelector('.lab-checkin-btn');
    if (btn) btn.addEventListener('click', () => { checkIn(today); paint(); });
    const region = root.querySelector('.lab-region'), city = root.querySelector('.lab-city');
    if (region && city) {
      region.addEventListener('change', () => {
        city.innerHTML = '';
        if (!region.value) { city.disabled = true; return; }
        const [kind, key] = region.value.split('|');
        const cities = citiesInRegion(key, kind === 'C');
        city.innerHTML = `<option value="">—</option>` + cities.map((c) => `<option value="${esc(c.zh)}">${esc(c.isChina ? c.zh : `${c.zh} ${c.en}`)}</option>`).join('');
        city.disabled = false;
      });
      city.addEventListener('change', () => {
        const [kind, key] = region.value.split('|');
        const c = findCityInRegion(key, kind === 'C', city.value);
        if (!c) return;
        writeJSON(HERE_KEY, { zh: c.zh, en: c.en || c.zh, lat: c.lat, lon: c.lon });
        renderLab({ me, lang, root });
      });
    }
  }

  paint();
  try {
    W = await loadWestern();
    if (root.dataset.token !== myToken) return;
    natal = natalOf(W, me);
    const open = root.querySelector('#labWestern')?.open;
    paint();
    if (open) root.querySelector('#labWestern').open = true;
  } catch { /* ephemeris failed to load: the calendar-only guide stays */ }
}

// ============================================================================================
// SYNASTRY (deep block)
// ============================================================================================
export async function renderLabSyn({ me, other, lang, root }) {
  if (!root || !me || !other) return;
  const T = (en, zh) => (lang === 'zh' ? zh : en);
  const A = computeBazi(me), B = computeBazi(other);
  const hh = hehun(A, B, me.gender, other.gender);
  const la = solarToLunar(me.y, me.m, me.d), lb = solarToLunar(other.y, other.m, other.d);
  let xiuHTML = '';
  if (la && lb) {
    const xa = natalXiu(la.lMonth, la.lDay), xb = natalXiu(lb.lMonth, lb.lDay);
    const d = ((xb - xa) % 27 + 27) % 27;
    const dist = Math.min(d, 27 - d);
    const band = [0, 9, 18].includes(d) ? T('no distance class', '无远近之分') : dist <= 4 ? T('near', '近距离') : dist <= 8 ? T('middle', '中距离') : T('far', '远距离');
    const r = XIU_REL[xiuRelation(xa, xb)];
    xiuHTML = `<p>${T(`Mansions ${XIU27_ZH[xa]} & ${XIU27_ZH[xb]}: ${r.en} (${band}).`, `宿曜：${XIU27_ZH[xa]}宿 × ${XIU27_ZH[xb]}宿 —— ${r.zh}（${band}）。`)} ${T(r.descEn, r.descZh)}</p>`;
  }
  // today's shared weather: both guides + today's branch against both spouse palaces
  const today = localDateStr(new Date());
  const gA = dailyGuide(buildContext(me), today), gB = dailyGuide(buildContext(other), today);
  const pick = (g, k) => g.domains.find((x) => x.id === k).score;
  const together = Math.round((pick(gA, 'love') + pick(gA, 'marriage') + pick(gB, 'love') + pick(gB, 'marriage')) / 4);
  root.hidden = false;
  root.innerHTML = `
    <div class="sec-label"><span>${T('DEEP MATCH · 合婚 & chart comparison', '深度合盘 · 八字合婚 · 星盘比较')}</span></div>
    <div class="lab-head lab-head--syn"><div class="lab-score"><b>${hh.score}</b><small>${T('BaZi match', '合婚')}</small></div>
      <div class="lab-headtext"><ul class="lab-list">${hh.items.map((it) => `<li><b>${it.v > 0.15 ? '＋' : it.v < -0.15 ? '－' : '＝'}</b> ${T(it.en, it.zh)} <small>(${T('weight', '权重')} ${it.w}%)</small></li>`).join('')}</ul>${xiuHTML}
      <p class="lab-best">${T(`Together today: ${together}/100 — you ${pick(gA, 'love')}/${pick(gA, 'marriage')}, them ${pick(gB, 'love')}/${pick(gB, 'marriage')} (love/partnership).`, `今日双人同频：${together} 分 —— 你 ${pick(gA, 'love')}/${pick(gA, 'marriage')}，TA ${pick(gB, 'love')}/${pick(gB, 'marriage')}（爱情/婚姻）。`)}</p></div></div>
    <div id="labSynWestern"><p class="lab-note">${T('Loading planetary comparison…', '正在计算星盘比较……')}</p></div>`;
  try {
    const W = await loadWestern();
    const cA = W.natalChart(me), cB = W.natalChart(other);
    const pick7 = (c) => Object.fromEntries(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Node', 'Juno'].map((k) => [k, c.points[k]]).concat(c.houses ? [['ASC', { lon: c.houses.asc, speed: 0 }], ['MC', { lon: c.houses.mc, speed: 0 }]] : []));
    const cross = W.aspectsBetween(pick7(cA), pick7(cB), { scale: 0.75 });
    const nm = (b) => T(b, W.BODY_ZH[b] || b);
    const juno = cross.filter((a) => a.a === 'Juno' || a.b === 'Juno' || a.a === 'Node' || a.b === 'Node');
    const comp = W.composite(cA, cB);
    const dv = W.davison(cA, cB);
    const sgn = (lon) => T(SIGN_EN[Math.floor(lon / 30)], SIGN_ZH[Math.floor(lon / 30)]);
    const el = root.querySelector('#labSynWestern');
    if (!el) return;
    el.innerHTML = `
      <h4>${T('Cross-aspects (you → them)', '比较盘 · 你→TA 的交互相位')}</h4>
      <ul class="lab-list">${cross.slice(0, 10).map((a) => `<li>${T('your', '你的')}${nm(a.a)} ${a.glyph} ${T('their', 'TA 的')}${nm(a.b)} · ${T(a.en, a.zh)} ${a.orb.toFixed(1)}°</li>`).join('')}</ul>
      <h4>${T('Juno & Node contacts (commitment / "fated" themes)', '婚神星与北交点接触（承诺 / 缘分主题）')}</h4>
      ${juno.length ? `<ul class="lab-list">${juno.slice(0, 6).map((a) => `<li>${T('your', '你的')}${nm(a.a)} ${a.glyph} ${T('their', 'TA 的')}${nm(a.b)} ${a.orb.toFixed(1)}°</li>`).join('')}</ul>` : `<p class="lab-note">${T('No tight Juno or Node contacts.', '无紧密的婚神星或北交点接触。')}</p>`}
      <h4>${T('Composite & Davison', '组合盘与时空盘')}</h4>
      <p>${T(`Composite Sun ${sgn(comp.points.Sun.lon)}, Moon ${sgn(comp.points.Moon.lon)}, Venus ${sgn(comp.points.Venus.lon)}; Davison chart moment ${dv.date.toISOString().slice(0, 10)} with Sun ${sgn(dv.points.Sun.lon)} and Moon ${sgn(dv.points.Moon.lon)}.`, `组合盘：太阳${sgn(comp.points.Sun.lon)}、月亮${sgn(comp.points.Moon.lon)}、金星${sgn(comp.points.Venus.lon)}；时空盘时刻 ${dv.date.toISOString().slice(0, 10)}，太阳${sgn(dv.points.Sun.lon)}、月亮${sgn(dv.points.Moon.lon)}。`)}</p>
      <p class="lab-note">${T('Match weights are this site’s house rules (stated above), not a classical standard. For fun only.', '合婚权重为本站明示的取舍，并非古法定数。仅供娱乐。')}</p>`;
  } catch { /* keep BaZi-only block */ }
}
