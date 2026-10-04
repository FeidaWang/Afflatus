import { getDailyBars } from './client.js';
import { mountResearch, mountTextSentiment, renderPatterns } from './research.js';
import { mountQuant } from './quant.js';
import './styles.css';

const pools = {
  us: [['US:AAPL', 'AAPL'], ['US:MSFT', 'MSFT'], ['US:NVDA', 'NVDA'], ['US:MU', 'MU'], ['US:AMZN', 'AMZN'], ['US:GOOGL', 'GOOGL'], ['US:SPY', 'SPY'], ['US:QQQ', 'QQQ'], ['US:IVV', 'IVV']],
  okx: [['CRYPTO:OKX:BTC-USDT:SPOT', 'BTC / USDT'], ['CRYPTO:OKX:ETH-USDT:SPOT', 'ETH / USDT'], ['CRYPTO:OKX:SOL-USDT:SPOT', 'SOL / USDT']],
  binance: [['CRYPTO:BINANCE:BTC-USDT:SPOT', 'BTC / USDT'], ['CRYPTO:BINANCE:ETH-USDT:SPOT', 'ETH / USDT'], ['CRYPTO:BINANCE:SOL-USDT:SPOT', 'SOL / USDT']],
};
const strings = {
  en: { title: 'Market research', market: 'Market', us: 'US stocks & ETFs', crypto: 'Crypto spot', symbol: 'Instrument', period: 'History', days: 'days', status: 'Daily bars · not a live quote', loading: 'Loading verified source data…', failed: 'Data unavailable', close: 'Last daily close', source: 'Source', bar: 'Last bar', time: 'Fetched at', empty: 'No chart until a data source is available.', scope: 'Research only. Spot ≠ perpetual. USD ≠ USDT.', table: 'Inspect daily bars', date: 'Date', open: 'Open', high: 'High', low: 'Low', volume: 'Volume', adjustment: 'Adjustment', unknown: 'unknown', unit: 'Volume unit', zone: 'Bar timezone', quality: 'Quality' },
  zh: { title: '市场研究', market: '市场', us: '美股与 ETF', crypto: '加密货币现货', symbol: '标的', period: '历史区间', days: '天', status: '日线数据 · 非实时价格', loading: '正在读取可验证的数据源…', failed: '数据暂不可用', close: '最近日线收盘', source: '数据源', bar: '最后一根日线', time: '抓取时间', empty: '数据源可用后才显示图表。', scope: '仅供研究。现货不等于永续合约；USD 不等于 USDT。', table: '检查日线数据', date: '日期', open: '开盘', high: '最高', low: '最低', volume: '成交量', adjustment: '复权', unknown: '未知', unit: '成交量单位', zone: '日线时区', quality: '质量' },
};
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

