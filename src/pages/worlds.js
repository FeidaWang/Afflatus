/* ============================================================
   WORLDS 2026 — stage scrubber + pick-then-flip prediction cards
   (spec docs/superpowers/specs/2026-10-25-worlds-2026-odds-design.md §8).
   DOM glue only: range math lives in stageRange.js, the eight-cell stage
   model in worldsStages.js and the card state machine in worldsCards.js.
   For entertainment — not betting advice.
   ============================================================ */
import { fetchJson } from '../lib/fetchJson.js';
import { buildProvenanceBadge } from '../lib/provenanceBadge.js';
import { renderTrackRecordHTML } from '../lib/trackRecord.js';
import { densityFor, panRange, resizeLeft, resizeRight, zoomRange } from '../lib/stageRange.js';
import { wheelScaleDelta } from '../lib/pinchZoom.js';
import { STAGES, buildStages, currentStageIndex, nextKickoff } from '../lib/worldsStages.js';
import { agreement, cardState, choose, fableRecord, loadPicks, rarity, reveal, savePicks, userRecord } from '../lib/worldsCards.js';
import { getLocale } from '../lib/localeStore.js';

const $ = (id) => document.getElementById(id);
const N = STAGES.length;
const FABLE_ICON = '<svg class="fable-ic" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="7" width="18" height="14" rx="5" fill="#3ec6ff"/><rect x="10" y="2" width="4" height="5" rx="2" fill="#3ec6ff"/><circle cx="12" cy="2" r="1.6" fill="#3ec6ff"/><circle cx="9" cy="14" r="1.8" fill="#05070c"/><circle cx="15" cy="14" r="1.8" fill="#05070c"/><path d="M8.5 17.5 Q12 20.5 15.5 17.5" stroke="#05070c" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>';
const CHAMP_ICON = (slug) => `https://gol.gg/_img/champions_icon/${encodeURIComponent(slug)}.png`;

