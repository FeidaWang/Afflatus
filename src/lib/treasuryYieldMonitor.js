const REFRESH_MS = 30000;

function currentLang() {
  try { return window.AfflatusI18N?.get() === 'zh' ? 'zh' : 'en'; } catch (_) { return 'en'; }
}

function copy(en, zh) {
  return currentLang() === 'zh' ? zh : en;
}

function signed(value, suffix = '') {
  if (!Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(1)}${suffix}`;
}

// A retrieval or session flag cannot establish the age of both observations.
export function yieldEvidenceState(payload, now = Date.now()) {
  const quotes = payload?.yields;
  if (!Array.isArray(quotes) || quotes.length !== 2 || new Set(quotes.map(q => q.tenor)).size !== 2) return 'unknown';
  const ages = quotes.map(q => typeof q.asOf === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(q.asOf) ? now - Date.parse(q.asOf) : NaN);
  if (quotes.some(q => !['10Y', '30Y'].includes(q.tenor) || !Number.isFinite(q.value)) || ages.some(a => !Number.isFinite(a) || a < 0)) return 'unknown';
  return ages.some(a => a > 15 * 60_000) ? 'stale' : 'observed';
}

function formatTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(currentLang() === 'zh' ? 'zh-CN' : 'en-AU', {
    month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}

function renderQuote(board, quote) {
  const card = board.querySelector(`[data-yield-tenor="${quote.tenor}"]`);
  if (!card) return;
  const direction = quote.changeBps > 0 ? 'up' : quote.changeBps < 0 ? 'down' : 'flat';
  card.classList.remove('up', 'down', 'flat');
  card.classList.add(direction);
  card.querySelector('[data-yield-value]').textContent = Number.isFinite(quote.value) ? `${quote.value.toFixed(3)}%` : '—';
  card.querySelector('[data-yield-change]').textContent = `${signed(quote.changeBps, ' bp')} ${quote.changeBps > 0 ? '▲' : quote.changeBps < 0 ? '▼' : '•'}`;
  card.querySelector('[data-yield-open]').textContent = Number.isFinite(quote.open) ? `${quote.open.toFixed(3)}%` : '—';
  card.querySelector('[data-yield-range]').textContent = Number.isFinite(quote.low) && Number.isFinite(quote.high)
    ? `${quote.low.toFixed(3)} — ${quote.high.toFixed(3)}%`
    : '—';
  const span = quote.high - quote.low;
  const position = Number.isFinite(span) && span > 0 ? ((quote.value - quote.low) / span) * 100 : 50;
  card.querySelector('[data-yield-position]').style.setProperty('--position', `${Math.max(2, Math.min(98, position)).toFixed(1)}%`);
}

export function mountTreasuryYieldMonitor() {
  const board = document.getElementById('treasuryYieldBoard');
  if (!board) return { refresh() {}, destroy() {} };
  const status = board.querySelector('[data-yield-status]');
  const timestamp = board.querySelector('[data-yield-time]');
  const source = board.querySelector('[data-yield-source]');
  const spread = board.querySelector('[data-yield-spread]');
  const button = board.querySelector('[data-yield-refresh]');
  let lastPayload = null;
  let unavailable = false;
  let timer = 0;
  let controller = null;

  // Browser quality gates run against Vite's static preview server, where the
  // Vercel Function does not exist. Keep those captures deterministic without
  // issuing a guaranteed 404; deployed environments still use the live feed.
  if (window.__AFFLATUS_E2E__) {
    status.textContent = copy('FEED UNAVAILABLE · LOCAL PREVIEW', '行情未提供 · 本地预览');
    status.className = 'paused';
    board.setAttribute('aria-busy', 'false');
    return { refresh() {}, destroy() {} };
  }

  function render(payload) {
    lastPayload = payload;
    payload.yields.forEach((quote) => renderQuote(board, quote));
    spread.textContent = signed(payload.spread30s10sBps, ' bp');
    spread.className = payload.spread30s10sBps > 0 ? 'positive' : payload.spread30s10sBps < 0 ? 'negative' : '';
    const state = yieldEvidenceState(payload);
    board.dataset.evidenceState = unavailable ? 'disconnected' : state;
    status.textContent = state === 'stale' ? copy('STALE OBSERVATIONS', '历史观测值') : state === 'unknown' ? copy('UNVERIFIED OBSERVATIONS', '观测未验证') : copy('RECENT OBSERVATIONS · DELAY UNKNOWN', '近期观测 · 延迟未知');
    status.className = state === 'observed' ? 'paused' : 'error';
    if (unavailable) {
      status.textContent = copy('DISCONNECTED · LAST OBSERVATIONS', '连接中断 · 保留上次观测');
      status.className = 'error';
    }
    timestamp.textContent = payload.yields.map(q => `${q.tenor}: ${formatTime(q.asOf)}`).join(' · ');
    source.textContent = `${payload.source?.venue || '—'} · ${payload.source?.provider || '—'}`;
    const inspection = board.querySelector('[data-yield-inspection]');
    if (inspection) inspection.textContent = payload.yields.map(q => `${q.tenor}: ${q.asOf || copy('Unavailable', '未提供')}`).join(' · ') + copy(' | Yield: %; change/spread: bp (1 bp = 0.01 percentage point). Observations older than 15 minutes are marked stale; this is a display threshold, not a provider delay guarantee. Market session: ', ' | 收益率：%；变动／利差：基点（1基点 = 0.01个百分点）。超过15分钟标为历史观测；这是显示阈值，并非供应商延迟保证。市场时段：') + (payload.marketStatus || 'UNKNOWN');

  }

  async function refresh() {
    if (controller) controller.abort();
    controller = new AbortController();
    board.setAttribute('aria-busy', 'true');
    status.textContent = copy('SYNCING YIELD FEED…', '正在同步收益率…');
    status.className = 'syncing';
    button.disabled = true;
    try {
      const response = await fetch('/api/treasury-yields', { headers: { Accept: 'application/json' }, signal: controller.signal });
      if (!response.ok) throw new Error(`yield feed ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload.yields) || payload.yields.length !== 2) throw new Error('invalid yield feed');
      unavailable = false;
      render(payload);
    } catch (error) {
      if (error.name === 'AbortError') return;
      unavailable = true;
      board.dataset.evidenceState = lastPayload ? 'disconnected' : 'unavailable';
      status.textContent = lastPayload ? copy('DISCONNECTED · LAST OBSERVATIONS', '连接中断 · 保留上次观测') : copy('FEED UNAVAILABLE · RETRYING', '行情暂不可用 · 将重试');
      status.className = 'error';
    } finally {
      board.setAttribute('aria-busy', 'false');
      button.disabled = false;
    }
  }

  function schedule() {
    clearInterval(timer);
    if (!document.hidden) timer = window.setInterval(refresh, REFRESH_MS);
  }

  function onVisibility() {
    schedule();
    if (!document.hidden) refresh();
  }

  function onLanguage() {
    if (lastPayload) render(lastPayload);
    else status.textContent = unavailable ? copy('FEED UNAVAILABLE · RETRYING', '行情暂不可用 · 将重试') : copy('SYNCING YIELD FEED…', '正在同步收益率…');
  }

  button.addEventListener('click', refresh);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('afflatus-lang', onLanguage);
  refresh();
  schedule();

  return {
    refresh,
    destroy() {
      clearInterval(timer);
      if (controller) controller.abort();
      button.removeEventListener('click', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('afflatus-lang', onLanguage);
    },
  };
}
