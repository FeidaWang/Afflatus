import { getDailyBars } from './client.js';
import './styles.css';

const pools = {
  us: [['US:AAPL', 'AAPL'], ['US:MSFT', 'MSFT'], ['US:NVDA', 'NVDA'], ['US:MU', 'MU'], ['US:SPY', 'SPY'], ['US:QQQ', 'QQQ']],
  crypto: [['CRYPTO:OKX:BTC-USDT:SPOT', 'BTC / USDT'], ['CRYPTO:OKX:ETH-USDT:SPOT', 'ETH / USDT'], ['CRYPTO:OKX:SOL-USDT:SPOT', 'SOL / USDT']],
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
  let controller, disposed = false;
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
  const symbol = select(t.symbol, pools.us);
  const period = select(t.period, [['90', `90 ${t.days}`], ['180', `180 ${t.days}`], ['365', `365 ${t.days}`]]);
  const status = element('p', '', 'vibe-markets__status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const value = element('p', '', 'vibe-markets__value');
  const chart = element('div', t.empty, 'vibe-markets__chart');
  const meta = element('p', '', 'vibe-markets__muted');
  const technical = element('div', undefined, 'vibe-markets__technical');
  const details = element('details'); details.append(element('summary', t.table));
  const tableWrap = element('div', undefined, 'vibe-markets__table'); details.append(tableWrap);
  root.replaceChildren(title, hint, controls, status, value, chart, meta, technical, details, element('p', t.scope, 'vibe-markets__muted'));
  title.id = 'vibe-market-research-title'; root.setAttribute('aria-labelledby', title.id);

  async function refresh() {
    controller?.abort(); controller = new AbortController();
    const active = controller;
    status.textContent = t.loading; value.textContent = ''; chart.textContent = t.empty; meta.textContent = ''; tableWrap.replaceChildren(); technical.replaceChildren();
    const end = new Date(); const start = new Date(end); start.setUTCDate(start.getUTCDate() - Number(period.value));
    try {
      const result = await getDailyBars({ instrument: symbol.value, start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), signal: active.signal, headers: await getHeaders() });
      if (disposed || active !== controller) return;
      const last = result.bars.at(-1);
      status.textContent = t.status;
      value.textContent = `${t.close}: ${new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(last.close)} ${result.instrument.quote_currency}`;
      draw(chart, result.bars, `${result.instrument.symbol} · ${t.status}`);
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
      const table = element('table'), head = element('tr');
      for (const label of [t.date, t.open, t.high, t.low, t.close, t.volume]) { const cell = element('th', label); cell.scope = 'col'; head.append(cell); }
      const thead = element('thead'); thead.append(head); table.append(thead);
      const body = element('tbody');
      for (const bar of result.bars.slice(-30).reverse()) { const row = element('tr'); for (const key of ['date', 'open', 'high', 'low', 'close', 'volume']) row.append(element('td', bar[key] == null ? '—' : String(bar[key]))); body.append(row); }
      table.append(body); tableWrap.append(table);
    } catch (error) {
      if (disposed || active !== controller || active.signal.aborted) return;
      status.textContent = `${t.failed} (${error.message})`; chart.textContent = t.empty;
    }
  }
  market.addEventListener('change', () => {
    symbol.replaceChildren();
    for (const [id, text] of pools[market.value]) { const opt = element('option', text); opt.value = id; symbol.append(opt); }
    refresh();
  });
  symbol.addEventListener('change', refresh); period.addEventListener('change', refresh);
  refresh();
  return () => { disposed = true; controller?.abort(); root.replaceChildren(); root.classList.remove('vibe-markets'); };
}
function draw(container, bars, label) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 800 240'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label);
  const title = document.createElementNS(ns, 'title'); title.textContent = label; svg.append(title);
  const prices = bars.map(x => x.close); const minimum = Math.min(...prices), maximum = Math.max(...prices), span = maximum - minimum || 1;
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', prices.map((p, i) => `${i ? 'L' : 'M'}${20 + i / Math.max(1, prices.length - 1) * 760},${215 - (p - minimum) / span * 190}`).join(' '));
  path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '2'); path.setAttribute('vector-effect', 'non-scaling-stroke'); svg.append(path);
  container.replaceChildren(svg);
}