let lang = window.AfflatusI18N ? window.AfflatusI18N.get() : getLocale('en');
const T = (en, zh) => (lang === 'zh' ? zh : en);
// Private mode can throw on the localStorage getter itself; loadPicks/savePicks
// already swallow getItem/setItem failures, so picks degrade to in-memory.
const storage = (() => { try { return window.localStorage; } catch { return null; } })();
const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let data = null;
let stages = buildStages([]);
let range = [0, 0];
let lastPaint = null;
let picks = loadPicks(storage);
let suppressClick = false;

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (p) => `${Math.round(p * 100)}%`;
const pct1 = (v) => `${Number(v).toFixed(1)}%`;
const two = (n) => String(n).padStart(2, '0');
function fmtDur(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${d ? `${d}d ` : ''}${two(h)}h ${two(m)}m ${two(sec)}s`;
}
const fmtLocal = (iso) => new Date(iso).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-AU', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
function logo(code, cls = 'logo') {
  const url = data?.teamLogos?.[code];
  return url
    ? `<img class="${cls}" src="${esc(url)}" alt="" loading="lazy" decoding="async" width="40" height="40">`
    : `<span class="${cls} logo-txt" aria-hidden="true">${esc(code)}</span>`;
}
const seriesById = (id) => data?.series?.find((s) => s.id === id);
const stageOf = (s) => STAGES.find((st) => st.stage === s.stage && (st.stage !== 'swiss' || st.round === s.round));
const stageLabel = (s) => { const st = stageOf(s); return st ? T(st.long_en, st.long_zh) : ''; };
const winnerOf = (r) => (r.home > r.away ? 'home' : 'away');
const pickIdx = (p) => (p.side === 'home' ? 0 : 1);

/* ---------- cards ---------- */
function frontHTML(s, entry, state) {
  const p = s.pick;
  const head = `<div class="fh"><span class="bo">BO${s.bo}</span><span>${esc(stageLabel(s))}</span></div>`;
  if (state === 'result') {
    const w = winnerOf(s.result);
    const fableOk = p ? p.side === w : null;
    const youOk = entry ? entry.side === w : null;
    const verdict = (ok) => (ok === null ? 'na' : ok ? 'ok' : 'no');
    return head +
      `<div class="res"><div class="res-team">${logo(s.home)}<b>${esc(s.home)}</b></div><div class="res-score">${s.result.home}–${s.result.away}</div><div class="res-team">${logo(s.away)}<b>${esc(s.away)}</b></div></div>` +
      `<div class="verd"><span class="v ${verdict(fableOk)}">${FABLE_ICON} Fable ${p ? `${fableOk ? '✓' : '✗'} ${esc(s[p.side])} ${esc(p.score)}` : T('no call', '未研判')}</span>` +
      `<span class="v ${verdict(youOk)}">${T('You', '你')} ${entry ? `${youOk ? '✓' : '✗'} ${esc(s[entry.side])}` : T('missed', '错过')}</span></div>`;
  }
  if (!p) return head + `<div class="miss">${FABLE_ICON} ${T('Fable missed the pre-match window for this series.', 'Fable 错过了本场的赛前窗口。')}</div>`;
  const win = s[p.side];
  const pw = p.pWin[pickIdx(p)];
  const agree = agreement(s, entry);
  const factors = ((lang === 'zh' ? s.factors_zh : s.factors_en) || []).slice(0, 3);
  const mk = s.market
    ? `<div class="mkt">market · ${pct(s.market.pWin[pickIdx(p)])}${Number.isFinite(s.market.liquidity) ? ` (${Math.round(s.market.liquidity).toLocaleString('en-US')} USD)` : ''}</div>`
    : '';
  return head +
    `<div class="fpick">${logo(win)}<div><i>${FABLE_ICON} ${T('FABLE PICK', 'FABLE 研判')}</i><b>${esc(win)}</b><span>${pct(pw)}</span></div></div>` +
    `<div class="fprob"><span>${esc(s.home)} ${pct(p.pWin[0])}</span><i class="pbar"><b style="--w:${p.pWin[0] * 100}%"></b></i><span>${pct(p.pWin[1])} ${esc(s.away)}</span></div>` +
    `<div class="fodds"><span>${T('implied', '隐含赔率')} ${Number(p.oddsImplied[0]).toFixed(2)} · ${Number(p.oddsImplied[1]).toFixed(2)}</span><span>${T('score', '比分')} <b>${esc(p.score)}</b> ${pct(p.pScore)}</span></div>` +
    (factors.length ? `<ul class="ffac">${factors.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : '') +
    mk +
    (agree ? `<div class="tag ${agree}">${T('You vs Fable', '你 vs Fable')} · ${agree === 'agree' ? T('AGREE', '一致') : T('DISAGREE', '分歧')}</div>` : '');
}

function cardHTML(s) {
  const entry = picks[s.id];
  const state = cardState(s, entry, Date.now());
  const flipped = state === 'revealed' || state === 'result';
  const rare = s.pick ? rarity(s.pick.pWin[pickIdx(s.pick)]) : 'teal';
  const pickable = state === 'pick' || state === 'ready';
  const side = (key) => `<button type="button" class="side${entry?.side === key ? ' on' : ''}" data-side="${key}" aria-pressed="${entry?.side === key}"${pickable ? '' : ' disabled'} aria-label="${T('Pick', '选')} ${esc(s[key])}">${logo(s[key])}<span class="code">${esc(s[key])}</span></button>`;
  const hint = { pick: T('PICK YOUR WINNER', '先选你的胜方'), ready: T('TAP TO FLIP', '点击翻牌'), 'locked-missed': T('MISSED · LOCKED', '错过 · 已锁定') }[state] || '';
  return `<article class="card ${rare}${flipped ? ' flipped' : ''}" data-id="${esc(s.id)}" data-state="${state}" data-ko="${Date.parse(s.kickoff)}" tabindex="0" aria-label="${esc(s.home)} vs ${esc(s.away)} · BO${s.bo}">
    <div class="card-inner">
      <div class="face back"${flipped ? ' aria-hidden="true"' : ''}>
        <div class="bo">BO${s.bo}<span class="cd"></span></div>
        <div class="sides">${side('home')}<span class="vs">VS</span>${side('away')}</div>
        <div class="hint">${hint}</div>
      </div>
      <div class="face front"${flipped ? '' : ' aria-hidden="true"'}>${flipped ? frontHTML(s, entry, state) : ''}</div>
    </div>
  </article>`;
}

