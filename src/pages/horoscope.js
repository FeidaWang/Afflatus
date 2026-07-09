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
  tenGodDistribution,
} from '../lib/ziping.js';
import { SHENSHA_RARITY } from '../lib/shenshaRarity.js';
import { computeDayun, liunianPillar, taisuiRelation, pairRelations, TAISUI_ZH, TAISUI_EN } from '../lib/dayun.js';
import { solarToLunar } from '../lib/lunar.js';
import { dailyXiu, natalXiu, xiuRelation, XIU27_ZH, XIU28_ZH, XIU_REL } from '../lib/xiu.js';
import { PERSONA_QUESTIONS, scorePersona, PERSONA_TYPES, AXIS_LETTERS } from '../lib/persona.js';
import { cstToJD, sunLongitude, moonLongitude, ascendant, signOf, degInSign, aspectBetween, ASPECT_T } from '../lib/astro.js';
import { personalityTags, dimensionScores } from '../lib/astroReadings.js';
import { renderRadar, renderWheel, renderAspectGrid, PLANET_GLYPH, ZODIAC_GLYPH } from '../lib/astroChart.js';
import { crossAspects, relationshipTitle, resonanceScore, attractionLines, redFlagLines, davisonReading } from '../lib/synastryAstro.js';
import { dailyCoupleWeather } from '../lib/dailyTransits.js';
import { dailyDraw } from '../lib/starDraw.js';
import { computeZiwei, ZW_STARS_ZH, ZW_STAR_READS, JU_ZH } from '../lib/ziwei.js';
import { downloadShareCard } from '../lib/shareCard.js';

