/* ============================================================
   ARENA · US STOCK TA DASHBOARD (V13) — watchlist + search + per-ticker
   technical analysis panel (key levels / MAs / pivots / special points).

   Data: real only — /api/history (Twelve Data daily candles, cached by the
   latest completed market session) + /api/quote (Finnhub live quote).
   All math lives in src/lib/technicals.js (pure, vitest-covered); this file
   only fetches, assembles and renders. NOT investment advice.
   ============================================================ */
import {
  analyzeTicker, normalizeDaily,
} from '../lib/technicals.js';
import { declutter1D, fitExtent } from '../lib/ladderLayout.js';
import { fetchJson, JsonDataError } from '../lib/fetchJson.js';
import {
  ARENA_PAGE_STATUS,
  createLatestSelectionPipeline,
  initialArenaPageState,
  isArenaAbort,
  reduceArenaPageState,
} from '../lib/arenaPageState.js';
import {
  lastCompletedMarketSession,
  readHistoryCache,
  readLatestHistoryCache,
  removeHistoryCache,
  writeHistoryCache,
} from '../lib/marketSession.js';

(() => {
  'use strict';
  const host = document.getElementById('taDash');
  if (!host) return;

  const $ = (id) => document.getElementById(id);
  // Part 4 (urgent.md §18.2.1/§21): arena-universe.json is the full S&P 500
  // (506 symbols), used for search only. The old curated 30-symbol watchlist
  // chip row has been replaced by the "Today's Recommended Trades" picks
  // board (arenaPicks.js), which dispatches an `arena-pick-select` CustomEvent
  // on card click — see the listener near the bottom of this file.
  const SYM_RE = /^[A-Za-z.\-]{1,12}$/;
  const BUCKET_LABEL = {
    'core-ai-hardware': ['AI HW', 'AI 硬件'],
    'megacap-tech': ['MEGACAP', '大盘科技'],
    'benchmark': ['ETF', '基准 ETF'],
  };
  function prettyBucket(bucket) {
    const words = String(bucket || '').split('-').filter(Boolean);
    return words.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') || bucket;
  }
  function bucketLabel(bucket) {
    return BUCKET_LABEL[bucket] || [prettyBucket(bucket), prettyBucket(bucket)];
  }

  // ---- state ---------------------------------------------------
  const state = {
    lang: (window.AfflatusI18N && window.AfflatusI18N.get && window.AfflatusI18N.get()) || 'en',
    universe: [],   // full market (search only) — public/arena-universe.json
    mode: defaultMode(),         // 'pre' | 'post'
    page: initialArenaPageState(),
  };
  const T = (en, zh) => (state.lang === 'zh' ? zh : en);
  const fmt = (x, d = 2) => (x == null || !isFinite(x) ? '—' : Number(x).toFixed(d));

  // ---- ET session helpers ---------------------------------------
  function etParts(d = new Date()) {
    const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' });
    const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, mins: (Number(p.hour) % 24) * 60 + Number(p.minute), wd: p.weekday };
  }
  function defaultMode() {
    const { mins } = etParts();
    return (mins >= 16 * 60 || mins < 4 * 60) ? 'post' : 'pre';
  }

  // ---- admin key (Part 4 §18.4/§20) --------------------------------
  // sessionStorage only (not localStorage) — the unlock is meant to last a
  // browser tab session, not persist forever on a shared/public machine.
  const ADMIN_KEY_STORAGE = 'afflatus:arenaKey';
  function getArenaKey() {
    try { return sessionStorage.getItem(ADMIN_KEY_STORAGE) || ''; } catch { return ''; }
  }
  function setArenaKey(k) {
    try {
      if (k) sessionStorage.setItem(ADMIN_KEY_STORAGE, k);
      else sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    } catch {}
    renderAdminChip();
  }
  function arenaKeyHeaders() {
    const k = getArenaKey();
    return k ? { 'x-arena-key': k } : {};
  }
  function renderAdminChip() {
    const chip = $('adminChip');
    if (chip) chip.hidden = !getArenaKey();
  }

  // ---- data ------------------------------------------------------
  class ArenaGateError extends Error {
    constructor(cause) {
      super('Arena live data is gated', { cause });
      this.name = 'ArenaGateError';
    }
  }
  function isGateError(error) {
    return error instanceof JsonDataError && error.status === 403;
  }
  function historyStorage() {
    try { return localStorage; } catch { return null; }
  }
  async function fetchHistory(sym, { signal, forceRefresh = false } = {}) {
    const expectedSession = lastCompletedMarketSession();
    const storage = historyStorage();
    const cached = !forceRefresh
      ? readHistoryCache(storage, sym, expectedSession)
      : null;
    if (cached) {
      return { candles: cached.candles, session: cached.session, source: 'cache' };
    }
    let j;
    try {
      // A missing session-key is a hard freshness boundary. Bypass fetchJson's
      // generic SWR layer so an older response can never be relabelled as the
      // newly completed market session.
      j = await fetchJson(`history:${sym}:1day:250`, {
        headers: arenaKeyHeaders(),
        signal,
        forceRefresh: true,
      });
    } catch (error) {
      if (isArenaAbort(error)) throw error;
      if (isGateError(error)) throw new ArenaGateError(error);
      const fallback = readLatestHistoryCache(storage, sym, expectedSession);
      if (fallback) {
        return {
          candles: fallback.candles,
          session: fallback.session,
          source: 'stale-cache',
          error,
        };
      }
      throw error;
    }
    const candles = j.values
      .map((v) => ({ t: String(v.datetime).slice(0, 10), o: +v.open, h: +v.high, l: +v.low, c: +v.close, v: +v.volume || 0 }))
      .filter((k) => isFinite(k.c) && k.c > 0)
      .reverse()
      // Daily providers may expose today's still-forming candle before the
      // close. It must never be persisted under a completed-session cache.
      .filter((candle) => candle.t <= expectedSession);
    if (candles.length < 21) throw new Error('history too short');
    const session = candles.at(-1).t;
    try { writeHistoryCache(storage, sym, session, candles); } catch {}
    return {
      candles,
      session,
      source: session < expectedSession ? 'stale-network' : 'network',
    };
  }
  async function fetchQuote(sym, { signal, forceRefresh = false } = {}) {
    return fetchJson(`quote:${sym}`, {
      headers: arenaKeyHeaders(),
      signal,
      forceRefresh,
    });
  }

  async function loadSelection({ sym, forceRefresh }, { signal }) {
    const [historyResult, quoteResult] = await Promise.allSettled([
      fetchHistory(sym, { signal, forceRefresh }),
      fetchQuote(sym, { signal, forceRefresh }),
    ]);
    if (signal.aborted) throw new DOMException('Arena selection aborted', 'AbortError');

    const errors = [historyResult, quoteResult]
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason);
    if (errors.some((error) => error instanceof ArenaGateError || isGateError(error))) {
      throw new ArenaGateError(errors.find((error) => error instanceof ArenaGateError || isGateError(error)));
    }
    if (historyResult.status === 'rejected') throw historyResult.reason;

    const history = historyResult.value;
    const quote = quoteResult.status === 'fulfilled' ? quoteResult.value : null;
    const quoteError = quoteResult.status === 'rejected' ? quoteResult.reason : null;
    if (isArenaAbort(quoteError)) throw quoteError;
    const { date, mins } = etParts();
    const candles = normalizeDaily(history.candles, {
      etDateStr: date,
      sessionComplete: mins >= 16 * 60,
    });
    return {
      sym,
      history,
      quote,
      quoteError,
      candles,
      analysis: analyzeTicker(candles, { price: quote ? quote.c : undefined }),
      fetchedAt: Date.now(),
    };
  }

  const selectionPipeline = createLatestSelectionPipeline(loadSelection, {
    onStart(input, requestId) {
      state.page = reduceArenaPageState(state.page, {
        type: 'select',
        requestId,
        sym: input.sym,
      });
      renderPanel();
    },
    onResolve(result, _input, requestId) {
      state.page = reduceArenaPageState(state.page, {
        type: 'resolve',
        requestId,
        result,
      });
      renderPanel();
    },
    onReject(error, _input, requestId) {
      state.page = reduceArenaPageState(state.page, error instanceof ArenaGateError
        ? {
          type: 'gated',
          requestId,
          error,
          keyRejected: Boolean(getArenaKey()),
        }
        : { type: 'error', requestId, error });
      renderPanel();
    },
  });

  function select(rawSymbol, options = {}) {
    const sym = String(rawSymbol || '').trim().toUpperCase();
    if (!SYM_RE.test(sym)) return Promise.resolve(null);
    return selectionPipeline.run({
      sym,
      forceRefresh: Boolean(options.forceRefresh),
    }).catch((error) => {
      if (isArenaAbort(error)) return null;
      // The state transition and user-facing render happen in onReject.
      return null;
    });
  }

  function clearHistory(sym) {
    try { removeHistoryCache(historyStorage(), sym); } catch {}
  }

  // ---- search ------------------------------------------------------
  function searchMatches(qRaw) {
    const q = qRaw.trim().toLowerCase();
    if (!q) return [];
    return state.universe
      .filter((u) => u.sym.toLowerCase().includes(q) || u.name.toLowerCase().includes(q))
      .slice(0, 8);
  }
  function renderSuggest(list, raw) {
    const el = $('taSuggest');
    const rows = list.map((u) => `<button class="ta-sg" data-sym="${u.sym}"><b>${u.sym}</b> ${u.name} <i>${T(...bucketLabel(u.bucket))}</i></button>`);
    const rawUp = raw.trim().toUpperCase();
    if (rawUp && SYM_RE.test(rawUp) && !list.some((u) => u.sym === rawUp)) {
      rows.push(`<button class="ta-sg ta-sg--raw" data-sym="${rawUp}">${T('Load ticker', '直接加载')} <b>${rawUp}</b> ↵</button>`);
    }
    el.innerHTML = rows.join('');
    el.hidden = rows.length === 0;
    el.querySelectorAll('.ta-sg').forEach((b) => b.addEventListener('click', () => { hideSuggest(); $('taSearch').value = ''; select(b.dataset.sym); }));
  }
  function hideSuggest() { const el = $('taSuggest'); el.hidden = true; el.innerHTML = ''; }

  // ---- panel rendering --------------------------------------------
  const LIMIT_TAG = () => `<span class="ta-limit">${T('LIMIT ZONE', '限价参考区')}</span>`;
  const PIVOT_NAMES = { r3: 'R3', r2: 'R2', r1: 'R1', pp: 'PP', s1: 'S1', s2: 'S2', s3: 'S3' };

  function levelRows(analysis) {
    // Everything the ladder shows, tagged with kind + zone flags.
    const p = analysis.price;
    const piv = analysis.pivots[state.mode];
    const rows = [];
    for (const k of Object.keys(PIVOT_NAMES)) rows.push({ kind: 'pivot', name: PIVOT_NAMES[k], level: piv[k], cls: k === 'pp' ? 'pp' : (k[0] === 'r' ? 'res' : 'sup') });
    analysis.swings.resistances.slice(0, 3).forEach((x, i) => rows.push({ kind: 'swing', name: `${T('High', '前高')}${i ? ' ' + (i + 1) : ''}·${x.touches}×`, level: x.level, cls: 'res' }));
    analysis.swings.supports.slice(0, 3).forEach((x, i) => rows.push({ kind: 'swing', name: `${T('Low', '前低')}${i ? ' ' + (i + 1) : ''}·${x.touches}×`, level: x.level, cls: 'sup', limit: true }));
    analysis.rounds.above.forEach((x) => rows.push({ kind: 'round', name: '$' + x.level, level: x.level, cls: 'round', weight: x.weight }));
    analysis.rounds.below.forEach((x) => rows.push({ kind: 'round', name: '$' + x.level, level: x.level, cls: 'round', weight: x.weight, limit: true }));
    analysis.ma.forEach((m) => { if (m.value != null) rows.push({ kind: 'ma', name: 'MA' + m.n, level: m.value, cls: 'ma' }); });
    analysis.breakouts.slice(0, 2).forEach((b) => rows.push({ kind: 'breakout', name: T('Breakout', '突破位'), level: b.level, cls: b.status === 'holding' ? 'sup' : 'res', limit: b.status === 'holding' }));
    return rows.filter((r) => r.level != null && isFinite(r.level) && Math.abs(r.level - p) / p <= 0.15);
  }

  // Level Ladder rendering. The screenshot bug (dense clusters of prices
  // stacking their price-number + name-tag labels directly on top of each
  // other, left axis AND right tags both) came from doing collision-avoidance
  // only on the right-side tag (a weak 2-column alternation) with a threshold
  // in % of container height that had nothing to do with real pixel text
  // size. Fix: separate the TRUE price position (where the tick line and
  // background bands live — always accurate) from the LABEL position (price
  // number + name tag, decluttered in real px via declutter1D so no two
  // labels can ever be closer than minGap); when a label's decluttered spot
  // differs from its true line, a short leader dash connects them. The
  // container height grows (via fitExtent) instead of compressing labels
  // illegibly when many levels cluster close together.
  const LAD_H0 = 560;       // nominal ladder height (px); grows if labels don't fit
  const LAD_MIN_GAP = 16;   // px — enough for one line of label text + padding
  function renderLadder(analysis) {
    const p = analysis.price;
    const rows = levelRows(analysis);
    const gaps = analysis.gaps.filter((g) => g.status !== 'filled').slice(0, 3)
      .filter((g) => Math.abs((g.top + g.bottom) / 2 - p) / p <= 0.15);
    const lo = Math.min(p, ...rows.map((r) => r.level), ...gaps.map((g) => g.bottom)) * 0.995;
    const hi = Math.max(p, ...rows.map((r) => r.level), ...gaps.map((g) => g.top)) * 1.005;
    const Y = (v) => ((hi - v) / (hi - lo)) * LAD_H0;

    // ---- unified declutter pool: every row label + gap label + price label
    // + (POST) day-H/day-L labels, all competing for vertical space together ----
    const items = [];
    rows.forEach((r) => items.push({ kind: 'row', ref: r, trueY: Y(r.level) }));
    gaps.forEach((g) => items.push({ kind: 'gap', ref: g, trueY: Y(g.top) }));
    items.push({ kind: 'price', trueY: Y(p) });
    if (state.mode === 'post') {
      items.push({ kind: 'sessH', trueY: Y(analysis.last.h) });
      items.push({ kind: 'sessL', trueY: Y(analysis.last.l) });
    }
    const declutteredYs = declutter1D(items.map((it) => it.trueY), { minGap: LAD_MIN_GAP });
    items.forEach((it, i) => { it.y = declutteredYs[i]; });
    const { offset, size } = fitExtent(declutteredYs, LAD_H0, { padTop: 10, padBottom: 14 });
    const shift = (y) => y + offset;
    const leader = (cls, trueY, labelY) => Math.abs(labelY - trueY) > 3
      ? `<i class="lad-leader ${cls}" style="top:${Math.min(trueY, labelY).toFixed(1)}px;height:${Math.abs(labelY - trueY).toFixed(1)}px"></i>` : '';

    // ---- background bands: always at the TRUE position, never decluttered ----
    const gapBandsHtml = gaps.map((g) => {
      const yTop = shift(Y(g.top)), yBot = shift(Y(g.bottom));
      return `<div class="lad-gap ${g.dir}" style="top:${yTop.toFixed(1)}px;height:${Math.max(2, yBot - yTop).toFixed(1)}px"></div>`;
    }).join('');
    const zoneBandsHtml = rows.filter((r) => r.limit).map((r) => `<div class="lad-zone" style="top:${shift(Y(r.level)).toFixed(1)}px"></div>`).join('');

    // ---- level lines (true position) + labels (decluttered position) ----
    let rowsHtml = '';
    items.filter((it) => it.kind === 'row').forEach((it) => {
      const r = it.ref, trueY = shift(it.trueY), labelY = shift(it.y);
      rowsHtml += `<div class="lad-lv ${r.cls} k-${r.kind} ${r.weight || ''}" style="top:${trueY.toFixed(1)}px"></div>`
        + leader(r.cls, trueY, labelY)
        + `<div class="lad-lab ${r.cls}" style="top:${labelY.toFixed(1)}px"><em>${fmt(r.level)}</em><span>${r.name}${r.limit ? LIMIT_TAG() : ''}</span></div>`;
    });

    // ---- gap text pills (decluttered, left-anchored) ----
    let gapLabelsHtml = '';
    items.filter((it) => it.kind === 'gap').forEach((it) => {
      const g = it.ref, labelY = shift(it.y);
      gapLabelsHtml += `<div class="lad-gaplab ${g.dir}" style="top:${labelY.toFixed(1)}px">${T('gap', '缺口')} ${g.dir === 'up' ? '↑' : '↓'} ${g.status === 'partial' ? T('(partial)', '(部分回补)') : ''}</div>`;
    });

    // ---- current price: true full-width line + decluttered tag ----
    const priceItem = items.find((it) => it.kind === 'price');
    const priceTrueY = shift(priceItem.trueY), priceLabelY = shift(priceItem.y);
    const priceHtml = `<div class="lad-px-line" style="top:${priceTrueY.toFixed(1)}px"></div>`
      + leader('price', priceTrueY, priceLabelY)
      + `<div class="lad-px" style="top:${priceLabelY.toFixed(1)}px"><b>$${fmt(p)}</b></div>`;

    // ---- POST mode: day high/low, same true-line + decluttered-label split ----
    let sessHtml = '';
    if (state.mode === 'post') {
      const h = items.find((it) => it.kind === 'sessH'), l = items.find((it) => it.kind === 'sessL');
      const hTrue = shift(h.trueY), hLab = shift(h.y), lTrue = shift(l.trueY), lLab = shift(l.y);
      sessHtml += `<div class="lad-sess-line" style="top:${hTrue.toFixed(1)}px"></div>${leader('sess', hTrue, hLab)}<div class="lad-sess" style="top:${hLab.toFixed(1)}px">${T('DAY H', '日高')} ${fmt(analysis.last.h)}</div>`;
      sessHtml += `<div class="lad-sess-line lo" style="top:${lTrue.toFixed(1)}px"></div>${leader('sess', lTrue, lLab)}<div class="lad-sess" style="top:${lLab.toFixed(1)}px">${T('DAY L', '日低')} ${fmt(analysis.last.l)}</div>`;
    }

    const ladder = $('taLadder');
    ladder.style.height = size.toFixed(0) + 'px';
    ladder.innerHTML = `${gapBandsHtml}${zoneBandsHtml}${rowsHtml}${gapLabelsHtml}${sessHtml}${priceHtml}`;
  }

  function keyLevelCard(a) {
    const dist = (lvl) => `<i class="${lvl <= a.price ? 'up' : 'down'}">${fmt(((lvl - a.price) / a.price) * 100, 1)}%</i>`;
    const res = a.swings.resistances.slice(0, 3).map((x) => `<div class="ta-row res"><span>${T('Prior high', '前高')} · ${x.touches}${T('×', ' 次')}</span><b>$${fmt(x.level)}</b>${dist(x.level)}</div>`).join('');
    const sup = a.swings.supports.slice(0, 3).map((x) => `<div class="ta-row sup"><span>${T('Prior low', '前低')} · ${x.touches}${T('×', ' 次')}${LIMIT_TAG()}</span><b>$${fmt(x.level)}</b>${dist(x.level)}</div>`).join('');
    const rounds = [...a.rounds.above, ...a.rounds.below].sort((x, y) => y.level - x.level)
      .map((x) => `<div class="ta-row round"><span>${T('Round number', '整数关口')}${x.weight === 'major' ? ' ★' : ''}${x.level < a.price ? LIMIT_TAG() : ''}</span><b>$${fmt(x.level)}</b>${dist(x.level)}</div>`).join('');
    return `<article class="ta-card"><h3>${T('PRICE STRUCTURE · KEY LEVELS', '价格结构 · 关键价位')}</h3>
      ${res || `<div class="ta-none">${T('No swing high nearby', '附近无摆动前高')}</div>`}
      <div class="ta-px-divider"><span>$${fmt(a.price)}</span></div>
      ${sup || `<div class="ta-none">${T('No swing low nearby', '附近无摆动前低')}</div>`}
      <div class="ta-sub">${T('Psychological levels', '心理关口')}</div>${rounds}
      <details class="ta-method"><summary>${T('method', '算法说明')}</summary>${T('Swing highs/lows: fractal pivots (3 bars each side) over the last 120 sessions, clustered within 1.2%; ×N = touch count. Breaking below a support weakens the trend; breaking above a resistance strengthens it. Supports and round numbers below price are flagged as limit-order reference zones.', '摆动前高/前低：最近 120 个交易日的分形拐点（左右各 3 根K线），1.2% 以内聚类；×N 为触碰次数。跌破支撑=趋势转弱，突破阻力=趋势转强。价格下方的支撑与整数关口标记为限价单参考区。')}</details></article>`;
  }

  function maCard(a) {
    const label = { 5: ['short · defense', '短线防守'], 10: ['short · defense', '短线防守'], 20: ['swing lifeline', '波段生命线'], 60: ['bull/bear line', '牛熊线'], 200: ['bull/bear line', '牛熊线'] };
    const rows = a.ma.map((m) => {
      if (m.value == null) return `<div class="ta-row"><span>MA${m.n}</span><b>—</b><i class="mut">${T('not enough data', '数据不足')}</i></div>`;
      const pos = m.pricePos === 'above';
      const slope = m.slope === 'up' ? '↗' : m.slope === 'down' ? '↘' : '→';
      return `<div class="ta-row ${pos ? 'sup' : 'res'}"><span><i class="ma-n">MA${m.n}</i><i class="mut">${T(...label[m.n])}</i></span><b>$${fmt(m.value)} ${slope}</b><i class="${pos ? 'up' : 'down'}">${pos ? T('above', '价上') : T('below', '价下')} ${fmt(Math.abs(m.distPct), 1)}%</i></div>`;
    }).join('');
    const vals = a.ma.filter((m) => m.value != null);
    const stacked = vals.length >= 3 && vals.every((m, i) => i === 0 || m.value <= vals[i - 1].value * 1.0001);
    const inv = vals.length >= 3 && vals.every((m, i) => i === 0 || m.value >= vals[i - 1].value * 0.9999);
    const verdict = stacked ? `<div class="ta-verdict up">▲ ${T('Bullish stack (5>10>20>60>200)', '多头排列（5>10>20>60>200）')}</div>`
      : inv ? `<div class="ta-verdict down">▼ ${T('Bearish stack', '空头排列')}</div>`
        : `<div class="ta-verdict mut">◆ ${T('Mixed stack', '均线缠绕')}</div>`;
    return `<article class="ta-card"><h3>${T('MOVING AVERAGES · TREND', '均线系统 · 趋势')}</h3>${rows}${verdict}
      <details class="ta-method"><summary>${T('method', '算法说明')}</summary>${T('Simple MAs of daily closes. 5/10MA: short-term defense for momentum trades; 20MA: swing lifeline — pullbacks that hold it are add-on points; 60/200MA: bull/bear dividing line. Arrow = slope over the last 3 sessions.', '日收盘价简单均线。5/10MA：短线/动量股防守线；20MA：波段生命线——回踩不破常是加仓点；60/200MA：牛熊分界。箭头为最近 3 个交易日的斜率。')}</details></article>`;
  }

  function pivotCard(a) {
    const piv = a.pivots[state.mode];
    const review = state.mode === 'post' ? Object.fromEntries(a.postReview.map((x) => [x.name, x])) : null;
    const rows = Object.keys(PIVOT_NAMES).map((k) => {
      const lvl = piv[k];
      const isPP = k === 'pp';
      const cls = isPP ? 'pp' : k[0] === 'r' ? 'res' : 'sup';
      let tag = '';
      if (review) {
        const rv = review[k];
        if (rv.touched) tag = `<i class="${rv.closedAbove ? 'up' : 'down'}">${rv.closedAbove ? T('tested · closed above', '触及 · 收于其上') : T('tested · closed below', '触及 · 收于其下')}</i>`;
        else tag = `<i class="mut">${T('untested', '未触及')}</i>`;
      } else {
        tag = `<i class="${lvl <= a.price ? 'up' : 'down'}">${fmt(((lvl - a.price) / a.price) * 100, 1)}%</i>`;
      }
      return `<div class="ta-row ${cls} ${isPP ? 'ta-pp' : ''}"><span>${PIVOT_NAMES[k]}${k[0] === 's' && !review ? LIMIT_TAG() : ''}</span><b>$${fmt(lvl)}</b>${tag}</div>`;
    }).join('');
    const src = state.mode === 'pre'
      ? T(`from last completed session (${a.last.t})`, `基于最近一根完整日K（${a.last.t}）`)
      : T(`plan from ${a.prev.t}, reviewed against ${a.last.t}`, `${a.prev.t} 计划位 · 复盘 ${a.last.t} 实际走势`);
    return `<article class="ta-card"><h3>${T('PIVOT POINTS', '枢轴点系统')} <small>${src}</small></h3>${rows}
      <details class="ta-method"><summary>${T('method', '算法说明')}</summary>${T('Classic floor-trader pivots from the reference day\'s H/L/C: PP=(H+L+C)/3, R1=2PP−L, S1=2PP−H, R2=PP+(H−L), S2=PP−(H−L), R3=H+2(PP−L), S3=L−2(H−PP). Breaking R-levels on volume = momentum; S-levels are pullback-buy zones. POST view shows which levels the last session actually tested.', '经典枢轴点，基于参考日高/低/收：PP=(H+L+C)/3，R1=2PP−L，S1=2PP−H，R2=PP+(H−L)，S2=PP−(H−L)，R3=H+2(PP−L)，S3=L−2(H−PP)。放量突破 R 系=动能强；S 系为回调买入参考区。盘后视图显示昨日实际触碰/突破了哪些位。')}</details></article>`;
  }

  function specialCard(a) {
    const bks = a.breakouts.slice(0, 2).map((b) => `<div class="ta-row ${b.status === 'holding' ? 'sup' : 'res'}"><span>${T('Breakout', '突破位')} · ${b.date}${b.volConfirmed ? ' <i class="up">' + T('vol✓', '放量✓') + '</i>' : ''}${b.status === 'holding' ? LIMIT_TAG() : ''}</span><b>$${fmt(b.level)}</b><i class="${b.status === 'holding' ? 'up' : 'down'}">${b.status === 'holding' ? T('holding', '守住') : T('lost', '失守')}</i></div>`).join('');
    const gaps = a.gaps.slice(0, 4).map((g) => `<div class="ta-row ${g.dir === 'up' ? 'sup' : 'res'}"><span>${g.dir === 'up' ? T('Gap ↑', '向上缺口') : T('Gap ↓', '向下缺口')} · ${g.date}</span><b>$${fmt(g.bottom)}–${fmt(g.top)}</b><i class="${g.status === 'open' ? (g.dir === 'up' ? 'up' : 'down') : 'mut'}">${g.status === 'open' ? T('unfilled', '未回补') : g.status === 'partial' ? T('partial', '部分回补') : T('filled', '已回补')}</i></div>`).join('');
    return `<article class="ta-card"><h3>${T('HISTORICAL SPECIAL POINTS', '历史特殊点位')}</h3>
      <div class="ta-sub">${T('Consolidation breakouts', '平台突破')}</div>${bks || `<div class="ta-none">${T('No box breakout in the last 120 sessions', '最近 120 个交易日无平台突破')}</div>`}
      <div class="ta-sub">${T('Gaps (support/resistance until filled)', '缺口（回补前构成强支撑/阻力）')}</div>${gaps || `<div class="ta-none">${T('No significant gaps', '无显著缺口')}</div>`}
      <details class="ta-method"><summary>${T('method', '算法说明')}</summary>${T('Breakout: close above a ≤7%-range 20-bar box; "vol✓" when breakout volume >1.5× box average. A pullback that holds the breakout level is a classic buy signal — "lost" means price closed back below it. Gaps: daily bars whose range never overlaps the prior bar (≥0.5%); unfilled gaps act as strong support (up-gaps) or resistance (down-gaps).', '突破：收盘突破 20 根K线、总振幅≤7% 的横盘箱体；突破日成交量 >1.5× 箱体均量记「放量✓」。回踩突破位不破为经典买点——「失守」即收盘跌回位下。缺口：与前一日K线完全不重叠（≥0.5%）；未回补的向上缺口构成强支撑、向下缺口构成强阻力。')}</details></article>`;
  }

  function renderPanel() {
    const el = $('taPanel');
    const page = state.page;
    const sym = page.sym;
    el.dataset.arenaState = page.status;
    el.setAttribute('aria-busy', String(page.status === ARENA_PAGE_STATUS.LOADING));
    if (!sym) {
      el.innerHTML = `<div class="ta-empty">${T('Search a ticker above to load its latest available daily candles.', '在上方搜索代码，以加载最近可用的日K数据。')}</div>`;
      return;
    }
    if (page.status === ARENA_PAGE_STATUS.LOADING) {
      el.innerHTML = `<div class="ta-empty" role="status" aria-live="polite"><span class="ta-spin"></span>${T('Loading daily candles for', '正在加载日K数据')} ${sym}…</div>`;
      return;
    }
    const d = page.data;
    if (page.status === ARENA_PAGE_STATUS.GATED) {
      const msg = page.keyRejected
        ? T('That admin key was not accepted.', '该管理员密钥未通过验证。')
        : T('Live quotes are limited to symbols in the latest published snapshot.', '实时报价目前仅覆盖最近一次发布快照中的标的。');
      el.innerHTML = `<div class="ta-empty err gated" role="status">
        <div>🔒 ${sym} ${T('is outside the latest published live-data pool.', '不在最近一次发布的实时数据名单内。')} ${msg}</div>
        <form class="ta-unlock" id="taUnlockForm">
          <input type="password" id="taUnlockInput" autocomplete="off" placeholder="${T('Admin key', '管理员密钥')}" aria-label="${T('Admin key', '管理员密钥')}">
          <button type="submit" class="btn">${T('Unlock', '解锁')}</button>
        </form>
      </div>`;
      const form = $('taUnlockForm');
      if (form) form.addEventListener('submit', (e) => {
        e.preventDefault();
        const val = ($('taUnlockInput').value || '').trim();
        if (val) { setArenaKey(val); select(sym, { forceRefresh: true }); }
      });
      return;
    }
    if (page.status === ARENA_PAGE_STATUS.ERROR || !d || !d.analysis) {
      el.innerHTML = `<div class="ta-empty err" role="alert">${T('Could not load', '加载失败')} ${sym} — ${T('check the ticker or try again in a moment.', '请确认代码是否正确，或稍后重试。')}</div>`;
      return;
    }
    const a = d.analysis;
    const u = state.universe.find((x) => x.sym === sym);
    const q = d.quote;
    const chg = q ? q.c - q.pc : a.last.c - a.prev.c;
    const chgPct = q ? (q.pc ? (chg / q.pc) * 100 : 0) : ((a.last.c - a.prev.c) / a.prev.c) * 100;
    const up = chg >= 0;
    const stateNotice = page.status === ARENA_PAGE_STATUS.STALE
      ? `<p class="ta-state-note stale" role="status">${T(
        `Latest completed session unavailable — showing history through ${d.history.session}.`,
        `最近完整交易日数据不可用——当前显示截至 ${d.history.session} 的历史记录。`,
      )}</p>`
      : page.status === ARENA_PAGE_STATUS.PARTIAL
        ? `<p class="ta-state-note partial" role="status">${T(
          'Live quote unavailable — analysis uses the latest completed daily close.',
          '实时报价不可用——分析暂以最近完整交易日收盘价为准。',
        )}</p>`
        : '';
    el.innerHTML = `
      ${stateNotice}
      <div class="ta-head">
        <div class="ta-id"><b>${sym}</b><span>${u ? u.name : ''}</span><i class="ta-src ${page.status}">${page.status === ARENA_PAGE_STATUS.STALE ? T('STALE', '陈旧') : q ? 'LIVE' : T('EOD', '日线收盘')}</i></div>
        <div class="ta-quote ${up ? 'up' : 'down'}"><b>$${fmt(a.price)}</b><span>${up ? '▲' : '▼'} ${fmt(Math.abs(chg))} (${fmt(Math.abs(chgPct))}%)</span></div>
        <div class="ta-modes" role="tablist">
          <button class="ta-mode ${state.mode === 'pre' ? 'on' : ''}" data-m="pre" role="tab" aria-selected="${state.mode === 'pre'}">${T('PRE-MARKET', '盘前')}<i>${T('plan · next session', '计划 · 下一交易日')}</i></button>
          <button class="ta-mode ${state.mode === 'post' ? 'on' : ''}" data-m="post" role="tab" aria-selected="${state.mode === 'post'}">${T('POST-MARKET', '盘后')}<i>${T('review · last session', '复盘 · 最近交易日')}</i></button>
        </div>
        <button class="btn ta-refresh" id="taRefresh">${T('Refresh', '刷新')}</button>
      </div>
      <div class="ta-body">
        <div class="ta-ladwrap">
          <div class="sec-label">${T('LEVEL LADDER', '价位标尺')}</div>
          <div class="ta-ladder" id="taLadder" role="img" aria-label="${T('All key levels on one price scale', '同一价格轴上的全部关键位')}"></div>
          <div class="ta-legend">
            <span class="lg res">${T('resistance', '阻力')}</span><span class="lg sup">${T('support', '支撑')}</span><span class="lg pp">PP</span><span class="lg ma">MA</span><span class="lg zone">${T('limit zone', '限价参考区')}</span><span class="lg gap">${T('gap', '缺口')}</span>
          </div>
        </div>
        <div class="ta-cards">${keyLevelCard(a)}${maCard(a)}${pivotCard(a)}${specialCard(a)}</div>
      </div>
      <p class="ta-note">${T('Levels are mechanical references computed from public daily data — context (earnings, news, liquidity) decides whether they matter. Not investment advice.', '以上价位均为公开日线数据的机械计算参考——是否有效取决于财报、新闻与流动性等上下文。非投资建议。')}</p>`;
    el.querySelectorAll('.ta-mode').forEach((b) => b.addEventListener('click', () => { state.mode = b.dataset.m; renderPanel(); }));
    const rf = $('taRefresh');
    if (rf) rf.addEventListener('click', () => {
      clearHistory(sym);
      select(sym, { forceRefresh: true });
    });
    renderLadder(a);
  }

  // ---- boot -------------------------------------------------------
  renderPanel();
  renderAdminChip();
  const adminChipEl = $('adminChip');
  if (adminChipEl) adminChipEl.addEventListener('click', () => {
    if (getArenaKey() && confirm(T('Clear the admin key?', '清除管理员密钥？'))) {
      setArenaKey('');
      if (state.page.sym) select(state.page.sym, { forceRefresh: true });
    }
  });

  fetchJson('arena-universe').catch(() => null)
    .then((universeJson) => {
      state.universe = ((universeJson && universeJson.symbols) || []).map((s) => ({ sym: s.sym, name: s.name, bucket: s.bucket }));
    }).finally(() => {
      renderPanel();
    });

  // Part 4 (urgent.md §18.2.1): the picks board (arenaPicks.js) dispatches
  // this on card click/Enter instead of calling into this module directly —
  // the two files are independent IIFEs (same pattern as `afflatus-lang`).
  window.addEventListener('arena-pick-select', (e) => {
    if (e && e.detail && e.detail.sym) select(e.detail.sym);
  });

  const search = $('taSearch');
  search.addEventListener('input', () => renderSuggest(searchMatches(search.value), search.value));
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { hideSuggest(); search.blur(); return; }
    if (e.key === 'Enter') {
      const list = searchMatches(search.value);
      const rawSymbol = search.value.trim().toUpperCase();
      const exact = list.find((item) => item.sym === rawSymbol);
      const sym = exact ? exact.sym : list.length ? list[0].sym : rawSymbol;
      if (sym && SYM_RE.test(sym)) { hideSuggest(); search.value = ''; select(sym); }
    }
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.ta-searchwrap')) hideSuggest(); });
  window.addEventListener('afflatus-lang', (e) => { state.lang = e.detail === 'zh' ? 'zh' : 'en'; renderPanel(); });
  // A BFCache-restored document may leave more than once. Keep this listener
  // alive so every pagehide cancels the active generation.
  window.addEventListener('pagehide', () => selectionPipeline.cancel());
  window.addEventListener('pageshow', (event) => {
    if (
      event.persisted
      && state.page.status === ARENA_PAGE_STATUS.LOADING
      && state.page.sym
    ) {
      select(state.page.sym, { forceRefresh: true });
    }
  });
})();