function midHTML(s, i) {
  const entry = picks[s.id];
  const state = cardState(s, entry, Date.now());
  let mid;
  if (state === 'result') mid = `<b class="ms">${s.result.home}–${s.result.away}</b>`;
  else if (state === 'revealed' && s.pick) mid = `<b class="ms">${pct(s.pick.pWin[0])} · ${pct(s.pick.pWin[1])}</b>`;
  else mid = `<span class="vs">VS</span>`;
  const label = { pick: T('open', '待选'), ready: T('picked', '已选'), revealed: T('flipped', '已翻'), 'locked-missed': T('missed', '错过'), result: T('final', '完场') }[state];
  return `<button type="button" class="mid ${state}" data-i="${i}">${logo(s.home)}${mid}${logo(s.away)}<span class="ml">${esc(s.home)} · ${esc(s.away)} · ${label}</span></button>`;
}

function treeHTML(s, i) {
  const r = s.result;
  const row = (key) => `<span class="ko-tree-row${r ? (winnerOf(r) === key ? ' win' : ' lose') : ''}">${esc(s[key])}<b>${r ? r[key] : ''}</b></span>`;
  return `<button type="button" class="ko-tree-m" data-i="${i}">${row('home')}${row('away')}</button>`;
}

function renderCardsView() {
  const view = $('cardsView');
  const [s, e] = range;
  const density = densityFor(e - s);
  const windowed = stages.slice(s, e + 1);
  const any = windowed.some((st) => st.matches.length);
  view.dataset.density = density;
  const pack = $('openPack');
  if (pack) pack.disabled = density !== 'detail' || !any;
  if (!any) {
    view.innerHTML = `<div class="empty">${T('No series scheduled yet for this stage.', '该赛段尚无赛程。')}</div>`;
    return;
  }
  const col = (st, body) => `<section class="stageCol"><h3 class="stageH">${esc(T(st.long_en, st.long_zh))}</h3>${body}</section>`;
  if (density === 'detail') {
    view.innerHTML = windowed.map((st) => col(st, `<div class="deck">${st.matches.map(cardHTML).join('')}</div>`)).join('');
  } else if (density === 'cards') {
    view.innerHTML = windowed.map((st, k) => col(st, `<div class="midGrid">${st.matches.map((m) => midHTML(m, s + k)).join('')}</div>`)).join('');
  } else {
    view.innerHTML = `<div class="ko-tree">${windowed.map((st, k) => `<div class="ko-tree-col"><div class="ko-tree-h">${esc(T(st.label_en, st.label_zh))}</div>${st.matches.map((m) => treeHTML(m, s + k)).join('')}</div>`).join('')}</div>`;
  }
  tick();
}

function burst(art) {
  const host = document.createElement('div');
  host.className = 'burst';
  host.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 12; i++) {
    const p = document.createElement('span');
    const a = (i / 12) * Math.PI * 2;
    const r = 56 + Math.random() * 44;
    p.style.setProperty('--dx', `${Math.cos(a) * r}px`);
    p.style.setProperty('--dy', `${Math.sin(a) * r}px`);
    p.style.setProperty('--d', `${Math.round(Math.random() * 120)}ms`);
    host.appendChild(p);
  }
  art.appendChild(host);
  setTimeout(() => host.remove(), 1200);
}

function replaceCard(art, s) {
  const tmp = document.createElement('div');
  tmp.innerHTML = cardHTML(s);
  const next = tmp.firstElementChild;
  art.replaceWith(next);
  tick();
  return next;
}

function flipCard(art) {
  const s = seriesById(art.dataset.id);
  if (!s || art.dataset.state !== 'ready') return;
  picks = reveal(picks, s.id);
  savePicks(storage, picks);
  art.dataset.state = 'revealed';
  const front = art.querySelector('.face.front');
  front.innerHTML = frontHTML(s, picks[s.id], 'revealed');
  front.removeAttribute('aria-hidden');
  art.querySelector('.face.back').setAttribute('aria-hidden', 'true');
  art.classList.add('flipped');
  if (!reducedMotion()) burst(art);
  renderRecord();
}

