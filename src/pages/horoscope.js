/* ============================================================
   HOROSCOPE page (V20) — 观星台. Fetch-free and server-free: all math in
   src/lib/bazi.js + src/lib/horoscopeEngine.js (pure, vitest-covered);
   this file only handles the form, localStorage persistence (profile +
   daily check-in streak), share-link codec plumbing and DOM rendering.
   ENTERTAINMENT ONLY — the page says so, loudly.
   ============================================================ */
import { pillarName, STEM_ELEMENT, BRANCH_ELEMENT, ELEMENTS_ZH, ELEMENTS_EN, ANIMALS_ZH, ANIMALS_EN, zodiacIndex, ZODIAC_ZH, ZODIAC_EN } from '../lib/bazi.js';
import { dailyFortune, synastry, dailyPull, encodeShare, decodeShare } from '../lib/horoscopeEngine.js';

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
  const SHICHEN = ['子 23–1', '丑 1–3', '寅 3–5', '卯 5–7', '辰 7–9', '巳 9–11', '午 11–13', '未 13–15', '申 15–17', '酉 17–19', '戌 19–21', '亥 21–23'];
  const SHICHEN_HOUR = [23, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21]; // representative hour per branch
  for (const sel of [$('bHour'), $('sHour')]) {
    SHICHEN.forEach((label, i) => { const o = document.createElement('option'); o.value = String(SHICHEN_HOUR[i]); o.textContent = label; sel.appendChild(o); });
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

  const parseBirth = (dateVal, hourVal) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateVal || '');
    if (!m) return null;
    return { y: +m[1], m: +m[2], d: +m[3], hour: hourVal === '' ? null : +hourVal };
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
    const ps = [f.chart.year, f.chart.month, f.chart.day, f.chart.hour].filter(Boolean);
    $('pillarRow').innerHTML = ps.map((p, i) => {
      const el = STEM_ELEMENT[p.stem];
      return `<div class="pillar"><div class="t">${T(...PILLAR_T[i])}</div><span class="gz e-${el}">${pillarName(p)}</span><div class="el">${T(ELEMENTS_EN[el], ELEMENTS_ZH[el])}</div></div>`;
    }).join('') + (f.chart.hour ? '' : `<div class="pillar"><div class="t">${T('HOUR', '时柱')}</div><span class="gz" style="color:var(--dim)">未知</span><div class="el">${T('unknown', '未填时辰')}</div></div>`);

    // element tally + identity chips
    const zi = zodiacIndex(state.me.m, state.me.d);
    $('elemRow').innerHTML = f.chart.elements.map((n2, i) =>
      `<span class="elem"><i class="e-${i}"></i>${T(ELEMENTS_EN[i], ELEMENTS_ZH[i])} × ${n2}</span>`).join('')
      + `<span class="elem">☾ ${T(ANIMALS_EN[f.chart.animal], '属' + ANIMALS_ZH[f.chart.animal])}</span>`
      + `<span class="elem">✦ ${T(ZODIAC_EN[zi], ZODIAC_ZH[zi] + '座')}</span>`;

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
    const b = parseBirth($('bDate').value, $('bHour').value);
    if (!b) return;
    state.me = b; saveProfile(b);
    renderMine(); renderSyn();
  });
  $('synForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!state.me) { $('synHint').textContent = T('Cast your own chart above first — synastry needs both.', '先在上方立好自己的盘——合盘需要两个人。'); return; }
    const b = parseBirth($('sDate').value, $('sHour').value);
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
