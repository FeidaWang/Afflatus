/* ============================================================
   HOROSCOPE page (V20) — 观星台. Fetch-free and server-free: all math in
   src/lib/bazi.js + src/lib/horoscopeEngine.js (pure, vitest-covered);
   this file only handles the form, localStorage persistence (profile +
   daily check-in streak), share-link codec plumbing and DOM rendering.
   ENTERTAINMENT ONLY — the page says so, loudly.
   ============================================================ */
import { pillarName, STEMS, BRANCHES, STEM_ELEMENT, BRANCH_ELEMENT, ELEMENTS_ZH, ELEMENTS_EN, ANIMALS_ZH, ANIMALS_EN, zodiacIndex, ZODIAC_ZH, ZODIAC_EN, normalizeBirthToCST } from '../lib/bazi.js';
import { dailyFortune, synastry, dailyPull, encodeShare, decodeShare } from '../lib/horoscopeEngine.js';
import {
  TEN_GOD_ZH, TEN_GOD_EN, tenGodOfStem, HIDDEN_STEMS, nayinOf, kongWangOf,
  STAGE_ZH, STAGE_EN, twelveStage, SEASON_STAGE_ZH, SEASON_STAGE_EN, seasonalStrength,
  stemRelations, branchRelations, computeShensha, SHENSHA_EN, ziPingAnalysis,
} from '../lib/ziping.js';

