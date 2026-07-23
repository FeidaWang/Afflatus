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
import { PERSONA_QUESTIONS, scorePersona, PERSONA_TYPES, PERSONA_MATCH, PERSONA_FREQ, AXIS_LETTERS } from '../lib/persona.js';
import { LOGIC_QUESTIONS, scoreLogic } from '../lib/logicQuiz.js';
import { EQ_QUESTIONS, scoreEQ } from '../lib/eqQuiz.js';
import { cstToJD, sunLongitude, moonLongitude, ascendant, signOf, degInSign, aspectBetween, ASPECT_T } from '../lib/astro.js';
import { personalityTags, dimensionScores } from '../lib/astroReadings.js';
import { renderRadar, renderWheel, renderAspectGrid, PLANET_GLYPH, ZODIAC_GLYPH } from '../lib/astroChart.js';
import { crossAspects, relationshipTitle, resonanceScore, attractionLines, redFlagLines, davisonReading } from '../lib/synastryAstro.js';
import { crossBranchMatrix } from '../lib/synastryBazi.js';
import { dailyCoupleWeather } from '../lib/dailyTransits.js';
import { dailyDraw } from '../lib/starDraw.js';
import { computeZiwei, ZW_STARS_ZH, ZW_STAR_READS, JU_ZH } from '../lib/ziwei.js';
import { computeZiweiDeep, sanFangSiZheng, partnershipRead, daXianAges, liunianZiweiPalace } from '../lib/ziweiDeep.js';
import { synthesizeR1, synthesizeR2, synthesizeR3, synthesizeR4, synthesizeR5 } from '../lib/deepSynthesis.js';
import { relationshipScores, synastryZiwei } from '../lib/synastryModes.js';
import { mingzaoRank, percentileOf } from '../lib/mingzao.js';
import { MINGZAO_DIST } from '../lib/mingzaoDist.js';
import { iqPercentile, eqPercentile } from '../lib/quizNorm.js';
import { downloadShareCard } from '../lib/shareCard.js';
import { allRegions, citiesInRegion, findCityInRegion } from '../lib/cityPicker.js';

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

  // ---- birth-city picker (replaces manual timezone+lat/lon as the default
  // path) ------------------------------------------------------------------
  // 2026-07-10: switched from one flat searchable list (526 cities in a
  // single <datalist>, too long to browse once province/country metadata
  // made "just group them" the obvious ask) to a two-step region -> city
  // cascade: pick a province/country first, then a city from that short
  // list. Option labels are baked bilingual (zh only for China provinces —
  // matches this site's existing convention of showing Chinese proper
  // nouns regardless of language toggle — "zh en" for everything else),
  // same fixed-string approach TZ_OPTIONS above already uses, so nothing
  // here needs to re-render on language toggle.
  //
  // Selecting a city fills the EXISTING hidden bTz/bLat/bLon (or sTz) form
  // fields and dispatches a real 'change' event on the tz <select> so the
  // dst-enable/disable listener above still runs — this file's parseBirth()
  // and normalizeBirthToCST() (bazi.js) are completely unchanged, the
  // picker is purely a friendlier way to fill the same fields.
  //
  // China cities deliberately do NOT set bTz to '8' — leaving it at ''
  // ("unspecified · treat as China") keeps normalizeBirthToCST() on the
  // path that auto-corrects China's own 1986-1991 DST window (see
  // cities.js's header and bazi.js's CN_DST_WINDOWS); hand-setting
  // {utcOffset:8, dst:false} would silently skip that correction for
  // anyone born in it.
  const { provinces, countries } = allRegions();
  const provinceKeys = new Set(provinces.map((p) => p.key));
  function wireRegionCityPicker(regionSelId, citySelId, tzSelId, latId, lonId) {
    const regionSel = $(regionSelId), citySel = $(citySelId), tzSel = $(tzSelId);
    if (!regionSel || !citySel || !tzSel) return;
    const addOpt = (parent, value, label) => {
      const o = document.createElement('option');
      o.value = value; o.textContent = label;
      parent.appendChild(o);
    };
    const chinaGroup = document.createElement('optgroup');
    chinaGroup.label = '中国 · CHINA';
    provinces.forEach((p) => addOpt(chinaGroup, p.key, p.zh));
    const overseasGroup = document.createElement('optgroup');
    overseasGroup.label = '海外 · OVERSEAS';
    countries.forEach((c) => addOpt(overseasGroup, c.key, `${c.zh} ${c.en}`));
    regionSel.appendChild(chinaGroup);
    regionSel.appendChild(overseasGroup);

    regionSel.addEventListener('change', () => {
      citySel.innerHTML = '';
      const region = regionSel.value;
      if (!region) { citySel.disabled = true; return; }
      const isChina = provinceKeys.has(region);
      citiesInRegion(region, isChina).forEach((c) => addOpt(citySel, c.zh, c.isChina ? c.zh : `${c.zh} ${c.en}`));
      citySel.disabled = false;
      citySel.dispatchEvent(new Event('change'));
    });
    citySel.addEventListener('change', () => {
      const region = regionSel.value;
      if (!region || !citySel.value) return;
      const isChina = provinceKeys.has(region);
      const city = findCityInRegion(region, isChina, citySel.value);
      if (!city) return;
      if (latId && $(latId)) $(latId).value = String(city.lat);
      if (lonId && $(lonId)) $(lonId).value = String(city.lon);
      tzSel.value = city.isChina ? '' : String(city.utcOffset);
      tzSel.dispatchEvent(new Event('change'));
    });
  }
  wireRegionCityPicker('bRegionSel', 'bCitySel', 'bTz', 'bLat', 'bLon');
  wireRegionCityPicker('sRegionSel', 'sCitySel', 'sTz', null, null);
  // The underlying tz-select/lat/lon fields (#bManualWrap/#sManualWrap) stay
  // in the DOM — permanently hidden, no UI to reveal them — purely so the
  // city picker above still has somewhere to write its result into without
  // touching parseBirth()/normalizeBirthToCST(). Removed per an explicit
  // follow-up request to keep the input page as compact as possible; the
  // fields themselves were never load-bearing for anything a user typed
  // directly (only for what the city picker fills in).

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
  // ---- today detail (V25 Part 5 §23.3): real day-pillar card, ten-god
  // chip, and the branch-event "why" strip (the receipts behind the
  // score, not just a number). f = dailyFortune() v2 output.
  function todayDetailHTML(f) {
    const el = STEM_ELEMENT[f.todayPillar.stem];
    const card = `<div class="pillar"><div class="t">${T('TODAY', '今日')}</div><span class="gz e-${el}">${pillarName(f.todayPillar)}</span><div class="el">${T(ELEMENTS_EN[el], ELEMENTS_ZH[el])}</div></div>`;
    const why = f.branchEvents.length
      ? f.branchEvents.map((e) => `<div class="today-why-row ${(e.type === 'liuhe' || e.type === 'banhe') ? 'up' : 'down'}">${T(e.en, e.zh)}</div>`).join('')
      : `<div class="today-why-row">${T('No strong branch event today — an ordinary day.', '今日地支与命局无明显合冲刑害——平常之日。')}</div>`;
    return `<div class="today-detail-inner">${card}
      <div class="today-detail-body">
        <span class="tengod-chip">${T(f.tenGod.en, f.tenGod.zh)}</span>
        <div class="today-why">${why}</div>
      </div>
    </div>`;
  }

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
  // Tier names nod to Diablo II item rarity (normal/magic/rare/unique) —
  // the badge also shows the sample frequency as a population percentage.
  const RAR_T = [['Normal', '普通'], ['Magic', '魔法'], ['Rare', '稀有'], ['Unique', '暗金']];
  const rarityTier = (f) => (f >= 0.40 ? 0 : f >= 0.25 ? 1 : f >= 0.10 ? 2 : 3);
  const rarityPct = (f) => (f >= 0.1 ? Math.round(f * 100) : (f * 100).toFixed(1));
  const shenshaWithBadge = (zh) => {
    const f = SHENSHA_RARITY[zh];
    const badge = f == null ? '' : `<small class="rar rar-${rarityTier(f)}">${T(...RAR_T[rarityTier(f)])} · ${rarityPct(f)}%</small>`;
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

  // ---- 命造评级 (U5, Urgent.md) ----------------------------------------------
  // Four-axis composite (中和流通/格局/用神/岁运) + a percentile against the
  // precomputed uniform synthetic sample (mingzaoDist.js). The 岁运 axis only
  // renders when gender is set (it needs the current dayun pillar); the
  // percentile always compares CORE scores so it stays gender-independent.
  function currentDayunPillar(me) {
    if (!me.gender) return null;
    const dy = computeDayun(me, me.gender);
    if (!dy) return null;
    const nowYear = new Date().getFullYear();
    const cur = dy.pillars.find((p) => nowYear >= p.fromYear && nowYear <= p.toYear);
    return cur ? { stem: cur.stem, branch: cur.branch } : null;
  }
  const MZ_AXIS_T = {
    zhonghe: ['BALANCE & FLOW', '中和流通'], geju: ['PATTERN', '格局'],
    yongshen: ['USEFUL GOD', '用神'], suiyun: ['LUCK-CYCLE FIT', '岁运'],
  };
  function mingzaoHTML(chart, me) {
    const pillars = [chart.year, chart.month, chart.day, chart.hour].filter(Boolean);
    const rank = mingzaoRank(pillars, currentDayunPillar(me));
    state.mzRank = rank; // kept for the share-card button
    const pct = percentileOf(rank.core, MINGZAO_DIST);
    state.mzPct = pct;
    const axes = ['zhonghe', 'geju', 'yongshen', 'suiyun'].map((k) => {
      const ax = rank[k];
      if (!ax) return `<div class="mz-ax mz-ax--na"><span class="mz-ax-n">${T(...MZ_AXIS_T[k])}</span><span class="mz-ax-na">${T('needs gender for luck cycles', '需选择性别以排大运')}</span></div>`;
      return `<div class="mz-ax"><span class="mz-ax-n">${T(...MZ_AXIS_T[k])}</span><span class="mz-ax-bar"><i style="width:${ax.value}%"></i></span><b class="mz-ax-v">${ax.value}</b></div>`;
    }).join('');
    return `<div class="mz-card">
      <div class="mz-head">
        <div class="mz-score"><b>${rank.total}</b><span>${T(rank.suiyun ? 'TOTAL (incl. luck cycle)' : 'CORE SCORE', rank.suiyun ? '总分（含岁运）' : '核心分')}</span></div>
        <div class="mz-pct">${pct == null ? '' : T(`Core score beats ${pct}% of a uniform birth sample`, `命造核心分超过样本中 ${pct}% 的命盘`)}</div>
      </div>
      <div class="mz-axes">${axes}</div>
      <p class="bz-caveat">${T(
        'Original 0-100 simplification of the classical rubric (balance/flow, pattern grade, useful-god strength, luck-cycle fit) — classical texts rank charts qualitatively, not numerically. Percentile is against a uniform synthetic 1950–2009 sample, not real population. Entertainment only.',
        '按传统「中和流通/格局高低/用神有力/岁运配合」四轴设计的原创 0-100 简化量化——传统命理对命造高低是定性而非打分。百分位对照 1950–2009 均匀合成样本，非真实人口统计。仅供娱乐。'
      )}</p>
    </div>`;
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
    $('todayDetailWrap').innerHTML = todayDetailHTML(f);
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

    // 命造评级 (U5): four-axis composite + percentile vs the uniform sample
    $('mzWrap').innerHTML = mingzaoHTML(f.chart, state.me);

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

    // ZWDS deep layer (V25 Part 5 §25.6): 四化/aux-sha/大限 grid + R1-R5 synthesis
    $('zwdWrap').innerHTML = ziweiDeepHTML(state.me, f);
    if (currentZWDeep) { wireZiweiDeepGrid(); renderZWDSynthesis(); }

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

  // ---- ZWDS deep layer (V25 Part 5 §25.6): 四化/aux-sha/大限 grid, click-
  // through 三方四正 (Three-Square-Four-Orthogonal) breakdown, sibling-
  // palace partnership card, and R1-R5 Bazi×ZWDS synthesis panel. Reuses
  // the entry-level grid's spatial layout (ZW_GRID) so the two boards line
  // up visually. Needs the birth hour (same guard as ziweiHTML above); the
  // R3 decade-agreement rule additionally needs gender.
  const AUX_SHA_EN = { 禄存: 'Lucun', 擎羊: 'Qingyang', 陀罗: 'Tuoluo', 天马: 'Tianma', 左辅: 'Zuofu', 右弼: 'Youbi', 文昌: 'Wenchang', 文曲: 'Wenqu', 火星: 'Huoxing', 铃星: 'Lingxing', 地空: 'Dikong', 地劫: 'Dijie' };
  const ZW_STAR_EN_BY_ZH = Object.fromEntries(ZW_STARS_ZH.map((zh, i) => [zh, ZW_STAR_EN[i]]));
  const HUA_CLASS = { 禄: 'lu', 权: 'quan', 科: 'ke', 忌: 'ji' };
  let currentZWDeep = null; // { z, deep, me, f } — kept for the grid's click handler

  function zwdStarHTML(s) {
    const en = ZW_STAR_EN_BY_ZH[s.name] || AUX_SHA_EN[s.name] || s.name;
    const huaChar = s.transformation !== 'None' ? s.transformation[1] : '';
    const hua = huaChar ? `<b class="zwd-hua ${HUA_CLASS[huaChar]}">${huaChar}</b>` : '';
    const bright = s.brightness ? `<i class="zwd-bright">${s.brightness}</i>` : '';
    return `<span class="zwd-star zwd-star--${s.level.toLowerCase()}">${T(en, s.name)}${bright}${hua}</span>`;
  }

  function ziweiDeepHTML(me, f) {
    if (me.hour == null) { currentZWDeep = null; return ''; }
    const z = computeZiwei(me);
    if (!z) { currentZWDeep = null; return ''; }
    const deep = computeZiweiDeep(z, me.gender);
    currentZWDeep = { z, deep, me, f };

    const cells = ZW_GRID.map((b, i) => {
      if (b === -1) {
        if (i !== 5) return '';
        return `<div class="zwd-center">
          <div class="zw-c-ju">${JU_ZH[z.ju]}</div>
          <div class="zw-c-l">${T('Life palace', '命宫')} · ${STEMS[z.mingStem]}${BRANCHES[z.ming]}</div>
          ${me.gender ? '' : `<div class="zw-c-l" style="font-size:10.5px">${T('pick a gender above for 大限 ages', '选择性别以显示大限年龄')}</div>`}
        </div>`;
      }
      const p = deep.palaces[b];
      const hasJi = p.stars.some((s) => s.transformation === '化忌');
      const starRow = p.stars.length ? p.stars.map(zwdStarHTML).join('') : `<span class="zw-empty">${T('—', '（空宫）')}</span>`;
      const ageRow = p.startAge != null ? `<div class="zwd-age">${p.startAge}–${p.endAge}${T('y', '岁')}</div>` : '';
      return `<button type="button" class="zwd-cell${b === z.ming ? ' zw-ming' : ''}${b === z.shen ? ' zw-shen' : ''}${hasJi ? ' zwd-jihit' : ''}" data-branch="${b}">
        <div class="zw-h"><span class="zw-p">${T(p.nameEn, p.name)}</span><span class="zw-b">${STEMS[p.stem]}${BRANCHES[b]}</span></div>
        <div class="zwd-stars">${starRow}</div>
        ${ageRow}
      </button>`;
    }).join('');

    // sibling-palace partnership card (always visible, no click needed)
    const pr = partnershipRead(deep.palaces);
    const prCard = `<div class="zwd-card${pr.permitted ? '' : ' zwd-card--note'}">
      <div class="xiu-h">${T('SIBLING PALACE · PARTNERSHIP PATTERN', '兄弟宫 · 合伙模式')}</div>
      <p>${pr.permitted
        ? T('No structural strain in the sibling palace — shared ventures read no more friction than usual.', '兄弟宫结构未见明显破损——合伙、共享责任这件事，没有额外的摩擦信号。')
        : T('This chart pattern favors running things solo — shared ownership reads as higher friction here.', '此命局更偏向独立运作——共同持有、合伙分利这件事，摩擦信号偏高。')}</p>
    </div>`;

    return `<div class="zwd-inner"><svg class="zwd-svg" id="zwdSvg"></svg><div class="zwd-grid">${cells}</div></div>
      <div class="zwd-detail" id="zwdDetail" hidden></div>
      ${prCard}
      <div id="zwdSynthesis"></div>
      <p class="bz-caveat">${T(
        'Tap a palace to see its 三方四正 (Three-Square-Four-Orthogonal) scan — the opposite palace + two trine palaces every serious reading cross-references. Entertainment only.',
        '点击任意宫位可查看其三方四正扫描——命理判读向来不会只看单宫，而是对宫加两个三合宫一起看。仅供娱乐。'
      )}</p>`;
  }

  function wireZiweiDeepGrid() {
    const inner = document.querySelector('#zwdWrap .zwd-inner');
    if (!inner || !currentZWDeep) return;
    const { deep } = currentZWDeep;
    const svg = inner.querySelector('#zwdSvg');
    const detail = $('zwdDetail');
    inner.querySelectorAll('.zwd-cell').forEach((btn) => {
      btn.addEventListener('click', () => {
        const wasActive = btn.classList.contains('zwd-active');
        inner.querySelectorAll('.zwd-cell').forEach((b) => b.classList.remove('zwd-active', 'zwd-linked'));
        svg.innerHTML = '';
        if (wasActive) { detail.hidden = true; return; }
        const target = Number(btn.dataset.branch);
        const s = sanFangSiZheng(deep.palaces, target);
        btn.classList.add('zwd-active');
        const box = inner.getBoundingClientRect();
        const pt = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top }; };
        const tPt = pt(btn);
        const lines = [];
        for (const idx of [s.opposing, s.trine1, s.trine2]) {
          const cell = inner.querySelector(`.zwd-cell[data-branch="${idx}"]`);
          if (!cell) continue;
          cell.classList.add('zwd-linked');
          const cPt = pt(cell);
          lines.push(`<line x1="${tPt.x}" y1="${tPt.y}" x2="${cPt.x}" y2="${cPt.y}" class="zwd-line"/>`);
        }
        svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
        svg.innerHTML = lines.join('');
        detail.hidden = false;
        detail.innerHTML = `<div class="xiu-h">${T('THREE-SQUARE-FOUR-ORTHOGONAL SCAN', '三方四正扫描')} · ${T(deep.palaces[target].nameEn, deep.palaces[target].name)}</div>
          <div class="zwd-score">${T('Score', '评分')} <b>${s.score}</b>/100</div>
          <div class="zwd-breakdown">
            <span class="up">${T('favorable', '吉')} +${s.favorableStars.toFixed(1)}</span>
            <span class="down">${T('clashing', '煞/忌')} −${s.clashingStars.toFixed(1)}</span>
            ${s.huaJiActive ? `<span class="down">${T('化忌 clashes in from the opposing palace', '对宫化忌冲入')}</span>` : ''}
          </div>`;
      });
    });
  }

  // ---- R1-R5 Bazi×ZWDS synthesis panel (§25.5). Renders only when hour +
  // gender are both known (大限/大运 need gender; 紫微 itself needs hour).
  function renderZWDSynthesis() {
    if (!currentZWDeep) return;
    const wrap = $('zwdSynthesis');
    if (!wrap) return;
    const { z, deep, me, f } = currentZWDeep;
    const pillars = [f.chart.year, f.chart.month, f.chart.day, ...(f.chart.hour ? [f.chart.hour] : [])];
    const zp = ziPingAnalysis(pillars);
    const mingGongScore = sanFangSiZheng(deep.palaces, z.ming).score;
    let mingGongWuXing = deep.palaces[z.ming].stars.filter((s) => s.level === 'Major').map((s) => s.wuXing);
    if (!mingGongWuXing.length) mingGongWuXing = deep.palaces[mod2(z.ming + 6)].stars.filter((s) => s.level === 'Major').map((s) => s.wuXing);

    const r1 = synthesizeR1(zp, mingGongScore);
    const r2 = synthesizeR2(zp, mingGongWuXing);

    const currentYear = new Date().getFullYear();
    const currentAge = currentYear - me.y;
    const cards = [r1, r2];

    if (me.gender) {
      const dy = computeDayun(me, me.gender);
      const dayunNow = dy.pillars.find((p) => currentAge >= p.fromAge && currentAge <= p.toAge) || dy.pillars[0];
      const dx = daXianAges(z, me.gender);
      const daXianBranch = Object.keys(dx.ages).map(Number).find((b) => currentAge >= dx.ages[b].startAge && currentAge <= dx.ages[b].endAge);
      if (daXianBranch != null) {
        const daXianScore = sanFangSiZheng(deep.palaces, daXianBranch).score;
        cards.push(synthesizeR3(f.chart.dayMasterElement, BRANCH_ELEMENT[dayunNow.branch], daXianScore));
      }
    }

    const liunian = liunianZiweiPalace(deep, currentYear);
    const taisuiTags = taisuiRelation(liunianPillar(currentYear).branch, f.chart.year.branch);
    cards.push(synthesizeR4(taisuiTags, liunian.score, liunian.huaJiActive));

    const todayGong = sanFangSiZheng(deep.palaces, f.todayPillar.branch).score;
    cards.push(synthesizeR5(f.relation, todayGong));

    wrap.innerHTML = `<div class="xiu-h">${T('BAZI × ZWDS SYNTHESIS', '八字×紫微 深度综合')}</div>
      ${cards.map((c) => `<div class="zwd-synth-card zwd-synth--${c.verdict}">
        <div class="zwd-synth-v">${T(c.verdict === 'reinforced' ? 'REINFORCED' : 'CROSSCURRENT', c.verdict === 'reinforced' ? '互相印证' : '两说不一')}</div>
        <p>${T(c.en, c.zh)}</p>
        <div class="zwd-receipts">${c.receipts.map((r) => `<span>${T(r.en, r.zh)}</span>`).join('')}</div>
      </div>`).join('')}
      <p class="bz-caveat">${T('Both systems read the same birth instant; agreement sharpens a reading, disagreement just means it\'s worth weighing more than one signal. Entertainment only.', '两套系统读的是同一个出生时刻；相合则读法更笃定，不合也只是提醒该多看一层信号，而非定论。仅供娱乐。')}</p>`;
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
      aspects, // U2: kept for the relationship-mode reweighting
    };
  }

  // U2: five relationship lenses (朋友/同事/暧昧/情侣/夫妻) — same signals,
  // different weights per relationship type. Renders immediately from the
  // bazi layer (aspects=[]) and re-renders richer once the astro layer lands.
  function renderSynModes(aspects) {
    const wrap = $('synModes');
    if (!wrap || !state.synData) return;
    const modes = relationshipScores(state.synData, aspects || []);
    wrap.innerHTML = `<div class="xiu-h">${T('AS FRIENDS / COLLEAGUES / MORE · 分关系评分', '分关系评分 · 朋友到夫妻')}</div>
      <div class="syn-mode-grid">${modes.map((m) => `
        <div class="syn-mode">
          <div class="sm-h"><span class="sm-n">${T(m.en, m.zh)}</span><b class="sm-v">${m.score}</b></div>
          <div class="sm-bar"><i style="width:${m.score}%"></i></div>
          <p class="sm-line">${T(m.line.en, m.line.zh)}</p>
        </div>`).join('')}</div>
      ${aspects && aspects.length ? '' : `<p class="bz-caveat">${T('Bazi layer only so far — planet aspects refine these once the sky finishes loading.', '目前仅八字底盘——星盘相位加载完成后会进一步校准。')}</p>`}`;
  }

  // U2: ziwei life-palace comparison — needs both birth hours.
  function renderSynZiwei() {
    const wrap = $('synZiwei');
    if (!wrap) return;
    if (state.me.hour == null || state.other.hour == null) {
      wrap.innerHTML = `<div class="xiu-h">${T('ZIWEI LIFE PALACES · 紫微合参', '紫微合参 · 命宫对照')}</div>
        <p class="form-note">${T('Needs both birth hours — the hour branch places each life palace.', '需要双方时辰——时支决定各自命宫位置。')}</p>`;
      return;
    }
    const zA = computeZiwei(state.me), zB = computeZiwei(state.other);
    if (!zA || !zB) { wrap.innerHTML = ''; return; }
    const s = synastryZiwei(zA, zB);
    wrap.innerHTML = `<div class="xiu-h">${T('ZIWEI LIFE PALACES · 紫微合参', '紫微合参 · 命宫对照')}</div>
      <div class="xiu-row"><span class="xiu-n">${T('ME', '我')} · ${s.mingA.branch}${T('', '宫')}</span><span class="xiu-d">${s.mingA.stars}</span></div>
      <div class="xiu-row"><span class="xiu-n">${T('THEM', '对方')} · ${s.mingB.branch}${T('', '宫')}</span><span class="xiu-d">${s.mingB.stars}</span></div>
      <div class="xiu-row"><span class="xiu-n">${T(s.relation.en, s.relation.zh)}</span><b>${s.score}</b><span class="xiu-d">${T(s.temperament.en, s.temperament.zh)}</span></div>
      <p class="bz-caveat">${T('Entry-level read: life-palace branch relation + major-star temperament only. Entertainment only.', '入门级合参：仅比对命宫地支关系与主星气质组合。仅供娱乐。')}</p>`;
  }

  function renderSynAstroSections(data) {
    state.synAstroCard = data; // kept for the share-card button
    renderSynModes(data.aspects); // U2: re-render the five lenses with real aspects
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

  // ---- 合盘 branch matrix (V25 Part 5 §24.2): dual full charts + the
  // exact 4×4 (or smaller, hour-unknown) Earthly-Branch combination/clash
  // matrix from synastryBazi.js. Reuses .syn-chart/.pillar--sm verbatim
  // for the dual columns; only the matrix grid + click-to-connect SVG
  // overlay are new.
  const BM_GLYPH = { liuhe: '合', banhe: '半合', sanhe: '合', chong: '冲', xing: '刑', hai: '害', po: '破' };
  const BM_PLABEL = { year: ['YR', '年'], month: ['MO', '月'], day: ['DAY', '日'], hour: ['HR', '时'] };
  const bmCellClass = (types) => (!types.length ? 'neutral' : types.some((t) => t === 'liuhe' || t === 'banhe' || t === 'sanhe') ? 'harmony' : 'clash');

  function synBaziMatrixHTML(chartA, chartB) {
    const m = crossBranchMatrix(chartA, chartB);
    const pillarCard = (chart, id, side) => {
      const p = chart[id]; const el = STEM_ELEMENT[p.stem];
      return `<div class="pillar pillar--sm" data-side="${side}" data-pid="${id}"><div class="t">${T(...BM_PLABEL[id])}</div><span class="gz e-${el}">${pillarName(p)}</span></div>`;
    };
    const dual = `<div class="syn-charts">
      <div class="syn-chart"><div class="syn-chart-h">${T('ME', '我')}</div><div class="pillars pillars--sm">${m.idsA.map((id) => pillarCard(chartA, id, 'a')).join('')}</div></div>
      <div class="syn-divider" aria-hidden="true">❖</div>
      <div class="syn-chart"><div class="syn-chart-h">${T('THEM', '对方')}</div><div class="pillars pillars--sm">${m.idsB.map((id) => pillarCard(chartB, id, 'b')).join('')}</div></div>
    </div>`;
    const grid = `<div class="synbm-grid" style="grid-template-columns:auto repeat(${m.idsA.length},1fr)">
      <div class="synbm-corner"></div>
      ${m.idsA.map((id) => `<div class="synbm-colhead">${T(...BM_PLABEL[id])}</div>`).join('')}
      ${m.idsB.map((ib) => `<div class="synbm-rowhead">${T(...BM_PLABEL[ib])}</div>${m.idsA.map((ia) => {
        const cell = m.cells.find((c) => c.pa === ia && c.pb === ib);
        const cls = bmCellClass(cell.relations);
        const label = cell.relations.length ? [...new Set(cell.relations.map((t) => BM_GLYPH[t]))].join('') : '·';
        return `<button type="button" class="synbm-cell ${cls}" data-pa="${ia}" data-pb="${ib}" title="${cell.texts.join(' / ') || T('no relation', '无明显关系')}">${label}</button>`;
      }).join('')}`).join('')}
    </div>`;
    const caveat = `<p class="bz-caveat">${T(
      `${m.combos.length} combination${m.combos.length === 1 ? '' : 's'} · ${m.clashes.length} clash${m.clashes.length === 1 ? '' : 'es'} found across both charts' branches — tap a highlighted cell to see which pillars connect. Overall branch score ${m.score}/100.`,
      `双方地支之间共找到 ${m.combos.length} 组合 · ${m.clashes.length} 组冲刑害破——点击高亮格可看具体是哪两柱相连。地支综合分 ${m.score}/100。`
    )}</p>`;
    return `<div class="synbm-inner"><svg class="synbm-svg" id="synbmSvg"></svg>${dual}${grid}${caveat}</div>`;
  }

  function wireSynBaziMatrix() {
    const inner = document.querySelector('#synbmWrap .synbm-inner');
    if (!inner) return;
    const svg = inner.querySelector('#synbmSvg');
    inner.querySelectorAll('.synbm-cell').forEach((btn) => {
      btn.addEventListener('click', () => {
        const wasActive = btn.classList.contains('active');
        inner.querySelectorAll('.synbm-cell.active').forEach((b) => b.classList.remove('active'));
        svg.innerHTML = '';
        if (wasActive || btn.classList.contains('neutral')) return;
        btn.classList.add('active');
        const aCard = inner.querySelector(`[data-side="a"][data-pid="${btn.dataset.pa}"]`);
        const bCard = inner.querySelector(`[data-side="b"][data-pid="${btn.dataset.pb}"]`);
        if (!aCard || !bCard) return;
        const box = inner.getBoundingClientRect();
        const rA = aCard.getBoundingClientRect(), rB = bCard.getBoundingClientRect(), rC = btn.getBoundingClientRect();
        const pt = (r) => ({ x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top });
        const a = pt(rA), b = pt(rB), c = pt(rC);
        svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
        const tone = btn.classList.contains('harmony') ? 'harmony' : 'clash';
        svg.innerHTML = `<line x1="${a.x}" y1="${a.y}" x2="${c.x}" y2="${c.y}" class="synbm-line ${tone}"/><line x1="${c.x}" y1="${c.y}" x2="${b.x}" y2="${b.y}" class="synbm-line ${tone}"/>`;
      });
    });
  }

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

    // 合盘 branch matrix (V25 Part 5 §24.2) — dual charts + 4×4 combo/clash grid
    $('synBaziMatrixWrap').hidden = false;
    $('synbmWrap').innerHTML = synBaziMatrixHTML(s.chartA, s.chartB);
    wireSynBaziMatrix();

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

    // U2: five relationship lenses (bazi-only first paint; the astro layer
    // above re-paints with aspects when it resolves) + ziwei comparison.
    renderSynModes(state.synAstro && state.synAstro.key === pairKey ? state.synAstro.data.aspects : []);
    renderSynZiwei();

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
      const match = prev && PERSONA_MATCH[prev.type];
      const prevHTML = prev && PERSONA_TYPES[prev.type] ? `
        <div class="pq-result">
          <div class="pq-type">${prev.type}</div>
          <div class="pq-name">${T(PERSONA_TYPES[prev.type].en, PERSONA_TYPES[prev.type].zh)}</div>
          ${PERSONA_FREQ[prev.type] ? `<p class="pq-desc pq-freq">${T(`~${PERSONA_FREQ[prev.type]}% of people share this type (published US estimates).`, `人群中约 ${PERSONA_FREQ[prev.type]}% 是这个类型（公开发表的美国样本估算）。`)}</p>` : ''}
          <p class="pq-desc">${T(PERSONA_TYPES[prev.type].dEn, PERSONA_TYPES[prev.type].dZh)}</p>
          ${prev.axes ? `<div class="pq-axes">${prev.axes.map((ax, k) => `
            <div class="pq-ax"><span>${AXIS_LETTERS[k][0]}</span><span class="pq-ax-bar"><i style="width:${Math.round(ax.a / (ax.a + ax.b) * 100)}%"></i></span><span>${AXIS_LETTERS[k][1]}</span></div>`).join('')}</div>` : ''}
          ${match ? `<div class="pq-compat">
            <span class="pq-compat-good">${T('Vibes well with', '合得来')} <b>${match.match.join(' · ')}</b></span>
            <span class="pq-compat-friction">${T('Tends to friction with', '容易碰摩擦')} <b>${match.friction}</b></span>
          </div>` : ''}
        </div>` : '';
      wrap.innerHTML = `${prevHTML}
        <div class="share-row">
          <button class="btn" type="button" id="pqStart">${prev ? T('Retake the quiz', '重新测一次') : T(`Start · ${PERSONA_QUESTIONS.length} questions ≈ 4 min`, `开始 · ${PERSONA_QUESTIONS.length} 题约 4 分钟`)}</button>
          ${prev ? `<button class="btn btn--seal" type="button" id="cardBtnPersona">${T('Save result card ⤓', '保存结果卡 ⤓')}</button>` : ''}
          ${prev ? `<span class="share-tip">${T('Your previous result is above — retaking replaces it.', '上方是你上次的结果——重测会覆盖。')}</span>` : ''}
        </div>`;
      $('pqStart').addEventListener('click', () => { quiz.idx = 0; quiz.answers = []; renderPersona(); });
      const cardBtn = $('cardBtnPersona');
      if (cardBtn) cardBtn.addEventListener('click', () => {
        track('share_card_generated', { type: 'persona' });
        downloadShareCard('persona', {
          lang: state.lang,
          type: prev.type,
          name: T(PERSONA_TYPES[prev.type].en, PERSONA_TYPES[prev.type].zh),
          axes: prev.axes,
          axisLetters: AXIS_LETTERS,
          freqLine: PERSONA_FREQ[prev.type] ? T(`~${PERSONA_FREQ[prev.type]}% of people`, `人群占比约 ${PERSONA_FREQ[prev.type]}%`) : undefined,
        }, 'afflatus-persona-card.png');
      });
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

  // ---- logic & EQ quizzes (V23 MBTI-expansion follow-up) --------------------
  // Same in-page, result-only-persists shape as the MBTI quiz above, but both
  // questions offer index-based options rather than persona's fixed a/b, so
  // they share one small generic runner instead of duplicating the state
  // machine twice more.
  function makeIndexQuiz({ wrapId, storageKey, questions, score, startLabel, renderResult, resultButtons, timed }) {
    const st = { idx: -1, answers: [], timer: 0, deadline: 0 };
    const load = () => { try { return JSON.parse(localStorage.getItem(storageKey)); } catch { return null; } };
    const stopTimer = () => { if (st.timer) { clearInterval(st.timer); st.timer = 0; } };
    function render() {
      const wrap = $(wrapId);
      if (!wrap) return;
      stopTimer();
      if (st.idx === -1) {
        const prev = load();
        wrap.innerHTML = `${prev ? renderResult(prev) : ''}
          <div class="share-row">
            <button class="btn" type="button" id="${wrapId}Start">${prev ? T('Retake the quiz', '重新测一次') : startLabel()}</button>
            ${prev && resultButtons ? resultButtons(prev) : ''}
            ${prev ? `<span class="share-tip">${T('Your previous result is above — retaking replaces it.', '上方是你上次的结果——重测会覆盖。')}</span>` : ''}
          </div>`;
        $(`${wrapId}Start`).addEventListener('click', () => { st.idx = 0; st.answers = []; render(); });
        if (resultButtons && load()) wrap.querySelectorAll('[data-quiz-share]').forEach((b) => b.addEventListener('click', () => shareQuizCard(b.dataset.quizShare, load())));
        return;
      }
      if (st.idx >= questions.length) {
        const r = score(st.answers);
        if (r) { try { localStorage.setItem(storageKey, JSON.stringify(r)); } catch {} }
        st.idx = -1;
        render();
        return;
      }
      const q = questions[st.idx];
      // U3: per-question countdown for the timed (logic/IQ) quiz — harder
      // items carry more seconds (q.t); running out records null (= wrong)
      // and auto-advances. No back button in timed mode: revisiting an
      // already-seen timed item would defeat the clock.
      const timedSec = timed && q.t ? q.t : 0;
      wrap.innerHTML = `
        <div class="pq-progress"><i style="width:${Math.round(st.idx / questions.length * 100)}%"></i></div>
        <div class="pq-count">${st.idx + 1} / ${questions.length}${timedSec ? ` <span class="pq-clock" id="${wrapId}Clock">${timedSec}s</span>` : ''}</div>
        ${timedSec ? `<div class="pq-timebar"><i id="${wrapId}Timebar" style="width:100%"></i></div>` : ''}
        <div class="pq-q">${T(q.q[0], q.q[1])}</div>
        <div class="pq-opts">${q.opts.map((o, i) => `<button class="pq-opt" type="button" data-v="${i}">${T(o[0], o[1])}</button>`).join('')}</div>
        <div class="share-row">${!timed && st.idx > 0 ? `<button class="btn" type="button" id="${wrapId}Back">${T('← Back', '← 上一题')}</button>` : ''}</div>`;
      const advance = (v) => { stopTimer(); st.answers[st.idx] = v; st.idx++; render(); };
      wrap.querySelectorAll('.pq-opt').forEach((btn) => btn.addEventListener('click', () => advance(Number(btn.dataset.v))));
      if (timedSec) {
        st.deadline = Date.now() + timedSec * 1000;
        const clock = $(`${wrapId}Clock`), bar = $(`${wrapId}Timebar`);
        st.timer = setInterval(() => {
          const left = st.deadline - Date.now();
          if (left <= 0) { advance(null); return; }
          if (clock) clock.textContent = `${Math.ceil(left / 1000)}s`;
          if (bar) bar.style.width = `${Math.max(0, (left / (timedSec * 1000)) * 100)}%`;
          if (clock && left < 6000) clock.classList.add('pq-clock--low');
        }, 250);
      }
      const back = $(`${wrapId}Back`);
      if (back) back.addEventListener('click', () => { st.idx--; render(); });
    }
    render();
    return render;
  }

  // U3: quiz share cards (logic + EQ) — pre-resolved strings only.
  function shareQuizCard(kind, r) {
    track('share_card_generated', { type: kind });
    if (kind === 'logic') {
      downloadShareCard('quiz', {
        lang: state.lang,
        headZh: '思维速测', headEn: 'LOGIC SPRINT',
        score: r.funScore, ringFrac: (r.funScore - 70) / 80,
        scoreLabel: T('for-fun score', '娱乐分'),
        band: T(r.band.en, r.band.zh),
        pctLine: T(`Beats ~${iqPercentile(r.funScore)}% on the N(100,15) model`, `按正态模型 N(100,15) 约超过 ${iqPercentile(r.funScore)}% 的人`),
        caveat: T('Timed original puzzle quiz — not a clinically normed IQ instrument.', '限时原创谜题速测——非临床标准化智商测验。'),
      }, 'afflatus-logic-card.png');
    } else if (kind === 'eq') {
      downloadShareCard('quiz', {
        lang: state.lang,
        headZh: '情商风格', headEn: 'EQ STYLE',
        score: r.overall, ringFrac: r.overall / 100,
        scoreLabel: T('EQ-style score', '情商风格分'),
        band: T('Five-domain self-read', '五维自评画像'),
        pctLine: T(`Higher than ~${eqPercentile(r.overall)}% on a self-report model`, `按自评分布模型约高于 ${eqPercentile(r.overall)}% 的人`),
        caveat: T('Self-report style read (Goleman five domains) — not a clinical assessment.', '五维自评风格测验（戈尔曼框架）——非临床测评。'),
      }, 'afflatus-eq-card.png');
    }
  }

  const renderLogicQuiz = makeIndexQuiz({
    wrapId: 'logicWrap', storageKey: 'afflatus-horo:logic', questions: LOGIC_QUESTIONS, score: scoreLogic,
    timed: true, // U3: per-question countdown (q.t seconds, difficulty-scaled)
    startLabel: () => T(`Start · ${LOGIC_QUESTIONS.length} timed questions ≈ 8 min`, `开始 · ${LOGIC_QUESTIONS.length} 题限时作答约 8 分钟`),
    renderResult: (r) => `
      <div class="pq-result">
        <div class="pq-type">${r.correct}/${r.total}</div>
        <div class="pq-name">${T(r.band.en, r.band.zh)}</div>
        <p class="pq-desc">${T(r.band.dEn, r.band.dZh)}</p>
        <p class="pq-desc">${T(`For-fun score: ${r.funScore} — beats ~${iqPercentile(r.funScore)}% of people on the conventional N(100,15) model.${r.timeouts ? ` ${r.timeouts} question(s) timed out.` : ''}`,
          `娱乐分数：${r.funScore}——按正态模型 N(100,15) 约超过 ${iqPercentile(r.funScore)}% 的人。${r.timeouts ? `有 ${r.timeouts} 题超时未答。` : ''}`)}</p>
        <p class="pq-desc">${T('Timed original puzzles — not a clinically normed IQ instrument.', '限时原创谜题——非临床标准化智商测验，仅供娱乐。')}</p>
      </div>`,
    resultButtons: () => `<button class="btn btn--seal" type="button" data-quiz-share="logic">${T('Save result card ⤓', '保存结果卡 ⤓')}</button>`,
  });

  const renderEqQuiz = makeIndexQuiz({
    wrapId: 'eqWrap', storageKey: 'afflatus-horo:eq', questions: EQ_QUESTIONS, score: scoreEQ,
    startLabel: () => T(`Start · ${EQ_QUESTIONS.length} questions ≈ 5 min`, `开始 · ${EQ_QUESTIONS.length} 题约 5 分钟`),
    renderResult: (r) => `
      <div class="pq-result">
        <div class="pq-type">${r.overall}</div>
        <div class="pq-name">${T('Overall EQ-style score', '综合情商风格分')}</div>
        <p class="pq-desc">${T(`Higher than ~${eqPercentile(r.overall)}% of people on a self-report model — self-rated EQ runs generous, hence the shifted baseline.`,
          `按自评分布模型约高于 ${eqPercentile(r.overall)}% 的人——自评情商普遍偏高，基线已相应右移。`)}</p>
        <div class="l2-radar">${renderRadar(r.dims.map((d) => ({ key: d.key, label: T(d.en, d.zh), value: d.value })))}</div>
      </div>`,
    resultButtons: () => `<button class="btn btn--seal" type="button" data-quiz-share="eq">${T('Save result card ⤓', '保存结果卡 ⤓')}</button>`,
  });

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
      // U5: chart-rank + sample percentile (pre-resolved string)
      rankLine: state.mzRank ? T(
        `Chart rank ${state.mzRank.total}${state.mzPct == null ? '' : ` · beats ${state.mzPct}% of sample`}`,
        `命造评分 ${state.mzRank.total}${state.mzPct == null ? '' : ` · 超过样本 ${state.mzPct}%`}`
      ) : undefined,
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

  // ---- privacy: one-click clear (covers both "me"/"them" charts + all
  // quiz results — everything this page ever writes to localStorage uses
  // the 'afflatus-horo:' prefix, so wiping by prefix stays correct
  // automatically as new quiz keys are added, no per-key list to maintain).
  const clearBtn = $('clearDataBtn');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    const ok = window.confirm(T(
      'Clear everything this page has saved on your device (chart, streak, quiz results, saved contacts)? This cannot be undone.',
      '清空本页在本机保存的全部数据（命盘、连续签到、测试结果、关系册）？此操作无法撤销。'
    ));
    if (!ok) return;
    try { Object.keys(localStorage).filter((k) => k.startsWith('afflatus-horo:')).forEach((k) => localStorage.removeItem(k)); } catch {}
    location.href = location.pathname; // full reload, also drops any ?p= shared-link query
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
    renderMine(); renderSyn(); renderPersona(); renderBook(); renderLogicQuiz(); renderEqQuiz();
  });
})();