function chooseSide(art, side) {
  const s = seriesById(art.dataset.id);
  if (!s) return;
  const next = choose(picks, s, side, Date.now());
  if (next === picks) return;
  picks = next;
  savePicks(storage, picks);
  const fresh = replaceCard(art, s);
  fresh.querySelector(`.side[data-side="${side}"]`)?.focus();
}

function wireCards() {
  const view = $('cardsView');
  view.addEventListener('click', (e) => {
    if (suppressClick) { e.preventDefault(); return; }
    const jump = e.target.closest('.mid, .ko-tree-m');
    if (jump) { const i = +jump.dataset.i; range = [i, i]; paint(); return; }
    const art = e.target.closest('article.card');
    if (!art) return;
    const sideBtn = e.target.closest('button.side');
    if (sideBtn) { if (!sideBtn.disabled) chooseSide(art, sideBtn.dataset.side); return; }
    if (art.dataset.state === 'ready') flipCard(art);
  });
  view.addEventListener('keydown', (e) => {
    const art = e.target.closest('article.card');
    if (!art || e.target !== art) return;
    const state = art.dataset.state;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (state === 'pick' || state === 'ready') { chooseSide(art, e.key === 'ArrowLeft' ? 'home' : 'away'); e.preventDefault(); }
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (state === 'ready') { flipCard(art); e.preventDefault(); }
    }
  });
  // Horizontal swipe (≥48 px, more horizontal than vertical) pans the window one cell.
  let sw = null;
  view.addEventListener('pointerdown', (e) => { if (e.isPrimary) sw = { x: e.clientX, y: e.clientY }; });
  view.addEventListener('pointerup', (e) => {
    if (!sw) return;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    sw = null;
    if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy)) {
      range = panRange(range, dx < 0 ? 1 : -1, N);
      paint();
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
    }
  });
  view.addEventListener('pointercancel', () => { sw = null; });
  $('openPack').addEventListener('click', () => {
    let i = 0;
    view.querySelectorAll('article.card').forEach((art) => {
      if (art.dataset.state === 'ready') setTimeout(() => flipCard(art), 120 * i++);
      else if (art.dataset.state === 'pick') { art.classList.remove('shake'); void art.offsetWidth; art.classList.add('shake'); }
    });
  });
}