/** Lazy mount into an existing Arena section. No global styles, router, or polling. */
export function mountVibeMarkets(root, { locale = 'en', getHeaders = () => ({}) } = {}) {
  if (!(root instanceof HTMLElement)) throw new TypeError('mount root is required');
  const t = strings[locale] || strings.en;
  let controller, disposeResearch, disposeQuant, disposed = false;
  root.classList.add('vibe-markets');
  const title = element('h2', t.title);
  const hint = element('p', t.status, 'vibe-markets__muted');
  const controls = element('div', undefined, 'vibe-markets__controls');
  function select(label, options) {
    const wrapper = element('label', label);
    const input = element('select'); input.setAttribute('aria-label', label);
    for (const [value, text] of options) { const opt = element('option', text); opt.value = value; input.append(opt); }
    wrapper.append(input); controls.append(wrapper); return input;
  }
  const market = select(t.market, [['us', t.us], ['crypto', t.crypto]]);
  const exchange = select(locale === 'zh' ? '现货交易所' : 'Spot exchange', [['okx', 'OKX'], ['binance', 'Binance · CCXT']]);
  exchange.parentElement.hidden = true;
  const symbol = select(t.symbol, pools.us);
  const period = select(t.period, [['90', `90 ${t.days}`], ['180', `180 ${t.days}`], ['365', `365 ${t.days}`]]);
  const status = element('p', '', 'vibe-markets__status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const value = element('p', '', 'vibe-markets__value');
  const chart = element('div', t.empty, 'vibe-markets__chart');
  const meta = element('p', '', 'vibe-markets__muted');
  const technical = element('div', undefined, 'vibe-markets__technical');
  const research = element('div', undefined, 'vibe-markets__research');
  const quant = element('div', undefined, 'vibe-markets__research');
  const sentiment = element('div'); mountTextSentiment(sentiment, locale);
  const details = element('details'); details.append(element('summary', t.table));
  const tableWrap = element('div', undefined, 'vibe-markets__table'); details.append(tableWrap);
  root.replaceChildren(title, hint, controls, status, value, chart, meta, technical, details, research, quant, sentiment, element('p', t.scope, 'vibe-markets__muted'));
  title.id = 'vibe-market-research-title'; root.setAttribute('aria-labelledby', title.id);

  async function refresh() {
    controller?.abort(); controller = new AbortController();
    disposeResearch?.(); disposeResearch = mountResearch(research, symbol.value, { locale, getHeaders });
    disposeQuant?.(); if (import.meta.env.VITE_VIBE_QUANT_ENABLED === 'true') disposeQuant = mountQuant(quant, symbol.value, { locale, getHeaders, days: Number(period.value) });
    const active = controller;
    status.textContent = t.loading; value.textContent = ''; chart.textContent = t.empty; meta.textContent = ''; tableWrap.replaceChildren(); technical.replaceChildren();
    const end = new Date(); const start = new Date(end); start.setUTCDate(start.getUTCDate() - Number(period.value));
    try {
      const result = await getDailyBars({ instrument: symbol.value, start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), signal: active.signal, headers: await getHeaders() });
      if (disposed || active !== controller) return;
      const last = result.bars.at(-1);
      status.textContent = t.status;
      value.textContent = `${t.close}: ${new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(last.close)} ${result.instrument.quote_currency}`;
      draw(chart, result.bars, `${result.instrument.symbol} · ${t.status}`, locale);
      meta.textContent = `${t.source}: ${result.provenance.source} · ${t.bar}: ${result.provenance.last_bar_date} · ${t.time}: ${result.provenance.observed_at} · ${t.adjustment}: ${result.provenance.adjustment || t.unknown} · ${t.unit}: ${result.provenance.volume_unit || t.unknown} · ${t.zone}: ${result.provenance.bar_timezone || t.unknown} · ${t.quality}: ${result.provenance.quality || t.unknown}`;
      if (result.technical) {
        technical.append(element('h3', locale === 'zh' ? '技术指标' : 'Technical indicators'));
        const list = element('dl');
        for (const [name, indicator] of Object.entries(result.technical.indicators)) {
          const group = element('div'); group.append(element('dt', name.toUpperCase().replaceAll('_', ' ')));
          const text = indicator.status === 'unavailable'
            ? (locale === 'zh' ? `不可用 · 需要 ${indicator.minimum_bars} 根日线` : `Unavailable · needs ${indicator.minimum_bars} bars`)
            : typeof indicator.value === 'number' ? indicator.value.toFixed(3)
              : Object.entries(indicator.value).map(([key, value]) => `${key}: ${value == null ? t.unknown : value.toFixed(3)}`).join(' · ');
          group.append(element('dd', text)); list.append(group);
        }
        technical.append(list, element('p', `${result.technical.as_of} · ${result.technical.source} · Vibe-Trading ${result.technical.upstream_commit.slice(0, 7)}`, 'vibe-markets__muted'));
      }
      if (result.patterns) renderPatterns(technical, result.patterns, locale);
      const table = element('table'), head = element('tr');
      for (const label of [t.date, t.open, t.high, t.low, t.close, t.volume]) { const cell = element('th', label); cell.scope = 'col'; head.append(cell); }
      const thead = element('thead'); thead.append(head); table.append(thead);
      const body = element('tbody');
      for (const bar of result.bars.slice(-30).reverse()) { const row = element('tr'); for (const key of ['date', 'open', 'high', 'low', 'close', 'volume']) row.append(element('td', bar[key] == null ? '—' : String(bar[key]))); body.append(row); }
      table.append(body); tableWrap.append(table);
    } catch (error) {
      if (disposed || active !== controller || active.signal.aborted) return;
      const serviceMessages = {
        FEATURE_DISABLED: locale === 'zh' ? '线上研究服务尚未启用，数据查询和计算暂不可用。' : 'The online research service is not enabled. Data queries and calculations are unavailable.',
        SERVICE_NOT_CONFIGURED: locale === 'zh' ? '研究服务尚未连接，数据暂不可用。' : 'The research service is not connected. Data is unavailable.',
        PRIVATE_RESEARCH_ONLY: locale === 'zh' ? '此研究数据需要已授权的访问权限。' : 'This research data requires authorized access.',
      };
      status.textContent = serviceMessages[error.message] || t.failed; chart.textContent = t.empty;
    }
  }
  function changePool() {
    exchange.parentElement.hidden = market.value !== 'crypto';
    symbol.replaceChildren();
    for (const [id, text] of pools[market.value === 'us' ? 'us' : exchange.value]) { const opt = element('option', text); opt.value = id; symbol.append(opt); }
    refresh();
  }
  market.addEventListener('change', changePool); exchange.addEventListener('change', changePool);
  symbol.addEventListener('change', refresh); period.addEventListener('change', refresh);
  refresh();
  return () => { disposed = true; controller?.abort(); disposeResearch?.(); disposeQuant?.(); root.replaceChildren(); root.classList.remove('vibe-markets'); };
}
function draw(container, bars, label, locale) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 800 240'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label);
  const title = document.createElementNS(ns, 'title'); title.textContent = label; svg.append(title);
  const visible = bars.slice(-80); const minimum = Math.min(...visible.map(b => b.low)), maximum = Math.max(...visible.map(b => b.high)), span = maximum - minimum || 1;
  const y = price => 215 - (price - minimum) / span * 190; const width = 760 / visible.length;
  for (const [i, bar] of visible.entries()) {
    const x = 20 + (i + .5) * width;
    const wick = document.createElementNS(ns, 'line'); wick.setAttribute('x1', x); wick.setAttribute('x2', x); wick.setAttribute('y1', y(bar.low)); wick.setAttribute('y2', y(bar.high)); wick.setAttribute('stroke', 'currentColor');
    const body = document.createElementNS(ns, 'rect'); body.setAttribute('x', x - width * .3); body.setAttribute('width', width * .6); body.setAttribute('y', y(Math.max(bar.open, bar.close))); body.setAttribute('height', Math.max(1, Math.abs(y(bar.open) - y(bar.close))));
    body.setAttribute('fill', bar.close >= bar.open ? 'none' : 'currentColor'); body.setAttribute('stroke', 'currentColor'); svg.append(wick, body);
  }
  const caption = locale === 'zh' ? `显示最近 ${visible.length} / ${bars.length} 根完整日线；空心表示收盘不低于开盘。` : `Showing the last ${visible.length} of ${bars.length} complete bars. Hollow bodies mean close ≥ open.`;
  title.textContent = `${label} · ${caption}`;
  svg.setAttribute('aria-label', title.textContent);
  container.replaceChildren(svg, element('p', caption, 'vibe-markets__muted'));
}
