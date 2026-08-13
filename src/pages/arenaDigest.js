/* ============================================================
   ARENA · DAILY DIGEST TOAST + DRAWER — "while you were away" (Part 4
   urgent.md §19.4.3/§19.4.4, new 2026-07-23)

   Compares public/arena-daily-digest.json's `date` against the last digest
   date this browser has already seen (localStorage). An unseen digest
   shows a quiet toast ("3 trades settled while you were away · P +0.8%");
   clicking it (or the toast itself) opens a drawer with the full per-book
   breakdown, tomorrow's picks count, and a "delayed" section when the
   pipeline had queued/offline runs that day (§19.4.4 — the queue must be
   visible, not silent). Dismissing the toast OR opening the drawer both
   mark the digest as seen — re-showing the same day's digest every reload
   would just be noise.

   Read-only, like arenaPicks.js: never mutates any ledger/digest file.
   ============================================================ */
import { fetchJson } from '../lib/fetchJson.js';
import { escapeHtml } from '../lib/contentSafety.js';
import { ARENA_PUBLICATION_MINUTES, assessMarketSnapshot } from '../lib/marketFreshness.js';

(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const toast = $('digestToast');
  const drawer = $('digestDrawer');
  if (!toast || !drawer) return;

  const SEEN_KEY = 'afflatus:arenaDigestSeen';

  const MODEL_LABEL = { S: 'S · ORACLE', P: 'P · PULSE', T: 'T · ATLAS' };

  const state = {
    lang: (window.AfflatusI18N && window.AfflatusI18N.get && window.AfflatusI18N.get()) || 'en',
    digest: null,
  };
  const T = (en, zh) => (state.lang === 'zh' ? zh : en);
  const fmtPct = (x) => (x == null || !isFinite(x) ? '—' : `${x >= 0 ? '+' : ''}${x.toFixed(1)}%`);

  function getSeen() {
    try { return localStorage.getItem(SEEN_KEY) || ''; } catch { return ''; }
  }
  function setSeen(dateStr) {
    try { localStorage.setItem(SEEN_KEY, dateStr); } catch {}
  }

  function toastSummary(d) {
    const reported = (d.earnings || []).filter((item) => item.status === 'reported');
    if (reported.length) {
      const symbols = [...new Set(reported.map((item) => item.symbol))].join('/');
      return T(
        `${reported.length} official earnings update(s) added · ${symbols}`,
        `新增 ${reported.length} 条官方财报更新 · ${symbols}`,
      );
    }
    const totalTrades = d.books.reduce((s, b) => s + (b.tradesCount || 0), 0);
    const standout = d.books.slice().sort((a, b) => Math.abs(b.pnlPct) - Math.abs(a.pnlPct))[0];
    const tradeWord = totalTrades === 1 ? T('trade', '笔交易') : T('trades', '笔交易');
    return T(
      `${totalTrades} ${tradeWord} settled while you were away · ${standout.model} ${fmtPct(standout.pnlPct)}`,
      `你不在时结算了 ${totalTrades} ${tradeWord} · ${standout.model} ${fmtPct(standout.pnlPct)}`,
    );
  }

  function bookRow(b) {
    const cls = b.pnlPct > 0 ? 'up' : b.pnlPct < 0 ? 'down' : '';
    return `<div class="digest-book">
      <div class="digest-book-hd"><span class="digest-book-model">${escapeHtml(MODEL_LABEL[b.model] || b.model)}</span><span class="digest-book-pnl ${cls}">${fmtPct(b.pnlPct)}</span></div>
      <div class="digest-book-meta">${b.tradesCount} ${b.tradesCount === 1 ? T('trade', '笔交易') : T('trades', '笔交易')}</div>
      <p class="digest-book-note">${escapeHtml(T(b.note_en, b.note_zh) || '')}</p>
    </div>`;
  }

  function delayedSection(delayed) {
    if (!delayed || !delayed.length) return '';
    const rows = delayed.map((x) => `<li>${escapeHtml(x.date || '')} · ${escapeHtml(x.window || '')} · ${escapeHtml(x.model || '')} — ${escapeHtml(T(x.note_en, x.note_zh) || x.note || '')}</li>`).join('');
    return `<div class="digest-delayed">
      <div class="digest-delayed-hd">⏳ ${T('Delayed (queued while offline)', '延迟（离线期间排队）')}</div>
      <ul class="digest-delayed-list">${rows}</ul>
    </div>`;
  }

  function earningsSection(earnings) {
    if (!earnings || !earnings.length) return '';
    const rows = earnings.map((x) => `<li><a href="${escapeHtml(x.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(x.symbol)} · ${escapeHtml(T(x.headline_en, x.headline_zh))}</a><br><span>${escapeHtml(T(x.summary_en, x.summary_zh))}</span></li>`).join('');
    return `<div class="digest-delayed digest-earnings">
      <div class="digest-delayed-hd">◫ ${T('Earnings watch', '财报追踪')}</div>
      <ul class="digest-delayed-list">${rows}</ul>
    </div>`;
  }

  function renderDrawer(d) {
    $('digestDrawerDate').textContent = d.date || '—';
    $('digestDrawerBody').innerHTML = `
      <p class="digest-note">${escapeHtml(T(d.note_en, d.note_zh) || '')}</p>
      <div class="digest-books">${d.books.map(bookRow).join('')}</div>
      ${earningsSection(d.earnings)}
      ${delayedSection(d.delayed)}
      <p class="digest-tomorrow">${T('Tomorrow', '明日')}: ${d.tomorrowPicksCount} ${T('new pick(s) queued', '条新推荐待发布')}</p>
    `;
  }

  function openDrawer() {
    if (!state.digest) return;
    renderDrawer(state.digest);
    drawer.hidden = false;
    hideToast();
    setSeen(state.digest.generatedAt || state.digest.date);
  }
  function closeDrawer() { drawer.hidden = true; }

  function hideToast() { toast.hidden = true; }
  function showToast(d) {
    $('digestToastBody').textContent = toastSummary(d);
    toast.hidden = false;
  }

  function render() {
    const d = state.digest;
    if (!d || !d.date) return;
    const freshness = assessMarketSnapshot(d.date, new Date(), { availableFromMinutes: ARENA_PUBLICATION_MINUTES.postMarket });
    if (freshness.stale) {
      hideToast();
      return; // Historical digests remain in the data archive but never masquerade as a new notification.
    }
    if (getSeen() === (d.generatedAt || d.date)) return; // already seen this exact digest revision
    showToast(d);
  }

  fetchJson('arena-digest')
    .then((d) => { state.digest = d; render(); })
    .catch(() => { state.digest = null; });

  $('digestToastBody').addEventListener('click', openDrawer);
  $('digestToastBody').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDrawer(); } });
  $('digestToastClose').addEventListener('click', () => { if (state.digest) setSeen(state.digest.generatedAt || state.digest.date); hideToast(); });
  $('digestDrawerClose').addEventListener('click', closeDrawer);
  $('digestDrawerBackdrop').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawer.hidden) closeDrawer(); });

  window.addEventListener('afflatus-lang', (e) => {
    state.lang = e.detail === 'zh' ? 'zh' : 'en';
    if (!toast.hidden && state.digest) showToast(state.digest);
    if (!drawer.hidden && state.digest) renderDrawer(state.digest);
  });
})();