/* ---------- scrubber (wiring copied from the retired games.js) ---------- */
let track, win, labelSpans, cellSpans;
function buildScrub() {
  const host = $('scrubHost');
  const cols = `repeat(${N},1fr)`;
  host.innerHTML = `<div class="scrubLabels" style="grid-template-columns:${cols}" aria-hidden="true">${STAGES.map((s, i) => `<span data-i="${i}">${s.label_en}</span>`).join('')}</div>
    <div class="scrubTrack" style="grid-template-columns:${cols}" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="${N - 1}" aria-valuenow="0">${STAGES.map((s, i) => `<span class="scrubCell" data-i="${i}"></span>`).join('')}<div class="scrubWin"><b class="scrubHandle hL" aria-hidden="true">‹</b><b class="scrubHandle hR" aria-hidden="true">›</b></div></div>`;
  track = host.querySelector('.scrubTrack');
  win = host.querySelector('.scrubWin');
  labelSpans = [...host.querySelectorAll('.scrubLabels span')];
  cellSpans = [...host.querySelectorAll('.scrubCell')];
  labelSpans.forEach((el, i) => el.addEventListener('click', () => { range = [i, i]; paint(); }));

  const pointers = new Map();
  let pinch0 = null, pinchR0 = null;
  const cellW = () => track.getBoundingClientRect().width / N;
  const dxToCells = (px) => Math.round(px / cellW());
  const roleAt = (e) => (e.target.closest('.hL') ? 'L' : e.target.closest('.hR') ? 'R' : e.target.closest('.scrubWin') ? 'PAN' : null);
  // ±6 px rubber band when a drag pushes past either edge; reset on release.
  const overshoot = (p, d) => {
    const [s0, e0] = p.r0;
    const want = p.role === 'L' ? s0 + d : p.role === 'R' ? e0 + d : d < 0 ? s0 + d : e0 + d;
    return want < 0 ? -6 : want > N - 1 ? 6 : 0;
  };
  track.addEventListener('pointerdown', (e) => {
    const role = roleAt(e);
    if (!role) { const i = e.target.closest('.scrubCell')?.dataset.i; if (i != null) { range = [+i, +i]; paint(); } return; }
    track.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, x0: e.clientX, role, r0: [...range] });
    win.classList.add('drag');
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch0 = Math.abs(a.x - b.x); pinchR0 = [...range];
    }
  });
  track.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      range = zoomRange(pinchR0, dxToCells((Math.abs(a.x - b.x) - pinch0) / 2), N);
    } else {
      const d = dxToCells(e.clientX - p.x0);
      if (p.role === 'L') range = resizeLeft(p.r0, d, N);
      else if (p.role === 'R') range = resizeRight(p.r0, d, N);
      else range = panRange(p.r0, d, N);
      win.style.setProperty('--over', `${overshoot(p, d)}px`);
    }
    paint();
  });
  ['pointerup', 'pointercancel'].forEach((t) => track.addEventListener(t, (e) => {
    pointers.delete(e.pointerId);
    if (!pointers.size) { win.classList.remove('drag'); win.style.setProperty('--over', '0px'); }
    paint();
  }));
  let wheelT = 0;
  track.addEventListener('wheel', (e) => {
    e.preventDefault();
    const now = performance.now();
    if (now - wheelT < 120) return;
    wheelT = now;
    range = zoomRange(range, wheelScaleDelta(e.deltaY) > 0 ? 1 : -1, N);
    paint();
  }, { passive: false });
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { range = e.shiftKey ? resizeRight(range, 1, N) : panRange(range, 1, N); paint(); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { range = e.shiftKey ? resizeRight(range, -1, N) : panRange(range, -1, N); paint(); e.preventDefault(); }
    else if (e.key === 'Home') { range = [0, 0]; paint(); e.preventDefault(); }
    else if (e.key === 'End') { range = [0, N - 1]; paint(); e.preventDefault(); }
  });
}

function paint() {
  const [s, e] = range;
  win.style.setProperty('--l', `${(s / N) * 100}%`);
  win.style.setProperty('--w', `${((e - s + 1) / N) * 100}%`);
  track.setAttribute('aria-label', T('Stage range', '轮次区间'));
  track.setAttribute('aria-valuenow', String(s));
  const L = (i) => T(STAGES[i].long_en, STAGES[i].long_zh);
  track.setAttribute('aria-valuetext', s === e ? L(s) : `${L(s)} – ${L(e)}`);
  labelSpans.forEach((el, i) => { el.textContent = T(STAGES[i].label_en, STAGES[i].label_zh); el.classList.toggle('on', i >= s && i <= e); });
  cellSpans.forEach((el, i) => {
    const ms = stages[i].matches;
    el.textContent = ms.length ? String(ms.length) : '·';
    el.classList.toggle('done', ms.length > 0 && ms.every((m) => m.result));
  });
  if (!lastPaint || lastPaint[0] !== s || lastPaint[1] !== e) { renderCardsView(); lastPaint = [s, e]; }
}

/* ---------- hero / countdown ---------- */
function renderHero() {
  const patch = $('patch');
  if (patch && data.patch) patch.textContent = String(data.patch);
  const prov = $('prov');
  if (prov) {
    const badge = buildProvenanceBadge({ updatedAt: data.updated, version: data.version, sourceCount: Array.isArray(data.sources) ? data.sources.length : undefined, lang });
    prov.className = `w-prov prov-${badge.tier}`;
    prov.textContent = badge.text;
  }
  const note = $('gnote');
  if (note && data.note_en && data.note_zh) {
    note.setAttribute('data-en', data.note_en);
    note.setAttribute('data-zh', data.note_zh);
    note.textContent = T(data.note_en, data.note_zh);
  }
}

