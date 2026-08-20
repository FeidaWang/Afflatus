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

function marketLabel(status) {
  if (status === 'REG_MKT') return copy('U.S. SESSION · LIVE', '美国交易时段 · 实时');
  if (status === 'PRE_MKT') return copy('PRE-MARKET · LAST QUOTE', '盘前 · 最新报价');
  return copy('MARKET CLOSED · LAST QUOTE', '市场休市 · 最新报价');
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
  card.querySelector('[data-yield-value]').textContent = `${quote.value.toFixed(3)}%`;
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
  let timer = 0;
  let controller = null;

  function render(payload) {
    lastPayload = payload;
    payload.yields.forEach((quote) => renderQuote(board, quote));
    spread.textContent = signed(payload.spread30s10sBps, ' bp');
    spread.className = payload.spread30s10sBps > 0 ? 'positive' : payload.spread30s10sBps < 0 ? 'negative' : '';
    status.textContent = marketLabel(payload.marketStatus);
    status.className = payload.marketStatus === 'REG_MKT' ? 'live' : 'paused';
    const latest = payload.yields.map((quote) => quote.asOf).filter(Boolean).sort().at(-1);
    timestamp.textContent = formatTime(latest);
    source.textContent = `${payload.source?.venue || 'Tradeweb'} · ${payload.source?.provider || 'CNBC Quote Cache'}${payload.source?.realTime ? ` · ${copy('REAL-TIME', '实时')}` : ''}`;
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
      render(payload);
    } catch (error) {
      if (error.name === 'AbortError') return;
      status.textContent = copy('FEED UNAVAILABLE · RETRYING', '行情暂不可用 · 将重试');
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
    else status.textContent = copy('SYNCING YIELD FEED…', '正在同步收益率…');
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
