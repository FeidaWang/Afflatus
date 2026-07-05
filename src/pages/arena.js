/* ============================================================
   ARENA · page chrome — TRAXUS//CVKM build — vanilla JS
   - Bilingual (EN/中) pre-market briefing modal + "Today's Signal" mini feed
   - Market status / countdown chips (NYSE session)
   - Custom HUD cursor
   The actual page content lives in two sibling modules loaded after this
   one (see arenaEntry.js): arenaTech.js (V13 TA dashboard) and
   arenaAutopilot.js (V5 Autopilot ledgers) — both are fully self-contained
   and only share the `afflatus-lang` event / window.AfflatusI18N with this
   file, no direct function calls either way.
   B10 (2026-07-05): the original Human-vs-AI prediction game (roster poll,
   per-symbol chart+indicators, OPEN/CLOSE betting, scoreboard) that used to
   live in this file has been formally removed — V13's TA dashboard replaced
   it as the page's actual content. See RELEASE_NOTES.md for the V5/B10 entry.
   For entertainment only — NOT investment advice.
   ============================================================ */
(() => {
  'use strict';

  const CONFIG = { newsUrl: '/arena-news.json' };
  const BRIEF_KEY = 'afflatus-arena:briefing', LANG_KEY = 'afflatus:lang';
  const RM = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();

  // ---- market hours / session --------------------------------
  function nyNow(d = new Date()) { const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value])); const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday]; return { wd, sec: (Number(p.hour) % 24) * 3600 + Number(p.minute) * 60 + Number(p.second) }; }
  const OPEN_S = 9 * 3600 + 30 * 60, CLOSE_S = 16 * 3600, PRE_S = 4 * 3600, POST_S = 20 * 3600;
  function marketStatus() { const { wd, sec } = nyNow(), wk = wd >= 1 && wd <= 5; if (wk && sec >= OPEN_S && sec < CLOSE_S) return { state: 'open', label: 'Regular Session' }; if (wk && sec >= PRE_S && sec < OPEN_S) return { state: 'pre', label: 'Pre-Market' }; if (wk && sec >= CLOSE_S && sec < POST_S) return { state: 'post', label: 'After Hours' }; return { state: 'closed', label: 'Market Closed' }; }
  function secsToNextOpen(wd, sec) { const wk = (d) => d >= 1 && d <= 5; if (wk(wd) && sec < OPEN_S) return OPEN_S - sec; let s = 86400 - sec, d = (wd + 1) % 7; for (let i = 0; i < 8; i++) { if (wk(d)) return s + OPEN_S; s += 86400; d = (d + 1) % 7; } return s + OPEN_S; }
  const fmtDur = (t) => window.AfflatusClock.fmtDurSec(t);   // shared util (public/lib/clock.js); t is in seconds

  // ---- sentiment ----------------------------------------------
  const POS = ['rally','surge','soar','gain','beat','record','jump','rise','rises','up','growth','strong','bullish','upgrade','breakthrough','demand','boom','expansion','outperform','climb','optimism','deal','agreement','peace'];
  const NEG = ['plunge','tumble','sink','fall','falls','drop','miss','weak','bearish','downgrade','selloff','sell-off','slump','fear','tariff','ban','restriction','probe','lawsuit','cut','hike','recession','crash','warning','jitters','squeezed','volatility'];
  const tkn = (s) => (s || '').toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/\s+/).filter(Boolean);
  function scoreText(t) { const a = tkn(t); if (!a.length) return 0; let s = 0; for (const w of a) { if (POS.includes(w)) s++; if (NEG.includes(w)) s--; } return Math.max(-1, Math.min(1, s / 4)); }
  function aggregateSentiment(items) { if (!items || !items.length) return 0; const xs = items.map((it) => typeof it.sentiment === 'number' ? it.sentiment : scoreText(`${it.title_en || ''} ${it.summary_en || ''}`)); return Number((xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(3)); }
  function sentLabel(s) { return s > 0.25 ? { label: 'Bullish', tone: 'bull' } : s < -0.25 ? { label: 'Bearish', tone: 'bear' } : { label: 'Neutral', tone: 'flat' }; }

  // ---- state --------------------------------------------------
  let lang0 = 'en'; try { const l = localStorage.getItem(LANG_KEY); if (l === 'zh' || l === 'en') lang0 = l; } catch {}
  const state = { lang: lang0, sentiment: 0, news: { date: null, items: [], aiPredictions: {}, loading: true }, lastUpdate: 0 };
  const T = (en, zh) => state.lang === 'zh' ? zh : en;

  // ---- rendering ------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const fmtClock = (ts) => ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
  const EMBED = (() => { try { return new URLSearchParams(location.search).has('embed'); } catch { return false; } })();
  function postHeight() { if (!EMBED) return; try { parent.postMessage({ type: 'afflatus-arena-height', height: document.documentElement.scrollHeight }, '*'); } catch {} }

  function renderStatus() { const st = marketStatus(); $('statusChip').className = `chip ${st.state}`; $('statusTxt').textContent = st.label; const sl = sentLabel(state.sentiment); $('sentChip').className = `chip ${sl.tone}`; $('sentTxt').textContent = sl.label; }
  function renderCountdown() { const { wd, sec } = nyNow(), open = wd >= 1 && wd <= 5 && sec >= OPEN_S && sec < CLOSE_S; $('openCd').classList.toggle('open', open); $('cdLabel').textContent = open ? 'US MARKET CLOSES IN' : 'US MARKET OPENS IN'; $('cdClock').textContent = fmtDur(open ? CLOSE_S - sec : secsToNextOpen(wd, sec)); }
  function renderNews() { const host = $('newsList'), n = state.news; $('newsDate').textContent = n.date ? '· ' + n.date : ''; if (n.loading) { host.innerHTML = `<div class="empty">${T('Loading digest…', '加载中…')}</div>`; return; } if (!n.items.length) { host.innerHTML = `<div class="empty">${T('No digest yet.', '暂无摘要。')}</div>`; return; } const icon = { financial: '◇', industrial: '▣', political: '⬡', tech: '⊞' }; host.innerHTML = n.items.map((it) => { const s = sentLabel(typeof it.sentiment === 'number' ? it.sentiment : scoreText(`${it.title_en || ''} ${it.summary_en || ''}`)); const title = T(it.title_en || it.title || '', it.title_zh || it.title_en || ''); return `<a href="${it.url || '#'}" target="_blank" rel="noreferrer noopener"><div class="t1"><span class="cat">${icon[it.category] || '•'} ${it.category || ''}</span><span class="sent ${s.tone}">${s.label}</span></div><div class="ti">${title}</div></a>`; }).join(''); }

  // ---- briefing (bilingual) -----------------------------------
  const todayStr = () => new Date().toISOString().slice(0, 10);
  function briefingAcked() { try { return localStorage.getItem(BRIEF_KEY) === (state.news.date || todayStr()); } catch { return false; } }
  function ackBriefing() { try { localStorage.setItem(BRIEF_KEY, state.news.date || todayStr()); } catch {} }
  function buildBriefing() {
    const n = state.news, sl = sentLabel(state.sentiment), icon = { financial: '◇', industrial: '▣', political: '⬡', tech: '⊞' };
    const disclaimer = T(n.disclaimer_en || 'NOT INVESTMENT ADVICE — entertainment only.', n.disclaimer_zh || '非投资建议——仅供娱乐。');
    const note = T(n.predictionNote_en || '', n.predictionNote_zh || '');
    const items = n.items.map((it) => { const s = sentLabel(typeof it.sentiment === 'number' ? it.sentiment : scoreText(`${it.title_en || ''} ${it.summary_en || ''}`)); const title = T(it.title_en || it.title || '', it.title_zh || it.title_en || ''); const sum = T(it.summary_en || it.summary || '', it.summary_zh || it.summary_en || ''); return `<article class="bf-item"><div class="bf-itop"><span class="bf-cat">${icon[it.category] || '•'} ${it.category || 'note'}</span><span class="bf-sent ${s.tone}">${s.label}</span></div><h3 class="bf-title">${title}</h3>${sum ? `<p class="bf-sum">${sum}</p>` : ''}${it.source ? `<a class="bf-src" href="${it.url || '#'}" target="_blank" rel="noreferrer noopener">${it.source} ↗</a>` : ''}</article>`; }).join('');
    return `<div class="bf-backdrop" id="bfBackdrop"></div><div class="bf-modal" role="dialog" aria-modal="true" aria-labelledby="bfHeading" tabindex="-1" id="bfModal"><div class="bf-prog" id="bfProg" role="progressbar" aria-label="Reading progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0"><div class="bf-prog-fill" id="bfProgFill"></div></div><header class="bf-head"><div class="bf-barcode" aria-hidden="true"></div><div class="bf-htext"><p class="bf-kicker">TRAXUS//CVKM · ${T('DESK BRIEFING', '交易台简报')}</p><h2 class="bf-h" id="bfHeading">${T('Pre-Market Briefing', '盘前简报')}</h2><p class="bf-date">${n.date ? T('Digest', '摘要') + ' · ' + n.date : T('awaiting first run', '等待首次生成')} · ${T('sentiment', '情绪')} <b class="${sl.tone}">${sl.label}</b></p></div><button class="bf-lang" id="bfLang" aria-label="Toggle language">${state.lang === 'zh' ? 'EN' : '中文'}</button><button class="bf-x" id="bfClose" aria-label="Skip and close">✕</button></header><div class="bf-body" id="bfBody" tabindex="0"><div class="bf-warn" role="note"><b>⚠ ${T('NOT INVESTMENT ADVICE.', '非投资建议。')}</b> ${disclaimer}</div>${note ? `<p class="bf-note">${note}</p>` : ''}${items || `<div class="bf-empty">${T('No digest yet. The scheduled task writes it ~1h before the US open.', '暂无摘要。定时任务会在美股开盘前约 1 小时生成。')}</div>`}<div class="bf-end">— ${T('END OF BRIEFING', '简报结束')} —</div></div><footer class="bf-foot"><button class="bf-skip" id="bfSkip">${T('Skip', '跳过')}</button><button class="bf-enter" id="bfEnter">${T('ENTER THE ARENA ▶', '进入 ARENA ▶')}</button></footer></div>`;
  }
  function openBriefing() {
    const host = $('briefing'); if (!host) return; host.innerHTML = buildBriefing(); host.hidden = false; try { document.body.style.overflow = 'hidden'; } catch {}
    const body = $('bfBody'), fill = $('bfProgFill'), prog = $('bfProg');
    const update = () => { const max = body.scrollHeight - body.clientHeight, pct = max > 0 ? Math.min(100, (body.scrollTop / max) * 100) : 100; fill.style.width = pct + '%'; prog.setAttribute('aria-valuenow', Math.round(pct)); };
    body.addEventListener('scroll', update);
    const scrub = (cx) => { const r = prog.getBoundingClientRect(); body.scrollTop = Math.max(0, Math.min(1, (cx - r.left) / r.width)) * (body.scrollHeight - body.clientHeight); };
    let drag = false; prog.addEventListener('pointerdown', (e) => { drag = true; try { prog.setPointerCapture(e.pointerId); } catch {} scrub(e.clientX); }); prog.addEventListener('pointermove', (e) => { if (drag) scrub(e.clientX); }); prog.addEventListener('pointerup', () => { drag = false; });
    prog.addEventListener('keydown', (e) => { const max = body.scrollHeight - body.clientHeight; if (e.key === 'ArrowRight' || e.key === 'ArrowDown') body.scrollTop = Math.min(max, body.scrollTop + max * 0.1); if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') body.scrollTop = Math.max(0, body.scrollTop - max * 0.1); });
    const close = () => { ackBriefing(); host.hidden = true; try { document.body.style.overflow = ''; } catch {} };
    $('bfEnter').addEventListener('click', close); $('bfClose').addEventListener('click', close); $('bfSkip').addEventListener('click', close); $('bfBackdrop').addEventListener('click', close);
    $('bfLang').addEventListener('click', () => { toggleLang(); openBriefing(); });
    host.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    setTimeout(() => { try { $('bfModal').focus(); } catch {} update(); }, 30);
  }
  function toggleLang() { if (window.AfflatusI18N) { window.AfflatusI18N.toggle(); return; } state.lang = state.lang === 'zh' ? 'en' : 'zh'; try { localStorage.setItem(LANG_KEY, state.lang); } catch {} renderNews(); }

  // ---- custom HUD cursor --------------------------------------
  function initCursor() {
    try {
      if (RM || EMBED) return; if (typeof document.createElement !== 'function') return; if (matchMedia('(pointer:coarse)').matches) return;
      const el = document.createElement('div'); el.className = 'fx-cursor'; el.innerHTML = '<i></i><i></i><i></i><i></i><span></span>'; document.body.appendChild(el); document.body.classList.add('has-cursor');
      addEventListener('pointermove', (e) => { el.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; }, { passive: true });
      addEventListener('pointerover', (e) => { const hot = e.target.closest && e.target.closest('button,a'); el.classList.toggle('hot', !!hot); });
      addEventListener('pointerdown', () => el.classList.add('down')); addEventListener('pointerup', () => el.classList.remove('down'));
    } catch {}
  }

  // ---- boot ---------------------------------------------------
  fetch(CONFIG.newsUrl, { cache: 'no-store' })
    .then((r) => r.ok ? r.json() : Promise.reject())
    .then((data) => { const items = (data.items || []).map((it) => ({ ...it, sentiment: typeof it.sentiment === 'number' ? it.sentiment : scoreText(`${it.title_en || it.title || ''} ${it.summary_en || it.summary || ''}`) })); state.news = { date: data.date || null, items, aiPredictions: data.aiPredictions || {}, disclaimer_en: data.disclaimer_en, disclaimer_zh: data.disclaimer_zh, predictionNote_en: data.predictionNote_en, predictionNote_zh: data.predictionNote_zh, loading: false }; state.sentiment = aggregateSentiment(items); state.lastUpdate = Date.now(); })
    .catch(() => { state.news = { date: null, items: [], aiPredictions: {}, loading: false }; })
    .finally(() => { renderNews(); renderStatus(); if (!EMBED && !briefingAcked()) openBriefing(); });

  const ob = $('openBriefBtn'); if (ob) ob.addEventListener('click', openBriefing);
  // language is owned by the shared i18n engine (.lang-toggle); arena re-renders on change
  window.addEventListener('afflatus-lang', (e) => { state.lang = e.detail === 'zh' ? 'zh' : 'en'; renderStatus(); renderNews(); });
  if (EMBED) { document.body.classList.add('embed'); window.addEventListener('resize', postHeight); setInterval(postHeight, 1200); }
  initCursor();
  renderStatus(); renderNews(); renderCountdown();
  setInterval(renderStatus, 15000);
  setInterval(renderCountdown, 1000);
  setTimeout(postHeight, 300); setTimeout(postHeight, 1500);
})();