function tick() {
  const now = Date.now();
  const cd = $('countdown');
  if (cd && data) {
    const nk = nextKickoff(data.series, now);
    cd.textContent = nk ? `${fmtLocal(nk)} · ${fmtDur(Date.parse(nk) - now)}` : T('No upcoming series', '暂无待开赛场次');
  }
  document.querySelectorAll('#cardsView article.card').forEach((art) => {
    const ko = +art.dataset.ko;
    if (art.dataset.state === 'pick' && now >= ko) { const s = seriesById(art.dataset.id); if (s) { replaceCard(art, s); return; } }
    const el = art.querySelector('.cd');
    if (!el) return;
    el.textContent = art.dataset.state === 'result' ? T('FINAL', '已完场') : now >= ko ? T('LIVE / LOCKED', '已锁定 / 进行中') : `${T('LOCKS IN', '锁定倒计时')} ${fmtDur(ko - now)}`;
  });
}

/* ---------- record / champion / mvp / swiss / meta / sources ---------- */
function renderRecord() {
  if (!data) return;
  const you = userRecord(data.series, picks);
  const fab = fableRecord(data.series);
  const brier = Number.isFinite(data.record?.brier) ? data.record.brier : fab.brier;
  const kv = (b, l) => `<div class="rkv"><b>${b}</b><i>${l}</i></div>`;
  $('recordCols').innerHTML =
    `<div class="rcol you"><h3>${T('YOU', '你')}</h3><div class="rgrid">${kv(you.judged, T('judged', '已判'))}${kv(you.hits, T('hits', '命中'))}${kv(`${you.rate}%`, T('hit rate', '命中率'))}${kv(you.streak, T('streak', '连胜'))}</div></div>` +
    `<div class="rcol fable"><h3>${FABLE_ICON} FABLE</h3><div class="rgrid">${kv(fab.judged, T('judged', '已判'))}${kv(fab.hits, T('hits', '命中'))}${kv(`${fab.rate}%`, T('hit rate', '命中率'))}${kv(`${fab.exact} ⭐`, T('exact score', '比分全中'))}${kv(Number(brier).toFixed(3), 'Brier')}</div></div>`;
  const rec = data.record;
  const html = rec?.log?.length
    ? renderTrackRecordHTML({ ...rec, note_en: rec.note_en ?? '', note_zh: rec.note_zh ?? '' }, { T, fableIcon: FABLE_ICON, exactLabel: { en: 'exact series score', zh: '比分全中' }, logLimit: 12, title: { en: 'FABLE LOG', zh: 'FABLE 记录' } })
    : null;
  $('recordLog').innerHTML = html || '';
}

function renderChampion() {
  const fl = new Map((data.fearless || []).map((f) => [f.team, f]));
  const rows = (data.champion || []).slice().sort((a, b) => b.prob - a.prob);
  $('championList').innerHTML = rows.map((c) => {
    const f = fl.get(c.team);
    const chips = f?.champs?.length
      ? `<div class="chips">${f.champs.map((ch) => `<img src="${CHAMP_ICON(ch.slug)}" alt="${esc(ch.name)}" title="${esc(ch.name)}" loading="lazy" decoding="async" width="28" height="28">`).join('')}</div>`
      : '';
    const fear = f ? `<div class="fear"><span class="depth">${T('Fearless pool', '无畏征召英雄池')} · ${esc(f.depth)}</span>${chips}${f.note_en ? `<span class="fnote">${esc(T(f.note_en, f.note_zh))}</span>` : ''}</div>` : '';
    return `<div class="prow"><div class="prow-h">${logo(c.team)}<b>${esc(c.team)}</b><span class="pv">${pct1(c.prob)}</span>${c.market != null ? `<small>market ${pct1(c.market)}</small>` : ''}</div><i class="pbar"><b style="--w:${Math.max(0, Math.min(100, c.prob))}%"></b></i>${c.reason_en ? `<p class="why">${esc(T(c.reason_en, c.reason_zh))}</p>` : ''}${fear}</div>`;
  }).join('') || `<div class="empty">${T('Champion odds arrive with the first data run.', '夺冠概率将随首批数据发布。')}</div>`;
}

