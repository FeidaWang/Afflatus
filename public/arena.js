/* ============================================================
   AI STOCK ARENA · TRAXUS//CVKM build  — vanilla JS, no deps
   Pre-open direction game on the US AI complex. You vs. an
   explainable model. Real-time quotes via Finnhub (with a simulator
   fill for any symbol the feed can't supply that poll), a daily
   pre-market briefing, and a trading-desk chart with D/W/M/6M/Y/5Y.
   For entertainment only — NOT investment advice.
   ============================================================ */
(() => {
  'use strict';

  const CONFIG = {
    finnhubKey: 'd8nvs5pr01qvtr6lft30d8nvs5pr01qvtr6lft3g', // free tier; visible client-side
    dataSource: 'finnhub',
    pollMs: 13000,           // 12 symbols / 13s ≈ 55 calls/min (under the 60/min free cap)
    newsUrl: '/arena-news.json',
  };

  // Real US-listed symbols (Finnhub /quote covers all of these, incl. the new
  // SpaceX listing SPCX, the Franklin FTSE Korea ETF FLKR, and ASML).
  const TICKERS = [
    { symbol: 'NVDA', name: 'NVIDIA',          sector: 'AI Compute',  seed: 205.0 },
    { symbol: 'SPCX', name: 'SpaceX',          sector: 'Space',       seed: 192.5 },
    { symbol: 'ASML', name: 'ASML Holding',    sector: 'Litho',       seed: 1892.66 },
    { symbol: 'MU',   name: 'Micron',          sector: 'AI Memory',   seed: 132.0 },
    { symbol: 'SNDK', name: 'SanDisk',         sector: 'Storage',     seed: 48.0 },
    { symbol: 'FLKR', name: 'Franklin Korea',  sector: 'Korea ETF',   seed: 68.03 },
    { symbol: 'LITE', name: 'Lumentum',        sector: 'Optical',     seed: 95.0 },
    { symbol: 'NOK',  name: 'Nokia',           sector: 'Networking',  seed: 5.4 },
    { symbol: 'MRVL', name: 'Marvell',         sector: 'AI Network',  seed: 78.0 },
    { symbol: 'INTC', name: 'Intel',           sector: 'AI Chips',    seed: 32.0 },
    { symbol: 'ARM',  name: 'Arm Holdings',    sector: 'Chip IP',     seed: 138.0 },
    { symbol: 'AMD',  name: 'AMD',             sector: 'AI Chips',    seed: 178.0 },
  ];
  const SYMBOLS = TICKERS.map((t) => t.symbol);
  const BY_SYM = Object.fromEntries(TICKERS.map((t) => [t.symbol, t]));
  const HORIZON_MS = 60000;
  const STORAGE_KEY = 'afflatus-arena:v2';
  const BRIEF_KEY = 'afflatus-arena:briefing';
  const TF_KEY = 'afflatus-arena:tf';
  const MAX_HISTORY = 240;
  const SEED_LEN = 64;
  const TF_LIST = ['D', 'W', 'M', '6M', 'Y', '5Y'];
  const TF_META = {
    D:  { n: 64, vol: 0.006, label: 'INTRADAY' },
    W:  { n: 34, vol: 0.020, label: '5 DAYS' },
    M:  { n: 22, vol: 0.030, label: '1 MONTH' },
    '6M':{ n: 26, vol: 0.050, label: '6 MONTHS' },
    Y:  { n: 52, vol: 0.060, label: '1 YEAR' },
    '5Y':{ n: 60, vol: 0.100, label: '5 YEARS' },
  };

  const reduceMotion = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();

  // ---- market hours -------------------------------------------
  function nyNow(date = new Date()) {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
    const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday];
    return { wd, sec: (Number(p.hour) % 24) * 3600 + Number(p.minute) * 60 + Number(p.second) };
  }
  const OPEN_S = 9 * 3600 + 30 * 60, CLOSE_S = 16 * 3600;
  function marketStatus() {
    const { wd, sec } = nyNow(), wk = wd >= 1 && wd <= 5;
    if (wk && sec >= OPEN_S && sec < CLOSE_S) return { state: 'open', label: 'Market Open' };
    if (wk && sec >= 4 * 3600 && sec < OPEN_S) return { state: 'pre', label: 'Pre-Market' };
    if (wk && sec >= CLOSE_S && sec < 20 * 3600) return { state: 'post', label: 'After Hours' };
    return { state: 'closed', label: 'Market Closed' };
  }
  function secsToNextOpen(wd, sec) {
    const wk = (d) => d >= 1 && d <= 5;
    if (wk(wd) && sec < OPEN_S) return OPEN_S - sec;
    let s = 86400 - sec, d = (wd + 1) % 7;
    for (let i = 0; i < 8; i++) { if (wk(d)) return s + OPEN_S; s += 86400; d = (d + 1) % 7; }
    return s + OPEN_S;
  }
  function fmtDur(t) { let s = Math.max(0, Math.floor(t)); const d = Math.floor(s / 86400); s -= d * 86400; const h = Math.floor(s / 3600); s -= h * 3600; const m = Math.floor(s / 60); s -= m * 60; const p = (n) => String(n).padStart(2, '0'); return (d > 0 ? d + 'd ' : '') + p(h) + ':' + p(m) + ':' + p(s); }

  // ---- sentiment ----------------------------------------------
  const POS = ['rally','surge','soar','gain','beat','record','jump','rise','rises','up','growth','strong','bullish','upgrade','breakthrough','demand','boom','expansion','outperform','climb','optimism','deal','agreement','peace'];
  const NEG = ['plunge','tumble','sink','fall','falls','drop','miss','weak','bearish','downgrade','selloff','sell-off','slump','fear','tariff','ban','restriction','probe','lawsuit','cut','hike','recession','crash','warning','jitters','squeezed','volatility'];
  const tk = (s) => (s || '').toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/\s+/).filter(Boolean);
  function scoreText(t) { const a = tk(t); if (!a.length) return 0; let s = 0; for (const w of a) { if (POS.includes(w)) s++; if (NEG.includes(w)) s--; } return Math.max(-1, Math.min(1, s / 4)); }
  function aggregateSentiment(items) { if (!items || !items.length) return 0; const xs = items.map((it) => typeof it.sentiment === 'number' ? it.sentiment : scoreText(`${it.title} ${it.summary || ''}`)); return Number((xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(3)); }
  function sentLabel(s) { return s > 0.25 ? { label: 'Bullish', tone: 'bull' } : s < -0.25 ? { label: 'Bearish', tone: 'bear' } : { label: 'Neutral', tone: 'flat' }; }

  // ---- AI model -----------------------------------------------
  function ema(v, a = 0.4) { if (!v.length) return 0; let e = v[0]; for (let i = 1; i < v.length; i++) e = a * v[i] + (1 - a) * e; return e; }
  function predict(history, sentiment = 0) {
    const p = (history || []).map((h) => h.price);
    if (p.length < 4) return { direction: 'UP', confidence: 0.5, reason: 'Warming up — not enough data yet.' };
    const r = p.slice(-12), last = r[r.length - 1], first = r[0];
    const momentum = Math.max(-1, Math.min(1, ((last - first) / first) * 40));
    const reversion = Math.max(-1, Math.min(1, ((ema(r) - last) / ema(r)) * 60));
    const sent = Math.max(-1, Math.min(1, sentiment));
    const raw = 0.55 * momentum + 0.2 * reversion + 0.25 * sent;
    const drivers = [{ v: momentum, txt: momentum >= 0 ? 'upward momentum' : 'downward momentum' }, { v: reversion, txt: reversion >= 0 ? 'room to rebound' : 'an overbought look' }, { v: sent, txt: sent >= 0 ? 'positive news flow' : 'negative news flow' }].sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
    return { direction: raw >= 0 ? 'UP' : 'DOWN', confidence: Number((0.5 + Math.min(0.45, Math.abs(raw) * 0.6)).toFixed(2)), reason: `Driven by ${drivers[0].txt}, supported by ${drivers[1].txt}.` };
  }

  // ---- seeded series ------------------------------------------
  function strHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // Generate a stable seeded price path of n points that ENDS exactly at `anchor`.
  function genSeries(seedStr, n, vol, anchor, stepMs) {
    const rnd = mulberry32(strHash(seedStr));
    let p = anchor * (0.72 + rnd() * 0.3);
    const drift = (rnd() - 0.45) * vol * 0.3, raw = [], now = Date.now();
    for (let i = 0; i < n; i++) { p = Math.max(0.1, p * (1 + drift + (rnd() - 0.5) * vol)); raw.push(p); }
    const ratio = anchor / raw[raw.length - 1];
    return raw.map((x, i) => ({ t: now - (n - i) * stepMs, price: Number((x * ratio).toFixed(2)) }));
  }

  // ---- state --------------------------------------------------
  // history[sym] = the live intraday (D) series; modeled[sym][tf] = cached longer ranges.
  const history = Object.fromEntries(TICKERS.map((t) => [t.symbol, genSeries('D' + t.symbol, SEED_LEN, TF_META.D.vol, t.seed, 60000)]));
  const modeled = {};
  const rebased = new Set();
  function modeledSeries(sym, tf) {
    const anchor = (latest[sym] && latest[sym].prevClose) || BY_SYM[sym].seed;
    const key = `${tf}|${Math.round(anchor * 100)}`;
    modeled[sym] = modeled[sym] || {};
    if (modeled[sym][key]) return modeled[sym][key];
    const m = TF_META[tf];
    const series = genSeries(tf + sym, m.n, m.vol, anchor, 86400000);
    modeled[sym] = { [key]: series }; // keep one cached range/anchor per symbol
    return series;
  }

  const latest = {};
  for (const t of TICKERS) { const h = history[t.symbol]; const last = h[h.length - 1].price, prev = h[0].price; latest[t.symbol] = { symbol: t.symbol, price: last, prevClose: prev, open: prev, high: Math.max(...h.map((x) => x.price)), low: Math.min(...h.map((x) => x.price)), change: +(last - prev).toFixed(2), changePct: +(((last - prev) / prev) * 100).toFixed(2), tick: 0, live: false }; }

  const emptySide = () => ({ score: 0, wins: 0, losses: 0, streak: 0, bestStreak: 0 });
  function loadGame() { try { const s = JSON.parse(localStorage.getItem(STORAGE_KEY)); return s ? { player: { ...emptySide(), ...s.player }, ai: { ...emptySide(), ...s.ai }, rounds: s.rounds || [] } : { player: emptySide(), ai: emptySide(), rounds: [] }; } catch { return { player: emptySide(), ai: emptySide(), rounds: [] }; } }
  const g0 = loadGame();
  let tf0 = 'D'; try { const t = localStorage.getItem(TF_KEY); if (t && TF_LIST.includes(t)) tf0 = t; } catch {}
  const state = { selected: SYMBOLS[0], timeframe: tf0, sentiment: 0, news: { date: null, items: [], loading: true }, lastUpdate: 0, liveCount: 0, player: g0.player, ai: g0.ai, rounds: g0.rounds, round: null, result: null, remaining: 0 };
  function saveGame() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ player: state.player, ai: state.ai, rounds: state.rounds })); } catch {} }
  function accuracy(s) { const n = s.wins + s.losses; return n ? Math.round((s.wins / n) * 100) : 0; }

  // ---- providers ----------------------------------------------
  function finnhubProvider(key) {
    const BASE = 'https://finnhub.io/api/v1/quote';
    async function one(sym) { const r = await fetch(`${BASE}?symbol=${encodeURIComponent(sym)}&token=${key}`); if (!r.ok) throw 0; const q = await r.json(); if (!q || !q.c) throw 0; return { symbol: sym, price: q.c, prevClose: q.pc || q.c, open: q.o || q.c, high: q.h || q.c, low: q.l || q.c, live: true }; }
    return { async fetchQuotes(syms) { const res = await Promise.allSettled(syms.map(one)); const out = {}; res.forEach((x, i) => { if (x.status === 'fulfilled') out[syms[i]] = x.value; }); return out; } };
  }
  function simProvider(tickers) {
    const st = {};
    for (const t of tickers) { const last = (history[t.symbol] || []).slice(-1)[0]; const base = last ? last.price : t.seed; st[t.symbol] = { price: base, prevClose: base, open: base, high: base, low: base, vol: 0.0045 + Math.random() * 0.004, drift: 0.00004 }; }
    let sent = 0;
    const g = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    function step(s) { const j = Math.random() < 0.015 ? g() * s.vol * 6 : 0; s.price = Math.max(0.1, s.price * (1 + s.drift + sent * 0.0006 + g() * s.vol + j)); s.high = Math.max(s.high, s.price); s.low = Math.min(s.low, s.price); return { price: +s.price.toFixed(2), prevClose: +s.prevClose.toFixed(2), open: +s.open.toFixed(2), high: +s.high.toFixed(2), low: +s.low.toFixed(2), live: false }; }
    return { setSentiment(v) { sent = v; }, async fetchQuotes(syms) { const out = {}; for (const s of syms) if (st[s]) out[s] = { symbol: s, ...step(st[s]) }; return out; } };
  }
  const liveProvider = (CONFIG.dataSource === 'finnhub' && CONFIG.finnhubKey) ? finnhubProvider(CONFIG.finnhubKey) : null;
  const sim = simProvider(TICKERS);

  let polling = false;
  async function poll() {
    if (polling) return; polling = true;
    try {
      let live = {};
      if (liveProvider) { try { live = await liveProvider.fetchQuotes(SYMBOLS); } catch {} }
      const simq = await sim.fetchQuotes(SYMBOLS);
      let liveCount = 0;
      for (const s of SYMBOLS) {
        const q = live[s] || simq[s]; if (!q) continue;
        if (q.live) liveCount++;
        // On the first real quote, rebase the intraday lead-in to the real prev close
        // so the live tape connects cleanly to history.
        if (q.live && !rebased.has(s)) { history[s] = genSeries('D' + s, SEED_LEN, TF_META.D.vol, q.prevClose, 60000); rebased.add(s); }
        const prev = latest[s], change = q.price - q.prevClose;
        latest[s] = { ...q, symbol: s, change: +change.toFixed(2), changePct: q.prevClose ? +((change / q.prevClose) * 100).toFixed(2) : 0, tick: prev ? Math.sign(q.price - prev.price) : 0 };
        const arr = history[s]; arr.push({ t: Date.now(), price: q.price }); if (arr.length > MAX_HISTORY) arr.shift();
      }
      state.liveCount = liveCount; state.lastUpdate = Date.now(); renderAll();
    } finally { polling = false; }
  }

  // ---- game ---------------------------------------------------
  let roundTimer = null, tickTimer = null;
  function resolveRound({ direction, startPrice, endPrice, confidence = 0.6, isAI = false }) {
    const actual = endPrice >= startPrice ? 'UP' : 'DOWN', correct = direction === actual, movePct = startPrice ? Math.abs((endPrice - startPrice) / startPrice) * 100 : 0;
    return { actual, correct, movePct: +movePct.toFixed(2), points: correct ? 10 + (isAI ? Math.round(confidence * 10) : Math.round(Math.min(10, movePct * 4))) : -4 };
  }
  function applyResult(side, correct, points) { side.score += points; if (correct) { side.wins++; side.streak = Math.max(1, side.streak + 1); } else { side.losses++; side.streak = Math.min(-1, side.streak - 1); } side.bestStreak = Math.max(side.bestStreak, side.streak); }
  function placeBet(sym, dir) {
    if (state.round) return; const q = latest[sym]; if (!q) return;
    const ai = predict(history[sym], state.sentiment), started = Date.now();
    state.round = { id: `${sym}-${started}`, symbol: sym, playerDir: dir, ai, startPrice: q.price, endsAt: started + HORIZON_MS };
    state.result = null; state.remaining = HORIZON_MS;
    roundTimer = setTimeout(resolve, HORIZON_MS);
    tickTimer = setInterval(() => { state.remaining = Math.max(0, state.round.endsAt - Date.now()); renderPred(); }, 250);
    renderPred();
  }
  function resolve() {
    const a = state.round; if (!a) return; clearInterval(tickTimer);
    const endPrice = (latest[a.symbol] || {}).price ?? a.startPrice;
    const pr = resolveRound({ direction: a.playerDir, startPrice: a.startPrice, endPrice, isAI: false });
    const ar = resolveRound({ direction: a.ai.direction, startPrice: a.startPrice, endPrice, confidence: a.ai.confidence, isAI: true });
    applyResult(state.player, pr.correct, pr.points); applyResult(state.ai, ar.correct, ar.points);
    state.rounds = [{ id: a.id, symbol: a.symbol, actual: pr.actual, player: { dir: a.playerDir, correct: pr.correct, points: pr.points }, ai: { dir: a.ai.direction, correct: ar.correct, points: ar.points } }, ...state.rounds].slice(0, 30);
    state.result = { symbol: a.symbol, actual: pr.actual, endPrice, movePct: pr.movePct, player: { ...pr, direction: a.playerDir }, ai: { ...ar, direction: a.ai.direction, confidence: a.ai.confidence }, winner: pr.points === ar.points ? 'tie' : (pr.points > ar.points ? 'player' : 'ai') };
    state.round = null; state.remaining = 0; saveGame(); renderPred(); renderScore();
  }
  function resetScores() { state.player = emptySide(); state.ai = emptySide(); state.rounds = []; state.result = null; saveGame(); renderScore(); renderPred(); }

  // ---- rendering ----------------------------------------------
  const $ = (id) => document.getElementById(id);
  const fmtClock = (ts) => ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
  const EMBED = (() => { try { return new URLSearchParams(location.search).has('embed'); } catch { return false; } })();
  function postHeight() { if (!EMBED) return; try { parent.postMessage({ type: 'afflatus-arena-height', height: document.documentElement.scrollHeight }, '*'); } catch {} }

  function spark(points, up) {
    if (!points || points.length < 2) return '';
    const v = points.slice(-40).map((p) => p.price), mn = Math.min(...v), mx = Math.max(...v), rg = mx - mn || 1, W = 84, H = 26;
    const d = v.map((p, i) => `${i ? 'L' : 'M'}${((i / (v.length - 1)) * W).toFixed(1)},${(H - ((p - mn) / rg) * H).toFixed(1)}`).join(' ');
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="${up ? 'var(--up)' : 'var(--down)'}" stroke-width="1.8"/></svg>`;
  }
  function renderWatchlist() {
    const host = $('watchlist');
    host.innerHTML = TICKERS.map((t) => {
      const q = latest[t.symbol], up = (q?.changePct ?? 0) >= 0, flash = q?.tick > 0 ? 'flash-u' : q?.tick < 0 ? 'flash-d' : '';
      const tag = q?.live ? '<span class="tk-live">LIVE</span>' : '<span class="tk-sim">SIM</span>';
      return `<button class="tk ${t.symbol === state.selected ? 'tk--active' : ''}" data-sym="${t.symbol}" role="option" aria-selected="${t.symbol === state.selected}" aria-label="${t.name}, ${q ? '$' + q.price.toFixed(2) + ', ' + (up ? 'up ' : 'down ') + Math.abs(q.changePct).toFixed(2) + ' percent' : 'no quote'}">
        <span class="tk-bracket" aria-hidden="true"></span>
        <div class="r1"><div><div class="sym">${t.symbol}${tag}</div><div class="sector">${t.sector}</div></div>${spark(history[t.symbol], up)}</div>
        <div class="r2"><span class="px ${flash}">${q ? '$' + q.price.toFixed(2) : '—'}</span><span class="pct ${up ? 'up' : 'down'}">${q ? (up ? '▲' : '▼') + ' ' + Math.abs(q.changePct).toFixed(2) + '%' : ''}</span></div>
      </button>`;
    }).join('');
    host.querySelectorAll('.tk').forEach((b) => b.addEventListener('click', () => { state.selected = b.dataset.sym; renderWatchlist(); renderChart(); renderPred(); }));
  }

  function renderTF() {
    const row = $('tfRow'); if (!row) return;
    row.querySelectorAll('.tf-b').forEach((b) => { const on = b.dataset.tf === state.timeframe; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  }
  function renderChart() {
    const sym = state.selected, meta = BY_SYM[sym], q = latest[sym], tf = state.timeframe;
    const isD = tf === 'D';
    const series = isD ? (history[sym] || []) : modeledSeries(sym, tf);
    const up = (q?.changePct ?? 0) >= 0;
    $('cSym').textContent = sym;
    $('cName').textContent = meta?.name || '';
    $('cBig').innerHTML = q ? `$${q.price.toFixed(2)} <span class="ch ${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${Math.abs(q.change).toFixed(2)} (${Math.abs(q.changePct).toFixed(2)}%)</span>` : '—';
    $('cOhlc').innerHTML = q ? `<span>O<b>${q.open.toFixed(2)}</b></span><span>H<b>${q.high.toFixed(2)}</b></span><span>L<b>${q.low.toFixed(2)}</b></span><span>PC<b>${q.prevClose.toFixed(2)}</b></span>` : '';
    const stt = marketStatus();
    const badge = isD ? (stt.state === 'open' ? 'INTRADAY · LIVE' : 'PRE-MARKET TAPE') : `MODELED · ${TF_META[tf].label}`;
    $('cBadge').textContent = badge; $('cBadge').className = 'chart-badge ' + (isD && stt.state === 'open' ? 'is-live' : (isD ? '' : 'is-modeled'));

    const svg = $('cChart'), loading = $('cLoading');
    if (series.length < 2) { svg.innerHTML = ''; loading.style.display = 'grid'; return; }
    loading.style.display = 'none';
    const W = 600, H = 230, padR = 56, plotW = W - padR;
    const v = series.map((h) => h.price);
    const pc = isD && q ? q.prevClose : null;
    const lo = Math.min(...v, ...(pc != null ? [pc] : [])), hi = Math.max(...v, ...(pc != null ? [pc] : []));
    const pad = (hi - lo) * 0.12 || 1, LO = lo - pad, HI = hi + pad, RG = HI - LO || 1;
    const X = (i) => (i / (v.length - 1)) * plotW, Y = (p) => H - ((p - LO) / RG) * H;
    let grid = '';
    for (let i = 0; i <= 4; i++) { const yy = (i / 4) * H, price = HI - (i / 4) * RG; grid += `<line x1="0" y1="${yy.toFixed(1)}" x2="${plotW}" y2="${yy.toFixed(1)}" class="cgrid"/><text x="${W - 4}" y="${(yy + 3.5).toFixed(1)}" class="caxis" text-anchor="end">${price.toFixed(2)}</text>`; }
    for (let i = 1; i < 6; i++) { const xx = (i / 6) * plotW; grid += `<line x1="${xx.toFixed(1)}" y1="0" x2="${xx.toFixed(1)}" y2="${H}" class="cgrid cgrid--v"/>`; }
    if (pc != null) { const pcy = Y(pc); grid += `<line x1="0" y1="${pcy.toFixed(1)}" x2="${plotW}" y2="${pcy.toFixed(1)}" class="cpc"/><text x="2" y="${(pcy - 4).toFixed(1)}" class="cpc-t">PREV ${pc.toFixed(2)}</text>`; }
    const line = v.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p).toFixed(1)}`).join(' ');
    const area = `${line} L${plotW.toFixed(1)},${H} L0,${H} Z`;
    const c = up ? 'var(--up)' : 'var(--down)';
    const lx = X(v.length - 1), ly = Y(v[v.length - 1]);
    svg.innerHTML = `<defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${c}" stop-opacity="0.28"/><stop offset="100%" stop-color="${c}" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${area}" fill="url(#ag)"/><path d="${line}" class="cline" fill="none" stroke="${c}"/><line x1="${lx.toFixed(1)}" y1="0" x2="${lx.toFixed(1)}" y2="${H}" class="cnow"/><circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="3.6" fill="${c}" class="cdot"/><rect x="${(lx + 4).toFixed(1)}" y="${(ly - 9).toFixed(1)}" width="50" height="16" class="ctagbg"/><text x="${(lx + 8).toFixed(1)}" y="${(ly + 3).toFixed(1)}" class="ctag" fill="${c}">${v[v.length - 1].toFixed(2)}</text>`;
  }

  function callBox(who, dir, conf, resolved, correct) { const cls = resolved ? (correct ? 'win' : 'lose') : (dir === 'UP' ? 'u' : 'd'); return `<div class="call ${cls}"><span class="who">${who}</span><span class="dir">${dir === 'UP' ? '▲ UP' : '▼ DOWN'}</span>${conf != null ? `<span class="cf">${Math.round(conf * 100)}% conf</span>` : ''}${resolved ? `<span class="mk">${correct ? '✓' : '✗'}</span>` : ''}</div>`; }
  function renderPred() {
    $('pSym').textContent = state.selected;
    const host = $('predBody'), sym = state.selected, q = latest[sym], r = state.round, res = state.result;
    if (r) {
      const live = q ? q.price : r.startPrice, pct = Math.max(0, Math.min(100, (state.remaining / HORIZON_MS) * 100));
      host.innerHTML = `<div class="live-wrap"><div class="cd"><div class="bar"><div class="fill" style="width:${pct}%"></div></div><span class="s">${Math.ceil(state.remaining / 1000)}s</span></div><div class="calls">${callBox('You', r.playerDir)}<span class="vs">VS</span>${callBox('AI model', r.ai.direction, r.ai.confidence)}</div><p class="reason">🤖 ${r.ai.reason}</p><div class="pxs"><span>Entry <b>$${r.startPrice.toFixed(2)}</b></span><span>Now <b class="${live >= r.startPrice ? 'up' : 'down'}">$${live.toFixed(2)}</b></span></div></div>`;
    } else if (res) {
      host.innerHTML = `<div class="live-wrap"><div class="banner ${res.winner}">${res.winner === 'player' ? '🏆 You beat the model' : res.winner === 'ai' ? '🤖 The model won' : '🤝 Dead heat'}</div><div class="detail">${res.symbol} went <b class="${res.actual === 'UP' ? 'up' : 'down'}">${res.actual}</b> to $${res.endPrice.toFixed(2)} (${res.movePct}%)</div><div class="calls">${callBox('You', res.player.direction, null, true, res.player.correct)}<span class="vs">VS</span>${callBox('AI model', res.ai.direction, res.ai.confidence, true, res.ai.correct)}</div><div class="points"><span class="${res.player.points >= 0 ? 'up' : 'down'}">You ${res.player.points >= 0 ? '+' : ''}${res.player.points}</span><span class="${res.ai.points >= 0 ? 'up' : 'down'}">AI ${res.ai.points >= 0 ? '+' : ''}${res.ai.points}</span></div><div class="again"><span class="lbl">Go again</span><button class="bet up" data-dir="UP">▲ UP</button><button class="bet down" data-dir="DOWN">▼ DOWN</button></div></div>`;
      host.querySelectorAll('.bet').forEach((b) => b.addEventListener('click', () => placeBet(sym, b.dataset.dir)));
    } else if (q) {
      host.innerHTML = `<div class="betrow"><button class="bet up" data-dir="UP">▲ Calls UP today</button><button class="bet down" data-dir="DOWN">▼ Calls DOWN today</button></div>`;
      host.querySelectorAll('.bet').forEach((b) => b.addEventListener('click', () => placeBet(sym, b.dataset.dir)));
    } else { host.innerHTML = `<div class="live-wrap"><p class="empty">Waiting for a quote on ${sym}…</p></div>`; }
  }

  function sideBox(el, s, lead) { el.classList.toggle('lead', lead); el.querySelector('.n').textContent = s.score; const streak = s.streak !== 0 ? `<span class="${s.streak > 0 ? 'up' : 'down'}">${s.streak > 0 ? '🔥 ' + s.streak : '❄ ' + Math.abs(s.streak)}</span>` : ''; el.querySelector('.st').innerHTML = `<span>${accuracy(s)}% acc</span><span>·</span><span>${s.wins}-${s.losses}</span>${streak}`; }
  function renderScore() {
    sideBox($('scPlayer'), state.player, state.player.score > state.ai.score);
    sideBox($('scAI'), state.ai, state.ai.score > state.player.score);
    $('rounds').innerHTML = state.rounds.length ? state.rounds.map((r) => `<div class="rd"><span style="font-weight:700">${r.symbol}</span><span class="${r.actual === 'UP' ? 'up' : 'down'}">${r.actual === 'UP' ? '▲' : '▼'}</span><span class="ch ${r.player.correct ? 'ok' : 'bad'}">You ${r.player.correct ? '✓' : '✗'}</span><span class="ch ${r.ai.correct ? 'ok' : 'bad'}">AI ${r.ai.correct ? '✓' : '✗'}</span></div>`).join('') : '<div class="empty">No rounds yet — make your first call.</div>';
  }
  function renderStatus() {
    const st = marketStatus();
    $('statusChip').className = `chip ${st.state}`; $('statusTxt').textContent = st.label;
    $('srcTxt').textContent = state.liveCount > 0 ? `LIVE · FINNHUB (${state.liveCount})` : 'SIM ENGINE';
    const sl = sentLabel(state.sentiment); $('sentChip').className = `chip ${sl.tone}`; $('sentTxt').textContent = sl.label;
    $('clkTxt').textContent = fmtClock(state.lastUpdate);
  }
  function renderCountdown() { const { wd, sec } = nyNow(), open = wd >= 1 && wd <= 5 && sec >= OPEN_S && sec < CLOSE_S; $('openCd').classList.toggle('open', open); $('cdLabel').textContent = open ? 'US MARKET CLOSES IN' : 'US MARKET OPENS IN'; $('cdClock').textContent = fmtDur(open ? CLOSE_S - sec : secsToNextOpen(wd, sec)); }
  function renderAll() { renderStatus(); renderWatchlist(); renderTF(); renderChart(); renderPred(); renderScore(); postHeight(); }

  // ---- briefing -----------------------------------------------
  const todayStr = () => new Date().toISOString().slice(0, 10);
  function briefingAcked() { try { return localStorage.getItem(BRIEF_KEY) === (state.news.date || todayStr()); } catch { return false; } }
  function ackBriefing() { try { localStorage.setItem(BRIEF_KEY, state.news.date || todayStr()); } catch {} }
  function buildBriefing() {
    const n = state.news, sl = sentLabel(state.sentiment), icon = { financial: '◇', industrial: '▣', political: '⬡', tech: '⊞' };
    const items = n.items.map((it) => { const s = sentLabel(typeof it.sentiment === 'number' ? it.sentiment : scoreText(`${it.title} ${it.summary || ''}`)); return `<article class="bf-item"><div class="bf-itop"><span class="bf-cat">${icon[it.category] || '•'} ${it.category || 'note'}</span><span class="bf-sent ${s.tone}">${s.label}</span></div><h3 class="bf-title">${it.title || ''}</h3>${it.summary ? `<p class="bf-sum">${it.summary}</p>` : ''}${it.source ? `<a class="bf-src" href="${it.url || '#'}" target="_blank" rel="noreferrer noopener">${it.source} ↗</a>` : ''}</article>`; }).join('');
    return `<div class="bf-backdrop" id="bfBackdrop"></div><div class="bf-modal" role="dialog" aria-modal="true" aria-labelledby="bfHeading" tabindex="-1" id="bfModal"><div class="bf-prog" id="bfProg" role="progressbar" aria-label="Reading progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0"><div class="bf-prog-fill" id="bfProgFill"></div></div><header class="bf-head"><div class="bf-barcode" aria-hidden="true"></div><div class="bf-htext"><p class="bf-kicker">TRAXUS//CVKM · DESK BRIEFING</p><h2 class="bf-h" id="bfHeading">Pre-Market Briefing</h2><p class="bf-date">${n.date ? 'Digest · ' + n.date : 'Digest · awaiting first run'} · sentiment <b class="${sl.tone}">${sl.label}</b></p></div><button class="bf-x" id="bfClose" aria-label="Skip briefing and close">✕</button></header><div class="bf-body" id="bfBody" tabindex="0"><div class="bf-warn" role="note"><b>⚠ NOT INVESTMENT ADVICE.</b> This briefing and the Arena are for entertainment and education only. Nothing here is a recommendation to buy or sell any security. Quotes may be delayed; longer chart ranges (W/M/6M/Y/5Y) are modeled, not historical fact.</div><p class="bf-intro">Today's signal across financial, tech, political and industrial wires for the US AI complex. Read it, form a view, then call each name's direction before the bell.</p>${items || '<div class="bf-empty">No digest yet. The scheduled task writes <code>public/arena-news.json</code> about an hour before the US open each weekday.</div>'}<div class="bf-end">— END OF BRIEFING —</div></div><footer class="bf-foot"><button class="bf-skip" id="bfSkip">Skip</button><button class="bf-enter" id="bfEnter" disabled>SCROLL TO READ ▾</button></footer></div>`;
  }
  function openBriefing() {
    const host = $('briefing'); if (!host) return;
    host.innerHTML = buildBriefing(); host.hidden = false;
    try { document.body.style.overflow = 'hidden'; } catch {}
    const body = $('bfBody'), fill = $('bfProgFill'), prog = $('bfProg'), enter = $('bfEnter'); let read = false;
    const update = () => { const max = body.scrollHeight - body.clientHeight; const pct = max > 0 ? Math.min(100, (body.scrollTop / max) * 100) : 100; fill.style.width = pct + '%'; prog.setAttribute('aria-valuenow', Math.round(pct)); if (pct >= 96 && !read) { read = true; enter.disabled = false; enter.textContent = 'ENTER THE ARENA ▶'; } };
    body.addEventListener('scroll', update);
    const scrub = (clientX) => { const r = prog.getBoundingClientRect(); body.scrollTop = Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * (body.scrollHeight - body.clientHeight); };
    let dragging = false;
    prog.addEventListener('pointerdown', (e) => { dragging = true; try { prog.setPointerCapture(e.pointerId); } catch {} scrub(e.clientX); });
    prog.addEventListener('pointermove', (e) => { if (dragging) scrub(e.clientX); });
    prog.addEventListener('pointerup', () => { dragging = false; });
    prog.addEventListener('keydown', (e) => { const max = body.scrollHeight - body.clientHeight; if (e.key === 'ArrowRight' || e.key === 'ArrowDown') body.scrollTop = Math.min(max, body.scrollTop + max * 0.1); if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') body.scrollTop = Math.max(0, body.scrollTop - max * 0.1); });
    const close = () => { ackBriefing(); host.hidden = true; try { document.body.style.overflow = ''; } catch {} };
    $('bfEnter').addEventListener('click', close); $('bfClose').addEventListener('click', close); $('bfSkip').addEventListener('click', close); $('bfBackdrop').addEventListener('click', close);
    host.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    setTimeout(() => { try { $('bfModal').focus(); } catch {} update(); }, 30);
  }
  function renderNews() {
    const host = $('newsList'), n = state.news;
    $('newsDate').textContent = n.date ? '· ' + n.date : '';
    if (n.loading) { host.innerHTML = '<div class="empty">Loading digest…</div>'; return; }
    if (!n.items.length) { host.innerHTML = '<div class="empty">No digest yet. Auto-written ~1h before the US open.</div>'; return; }
    const icon = { financial: '◇', industrial: '▣', political: '⬡', tech: '⊞' };
    host.innerHTML = n.items.map((it) => { const s = sentLabel(typeof it.sentiment === 'number' ? it.sentiment : scoreText(`${it.title} ${it.summary || ''}`)); return `<a href="${it.url || '#'}" target="_blank" rel="noreferrer noopener"><div class="t1"><span class="cat">${icon[it.category] || '•'} ${it.category || ''}</span><span class="sent ${s.tone}">${s.label}</span></div><div class="ti">${it.title || ''}</div>${it.summary ? `<div class="su">${it.summary}</div>` : ''}</a>`; }).join('');
  }

  // ---- boot ---------------------------------------------------
  fetch(CONFIG.newsUrl, { cache: 'no-store' })
    .then((r) => r.ok ? r.json() : Promise.reject())
    .then((data) => { const items = (data.items || []).map((it) => ({ ...it, sentiment: typeof it.sentiment === 'number' ? it.sentiment : scoreText(`${it.title} ${it.summary || ''}`) })); state.news = { date: data.date || null, items, loading: false }; state.sentiment = aggregateSentiment(items); sim.setSentiment(state.sentiment); })
    .catch(() => { state.news = { date: null, items: [], loading: false }; })
    .finally(() => { renderNews(); renderStatus(); if (!EMBED && !briefingAcked()) openBriefing(); });

  const tfRow = $('tfRow');
  if (tfRow) tfRow.querySelectorAll('.tf-b').forEach((b) => b.addEventListener('click', () => { state.timeframe = b.dataset.tf; try { localStorage.setItem(TF_KEY, state.timeframe); } catch {} renderTF(); renderChart(); }));
  const briefBtn = $('briefBtn'); if (briefBtn) briefBtn.addEventListener('click', openBriefing);
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
