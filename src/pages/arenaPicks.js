/* ============================================================
   ARENA · TODAY'S RECOMMENDED TRADES (Part 4 §18.2.1, new 2026-07-23)

   Renders public/arena-picks.json as a grid of pick cards grouped by
   model (S: ORACLE / P: PULSE / T: ATLAS), replacing the old static
   30-symbol watchlist chip row. Read-only — this file never proposes or
   settles a trade, it only displays what the (currently manual, later
   scheduled) Gatherer/Analyst pipeline already wrote to arena-picks.json.

   Clicking a card dispatches a plain DOM CustomEvent rather than calling
   into arenaTech.js directly — the two files are independent IIFEs (same
   pattern as the existing `afflatus-lang` event), so neither needs to
   import the other's internals.
   ============================================================ */
(() => {
  'use strict';
  const host = document.getElementById('picksDash');
  if (!host) return;

  const $ = (id) => document.getElementById(id);
  const PICKS_URL = '/arena-picks.json';

  const MODEL_COLOR = { S: 'var(--acid)', P: 'var(--cyan)', T: 'var(--magenta)' };
  const MODEL_LABEL = { S: 'S · ORACLE', P: 'P · PULSE', T: 'T · ATLAS' };
  const MODEL_ORDER = ['S', 'P', 'T'];

  const state = {
    lang: (window.AfflatusI18N && window.AfflatusI18N.get && window.AfflatusI18N.get()) || 'en',
    picks: null,
  };
  const T = (en, zh) => (state.lang === 'zh' ? zh : en);
  const fmtUsd = (x) => (x == null || !isFinite(x)) ? '—' : '$' + Number(x).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Same ET-date logic as arenaTech.js's etParts() (kept local — this file
  // and arenaTech.js are independent modules, duplicating six lines here
  // is cheaper than introducing a shared dependency for it).
  function todayEtDateStr() {
    const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
    const p = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}`;
  }

  function pickCard(model, p) {
    const color = MODEL_COLOR[model] || 'var(--muted)';
    const confPct = Math.round((p.confidence || 0) * 100);
    const thesis = T(p.thesis_en, p.thesis_zh) || '';
    const signals = (p.signals || []).map((s) => `<span class="pick-tag">${s}</span>`).join('');
    return `<article class="pick-card" style="--pick-color:${color}" data-sym="${p.sym}" tabindex="0" role="button" aria-label="${T('Load', '加载')} ${p.sym}">
      <div class="pick-hd"><span class="pick-model">${MODEL_LABEL[model] || model}</span><span class="pick-side">${T('LONG', '做多')}</span></div>
      <div class="pick-sym"><b>${p.sym}</b></div>
      <div class="pick-conf"><div class="pick-conf-track"><div class="pick-conf-fill" style="width:${confPct}%"></div></div><span>${confPct}%</span></div>
      <div class="pick-ladder">
        <div><span>${T('Entry', '入场')}</span><b>${fmtUsd(p.entry)}</b></div>
        <div><span>${T('Stop', '止损')}</span><b class="down">${fmtUsd(p.stop)}</b></div>
        <div><span>${T('Target', '目标')}</span><b class="up">${fmtUsd(p.target)}</b></div>
      </div>
      ${p.exitBy ? `<div class="pick-exitby">${T('Exit by', '到期平仓')} ${p.exitBy}</div>` : ''}
      <p class="pick-thesis">${thesis}</p>
      <div class="pick-signals">${signals}</div>
    </article>`;
  }

  function modelColumn(model, picks) {
    const cards = picks.length
      ? picks.map((p) => pickCard(model, p)).join('')
      : `<div class="pick-empty">${T('No new position today.', '今日不下单。')}</div>`;
    return `<div class="pick-col" style="--pick-color:${MODEL_COLOR[model] || 'var(--muted)'}">
      <div class="pick-col-hd">${MODEL_LABEL[model] || model}</div>
      <div class="pick-col-body">${cards}</div>
    </div>`;
  }

  function render() {
    const d = state.picks;
    if (!d) {
      $('picksGrid').innerHTML = `<div class="pick-empty">${T('Recommendations unavailable right now.', '推荐名单暂时无法加载。')}</div>`;
      $('picksDateChip').textContent = '—';
      $('picksRegimeChip').textContent = '—';
      return;
    }
    $('picksDateChip').textContent = d.date || '—';
    $('picksRegimeChip').textContent = (d.regime || '—').toUpperCase();
    const stale = d.date && d.date !== todayEtDateStr();
    $('picksNote').innerHTML = stale
      ? `⚠ ${T(`Pipeline hasn't published a new pool since ${d.date} — showing the last available recommendations.`, `自 ${d.date} 起流水线尚未发布新一批推荐——以下为最近一次可用的推荐。`)}`
      : T(d.note_en || '', d.note_zh || '');
    host.classList.toggle('pick-stale', !!stale);
    $('picksGrid').innerHTML = MODEL_ORDER.map((m) => modelColumn(m, (d.models && d.models[m]) || [])).join('');
    $('picksGrid').querySelectorAll('.pick-card').forEach((el) => {
      const fire = () => window.dispatchEvent(new CustomEvent('arena-pick-select', { detail: { sym: el.dataset.sym } }));
      el.addEventListener('click', fire);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(); } });
    });
  }

  fetch(PICKS_URL, { cache: 'no-store' })
    .then((r) => r.ok ? r.json() : Promise.reject())
    .then((d) => { state.picks = d; render(); })
    .catch(() => { state.picks = null; render(); });

  window.addEventListener('afflatus-lang', (e) => { state.lang = e.detail === 'zh' ? 'zh' : 'en'; render(); });
})();