(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  if (!$('birthForm')) return;

  const PROFILE_KEY = 'afflatus-horo:me';
  const STREAK_KEY = 'afflatus-horo:streak';
  // V23 Phase 2: 关系册 — named "other" profiles saved locally, so a return
  // visit is one click instead of retyping a birthday. Scope decision (see
  // roadmap.md): every book entry pairs against 'me' — this single-page tool
  // has always been a me-vs-other flow (no third-party account picker), so
  // "select two from the book" would need a whole new UI concept; saving +
  // quick-reloading "the other person" covers the actual retention need
  // (re-visiting a synastry you've already cast) without that added surface.
  const BOOK_KEY = 'afflatus-horo:book';
  const state = {
    lang: (window.AfflatusI18N && window.AfflatusI18N.get && window.AfflatusI18N.get()) || 'en',
    me: null, other: null,
  };
  const T = (en, zh) => (state.lang === 'zh' ? zh : en);
  const todayStr = () => { const d = new Date(); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
  const dateStrPlus = (n) => { const d = new Date(); d.setDate(d.getDate() + n); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

  // ---- GA event tracking (V23 Phase 4, roadmap module 2 "北极星指标"/"护栏指标") --
  // window.gtag is defined synchronously by the idle-deferred snippet in
  // <head> (ROADMAP §9 SEO Phase 1) even before the GA script itself has
  // loaded — calling it here just queues into dataLayer, safe at any time.
  const track = (name, params) => { try { window.gtag && window.gtag('event', name, params || {}); } catch {} };

  // ---- transits-daily.json (V23 Phase 3) ------------------------------------
  // Fetched once, cached for the whole session — it's a <2KB static JSON
  // (scripts/gen-transits-daily.mjs, refreshed by a daily scheduled task),
  // not an ephemeris library, so this carries no bundle-weight concern.
  let transitsPromise = null;
  const ensureTransits = () => transitsPromise || (transitsPromise = fetch('/transits-daily.json').then((r) => (r.ok ? r.json() : null)).catch(() => null));

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

  // ---- 关系册 (V23 Phase 2) --------------------------------------------------
  const loadBook = () => { try { return JSON.parse(localStorage.getItem(BOOK_KEY)) || []; } catch { return []; } };
  const saveBook = (list) => { try { localStorage.setItem(BOOK_KEY, JSON.stringify(list.slice(0, 20))); } catch {} };
  // upsert by (y,m,d,hour) identity — re-saving the same birthday just renames/updates it
  function upsertBook(name, other) {
    if (!name) return;
    const list = loadBook();
    const sameBirth = (e) => e.y === other.y && e.m === other.m && e.d === other.d && e.hour === other.hour;
    const idx = list.findIndex(sameBirth);
    const entry = { name: String(name).slice(0, 12), y: other.y, m: other.m, d: other.d, hour: other.hour };
    if (idx >= 0) list[idx] = entry; else list.unshift(entry);
    saveBook(list);
    renderBook();
  }
  function removeFromBook(i) {
    const list = loadBook();
    list.splice(i, 1);
    saveBook(list);
    renderBook();
  }
  function renderBook() {
    const wrap = $('synBook');
    if (!wrap) return;
    const list = loadBook();
    if (!list.length) { wrap.hidden = true; wrap.innerHTML = ''; return; }
    wrap.hidden = false;
    wrap.innerHTML = `<div class="syn-book-h">${T('SAVED · TAP TO RE-CAST', '关系册 · 点击重新出盘')}</div>` +
      list.map((e, i) => {
        const label = e.hour == null ? `${e.y}-${String(e.m).padStart(2, '0')}-${String(e.d).padStart(2, '0')}` : `${e.y}-${String(e.m).padStart(2, '0')}-${String(e.d).padStart(2, '0')} · ${e.hour}h`;
        return `<span class="syn-book-chip"><button type="button" class="syn-book-load" data-i="${i}">${e.name}<small>${label}</small></button><button type="button" class="syn-book-del" data-i="${i}" aria-label="${T('remove', '删除')}">×</button></span>`;
      }).join('');
    wrap.querySelectorAll('.syn-book-load').forEach((btn) => btn.addEventListener('click', () => {
      const e = list[+btn.dataset.i];
      if (!e) return;
      fillForm('s', e);
      $('sName').value = e.name;
      castSynastry({ y: e.y, m: e.m, d: e.d, hour: e.hour });
    }));
    wrap.querySelectorAll('.syn-book-del').forEach((btn) => btn.addEventListener('click', () => removeFromBook(+btn.dataset.i)));
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
  // Shensha rarity badge: tier from the precomputed uniform-sample frequency
  // (src/lib/shenshaRarity.js, generated by scripts/gen-shensha-rarity.mjs).
  const RAR_T = [['Common', '常见'], ['Frequent', '多见'], ['Uncommon', '少见'], ['Rare', '稀有']];
  const rarityTier = (f) => (f >= 0.40 ? 0 : f >= 0.25 ? 1 : f >= 0.10 ? 2 : 3);
  const shenshaWithBadge = (zh) => {
    const f = SHENSHA_RARITY[zh];
    const badge = f == null ? '' : `<small class="rar rar-${rarityTier(f)}">${T(...RAR_T[rarityTier(f)])}</small>`;
    return `${T(SHENSHA_EN[zh] || zh, zh)}${badge}`;
  };
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
      const stars = (shenshaTags[i] || []).map(shenshaWithBadge).join('<br>') || '—';
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

    // ten-god weighted distribution (十神占比), sorted descending
    const dist = tenGodDistribution(pillars);
    const distHTML = `<div class="bz-gods-h">${T('TEN-GOD DISTRIBUTION · 十神占比', '十神占比')}</div><div class="bz-gods">`
      + dist.map((f, g) => ({ f, g })).sort((a, b) => b.f - a.f).map(({ f, g }) =>
        `<div class="bzg"><span class="bzg-n">${T(TEN_GOD_EN[g], TEN_GOD_ZH[g])}</span><span class="bzg-bar"><i style="width:${Math.round(f * 100)}%"></i></span><b class="bzg-v">${(f * 100).toFixed(1)}%</b></div>`).join('')
      + '</div>';

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
          ${za.tiaohou ? `<p>${T(za.tiaohou.en + '.', za.tiaohou.zh + '。')}</p>` : ''}
        </div>
      </div>
      <p class="bz-caveat">${T(
        'Simplified 扶抑法 read (support-vs-drain), not a full professional 格局/用神 determination (which also weighs 调候/通关). The 0-100 score is an original at-a-glance simplification with no traditional basis. Entertainment only.',
        '这是简化版「扶抑法」身强身弱判断，并非完整的专业格局/用神定法（未计入调候、通关等因素）。0-100 分是本站为方便一眼查看而设计的简化量化指标，非传统命理方法本身。仅供娱乐。'
      )}</p>`;

    return `<div class="bz-table-wrap"><table class="bz-table">${head}${body}</table></div>${distHTML}${relHTML}${seasonHTML}${strengthHTML}
      <p class="bz-caveat">${T(
        'Shensha rarity badges are frequency estimates over a uniform synthetic birth sample (1950–2009), not real-population statistics.',
        '神煞稀有度徽标为 1950–2009 均匀出生样本的出现频率估算，非真实人口统计。'
      )}</p>`;
  }

  // ---- 大运流年 (V21 Phase 2) ----------------------------------------------
  // Gender decides the cycle direction, so the block renders only when the
  // person has chosen one. Gender lives in the local profile ONLY — it is
  // deliberately NOT part of the share-code schema (it doesn't affect the
  // synastry pairing, and keeping it out avoids a schema version bump).
  function dayunHTML(me) {
    if (!me.gender) {
      return `<p class="form-note">${T(
        'Pick a gender above and re-cast to see luck cycles — the cycle direction (forward/backward) is defined by gender in the traditional method.',
        '在上方选择性别并重新起盘即可排大运——大运顺行/逆行按传统方法由性别确定。'
      )}</p>`;
    }
    const dy = computeDayun(me, me.gender);
    if (!dy) return '';
    const nowYear = new Date().getFullYear();
    const natalBranches = [dy.chart.year, dy.chart.month, dy.chart.day, dy.chart.hour].filter(Boolean).map((p) => p.branch);

    const startLine = `<p class="dy-start">${T(
      `${dy.direction === 1 ? 'Forward' : 'Backward'} cycles · first luck pillar begins around age ${dy.startAge.years}y ${dy.startAge.months}m (≈${dy.startYear})${me.hour == null ? ' · hour unknown, start age is approximate' : ''}.`,
      `${dy.direction === 1 ? '顺行' : '逆行'}排运 · 约 ${dy.startAge.years} 岁 ${dy.startAge.months} 个月起运（约 ${dy.startYear} 年）${me.hour == null ? '·未填时辰，起运岁数为近似值' : ''}。`
    )}</p>`;

    const tiles = `<div class="dy-row">${dy.pillars.map((p) => {
      const cur = nowYear >= p.fromYear && nowYear <= p.toYear;
      return `<div class="dy${cur ? ' dy-cur' : ''}"><span class="dy-age">${T(`${p.fromAge}`, `${p.fromAge}岁`)}</span><span class="dy-gz e-${STEM_ELEMENT[p.stem]}">${p.gz}</span><span class="dy-yr">${p.fromYear}</span></div>`;
    }).join('')}</div>`;

    const yearBlock = (yr) => {
      const ln = liunianPillar(yr);
      const ts = taisuiRelation(ln.branch, dy.chart.year.branch);
      const rel = pairRelations(ln.branch, natalBranches);
      const badges = ts.map((k) => `<span class="ta-badge">${T(TAISUI_EN[k], TAISUI_ZH[k])}</span>`).join('');
      return `<div class="dy-ln${yr === nowYear ? ' dy-ln--now' : ''}">
        <div class="dy-ln-h">${yr}${T('', ' 年')} · ${ln.gz} · ${T(ANIMALS_EN[ln.branch], ANIMALS_ZH[ln.branch] + '年')}${badges}</div>
        <div class="dy-ln-b">${rel.length ? T('vs your chart: ', '与命局：') + rel.join(' · ') : T('no clash/combo with your chart branches', '与命局地支无明显刑冲合害')}</div>
      </div>`;
    };

    return startLine + tiles + `<div class="dy-lns">${yearBlock(nowYear)}${yearBlock(nowYear + 1)}</div>`;
  }

  // ---- 日月升星盘 (V21 Phase 5) ---------------------------------------------
  // Sun/Moon/Rising only (planets deferred — see src/lib/astro.js header).
  // Lat/lon are local-profile-only fields like gender: they don't affect the
  // synastry pairing, so they stay out of the share-code schema.
  const signLabel = (lon) => {
    const s = signOf(lon);
    return `${T(ZODIAC_EN[s], ZODIAC_ZH[s] + '座')} ${Math.floor(degInSign(lon))}°`;
  };
  // ---- V23 Phase 1 (roadmap §7.10): single-chart L1/L2/L3 progressive
  // disclosure. L1/L2 use only the existing light Sun/Moon/Ascendant calc
  // (astro.js) + the bazi element tally — zero jargon, zero ephemeris
  // dependency. L3 is gated behind an explicit PRO toggle that dynamically
  // imports astroPlanets.ts (and with it astronomy-engine) only on first
  // expand, per the roadmap's dynamic-import discipline.
  const PLANET_ZH = { Sun: '太阳', Moon: '月亮', Mercury: '水星', Venus: '金星', Mars: '火星', Jupiter: '木星', Saturn: '土星', Uranus: '天王星', Neptune: '海王星', Pluto: '冥王星' };

  function l1HTML(me, sun, moon, ascDeg) {
    const hourMissing = me.hour == null;
    let risingHTML;
    if (hourMissing) {
      risingHTML = `<span class="l1-miss">${T('needs birth hour', '需填时辰')}</span>`;
    } else if (ascDeg == null) {
      risingHTML = `<span class="l1-miss">${T('needs birthplace lat/lon above', '需在上方填出生地经纬度')}</span>`;
    } else {
      risingHTML = signLabel(ascDeg);
    }
    const tags = personalityTags({
      sunSign: signOf(sun), moonSign: signOf(moon),
      ascSign: ascDeg == null ? null : signOf(ascDeg),
      elements: state.mineChart ? state.mineChart.elements : null,
    });
    return `<div class="l1-big3">
        <div class="l1-card"><span class="t">☉ ${T('SUN', '太阳')}</span><b>${signLabel(sun)}</b></div>
        <div class="l1-card"><span class="t">☾ ${T('MOON', '月亮')}</span><b>${signLabel(moon)}</b>${hourMissing ? `<small>${T('hour unknown — noon approximation; can be off if the moon changed signs that day', '未填时辰，按正午近似——当日月亮换座时可能有偏差')}</small>` : ''}</div>
        <div class="l1-card"><span class="t">↗ ${T('RISING', '上升')}</span><b>${risingHTML}</b></div>
      </div>
      <div class="l1-tags">${tags.map((t) => `<span class="l1-tag">${T(t.en, t.zh)}</span>`).join('')}</div>
      <p class="bz-caveat">${T('Tropical zodiac, whole-sign display — entertainment read from Sun/Moon/Rising. Tap PRO below for the full planetary chart.', '回归黄道、整宫制显示——基于日月升的娱乐向解读。完整行星星盘见下方 PRO 展开。')}</p>`;
  }

  function l2HTML(sun, moon, ascDeg) {
    const dims = dimensionScores({
      sunSign: signOf(sun), moonSign: signOf(moon),
      ascSign: ascDeg == null ? null : signOf(ascDeg),
      elements: state.mineChart ? state.mineChart.elements : null,
    });
    const radar = renderRadar(dims.map((d) => ({ key: d.key, label: T(d.label.en, d.label.zh), value: d.value })));
    const rows = dims.map((d) => `<div class="l2-dim" data-dim="${d.key}"><div class="dh"><span class="dn">${T(d.label.en, d.label.zh)}</span><span class="dv">${d.value}</span></div><p>${T(d.text.en, d.text.zh)}</p></div>`).join('');
    return `<div class="l2-radar-wrap"><div class="l2-radar">${radar}</div><div class="l2-detail">${rows}</div></div>`;
  }

  // combined Sun/Moon (from astro.js, always available) + Mercury..Pluto
  // (from the dynamically-loaded astroPlanets.ts, cached in state.l3)
  function l3AllPlanets() {
    return [{ body: 'Sun', lonDeg: state.l1Sun, retro: false }, { body: 'Moon', lonDeg: state.l1Moon, retro: false }, ...(state.l3 ? state.l3.planets : [])];
  }

  function renderL3Body() {
    if (!state.l3 || !state.l3.planets) return;
    const ascDeg = state.l3.ascDeg;
    const all = l3AllPlanets();
    const legend = all.map((p) => `<span>${PLANET_GLYPH[p.body] || p.body[0]} ${T(p.body, PLANET_ZH[p.body] || p.body)}</span>`).join('');
    const seen = new Set(); const terms = [];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const a = aspectBetween(all[i].lonDeg, all[j].lonDeg);
      if (a && !seen.has(a.key)) { seen.add(a.key); terms.push(a.key); }
    }
    const termsHTML = terms.map((k) => `<div class="l3-term"><b>${T(ASPECT_T[k].en, ASPECT_T[k].zh)}</b> — ${T(ASPECT_T[k].dEn, ASPECT_T[k].dZh)}</div>`).join('')
      || `<div class="l3-term">${T('No major aspects within orb right now.', '当前无明显相位。')}</div>`;
    $('l3Body').innerHTML = `<div class="l3-wheel-card">${renderWheel({ ascDeg: ascDeg == null ? 0 : ascDeg, planets: all })}<div class="l3-legend">${legend}</div></div>`
      + (ascDeg == null ? `<p class="bz-caveat">${T('Ascendant unknown (need birth hour + lat/lon above) — houses shown from 0° Aries.', '上升未知（需时辰+经纬度）——宫位按白羊 0° 起算。')}</p>` : '')
      + `<div class="l3-grid-wrap">${renderAspectGrid(all)}</div>`
      + `<div class="l3-terms">${termsHTML}</div>`;
  }

  // ---- 紫微斗数十二宫 (V21 Phase 6) ------------------------------------------
  // 4×4 grid: the 12 palaces ring the outside (classical layout, 巳 at the
  // top-left corner going clockwise), the 2×2 centre holds chart meta.
  // Grid ring order (row-major positions 0-15; -1 = centre):
  const ZW_GRID = [5, 6, 7, 8, 4, -1, -1, 9, 3, -1, -1, 10, 2, 1, 0, 11]; // branch idx per cell
  const ZW_STAR_EN = ['Ziwei', 'Tianji', 'Sun', 'Wuqu', 'Tiantong', 'Lianzhen', 'Tianfu', 'Moon', 'Tanlang', 'Jumen', 'Tianxiang', 'Tianliang', 'Qisha', 'Pojun'];
  function ziweiHTML(me) {
    if (me.hour == null) {
      return `<p class="form-note">${T(
        'Ziwei needs the birth hour — the hour branch places the life palace. Pick your 时辰 above and re-cast.',
        '紫微斗数需要时辰——时支决定命宫位置。在上方选择时辰后重新起盘即可。'
      )}</p>`;
    }
    const z = computeZiwei(me);
    if (!z) return '';
    const cells = ZW_GRID.map((b, i) => {
      if (b === -1) {
        if (i !== 5) return ''; // centre spans via CSS grid-area on the first centre cell
        return `<div class="zw-center">
          <div class="zw-c-ju">${JU_ZH[z.ju]}</div>
          <div class="zw-c-l">${T(`Lunar: month ${z.lunar.lMonth} day ${z.lunar.lDay}`, `农历 ${z.lunar.monthZh}${z.lunar.dayZh}`)}</div>
          <div class="zw-c-l">${T('Life palace', '命宫')} · ${STEMS[z.mingStem]}${BRANCHES[z.ming]}</div>
          <div class="zw-c-l">${T('Body palace', '身宫')} · ${BRANCHES[z.shen]}</div>
        </div>`;
      }
      const p = z.palaces[b];
      const isMing = b === z.ming;
      const stars = p.stars.map((si) => `<span class="zw-star">${T(ZW_STAR_EN[si], ZW_STARS_ZH[si])}</span>`).join('') || `<span class="zw-empty">${T('—', '（空宫）')}</span>`;
      return `<div class="zw-cell${isMing ? ' zw-ming' : ''}${b === z.shen ? ' zw-shen' : ''}">
        <div class="zw-h"><span class="zw-p">${T(p.nameEn, p.name)}</span><span class="zw-b">${STEMS[p.stem]}${BRANCHES[b]}</span></div>
        <div class="zw-stars">${stars}</div>
      </div>`;
    }).join('');
    // life-palace major stars, one-line reads (borrowed palace note if empty)
    const mingStars = z.palaces[z.ming].stars;
    const readSrc = mingStars.length ? mingStars : z.palaces[mod2(z.ming + 6)].stars;
    const borrowed = !mingStars.length;
    const reads = readSrc.map((si) => `<div class="xiu-row"><b>${T(ZW_STAR_EN[si], ZW_STARS_ZH[si])}</b><span class="xiu-d">${T(ZW_STAR_READS[ZW_STARS_ZH[si]].en, ZW_STAR_READS[ZW_STARS_ZH[si]].zh)}</span></div>`).join('');
    return `<div class="zw-grid">${cells}</div>
      ${reads ? `<div class="xiu-h" style="margin-top:12px">${T(borrowed ? 'LIFE PALACE (borrowing the opposite palace) · 命宫主星' : 'LIFE-PALACE STARS · 命宫主星', borrowed ? '命宫主星（命宫无主星，借对宫看）' : '命宫主星')}</div>${reads}` : ''}
      <p class="bz-caveat">${T(
        '14 major stars only (entry-level chart) — minor stars and the four transformations are a planned follow-up. Year pillar follows the lunar-year convention; verified against an independent ziwei library over 400 charts.',
        '入门版仅安十四主星——辅星与四化为后续计划。年柱按农历年惯例；实现与独立紫微库 400 盘对照一致。'
      )}</p>`;
  }
  const mod2 = (n) => ((n % 12) + 12) % 12;

  // Natal mansion (本命宿, V21 Phase 3) — needs the birth date's lunar form.
  // A leap-month birth uses its host month number (documented convention in
  // src/lib/xiu.js). Returns null outside the lunar table's 1900–2100 range.
  const natalXiuOf = (y, m, d) => {
    const l = solarToLunar(y, m, d);
    return l ? natalXiu(l.lMonth, l.lDay) : null;
  };
  const identityChipsHTML = (chart, y, m, d) => {
    const zi = zodiacIndex(m, d);
    const nx = natalXiuOf(y, m, d);
    return `<span class="elem">☾ ${T(ANIMALS_EN[chart.animal], '属' + ANIMALS_ZH[chart.animal])}</span>`
      + `<span class="elem">✦ ${T(ZODIAC_EN[zi], ZODIAC_ZH[zi] + '座')}</span>`
      + (nx == null ? '' : `<span class="elem">☘ ${T(`${XIU27_ZH[nx]} mansion`, '本命·' + XIU27_ZH[nx] + '宿')}</span>`);
  };

  function renderMine() {
    if (!state.me) return;
    const f = dailyFortune(state.me, todayStr());
    state.mineChart = f.chart; // kept for the share-card button
    $('mineSec').hidden = false;

    $('todayGz').textContent = T('Today: ', '今日 ') + pillarName(f.todayPillar) + T(' day', '日');
    const [ty, tm, td] = todayStr().split('-').map(Number);
    const tx = XIU28_ZH[dailyXiu(ty, tm, td)];
    $('todayRel').textContent = '· ' + T(...[REL_T[f.relation][0], REL_T[f.relation][1]])
      + ' · ' + T(`mansion of the day: ${tx}`, `值日宿：${tx}宿`);
    const n = bumpStreak();
    track('streak_day', { streak: n }); // guardrail metric: streak>=3 share (roadmap module 2)
    const sc = $('streakChip'); sc.hidden = false;
    sc.textContent = T(`◆ ${n}-day streak`, `◆ 连续观星 ${n} 天`);

    // 每日星语签 (V23 Phase 3): deterministic daily card draw, reuses the
    // streak counter above (7+ days unlocks a shot at the hidden pool).
    const birthKey = `${state.me.y}-${state.me.m}-${state.me.d}-${state.me.hour ?? 'x'}`;
    const draw = dailyDraw({ dateStr: todayStr(), birthKey, streak: n });
    // V23 Phase 4: streak loss-aversion microcopy (roadmap Tier 0 recall) —
    // only shown while it's still true (a real countdown, not evergreen
    // nagging): counts down to the hidden-card unlock at streak 7.
    const streakHint = draw.hidden
      ? '' : n < 7
        ? `<p class="sd-streak-hint">${T(`${n}-day streak — ${7 - n} more to unlock a hidden card`, `连续 ${n} 天，还差 ${7 - n} 天解锁隐藏签面`)}</p>`
        : `<p class="sd-streak-hint">${T('Hidden cards unlocked — keep the streak for another shot', '隐藏签面已解锁——继续保持连续签到，还有机会再抽到')}</p>`;
    $('starDrawWrap').innerHTML = `<div class="sd-card${draw.hidden ? ' sd-hidden' : ''}">
      <span class="sd-glyph" aria-hidden="true">${draw.card.glyph}</span>
      <div class="sd-body">
        <div class="sd-name">${T(draw.card.en, draw.card.zh)}${draw.hidden ? `<em class="sd-badge">${T('HIDDEN', '隐藏签')}</em>` : ''}</div>
        <p class="sd-advice">${T(draw.advice.en, draw.advice.zh)}</p>
        ${streakHint}
      </div>
    </div>`;

    // pillars
    $('pillarRow').innerHTML = pillarCardsHTML(f.chart);

    // element tally + identity chips
    $('elemRow').innerHTML = f.chart.elements.map((n2, i) =>
      `<span class="elem"><i class="e-${i}"></i>${T(ELEMENTS_EN[i], ELEMENTS_ZH[i])} × ${n2}</span>`).join('')
      + identityChipsHTML(f.chart, state.me.y, state.me.m, state.me.d);

    // 生辰详批 (子平法): ten gods, hidden stems, nayin, void, twelve stages,
    // seasonal strength, relations, shensha, simplified strength/pattern read.
    $('bzWrap').innerHTML = baziDetailHTML(f.chart);

    // 大运流年 (V21 Phase 2)
    $('dyWrap').innerHTML = dayunHTML(state.me);

    // V23 Phase 1: single-chart L1/L2/L3 progressive disclosure
    {
      const jd = cstToJD(state.me.y, state.me.m, state.me.d, state.me.hour);
      const sun = sunLongitude(jd), moon = moonLongitude(jd);
      const ascDeg = (state.me.hour == null || state.me.lat == null || state.me.lon == null) ? null : ascendant(jd, state.me.lat, state.me.lon);
      state.l1Sun = sun; state.l1Moon = moon;
      $('l1Wrap').innerHTML = l1HTML(state.me, sun, moon, ascDeg);
      $('l2Wrap').innerHTML = l2HTML(sun, moon, ascDeg);
      if (state.l3 && state.l3.jd !== jd) { state.l3 = null; $('l3Body').innerHTML = ''; $('l3Body').classList.remove('open'); $('l3Toggle').setAttribute('aria-expanded', 'false'); }
      state.l3JD = jd; state.l3AscDeg = ascDeg;
      if (state.l3 && state.l3.planets) renderL3Body();
    }

    // 紫微斗数 (V21 Phase 6)
    $('zwWrap').innerHTML = ziweiHTML(state.me);

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

  // Mercury/Venus/Mars come from the dynamically-imported astroPlanets.ts;
  // Sun/Moon reuse the existing light astro.js calc — see the module-level
  // dynamic-import discipline note in astroPlanets.ts.
  async function computeSynAstroLayer(me, other, baziBase) {
    const { planetReading } = await import('../lib/astroPlanets.ts');
    const jdMe = cstToJD(me.y, me.m, me.d, me.hour);
    const jdThem = cstToJD(other.y, other.m, other.d, other.hour);
    const meLons = { Sun: sunLongitude(jdMe), Moon: moonLongitude(jdMe) };
    const themLons = { Sun: sunLongitude(jdThem), Moon: moonLongitude(jdThem) };
    for (const body of ['Mercury', 'Venus', 'Mars']) {
      meLons[body] = planetReading(body, jdMe).lonDeg;
      themLons[body] = planetReading(body, jdThem).lonDeg;
    }
    const aspects = crossAspects(themLons, meLons);
    const jdMid = (jdMe + jdThem) / 2;
    return {
      title: relationshipTitle(aspects),
      score: resonanceScore(baziBase, aspects),
      attraction: attractionLines(aspects),
      flags: redFlagLines(aspects),
      davison: davisonReading(sunLongitude(jdMid), moonLongitude(jdMid)),
    };
  }

  function renderSynAstroSections(data) {
    state.synAstroCard = data; // kept for the share-card button
    $('synTitle').innerHTML = `<b>${T(data.title.en, data.title.zh)}</b>`;
    const C = 2 * Math.PI * 58;
    $('sRing').style.strokeDashoffset = (C * (1 - data.score / 100)).toFixed(1);
    $('sScore').textContent = data.score;

    const attractWrap = $('synAttractWrap');
    if (data.attraction.length) {
      attractWrap.hidden = false;
      $('synAttract').innerHTML = data.attraction.map((l) => `<p class="syn-line syn-line--pos">${T(l.en, l.zh)}</p>`).join('');
    } else attractWrap.hidden = true;

    const flagsWrap = $('synFlagsWrap');
    if (data.flags.length) {
      flagsWrap.hidden = false;
      $('synFlags').innerHTML = data.flags.map((l) => `<p class="syn-line syn-line--neg">${T(l.en, l.zh)}</p>`).join('');
    } else flagsWrap.hidden = true;

    $('synDavisonSec').hidden = false;
    $('synDavisonBody').innerHTML = `<p>${T(data.davison.text.en, data.davison.text.zh)}</p>
      <p class="bz-caveat">${T(
        'Composite from the time-midpoint of both birth moments (Sun/Moon only — a location midpoint/houses may follow). Entertainment only.',
        '取两人出生时刻的时间中点计算（仅日月——地点中点/宫位为可能的后续功能）。仅供娱乐。'
      )}</p>`;
  }

  // 7-day fate calendar (V23 Phase 3, roadmap module 2 point 3): reuses the
  // existing dailyPull() seeded score (horoscopeEngine.js) for 7 dates —
  // today/tomorrow show the real number, days 3-7 are time-locked (not a
  // paywall — the roadmap is explicit: "只做时间解锁") so the page gives a
  // reason to come back rather than dumping the whole week at once.
  function renderSynCalendar() {
    if (!state.me || !state.other) return;
    const cells = [];
    for (let i = 0; i < 7; i++) {
      const dateStr = dateStrPlus(i);
      const pull = dailyPull(state.me, state.other, dateStr);
      const locked = i >= 2;
      const dayLabel = i === 0 ? T('TODAY', '今天') : i === 1 ? T('TMRW', '明天') : `+${i}${T('d', '天')}`;
      cells.push(`<div class="syn-cal-cell${locked ? ' locked' : ''}">
        <span class="scc-d">${dayLabel}</span>
        ${locked
          ? `<span class="scc-v scc-v--locked">···</span><span class="scc-hint">${T(`unlocks in ${i - 1}d`, `${i - 1}天后解锁`)}</span>`
          : `<span class="scc-v">${pull.score}</span>`}
      </div>`);
    }
    $('synCal').innerHTML = cells.join('');
    $('synCalWrap').hidden = false;
  }

  // Best day this week (V23 Phase 4, feeds the ICS button below) — just the
  // argmax of the same dailyPull() sweep renderSynCalendar() already does;
  // no new scoring logic.
  function bestDayThisWeek(me, other) {
    let best = null;
    for (let i = 0; i < 7; i++) {
      const dateStr = dateStrPlus(i);
      const score = dailyPull(me, other, dateStr).score;
      if (!best || score > best.score) best = { dateStr, score };
    }
    return best;
  }

  // Tier 0 recall (V23 Phase 4, roadmap module 2): a client-only .ics file
  // download — no backend, no push notifications. The user's own calendar
  // app is what reminds them; we just hand over one all-day VEVENT.
  function downloadICS(dateStr, summary, description) {
    const ymd = dateStr.replace(/-/g, '');
    const d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate() + 1);
    const p = (x) => String(x).padStart(2, '0');
    const nextDay = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
    const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const uid = `afflatus-${ymd}-${Math.random().toString(36).slice(2)}@feida.au`;
    const esc = (s) => String(s).replace(/([,;])/g, '\\$1');
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Afflatus//Horoscope//EN',
      'BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd}`, `DTEND;VALUE=DATE:${nextDay}`,
      `SUMMARY:${esc(summary)}`, `DESCRIPTION:${esc(description)}`,
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'afflatus-best-day.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  $('icsBtn') && $('icsBtn').addEventListener('click', () => {
    if (!state.me || !state.other) return;
    const best = bestDayThisWeek(state.me, state.other);
    track('ics_subscribed'); // Tier 0 recall guardrail (roadmap module 2)
    downloadICS(
      best.dateStr,
      T('Your best day together — Afflatus', '你们的最佳共处日 · 观星台'),
      T('Generated by feida.au/horoscope.html — entertainment only, not advice.', '由 feida.au/horoscope.html 生成——仅供娱乐，不构成任何建议。')
    );
  });

  function renderSyn() {
    if (!state.me || !state.other) return;
    const s = synastry(state.me, state.other);
    state.synData = s; // kept for the share-card button
    const pull = dailyPull(state.me, state.other, todayStr());
    $('synResult').hidden = false;
    $('synHint').hidden = true;

    // two charts, side by side (left = me, right = them)
    $('synCharts').innerHTML = `
      <div class="syn-chart">
        <div class="syn-chart-h">${T('ME', '我')}</div>
        <div class="pillars pillars--sm">${pillarCardsHTML(s.chartA, 'pillar--sm')}</div>
        <div class="elems">${identityChipsHTML(s.chartA, state.me.y, state.me.m, state.me.d)}</div>
      </div>
      <div class="syn-divider" aria-hidden="true">❖</div>
      <div class="syn-chart">
        <div class="syn-chart-h">${T('THEM', '对方')}</div>
        <div class="pillars pillars--sm">${pillarCardsHTML(s.chartB, 'pillar--sm')}</div>
        <div class="elems">${identityChipsHTML(s.chartB, state.other.y, state.other.m, state.other.d)}</div>
      </div>`;

    const C = 2 * Math.PI * 58;
    const ring = $('sRing');
    ring.style.strokeDasharray = C.toFixed(1);
    ring.style.strokeDashoffset = C.toFixed(1);
    requestAnimationFrame(() => requestAnimationFrame(() => { ring.style.strokeDashoffset = (C * (1 - s.base / 100)).toFixed(1); }));
    $('sScore').textContent = s.base;

    // V23 Phase 2: astro synastry layer — title/resonance/attraction/red-flags/
    // composite. Dynamically imports astroPlanets.ts only now, when a synastry
    // is actually cast (same lazy-load discipline as the L3 PRO natal chart).
    // Cached per (me,other) pair so a language toggle just re-paints instead
    // of re-fetching the ephemeris.
    const pairKey = `${state.me.y}-${state.me.m}-${state.me.d}-${state.me.hour}|${state.other.y}-${state.other.m}-${state.other.d}-${state.other.hour}`;
    if (state.synAstro && state.synAstro.key === pairKey) {
      renderSynAstroSections(state.synAstro.data);
    } else {
      $('synTitle').textContent = T('Reading the sky…', '正在解读星盘……');
      $('synAttractWrap').hidden = true;
      $('synFlagsWrap').hidden = true;
      $('synDavisonSec').hidden = true;
      computeSynAstroLayer(state.me, state.other, s.base).then((data) => {
        state.synAstro = { key: pairKey, data };
        const curKey = state.me && state.other ? `${state.me.y}-${state.me.m}-${state.me.d}-${state.me.hour}|${state.other.y}-${state.other.m}-${state.other.d}-${state.other.hour}` : null;
        if (curKey === pairKey) renderSynAstroSections(data);
        track('synastry_cast', { score: data.score }); // north-star metric (roadmap module 2)
      }).catch(() => { $('synTitle').textContent = T('Could not read the sky — the base bond score above still applies.', '星盘解读失败——上方底盘缘分分数仍然有效。'); });
    }

    $('synParts').innerHTML = s.parts.map((p) =>
      `<div class="sp ${p.pts > 0 ? 'pos' : p.pts < 0 ? 'neg' : ''}"><span>${T(p.en, p.zh)}</span><b>${p.pts > 0 ? '+' : ''}${p.pts}</b></div>`).join('');
    $('synPillars').innerHTML = s.pillars.map((p) =>
      `<div class="spil"><div class="n">${T(...SYN_PILLAR_T[p.id])}</div><div class="s">${p.score}</div></div>`).join('');

    // 双人宿曜关系 (V21 Phase 3): natal mansions + both directions of the
    // 三九秘法 relation (it's directional by design).
    const xa = natalXiuOf(state.me.y, state.me.m, state.me.d);
    const xb = natalXiuOf(state.other.y, state.other.m, state.other.d);
    if (xa != null && xb != null) {
      const rab = XIU_REL[xiuRelation(xa, xb)], rba = XIU_REL[xiuRelation(xb, xa)];
      $('synXiu').innerHTML = `
        <div class="xiu-h">${T('LUNAR MANSIONS · 宿曜', '宿曜缘分 · 三九秘法')}</div>
        <div class="xiu-row"><span class="xiu-n">${T('ME', '我')} · ${XIU27_ZH[xa]}${T('', '宿')}</span><span class="xiu-arrow">→</span><b>${T(rab.en, rab.zh)}</b><span class="xiu-d">${T(rab.descEn, rab.descZh)}</span></div>
        <div class="xiu-row"><span class="xiu-n">${T('THEM', '对方')} · ${XIU27_ZH[xb]}${T('', '宿')}</span><span class="xiu-arrow">→</span><b>${T(rba.en, rba.zh)}</b><span class="xiu-d">${T(rba.descEn, rba.descZh)}</span></div>`;
    } else {
      $('synXiu').innerHTML = '';
    }
    // 日月相位 (V21 Phase 5): sun/moon cross-aspects between the two charts.
    const jdA = cstToJD(state.me.y, state.me.m, state.me.d, state.me.hour);
    const jdB = cstToJD(state.other.y, state.other.m, state.other.d, state.other.hour);
    const bodies = [
      ['☉', T('Sun', '太阳'), sunLongitude(jdA), sunLongitude(jdB)],
    ];
    const moonA = moonLongitude(jdA), moonB = moonLongitude(jdB);
    const pairs = [
      [T('Sun–Sun', '太阳–太阳'), bodies[0][2], bodies[0][3]],
      [T('Sun–Moon', '太阳–月亮'), bodies[0][2], moonB],
      [T('Moon–Sun', '月亮–太阳'), moonA, bodies[0][3]],
      [T('Moon–Moon', '月亮–月亮'), moonA, moonB],
    ];
    const hourMissing = state.me.hour == null || state.other.hour == null;
    const aspRows = pairs.map(([label, la, lb]) => {
      const a = aspectBetween(la, lb);
      if (!a) return `<div class="xiu-row"><span class="xiu-n">${label}</span><span class="xiu-d">${T('no major aspect', '无主要相位')}</span></div>`;
      const t = ASPECT_T[a.key];
      return `<div class="xiu-row"><span class="xiu-n">${label}</span><span class="xiu-arrow">∠</span><b>${T(t.en, t.zh)}</b><span class="xiu-d">${T(t.dEn, t.dZh)}</span></div>`;
    }).join('');
    $('synAstro').innerHTML = `
      <div class="xiu-h">${T('SUN/MOON ASPECTS · 日月相位', '日月相位')}</div>${aspRows}
      ${hourMissing ? `<p class="bz-caveat">${T('One or both hours unknown — moon positions use a noon approximation.', '有一方未填时辰——月亮位置按正午近似。')}</p>` : ''}`;

    $('pullScore').textContent = pull.score;
    $('pullTxt').textContent = T(
      `Today's pull — under a ${pull.todayElement.en}-day sky. Changes daily; come back tomorrow.`,
      `今日引力——${pull.todayElement.zh}气当令。每日一变，明日再来。`);

    // V23 Phase 3: today's real transit-to-natal weather (module 2 point 1)
    // + 7-day fate calendar (module 2 point 3). The calendar is cheap and
    // synchronous (reuses dailyPull, no fetch); the weather needs the
    // precomputed transits JSON, fetched once and cached.
    renderSynCalendar();
    const weatherPairKey = pairKey;
    ensureTransits().then((transits) => {
      if (!transits || !state.me || !state.other) return;
      const curKey = `${state.me.y}-${state.me.m}-${state.me.d}-${state.me.hour}|${state.other.y}-${state.other.m}-${state.other.d}-${state.other.hour}`;
      if (curKey !== weatherPairKey) return; // pair changed while the fetch was in flight
      const weather = dailyCoupleWeather(transits.planets, { Sun: bodies[0][2], Moon: moonA }, { Sun: bodies[0][3], Moon: moonB });
      const wWrap = $('synWeatherWrap');
      if (weather.lines.length) {
        wWrap.hidden = false;
        $('synWeather').innerHTML = weather.lines.map((l) => `<p class="syn-line syn-line--pos">${T(l.en, l.zh)}</p>`).join('');
      } else wWrap.hidden = true;
    });
  }

  // ---- sixteen-type quick quiz (V21 Phase 4) --------------------------------
  // In-page section (C5-evaluated: no ninth page). Quiz progress lives in
  // memory; only the RESULT persists (localStorage). Re-renders in place on
  // language toggle because renderPersona() reads state.lang at call time.
  const PERSONA_KEY = 'afflatus-horo:persona';
  const quiz = { idx: -1, answers: [] }; // idx -1 = not started
  const loadPersona = () => { try { return JSON.parse(localStorage.getItem(PERSONA_KEY)); } catch { return null; } };
  function renderPersona() {
    const wrap = $('personaWrap');
    if (!wrap) return;
    if (quiz.idx === -1) { // start screen (+ previous result, if any)
      const prev = loadPersona();
      const prevHTML = prev && PERSONA_TYPES[prev.type] ? `
        <div class="pq-result">
          <div class="pq-type">${prev.type}</div>
          <div class="pq-name">${T(PERSONA_TYPES[prev.type].en, PERSONA_TYPES[prev.type].zh)}</div>
          <p class="pq-desc">${T(PERSONA_TYPES[prev.type].dEn, PERSONA_TYPES[prev.type].dZh)}</p>
          ${prev.axes ? `<div class="pq-axes">${prev.axes.map((ax, k) => `
            <div class="pq-ax"><span>${AXIS_LETTERS[k][0]}</span><span class="pq-ax-bar"><i style="width:${Math.round(ax.a / (ax.a + ax.b) * 100)}%"></i></span><span>${AXIS_LETTERS[k][1]}</span></div>`).join('')}</div>` : ''}
        </div>` : '';
      wrap.innerHTML = `${prevHTML}
        <div class="share-row">
          <button class="btn" type="button" id="pqStart">${prev ? T('Retake the quiz', '重新测一次') : T('Start · 24 questions ≈ 3 min', '开始 · 24 题约 3 分钟')}</button>
          ${prev ? `<span class="share-tip">${T('Your previous result is above — retaking replaces it.', '上方是你上次的结果——重测会覆盖。')}</span>` : ''}
        </div>`;
      $('pqStart').addEventListener('click', () => { quiz.idx = 0; quiz.answers = []; renderPersona(); });
      return;
    }
    if (quiz.idx >= PERSONA_QUESTIONS.length) { // finished → score, persist, show
      const r = scorePersona(quiz.answers);
      if (r) { try { localStorage.setItem(PERSONA_KEY, JSON.stringify(r)); } catch {} }
      quiz.idx = -1;
      renderPersona();
      return;
    }
    const q = PERSONA_QUESTIONS[quiz.idx];
    wrap.innerHTML = `
      <div class="pq-progress"><i style="width:${Math.round(quiz.idx / PERSONA_QUESTIONS.length * 100)}%"></i></div>
      <div class="pq-count">${quiz.idx + 1} / ${PERSONA_QUESTIONS.length}</div>
      <div class="pq-q">${T(q.q[0], q.q[1])}</div>
      <div class="pq-opts">
        <button class="pq-opt" type="button" data-v="a">${T(q.a[0], q.a[1])}</button>
        <button class="pq-opt" type="button" data-v="b">${T(q.b[0], q.b[1])}</button>
      </div>
      <div class="share-row">${quiz.idx > 0 ? `<button class="btn" type="button" id="pqBack">${T('← Back', '← 上一题')}</button>` : ''}</div>`;
    wrap.querySelectorAll('.pq-opt').forEach((btn) => btn.addEventListener('click', () => {
      quiz.answers[quiz.idx] = btn.dataset.v;
      quiz.idx++;
      renderPersona();
    }));
    const back = $('pqBack');
    if (back) back.addEventListener('click', () => { quiz.idx--; renderPersona(); });
  }
  renderPersona();

  // ---- share cards (V21 Phase 0: PNG download in the healing palette) --------
  const cardPillars = (chart, labels) =>
    [chart.year, chart.month, chart.day, chart.hour].filter(Boolean)
      .map((p, i) => ({ gz: pillarName(p), el: STEM_ELEMENT[p.stem], label: labels[i] }));
  $('cardBtnMine') && $('cardBtnMine').addEventListener('click', () => {
    if (!state.mineChart || !state.me) return;
    track('share_card_generated', { type: 'mine' }); // guardrail metric (roadmap module 2)
    const labels = PILLAR_T.map((t) => T(...t));
    const zi = zodiacIndex(state.me.m, state.me.d);
    downloadShareCard('mine', {
      lang: state.lang,
      pillars: cardPillars(state.mineChart, labels),
      chips: [T(ANIMALS_EN[state.mineChart.animal], '属' + ANIMALS_ZH[state.mineChart.animal]), T(ZODIAC_EN[zi], ZODIAC_ZH[zi] + '座')],
      dateStr: `${state.me.y}-${String(state.me.m).padStart(2, '0')}-${String(state.me.d).padStart(2, '0')}`,
    }, 'afflatus-bazi-card.png');
  });
  $('cardBtnSyn') && $('cardBtnSyn').addEventListener('click', () => {
    if (!state.synData) return;
    track('share_card_generated', { type: 'synastry' }); // guardrail metric (roadmap module 2)
    const labels = PILLAR_T.map((t) => T(...t));
    const ziA = ZODIAC_GLYPH[zodiacIndex(state.me.m, state.me.d)];
    const ziB = ZODIAC_GLYPH[zodiacIndex(state.other.m, state.other.d)];
    // V23 Phase 2: prefer the astro layer's title/score/top line once it has
    // resolved; falls back to the bazi-only base score (frame()/renderShareCard
    // both handle title/hookLine being absent), so the button works even if
    // the ephemeris import failed or hasn't finished yet.
    const card = state.synAstroCard;
    const topLine = card && (card.attraction[0] || card.flags[0]);
    downloadShareCard('syn', {
      lang: state.lang,
      score: card ? card.score : state.synData.base,
      title: card ? T(card.title.en, card.title.zh) : undefined,
      hookLine: topLine ? T(topLine.en, topLine.zh) : undefined,
      a: { h: T('ME', '我'), pillars: cardPillars(state.synData.chartA, labels), zodiacGlyph: ziA },
      b: { h: T('THEM', '对方'), pillars: cardPillars(state.synData.chartB, labels), zodiacGlyph: ziB },
    }, 'afflatus-synastry-card.png');
  });

  // ---- share link ------------------------------------------------------------
  $('shareBtn').addEventListener('click', async () => {
    if (!state.me || !state.other) return;
    const url = `${location.origin}${location.pathname}?p=${encodeShare(state.me, state.other)}`;
    let ok = false;
    try { await navigator.clipboard.writeText(url); ok = true; } catch {}
    if (!ok) { try { const ta = document.createElement('textarea'); ta.value = url; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); ok = true; } catch {} }
    $('shareTip').textContent = ok ? T('Copied — send it to them.', '已复制——发给对方吧。') : url;
  });

  // ---- V23 Phase 1: L2 radar/list interaction + L3 PRO toggle (dynamic import) --
  const l2Wrap = $('l2Wrap');
  if (l2Wrap) l2Wrap.addEventListener('click', (e) => {
    const target = e.target.closest('[data-dim]');
    if (!target) return;
    const row = l2Wrap.querySelector(`.l2-dim[data-dim="${target.dataset.dim}"]`);
    if (row) row.classList.toggle('open');
  });
  if (l2Wrap && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { l2Wrap.classList.add('in-view'); io.unobserve(l2Wrap); } });
    }, { threshold: 0.2 });
    io.observe(l2Wrap);
  } else if (l2Wrap) { l2Wrap.classList.add('in-view'); }

  // V23 Phase 2: synastry PRO toggles (Davison composite, full bazi/chart
  // breakdown) — plain expand/collapse, content is already rendered by
  // renderSyn()/renderSynAstroSections(), no dynamic import needed here.
  for (const id of ['synDavisonToggle', 'synDetailToggle']) {
    const btn = $(id);
    if (!btn) continue;
    btn.addEventListener('click', () => {
      const body = $(btn.getAttribute('aria-controls'));
      const willOpen = !body.classList.contains('open');
      btn.setAttribute('aria-expanded', String(willOpen));
      body.classList.toggle('open', willOpen);
    });
  }

  let l3Loading = false;
  const l3Toggle = $('l3Toggle'), l3Body = $('l3Body');
  if (l3Toggle) l3Toggle.addEventListener('click', async () => {
    const willOpen = !l3Body.classList.contains('open');
    l3Toggle.setAttribute('aria-expanded', String(willOpen));
    l3Body.classList.toggle('open', willOpen);
    if (!willOpen || l3Loading) return;
    if (state.l3 && state.l3.jd === state.l3JD && state.l3.planets) { renderL3Body(); return; }
    l3Loading = true;
    l3Body.innerHTML = `<p class="l3-loading">${T('Loading the professional ephemeris…', '正在加载专业星历……')}</p>`;
    try {
      const { allPlanets } = await import('../lib/astroPlanets.ts');
      state.l3 = { jd: state.l3JD, planets: allPlanets(state.l3JD), ascDeg: state.l3AscDeg };
      renderL3Body();
    } catch {
      l3Body.innerHTML = `<p class="l3-loading">${T('Could not load the ephemeris — try again.', '星历加载失败——请重试。')}</p>`;
    } finally { l3Loading = false; }
  });

  // ---- forms -------------------------------------------------------------------
  $('birthForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const b = parseBirth($('bDate').value, $('bHour').value, $('bTz').value, $('bDst').checked);
    if (!b) return;
    b.gender = $('bGender').value || null; // local profile only, never in share codes
    b.lat = $('bLat').value === '' ? null : Math.max(-90, Math.min(90, +$('bLat').value));
    b.lon = $('bLon').value === '' ? null : Math.max(-180, Math.min(180, +$('bLon').value));
    state.me = b; saveProfile(b);
    renderMine(); renderSyn();
  });
  // Shared by the form-submit path and the relationship-book quick-load path.
  function castSynastry(b) {
    state.other = b;
    renderSyn();
  }
  $('synForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!state.me) { $('synHint').textContent = T('Cast your own chart above first — synastry needs both.', '先在上方立好自己的盘——合盘需要两个人。'); return; }
    const b = parseBirth($('sDate').value, $('sHour').value, $('sTz').value, $('sDst').checked);
    if (!b) return;
    const name = $('sName').value.trim();
    if (name) upsertBook(name, b);
    castSynastry(b);
  });

  const fillForm = (prefix, b) => {
    const p = (x) => String(x).padStart(2, '0');
    $(prefix + 'Date').value = `${b.y}-${p(b.m)}-${p(b.d)}`;
    $(prefix + 'Hour').value = b.hour == null ? '' : String(b.hour);
    if (prefix === 'b' && $('bGender')) $('bGender').value = b.gender || '';
    if (prefix === 'b' && $('bLat')) { $('bLat').value = b.lat == null ? '' : String(b.lat); $('bLon').value = b.lon == null ? '' : String(b.lon); }
  };

  // ---- boot: shared link beats saved profile ------------------------------------
  renderBook();
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
    renderMine(); renderSyn(); renderPersona(); renderBook();
  });
})();
