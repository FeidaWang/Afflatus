/* ============================================================
   GAMES — cyberpunk World Cup predictions by Opus 4.8.
   Shows Opus's calls, real betting odds, and group standings.
   Scratch cards reveal the exact predicted scoreline.
   For entertainment — not betting advice.
   ============================================================ */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const RM = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
  let lang = (() => { try { return window.AfflatusI18N ? window.AfflatusI18N.get() : (localStorage.getItem('afflatus:lang') === 'zh' ? 'zh' : 'en'); } catch { return 'en'; } })();
  const T = (en, zh) => lang === 'zh' ? zh : en;

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
      // Opus prediction (always visible once kickoff locked, or always show for upcoming)
      const opusLine = (f.opus && !tbd) ? `<div class="opus">🤖 <b>Opus</b> · ${outcomeLabel(f, f.opus)} · ${Math.round(f.conf * 100)}%<span class="orsn">${T(f.reason_en, f.reason_zh)}</span></div>` : '';
      // Odds
      const oddsHtml = !tbd ? renderOdds(f) : '';
      // Scratch to reveal exact score only
      const opScore = (f.opusScore && !tbd) ? `<div class="scratch opscore" data-key="score:${f.id}"><div class="reveal">🤖 <span data-en="OPUS SCORE" data-zh="OPUS 比分">OPUS SCORE</span> · <b>${f.homeFlag} ${f.opusScore} ${f.awayFlag}</b></div></div>` : (tbd ? `<div class="tbdnote">${T('Opponents undecided', '对手未定')}</div>` : '');
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

  /* ---------- group standings — Opus order shown directly (group stage over) ---------- */
  function renderGroups() {
    const host = $('groups'); if (!host || !data || !data.groups) return;
    host.innerHTML = data.groups.map((gp) => {
      const order = gp.opusOrder.map((nm, i) => {
        const t = gp.teams.find((x) => x.name === nm) || { flag: '', name: nm, name_zh: nm };
        return `<span class="ord"><b>${i + 1}</b>${t.flag} ${lang === 'zh' ? t.name_zh : t.name}</span>`;
      }).join('');
      return `<article class="grp" data-g="${gp.id}"><div class="grp-h"><h3>${T('GROUP', '小组')} ${gp.id}</h3></div><div class="grp-opus-order">🤖 ${order}</div><p class="grp-cmp">${T(gp.reason_en, gp.reason_zh)}</p></article>`;
    }).join('');
    if (window.AfflatusI18N) window.AfflatusI18N.apply();
  }

  /* ---------- Opus track record — gold ⭐ for exact scores ---------- */
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
      `<div class="rec-h"><span class="rec-t">🤖 ${T('OPUS TRACK RECORD', 'OPUS 历史战绩')}</span><span class="rec-since">${T('since', '自')} ${r.since || ''}</span></div>` +
      `<div class="rec-stats">` +
        `<div class="rec-big"><b>${rate}%</b><i>${T('outcome win rate', '胜负命中率')}</i></div>` +
        `<div class="rec-kv"><b>${r.correctOutcome || 0}/${r.resolved || 0}</b><i>${T('correct calls', '预测正确')}</i></div>` +
        `<div class="rec-kv"><b>${r.exactScore || 0} ⭐</b><i>${T('exact scorelines', '比分全中')}</i></div>` +
      `</div>` +
      (log ? `<div class="rec-log">${log}</div>` : '') +
      `<p class="rec-note">${T(r.note_en, r.note_zh)}</p>`;
  }

  function renderUpdated() {
    if ($('updated')) $('updated').textContent = data.updated || '';
    if ($('gnote')) $('gnote').textContent = T(data.note_en, data.note_zh);
  }

  function renderAll() { if (!data) return; renderUpdated(); renderRecord(); renderChampions(); renderPlayers(); renderFixtures(); renderGroups(); }

  fetch('/games-data.json', { cache: 'no-store' }).then((r) => r.json()).then((d) => { data = d; renderAll(); }).catch(() => { if ($('fixtures')) $('fixtures').innerHTML = `<div class="empty">${T('Fixtures unavailable.', '赛程暂不可用。')}</div>`; });
  setInterval(tickFixtures, 1000);
  window.addEventListener('afflatus-lang', (e) => { lang = e.detail === 'zh' ? 'zh' : 'en'; renderAll(); });
})();
