/* ============================================================
   LEAGUES — Hextech gold/blue MSI 2026 predictions by Fable 5 Max.
   Double-elimination Bo5 bracket, Fearless Draft. Shows Fable's series
   calls, real book odds where sourced, and a scratch card hiding the
   exact predicted series score. Life cycle: mode 'live' during the
   tournament, flips to 'archived' after the 7/12 Grand Final (see V1).
   For entertainment — not betting advice.
   ============================================================ */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const RM = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
  let lang = (() => { try { return window.AfflatusI18N ? window.AfflatusI18N.get() : (localStorage.getItem('afflatus:lang') === 'zh' ? 'zh' : 'en'); } catch { return 'en'; } })();
  const T = (en, zh) => lang === 'zh' ? zh : en;
  const FABLE_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" style="vertical-align:-2px" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="7" width="18" height="14" rx="5" fill="#F2994A"/><rect x="10" y="2" width="4" height="5" rx="2" fill="#F2994A"/><circle cx="12" cy="2" r="1.6" fill="#F2994A"/><circle cx="9" cy="14" r="1.8" fill="#3A2410"/><circle cx="15" cy="14" r="1.8" fill="#3A2410"/><path d="M8.5 17.5 Q12 20.5 15.5 17.5" stroke="#3A2410" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>';

  const SCR_KEY = 'afflatus-leagues:scratch:v1';
  const ls = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  let data = null;
  let scratched = new Set(ls(SCR_KEY, []));
  const saveScratch = () => save(SCR_KEY, [...scratched]);

  const fmtDur = (ms) => window.AfflatusClock.fmtDur(ms);
  const isTBD = (s) => s.home === 'TBD' || s.away === 'TBD';
  const teamName = (s, side) => lang === 'zh' ? (s[side + '_zh'] || s[side]) : s[side];
  const teamLogo = (code) => { const url = data && data.teamLogos && data.teamLogos[code]; return url ? `<img class="team-logo" src="${url}" alt="${code}" loading="lazy">` : ''; };

  /* ---------- scratch-to-reveal (identical mechanic to games.js) ---------- */
  function mountScratch(wrap, key) {
    if (!wrap) return;
    if (scratched.has(key)) { wrap.classList.add('revealed'); return; }
    const cv = document.createElement('canvas'); cv.className = 'scratch-cv'; cv.setAttribute('aria-hidden', 'true'); wrap.appendChild(cv);
    const ctx = cv.getContext('2d'); let moved = 0, drawing = false;
    function paint() {
      const r = wrap.getBoundingClientRect(); cv.width = Math.max(1, Math.floor(r.width)); cv.height = Math.max(1, Math.floor(r.height));
      ctx.globalCompositeOperation = 'source-over';
      const g = ctx.createLinearGradient(0, 0, cv.width, cv.height); g.addColorStop(0, '#1c1608'); g.addColorStop(.5, '#3a2f14'); g.addColorStop(1, '#150f06');
      ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
      for (let i = 0; i < cv.width * cv.height / 900; i++) { ctx.fillStyle = `rgba(255,255,255,${Math.random() * .14})`; ctx.fillRect(Math.random() * cv.width, Math.random() * cv.height, 2, 2); }
      ctx.fillStyle = 'rgba(200,170,110,.9)'; ctx.font = '700 11px "IBM Plex Mono",monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(lang === 'zh' ? '◤ 点击或刮开揭晓比分 ◢' : '◤ TAP OR SCRATCH TO REVEAL ◢', cv.width / 2, cv.height / 2);
    }
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const erase = (x, y) => { ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(x, y, 18, 0, 6.283); ctx.fill(); };
    function cleared() { try { const d = ctx.getImageData(0, 0, cv.width, cv.height).data; let c = 0, n = 0; for (let i = 3; i < d.length; i += 64) { n++; if (d[i] === 0) c++; } return n ? c / n : 0; } catch { return 0; } }
    function reveal() { scratched.add(key); saveScratch(); wrap.classList.add('revealed'); cv.style.transition = 'opacity .35s ease'; cv.style.opacity = '0'; setTimeout(() => cv.remove(), 370); }
    cv.addEventListener('pointerdown', (e) => { drawing = true; moved = 0; try { cv.setPointerCapture(e.pointerId); } catch {} const [x, y] = pos(e); erase(x, y); });
    cv.addEventListener('pointermove', (e) => {
      if (!drawing) return; const [x, y] = pos(e); erase(x, y); moved++;
      if (moved >= 6 && cleared() > 0.30) reveal();
    });
    cv.addEventListener('pointerup', () => {
      drawing = false;
      if (moved < 4 || cleared() > 0.28) reveal();
    });
    paint();
  }

  /* ---------- probability bars (Champion Odds) ---------- */
  function bar(host, items) {
    host.innerHTML = items.map((it) => {
      const title = lang === 'zh' ? (it.team_zh || it.team) : it.team;
      const reason = T(it.reason_en, it.reason_zh);
      const code = it.teamCode || it.team;
      return `<div class="prob" data-team="${it.team}"><div class="prow">${teamLogo(code)}<span class="pname">${title}</span><b class="pval" data-to="${it.prob}">0%</b></div><div class="pbar"><i style="--w:${it.prob}%"></i></div><p class="preason">${reason}</p></div>`;
    }).join('');
    if (!RM) host.querySelectorAll('.pval').forEach((el) => { const to = +el.dataset.to, t0 = performance.now(); (function s(ts) { const p = Math.min(1, (ts - t0) / 900); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))) + '%'; if (p < 1) requestAnimationFrame(s); })(performance.now()); });
    else host.querySelectorAll('.pval').forEach((el) => el.textContent = el.dataset.to + '%');
  }
  function renderChampions() {
    if (!$('champs')) return;
    bar($('champs'), data.champion);
    const fmap = {};
    (data.fearless || []).forEach((f) => { fmap[f.team] = f; });
    $('champs').querySelectorAll('.prob').forEach((card) => {
      const f = fmap[card.dataset.team]; if (!f) return;
      const depth = f.poolDepth != null ? f.poolDepth : '—';
      const champs = (f.champs && f.champs.length) ? `<div class="pchamps">${f.champs.map((c) => `<img src="https://gol.gg/_img/champions_icon/${c.slug}.png" alt="${c.name}" title="${c.name}" loading="lazy">`).join('')}</div>` : '';
      card.insertAdjacentHTML('beforeend', `<div class="pfearless"><span class="odds-label">${T('FEARLESS POOL', 'FEARLESS 英雄池')} · <b>${depth}</b></span><p class="preason">${T(f.note_en, f.note_zh)}</p>${champs}</div>`);
    });
  }
  function renderMvp() { if ($('mvp')) bar($('mvp'), data.mvp); }

  function outcomeLabel(s, side) { return T(teamName(s, side) + ' win', teamName(s, side) + ' 胜'); }

  /* ---------- odds display — 2-way (no draw possible in a Bo5 series) ---------- */
  function renderOdds(s) {
    const o = s.odds;
    if (!o) return '';
    const hn = teamName(s, 'home'), an = teamName(s, 'away');
    const cells = [
      { lbl: teamLogo(s.home) + ' ' + hn, val: o.h },
      { lbl: teamLogo(s.away) + ' ' + an, val: o.a }
    ].map((c) => `<div class="odds-cell"><div class="ol">${c.lbl}</div><div class="ov">${c.val.toFixed(2)}</div></div>`).join('');
    const src = o.src ? `<span class="odds-src">${T('Source', '来源')}: ${o.src} · ${T('for entertainment only', '仅供娱乐')}</span>` : '';
    return `<div class="odds"><div class="odds-label">${T('MONEYLINE · BOOK ODDS', '独赢盘 · 真实赔率')}</div><div class="odds-1x2">${cells}</div>${src}</div>`;
  }

  /* ---------- series (bracket cards) ---------- */
  function renderSeries() {
    const host = $('series'); if (!host || !data) return;
    const upcoming = data.series.filter((s) => !s.result);
    if (!upcoming.length) { host.innerHTML = `<div class="empty">${T('All series in this stage are complete.', '本阶段赛事均已结束。')}</div>`; return; }
    host.innerHTML = upcoming.map((s) => {
      const tbd = isTBD(s);
      const done = !!s.result;
      const opusLine = (s.opus && !tbd) ? `<div class="opus">${FABLE_ICON} <b>Fable</b> · ${outcomeLabel(s, s.opus)} · ${Math.round(s.conf * 100)}%<span class="orsn">${T(s.reason_en, s.reason_zh)}</span></div>` : (tbd ? '' : `<div class="opus dim">${FABLE_ICON} ${T('Call pending exact schedule confirmation', '待官方具体时间确认后给出研判')}</div>`);
      const oddsHtml = !tbd && !done ? renderOdds(s) : '';
      const opScore = (s.opusScore && !tbd && !done) ? `<div class="scratch opscore" data-key="score:${s.id}"><div class="reveal">${FABLE_ICON} <span data-en="FABLE SERIES SCORE" data-zh="FABLE 比分预测">FABLE SERIES SCORE</span> · <b>${teamLogo(s.home)} ${s.opusScore} ${teamLogo(s.away)}</b></div></div>` : '';
      const resultLine = done ? `<div class="resline">${T('FINAL', '终局')} · <b>${teamName(s, 'home')} ${s.result.home}–${s.result.away} ${teamName(s, 'away')}</b>${s.opus ? ` · ${T('Fable called', 'Fable 预测')} ${s.opus === (s.result.home > s.result.away ? 'home' : 'away') ? '✓' : '✗'}` : ''}</div>` : '';
      const homeTeam = `<div class="team-d">${teamLogo(s.home)}<span class="nm">${teamName(s, 'home')}</span></div>`;
      const awayTeam = `<div class="team-d">${teamLogo(s.away)}<span class="nm">${teamName(s, 'away')}</span></div>`;
      const vsBlock = `<div class="team-vs"><b>VS</b></div>`;
      const roundLabel = T(s.round, s.round_zh);
      return `<article class="fx${tbd ? ' tbd' : ''}${done ? ' locked' : ''}" data-id="${s.id}" data-ko="${Date.parse(s.kickoff)}" data-tbd="${tbd ? 1 : 0}" data-done="${done ? 1 : 0}"><div class="fx-top"><span class="stage">${roundLabel} · BO${s.bo}</span><span class="cd"></span></div><div class="fx-teams">${homeTeam}${vsBlock}${awayTeam}</div>${opusLine}${oddsHtml}${opScore}${resultLine}</article>`;
    }).join('');
    host.querySelectorAll('.scratch').forEach((w) => mountScratch(w, w.dataset.key));
    if (window.AfflatusI18N) window.AfflatusI18N.apply();
    tickSeries();
  }
  function tickSeries() {
    if (!$('series')) return; const now = Date.now();
    $('series').querySelectorAll('.fx').forEach((card) => {
      const ko = +card.dataset.ko, tbd = card.dataset.tbd === '1', done = card.dataset.done === '1';
      const cd = card.querySelector('.cd');
      if (!cd) return;
      if (done) { cd.textContent = T('COMPLETE', '已完场'); return; }
      if (tbd) { cd.textContent = T('MATCHUP TBD', '对阵未定'); return; }
      cd.textContent = (now >= ko) ? T('LIVE / LOCKED', '已锁定 / 进行中') : T('LOCKS IN', '锁定倒计时') + ' ' + fmtDur(ko - now);
      if (now >= ko) card.classList.add('locked');
    });
  }

  /* ---------- Fable track record — reused verbatim from games.js pattern ---------- */
  function renderRecord() {
    const host = $('record'); if (!host) return;
    const r = data && data.record;
    if (!r) { host.innerHTML = ''; host.style.display = 'none'; return; }
    host.style.display = '';
    const rate = r.winRate != null ? r.winRate : (r.resolved ? Math.round((r.correctOutcome / r.resolved) * 100) : 0);
    const log = (r.log || []).slice(0, 8).map((e) => {
      const cls = e.exact ? 'exact' : (e.ok ? 'ok' : 'no');
      const icon = e.exact ? '⭐' : (e.ok ? '✓' : '✗');
      return `<span class="rlog ${cls}" title="${T(e.pick_en, e.pick_zh)}">${icon} ${T(e.label_en, e.label_zh)}</span>`;
    }).join('');
    host.innerHTML =
      `<div class="rec-h"><span class="rec-t">${FABLE_ICON} ${T('FABLE TRACK RECORD', 'FABLE 历史战绩')}</span><span class="rec-since">${T('since', '自')} ${r.since || ''}</span></div>` +
      `<div class="rec-stats">` +
        `<div class="rec-big"><b>${rate}%</b><i>${T('outcome win rate', '胜负命中率')}</i></div>` +
        `<div class="rec-kv"><b>${r.correctOutcome || 0}/${r.resolved || 0}</b><i>${T('correct calls', '预测正确')}</i></div>` +
        `<div class="rec-kv"><b>${r.exactScore || 0} ⭐</b><i>${T('exact series score', '比分全中')}</i></div>` +
      `</div>` +
      (log ? `<div class="rec-log">${log}</div>` : '') +
      `<p class="rec-note">${T(r.note_en, r.note_zh)}</p>`;
  }

  function renderUpdated() {
    if ($('updated')) $('updated').textContent = data.updated || '';
    if ($('gnote')) $('gnote').textContent = T(data.note_en, data.note_zh);
  }

  function renderAll() { if (!data) return; renderUpdated(); renderRecord(); renderChampions(); renderMvp(); renderSeries(); }

  fetch('/leagues-data.json', { cache: 'no-store' }).then((r) => r.json()).then((d) => { data = d; renderAll(); }).catch(() => { if ($('series')) $('series').innerHTML = `<div class="empty">${T('Series data unavailable.', '赛程数据暂不可用。')}</div>`; });
  setInterval(tickSeries, 1000);
  window.addEventListener('afflatus-lang', (e) => { lang = e.detail === 'zh' ? 'zh' : 'en'; renderAll(); });
})();
