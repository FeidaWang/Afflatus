/* ============================================================
   GAMES — cyberpunk World Cup prediction (you vs. Opus 4.8).
   Pick winners + scorelines + group standings before kickoff.
   Opus's calls are hidden behind a SCRATCH card — drag to reveal.
   For entertainment — not betting advice.
   ============================================================ */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const RM = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
  let lang = (() => { try { return window.AfflatusI18N ? window.AfflatusI18N.get() : (localStorage.getItem('afflatus:lang') === 'zh' ? 'zh' : 'en'); } catch { return 'en'; } })();
  const T = (en, zh) => lang === 'zh' ? zh : en;

  const PICK_KEY = 'afflatus-games:picks:v1', SCORE_KEY = 'afflatus-games:scores:v1', GORDER_KEY = 'afflatus-games:gorder:v1', SCR_KEY = 'afflatus-games:scratch:v1';
  const ls = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  let data = null;
  let picks = ls(PICK_KEY, {}), scores = ls(SCORE_KEY, {}), gorder = ls(GORDER_KEY, {});
  let scratched = new Set(ls(SCR_KEY, []));
  const saveScratch = () => save(SCR_KEY, [...scratched]);

  const fmtDur = (ms) => { let s = Math.max(0, Math.floor(ms / 1000)); const d = Math.floor(s / 86400); s -= d * 86400; const h = Math.floor(s / 3600); s -= h * 3600; const m = Math.floor(s / 60); s -= m * 60; const p = (n) => String(n).padStart(2, '0'); return (d > 0 ? d + 'd ' : '') + p(h) + ':' + p(m) + ':' + p(s); };
  const isTBD = (f) => f.opus == null || /winner|runner|tbd|\?/i.test(f.home + f.away);
  const teamName = (f, side) => lang === 'zh' ? (f[side + '_zh'] || f[side]) : f[side];

  /* ---------- scratch-to-reveal ---------- */
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
      ctx.fillText(lang === 'zh' ? '◤ 刮开揭晓 OPUS ◢' : '◤ SCRATCH TO REVEAL ◢', cv.width / 2, cv.height / 2);
    }
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const erase = (x, y) => { ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(x, y, 15, 0, 6.283); ctx.fill(); };
    function cleared() { try { const d = ctx.getImageData(0, 0, cv.width, cv.height).data; let c = 0, n = 0; for (let i = 3; i < d.length; i += 64) { n++; if (d[i] === 0) c++; } return n ? c / n : 0; } catch { return 0; } }
    function reveal() { scratched.add(key); saveScratch(); wrap.classList.add('revealed'); cv.style.transition = 'opacity .4s ease'; cv.style.opacity = '0'; setTimeout(() => cv.remove(), 420); if (key && key.indexOf('grp:') === 0) compareGroup(key.slice(4)); }
    cv.addEventListener('pointerdown', (e) => { drawing = true; try { cv.setPointerCapture(e.pointerId); } catch {} const [x, y] = pos(e); erase(x, y); });
    cv.addEventListener('pointermove', (e) => { if (!drawing) return; const [x, y] = pos(e); erase(x, y); if ((++moved % 9) === 0 && cleared() > 0.55) reveal(); });
    cv.addEventListener('pointerup', () => { drawing = false; if (cleared() > 0.5) reveal(); });
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

  /* ---------- fixtures (build once; tick updates only countdown/lock) ---------- */
  function renderFixtures() {
    const host = $('fixtures'); if (!host || !data) return;
    host.innerHTML = data.fixtures.map((f) => {
      const tbd = isTBD(f), pick = picks[f.id], sc = scores[f.id] || {};
      const btn = (side) => { const on = pick === side ? ' on' : ''; const dis = tbd ? ' disabled' : ''; const label = side === 'draw' ? ('<b>VS</b><small>' + T('DRAW', '平') + '</small>') : `<span class="fl">${f[side + 'Flag'] || ''}</span><span class="nm">${teamName(f, side)}</span>`; return `<button class="team team--${side}${on}" data-id="${f.id}" data-pick="${side}"${dis ? ' disabled' : ''}>${label}</button>`; };
      const opusLine = (f.opus && !tbd) ? `<div class="opus">🤖 <b>Opus</b> · ${outcomeLabel(f, f.opus)} · ${Math.round(f.conf * 100)}%<span class="orsn">${T(f.reason_en, f.reason_zh)}</span></div>` : '';
      const scoreRow = tbd ? '' : `<div class="sgwrap"><span class="sglbl">${T('YOUR SCORE', '你的比分')}</span><div class="sgbox"><span class="sgf">${f.homeFlag}</span><button class="sgb" data-id="${f.id}" data-k="h" data-d="-1">−</button><b class="sgv" data-v="${f.id}-h">${sc.h != null ? sc.h : '–'}</b><button class="sgb" data-id="${f.id}" data-k="h" data-d="1">+</button><span class="sgc">:</span><button class="sgb" data-id="${f.id}" data-k="a" data-d="-1">−</button><b class="sgv" data-v="${f.id}-a">${sc.a != null ? sc.a : '–'}</b><button class="sgb" data-id="${f.id}" data-k="a" data-d="1">+</button><span class="sgf">${f.awayFlag}</span></div></div>`;
      const opScore = (f.opusScore && !tbd) ? `<div class="scratch opscore" data-key="score:${f.id}"><div class="reveal">🤖 <span data-en="OPUS SCORE" data-zh="OPUS 比分">OPUS SCORE</span> · <b>${f.homeFlag} ${f.opusScore} ${f.awayFlag}</b></div></div>` : (tbd ? `<div class="tbdnote">${T('Opponents undecided', '对手未定')}</div>` : '');
      return `<article class="fx${pick ? ' picked' : ''}${tbd ? ' tbd' : ''}" data-id="${f.id}" data-ko="${Date.parse(f.kickoff)}" data-tbd="${tbd ? 1 : 0}"><div class="fx-top"><span class="stage">${f.stage}</span><span class="cd"></span></div><div class="fx-teams">${btn('home')}${btn('draw')}${btn('away')}</div>${opusLine}${scoreRow}${opScore}</article>`;
    }).join('');
    // winner picks (targeted update — no rebuild, so scratch survives)
    host.querySelectorAll('.team:not([disabled])').forEach((b) => b.addEventListener('click', () => {
      const card = b.closest('.fx'); if (card.classList.contains('locked')) return;
      picks[b.dataset.id] = b.dataset.pick; save(PICK_KEY, picks);
      card.querySelectorAll('.team').forEach((x) => x.classList.toggle('on', x.dataset.pick === b.dataset.pick));
      card.classList.add('picked'); renderScore();
    }));
    // score steppers
    host.querySelectorAll('.sgb').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.id, k = b.dataset.k, cur = (scores[id] && scores[id][k] != null) ? scores[id][k] : 0;
      const v = Math.max(0, Math.min(15, cur + (+b.dataset.d)));
      scores[id] = scores[id] || {}; scores[id][k] = v; save(SCORE_KEY, scores);
      const el = host.querySelector(`.sgv[data-v="${id}-${k}"]`); if (el) el.textContent = v;
    }));
    // mount scratch cards
    host.querySelectorAll('.scratch').forEach((w) => mountScratch(w, w.dataset.key));
    if (window.AfflatusI18N) window.AfflatusI18N.apply();
    tickFixtures();
  }
  function tickFixtures() {
    if (!$('fixtures')) return; const now = Date.now();
    $('fixtures').querySelectorAll('.fx').forEach((card) => {
      const ko = +card.dataset.ko, tbd = card.dataset.tbd === '1', locked = now >= ko;
      const cd = card.querySelector('.cd');
      if (tbd) { cd.textContent = T('OPPONENTS TBD', '对手未定'); return; }
      cd.textContent = locked ? T('LOCKED · KICKOFF', '已锁定 · 开球') : T('LOCKS IN', '锁定倒计时') + ' ' + fmtDur(ko - now);
      if (locked && !card.classList.contains('locked')) { card.classList.add('locked', 'picked'); card.querySelectorAll('.team,.sgb').forEach((b) => b.setAttribute('disabled', '')); }
    });
  }

  /* ---------- group standings (you vs Opus, scratch to reveal) ---------- */
  function renderGroups() {
    const host = $('groups'); if (!host || !data || !data.groups) return;
    host.innerHTML = data.groups.map((gp) => {
      const mine = gorder[gp.id] || {};
      const chips = gp.teams.map((t) => { const r = mine[t.name]; return `<button class="gt${r ? ' ranked' : ''}" data-g="${gp.id}" data-team="${t.name}"><span class="rk">${r || ''}</span><span class="gfl">${t.flag}</span><span class="gnm">${lang === 'zh' ? t.name_zh : t.name}</span></button>`; }).join('');
      const order = gp.opusOrder.map((nm, i) => { const t = gp.teams.find((x) => x.name === nm) || { flag: '', name: nm, name_zh: nm }; return `<span class="ord"><b>${i + 1}</b>${t.flag} ${lang === 'zh' ? t.name_zh : t.name}</span>`; }).join('');
      return `<article class="grp" data-g="${gp.id}"><div class="grp-h"><h3>${T('GROUP', '小组')} ${gp.id}</h3><span class="grp-hint">${T('tap teams 1→4', '点选 1→4 名次')}</span></div><div class="grp-teams">${chips}</div><div class="scratch grpopus" data-key="grp:${gp.id}"><div class="reveal">🤖 <span data-en="OPUS FINISH" data-zh="OPUS 终排">OPUS FINISH</span> · ${order}<em class="grsn">${T(gp.reason_en, gp.reason_zh)}</em></div></div><div class="grp-cmp" data-g="${gp.id}"></div></article>`;
    }).join('');
    host.querySelectorAll('.gt').forEach((b) => b.addEventListener('click', () => {
      const g = b.dataset.g, team = b.dataset.team; const o = gorder[g] || {};
      if (o[team]) { const r = o[team]; delete o[team]; Object.keys(o).forEach((k) => { if (o[k] > r) o[k]--; }); }
      else { const used = Object.values(o); let r = 1; while (used.includes(r) && r <= 4) r++; if (r <= 4) o[team] = r; }
      gorder[g] = o; save(GORDER_KEY, gorder);
      const card = b.closest('.grp'); data.groups.find((x) => x.id === g).teams.forEach((t) => { const el = card.querySelector(`.gt[data-team="${t.name}"]`); const rk = (gorder[g] || {})[t.name]; el.classList.toggle('ranked', !!rk); el.querySelector('.rk').textContent = rk || ''; });
      compareGroup(g);
    }));
    host.querySelectorAll('.scratch').forEach((w) => mountScratch(w, w.dataset.key));
    data.groups.forEach((gp) => compareGroup(gp.id));
    if (window.AfflatusI18N) window.AfflatusI18N.apply();
  }
  function compareGroup(g) {
    const card = $('groups') && $('groups').querySelector(`.grp[data-g="${g}"]`); if (!card) return;
    const cmp = card.querySelector('.grp-cmp'); const gp = data.groups.find((x) => x.id === g); const o = gorder[g] || {};
    const full = Object.keys(o).length === 4; const revealed = scratched.has('grp:' + g);
    if (!full) { cmp.textContent = T('rank all four to compare', '排满四名后可对比'); cmp.className = 'grp-cmp'; return; }
    if (!revealed) { cmp.textContent = T('scratch Opus to compare ↑', '刮开 Opus 后对比 ↑'); cmp.className = 'grp-cmp'; return; }
    let hit = 0; gp.opusOrder.forEach((nm, i) => { if (o[nm] === i + 1) hit++; });
    cmp.innerHTML = `${T('MATCH', '吻合')}: <b>${hit}/4</b> ${hit >= 3 ? '🟢' : hit >= 1 ? '🟡' : '🔴'}`; cmp.className = 'grp-cmp on';
  }

  /* ---------- scoreboard (winner accuracy once results land) ---------- */
  function renderScore() {
    if (!data || !$('scYou')) return; let you = 0, ai = 0, n = 0;
    for (const f of data.fixtures) { if (!f.result) continue; n++; if (picks[f.id] === f.result) you++; if (f.opus === f.result) ai++; }
    $('scYou').textContent = you; $('scAI').textContent = ai;
    $('scMeta').textContent = n ? `${T('resolved', '已结算')} ${n}` : T('awaiting results', '等待赛果');
  }
  function renderUpdated() { if ($('updated')) $('updated').textContent = data.updated || ''; if ($('gnote')) $('gnote').textContent = T(data.note_en, data.note_zh); }
  function renderAll() { if (!data) return; renderUpdated(); renderChampions(); renderPlayers(); renderFixtures(); renderGroups(); renderScore(); }

  fetch('/games-data.json', { cache: 'no-store' }).then((r) => r.json()).then((d) => { data = d; renderAll(); }).catch(() => { if ($('fixtures')) $('fixtures').innerHTML = `<div class="empty">${T('Fixtures unavailable.', '赛程暂不可用。')}</div>`; });
  setInterval(tickFixtures, 1000);
  window.addEventListener('afflatus-lang', (e) => { lang = e.detail === 'zh' ? 'zh' : 'en'; renderAll(); });
})();
