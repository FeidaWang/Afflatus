/* ============================================================
   GAMES — cyberpunk World Cup predictions by Fable 5 Max.
   Shows Fable's calls, real betting odds, and group standings.
   Scratch cards reveal the exact predicted scoreline.
   For entertainment — not betting advice.
   ============================================================ */
import { buildProvenanceBadge } from '../lib/provenanceBadge.js';
import { renderTrackRecordHTML } from '../lib/trackRecord.js';

(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const RM = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
  let lang = (() => { try { return window.AfflatusI18N ? window.AfflatusI18N.get() : (localStorage.getItem('afflatus:lang') === 'zh' ? 'zh' : 'en'); } catch { return 'en'; } })();
  const T = (en, zh) => lang === 'zh' ? zh : en;
  const FABLE_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" style="vertical-align:-2px" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="7" width="18" height="14" rx="5" fill="#F2994A"/><rect x="10" y="2" width="4" height="5" rx="2" fill="#F2994A"/><circle cx="12" cy="2" r="1.6" fill="#F2994A"/><circle cx="9" cy="14" r="1.8" fill="#3A2410"/><circle cx="15" cy="14" r="1.8" fill="#3A2410"/><path d="M8.5 17.5 Q12 20.5 15.5 17.5" stroke="#3A2410" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>';

  const SCR_KEY = 'afflatus-games:scratch:v2';
  const ls = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  let data = null;
  let scratched = new Set(ls(SCR_KEY, []));
  const saveScratch = () => save(SCR_KEY, [...scratched]);

  const fmtDur = (ms) => window.AfflatusClock.fmtDur(ms);
  const isTBD = (f) => f.opus == null || /winner|runner|tbd|\?/i.test(f.home + f.away);
  const teamName = (f, side) => lang === 'zh' ? (f[side + '_zh'] || f[side]) : f[side];

  /* ---------- scratch-to-reveal ----------
     Fix: single tap OR any scratch stroke triggers immediate full reveal.
     No more needing to clear 55% of the whole canvas — tap once = done.
  -------------------------------------------------- */
  function mountScratch(wrap, key) {
    if (!wrap) return;
    if (scratched.has(key)) { wrap.classList.add('revealed'); return; }
    const cv = document.createElement('canvas'); cv.className = 'scratch-cv'; cv.setAttribute('aria-hidden', 'true'); wrap.appendChild(cv);
    const ctx = cv.getContext('2d'); let moved = 0, drawing = false;
    function paint() {
      const r = wrap.getBoundingClientRect(); cv.width = Math.max(1, Math.floor(r.width)); cv.height = Math.max(1, Math.floor(r.height));
      ctx.globalCompositeOperation = 'source-over';
      const g = ctx.createLinearGradient(0, 0, cv.width, cv.height); g.addColorStop(0, '#2a2440'); g.addColorStop(.5, '#5a4a86'); g.addColorStop(1, '#231f3a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
      for (let i = 0; i < cv.width * cv.height / 900; i++) { ctx.fillStyle = `rgba(255,255,255,${Math.random() * .14})`; ctx.fillRect(Math.random() * cv.width, Math.random() * cv.height, 2, 2); }
      ctx.fillStyle = 'rgba(255,43,214,.85)'; ctx.font = '700 11px "Share Tech Mono",monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(lang === 'zh' ? '◤ 点击或刮开揭晓比分 ◢' : '◤ TAP OR SCRATCH TO REVEAL ◢', cv.width / 2, cv.height / 2);
    }
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const erase = (x, y) => { ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(x, y, 18, 0, 6.283); ctx.fill(); };
    function cleared() { try { const d = ctx.getImageData(0, 0, cv.width, cv.height).data; let c = 0, n = 0; for (let i = 3; i < d.length; i += 64) { n++; if (d[i] === 0) c++; } return n ? c / n : 0; } catch { return 0; } }
    function reveal() { scratched.add(key); saveScratch(); wrap.classList.add('revealed'); cv.style.transition = 'opacity .35s ease'; cv.style.opacity = '0'; setTimeout(() => cv.remove(), 370); }
    cv.addEventListener('pointerdown', (e) => { drawing = true; moved = 0; try { cv.setPointerCapture(e.pointerId); } catch {} const [x, y] = pos(e); erase(x, y); });
    cv.addEventListener('pointermove', (e) => {
      if (!drawing) return; const [x, y] = pos(e); erase(x, y); moved++;
      if (moved >= 6 && cleared() > 0.30) reveal(); // scratch 30% → reveal
    });
    cv.addEventListener('pointerup', () => {
      drawing = false;
      if (moved < 4 || cleared() > 0.28) reveal(); // tap (< 4 moves) OR enough scratch → reveal immediately
    });
    paint();
  }

  /* ---------- probability bars ---------- */
  function bar(host, items) {
    host.innerHTML = items.map((it) => {
      const isPlayer = !!it.name;
      const title = isPlayer ? (lang === 'zh' ? (it.name_zh || it.name) : it.name) : (lang === 'zh' ? (it.team_zh || it.team) : it.team);
      const sub = isPlayer ? (lang === 'zh' ? (it.team_zh || it.team) : it.team) : '';
      const reason = T(it.reason_en, it.reason_zh);
      return `<div class="prob"><div class="prow"><span class="pflag">${it.flag || ''}</span><span class="pname">${title}${sub ? ` <i>· ${sub}</i>` : ''}</span><b class="pval" data-to="${it.prob}">0%</b></div><div class="pbar"><i style="--w:${it.prob}%"></i></div><p class="preason">${reason}</p></div>`;
    }).join('');
    if (!RM) host.querySelectorAll('.pval').forEach((el) => { const to = +el.dataset.to, t0 = performance.now(); (function s(ts) { const p = Math.min(1, (ts - t0) / 900); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))) + '%'; if (p < 1) requestAnimationFrame(s); })(performance.now()); });
    else host.querySelectorAll('.pval').forEach((el) => el.textContent = el.dataset.to + '%');
  }
  function renderChampions() { if ($('champs')) bar($('champs'), data.champions); }
  function renderPlayers() { if ($('players')) bar($('players'), data.players); }
  function outcomeLabel(f, o) { return o === 'draw' ? T('Draw', '平局') : T(teamName(f, o) + ' win', teamName(f, o) + ' 胜'); }

  /* ---------- odds display ---------- */
  function renderOdds(f) {
    const o = f.odds;
    if (!o) return '';
    const hn = teamName(f, 'home'), an = teamName(f, 'away');
    const cells = [
      { lbl: (f.homeFlag || '') + ' ' + hn, val: o.h },
      { lbl: T('Draw', '平局'), val: o.d },
      { lbl: (f.awayFlag || '') + ' ' + an, val: o.a }
    ].map((c) => `<div class="odds-cell"><div class="ol">${c.lbl}</div><div class="ov">${c.val.toFixed(2)}</div></div>`).join('');
    const scores = o.scores && o.scores.length
      ? o.scores.map((s) => `${s.s} <b>${s.o.toFixed(2)}</b>`).join(' · ')
      : '';
    const src = o.src ? `<span class="odds-src">${T('Source', '来源')}: ${o.src} · ${T('for entertainment only', '仅供娱乐')}</span>` : '';
    return `<div class="odds"><div class="odds-label">${T('BETTING ODDS · 1X2', '赔率 · 胜平负')}</div><div class="odds-1x2">${cells}</div>${scores ? `<div class="odds-scores">${T('Top scores', '热门比分')}: ${scores}</div>` : ''}${src}</div>`;
  }

  /* ---------- fixtures ---------- */
  function renderFixtures() {
    const host = $('fixtures'); if (!host || !data) return;
    host.innerHTML = data.fixtures.map((f) => {
      const tbd = isTBD(f);
      // Fable prediction (always visible once kickoff locked, or always show for upcoming)
      const opusLine = (f.opus && !tbd) ? `<div class="opus">${FABLE_ICON} <b>Fable</b> · ${outcomeLabel(f, f.opus)} · ${Math.round(f.conf * 100)}%<span class="orsn">${T(f.reason_en, f.reason_zh)}</span></div>` : '';
      // Odds
      const oddsHtml = !tbd ? renderOdds(f) : '';
      // Scratch to reveal exact score only
      const opScore = (f.opusScore && !tbd) ? `<div class="scratch opscore" data-key="score:${f.id}"><div class="reveal">${FABLE_ICON} <span data-en="FABLE SCORE" data-zh="FABLE 比分">FABLE SCORE</span> · <b>${f.homeFlag} ${f.opusScore} ${f.awayFlag}</b></div></div>` : (tbd ? `<div class="tbdnote">${T('Opponents undecided', '对手未定')}</div>` : '');
      // Teams — static display, no picks
      const homeTeam = `<div class="team-d"><span class="fl">${f.homeFlag || ''}</span><span class="nm">${teamName(f, 'home')}</span></div>`;
      const awayTeam = `<div class="team-d"><span class="fl">${f.awayFlag || ''}</span><span class="nm">${teamName(f, 'away')}</span></div>`;
      const vsBlock = `<div class="team-vs"><b>VS</b></div>`;
      return `<article class="fx${tbd ? ' tbd' : ''}" data-id="${f.id}" data-ko="${Date.parse(f.kickoff)}" data-tbd="${tbd ? 1 : 0}"><div class="fx-top"><span class="stage">${f.stage}</span><span class="cd"></span></div><div class="fx-teams">${homeTeam}${vsBlock}${awayTeam}</div>${opusLine}${oddsHtml}${opScore}</article>`;
    }).join('');
    // mount scratch cards
    host.querySelectorAll('.scratch').forEach((w) => mountScratch(w, w.dataset.key));
    if (window.AfflatusI18N) window.AfflatusI18N.apply();
    tickFixtures();
  }
  function tickFixtures() {
    if (!$('fixtures')) return; const now = Date.now();
    $('fixtures').querySelectorAll('.fx').forEach((card) => {
      const ko = +card.dataset.ko, tbd = card.dataset.tbd === '1';
      const cd = card.querySelector('.cd');
      if (!cd) return;
      if (tbd) { cd.textContent = T('OPPONENTS TBD', '对手未定'); return; }
      cd.textContent = (now >= ko) ? T('LOCKED · KICKOFF', '已锁定 · 开球') : T('LOCKS IN', '锁定倒计时') + ' ' + fmtDur(ko - now);
      if (now >= ko) card.classList.add('locked');
    });
  }

  /* ---------- knockout bracket — full path-to-the-final tree ----------
     Renders one titled sub-section per stage (QF/SF/Final) that data.bracket
     actually contains so far — the tournament runs one round at a time, so
     stages are added by the daily task as they're reached (bracket.qf first,
     then bracket.sf once QF winners are known, then bracket.final). Every
     stage shares the same leg/slot card markup; this used to be hardcoded to
     bracket.qf only, which meant later rounds had nowhere to render. */
  const BRACKET_STAGES = [
    { key: 'qf', badge_en: 'QF', badge_zh: '八强' },
    { key: 'sf', badge_en: 'SF', badge_zh: '四强' },
    { key: 'final', badge_en: 'FINAL', badge_zh: '决赛' },
  ];
  function renderBracketStage(stage, entries) {
    const legName = (leg, side) => lang === 'zh' ? (leg[side + '_zh'] || leg[side]) : leg[side];
    const cards = entries.map((slot) => {
      const legsHtml = slot.legs.map((leg) => {
        const hCls = leg.winner === 'home' ? ' win' : (leg.winner === 'away' ? ' lose' : '');
        const aCls = leg.winner === 'away' ? ' win' : (leg.winner === 'home' ? ' lose' : '');
        return `<div class="qf-leg"><span class="qf-team${hCls}">${leg.homeFlag || ''} ${legName(leg, 'home')}</span><i class="qf-vs">${T('vs', '对')}</i><span class="qf-team${aCls}">${leg.awayFlag || ''} ${legName(leg, 'away')}</span></div>`;
      }).join('');
      const decided = slot.legs.map((leg) => leg.winner ? legName(leg, leg.winner) + (leg.winner === 'home' ? (leg.homeFlag || '') : (leg.awayFlag || '')) : null);
      const slotHtml = decided.every(Boolean)
        ? (stage.key === 'final'
          ? `🏆 <b>${decided[0]}</b> <i class="qf-vs">${T('vs', '对')}</i> <b>${decided[1]}</b>`
          : `<b>${decided[0]}</b> <i class="qf-vs">${T('vs', '对')}</i> <b>${decided[1]}</b>`)
        : T('Winners TBD', '胜者未定');
      return `<article class="qf" data-qf="${slot.id}"><div class="qf-h"><span class="qf-badge">${T(stage.badge_en, stage.badge_zh)} · ${slot.date}</span><span class="qf-venue">${T(slot.venue_en, slot.venue_zh)}</span></div><div class="qf-r16">${legsHtml}</div><div class="qf-arrow">▼</div><div class="qf-slot">${slotHtml}</div></article>`;
    }).join('');
    return `<div class="bstage" data-stage="${stage.key}"><div class="bstage-title">${T(stage.badge_en, stage.badge_zh)}</div><div class="bracket">${cards}</div></div>`;
  }
  function renderBracket() {
    const host = $('bracket'); if (!host || !data || !data.bracket) return;
    const label = $('bracketLabel');
    if (label && data.bracket.stageLabel_en) { label.setAttribute('data-en', data.bracket.stageLabel_en); label.setAttribute('data-zh', data.bracket.stageLabel_zh || data.bracket.stageLabel_en); label.textContent = T(data.bracket.stageLabel_en, data.bracket.stageLabel_zh); }
    const stagesHtml = BRACKET_STAGES
      .filter((stage) => Array.isArray(data.bracket[stage.key]) && data.bracket[stage.key].length)
      .map((stage) => renderBracketStage(stage, data.bracket[stage.key]))
      .join('');
    host.innerHTML = stagesHtml || `<div class="empty">${T('Bracket unavailable.', '对阵图暂不可用。')}</div>`;
    if (window.AfflatusI18N) window.AfflatusI18N.apply();
  }

  /* ---------- Fable track record — gold ⭐ for exact scores ----------
     Shared with league.js via src/lib/trackRecord.js (ROADMAP §7.5 V12) —
     the two pages used to carry byte-identical copies of this template. */
  function renderRecord() {
    const host = $('record'); if (!host) return;
    const r = data && data.record;
    const html = renderTrackRecordHTML(r, { T, fableIcon: FABLE_ICON, exactLabel: { en: 'exact scorelines', zh: '比分全中' } });
    if (!html) { host.innerHTML = ''; host.style.display = 'none'; return; }
    host.style.display = '';
    host.innerHTML = html;
  }

  function renderUpdated() {
    const el = $('updated');
    if (el) {
      const badge = buildProvenanceBadge({ updatedAt: data.updated, lang });
      el.className = 'sub prov-badge prov-' + badge.tier;
      el.textContent = badge.text;
    }
    if ($('gnote')) $('gnote').textContent = T(data.note_en, data.note_zh);
  }

  function renderAll() { if (!data) return; renderUpdated(); renderRecord(); renderChampions(); renderPlayers(); renderFixtures(); renderBracket(); }

  fetch('/games-data.json', { cache: 'no-store' }).then((r) => r.json()).then((d) => { data = d; renderAll(); }).catch(() => { if ($('fixtures')) $('fixtures').innerHTML = `<div class="empty">${T('Fixtures unavailable.', '赛程暂不可用。')}</div>`; });
  setInterval(tickFixtures, 1000);
  window.addEventListener('afflatus-lang', (e) => { lang = e.detail === 'zh' ? 'zh' : 'en'; renderAll(); });
})();
