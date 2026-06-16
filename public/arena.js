/* ============================================================
   AI Stock Arena — vanilla JS, native to Project Afflatus.
   Live Finnhub quotes (with simulated fallback), a 60s player-vs-AI
   prediction game, and a daily news-sentiment signal.
   For entertainment only — not investment advice.
   ============================================================ */
(() => {
  'use strict';

  // ---- config -------------------------------------------------
  const CONFIG = {
    finnhubKey: 'd8nvs5pr01qvtr6lft30d8nvs5pr01qvtr6lft3g', // free tier; visible client-side
    dataSource: 'finnhub',   // 'finnhub' | 'sim'
    pollMs: 8000,
    newsUrl: '/arena-news.json',
  };

  const TICKERS = [
    { symbol: 'NVDA',  name: 'NVIDIA',    sector: 'AI Chips',    seed: 142.0 },
    { symbol: 'AMD',   name: 'AMD',       sector: 'AI Chips',    seed: 178.5 },
    { symbol: 'AVGO',  name: 'Broadcom',  sector: 'AI Chips',    seed: 248.0 },
    { symbol: 'MSFT',  name: 'Microsoft', sector: 'AI Cloud',    seed: 470.0 },
    { symbol: 'GOOGL', name: 'Alphabet',  sector: 'AI Cloud',    seed: 188.0 },
    { symbol: 'MU',    name: 'Micron',    sector: 'AI Memory',   seed: 132.0 },
    { symbol: 'PLTR',  name: 'Palantir',  sector: 'AI Software', seed: 92.0 },
    { symbol: 'TSM',   name: 'TSMC',      sector: 'Foundry',     seed: 205.0 },
  ];
  const SYMBOLS = TICKERS.map((t) => t.symbol);
  const BY_SYM = Object.fromEntries(TICKERS.map((t) => [t.symbol, t]));
  const HORIZON_MS = 60000;
  const STORAGE_KEY = 'afflatus-arena:v1';
  const MAX_HISTORY = 120;

  // ---- market hours (US, America/New_York) --------------------
  function marketStatus(date = new Date()) {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
    const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
    const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday];
    const mins = Number(p.hour) * 60 + Number(p.minute);
    const isWk = wd >= 1 && wd <= 5;
    if (isWk && mins >= 570 && mins < 960) return { state: 'open', label: 'Market Open' };
    if (isWk && mins >= 240 && mins < 570) return { state: 'pre', label: 'Pre-Market' };
    if (isWk && mins >= 960 && mins < 1200) return { state: 'post', label: 'After Hours' };
    return { state: 'closed', label: 'Market Closed' };
  }

  // current New York wall-clock as {weekday, secondsIntoDay}
  function nyNow(date = new Date()) {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
    const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday];
    const h = Number(p.hour) % 24; // some engines emit "24" at midnight
    return { wd, sec: h * 3600 + Number(p.minute) * 60 + Number(p.second) };
  }
  const OPEN_S = 9 * 3600 + 30 * 60;   // 09:30 ET
  const CLOSE_S = 16 * 3600;           // 16:00 ET
  function secsToNextOpen(wd, sec) {
    const isWk = (d) => d >= 1 && d <= 5;
    if (isWk(wd) && sec < OPEN_S) return OPEN_S - sec;        // opens later today
    let s = 86400 - sec, d = (wd + 1) % 7;                    // roll to tomorrow
    for (let i = 0; i < 8; i++) { if (isWk(d)) return s + OPEN_S; s += 86400; d = (d + 1) % 7; }
    return s + OPEN_S;
  }
  function fmtDur(total) {
    let s = Math.max(0, Math.floor(total));
    const d = Math.floor(s / 86400); s -= d * 86400;
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); s -= m * 60;
    const p = (n) => String(n).padStart(2, '0');
    return (d > 0 ? d + 'd ' : '') + p(h) + ':' + p(m) + ':' + p(s);
  }

  // ---- sentiment ----------------------------------------------
  const POS = ['rally','surge','soar','gain','beat','record','jump','rise','rises','up','growth','strong','bullish','upgrade','breakthrough','demand','boom','expansion','outperform','climb','optimism','deal','agreement','peace'];
  const NEG = ['plunge','tumble','sink','fall','falls','drop','miss','weak','bearish','downgrade','selloff','sell-off','slump','fear','tariff','ban','restriction','probe','lawsuit','cut','hike','recession','crash','warning','jitters','squeezed','volatility'];
  const tokenize = (s) => (s || '').toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/\s+/).filter(Boolean);
  function scoreText(text) {
    const t = tokenize(text); if (!t.length) return 0;
    let s = 0; for (const w of t) { if (POS.includes(w)) s += 1; if (NEG.includes(w)) s -= 1; }
    return Math.max(-1, Math.min(1, s / 4));
  }
  function aggregateSentiment(items) {
    if (!items || !items.length) return 0;
    const xs = items.map((it) => (typeof it.sentiment === 'number' ? it.sentiment : scoreText(`${it.title} ${it.summary || ''}`)));
    return Number((xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(3));
  }
  function sentLabel(s) { return s > 0.25 ? { label: 'Bullish', tone: 'bull' } : s < -0.25 ? { label: 'Bearish', tone: 'bear' } : { label: 'Neutral', tone: 'flat' }; }

  // ---- AI model -----------------------------------------------
  function ema(vals, a = 0.4) { if (!vals.length) return 0; let e = vals[0]; for (let i = 1; i < vals.length; i++) e = a * vals[i] + (1 - a) * e; return e; }
  function predict(history, sentiment = 0) {
    const prices = (history || []).map((h) => h.price);
    if (prices.length < 4) return { direction: 'UP', confidence: 0.5, reason: 'Warming up — not enough data yet.' };
    const recent = prices.slice(-12);
    const last = recent[recent.length - 1], first = recent[0];
    const momentum = Math.max(-1, Math.min(1, ((last - first) / first) * 40));
    const avg = ema(recent);
    const reversion = Math.max(-1, Math.min(1, ((avg - last) / avg) * 60));
    const sent = Math.max(-1, Math.min(1, sentiment));
    const raw = 0.55 * momentum + 0.2 * reversion + 0.25 * sent;
    const direction = raw >= 0 ? 'UP' : 'DOWN';
    const confidence = Number((0.5 + Math.min(0.45, Math.abs(raw) * 0.6)).toFixed(2));
    const drivers = [
      { v: momentum, txt: momentum >= 0 ? 'upward momentum' : 'downward momentum' },
      { v: reversion, txt: reversion >= 0 ? 'room to rebound' : 'an overbought look' },
      { v: sent, txt: sent >= 0 ? 'positive news flow' : 'negative news flow' },
    ].sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
    return { direction, confidence, reason: `Driven by ${drivers[0].txt}, supported by ${drivers[1].txt}.` };
  }

  // ---- providers ----------------------------------------------
  function finnhubProvider(key) {
    const BASE = 'https://finnhub.io/api/v1/quote';
    async function one(sym) {
      const r = await fetch(`${BASE}?symbol=${encodeURIComponent(sym)}&token=${key}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const q = await r.json();
      if (!q || !q.c) throw new Error('empty');
      return { symbol: sym, price: q.c, prevClose: q.pc || q.c, open: q.o || q.c, high: q.h || q.c, low: q.l || q.c, ts: Date.now() };
    }
    return {
      name: 'finnhub',
      async fetchQuotes(syms) {
        const res = await Promise.allSettled(syms.map(one));
        const out = {}; res.forEach((x, i) => { if (x.status === 'fulfilled') out[syms[i]] = x.value; }); return out;
      },
    };
  }
  function simProvider(tickers) {
    const st = {};
    for (const t of tickers) st[t.symbol] = { price: t.seed, prevClose: t.seed, open: t.seed, high: t.seed, low: t.seed, vol: 0.0045 + Math.random() * 0.004, drift: 0.00005 };
    let sent = 0;
    const g = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    function step(s) {
      const shock = g() * s.vol, jump = Math.random() < 0.015 ? g() * s.vol * 6 : 0;
      s.price = Math.max(0.5, s.price * (1 + s.drift + sent * 0.0006 + shock + jump));
      s.high = Math.max(s.high, s.price); s.low = Math.min(s.low, s.price);
      return { price: +s.price.toFixed(2), prevClose: +s.prevClose.toFixed(2), open: +s.open.toFixed(2), high: +s.high.toFixed(2), low: +s.low.toFixed(2), ts: Date.now() };
    }
    return {
      name: 'sim',
      setSentiment(v) { sent = v; },
      async fetchQuotes(syms) { const out = {}; for (const s of syms) if (st[s]) out[s] = { symbol: s, ...step(st[s]) }; return out; },
    };
  }

  // ---- feed ---------------------------------------------------
  let provider, usedFallback = false;
  if (CONFIG.dataSource === 'finnhub' && CONFIG.finnhubKey) provider = finnhubProvider(CONFIG.finnhubKey);
  else { usedFallback = CONFIG.dataSource === 'finnhub'; provider = simProvider(TICKERS); }

  const history = Object.fromEntries(SYMBOLS.map((s) => [s, []]));
  const latest = {};
  let consecutiveFailures = 0;

  async function poll() {
    let quotes = {};
    try { quotes = await provider.fetchQuotes(SYMBOLS); } catch (e) { quotes = {}; }
    const got = Object.keys(quotes).length;
    if (!got && provider.name === 'finnhub') {
      // live source returned nothing (rate limit / CORS / market data gap) — fall back to sim
      if (++consecutiveFailures >= 2) { provider = simProvider(TICKERS); usedFallback = true; provider.setSentiment(state.sentiment); quotes = await provider.fetchQuotes(SYMBOLS); }
    } else { consecutiveFailures = 0; }
    for (const s of SYMBOLS) {
      const q = quotes[s]; if (!q) continue;
      const prev = latest[s];
      const change = q.price - q.prevClose;
      latest[s] = { ...q, change: +change.toFixed(2), changePct: q.prevClose ? +((change / q.prevClose) * 100).toFixed(2) : 0, tick: prev ? Math.sign(q.price - prev.price) : 0 };
      const arr = history[s]; arr.push({ t: q.ts, price: q.price }); if (arr.length > MAX_HISTORY) arr.shift();
    }
    state.lastUpdate = Date.now();
    renderAll();
  }

  // ---- game state ---------------------------------------------
  const emptyState = () => ({ player: { score: 0, wins: 0, losses: 0, streak: 0, bestStreak: 0 }, ai: { score: 0, wins: 0, losses: 0, streak: 0, bestStreak: 0 }, rounds: [] });
  function loadGame() { try { const r = localStorage.getItem(STORAGE_KEY); return r ? { ...emptyState(), ...JSON.parse(r) } : emptyState(); } catch { return emptyState(); } }
  function saveGame() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ player: state.player, ai: state.ai, rounds: state.rounds })); } catch {} }
  function accuracy(side) { const n = side.wins + side.losses; return n ? Math.round((side.wins / n) * 100) : 0; }
  function resolveRound({ direction, startPrice, endPrice, confidence = 0.6, isAI = false }) {
    const actual = endPrice >= startPrice ? 'UP' : 'DOWN';
    const correct = direction === actual;
    const movePct = startPrice ? Math.abs((endPrice - startPrice) / startPrice) * 100 : 0;
    let points = correct ? 10 + (isAI ? Math.round(confidence * 10) : Math.round(Math.min(10, movePct * 4))) : -4;
    return { actual, correct, movePct: +movePct.toFixed(2), points };
  }
  function applyResult(side, correct, points) {
    side.score += points;
    if (correct) { side.wins++; side.streak = Math.max(1, side.streak + 1); } else { side.losses++; side.streak = Math.min(-1, side.streak - 1); }
    side.bestStreak = Math.max(side.bestStreak, side.streak);
  }

  // ---- app state ----------------------------------------------
  const g = loadGame();
  const state = {
    selected: SYMBOLS[0],
    sentiment: 0,
    news: { date: null, items: [], loading: true },
    lastUpdate: 0,
    player: g.player, ai: g.ai, rounds: g.rounds,
    round: null, result: null, remaining: 0,
  };
  let roundTimer = null, tickTimer = null;

  function placeBet(sym, dir) {
    if (state.round) return;
    const q = latest[sym]; if (!q) return;
    const ai = predict(history[sym], state.sentiment);
    const startedAt = Date.now();
    state.round = { id: `${sym}-${startedAt}`, symbol: sym, playerDir: dir, ai, startPrice: q.price, endsAt: startedAt + HORIZON_MS };
    state.result = null; state.remaining = HORIZON_MS;
    roundTimer = setTimeout(resolve, HORIZON_MS);
    tickTimer = setInterval(() => { state.remaining = Math.max(0, state.round.endsAt - Date.now()); renderPred(); }, 250);
    renderPred();
  }
  function resolve() {
    const a = state.round; if (!a) return;
    clearInterval(tickTimer);
    const endPrice = (latest[a.symbol] || {}).price ?? a.startPrice;
    const pr = resolveRound({ direction: a.playerDir, startPrice: a.startPrice, endPrice, isAI: false });
    const ar = resolveRound({ direction: a.ai.direction, startPrice: a.startPrice, endPrice, confidence: a.ai.confidence, isAI: true });
    applyResult(state.player, pr.correct, pr.points);
    applyResult(state.ai, ar.correct, ar.points);
    state.rounds = [{ id: a.id, symbol: a.symbol, actual: pr.actual,
      player: { dir: a.playerDir, correct: pr.correct, points: pr.points },
      ai: { dir: a.ai.direction, correct: ar.correct, points: ar.points, confidence: a.ai.confidence } }, ...state.rounds].slice(0, 30);
    state.result = { symbol: a.symbol, actual: pr.actual, endPrice, movePct: pr.movePct,
      player: { ...pr, direction: a.playerDir },
      ai: { ...ar, direction: a.ai.direction, confidence: a.ai.confidence },
      winner: pr.points === ar.points ? 'tie' : (pr.points > ar.points ? 'player' : 'ai') };
    state.round = null; state.remaining = 0;
    saveGame(); renderPred(); renderScore();
  }
  function resetScores() { Object.assign(state, { player: emptyState().player, ai: emptyState().ai, rounds: [], result: null }); saveGame(); renderScore(); renderPred(); }

  // ---- rendering ----------------------------------------------
  const $ = (id) => document.getElementById(id);
  const fmtClock = (ts) => ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

  function sparkline(points, up) {
    if (!points || points.length < 2) return '';
    const v = points.map((p) => p.price), mn = Math.min(...v), mx = Math.max(...v), rg = mx - mn || 1, W = 84, H = 26;
    const d = v.map((p, i) => `${i ? 'L' : 'M'}${((i / (v.length - 1)) * W).toFixed(1)},${(H - ((p - mn) / rg) * H).toFixed(1)}`).join(' ');
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="${up ? 'var(--up)' : 'var(--down)'}" stroke-width="1.8"/></svg>`;
  }

  function renderWatchlist() {
    const host = $('watchlist');
    host.innerHTML = TICKERS.map((t) => {
      const q = latest[t.symbol], up = (q?.changePct ?? 0) >= 0;
      const flash = q?.tick > 0 ? 'flash-u' : q?.tick < 0 ? 'flash-d' : '';
      return `<button class="tk ${t.symbol === state.selected ? 'active' : ''}" data-sym="${t.symbol}">
        <div class="r1"><div><div class="sym">${t.symbol}</div><div class="sector">${t.sector}</div></div>${sparkline(history[t.symbol], up)}</div>
        <div class="r2"><span class="px ${flash}">${q ? '$' + q.price.toFixed(2) : '—'}</span><span class="pct ${up ? 'up' : 'down'}">${q ? (up ? '▲' : '▼') + ' ' + Math.abs(q.changePct).toFixed(2) + '%' : ''}</span></div>
      </button>`;
    }).join('');
    host.querySelectorAll('.tk').forEach((b) => b.addEventListener('click', () => { state.selected = b.dataset.sym; renderWatchlist(); renderChart(); renderPred(); }));
  }

  function renderChart() {
    const sym = state.selected, meta = BY_SYM[sym], q = latest[sym], hist = history[sym] || [];
    const up = (q?.changePct ?? 0) >= 0;
    $('cSym').textContent = sym; $('cName').textContent = meta?.name || '';
    $('cBig').innerHTML = q ? `$${q.price.toFixed(2)} <span class="ch ${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${Math.abs(q.change).toFixed(2)} (${Math.abs(q.changePct).toFixed(2)}%)</span>` : '—';
    $('cOhlc').innerHTML = q ? `<span>O<b>${q.open.toFixed(2)}</b></span><span>H<b>${q.high.toFixed(2)}</b></span><span>L<b>${q.low.toFixed(2)}</b></span><span>PC<b>${q.prevClose.toFixed(2)}</b></span>` : '';
    const svg = $('cChart'), loading = $('cLoading');
    if (hist.length < 2) { svg.innerHTML = ''; loading.style.display = 'grid'; return; }
    loading.style.display = 'none';
    const W = 600, H = 230, v = hist.map((h) => h.price), mn = Math.min(...v), mx = Math.max(...v), pad = (mx - mn) * 0.15 || 1;
    const lo = mn - pad, hi = mx + pad, rg = hi - lo;
    const pts = v.map((p, i) => [(i / (v.length - 1)) * W, H - ((p - lo) / rg) * H]);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const area = `${line} L${W},${H} L0,${H} Z`;
    const c = up ? 'var(--up)' : 'var(--down)';
    svg.innerHTML = `<defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${c}" stop-opacity="0.3"/><stop offset="100%" stop-color="${c}" stop-opacity="0"/></linearGradient></defs><path d="${area}" fill="url(#ag)"/><path d="${line}" fill="none" stroke="${c}" stroke-width="2"/>`;
  }

  function callBox(who, dir, conf, resolved, correct) {
    const cls = resolved ? (correct ? 'win' : 'lose') : (dir === 'UP' ? 'u' : 'd');
    return `<div class="call ${cls}"><span class="who">${who}</span><span class="dir">${dir === 'UP' ? '▲ UP' : '▼ DOWN'}</span>${conf != null ? `<span class="cf">${Math.round(conf * 100)}% conf</span>` : ''}${resolved ? `<span class="mk">${correct ? '✓' : '✗'}</span>` : ''}</div>`;
  }

  function renderPred() {
    $('pSym').textContent = state.selected;
    const host = $('predBody'); const sym = state.selected; const q = latest[sym]; const r = state.round; const res = state.result;
    if (r) {
      const live = q ? q.price : r.startPrice; const pct = Math.max(0, Math.min(100, (state.remaining / HORIZON_MS) * 100));
      host.innerHTML = `<div class="live-wrap">
        <div class="cd"><div class="bar"><div class="fill" style="width:${pct}%"></div></div><span class="s">${Math.ceil(state.remaining / 1000)}s</span></div>
        <div class="calls">${callBox('You', r.playerDir)}<span class="vs">VS</span>${callBox('AI model', r.ai.direction, r.ai.confidence)}</div>
        <p class="reason">🤖 ${r.ai.reason}</p>
        <div class="pxs"><span>Entry <b>$${r.startPrice.toFixed(2)}</b></span><span>Now <b class="${live >= r.startPrice ? 'up' : 'down'}">$${live.toFixed(2)}</b></span></div>
      </div>`;
    } else if (res) {
      host.innerHTML = `<div class="live-wrap">
        <div class="banner ${res.winner}">${res.winner === 'player' ? '🏆 You beat the model' : res.winner === 'ai' ? '🤖 The model won' : '🤝 Dead heat'}</div>
        <div class="detail">${res.symbol} went <b class="${res.actual === 'UP' ? 'up' : 'down'}">${res.actual}</b> to $${res.endPrice.toFixed(2)} (${res.movePct}%)</div>
        <div class="calls">${callBox('You', res.player.direction, null, true, res.player.correct)}<span class="vs">VS</span>${callBox('AI model', res.ai.direction, res.ai.confidence, true, res.ai.correct)}</div>
        <div class="points"><span class="${res.player.points >= 0 ? 'up' : 'down'}">You ${res.player.points >= 0 ? '+' : ''}${res.player.points}</span><span class="${res.ai.points >= 0 ? 'up' : 'down'}">AI ${res.ai.points >= 0 ? '+' : ''}${res.ai.points}</span></div>
        <div class="again"><span class="lbl">Go again</span><button class="bet up" data-dir="UP">▲ UP</button><button class="bet down" data-dir="DOWN">▼ DOWN</button></div>
      </div>`;
      host.querySelectorAll('.bet').forEach((b) => b.addEventListener('click', () => placeBet(sym, b.dataset.dir)));
    } else if (q) {
      host.innerHTML = `<div class="betrow"><button class="bet up" data-dir="UP">▲ It goes UP</button><button class="bet down" data-dir="DOWN">▼ It goes DOWN</button></div>`;
      host.querySelectorAll('.bet').forEach((b) => b.addEventListener('click', () => placeBet(sym, b.dataset.dir)));
    } else {
      host.innerHTML = `<div class="live-wrap"><p class="empty">Waiting for a live price on ${sym}…</p></div>`;
    }
  }

  function side(el, s, lead) {
    el.classList.toggle('lead', lead);
    el.querySelector('.n').textContent = s.score;
    const streak = s.streak !== 0 ? `<span class="${s.streak > 0 ? 'up' : 'down'}">${s.streak > 0 ? '🔥 ' + s.streak : '❄ ' + Math.abs(s.streak)}</span>` : '';
    el.querySelector('.st').innerHTML = `<span>${accuracy(s)}% acc</span><span>·</span><span>${s.wins}-${s.losses}</span>${streak}`;
  }
  function renderScore() {
    side($('scPlayer'), state.player, state.player.score > state.ai.score);
    side($('scAI'), state.ai, state.ai.score > state.player.score);
    const host = $('rounds');
    if (!state.rounds.length) { host.innerHTML = '<div class="empty">No rounds yet — make your first call.</div>'; return; }
    host.innerHTML = state.rounds.map((r) => `<div class="rd"><span style="font-weight:700">${r.symbol}</span><span class="${r.actual === 'UP' ? 'up' : 'down'}">${r.actual === 'UP' ? '▲' : '▼'}</span><span class="ch ${r.player.correct ? 'ok' : 'bad'}">You ${r.player.correct ? '✓' : '✗'}</span><span class="ch ${r.ai.correct ? 'ok' : 'bad'}">AI ${r.ai.correct ? '✓' : '✗'}</span></div>`).join('');
  }

  function renderStatus() {
    const st = marketStatus();
    const sc = $('statusChip'); sc.className = `chip ${st.state}`; $('statusTxt').textContent = st.label;
    $('srcTxt').textContent = provider.name === 'finnhub' ? 'LIVE · FINNHUB' : (usedFallback ? 'SIM (NO LIVE)' : 'SIM ENGINE');
    const sl = sentLabel(state.sentiment); $('sentChip').className = `chip ${sl.tone}`; $('sentTxt').textContent = sl.label;
    $('clkTxt').textContent = fmtClock(state.lastUpdate);
  }

  function renderCountdown() {
    const { wd, sec } = nyNow();
    const open = wd >= 1 && wd <= 5 && sec >= OPEN_S && sec < CLOSE_S;
    const secs = open ? CLOSE_S - sec : secsToNextOpen(wd, sec);
    $('openCd').classList.toggle('open', open);
    $('cdLabel').textContent = open ? 'US MARKET CLOSES IN' : 'US MARKET OPENS IN';
    $('cdClock').textContent = fmtDur(secs);
  }

  function renderNews() {
    const host = $('newsList'); const n = state.news;
    $('newsDate').textContent = n.date ? '· ' + n.date : '';
    if (n.loading) { host.innerHTML = '<div class="empty">Loading digest…</div>'; return; }
    if (!n.items.length) { host.innerHTML = '<div class="empty">No digest yet. The scheduled task writes <code>arena-news.json</code> each morning.</div>'; return; }
    const icon = { financial: '💰', industrial: '🏭', political: '🏛️', tech: '⚙️' };
    host.innerHTML = n.items.map((it) => {
      const sl = sentLabel(typeof it.sentiment === 'number' ? it.sentiment : scoreText(`${it.title} ${it.summary || ''}`));
      return `<a href="${it.url || '#'}" target="_blank" rel="noreferrer noopener">
        <div class="t1"><span class="cat">${icon[it.category] || '📰'} ${it.category || ''}</span><span class="sent ${sl.tone}">${sl.label}</span></div>
        <div class="ti">${it.title || ''}</div>${it.summary ? `<div class="su">${it.summary}</div>` : ''}${it.source ? `<div class="so">${it.source}</div>` : ''}
      </a>`;
    }).join('');
  }

  const EMBED = (() => { try { return new URLSearchParams(location.search).has('embed'); } catch { return false; } })();
  function postHeight() { if (!EMBED) return; try { parent.postMessage({ type: 'afflatus-arena-height', height: document.documentElement.scrollHeight }, '*'); } catch {} }
  function renderAll() { renderStatus(); renderWatchlist(); renderChart(); renderPred(); renderScore(); postHeight(); }

  // ---- news load ----------------------------------------------
  fetch(CONFIG.newsUrl, { cache: 'no-store' })
    .then((r) => r.ok ? r.json() : Promise.reject())
    .then((data) => {
      const items = (data.items || []).map((it) => ({ ...it, sentiment: typeof it.sentiment === 'number' ? it.sentiment : scoreText(`${it.title} ${it.summary || ''}`) }));
      state.news = { date: data.date || null, items, loading: false };
      state.sentiment = aggregateSentiment(items);
      provider.setSentiment && provider.setSentiment(state.sentiment);
    })
    .catch(() => { state.news = { date: null, items: [], loading: false }; })
    .finally(() => { renderNews(); renderStatus(); });

  // ---- wire + boot --------------------------------------------
  $('refreshBtn').addEventListener('click', poll);
  $('resetBtn').addEventListener('click', resetScores);
  if (EMBED) { document.body.classList.add('embed'); window.addEventListener('resize', postHeight); setInterval(postHeight, 1200); }
  renderAll(); renderNews(); renderCountdown();
  poll();
  setInterval(poll, CONFIG.pollMs);
  setInterval(renderStatus, 15000);
  setInterval(renderCountdown, 1000);
  setTimeout(postHeight, 300); setTimeout(postHeight, 1500);
})();
