/* ============================================================
   HUMAN vs AI TRADING ARENA · TRAXUS//CVKM build — vanilla JS
   - Live quotes: Finnhub (frequent polling)
   - Real history (W/M/6M/Y/5Y): Twelve Data (on-demand, cached/day)
   - AI opponent: Opus 4.8 pre-open calls from the daily briefing
   - Per-symbol rounds, pre/regular/after-hours sessions
   - Bilingual (EN/中) briefing + toggle
   For entertainment only — NOT investment advice.
   ============================================================ */
(() => {
  'use strict';

  const CONFIG = {
    // API keys live server-side now — see /api/quote.js + /api/history.js
    // (Vercel serverless proxies reading FINNHUB_KEY / TWELVE_KEY env vars).
    pollMs: 13000,
    newsUrl: '/arena-news.json',
  };

  const TICKERS = [
    { symbol: 'NVDA', name: 'NVIDIA',         sector: 'AI Compute',  seed: 200.7 },
    { symbol: 'MU',   name: 'Micron',         sector: 'AI Memory',   seed: 1083.0 },
    { symbol: 'ASML', name: 'ASML Holding',   sector: 'Litho',       seed: 1778.46 },
    { symbol: 'AVGO', name: 'Broadcom',       sector: 'Custom ASIC', seed: 389.55 },
    { symbol: 'TSM',  name: 'TSMC',           sector: 'Foundry',     seed: 441.35 },
    { symbol: 'MRVL', name: 'Marvell',        sector: 'AI Network',  seed: 276.7 },
    { symbol: 'LITE', name: 'Lumentum',       sector: 'Optical',     seed: 838.0 },
    { symbol: 'SNDK', name: 'SanDisk',        sector: 'Storage',     seed: 1985.0 },
    { symbol: 'AMD',  name: 'AMD',            sector: 'AI Chips',    seed: 519.74 },
    { symbol: 'SMH',  name: 'VanEck Semis',   sector: 'Semis ETF',   seed: 647.0 },
  ];
  const SYMBOLS = TICKERS.map((t) => t.symbol);
  const BY_SYM = Object.fromEntries(TICKERS.map((t) => [t.symbol, t]));
  const HORIZON_MS = 60000, MAX_HISTORY = 240, SEED_LEN = 64;
  const STORAGE_KEY = 'afflatus-arena:v3', BRIEF_KEY = 'afflatus-arena:briefing', TF_KEY = 'afflatus-arena:tf', LANG_KEY = 'afflatus:lang';
  const TF_LIST = ['D', 'W', 'M', '6M', 'Y', '5Y'];
  const TF_META = { D: { vol: 0.006, label: 'INTRADAY' }, W: { vol: 0.02, n: 34, label: '5 DAYS' }, M: { vol: 0.03, n: 22, label: '1 MONTH' }, '6M': { vol: 0.05, n: 26, label: '6 MONTHS' }, Y: { vol: 0.06, n: 52, label: '1 YEAR' }, '5Y': { vol: 0.1, n: 60, label: '5 YEARS' } };
  const TD_MAP = { W: { int: '30min', n: 66 }, M: { int: '1day', n: 22 }, '6M': { int: '1day', n: 130 }, Y: { int: '1day', n: 252 }, '5Y': { int: '1week', n: 260 } };
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

  // ---- algorithmic fallback model -----------------------------
  function ema(v, a = 0.4) { if (!v.length) return 0; let e = v[0]; for (let i = 1; i < v.length; i++) e = a * v[i] + (1 - a) * e; return e; }

  // ---- technical indicators (computed on the close series) ----
  // Note: the feed is close-only (no real OHLC/volume), so KDJ uses a rolling
  // window of closes as a high/low proxy, and Volume is intentionally omitted.
  function sma(v, n) { const out = new Array(v.length).fill(null); let s = 0; for (let i = 0; i < v.length; i++) { s += v[i]; if (i >= n) s -= v[i - n]; if (i >= n - 1) out[i] = s / n; } return out; }
  function emaSeries(v, n) { const out = new Array(v.length).fill(null); const k = 2 / (n + 1); let e = 0; for (let i = 0; i < v.length; i++) { e = i === 0 ? v[0] : v[i] * k + e * (1 - k); out[i] = e; } return out; }
  function macdCalc(v) { const f = emaSeries(v, 12), s = emaSeries(v, 26); const dif = v.map((_, i) => f[i] - s[i]); const dea = emaSeries(dif, 9); const hist = dif.map((d, i) => d - dea[i]); return { dif, dea, hist }; }
  function kdjCalc(v, n = 9) { const K = new Array(v.length).fill(null), D = new Array(v.length).fill(null), J = new Array(v.length).fill(null); let k = 50, d = 50; for (let i = 0; i < v.length; i++) { const w = v.slice(Math.max(0, i - n + 1), i + 1), lo = Math.min(...w), hi = Math.max(...w); const rsv = hi === lo ? 50 : ((v[i] - lo) / (hi - lo)) * 100; k = (2 / 3) * k + (1 / 3) * rsv; d = (2 / 3) * d + (1 / 3) * k; K[i] = k; D[i] = d; J[i] = 3 * k - 2 * d; } return { K, D, J }; }
  let chartCtx = null;   // last-rendered chart geometry, used by the crosshair
  function modelPredict(history, sentiment = 0) {
    const p = (history || []).map((h) => h.price);
    if (p.length < 4) return { direction: 'UP', confidence: 0.5, reason: 'Warming up.' };
    const r = p.slice(-12), last = r[r.length - 1], first = r[0];
    const momentum = Math.max(-1, Math.min(1, ((last - first) / first) * 40));
    const reversion = Math.max(-1, Math.min(1, ((ema(r) - last) / ema(r)) * 60));
    const raw = 0.55 * momentum + 0.2 * reversion + 0.25 * Math.max(-1, Math.min(1, sentiment));
    return { direction: raw >= 0 ? 'UP' : 'DOWN', confidence: Number((0.5 + Math.min(0.45, Math.abs(raw) * 0.6)).toFixed(2)), reason: momentum >= 0 ? 'Upward momentum.' : 'Downward momentum.' };
  }
  // AI opponent: prefer my (Opus) stored pre-open call, else the algo model.
  function aiCall(sym) {
    const p = state.news.aiPredictions && state.news.aiPredictions[sym];
    if (p && (p.direction === 'UP' || p.direction === 'DOWN')) { const reason = (state.lang === 'zh' ? p.rationale_zh : p.rationale_en) || p.rationale_en || ''; return { direction: p.direction, confidence: typeof p.confidence === 'number' ? p.confidence : 0.6, reason, opus: true }; }
    return { ...modelPredict(history[sym], state.sentiment), opus: false };
  }

  // ---- seeded series ------------------------------------------
  function strHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function genSeries(seedStr, n, vol, anchor, stepMs) { const rnd = mulberry32(strHash(seedStr)); let p = anchor * (0.72 + rnd() * 0.3); const drift = (rnd() - 0.45) * vol * 0.3, raw = [], now = Date.now(); for (let i = 0; i < n; i++) { p = Math.max(0.1, p * (1 + drift + (rnd() - 0.5) * vol)); raw.push(p); } const ratio = anchor / raw[raw.length - 1]; return raw.map((x, i) => ({ t: now - (n - i) * stepMs, price: Number((x * ratio).toFixed(2)) })); }

  // ---- state --------------------------------------------------
  const history = Object.fromEntries(TICKERS.map((t) => [t.symbol, [{ t: Date.now() - 60000, price: t.seed }, { t: Date.now(), price: t.seed }]]));
  const realHist = {};   // key sym|tf -> {series, real:bool}
  const lastBig = {};    // sym -> last price shown in chart header (for glow)
  function countNum(el, to) { if (!el) return; if (RM) { el.textContent = to; return; } const from = parseFloat((el.textContent || '').replace(/[^-\d.]/g, '')) || 0; if (from === to) { el.textContent = to; return; } const t0 = performance.now(), dur = 500; (function s(ts) { const p = Math.min(1, (ts - t0) / dur), v = from + (to - from) * (1 - Math.pow(1 - p, 3)); el.textContent = Math.round(v); if (p < 1) requestAnimationFrame(s); else el.textContent = to; })(performance.now()); }
  const tdPending = {};
  const rebased = new Set();
  // when no real history is available we draw an honest flat snapshot line (prev close → last), never simulated movement
  function modeledSeries(sym) { const a = (latest[sym] && latest[sym].prevClose) || BY_SYM[sym].seed, p = (latest[sym] && latest[sym].price) || a; return [{ t: 0, price: a }, { t: 1, price: p }]; }

  const latest = {};
  for (const t of TICKERS) { const h = history[t.symbol], last = h[h.length - 1].price, prev = h[0].price; latest[t.symbol] = { symbol: t.symbol, price: last, prevClose: prev, open: prev, high: Math.max(...h.map((x) => x.price)), low: Math.min(...h.map((x) => x.price)), change: +(last - prev).toFixed(2), changePct: +(((last - prev) / prev) * 100).toFixed(2), tick: 0, live: false }; }

  const emptySide = () => ({ score: 0, wins: 0, losses: 0, streak: 0, bestStreak: 0 });
  function loadGame() { try { const s = JSON.parse(localStorage.getItem(STORAGE_KEY)); return s ? { player: { ...emptySide(), ...s.player }, ai: { ...emptySide(), ...s.ai }, log: s.log || [], active: s.active || {} } : { player: emptySide(), ai: emptySide(), log: [], active: {} }; } catch { return { player: emptySide(), ai: emptySide(), log: [], active: {} }; } }
  const g0 = loadGame();
  let tf0 = 'D'; try { const t = localStorage.getItem(TF_KEY); if (t && TF_LIST.includes(t)) tf0 = t; } catch {}
  let lang0 = 'en'; try { const l = localStorage.getItem(LANG_KEY); if (l === 'zh' || l === 'en') lang0 = l; } catch {}
  let ind0 = { ma: true, vol: false, macd: false, kdj: false }; try { const i = JSON.parse(localStorage.getItem('afflatus-arena:ind')); if (i) ind0 = { ...ind0, ...i }; } catch {}
  let pm0 = 'OPEN'; try { const p = localStorage.getItem('afflatus-arena:pm'); if (p === 'OPEN' || p === 'CLOSE') pm0 = p; } catch {}
  const state = { selected: SYMBOLS[0], timeframe: tf0, lang: lang0, sentiment: 0, news: { date: null, items: [], aiPredictions: {}, loading: true }, lastUpdate: 0, liveCount: 0, player: g0.player, ai: g0.ai, log: g0.log, active: g0.active || {}, result: {}, indicators: ind0, predMode: pm0 };
  const timers = { round: {}, tick: {} };
  function saveGame() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ player: state.player, ai: state.ai, log: state.log, active: state.active })); } catch {} }
  function saveInd() { try { localStorage.setItem('afflatus-arena:ind', JSON.stringify(state.indicators)); } catch {} }
  function accuracy(s) { const n = s.wins + s.losses; return n ? Math.round((s.wins / n) * 100) : 0; }
  const T = (en, zh) => state.lang === 'zh' ? zh : en;

  // ---- providers ----------------------------------------------
  function finnhubProvider() { async function one(s) { const r = await fetch(`/api/quote?symbol=${encodeURIComponent(s)}`); if (!r.ok) throw 0; const q = await r.json(); if (!q || !q.c) throw 0; return { symbol: s, price: q.c, prevClose: q.pc || q.c, open: q.o || q.c, high: q.h || q.c, low: q.l || q.c, live: true }; } return { async fetchQuotes(syms) { const res = await Promise.allSettled(syms.map(one)); const out = {}; res.forEach((x, i) => { if (x.status === 'fulfilled') out[syms[i]] = x.value; }); return out; } }; }
  const liveProvider = finnhubProvider();   // hits /api/quote (server-side key); falls back to briefing snapshot when unavailable

  // Briefing snapshot (pre-market + prev close) — used when the free API can't supply a live quote.
  // No price simulation: a symbol is either LIVE (Finnhub) or a static daily SNAPSHOT from the briefing.
  function snapQuote(s) { const p = state.news.prices && state.news.prices[s]; if (!p) return null; return { symbol: s, price: p.price, prevClose: (p.prevClose != null ? p.prevClose : p.price), open: (p.open != null ? p.open : p.price), high: (p.high != null ? p.high : p.price), low: (p.low != null ? p.low : p.price), live: false, snap: true }; }
  function seedD(s, anchor) { const ser = state.news.series && state.news.series[s]; if (ser && ser.length > 1) { const out = ser.map((v, i) => ({ t: i, price: +v })); out.push({ t: ser.length, price: anchor }); return out; } return [{ t: Date.now() - 60000, price: anchor }, { t: Date.now(), price: anchor }]; }

  let polling = false;
  async function poll() {
    if (polling) return; polling = true;
    try {
      let live = {}; if (liveProvider) { try { live = await liveProvider.fetchQuotes(SYMBOLS); } catch {} }
      let liveCount = 0, snapCount = 0;
      for (const s of SYMBOLS) {
        const q = live[s] || snapQuote(s); if (!q) continue;
        if (q.live) liveCount++; else if (q.snap) snapCount++;
        if (q.live && !rebased.has(s)) { history[s] = seedD(s, q.prevClose); rebased.add(s); }
        const prev = latest[s], change = q.price - q.prevClose;
        latest[s] = { ...q, symbol: s, change: +change.toFixed(2), changePct: q.prevClose ? +((change / q.prevClose) * 100).toFixed(2) : 0, tick: prev ? Math.sign(q.price - prev.price) : 0 };
        const arr = history[s]; if (q.live || !arr.length || arr[arr.length - 1].price !== q.price) { arr.push({ t: Date.now(), price: q.price }); if (arr.length > MAX_HISTORY) arr.shift(); }
      }
      state.liveCount = liveCount; state.snapCount = snapCount; state.lastUpdate = Date.now(); resolvePending(); renderAll();
    } finally { polling = false; }
  }

  // ---- Twelve Data history (real, cached per day) -------------
  function tdCacheGet(sym, tf) { try { const r = JSON.parse(localStorage.getItem(`afflatus-td:${sym}:${tf}`)); if (r && r.d === new Date().toISOString().slice(0, 10) && Array.isArray(r.s) && r.s.length > 1) return r.s; } catch {} return null; }
  function tdCacheSet(sym, tf, s) { try { localStorage.setItem(`afflatus-td:${sym}:${tf}`, JSON.stringify({ d: new Date().toISOString().slice(0, 10), s })); } catch {} }
  async function fetchTD(sym, tf) {
    const m = TD_MAP[tf]; const url = `/api/history?symbol=${encodeURIComponent(sym)}&interval=${encodeURIComponent(m.int)}&outputsize=${m.n}`;
    const r = await fetch(url); if (!r.ok) throw 0; const j = await r.json();
    if (!j || j.status !== 'ok' || !Array.isArray(j.values)) throw 0;
    const s = j.values.map((v) => ({ t: Date.parse(v.datetime) || 0, price: +v.close, vol: +v.volume || 0 })).filter((p) => isFinite(p.price) && p.price > 0).reverse();
    if (s.length < 2) throw 0; return s;
  }
  function ensureHistory(sym, tf) {
    if (tf === 'D') return; const key = sym + '|' + tf;
    if (realHist[key]) return;
    const cached = tdCacheGet(sym, tf);
    if (cached) { realHist[key] = { series: cached, real: true }; return; }
    if (tdPending[key]) return; tdPending[key] = true;
    fetchTD(sym, tf).then((s) => { realHist[key] = { series: s, real: true }; tdCacheSet(sym, tf, s); }).catch(() => { realHist[key] = { series: modeledSeries(sym, tf), real: false }; }).finally(() => { tdPending[key] = false; if (state.selected === sym && state.timeframe === tf) renderChart(); });
  }

  // ---- game (daily OPEN / CLOSE direction calls) --------------
  // OPEN  = will the stock OPEN up or down vs the prior close?  resolves at the open.
  // CLOSE = will the stock CLOSE the day up or down vs the prior close?  resolves at the close.
  // A call placed before its event stays PENDING and resolves automatically once
  // the open (or close) is known; placed after the event, it resolves immediately.
  function actualDir(end, base) { return end >= base ? 'UP' : 'DOWN'; }
  function scoreRound({ direction, base, end, confidence = 0.6, isAI = false }) { const actual = actualDir(end, base), correct = direction === actual, movePct = base ? Math.abs((end - base) / base) * 100 : 0; return { actual, correct, movePct: +movePct.toFixed(2), points: correct ? 10 + (isAI ? Math.round(confidence * 10) : Math.round(Math.min(10, movePct * 4))) : -4 }; }
  function applyResult(side, correct, points) { side.score += points; if (correct) { side.wins++; side.streak = Math.max(1, side.streak + 1); } else { side.losses++; side.streak = Math.min(-1, side.streak - 1); } side.bestStreak = Math.max(side.bestStreak, side.streak); }
  // Is the resolving event known yet? OPEN known once we're past the open; CLOSE known once the session is done.
  function resolveInfo(mode, q, st) { if (!q) return { ready: false }; if (mode === 'OPEN') { if (st.state === 'pre') return { ready: false }; return { ready: true, end: (q.open != null ? q.open : q.price) }; } if (st.state === 'post' || st.state === 'closed') return { ready: true, end: q.price }; return { ready: false }; }
  function placeBet(sym, dir, mode) {
    if (state.active[sym]) return; const q = latest[sym]; if (!q) return;
    const st = marketStatus(), base = (q.prevClose != null ? q.prevClose : q.price);
    state.active[sym] = { symbol: sym, mode: mode || state.predMode, playerDir: dir, ai: aiCall(sym), base, placed: Date.now(), session: st.label, day: state.news.date || todayStr() };
    delete state.result[sym]; saveGame();
    tryResolve(sym);
    if (state.active[sym]) { renderPred(); renderWatchlist(); }
  }
  function tryResolve(sym) {
    const a = state.active[sym]; if (!a) return; const q = latest[sym], st = marketStatus();
    const info = resolveInfo(a.mode, q, st); if (!info.ready) return;
    const end = info.end;
    const pr = scoreRound({ direction: a.playerDir, base: a.base, end, isAI: false });
    const ar = scoreRound({ direction: a.ai.direction, base: a.base, end, confidence: a.ai.confidence, isAI: true });
    applyResult(state.player, pr.correct, pr.points); applyResult(state.ai, ar.correct, ar.points);
    state.log = [{ id: sym + a.placed, symbol: sym, mode: a.mode, actual: pr.actual, player: { dir: a.playerDir, correct: pr.correct, points: pr.points }, ai: { dir: a.ai.direction, correct: ar.correct, points: ar.points } }, ...state.log].slice(0, 30);
    state.result[sym] = { symbol: sym, mode: a.mode, actual: pr.actual, endPrice: end, base: a.base, movePct: pr.movePct, session: a.session, player: { ...pr, direction: a.playerDir }, ai: { ...ar, direction: a.ai.direction, confidence: a.ai.confidence, opus: a.ai.opus, reason: a.ai.reason }, winner: pr.points === ar.points ? 'tie' : (pr.points > ar.points ? 'player' : 'ai') };
    delete state.active[sym]; saveGame(); if (state.selected === sym) renderPred(); renderScore(); renderWatchlist();
  }
  function resolvePending() { for (const sym of Object.keys(state.active)) tryResolve(sym); }
  function resetScores() { state.player = emptySide(); state.ai = emptySide(); state.log = []; state.result = {}; state.active = {}; saveGame(); renderScore(); renderPred(); renderWatchlist(); }

  // ---- rendering ----------------------------------------------
  const $ = (id) => document.getElementById(id);
  const fmtClock = (ts) => ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
  const EMBED = (() => { try { return new URLSearchParams(location.search).has('embed'); } catch { return false; } })();
  function postHeight() { if (!EMBED) return; try { parent.postMessage({ type: 'afflatus-arena-height', height: document.documentElement.scrollHeight }, '*'); } catch {} }

  function spark(points, up) { if (!points || points.length < 2) return ''; const v = points.slice(-40).map((p) => p.price), mn = Math.min(...v), mx = Math.max(...v), rg = mx - mn || 1, W = 84, H = 26; const d = v.map((p, i) => `${i ? 'L' : 'M'}${((i / (v.length - 1)) * W).toFixed(1)},${(H - ((p - mn) / rg) * H).toFixed(1)}`).join(' '); return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="${up ? 'var(--up)' : 'var(--down)'}" stroke-width="1.8"/></svg>`; }
  function renderWatchlist() {
    const host = $('watchlist');
    host.innerHTML = TICKERS.map((t) => { const q = latest[t.symbol], up = (q?.changePct ?? 0) >= 0, flash = q?.tick > 0 ? 'flash-u' : q?.tick < 0 ? 'flash-d' : ''; const tag = q?.live ? '<span class="tk-live">LIVE</span>' : '<span class="tk-sim">SIM</span>'; const live = state.active[t.symbol] ? '<span class="tk-round" title="Round in play">◉</span>' : ''; return `<button class="tk ${t.symbol === state.selected ? 'tk--active' : ''}" data-sym="${t.symbol}" role="option" aria-selected="${t.symbol === state.selected}" aria-label="${t.name}, ${q ? '$' + q.price.toFixed(2) + ', ' + (up ? 'up ' : 'down ') + Math.abs(q.changePct).toFixed(2) + ' percent' : 'no quote'}"><span class="tk-bracket" aria-hidden="true"></span><div class="r1"><div><div class="sym">${t.symbol}${tag}${live}</div><div class="sector">${t.sector}</div></div>${spark(history[t.symbol], up)}</div><div class="r2"><span class="px ${flash}">${q ? '$' + q.price.toFixed(2) : '—'}</span><span class="pct ${up ? 'up' : 'down'}">${q ? (up ? '▲' : '▼') + ' ' + Math.abs(q.changePct).toFixed(2) + '%' : ''}</span></div></button>`; }).join('');
    host.querySelectorAll('.tk').forEach((b) => b.addEventListener('click', () => { state.selected = b.dataset.sym; ensureHistory(state.selected, state.timeframe); renderWatchlist(); renderChart(); renderPred(); }));
  }
  function renderTF() { const row = $('tfRow'); if (!row) return; row.querySelectorAll('.tf-b').forEach((b) => { const on = b.dataset.tf === state.timeframe; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); }
  function fmtAxisTime(t, tf) { if (!t || t < 1e11) return ''; const d = new Date(t), p2 = (x) => String(x).padStart(2, '0'), md = `${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; return (tf === 'D' || tf === 'W') ? `${md} ${p2(d.getHours())}:${p2(d.getMinutes())}` : `${d.getFullYear()}-${md}`; }
  function mapLineY(arr, n, X, Yfn) { let d = '', started = false; for (let i = 0; i < n; i++) { const x = arr[i]; if (x == null || !isFinite(x)) continue; d += `${started ? 'L' : 'M'}${X(i).toFixed(1)},${Yfn(x).toFixed(1)}`; started = true; } return d; }
  function renderIndBar() { const map = { ma: 'indMA', vol: 'indVOL', macd: 'indMACD', kdj: 'indKDJ' }; for (const k in map) { const b = $(map[k]); if (b) { b.classList.toggle('on', !!state.indicators[k]); b.setAttribute('aria-pressed', !!state.indicators[k]); } } }
  function renderChart() {
    const sym = state.selected, meta = BY_SYM[sym], q = latest[sym], tf = state.timeframe, isD = tf === 'D';
    let series, real = true;
    if (isD) series = history[sym] || []; else { const r = realHist[sym + '|' + tf]; if (r) { series = r.series; real = r.real; } else { series = modeledSeries(sym, tf); real = false; ensureHistory(sym, tf); } }
    const up = (q?.changePct ?? 0) >= 0;
    $('cSym').textContent = sym; $('cName').textContent = meta?.name || '';
    $('cBig').innerHTML = q ? `$${q.price.toFixed(2)} <span class="ch ${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${Math.abs(q.change).toFixed(2)} (${Math.abs(q.changePct).toFixed(2)}%)</span>` : '—';
    if (q && lastBig[sym] !== q.price) { const cb = $('cBig'); cb.classList.remove('bump', 'bump-up', 'bump-dn'); void cb.offsetWidth; cb.classList.add('bump', up ? 'bump-up' : 'bump-dn'); lastBig[sym] = q.price; }
    $('cOhlc').innerHTML = q ? `<span>O<b>${q.open.toFixed(2)}</b></span><span>H<b>${q.high.toFixed(2)}</b></span><span>L<b>${q.low.toFixed(2)}</b></span><span>PC<b>${q.prevClose.toFixed(2)}</b></span>` : '';
    const st = marketStatus();
    const badge = isD ? (st.state === 'open' ? 'INTRADAY · LIVE' : (q && q.snap ? 'SNAPSHOT · ' + st.label.toUpperCase() : st.label.toUpperCase())) : (real ? `REAL · ${TF_META[tf].label}` : `SNAPSHOT · ${TF_META[tf].label}`);
    $('cBadge').textContent = badge; $('cBadge').className = 'chart-badge ' + (isD && st.state === 'open' ? 'is-live' : (!isD && real ? 'is-real' : (isD ? '' : 'is-modeled')));
    renderIndBar();
    const svg = $('cChart'), loading = $('cLoading');
    if (!series || series.length < 2) { svg.innerHTML = ''; chartCtx = null; svg.style.height = '240px'; loading.style.display = 'grid'; return; }
    loading.style.display = 'none';
    const v = series.map((h) => h.price), times = series.map((h) => h.t), n = v.length, enough = n >= 8;
    const hasVol = series.some((h) => h.vol > 0), vols = hasVol ? series.map((h) => h.vol || 0) : v.map((p, i) => Math.abs(p - (i ? v[i - 1] : p)));
    const ind = state.indicators, showMA = !!ind.ma && n >= 5, showVOL = !!ind.vol && n >= 2, showMACD = !!ind.macd && enough, showKDJ = !!ind.kdj && enough;
    const W = 600, padR = 58, plotW = W - padR, PH = 188, gap = 14, SH = 66, TA = 16;
    const subs = []; if (showVOL) subs.push('vol'); if (showMACD) subs.push('macd'); if (showKDJ) subs.push('kdj');
    const Htotal = PH + subs.length * (SH + gap) + TA;
    const X = (i) => n > 1 ? (i / (n - 1)) * plotW : 0;
    const pc = isD && q ? q.prevClose : null;
    const lo = Math.min(...v, ...(pc != null ? [pc] : [])), hi = Math.max(...v, ...(pc != null ? [pc] : [])), pad = (hi - lo) * 0.12 || 1, LO = lo - pad, HI = hi + pad, RG = HI - LO || 1;
    const Y = (p) => PH - ((p - LO) / RG) * PH, c = up ? 'var(--up)' : 'var(--down)';
    const ma7 = showMA ? sma(v, 7) : null, ma30 = showMA ? sma(v, 30) : null, mac = showMACD ? macdCalc(v) : null, kdj = showKDJ ? kdjCalc(v) : null;
    let s = `<defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${c}" stop-opacity="0.26"/><stop offset="100%" stop-color="${c}" stop-opacity="0"/></linearGradient></defs>`;
    for (let i = 0; i <= 4; i++) { const yy = (i / 4) * PH, price = HI - (i / 4) * RG; s += `<line x1="0" y1="${yy.toFixed(1)}" x2="${plotW}" y2="${yy.toFixed(1)}" class="cgrid"/><text x="${W - 4}" y="${(yy + 3.5).toFixed(1)}" class="caxis" text-anchor="end">${price.toFixed(2)}</text>`; }
    for (let i = 1; i < 6; i++) { const xx = (i / 6) * plotW; s += `<line x1="${xx.toFixed(1)}" y1="0" x2="${xx.toFixed(1)}" y2="${(Htotal - TA).toFixed(1)}" class="cgrid cgrid--v"/>`; }
    if (pc != null) { const pcy = Y(pc); s += `<line x1="0" y1="${pcy.toFixed(1)}" x2="${plotW}" y2="${pcy.toFixed(1)}" class="cpc"/><text x="2" y="${(pcy - 4).toFixed(1)}" class="cpc-t">PREV ${pc.toFixed(2)}</text>`; }
    const line = v.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p).toFixed(1)}`).join(' ');
    s += `<path d="${line} L${plotW.toFixed(1)},${PH} L0,${PH} Z" fill="url(#ag)"/><path d="${line}" class="cline" fill="none" stroke="${c}"/>`;
    if (showMA) { if (ma7) s += `<path d="${mapLineY(ma7, n, X, Y)}" class="cma cma7" fill="none"/>`; if (ma30) s += `<path d="${mapLineY(ma30, n, X, Y)}" class="cma cma30" fill="none"/>`; s += `<text x="2" y="11" class="cma-lg"><tspan class="cma7">MA7</tspan> <tspan class="cma30">MA30</tspan></text>`; }
    const lx = X(n - 1), ly = Y(v[n - 1]);
    s += `<line x1="${lx.toFixed(1)}" y1="0" x2="${lx.toFixed(1)}" y2="${PH}" class="cnow"/><circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="3.4" fill="${c}" class="cdot"/><rect x="${(lx + 4).toFixed(1)}" y="${(ly - 9).toFixed(1)}" width="50" height="16" class="ctagbg"/><text x="${(lx + 8).toFixed(1)}" y="${(ly + 3).toFixed(1)}" class="ctag" fill="${c}">${v[n - 1].toFixed(2)}</text>`;
    const panels = []; let top = PH + gap;
    const frame = (label, t0) => `<rect x="0" y="${t0.toFixed(1)}" width="${plotW}" height="${SH}" class="cpanel"/><text x="3" y="${(t0 + 11).toFixed(1)}" class="cpanel-t">${label}</text>`;
    if (showVOL) { const t0 = top; panels.push({ type: 'vol', top: t0 }); const vmax = Math.max(1, ...vols), bw = Math.max(1, plotW / n * 0.62); let bars = ''; for (let i = 0; i < n; i++) { const hgt = (vols[i] / vmax) * (SH - 14), barUp = i === 0 ? true : v[i] >= v[i - 1]; bars += `<rect x="${(X(i) - bw / 2).toFixed(1)}" y="${(t0 + SH - hgt).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0.5, hgt).toFixed(1)}" class="${barUp ? 'cvol-up' : 'cvol-dn'}"/>`; } s += frame(hasVol ? 'VOL' : 'VOL · proxy', t0) + bars; top += SH + gap; }
    if (showMACD) { const t0 = top; panels.push({ type: 'macd', top: t0 }); const all = mac.dif.concat(mac.dea, mac.hist).filter(isFinite); const mx = Math.max(0.0001, ...all.map(Math.abs)); const zeroY = t0 + SH / 2, MY = (x) => zeroY - (x / mx) * (SH / 2 - 4), bw = Math.max(1, plotW / n * 0.6); let bars = ''; for (let i = 0; i < n; i++) { const h = mac.hist[i]; if (!isFinite(h)) continue; const y = MY(h); bars += `<rect x="${(X(i) - bw / 2).toFixed(1)}" y="${Math.min(y, zeroY).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.abs(y - zeroY).toFixed(1)}" class="${h >= 0 ? 'cmh-up' : 'cmh-dn'}"/>`; } s += frame('MACD 12,26,9', t0) + `<line x1="0" y1="${zeroY.toFixed(1)}" x2="${plotW}" y2="${zeroY.toFixed(1)}" class="czero"/>` + bars + `<path d="${mapLineY(mac.dif, n, X, MY)}" class="cdif" fill="none"/><path d="${mapLineY(mac.dea, n, X, MY)}" class="cdea" fill="none"/>`; top += SH + gap; }
    if (showKDJ) { const t0 = top; panels.push({ type: 'kdj', top: t0 }); const KY = (x) => t0 + SH - (Math.max(-20, Math.min(120, x)) + 20) / 140 * SH; s += frame('KDJ 9,3,3', t0) + `<line x1="0" y1="${KY(80).toFixed(1)}" x2="${plotW}" y2="${KY(80).toFixed(1)}" class="czero"/><line x1="0" y1="${KY(20).toFixed(1)}" x2="${plotW}" y2="${KY(20).toFixed(1)}" class="czero"/><path d="${mapLineY(kdj.K, n, X, KY)}" class="ck" fill="none"/><path d="${mapLineY(kdj.D, n, X, KY)}" class="cd2" fill="none"/><path d="${mapLineY(kdj.J, n, X, KY)}" class="cj" fill="none"/>`; top += SH + gap; }
    const ticks = Math.min(6, n); for (let k = 0; k < ticks; k++) { const i = Math.round(k / Math.max(1, ticks - 1) * (n - 1)), lab = fmtAxisTime(times[i], tf); if (!lab) continue; const anchor = k === 0 ? 'start' : (k === ticks - 1 ? 'end' : 'middle'); s += `<text x="${X(i).toFixed(1)}" y="${(Htotal - 4).toFixed(1)}" class="caxis-x" text-anchor="${anchor}">${lab}</text>`; }
    s += `<g id="xhair"></g>`;
    svg.setAttribute('viewBox', `0 0 ${W} ${Htotal}`); svg.style.height = Htotal + 'px'; svg.innerHTML = s;
    chartCtx = { W, Htotal, plotW, n, PH, TA, LO, HI, RG, times, v, vols, hasVol, ma7, ma30, mac, kdj, panels, tf };
  }
  function moveCross(e) {
    const ctx = chartCtx, svg = $('cChart'), xh = document.getElementById('xhair'); if (!ctx || !xh) return;
    const rect = svg.getBoundingClientRect(); if (!rect.width) return;
    const vx = (e.clientX - rect.left) / rect.width * ctx.W, vy = (e.clientY - rect.top) / rect.height * ctx.Htotal;
    let i = Math.round(vx / ctx.plotW * (ctx.n - 1)); i = Math.max(0, Math.min(ctx.n - 1, i)); if (!isFinite(i)) return;
    const px = (i / (ctx.n - 1)) * ctx.plotW, close = ctx.v[i];
    let hLine = '', priceTag = '';
    if (vy >= 0 && vy <= ctx.PH) { const price = ctx.HI - (vy / ctx.PH) * ctx.RG; hLine = `<line x1="0" y1="${vy.toFixed(1)}" x2="${ctx.plotW}" y2="${vy.toFixed(1)}" class="xh-l"/>`; priceTag = `<rect x="${ctx.plotW.toFixed(1)}" y="${(vy - 8).toFixed(1)}" width="${(ctx.W - ctx.plotW).toFixed(1)}" height="16" class="xh-tagbg"/><text x="${(ctx.plotW + 4).toFixed(1)}" y="${(vy + 3.5).toFixed(1)}" class="xh-tag">${price.toFixed(2)}</text>`; }
    const tlab = fmtAxisTime(ctx.times[i], ctx.tf) || ('#' + (i + 1)), tw = Math.max(54, tlab.length * 6.4);
    const tx = Math.max(0, Math.min(ctx.plotW - tw, px - tw / 2));
    const timeTag = `<rect x="${tx.toFixed(1)}" y="${(ctx.Htotal - 15).toFixed(1)}" width="${tw.toFixed(1)}" height="14" class="xh-tagbg"/><text x="${px.toFixed(1)}" y="${(ctx.Htotal - 4.5).toFixed(1)}" class="xh-tag" text-anchor="middle">${tlab}</text>`;
    const seg = [tlab, `C ${close.toFixed(2)}`];
    if (ctx.ma7 && ctx.ma7[i] != null) seg.push(`MA7 ${ctx.ma7[i].toFixed(2)}`);
    if (ctx.ma30 && ctx.ma30[i] != null) seg.push(`MA30 ${ctx.ma30[i].toFixed(2)}`);
    if (ctx.mac && isFinite(ctx.mac.dif[i])) seg.push(`DIF ${ctx.mac.dif[i].toFixed(2)} DEA ${ctx.mac.dea[i].toFixed(2)}`);
    if (ctx.vols && state.indicators.vol) { const vv = ctx.vols[i] || 0; seg.push((ctx.hasVol ? 'VOL ' : 'VOL* ') + (ctx.hasVol ? (vv >= 1e6 ? (vv / 1e6).toFixed(1) + 'M' : vv >= 1e3 ? (vv / 1e3).toFixed(0) + 'K' : Math.round(vv)) : vv.toFixed(2))); }
    if (ctx.kdj && ctx.kdj.K[i] != null) seg.push(`K ${ctx.kdj.K[i].toFixed(0)} D ${ctx.kdj.D[i].toFixed(0)} J ${ctx.kdj.J[i].toFixed(0)}`);
    const txt = seg.join('   '), legW = Math.min(ctx.plotW - 4, Math.max(120, txt.length * 5.7));
    const legend = `<rect x="2" y="2" width="${legW.toFixed(0)}" height="15" class="xh-legbg"/><text x="6" y="13" class="xh-leg">${txt}</text>`;
    const dotY = ctx.PH - ((close - ctx.LO) / ctx.RG) * ctx.PH;
    xh.innerHTML = `<line x1="${px.toFixed(1)}" y1="0" x2="${px.toFixed(1)}" y2="${(ctx.Htotal - 16).toFixed(1)}" class="xh-l"/>${hLine}<circle cx="${px.toFixed(1)}" cy="${dotY.toFixed(1)}" r="3" class="xh-dot"/>${priceTag}${timeTag}${legend}`;
  }
  function hideCross() { const xh = document.getElementById('xhair'); if (xh) xh.innerHTML = ''; }

  function callBox(who, dir, conf, resolved, correct, opus) {
    const cls = resolved ? (correct ? 'win' : 'lose') : (dir === 'UP' ? 'u' : 'd'), arrow = dir === 'UP' ? '▲' : '▼';
    return `<div class="call ${cls}"><div class="call-hd"><span class="who">${who}</span>${opus ? '<span class="opus">OPUS 4.8</span>' : ''}</div><div class="dir"><span class="ar">${arrow}</span> ${dir}</div><div class="cf">${conf != null ? Math.round(conf * 100) + '% ' + T('conf', '信心') : '&nbsp;'}</div>${resolved ? `<span class="mk">${correct ? '✓' : '✗'}</span>` : ''}</div>`;
  }
  function renderPred() {
    $('pSym').textContent = state.selected;
    const host = $('predBody'), sym = state.selected, q = latest[sym], r = state.active[sym], res = state.result[sym], st = marketStatus();
    const sess = `<span class="sess sess--${st.state}">${st.label}</span>`;
    const modeTabs = `<div class="pmode" role="tablist" aria-label="${T('Prediction type', '预测类型')}"><button class="pmode-b ${state.predMode === 'OPEN' ? 'on' : ''}" data-pm="OPEN" role="tab" aria-selected="${state.predMode === 'OPEN'}">${T('OPEN', '开盘')}</button><button class="pmode-b ${state.predMode === 'CLOSE' ? 'on' : ''}" data-pm="CLOSE" role="tab" aria-selected="${state.predMode === 'CLOSE'}">${T('CLOSE', '收盘')}</button></div>`;
    const wireTabs = () => host.querySelectorAll('.pmode-b').forEach((b) => b.addEventListener('click', () => { state.predMode = b.dataset.pm; try { localStorage.setItem('afflatus-arena:pm', state.predMode); } catch {} renderPred(); }));
    if (r) {
      const base = r.base, cur = q ? q.price : base, dpct = base ? ((cur - base) / base * 100) : 0, evt = r.mode === 'OPEN' ? T('the open', '开盘') : T('the close', '收盘');
      host.innerHTML = `<div class="live-wrap"><div class="sessline">${sess}<span class="sesssym">${sym} · ${r.mode === 'OPEN' ? T('OPEN call', '开盘预测') : T('CLOSE call', '收盘预测')}</span></div><div class="pending"><span class="pulse"></span>${T('Locked in — waiting for', '已锁定——等待')} ${evt}</div><div class="calls">${callBox(T('You', '你'), r.playerDir)}<span class="vs">VS</span>${callBox('AI', r.ai.direction, r.ai.confidence, false, false, r.ai.opus)}</div><p class="reason">🤖 ${r.ai.reason || ''}</p><div class="pxs"><span>${T('Prev close', '前收')} <b>$${base.toFixed(2)}</b></span><span>${T('Now', '现价')} <b class="${cur >= base ? 'up' : 'down'}">$${cur.toFixed(2)} (${dpct >= 0 ? '+' : ''}${dpct.toFixed(2)}%)</b></span></div></div>`;
    } else if (res) {
      const evt = res.mode === 'OPEN' ? T('opened', '开盘') : T('closed', '收盘');
      host.innerHTML = `<div class="live-wrap"><div class="banner ${res.winner}">${res.winner === 'player' ? T('🏆 You beat the AI', '🏆 你赢了 AI') : res.winner === 'ai' ? T('🤖 The AI won', '🤖 AI 赢了') : T('🤝 Dead heat', '🤝 平手')}</div><div class="detail">${sym} ${evt} <b class="${res.actual === 'UP' ? 'up' : 'down'}">${res.actual === 'UP' ? T('UP', '涨') : T('DOWN', '跌')}</b> · $${res.base.toFixed(2)} → $${res.endPrice.toFixed(2)} (${res.movePct}%)</div><div class="calls">${callBox(T('You', '你'), res.player.direction, null, true, res.player.correct)}<span class="vs">VS</span>${callBox('AI', res.ai.direction, res.ai.confidence, true, res.ai.correct, res.ai.opus)}</div><div class="points"><span class="${res.player.points >= 0 ? 'up' : 'down'}">${T('You', '你')} ${res.player.points >= 0 ? '+' : ''}${res.player.points}</span><span class="${res.ai.points >= 0 ? 'up' : 'down'}">AI ${res.ai.points >= 0 ? '+' : ''}${res.ai.points}</span></div><div class="again"><span class="lbl">${T('Go again', '再来')}</span>${modeTabs}<div class="betrow betrow--again"><button class="bet bet--up" data-dir="UP"><b>▲</b><span>${T('UP', '看涨')}</span></button><button class="bet bet--down" data-dir="DOWN"><b>▼</b><span>${T('DOWN', '看跌')}</span></button></div></div></div>`;
      wireTabs(); host.querySelectorAll('.bet').forEach((b) => b.addEventListener('click', () => placeBet(sym, b.dataset.dir, state.predMode)));
    } else if (q) {
      const base = q.prevClose, ask = state.predMode === 'OPEN' ? T('Will it OPEN above or below the prior close?', '开盘会高于还是低于前收？') : T('Will it CLOSE up or down vs the prior close?', '收盘相对前收是涨还是跌？');
      host.innerHTML = `<div class="betwrap"><div class="sessline">${sess}<span class="sesssym">${sym}</span></div>${modeTabs}<p class="ask">${ask}<b>${T('Prev close', '前收')} $${base.toFixed(2)}</b></p><div class="betrow"><button class="bet bet--up" data-dir="UP"><b>▲</b><span>${T('UP', '看涨')}</span></button><button class="bet bet--down" data-dir="DOWN"><b>▼</b><span>${T('DOWN', '看跌')}</span></button></div></div>`;
      wireTabs(); host.querySelectorAll('.bet').forEach((b) => b.addEventListener('click', () => placeBet(sym, b.dataset.dir, state.predMode)));
    } else { host.innerHTML = `<div class="live-wrap"><p class="empty">${T('Waiting for a quote on', '正在等待报价')} ${sym}…</p></div>`; }
  }
  function sideBox(el, s, lead) { el.classList.toggle('lead', lead); countNum(el.querySelector('.n'), s.score); const streak = s.streak !== 0 ? `<span class="${s.streak > 0 ? 'up' : 'down'}">${s.streak > 0 ? '🔥 ' + s.streak : '❄ ' + Math.abs(s.streak)}</span>` : ''; el.querySelector('.st').innerHTML = `<span>${accuracy(s)}% acc</span><span>·</span><span>${s.wins}-${s.losses}</span>${streak}`; }
  function renderScore() { sideBox($('scPlayer'), state.player, state.player.score > state.ai.score); sideBox($('scAI'), state.ai, state.ai.score > state.player.score); $('rounds').innerHTML = state.log.length ? state.log.map((r) => `<div class="rd"><span class="rd-sym">${r.symbol}</span><span class="rd-mode">${r.mode === 'CLOSE' ? T('CLS', '收') : T('OPN', '开')}</span><span class="rd-dir ${r.actual === 'UP' ? 'up' : 'down'}">${r.actual === 'UP' ? '▲' : '▼'}</span><span class="ch ${r.player.correct ? 'ok' : 'bad'}">${T('You', '你')} ${r.player.correct ? '✓' : '✗'}</span><span class="ch ${r.ai.correct ? 'ok' : 'bad'}">AI ${r.ai.correct ? '✓' : '✗'}</span></div>`).join('') : `<div class="empty">${T('No rounds yet — make your first call.', '还没有对局——先做第一个判断。')}</div>`; }
  function renderStatus() { const st = marketStatus(); $('statusChip').className = `chip ${st.state}`; $('statusTxt').textContent = st.label; $('srcTxt').textContent = state.liveCount > 0 ? `LIVE (${state.liveCount}/${SYMBOLS.length})` : (state.snapCount > 0 ? 'BRIEFING SNAPSHOT' : 'AWAITING DATA'); const sl = sentLabel(state.sentiment); $('sentChip').className = `chip ${sl.tone}`; $('sentTxt').textContent = sl.label; $('clkTxt').textContent = fmtClock(state.lastUpdate); }
  function renderCountdown() { const { wd, sec } = nyNow(), open = wd >= 1 && wd <= 5 && sec >= OPEN_S && sec < CLOSE_S; $('openCd').classList.toggle('open', open); $('cdLabel').textContent = open ? 'US MARKET CLOSES IN' : 'US MARKET OPENS IN'; $('cdClock').textContent = fmtDur(open ? CLOSE_S - sec : secsToNextOpen(wd, sec)); }
  function renderAll() { renderStatus(); renderWatchlist(); renderTF(); renderChart(); renderPred(); renderScore(); postHeight(); }

  // ---- briefing (bilingual) -----------------------------------
  const todayStr = () => new Date().toISOString().slice(0, 10);
  function briefingAcked() { try { return localStorage.getItem(BRIEF_KEY) === (state.news.date || todayStr()); } catch { return false; } }
  function ackBriefing() { try { localStorage.setItem(BRIEF_KEY, state.news.date || todayStr()); } catch {} }
  function buildBriefing() {
    const n = state.news, sl = sentLabel(state.sentiment), icon = { financial: '◇', industrial: '▣', political: '⬡', tech: '⊞' };
    const disclaimer = T(n.disclaimer_en || 'NOT INVESTMENT ADVICE — entertainment only.', n.disclaimer_zh || '非投资建议——仅供娱乐。');
    const note = T(n.predictionNote_en || '', n.predictionNote_zh || '');
    const items = n.items.map((it) => { const s = sentLabel(typeof it.sentiment === 'number' ? it.sentiment : scoreText(`${it.title_en || ''} ${it.summary_en || ''}`)); const title = T(it.title_en || it.title || '', it.title_zh || it.title_en || ''); const sum = T(it.summary_en || it.summary || '', it.summary_zh || it.summary_en || ''); return `<article class="bf-item"><div class="bf-itop"><span class="bf-cat">${icon[it.category] || '•'} ${it.category || 'note'}</span><span class="bf-sent ${s.tone}">${s.label}</span></div><h3 class="bf-title">${title}</h3>${sum ? `<p class="bf-sum">${sum}</p>` : ''}${it.source ? `<a class="bf-src" href="${it.url || '#'}" target="_blank" rel="noreferrer noopener">${it.source} ↗</a>` : ''}</article>`; }).join('');
    return `<div class="bf-backdrop" id="bfBackdrop"></div><div class="bf-modal" role="dialog" aria-modal="true" aria-labelledby="bfHeading" tabindex="-1" id="bfModal"><div class="bf-prog" id="bfProg" role="progressbar" aria-label="Reading progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0"><div class="bf-prog-fill" id="bfProgFill"></div></div><header class="bf-head"><div class="bf-barcode" aria-hidden="true"></div><div class="bf-htext"><p class="bf-kicker">TRAXUS//CVKM · ${T('DESK BRIEFING', '交易台简报')}</p><h2 class="bf-h" id="bfHeading">${T('Pre-Market Briefing', '盘前简报')}</h2><p class="bf-date">${n.date ? T('Digest', '摘要') + ' · ' + n.date : T('awaiting first run', '等待首次生成')} · ${T('sentiment', '情绪')} <b class="${sl.tone}">${sl.label}</b></p></div><button class="bf-lang" id="bfLang" aria-label="Toggle language">${state.lang === 'zh' ? 'EN' : '中文'}</button><button class="bf-x" id="bfClose" aria-label="Skip and close">✕</button></header><div class="bf-body" id="bfBody" tabindex="0"><div class="bf-warn" role="note"><b>⚠ ${T('NOT INVESTMENT ADVICE.', '非投资建议。')}</b> ${disclaimer}</div>${note ? `<p class="bf-note">${note}</p>` : ''}${items || `<div class="bf-empty">${T('No digest yet. The scheduled task writes it ~1h before the US open.', '暂无摘要。定时任务会在美股开盘前约 1 小时生成。')}</div>`}<div class="bf-end">— ${T('END OF BRIEFING', '简报结束')} —</div></div><footer class="bf-foot"><button class="bf-skip" id="bfSkip">${T('Skip', '跳过')}</button><button class="bf-enter" id="bfEnter" disabled>${T('SCROLL TO READ ▾', '请下滑阅读 ▾')}</button></footer></div>`;
  }
  function openBriefing() {
    const host = $('briefing'); if (!host) return; host.innerHTML = buildBriefing(); host.hidden = false; try { document.body.style.overflow = 'hidden'; } catch {}
    const body = $('bfBody'), fill = $('bfProgFill'), prog = $('bfProg'), enter = $('bfEnter'); let read = false;
    const update = () => { const max = body.scrollHeight - body.clientHeight, pct = max > 0 ? Math.min(100, (body.scrollTop / max) * 100) : 100; fill.style.width = pct + '%'; prog.setAttribute('aria-valuenow', Math.round(pct)); if (pct >= 96 && !read) { read = true; enter.disabled = false; enter.textContent = T('ENTER THE ARENA ▶', '进入 ARENA ▶'); } };
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
  function renderNews() { const host = $('newsList'), n = state.news; $('newsDate').textContent = n.date ? '· ' + n.date : ''; if (n.loading) { host.innerHTML = `<div class="empty">${T('Loading digest…', '加载中…')}</div>`; return; } if (!n.items.length) { host.innerHTML = `<div class="empty">${T('No digest yet.', '暂无摘要。')}</div>`; return; } const icon = { financial: '◇', industrial: '▣', political: '⬡', tech: '⊞' }; host.innerHTML = n.items.map((it) => { const s = sentLabel(typeof it.sentiment === 'number' ? it.sentiment : scoreText(`${it.title_en || ''} ${it.summary_en || ''}`)); const title = T(it.title_en || it.title || '', it.title_zh || it.title_en || ''); return `<a href="${it.url || '#'}" target="_blank" rel="noreferrer noopener"><div class="t1"><span class="cat">${icon[it.category] || '•'} ${it.category || ''}</span><span class="sent ${s.tone}">${s.label}</span></div><div class="ti">${title}</div></a>`; }).join(''); }
  function toggleLang() { if (window.AfflatusI18N) { window.AfflatusI18N.toggle(); return; } state.lang = state.lang === 'zh' ? 'en' : 'zh'; try { localStorage.setItem(LANG_KEY, state.lang); } catch {} renderNews(); renderPred(); }

  // ---- custom HUD cursor --------------------------------------
  function initCursor() {
    try {
      if (RM || EMBED) return; if (typeof document.createElement !== 'function') return; if (matchMedia('(pointer:coarse)').matches) return;
      const el = document.createElement('div'); el.className = 'fx-cursor'; el.innerHTML = '<i></i><i></i><i></i><i></i><span></span>'; document.body.appendChild(el); document.body.classList.add('has-cursor');
      addEventListener('pointermove', (e) => { el.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; }, { passive: true });
      addEventListener('pointerover', (e) => { const hot = e.target.closest && e.target.closest('button,a,.tk,.tf-b'); el.classList.toggle('hot', !!hot); });
      addEventListener('pointerdown', () => el.classList.add('down')); addEventListener('pointerup', () => el.classList.remove('down'));
    } catch {}
  }

  // ---- boot ---------------------------------------------------
  fetch(CONFIG.newsUrl, { cache: 'no-store' })
    .then((r) => r.ok ? r.json() : Promise.reject())
    .then((data) => { const items = (data.items || []).map((it) => ({ ...it, sentiment: typeof it.sentiment === 'number' ? it.sentiment : scoreText(`${it.title_en || it.title || ''} ${it.summary_en || it.summary || ''}`) })); state.news = { date: data.date || null, items, aiPredictions: data.aiPredictions || {}, prices: data.prices || {}, series: data.series || {}, disclaimer_en: data.disclaimer_en, disclaimer_zh: data.disclaimer_zh, predictionNote_en: data.predictionNote_en, predictionNote_zh: data.predictionNote_zh, loading: false }; state.sentiment = aggregateSentiment(items); poll(); })
    .catch(() => { state.news = { date: null, items: [], aiPredictions: {}, loading: false }; })
    .finally(() => { renderNews(); renderStatus(); renderPred(); if (!EMBED && !briefingAcked()) openBriefing(); });

  const tfRow = $('tfRow'); if (tfRow) tfRow.querySelectorAll('.tf-b').forEach((b) => b.addEventListener('click', () => { state.timeframe = b.dataset.tf; try { localStorage.setItem(TF_KEY, state.timeframe); } catch {} ensureHistory(state.selected, state.timeframe); renderTF(); renderChart(); }));
  ['ma', 'vol', 'macd', 'kdj'].forEach((k) => { const b = $({ ma: 'indMA', vol: 'indVOL', macd: 'indMACD', kdj: 'indKDJ' }[k]); if (b) b.addEventListener('click', () => { state.indicators[k] = !state.indicators[k]; saveInd(); renderChart(); }); });
  const cEl = $('cChart'); if (cEl) { cEl.addEventListener('pointermove', moveCross); cEl.addEventListener('pointerleave', hideCross); }
  const ob = $('openBriefBtn'); if (ob) ob.addEventListener('click', openBriefing);
  // language is owned by the shared i18n engine (.lang-toggle); arena re-renders on change
  window.addEventListener('afflatus-lang', (e) => { state.lang = e.detail === 'zh' ? 'zh' : 'en'; renderAll(); renderNews(); });
  $('refreshBtn').addEventListener('click', poll);
  $('resetBtn').addEventListener('click', resetScores);
  if (EMBED) { document.body.classList.add('embed'); window.addEventListener('resize', postHeight); setInterval(postHeight, 1200); }
  initCursor();
  renderAll(); renderNews(); renderCountdown();
  // adaptive polling — concentrate API budget around the US open; idle when closed
  function pollInterval() { const st = marketStatus(), n = nyNow(); if (st.state === 'open') return n.sec < OPEN_S + 3600 ? 9000 : 18000; if (st.state === 'pre') return 11000; if (st.state === 'post') return 20000; return 150000; }
  (function loop() { poll().finally(() => { setTimeout(loop, pollInterval()); }); })();
  setInterval(renderStatus, 15000);
  setInterval(renderCountdown, 1000);
  setTimeout(postHeight, 300); setTimeout(postHeight, 1500);
})();
