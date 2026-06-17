/* ============================================================
   GAMES — cyberpunk World Cup prediction (you vs. Opus 4.8).
   Pick match winners before kickoff; Opus reveals its call after you
   commit. Daily champion + best-player probabilities with reasoning.
   For entertainment — not betting advice.
   ============================================================ */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const RM = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
  let lang = (() => { try { return window.AfflatusI18N ? window.AfflatusI18N.get() : (localStorage.getItem('afflatus:lang') === 'zh' ? 'zh' : 'en'); } catch { return 'en'; } })();
  const T = (en, zh) => lang === 'zh' ? zh : en;
  const PICK_KEY = 'afflatus-games:picks:v1';
  let data = null;
  let picks = (() => { try { return JSON.parse(localStorage.getItem(PICK_KEY)) || {}; } catch { return {}; } })();
  const savePicks = () => { try { localStorage.setItem(PICK_KEY, JSON.stringify(picks)); } catch {} };

  const fmtDur = (ms) => { let s = Math.max(0, Math.floor(ms / 1000)); const d = Math.floor(s / 86400); s -= d * 86400; const h = Math.floor(s / 3600); s -= h * 3600; const m = Math.floor(s / 60); s -= m * 60; const p = (n) => String(n).padStart(2, '0'); return (d > 0 ? d + 'd ' : '') + p(h) + ':' + p(m) + ':' + p(s); };
  const isTBD = (f) => f.opus == null || /winner|runner|tbd|\?/i.test(f.home + f.away);
  const teamName = (f, side) => lang === 'zh' ? (f[side + '_zh'] || f[side]) : f[side];

  function bar(host, items, key) {
    host.innerHTML = items.map((it, i) => {
      const name = lang === 'zh' ? (it.team_zh || it.name_zh || it.team || it.name) : (it.team || it.name);
      const sub = it.name ? (lang === 'zh' ? (it.team_zh || it.team) : it.team) : '';
      const reason = T(it.reason_en, it.reason_zh);
      return `<div class="prob"><div class="prow"><span class="pflag">${it.flag || ''}</span><span class="pname">${name}${sub ? ` <i>· ${sub}</i>` : ''}</span><b class="pval" data-to="${it.prob}">0%</b></div><div class="pbar"><i style="--w:${it.prob}%"></i></div><p class="preason">${reason}</p></div>`;
    }).join('');
    // count-up
    if (!RM) host.querySelectorAll('.pval').forEach((el) => { const to = +el.dataset.to, t0 = performance.now(); (function s(ts) { const p = Math.min(1, (ts - t0) / 900); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))) + '%'; if (p < 1) requestAnimationFrame(s); })(performance.now()); });
    else host.querySelectorAll('.pval').forEach((el) => el.textContent = el.dataset.to + '%');
  }

  function renderChampions() { if ($('champs')) bar($('champs'), data.champions); }
  function renderPlayers() { if ($('players')) bar($('players'), data.players); }

  function outcomeLabel(f, o) { return o === 'draw' ? T('Draw', '平局') : T(f[o] + ' win', teamName(f, o) + ' 胜'); }

  function renderFixtures() {
    const host = $('fixtures'); if (!host || !data) return;
    const now = Date.now();
    host.innerHTML = data.fixtures.map((f) => {
      const ko = Date.parse(f.kickoff), locked = now >= ko, tbd = isTBD(f), pick = picks[f.id];
      const reveal = (pick || locked) && !tbd;
      const cd = tbd ? T('OPPONENTS TBD', '对手未定') : (locked ? (f.result ? T('FULL TIME', '完场') : T('LOCKED · KICKOFF', '已锁定 · 开球')) : T('LOCKS IN', '锁定倒计时') + ' ' + fmtDur(ko - now));
      const btn = (side) => { const on = pick === side ? ' on' : ''; const win = f.result && f.result === side ? ' win' : (f.result && pick === side && f.result !== side ? ' lose' : ''); const dis = (locked || tbd) ? ' disabled' : ''; const label = side === 'draw' ? ('<b>VS</b><small>' + T('DRAW', '平') + '</small>') : `<span class="fl">${f[side + 'Flag'] || ''}</span><span class="nm">${teamName(f, side)}</span>`; return `<button class="team team--${side}${on}${win}" data-id="${f.id}" data-pick="${side}"${dis ? ' disabled' : ''}>${label}</button>`; };
      let opusLine = '';
      if (reveal && f.opus) { const correct = f.result ? (f.opus === f.result ? 'ok' : 'bad') : ''; opusLine = `<div class="opus ${correct}">🤖 <b>Opus</b> · ${outcomeLabel(f, f.opus)} · ${Math.round(f.conf * 100)}%<span class="orsn">${T(f.reason_en, f.reason_zh)}</span></div>`; }
      let resLine = '';
      if (f.result) { const youOk = pick ? (pick === f.result ? '✓' : '✗') : '—'; resLine = `<div class="resline">${T('RESULT', '结果')}: <b>${outcomeLabel(f, f.result)}</b> · ${T('You', '你')} ${youOk}</div>`; }
      return `<article class="fx${locked ? ' locked' : ''}${tbd ? ' tbd' : ''}"><div class="fx-top"><span class="stage">${f.stage}</span><span class="cd">${cd}</span></div><div class="fx-teams">${btn('home')}${btn('draw')}${btn('away')}</div>${opusLine}${resLine}</article>`;
    }).join('');
    host.querySelectorAll('.team:not([disabled])').forEach((b) => b.addEventListener('click', () => { picks[b.dataset.id] = b.dataset.pick; savePicks(); renderFixtures(); renderScore(); }));
  }

  function renderScore() {
    if (!data || !$('scYou')) return;
    let you = 0, ai = 0, n = 0;
    for (const f of data.fixtures) { if (!f.result) continue; n++; if (picks[f.id] === f.result) you++; if (f.opus === f.result) ai++; }
    $('scYou').textContent = you; $('scAI').textContent = ai;
    $('scMeta').textContent = n ? `${T('resolved', '已结算')} ${n}` : T('awaiting results', '等待赛果');
  }

  function renderUpdated() { if ($('updated')) $('updated').textContent = data.updated || ''; if ($('gnote')) $('gnote').textContent = T(data.note_en, data.note_zh); }
  function renderAll() { if (!data) return; renderUpdated(); renderChampions(); renderPlayers(); renderFixtures(); renderScore(); }

  fetch('/games-data.json', { cache: 'no-store' }).then((r) => r.json()).then((d) => { data = d; renderAll(); }).catch(() => { if ($('fixtures')) $('fixtures').innerHTML = `<div class="empty">${T('Fixtures unavailable.', '赛程暂不可用。')}</div>`; });
  setInterval(() => { if (data) renderFixtures(); }, 1000);
  window.addEventListener('afflatus-lang', (e) => { lang = e.detail === 'zh' ? 'zh' : 'en'; renderAll(); });
})();