function renderMvp() {
  const rows = (data.mvp || []).slice().sort((a, b) => b.prob - a.prob).slice(0, 6);
  $('mvpList').innerHTML = rows.map((m) =>
    `<div class="prow"><div class="prow-h">${logo(m.teamCode)}<b>${esc(m.player)}</b><span class="tc">${esc(m.teamCode)}</span><span class="pv">${pct1(m.prob)}</span>${m.market != null ? `<small>market ${pct1(m.market)}</small>` : ''}</div><i class="pbar"><b style="--w:${Math.max(0, Math.min(100, m.prob))}%"></b></i>${m.basis_en ? `<p class="why">${esc(T(m.basis_en, m.basis_zh))}</p>` : ''}</div>`,
  ).join('') || `<div class="empty">${T('MVP candidates appear once the market names players.', 'MVP 候选将在市场公布选手后出现。')}</div>`;
}

function renderSwiss() {
  const rows = (data.swiss || []).slice().sort((a, b) => b.w - a.w || a.l - b.l || String(a.team).localeCompare(String(b.team)));
  const groups = [3, 2, 1, 0].map((w) => ({ w, teams: rows.filter((t) => t.w === w) })).filter((g) => g.teams.length);
  const badge = (status) => (status === 'advanced' ? T('ADVANCED', '晋级') : status === 'eliminated' ? T('ELIMINATED', '出局') : T('IN PLAY', '进行中'));
  $('swissGroups').innerHTML = groups.map((g) => {
    const label = [...new Set(g.teams.map((t) => `${t.w}-${t.l}`))].join(' / ');
    return `<div class="sgroup"><h3>${label}</h3>${g.teams.map((t) => `<div class="srow ${esc(t.status)}">${logo(t.team)}<b>${esc(t.team)}</b><span class="wl">${t.w}–${t.l}</span><span class="sbadge">${badge(t.status)}</span></div>`).join('')}</div>`;
  }).join('') || `<div class="empty">${T('Standings arrive with the first data run.', '积分表将随首批数据发布。')}</div>`;
}

function renderMeta() {
  const fmt = (v) => (Number.isFinite(v) ? (v <= 1 ? pct1(v * 100) : pct1(v)) : esc(v ?? '—'));
  const rows = (data.meta || []).slice(0, 12);
  $('metaBody').innerHTML = rows.map((m) =>
    `<tr><th scope="row">${esc(m.champ)}</th><td>${esc(m.picks ?? '—')}</td><td>${esc(m.bans ?? '—')}</td><td>${fmt(m.presence)}</td><td>${fmt(m.winrate)}</td></tr>`,
  ).join('') || `<tr><td colspan="5" class="empty">${T('Meta table arrives with the first data run.', 'Meta 表将随首批数据发布。')}</td></tr>`;
}

function renderSources() {
  $('sources').innerHTML = (data.sources || []).map((s) =>
    `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)}</a>${s.fetchedAt ? ` <time datetime="${esc(s.fetchedAt)}">${esc(String(s.fetchedAt).slice(0, 10))}</time>` : ''}</li>`,
  ).join('');
}

function renderAll() {
  lastPaint = null;
  paint();
  renderHero();
  renderRecord();
  renderChampion();
  renderMvp();
  renderSwiss();
  renderMeta();
  renderSources();
  tick();
}

async function load() {
  try {
    data = await fetchJson('worlds');
  } catch (err) {
    console.warn('[worlds] data unavailable', err);
    $('cardsView').innerHTML = `<div class="empty">${T('Data unavailable right now. Please try again later.', '数据暂时不可用，请稍后再试。')}</div>`;
    return;
  }
  stages = buildStages(data.series);
  const i = currentStageIndex(stages, Date.now());
  range = [i, i];
  renderAll();
}

buildScrub();
wireCards();
paint();
load();
setInterval(tick, 1000);
window.addEventListener('afflatus-lang', (e) => {
  lang = e.detail || getLocale('en');
  if (data) renderAll(); else paint();
});