(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  if (!$('birthForm')) return;

  const PROFILE_KEY = 'afflatus-horo:me';
  const STREAK_KEY = 'afflatus-horo:streak';
  const state = {
    lang: (window.AfflatusI18N && window.AfflatusI18N.get && window.AfflatusI18N.get()) || 'en',
    me: null, other: null,
  };
  const T = (en, zh) => (state.lang === 'zh' ? zh : en);
  const todayStr = () => { const d = new Date(); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

  // ---- 时辰 selects -------------------------------------------------------
  // 子 (23:00-01:00) is split into 早子 (00:xx, same calendar day) and 晚子
  // (23:xx) because they are NOT interchangeable: computeBazi() advances the
  // day/month/year pillar to the next day for a 晚子 (hour=23) birth (the
  // mainstream "late zi" convention — verified against a professional bazi
  // site's published output for a real 23:26 birth in tests/bazi.test.js),
  // while 早子 (hour=0) never shifts. Collapsing them into one option would
  // silently give half of all 子-hour users the wrong day pillar.
  // Listed in chronological order (00:00 -> 24:00, 晚子 last, not squeezed
  // in second) with full HH:MM ranges and a pinyin EN label, so the option
  // reads clearly in either language instead of a bare, oddly-ordered 干支.
  const SHICHEN = [
    [0, '早子 00:00–01:00', 'Zi · early 00:00–01:00'],
    [1, '丑 01:00–03:00', 'Chou 01:00–03:00'],
    [3, '寅 03:00–05:00', 'Yin 03:00–05:00'],
    [5, '卯 05:00–07:00', 'Mao 05:00–07:00'],
    [7, '辰 07:00–09:00', 'Chen 07:00–09:00'],
    [9, '巳 09:00–11:00', 'Si 09:00–11:00'],
    [11, '午 11:00–13:00', 'Wu 11:00–13:00'],
    [13, '未 13:00–15:00', 'Wei 13:00–15:00'],
    [15, '申 15:00–17:00', 'Shen 15:00–17:00'],
    [17, '酉 17:00–19:00', 'You 17:00–19:00'],
    [19, '戌 19:00–21:00', 'Xu 19:00–21:00'],
    [21, '亥 21:00–23:00', 'Hai 21:00–23:00'],
    [23, '晚子 23:00–24:00', 'Zi · late 23:00–24:00'],
  ];
  for (const sel of [$('bHour'), $('sHour')]) {
    if (!sel) continue;
    SHICHEN.forEach(([hour, zh, en]) => {
      const o = document.createElement('option');
      // data-en/data-zh: the site's generic i18n.js already re-scans and
      // relabels every [data-en] element on each language toggle, same
      // mechanism the static "Unknown" option above relies on.
      o.value = String(hour); o.dataset.en = en; o.dataset.zh = zh; o.textContent = T(en, zh);
      sel.appendChild(o);
    });
  }

  // ---- birth-timezone selects (optional accuracy correction) --------------
  // Value = the location's STANDARD (non-DST) UTC offset; hour hand math in
  // bazi.js expects China Standard Time, so this is converted at intake via
  // normalizeBirthToCST(). Leaving it unspecified assumes the birth is
  // already China civil time (with China's own 1986-1991 DST auto-corrected).
  const TZ_OPTIONS = [
    [-12, 'UTC−12'], [-11, 'UTC−11 · Samoa 萨摩亚'], [-10, 'UTC−10 · Hawaii 夏威夷'],
    [-9, 'UTC−9 · Alaska 阿拉斯加'], [-8, 'UTC−8 · US Pacific 美西'], [-7, 'UTC−7 · US Mountain 美国山地'],
    [-6, 'UTC−6 · US Central 美中'], [-5, 'UTC−5 · US Eastern 美东'], [-4, 'UTC−4 · Atlantic 大西洋'],
    [-3.5, 'UTC−3:30 · Newfoundland 纽芬兰'], [-3, 'UTC−3 · Brazil/Argentina 巴西/阿根廷'],
    [-2, 'UTC−2'], [-1, 'UTC−1 · Azores 亚速尔'], [0, 'UTC±0 · London 伦敦'],
    [1, 'UTC+1 · Berlin/Paris 柏林/巴黎'], [2, 'UTC+2 · Cairo/Athens 开罗/雅典'],
    [3, 'UTC+3 · Moscow 莫斯科'], [3.5, 'UTC+3:30 · Iran 伊朗'], [4, 'UTC+4 · Dubai 迪拜'],
    [4.5, 'UTC+4:30 · Afghanistan 阿富汗'], [5, 'UTC+5 · Pakistan 巴基斯坦'],
    [5.5, 'UTC+5:30 · India 印度'], [5.75, 'UTC+5:45 · Nepal 尼泊尔'], [6, 'UTC+6 · Dhaka 达卡'],
    [6.5, 'UTC+6:30 · Myanmar 缅甸'], [7, 'UTC+7 · Bangkok/Jakarta 曼谷/雅加达'],
    [8, 'UTC+8 · China/Singapore/Perth 中国/新加坡/珀斯'], [9, 'UTC+9 · Japan/Korea 日本/韩国'],
    [9.5, 'UTC+9:30 · Adelaide 阿德莱德'], [10, 'UTC+10 · Sydney/Melbourne 悉尼/墨尔本'],
    [11, 'UTC+11 · Solomon Is. 所罗门群岛'], [12, 'UTC+12 · Auckland/Fiji 奥克兰/斐济'],
    [13, 'UTC+13 · Tonga 汤加'], [14, 'UTC+14 · Kiribati 基里巴斯'],
  ];
  for (const sel of [$('bTz'), $('sTz')]) {
    if (!sel) continue;
    TZ_OPTIONS.forEach(([v, label]) => { const o = document.createElement('option'); o.value = String(v); o.textContent = label; sel.appendChild(o); });
  }
  for (const [tzSel, dstBox] of [[$('bTz'), $('bDst')], [$('sTz'), $('sDst')]]) {
    if (!tzSel || !dstBox) continue;
    tzSel.addEventListener('change', () => {
      const known = tzSel.value !== '';
      dstBox.disabled = !known;
      if (!known) dstBox.checked = false;
    });
  }

  // ---- persistence ---------------------------------------------------------
  const loadProfile = () => { try { return JSON.parse(localStorage.getItem(PROFILE_KEY)); } catch { return null; } };
  const saveProfile = (p) => { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch {} };
  function bumpStreak() {
    let s = { last: null, n: 0 };
    try { s = JSON.parse(localStorage.getItem(STREAK_KEY)) || s; } catch {}
    const today = todayStr();
    if (s.last === today) return s.n;
    const y = new Date(); y.setDate(y.getDate() - 1);
    const p = (x) => String(x).padStart(2, '0');
    const yStr = `${y.getFullYear()}-${p(y.getMonth() + 1)}-${p(y.getDate())}`;
    s = { last: today, n: s.last === yStr ? s.n + 1 : 1 };
    try { localStorage.setItem(STREAK_KEY, JSON.stringify(s)); } catch {}
    return s.n;
  }

  const parseBirth = (dateVal, hourVal, tzVal, dstVal) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateVal || '');
    if (!m) return null;
    const raw = { y: +m[1], m: +m[2], d: +m[3], hour: hourVal === '' ? null : +hourVal };
    const tz = (tzVal == null || tzVal === '') ? null : { utcOffset: +tzVal, dst: !!dstVal };
    return normalizeBirthToCST(raw, tz);
  };

  // ---- render: my daily reading -------------------------------------------
  const PILLAR_T = [['YEAR', '年柱'], ['MONTH', '月柱'], ['DAY', '日柱'], ['HOUR', '时柱']];
  const DOM_NAMES = { career: ['CAREER', '事业'], love: ['ROMANCE', '情缘'], wealth: ['WEALTH', '财帛'], health: ['HEALTH', '康健'] };
  const REL_T = {
    feeds: ['today nourishes your day master', '今日之气生扶日主'],
    same: ['same element as your day master', '与日主同气'],
    drains: ['your energy flows outward today', '日主之气外泄'],
    prize: ['your day master commands today', '日主克今日之气'],
    presses: ['today presses on your day master', '今日之气克日主'],
  };

  // Shared pillar-card markup (used by "my chart" and the synastry two-chart view).
  function pillarCardsHTML(chart, sizeClass) {
    const ps = [chart.year, chart.month, chart.day, chart.hour].filter(Boolean);
    return ps.map((p, i) => {
      const el = STEM_ELEMENT[p.stem];
      return `<div class="pillar ${sizeClass || ''}"><div class="t">${T(...PILLAR_T[i])}</div><span class="gz e-${el}">${pillarName(p)}</span><div class="el">${T(ELEMENTS_EN[el], ELEMENTS_ZH[el])}</div></div>`;
    }).join('') + (chart.hour ? '' : `<div class="pillar ${sizeClass || ''}"><div class="t">${T('HOUR', '时柱')}</div><span class="gz" style="color:var(--dim)">未知</span><div class="el">${T('unknown', '未填时辰')}</div></div>`);
  }
  // ---- 生辰详批 (子平法): 十神/藏干/纳音/空亡/十二长生/旺相休囚死/神煞/刑冲合害 --
  // Simplified read (see src/lib/ziping.js docblock for what's implemented
  // vs. simplified vs. lower-confidence). Entertainment only, same as the
  // rest of this page.
  const ganzhiIndex = (stem, branch) => { for (let i = 0; i < 60; i++) if (i % 10 === stem && i % 12 === branch) return i; return -1; };
  const STRENGTH_T = { strong: ['Strong', '身强'], weak: ['Weak', '身弱'], balanced: ['Balanced', '中和'] };
  const ROW_T = [
    ['DAY MASTER / TEN GOD', '干神'], ['STEM', '天干'], ['BRANCH', '地支'], ['HIDDEN STEMS', '藏干'],
    ['BRANCH TEN GODS', '支神'], ['SOUND-ELEMENT', '纳音'], ['VOID', '空亡'], ['TERRAIN', '地势'],
    ['SELF-SEAT', '自坐'], ['STARS', '神煞'],
  ];
  function baziDetailHTML(chart) {
    const pillars = [chart.year, chart.month, chart.day, chart.hour].filter(Boolean);
    const dayStem = chart.day.stem;
    const shenshaTags = computeShensha(pillars);
    const cols = pillars.map((p, i) => {
      const idx = ganzhiIndex(p.stem, p.branch);
      const hidden = HIDDEN_STEMS[p.branch];
      const ny = nayinOf(idx);
      const kw = kongWangOf(idx);
      const ganShen = i === 2
        ? `<b class="dm">${T('SELF', '男/女主')}</b>`
        : `${T(TEN_GOD_EN[tenGodOfStem(dayStem, p.stem)], TEN_GOD_ZH[tenGodOfStem(dayStem, p.stem)])}`;
      const zhiShen = hidden.map((hs) => T(TEN_GOD_EN[tenGodOfStem(dayStem, hs)], TEN_GOD_ZH[tenGodOfStem(dayStem, hs)])).join('<br>');
      const cangGan = hidden.map((hs) => `${STEMS[hs]}·${T(ELEMENTS_EN[STEM_ELEMENT[hs]], ELEMENTS_ZH[STEM_ELEMENT[hs]])}`).join('<br>');
      const diShi = twelveStage(dayStem, p.branch);
      const ziZuo = twelveStage(p.stem, p.branch);
      const stars = (shenshaTags[i] || []).map((zh) => T(SHENSHA_EN[zh] || zh, zh)).join('<br>') || '—';
      return {
        ganShen, tianGan: `<span class="e-${STEM_ELEMENT[p.stem]}">${STEMS[p.stem]}</span>`,
        diZhi: `<span class="e-${BRANCH_ELEMENT[p.branch]}">${BRANCHES[p.branch]}</span>`,
        cangGan, zhiShen,
        nayin: `${ny.zh}<br><small>${T(ny.en, '')}</small>`,
        kongWang: kw.map((b) => BRANCHES[b]).join(''),
        diShi: T(STAGE_EN[diShi], STAGE_ZH[diShi]),
        ziZuo: T(STAGE_EN[ziZuo], STAGE_ZH[ziZuo]),
        stars,
      };
    });
    const head = `<tr><th></th>${pillars.map((p, i) => `<th>${T(...PILLAR_T[i])}</th>`).join('')}</tr>`;
    const rowKeys = ['ganShen', 'tianGan', 'diZhi', 'cangGan', 'zhiShen', 'nayin', 'kongWang', 'diShi', 'ziZuo', 'stars'];
    const body = rowKeys.map((key, ri) => `<tr><th>${T(...ROW_T[ri])}</th>${cols.map((c) => `<td>${c[key]}</td>`).join('')}</tr>`).join('');

    const stemRel = stemRelations(pillars.map((p) => p.stem));
    const branchRel = branchRelations(pillars.map((p) => p.branch));
    const relHTML = `
      <div class="bz-rel"><span class="bz-rel-t">${T('STEMS', '天干')}</span>${stemRel.length ? stemRel.map((r) => r.text).join(' · ') : T('none', '无')}</div>
      <div class="bz-rel"><span class="bz-rel-t">${T('BRANCHES', '地支')}</span>${branchRel.length ? branchRel.map((r) => r.text).join(' · ') : T('none', '无')}</div>`;

    const season = seasonalStrength(chart.month.branch);
    const seasonHTML = `<div class="bz-season">${[0, 1, 2, 3, 4].map((el) =>
      `<span class="e-${el}">${T(ELEMENTS_EN[el], ELEMENTS_ZH[el])}${T(SEASON_STAGE_EN[season[el]], SEASON_STAGE_ZH[season[el]])}</span>`).join('')}</div>`;

    const za = ziPingAnalysis(pillars);
    const strengthHTML = `
      <div class="bz-strength">
        <div class="bz-score"><b>${za.score}</b><span>${T('BALANCE SCORE (simplified)', '五行平衡分（简化）')}</span></div>
        <div class="bz-strength-text">
          <p>${T(
            `Day master ${STEMS[dayStem]} (${ELEMENTS_EN[STEM_ELEMENT[dayStem]]}) reads as <b>${T(...STRENGTH_T[za.strength])}</b>. Simplified pattern: <b>${za.pattern.en}</b>.`,
            `日主${STEMS[dayStem]}（${ELEMENTS_ZH[STEM_ELEMENT[dayStem]]}），命局判断为<b>${T(...STRENGTH_T[za.strength])}</b>。简化格局：<b>${za.pattern.zh}</b>。`
          )}</p>
          <p>${T(
            `Favorable elements (喜用神): ${za.favorable.map((e) => e.en).join(', ')}. Elements to watch (忌神): ${za.unfavorable.map((e) => e.en).join(', ')}.`,
            `喜用神：${za.favorable.map((e) => e.zh).join('、')}。忌神：${za.unfavorable.map((e) => e.zh).join('、')}。`
          )}</p>
        </div>
      </div>
      <p class="bz-caveat">${T(
        'Simplified 扶抑法 read (support-vs-drain), not a full professional 格局/用神 determination (which also weighs 调候/通关). The 0-100 score is an original at-a-glance simplification with no traditional basis. Entertainment only.',
        '这是简化版「扶抑法」身强身弱判断，并非完整的专业格局/用神定法（未计入调候、通关等因素）。0-100 分是本站为方便一眼查看而设计的简化量化指标，非传统命理方法本身。仅供娱乐。'
      )}</p>`;

    return `<div class="bz-table-wrap"><table class="bz-table">${head}${body}</table></div>${relHTML}${seasonHTML}${strengthHTML}`;
  }

  const identityChipsHTML = (chart, m, d) => {
    const zi = zodiacIndex(m, d);
    return `<span class="elem">☾ ${T(ANIMALS_EN[chart.animal], '属' + ANIMALS_ZH[chart.animal])}</span>`
      + `<span class="elem">✦ ${T(ZODIAC_EN[zi], ZODIAC_ZH[zi] + '座')}</span>`;
  };

  function renderMine() {
    if (!state.me) return;
    const f = dailyFortune(state.me, todayStr());
    $('mineSec').hidden = false;

    $('todayGz').textContent = T('Today: ', '今日 ') + pillarName(f.todayPillar) + T(' day', '日');
    $('todayRel').textContent = '· ' + T(...[REL_T[f.relation][0], REL_T[f.relation][1]]);
    const n = bumpStreak();
    const sc = $('streakChip'); sc.hidden = false;
    sc.textContent = T(`◆ ${n}-day streak`, `◆ 连续观星 ${n} 天`);

    // pillars
    $('pillarRow').innerHTML = pillarCardsHTML(f.chart);

    // element tally + identity chips
    $('elemRow').innerHTML = f.chart.elements.map((n2, i) =>
      `<span class="elem"><i class="e-${i}"></i>${T(ELEMENTS_EN[i], ELEMENTS_ZH[i])} × ${n2}</span>`).join('')
      + identityChipsHTML(f.chart, state.me.m, state.me.d);

    // 生辰详批 (子平法): ten gods, hidden stems, nayin, void, twelve stages,
    // seasonal strength, relations, shensha, simplified strength/pattern read.
    $('bzWrap').innerHTML = baziDetailHTML(f.chart);

    // overall ring
    const C = 2 * Math.PI * 42;
    const ring = $('oRing');
    ring.style.strokeDasharray = C.toFixed(1);
    ring.style.strokeDashoffset = C.toFixed(1);
    requestAnimationFrame(() => requestAnimationFrame(() => { ring.style.strokeDashoffset = (C * (1 - f.overall.score / 100)).toFixed(1); }));
    $('oScore').textContent = f.overall.score;
    $('oText').textContent = T(f.overall.en, f.overall.zh);

    // domains
    $('domRow').innerHTML = f.domains.map((d) =>
      `<div class="dom ${d.tone}"><div class="dh"><span class="dn">${T(...DOM_NAMES[d.id])}</span><span class="ds">${d.score}</span></div><div class="bar"><i data-w="${d.score}"></i></div><p>${T(d.en, d.zh)}</p></div>`).join('');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      $('domRow').querySelectorAll('.bar i').forEach((i) => { i.style.width = i.dataset.w + '%'; });
    }));

    // lucky + yi/ji
    $('luckyRow').innerHTML = [
      `<div class="lk"><span>${T('LUCKY COLOR', '幸运色')}</span><b><i class="sw" style="background:${f.lucky.color.css}"></i>${T(f.lucky.color.en, f.lucky.color.zh)}</b></div>`,
      `<div class="lk"><span>${T('NOURISHING ELEMENT', '相生之行')}</span><b>${T(f.lucky.element.en, f.lucky.element.zh)}</b></div>`,
      `<div class="lk"><span>${T('LUCKY NUMBER', '幸运数')}</span><b>${f.lucky.number}</b></div>`,
      `<div class="lk"><span>${T('DIRECTION', '吉方')}</span><b>${T(f.lucky.direction.en, f.lucky.direction.zh)}</b></div>`,
    ].join('');
    $('yiTxt').textContent = f.yi.map((x) => T(x.en, x.zh)).join(T(' · ', '　'));
    $('jiTxt').textContent = f.ji.map((x) => T(x.en, x.zh)).join(T(' · ', '　'));
  }

  // ---- render: synastry -----------------------------------------------------
  const SYN_PILLAR_T = { romance: ['ROMANCE', '情缘'], marriage: ['MARRIAGE', '婚嫁'], career: ['CAREER', '事业'], wealth: ['WEALTH', '财帛'], health: ['HEALTH', '康健'] };

  function renderSyn() {
    if (!state.me || !state.other) return;
    const s = synastry(state.me, state.other);
    const pull = dailyPull(state.me, state.other, todayStr());
    $('synResult').hidden = false;
    $('synHint').hidden = true;

    // two charts, side by side (left = me, right = them)
    $('synCharts').innerHTML = `
      <div class="syn-chart">
        <div class="syn-chart-h">${T('ME', '我')}</div>
        <div class="pillars pillars--sm">${pillarCardsHTML(s.chartA, 'pillar--sm')}</div>
        <div class="elems">${identityChipsHTML(s.chartA, state.me.m, state.me.d)}</div>
      </div>
      <div class="syn-divider" aria-hidden="true">❖</div>
      <div class="syn-chart">
        <div class="syn-chart-h">${T('THEM', '对方')}</div>
        <div class="pillars pillars--sm">${pillarCardsHTML(s.chartB, 'pillar--sm')}</div>
        <div class="elems">${identityChipsHTML(s.chartB, state.other.m, state.other.d)}</div>
      </div>`;

    const C = 2 * Math.PI * 58;
    const ring = $('sRing');
    ring.style.strokeDasharray = C.toFixed(1);
    ring.style.strokeDashoffset = C.toFixed(1);
    requestAnimationFrame(() => requestAnimationFrame(() => { ring.style.strokeDashoffset = (C * (1 - s.base / 100)).toFixed(1); }));
    $('sScore').textContent = s.base;

    $('synParts').innerHTML = s.parts.map((p) =>
      `<div class="sp ${p.pts > 0 ? 'pos' : p.pts < 0 ? 'neg' : ''}"><span>${T(p.en, p.zh)}</span><b>${p.pts > 0 ? '+' : ''}${p.pts}</b></div>`).join('');
    $('synPillars').innerHTML = s.pillars.map((p) =>
      `<div class="spil"><div class="n">${T(...SYN_PILLAR_T[p.id])}</div><div class="s">${p.score}</div></div>`).join('');
    $('pullScore').textContent = pull.score;
    $('pullTxt').textContent = T(
      `Today's pull — under a ${pull.todayElement.en}-day sky. Changes daily; come back tomorrow.`,
      `今日引力——${pull.todayElement.zh}气当令。每日一变，明日再来。`);
  }

  // ---- share link ------------------------------------------------------------
  $('shareBtn').addEventListener('click', async () => {
    if (!state.me || !state.other) return;
    const url = `${location.origin}${location.pathname}?p=${encodeShare(state.me, state.other)}`;
    let ok = false;
    try { await navigator.clipboard.writeText(url); ok = true; } catch {}
    if (!ok) { try { const ta = document.createElement('textarea'); ta.value = url; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); ok = true; } catch {} }
    $('shareTip').textContent = ok ? T('Copied — send it to them.', '已复制——发给对方吧。') : url;
  });

  // ---- forms -------------------------------------------------------------------
  $('birthForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const b = parseBirth($('bDate').value, $('bHour').value, $('bTz').value, $('bDst').checked);
    if (!b) return;
    state.me = b; saveProfile(b);
    renderMine(); renderSyn();
  });
  $('synForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!state.me) { $('synHint').textContent = T('Cast your own chart above first — synastry needs both.', '先在上方立好自己的盘——合盘需要两个人。'); return; }
    const b = parseBirth($('sDate').value, $('sHour').value, $('sTz').value, $('sDst').checked);
    if (!b) return;
    state.other = b;
    renderSyn();
  });

  const fillForm = (prefix, b) => {
    const p = (x) => String(x).padStart(2, '0');
    $(prefix + 'Date').value = `${b.y}-${p(b.m)}-${p(b.d)}`;
    $(prefix + 'Hour').value = b.hour == null ? '' : String(b.hour);
  };

  // ---- boot: shared link beats saved profile ------------------------------------
  const shared = (() => { try { return decodeShare(new URLSearchParams(location.search).get('p') || ''); } catch { return null; } })();
  if (shared) {
    state.me = shared.a; state.other = shared.b;
    fillForm('b', shared.a); fillForm('s', shared.b);
    renderMine(); renderSyn();
    try { $('synSec').scrollIntoView({ block: 'start' }); } catch {}
  } else {
    const saved = loadProfile();
    if (saved && parseBirth(`${saved.y}-${String(saved.m).padStart(2, '0')}-${String(saved.d).padStart(2, '0')}`, saved.hour == null ? '' : String(saved.hour))) {
      state.me = saved; fillForm('b', saved); renderMine();
    }
  }

  window.addEventListener('afflatus-lang', (e) => {
    state.lang = e.detail === 'zh' ? 'zh' : 'en';
    renderMine(); renderSyn();
  });
})();
