import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './styles.css';

/* PURE_HELPERS_START — also exercised without a browser by ui-source.test.mjs. */
export function numeric(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

export function normalizeStatus(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_RESPONSE');
  const data = value.status && typeof value.status === 'object' ? value.status : value;
  if (!data.capabilities && !data.snapshot && !Array.isArray(data.portfolios) && !data.mode) throw new Error('INVALID_RESPONSE');
  return {
    ...data,
    mode: data.mode || 'unconfigured',
    capabilities: data.capabilities || {},
    snapshot: data.snapshot ? { ...data.snapshot, quotes: Array.isArray(data.snapshot.quotes) ? data.snapshot.quotes : [] } : null,
    portfolios: Array.isArray(data.portfolios) ? data.portfolios : [],
    runs: Array.isArray(data.runs) ? data.runs : [],
    research: data.research && typeof data.research === 'object' ? data.research : {},
    feedback: data.feedback && typeof data.feedback === 'object' ? data.feedback : {},
    connectors: Array.isArray(data.connectors) ? data.connectors : [],
  };
}

export function quoteTime(quote, snapshot) {
  const raw = quote?.asOf ?? quote?.timestamp ?? quote?.observedAt ?? quote?.marketTime ?? snapshot?.asOf;
  if (raw === undefined || raw === null || raw === '') return null;
  const parsed = typeof raw === 'number' ? (raw < 1e12 ? raw * 1000 : raw) : Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function quoteQuality(quote, snapshot, now = Date.now(), mode = 'live') {
  const sourceQuality = typeof quote?.quality === 'string' ? quote.quality : quote?.quality?.status;
  if (mode === 'demo' || sourceQuality === 'demo' || quote?.source === 'demo') return 'demo';
  if (['stale', 'unavailable', 'invalid'].includes(sourceQuality)) return sourceQuality;
  const time = quoteTime(quote, snapshot);
  if (time === null) return 'unknown';
  if (time > now + 5000) return 'invalid';
  const age = now - time;
  if (sourceQuality === 'eod') return 'eod';
  if (snapshot?.marketOpen === false && ['provider','demo'].includes(snapshot?.calendarStatus)) return age > 4 * 86400000 ? 'stale' : 'closed';
  if (sourceQuality === 'delayed' || quote?.feed === 'delayed') return 'delayed';
  return age > 90000 ? 'stale' : sourceQuality || 'observed';
}

export function quotePrice(quote) {
  return numeric(quote?.price ?? quote?.last ?? quote?.lastPrice);
}

export function quoteChange(quote) {
  const direct = numeric(quote?.changePercent ?? quote?.changePct);
  if (direct !== null) return direct;
  const current = quotePrice(quote), previous = numeric(quote?.previousClose ?? quote?.prevClose);
  return current !== null && previous !== null && previous > 0 ? (current / previous - 1) * 100 : null;
}

export function filterQuotes(quotes, search = '', sort = 'symbol', direction = 'asc') {
  const needle = search.trim().toLowerCase();
  const rows = (Array.isArray(quotes) ? quotes : []).filter(q => q && typeof q.symbol === 'string' &&
    `${q.symbol} ${q.name || ''}`.toLowerCase().includes(needle));
  return [...rows].sort((a, b) => {
    if (sort === 'symbol') return a.symbol.localeCompare(b.symbol) * (direction === 'asc' ? 1 : -1);
    const first = sort === 'change' ? quoteChange(a) : quotePrice(a), second = sort === 'change' ? quoteChange(b) : quotePrice(b);
    if (first === null) return second === null ? 0 : 1;
    if (second === null) return -1;
    return (first - second) * (direction === 'asc' ? 1 : -1);
  });
}

export function historyGeometry(history, width = 700, height = 190) {
  const rows = (Array.isArray(history) ? history : []).map(item => ({
    time: quoteTime({ asOf: item?.asOf ?? item?.time ?? item?.timestamp ?? item?.date }),
    value: numeric(item?.close ?? item?.price ?? item?.value),
  })).filter(item => item.time !== null && item.value !== null && item.value > 0).sort((a, b) => a.time - b.time);
  const distinct = rows.filter((item, index) => index === 0 || item.time > rows[index - 1].time);
  if (distinct.length < 2) return null;
  const min = Math.min(...distinct.map(item => item.value)), max = Math.max(...distinct.map(item => item.value));
  const span = max - min || max * .02 || 1, start = distinct[0].time, end = distinct.at(-1).time;
  return {
    path: distinct.map((item, index) => `${index ? 'L' : 'M'}${((item.time - start) / (end - start) * width).toFixed(2)},${(height - 14 - (item.value - min) / span * (height - 28)).toFixed(2)}`).join(' '),
    min, max, start, end, count: distinct.length, up: distinct.at(-1).value >= distinct[0].value,
  };
}

export function safeSourceUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}

export function exportSnapshot(value) {
  const sensitive = key => { const normalized=key.replace(/[_-]/g,'').toLowerCase();return normalized === 'token' || /(password|secret|authorization|apikey|accesstoken|refreshtoken|admintoken|bearertoken|connectionstring)$/.test(normalized); };
  const visit = item => {
    if (Array.isArray(item)) return item.map(visit);
    if (!item || typeof item !== 'object') return item;
    return Object.fromEntries(Object.entries(item).filter(([key]) => !sensitive(key)).map(([key, item]) => [key, visit(item)]));
  };
  return visit(value);
}

export function buildDcfInput(values) {
  const number = key => { const result = numeric(values[key]); if (result === null) throw new Error('INVALID_DCF_INPUT'); return result; };
  const years = number('years'), wacc = number('discountRate') / 100, terminalGrowth = number('terminalGrowthRate') / 100;
  const base = number('baseFreeCashFlow'), shares = number('sharesOutstanding'), cash = number('cash'), debt = number('debt');
  if (!Number.isInteger(years) || years < 1 || years > 15 || base <= 0 || shares <= 0 || cash < 0 || debt < 0 || wacc <= 0 || wacc <= terminalGrowth || terminalGrowth <= -1) throw new Error('INVALID_DCF_INPUT');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.asOf) || !Number.isFinite(Date.parse(values.asOf)) || new Date(values.asOf).toISOString().slice(0,10) !== values.asOf) throw new Error('INVALID_DCF_DATE');
  const scenarios = Object.fromEntries([['bear','bearGrowthRate'],['base','growthRate'],['bull','bullGrowthRate']].map(([name,key]) => {
    const growth = number(key) / 100;
    if (growth <= -1) throw new Error('INVALID_DCF_GROWTH');
    return [name,{fcff:Array.from({length:years},(_,index) => base * (1 + growth) ** (index + 1)),wacc,terminalGrowth}];
  }));
  return {currency:'USD',units:'millions',asOf:new Date(values.asOf).toISOString(),cash,debt,shares:{diluted:shares * 1000000},scenarios,sensitivity:{waccStep:.005,growthStep:.005}};
}

export async function requestApi(apiBase, route, { method = 'GET', token = '', body, signal, fetcher = globalThis.fetch, idempotencyKey, query = {} } = {}) {
  if (typeof apiBase !== 'string' || !apiBase.startsWith('/') || apiBase.startsWith('//')) throw new Error('SAME_ORIGIN_REQUIRED');
  const write = method !== 'GET';
  if (write && !token.trim()) throw new Error('ADMIN_TOKEN_REQUIRED');
  const headers = { Accept: 'application/json' };
  if (write) headers['Content-Type'] = 'application/json';
  if (token.trim()) headers.Authorization = `Bearer ${token.trim()}`;
  if (write && idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  if (Object.hasOwn(query,'route')) throw new Error('ROUTE_OVERRIDE');
  const parameters = new URLSearchParams({route,...query});
  if ([...parameters.keys()].some(key => /token|secret|password|authorization|api.?key/i.test(key))) throw new Error('CREDENTIAL_IN_QUERY');
  const response = await fetcher(`${apiBase}${apiBase.includes('?') ? '&' : '?'}${parameters}`, {
    method, signal, credentials: 'same-origin', cache: 'no-store', headers,
    ...(write ? { body: JSON.stringify({ ...body, ...(idempotencyKey ? { idempotencyKey } : {}) }) } : {}),
  });
  let result;
  try { result = await response.json(); } catch { throw new Error(response.ok ? 'INVALID_RESPONSE' : `HTTP_${response.status}`); }
  if (!response.ok || result?.error) {
    const code = result?.error?.code || result?.code || `HTTP_${response.status}`;
    throw new Error(String(code).slice(0,100));
  }
  return result;
}
/* PURE_HELPERS_END */

function Icon({ name = 'arrow', size = 18 }) {
  const paths = {
    arrow: <><path d="M4 12h16M13 5l7 7-7 7" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1" /></>,
    search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    pause: <><path d="M8 5v14M16 5v14" /></>,
    play: <path d="m8 5 11 7-11 7V5Z" />,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></>,
    document: <><path d="M6 3h9l4 4v14H6V3Zm9 0v5h4M9 12h7M9 16h7" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.arrow}</svg>;
}

function Pill({ children, tone = 'neutral' }) { return <span className={`fsi-pill fsi-pill--${tone}`}>{children}</span>; }

function formatMoney(value, locale, currency = 'USD', digits = 2) {
  const amount = numeric(value);
  if (amount === null) return '—';
  try { return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { style: 'currency', currency, maximumFractionDigits: digits }).format(amount); }
  catch { return `${amount.toFixed(digits)} ${currency}`; }
}

function signed(value, suffix = '', digits = 2) {
  const amount = numeric(value);
  return amount === null ? '—' : `${amount > 0 ? '+' : ''}${amount.toFixed(digits)}${suffix}`;
}

function displayTime(value, locale, full = false) {
  const stamp = quoteTime({ asOf: value });
  if (stamp === null) return '—';
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-AU', {
    ...(full ? { year: 'numeric', month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric' }),
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
  }).format(stamp);
}

function Change({ value, ratio = false }) {
  const number = numeric(value);
  return <span className={number === null || number === 0 ? 'fsi-muted' : number > 0 ? 'fsi-positive' : 'fsi-negative'}>{signed(number === null ? null : ratio ? number * 100 : number, '%')}</span>;
}

function Empty({ title, children, icon = 'document' }) {
  return <div className="fsi-empty"><Icon name={icon} size={27} /><strong>{title}</strong>{children && <p>{children}</p>}</div>;
}

function Sources({ sources = [], t }) {
  if (!Array.isArray(sources) || !sources.length) return null;
  return <ul className="fsi-sources">{sources.slice(0,8).map((source, index) => {
    const url = safeSourceUrl(typeof source === 'string' ? source : source.url);
    return <li key={`${url || index}`}>
      {url ? <a href={url} target="_blank" rel="noopener noreferrer">{source.title || source.label || new URL(url).hostname}<span aria-hidden="true"> ↗</span></a> : <span>{source.title || source.label || t('来源尚未提供链接', 'Source link unavailable')}</span>}
      {source.asOf && <small>{source.asOf}</small>}
    </li>;
  })}</ul>;
}

function PriceChart({ quote, historyRecord, historyError, historyLoading, t, locale }) {
  const history = historyRecord && quote?.symbol && historyRecord.symbol === quote.symbol ? historyRecord.bars : [];
  const geometry = useMemo(() => historyGeometry(history), [history]);
  if (!geometry) return <div className="fsi-chart-empty"><div className="fsi-chart-grid" aria-hidden="true" /><span>{historyLoading ? t('正在读取历史价格…','Reading price history…') : t('暂无可用的历史曲线', 'No historical series available')}</span><small>{historyError ? `${t('来源状态','Source state')}: ${historyError}` : t('当前报价与历史曲线分别记录来源。', 'Current quotes and historical series keep separate provenance.')}</small></div>;
  return <div className={`fsi-chart ${geometry.up ? 'fsi-chart--up' : 'fsi-chart--down'}`}>
    <div className="fsi-chart-scale"><span>{formatMoney(geometry.max, locale, quote?.currency || 'USD')}</span><span>{formatMoney(geometry.min, locale, quote?.currency || 'USD')}</span></div>
    <svg viewBox="0 0 700 190" preserveAspectRatio="none" role="img" aria-label={`${quote?.symbol || ''}: ${geometry.count} ${t('条有时间戳的价格观察', 'timestamped price observations')}`}>
      {[30,90,150].map(y => <line key={y} x1="0" y1={y} x2="700" y2={y} className="fsi-grid-line" />)}
      <path d={geometry.path} className="fsi-price-line" />
    </svg>
    <div className="fsi-chart-dates"><span>{new Date(geometry.start).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-AU')}</span><span>{historyRecord?.quality === 'demo' ? t('演示历史','Demo history') : t('历史日线','Daily history')} · {geometry.count}</span><span>{new Date(geometry.end).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-AU')}</span></div><p className="fsi-history-source">{historyRecord?.source || '—'} · {t('仅用于历史研究，不用于模拟成交定价','Historical research only; excluded from execution pricing')}</p>
  </div>;
}

function QuotePanel({ data, locale, t, apiBase, token }) {
  const [search, setSearch] = useState(''), [sort, setSort] = useState({ key: 'symbol', direction: 'asc' }), [selected, setSelected] = useState('');
  const snapshot = data?.snapshot;
  const quotes = snapshot?.quotes || [];
  const rows = useMemo(() => filterQuotes(quotes, search, sort.key, sort.direction), [quotes, search, sort]);
  const quote = quotes.find(item => item.symbol === selected) || rows[0] || quotes[0];
  const [historyRecord,setHistoryRecord] = useState(null), [historyError,setHistoryError] = useState(''), [historyLoading,setHistoryLoading] = useState(false);
  const historySymbol = quote?.symbol, historyMode = data?.mode === 'demo' ? 'demo' : 'live';
  const historyDate = typeof snapshot?.asOf === 'string' ? snapshot.asOf.slice(0,10) : '';
  useEffect(() => {
    setHistoryRecord(null); setHistoryError('');
    if (!historySymbol) return undefined;
    const controller = new AbortController(); let active = true; setHistoryLoading(true);
    requestApi(apiBase,'history',{token,query:{symbol:historySymbol,mode:historyMode},signal:controller.signal})
      .then(result => {
        if (result?.symbol !== historySymbol || !Array.isArray(result.bars) || result.executionEligible !== false || !['eod','demo'].includes(result.quality) || (result.quality === 'demo') !== (historyMode === 'demo')) throw new Error('INVALID_HISTORY_RESPONSE');
        if (active) setHistoryRecord(result);
      }).catch(problem => { if (active && problem.name !== 'AbortError') setHistoryError(problem.message); })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => {active=false;controller.abort();};
  },[apiBase,historySymbol,historyMode,historyDate,token]);
  const now = Date.now();
  const labels = { demo:t('演示', 'Demo'), stale:t('已过期', 'Stale'), delayed:t('延迟行情', 'Delayed'), eod:t('日终行情','End-of-day'), closed:t('休市观察', 'Closed session'), realtime:t('实时源', 'Real-time feed'), observed:t('价格观察', 'Observed'), invalid:t('无效时间', 'Invalid time'), unknown:t('时间未知', 'Time unknown'), unavailable:t('不可用', 'Unavailable') };
  const quality = quoteQuality(quote, snapshot, now, data?.mode);
  const changeSort = key => setSort(old => ({ key, direction: old.key === key && old.direction === 'asc' ? 'desc' : 'asc' }));
  const source = quote?.source || snapshot?.source || data?.capabilities?.market?.provider;
  return <section className="fsi-panel fsi-market" aria-labelledby="fsi-market-title">
    <div className="fsi-panel-heading"><div><p className="fsi-eyebrow">01 / {t('市场观察', 'MARKET OBSERVATIONS')}</p><h2 id="fsi-market-title">{t('价格与来处。', 'Prices, with provenance.')}</h2></div><Pill tone={data?.mode === 'demo' ? 'amber' : 'neutral'}>{data?.mode === 'demo' ? t('演示快照', 'Demo snapshot') : !['provider','demo'].includes(snapshot?.calendarStatus) ? t('交易时段未核验','Session unverified') : snapshot?.marketOpen === true ? t('常规交易时段', 'Regular session') : snapshot?.marketOpen === false ? t('常规交易休市', 'Regular session closed') : t('交易时段待核对', 'Session unverified')}</Pill></div>
    <div className="fsi-market-layout">
      <div className="fsi-quote-focus">
        <div className="fsi-quote-title"><div><span className="fsi-symbol">{quote?.symbol || '—'}</span><span className="fsi-company">{quote?.name || t('选择已接入的标的', 'Select an available instrument')}</span></div>{quote && <Pill tone={['stale','invalid'].includes(quality) ? 'red' : quality === 'demo' ? 'amber' : 'neutral'}>{labels[quality] || quality}</Pill>}</div>
        <div className="fsi-quote-price">{formatMoney(quotePrice(quote), locale, quote?.currency || 'USD')}<span className="fsi-currency">{quote?.currency || 'USD'}</span></div>
        <div className="fsi-quote-change"><Change value={quoteChange(quote)} /><span>{t('相对前收盘', 'vs previous close')}</span></div>
        <PriceChart quote={quote} historyRecord={historyRecord} historyError={historyError} historyLoading={historyLoading} locale={locale} t={t} />
        {data?.capabilities?.market?.feed === 'iex' && data?.mode !== 'demo' && <p className="fsi-feed-note">{t('IEX：仅代表单一交易所报价，不是全美合并行情。','IEX covers one venue; it is not a consolidated US market feed.')}</p>}<dl className="fsi-quote-metadata"><div><dt>{t('来源 / 数据档位', 'Provider / feed')}</dt><dd>{source || '—'}{quote?.feed || data?.capabilities?.market?.feed ? ` · ${quote?.feed || data.capabilities.market.feed}` : ''}</dd></div><div><dt>{t('市场时间', 'Market timestamp')}</dt><dd>{displayTime(quoteTime(quote,snapshot), locale)}</dd></div><div><dt>{t('买价 / 卖价', 'Bid / ask')}</dt><dd>{formatMoney(quote?.bid,locale,quote?.currency || 'USD')} / {formatMoney(quote?.ask,locale,quote?.currency || 'USD')}</dd></div><div><dt>{t('接收时间', 'Received')}</dt><dd>{displayTime(quote?.receivedAt || snapshot?.receivedAt,locale)}</dd></div></dl>
      </div>
      <div className="fsi-watchlist"><label className="fsi-search"><Icon name="search" /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={t('搜索股票代码或公司', 'Find a ticker or company')} aria-label={t('搜索行情', 'Search market observations')} /></label>
        <div className="fsi-table-scroll"><table className="fsi-quotes-table"><caption className="fsi-sr-only">{t('带来源和时间的行情快照', 'Market snapshot with provenance and timestamps')}</caption><thead><tr>{[['symbol',t('标的','Instrument')],['price',t('最新观察','Last observed')],['change',t('涨跌','Change')]].map(([key,label]) => <th scope="col" key={key} aria-sort={sort.key === key ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button onClick={() => changeSort(key)}>{label}<span aria-hidden="true">{sort.key === key ? sort.direction === 'asc' ? ' ↑' : ' ↓' : ' ↕'}</span></button></th>)}</tr></thead><tbody>{rows.map(item => {
          const itemQuality = quoteQuality(item,snapshot,now,data?.mode);
          return <tr key={item.symbol} className={quote?.symbol === item.symbol ? 'is-selected' : ''}><th scope="row"><button className="fsi-ticker-button" onClick={() => setSelected(item.symbol)} aria-pressed={quote?.symbol === item.symbol}><strong>{item.symbol}</strong><small>{item.name || item.source || '—'}</small></button></th><td><span>{formatMoney(quotePrice(item),locale,item.currency || 'USD')}</span><small className={['stale','invalid'].includes(itemQuality) ? 'fsi-negative' : 'fsi-muted'}>{labels[itemQuality] || itemQuality}</small></td><td><Change value={quoteChange(item)} /></td></tr>;
        })}</tbody></table>{!rows.length && <Empty title={quotes.length ? t('没有匹配的标的','No matching instruments') : t('尚无行情快照','No market snapshot yet')}>{quotes.length ? t('试试其他代码或公司名称。','Try another ticker or company name.') : t('连接已授权的数据源，或主动载入演示。','Connect an entitled data provider or explicitly load the demo.')}</Empty>}</div>
        <p className="fsi-table-note">{rows.length} / {quotes.length} {t('只已接入标的', 'configured instruments')} · {t('价格单位按报价货币', 'Prices in quote currency')}</p>
      </div>
    </div>
  </section>;
}

function PortfolioCards({ portfolios, locale, t, canWrite, pending, onAction }) {
  return <section aria-labelledby="fsi-portfolios-title"><div className="fsi-section-heading"><div><p className="fsi-eyebrow">02 / {t('独立模拟账户', 'INDEPENDENT PAPER ACCOUNTS')}</p><h2 id="fsi-portfolios-title">{t('同一市场，不同判断。', 'One market. Independent judgments.')}</h2></div><span className="fsi-muted fsi-small">{t('模拟资金 · 独立账本 · 风控先行', 'Simulated funds · Separate ledgers · Risk checks before fills')}</span></div>
    {portfolios.length ? <div className="fsi-portfolio-grid">{portfolios.map((portfolio,index) => {
      const value = portfolio.valuation || {}, positions = Array.isArray(value.positions) ? value.positions : [];
      return <article className="fsi-portfolio" key={portfolio.id}><div className="fsi-portfolio-top"><span className="fsi-strategy-index">{String(index + 1).padStart(2,'0')}</span><Pill tone={portfolio.paused ? 'amber' : 'neutral'}>{portfolio.paused ? t('已暂停','Paused') : t('模拟账户','Paper account')}</Pill></div><h3>{portfolio.label || portfolio.id}</h3><p className="fsi-model-name">{typeof portfolio.model === 'string' ? portfolio.model.startsWith('demo-') ? t('确定性规则演示 · 未调用真实 LLM','Deterministic demo rules · No real LLM call') : portfolio.model : portfolio.model?.name || t('模型未配置','Model unconfigured')}</p><div className="fsi-equity">{formatMoney(value.equity,locale,value.currency || 'USD')}</div><div className="fsi-return"><Change value={value.totalReturn} ratio /><span>{t('累计模拟收益','cumulative paper return')}</span></div><dl className="fsi-account-metrics"><div><dt>{t('现金','Cash')}</dt><dd>{formatMoney(value.cash,locale,value.currency || 'USD')}</dd></div><div><dt>{t('已实现盈亏','Realized P&L')}</dt><dd>{formatMoney(value.realizedPnl,locale,value.currency || 'USD')}</dd></div><div><dt>{t('累计费用','Fees')}</dt><dd>{formatMoney(value.fees,locale,value.currency || 'USD')}</dd></div><div><dt>{t('持仓数量','Open positions')}</dt><dd>{positions.length}</dd></div></dl>
        <details className="fsi-positions"><summary>{t('查看持仓与浮盈亏','Positions & unrealized P&L')}<span>{positions.length}</span></summary>{positions.length ? <div className="fsi-table-scroll"><table><thead><tr><th>{t('标的','Symbol')}</th><th>{t('数量','Quantity')}</th><th>{t('浮盈亏','Unrealized')}</th></tr></thead><tbody>{positions.map(position => <tr key={position.symbol}><th scope="row">{position.symbol}</th><td>{position.quantity}</td><td>{formatMoney(position.unrealizedPnl,locale,value.currency || 'USD')}</td></tr>)}</tbody></table></div> : <p className="fsi-muted">{t('当前没有持仓。','No open positions.')}</p>}</details>
        <div className="fsi-portfolio-actions"><button className="fsi-button fsi-button--subtle" disabled={!canWrite || !!pending} onClick={() => onAction('run',{profiles:[portfolio.id]})}><Icon name="play" size={15} />{t('运行一次','Run once')}</button><button className="fsi-icon-button" disabled={!canWrite || !!pending} onClick={() => onAction('pause',{ledgerId:portfolio.id,paused:!portfolio.paused})} aria-label={`${portfolio.paused ? t('恢复','Resume') : t('暂停','Pause')} ${portfolio.label || portfolio.id}`}><Icon name={portfolio.paused ? 'play' : 'pause'} size={17} /></button></div>
      </article>;
    })}</div> : <div className="fsi-panel"><Empty title={t('等待模拟账户初始化','Waiting for paper accounts')}>{t('账户和资金由服务端账本提供；连接失败时不生成虚构收益。','Accounts and capital come from the service ledger; a connection failure does not generate sample returns.')}</Empty></div>}
  </section>;
}

function OrderTicket({ data, locale, t, canWrite, pending, onAction }) {
  const [portfolioId,setPortfolioId] = useState(''), [symbol,setSymbol] = useState(''), [side,setSide] = useState('buy'), [quantity,setQuantity] = useState(''), [limitPrice,setLimitPrice] = useState('');
  const portfolios = data?.portfolios || [], quotes = data?.snapshot?.quotes || [];
  const account = portfolioId || portfolios[0]?.id || '', instrument = symbol || quotes[0]?.symbol || '';
  const quote = quotes.find(item => item.symbol === instrument), amount = numeric(quantity), limit = numeric(limitPrice);
  const valid = !!account && !!instrument && amount !== null && amount > 0 && (limitPrice === '' || limit !== null && limit > 0);
  const estimate = amount !== null && quotePrice(quote) !== null ? amount * quotePrice(quote) : null;
  const pendingOrders = Array.isArray(data?.pendingOrders) ? data.pendingOrders : portfolios.flatMap(portfolio => (Array.isArray(portfolio.pendingOrders) ? portfolio.pendingOrders : []).map(order => ({...order,ledgerId:portfolio.id})));
  return <section className="fsi-panel fsi-order-panel"><div className="fsi-panel-heading"><div><p className="fsi-eyebrow">{t('受控模拟执行','CONTROLLED PAPER EXECUTION')}</p><h2>{t('把意图变成可检查的订单。','A reviewable order intent.')}</h2></div><Icon name="lock" /></div>
    <form className="fsi-order-form" onSubmit={event => { event.preventDefault(); if (valid) onAction('order',{ledgerId:account,order:{symbol:instrument,side,quantity:amount,type:limitPrice === '' ? 'market' : 'limit',...(limitPrice === '' ? {} : {limitPrice:limit}),snapshotId:data?.snapshot?.id}}); }}>
      <label>{t('模拟账户','Paper account')}<select value={account} onChange={event => setPortfolioId(event.target.value)}><option value="" disabled>{t('选择账户','Select account')}</option>{portfolios.map(item => <option key={item.id} value={item.id}>{item.label || item.id}</option>)}</select></label><label>{t('标的','Instrument')}<select value={instrument} onChange={event => setSymbol(event.target.value)}><option value="" disabled>{t('选择标的','Select instrument')}</option>{quotes.map(item => <option key={item.symbol} value={item.symbol}>{item.symbol}</option>)}</select></label><label>{t('方向','Side')}<select value={side} onChange={event => setSide(event.target.value)}><option value="buy">{t('买入','Buy')}</option><option value="sell">{t('卖出','Sell')}</option></select></label><label>{t('数量','Quantity')}<input type="number" step="any" min="0" inputMode="decimal" value={quantity} onChange={event => setQuantity(event.target.value)} placeholder="0" required /></label><label>{t('限价（留空为市价模拟）','Limit price (blank for paper market)')}<input type="number" step="any" min="0" inputMode="decimal" value={limitPrice} onChange={event => setLimitPrice(event.target.value)} placeholder={t('可选','Optional')} /></label><div className="fsi-order-estimate"><span>{t('按最新观察估算','At last observed price')}</span><strong>{formatMoney(estimate,locale,quote?.currency || 'USD')}</strong><small>{t('实际模拟成交取决于行情、成本和风控。','Paper fills depend on quotes, costs and risk checks.')}</small></div><button className="fsi-button fsi-button--primary" disabled={!canWrite || !!pending || !valid} type="submit">{t('提交模拟单','Submit paper order')}<Icon name="arrow" /></button>
    </form>
    {!!pendingOrders.length && <div className="fsi-pending-orders"><h3>{t('待成交模拟单','Pending paper orders')}</h3>{pendingOrders.map(order => <div key={order.id}><span><strong>{order.symbol}</strong> · {order.side} {order.quantity} · {order.status}</span><button className="fsi-button fsi-button--subtle" disabled={!canWrite || !!pending} onClick={() => onAction('cancel',{orderId:order.id,ledgerId:order.ledgerId || order.portfolioId})}>{t('撤销','Cancel')}</button></div>)}</div>}
  </section>;
}

function DcfPanel({ data, locale, t, canWrite, pending, onAction }) {
  const [inputs,setInputs] = useState({baseFreeCashFlow:'',sharesOutstanding:'',cash:'',debt:'',bearGrowthRate:'5',growthRate:'10',bullGrowthRate:'15',discountRate:'10',terminalGrowthRate:'2.5',years:'5',asOf:new Date().toISOString().slice(0,10)});
  const [result,setResult] = useState(null);
  const fields = [
    ['baseFreeCashFlow',t('基期企业自由现金流 FCFF · 百万美元','Base unlevered FCFF · USD millions')],['sharesOutstanding',t('稀释后股数 · 百万股','Diluted shares · millions')],['cash',t('非经营性现金 · 百万美元','Non-operating cash · USD millions')],['debt',t('有息债务 · 百万美元','Debt · USD millions')],['bearGrowthRate',t('悲观情景年增长 · %','Bear annual growth · %')],['growthRate',t('基准情景年增长 · %','Base annual growth · %')],['bullGrowthRate',t('乐观情景年增长 · %','Bull annual growth · %')],['discountRate',t('三情景共用 WACC · %','Shared scenario WACC · %')],['terminalGrowthRate',t('三情景共用永续增长 · %','Shared terminal growth · %')],['years',t('预测年数','Forecast years')],
  ];
  const current = result || data?.research?.dcf || null;
  const model = current?.model || current?.data?.model || current?.data || current;
  let request = null;
  try { request = buildDcfInput(inputs); } catch { /* Incomplete form: the calculate button stays disabled. */ }
  const valid = !!request;
  const sensitivity = model?.sensitivity || current?.sensitivity;
  const matrix = sensitivity && Array.isArray(sensitivity.grid) ? sensitivity : null;
  const scenarios = model?.scenarios;
  const submit = async event => {
    event.preventDefault(); if (!valid) return;
    const reply = await onAction('research',{kind:'dcf',input:request});
    if (reply) setResult(reply.result || reply.research?.dcf || reply);
  };
  return <section className="fsi-panel"><div className="fsi-panel-heading"><div><p className="fsi-eyebrow">{t('估值工作底稿','VALUATION WORKPAPER')}</p><h2>{t('让假设可以修改。','Make assumptions editable.')}</h2></div><Pill>{t('DCF 模型','DCF model')}</Pill></div><p className="fsi-panel-lead">{t('以有来源的自由现金流和资本结构为起点。折现率与永续增长率应明确区分；计算结果属于模型估值。','Start with sourced cash flow and capital structure. Keep the discount rate and terminal growth explicit; the output is a model valuation.')}</p>
    <form onSubmit={submit}><div className="fsi-dcf-inputs">{fields.map(([key,label]) => <label key={key}>{label}<input type="number" step={key === 'years' ? '1' : 'any'} value={inputs[key]} onChange={event => setInputs(old => ({...old,[key]:event.target.value}))} required placeholder="—" min={['cash','debt'].includes(key) ? '0' : key === 'years' ? '1' : undefined} max={key === 'years' ? '15' : undefined} /></label>)}<label>{t('估值截止日 · UTC','Valuation cutoff date · UTC')}<input type="date" value={inputs.asOf} onChange={event => setInputs(old => ({...old,asOf:event.target.value}))} max={new Date().toISOString().slice(0,10)} required /></label></div><div className="fsi-form-footer"><small>{t('年末折现；FCFF 按各情景增长率逐年推算；敏感性步长为 0.5 个百分点。股数会转换成实际股数；净债务桥接只计入一次现金。','Year-end discounting; FCFF grows at each scenario’s stated rate. Sensitivity steps are 0.5 percentage points. Shares convert to actual count; the net-debt bridge accounts for cash once.')}</small><button type="submit" className="fsi-button fsi-button--primary" disabled={!canWrite || !!pending || !valid}>{t('计算与生成敏感性表','Calculate & compare assumptions')}<Icon name="arrow" /></button></div>{data?.mode === 'demo' && <button type="button" className="fsi-button fsi-button--subtle fsi-demo-assumptions" onClick={() => setInputs(old => ({...old,baseFreeCashFlow:'1000',sharesOutstanding:'200',cash:'500',debt:'100'}))}>{t('填入明确虚构的演示假设','Fill fictional demo assumptions')}</button>}</form>
    {model && <div className="fsi-dcf-output">{scenarios ? <div className="fsi-dcf-values">{[['bear',t('悲观情景 · 美元/股','Bear · USD/share')],['base',t('基准情景 · 美元/股','Base · USD/share')],['bull',t('乐观情景 · 美元/股','Bull · USD/share')]].map(([key,label]) => <div key={key}><span>{label}</span><strong>{formatMoney(scenarios[key]?.pricePerShare,locale)}</strong></div>)}</div> : <p className="fsi-muted">{t('服务未返回完整三情景结果。','The service did not return all three scenario results.')}</p>}
      {scenarios?.base && <p className="fsi-dcf-bridge">{t('基准企业价值','Base enterprise value')}: {formatMoney(scenarios.base.enterpriseValue,locale)} · {t('股权价值','Equity value')}: {formatMoney(scenarios.base.equityValue,locale)} · {t('以上金额单位：百万美元','Amounts above: USD millions')}</p>}
      {matrix && <div className="fsi-table-scroll"><table className="fsi-sensitivity"><caption>{t('敏感性分析：行 = WACC，列 = 永续增长率；单元格为美元/股。','Sensitivity: rows = WACC, columns = terminal growth; cells = USD/share.')}</caption><thead><tr><th>WACC / g</th>{matrix.growthValues.map((value,index) => <th key={index}>{signed(value * 100,'%')}</th>)}</tr></thead><tbody>{matrix.grid.map((row,index) => <tr key={index}><th>{signed(matrix.waccValues[index] * 100,'%')}</th>{row.map((cell,column) => <td key={column} className={index === 2 && column === 2 ? 'is-base' : ''} title={cell.valid ? t('有效模型假设','Valid model assumptions') : cell.reason}>{cell.valid ? formatMoney(cell.pricePerShare,locale) : '—'}</td>)}</tr>)}</tbody></table></div>}
      {!matrix && <p className="fsi-muted">{t('服务尚未返回敏感性结果。','The service has not returned a sensitivity table.')}</p>}
      {scenarios?.base?.schedule && <details className="fsi-raw"><summary>{t('查看逐年 FCFF 预测与折现','Inspect annual FCFF forecasts and discounting')}</summary><div className="fsi-table-scroll"><table><thead><tr><th>{t('年','Year')}</th><th>{t('悲观 FCFF','Bear FCFF')}</th><th>{t('基准 FCFF','Base FCFF')}</th><th>{t('乐观 FCFF','Bull FCFF')}</th><th>{t('基准现值','Base present value')}</th></tr></thead><tbody>{scenarios.base.schedule.map((row,index) => <tr key={row.year}><th>{row.year}</th><td>{formatMoney(scenarios.bear?.schedule?.[index]?.fcff,locale)}</td><td>{formatMoney(row.fcff,locale)}</td><td>{formatMoney(scenarios.bull?.schedule?.[index]?.fcff,locale)}</td><td>{formatMoney(row.presentValue,locale)}</td></tr>)}</tbody></table></div></details>}<Sources sources={current.sources || model.sources} t={t} /></div>}
  </section>;
}

function ThesisReview({ thesis, t, canWrite, pending, onAction }) {
  const [description,setDescription] = useState(''), [nextStatus,setNextStatus] = useState('');
  const transitions = {active:['challenged','invalidated','closed'],challenged:['active','invalidated','closed'],invalidated:['closed'],closed:[]};
  const labels = {active:t('有效','Active'),challenged:t('受到挑战','Challenged'),invalidated:t('已失效','Invalidated'),closed:t('已归档','Closed')};
  const options = transitions[thesis.status] || [];
  if (!options.length) return null;
  return <details className="fsi-compose"><summary>{t('记录复核与状态变更','Record review and status change')}</summary><form onSubmit={async event => {event.preventDefault();const reply=await onAction('thesis',{operation:'update',id:thesis.id,update:{id:globalThis.crypto?.randomUUID?.() || `review-${Date.now()}`,type:'review',description,nextStatus:nextStatus || options[0]}});if(reply)setDescription('');}}><label>{t('复核说明','Review explanation')}<textarea rows={2} value={description} onChange={event => setDescription(event.target.value)} minLength={3} maxLength={4000} required /></label><label>{t('新的论点状态','New thesis state')}<select value={nextStatus || options[0]} onChange={event => setNextStatus(event.target.value)}>{options.map(status => <option value={status} key={status}>{labels[status]}</option>)}</select></label><button className="fsi-button fsi-button--subtle" disabled={!canWrite || !!pending || description.trim().length < 3}>{t('提交复核','Submit review')}</button></form></details>;
}

function CatalystResolution({ catalyst, t, canWrite, pending, onAction }) {
  const [outcome,setOutcome] = useState('');
  if (catalyst.status !== 'scheduled' || Date.parse(catalyst.expectedAt) > Date.now()) return null;
  return <details className="fsi-compose"><summary>{t('记录实际结果','Record the realized outcome')}</summary><form onSubmit={async event => {event.preventDefault();const reply=await onAction('catalyst',{operation:'resolve',id:catalyst.id,outcome});if(reply)setOutcome('');}}><label>{t('实际结果与核对依据','Outcome and verification basis')}<textarea value={outcome} onChange={event => setOutcome(event.target.value)} minLength={3} maxLength={2000} rows={3} required /></label><button className="fsi-button fsi-button--subtle" disabled={!canWrite || !!pending || outcome.trim().length < 3}>{t('确认结果','Record outcome')}</button></form></details>;
}

function EvidenceImport({ evidence, t, canWrite, pending, onAction }) {
  const [raw,setRaw] = useState(''), [publicConsent,setPublicConsent] = useState(false), [importError,setImportError] = useState('');
  const example = JSON.stringify([{id:'filing-001',title:'Public filing title',kind:'filing',url:'https://www.sec.gov/Archives/edgar/data/...',publishedAt:'2026-10-01T12:00:00Z',availableAt:'2026-10-01T12:00:00Z'}],null,2);
  return <details className="fsi-evidence-import"><summary>{t('公开证据库与 JSON 导入','Public evidence register & JSON import')}<span>{evidence.length}</span></summary><div className="fsi-evidence-body"><p>{t('仅导入你确认可公开展示的来源元数据。时间与结构校验不等于来源内容已经被独立核实。','Import source metadata you confirm may be displayed publicly. Structural and timestamp checks do not independently authenticate source content.')}</p>{!!evidence.length && <ul className="fsi-evidence-list">{evidence.map(item => <li key={item.id}><code>{item.id}</code><span>{item.title}</span><Sources sources={[item]} t={t} /></li>)}</ul>}<form onSubmit={async event => {event.preventDefault();setImportError('');try {const sources=JSON.parse(raw);if(!Array.isArray(sources)||!sources.length)throw new Error(t('需要非空来源数组。','A nonempty sources array is required.'));const reply=await onAction('research',{kind:'evidence',input:{visibility:'public',sources}});if(reply){setRaw('');setPublicConsent(false);}}catch(problem){setImportError(problem.message);}}}><label>{t('来源数组 JSON','Source array JSON')}<textarea value={raw} onChange={event => setRaw(event.target.value)} rows={8} maxLength={120000} spellCheck={false} placeholder={example} required /></label><label className="fsi-checkbox"><input type="checkbox" checked={publicConsent} onChange={event => setPublicConsent(event.target.checked)} />{t('我确认这些来源元数据可以公开展示。','I confirm this source metadata may be displayed publicly.')}</label>{importError && <p role="alert" className="fsi-negative">{importError}</p>}<button className="fsi-button fsi-button--subtle" disabled={!canWrite || !!pending || !publicConsent || !raw.trim()}>{t('校验并导入公开证据','Validate and import public evidence')}</button></form></div></details>;
}

function ResearchPanel({ data, locale, t, canWrite, pending, onAction }) {
  const research = data?.research || {}, brief = research.brief;
  const [thesis,setThesis] = useState({symbol:'',title:'',thesis:'',invalidation:''});
  const [catalyst,setCatalyst] = useState({symbol:'',title:'',expectedAt:'',sourceIds:[]});
  const evidence = Array.isArray(research.evidence) ? research.evidence : [];
  return <div className="fsi-research-layout"><DcfPanel data={data} locale={locale} t={t} canWrite={canWrite} pending={pending} onAction={onAction} /><section className="fsi-panel"><div className="fsi-panel-heading"><div><p className="fsi-eyebrow">{t('带证据的研究','RESEARCH WITH EVIDENCE')}</p><h2>{t('把判断写下来。','Write the judgment down.')}</h2></div><button className="fsi-button fsi-button--subtle" disabled={!canWrite || !!pending} onClick={() => onAction('research',{kind:'brief'})}>{t('生成研究简报','Generate brief')}<Icon name="arrow" size={16} /></button></div>
      {brief ? <article className="fsi-brief"><h3>{brief.title || t('最新研究简报','Latest research brief')}</h3><p className="fsi-prose">{typeof brief === 'string' ? brief : brief.content || brief.markdown || brief.summary || brief.text || t('简报正文未返回。','Brief content was not returned.')}</p>{Array.isArray(brief.bullets) && <ul>{brief.bullets.map((item,index) => <li key={index}>{typeof item === 'string' ? item : item.text}</li>)}</ul>}<Sources sources={brief.sources} t={t} /><small className="fsi-muted">{displayTime(brief.asOf || brief.createdAt,locale,true)}</small></article> : <Empty title={t('尚无研究简报','No research brief yet')}>{t('生成前先确认行情和研究来源；模型输出保留引用与时间。','Confirm market and research sources first. Model output keeps citations and timestamps.')}</Empty>}
      <EvidenceImport evidence={evidence} t={t} canWrite={canWrite} pending={pending} onAction={onAction} />
      <div className="fsi-research-columns"><div><h3>{t('投资论点与失效条件','Theses & invalidation conditions')}</h3>{Array.isArray(research.theses) && research.theses.length ? <div className="fsi-record-list">{research.theses.map((item,index) => <article key={item.id || index}><div><Pill>{item.symbol || t('组合','Portfolio')}</Pill><small>{item.status || ''}{item.revision ? ` · r${item.revision}` : ''}</small></div><h4>{item.title || item.statement || item.thesis}</h4>{item.title && <p>{item.thesis || item.summary}</p>}<p className="fsi-invalidation"><strong>{t('失效条件','Invalidation')}: </strong>{item.invalidation || item.stopTrigger || item.invalidationCondition || '—'}</p><Sources sources={item.sources} t={t} /><ThesisReview thesis={item} t={t} canWrite={canWrite} pending={pending} onAction={onAction} /></article>)}</div> : <p className="fsi-muted">{t('先记录可检验的论点，再评估结果。','Record a testable thesis before evaluating the result.')}</p>}
        <details className="fsi-compose"><summary>{t('记录新论点','Record a new thesis')}</summary><form onSubmit={async event => {event.preventDefault(); const reply = await onAction('thesis',{operation:'create',input:{id:globalThis.crypto?.randomUUID?.() || `thesis-${Date.now()}`,symbol:thesis.symbol,statement:`${thesis.title}: ${thesis.thesis}`,pillars:[{id:'core',expectation:thesis.thesis,invalidation:thesis.invalidation}],risks:[thesis.invalidation],stopTrigger:thesis.invalidation,side:'long',conviction:'medium'}}); if (reply) setThesis({symbol:'',title:'',thesis:'',invalidation:''});}}><label>{t('股票代码','Ticker')}<input value={thesis.symbol} onChange={event => setThesis(old => ({...old,symbol:event.target.value.toUpperCase()}))} maxLength={16} required /></label><label>{t('论点标题','Thesis title')}<input value={thesis.title} onChange={event => setThesis(old => ({...old,title:event.target.value}))} maxLength={160} required /></label><label>{t('依据与预期','Evidence & expectation')}<textarea value={thesis.thesis} onChange={event => setThesis(old => ({...old,thesis:event.target.value}))} maxLength={4000} rows={3} required /></label><label>{t('何时承认判断失效','What would invalidate the thesis')}<textarea value={thesis.invalidation} onChange={event => setThesis(old => ({...old,invalidation:event.target.value}))} maxLength={2000} rows={2} required /></label><p className="fsi-muted fsi-small">{t('新论点以做多方向、中等确信度记录；复核只更新论点，不自动修改持仓。','New theses record a long direction and medium conviction. A review updates the thesis without changing positions.')}</p><button className="fsi-button fsi-button--primary" disabled={!canWrite || !!pending}>{t('保存论点','Save thesis')}</button></form></details>
      </div><div><h3>{t('催化剂日历','Catalyst calendar')}</h3>{Array.isArray(research.catalysts) && research.catalysts.length ? <div className="fsi-record-list">{research.catalysts.map((item,index) => <article key={item.id || index}><div><Pill>{item.symbol || t('市场','Market')}</Pill><small>{item.status || ''}</small></div><h4>{item.title || item.event}</h4><p>{displayTime(item.expectedAt || item.date,locale,true)}</p><p>{item.outcome || item.description || item.impact || ''}</p><Sources sources={item.sources || (item.sourceIds || []).map(id => evidence.find(source => source.id === id)).filter(Boolean)} t={t} /><CatalystResolution catalyst={item} t={t} canWrite={canWrite} pending={pending} onAction={onAction} /></article>)}</div> : <p className="fsi-muted">{t('财报、政策与产品事件需要可核对的来源。','Earnings, policy and product events need verifiable sources.')}</p>}
        <details className="fsi-compose"><summary>{t('添加催化剂','Add a catalyst')}</summary><form onSubmit={async event => {event.preventDefault(); const reply = await onAction('catalyst',{operation:'create',event:{...catalyst,expectedAt:new Date(catalyst.expectedAt).toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone}}); if (reply) setCatalyst({symbol:'',title:'',expectedAt:'',sourceIds:[]});}}><label>{t('股票代码','Ticker')}<input value={catalyst.symbol} onChange={event => setCatalyst(old => ({...old,symbol:event.target.value.toUpperCase()}))} maxLength={16} required /></label><label>{t('事件','Event')}<input value={catalyst.title} onChange={event => setCatalyst(old => ({...old,title:event.target.value}))} minLength={3} maxLength={200} required /></label><label>{t('预期时间（你的本地时区）','Expected time (your local timezone)')}<input type="datetime-local" value={catalyst.expectedAt} onChange={event => setCatalyst(old => ({...old,expectedAt:event.target.value}))} required /></label><label>{t('选择已导入的公开证据（可多选）','Select imported public evidence (multiple allowed)')}<select multiple size={Math.min(4,Math.max(2,evidence.length))} value={catalyst.sourceIds} onChange={event => setCatalyst(old => ({...old,sourceIds:Array.from(event.target.selectedOptions,option => option.value)}))} required>{evidence.map(source => <option key={source.id} value={source.id}>{source.id} · {source.title}</option>)}</select></label>{!evidence.length && <p className="fsi-muted fsi-small">{t('先在上方证据库导入来源，再添加有据可查的事件。','Import sources into the evidence register above before recording a sourced event.')}</p>}<button className="fsi-button fsi-button--primary" disabled={!canWrite || !!pending || !catalyst.sourceIds.length}>{t('保存事件','Save event')}</button></form></details>
      </div></div>
    </section></div>;
}

function TraceList({ run, t, locale }) {
  const raw = run?.trace || run?.stages || [];
  const trace = Array.isArray(raw) ? raw : Object.entries(raw).map(([stage,value]) => ({stage,...(typeof value === 'object' ? value : {summary:value})}));
  const groups = Array.isArray(run.results) && run.results.length ? run.results : [{profileId:run.profileId || '',steps:trace}];
  const labels = {analyst:t('分析师','Analyst'),critic:t('复核者','Critic'),risk:t('风控','Risk'),fill:t('模拟成交','Paper fill'),execution:t('模拟成交','Paper fill')};
  return <article className="fsi-run"><header><div><h3>{run.label || run.model || run.portfolioId || t('模拟研究回合','Paper research run')}</h3><small>{displayTime(run.createdAt || run.startedAt || run.asOf,locale,true)}</small></div><Pill tone={['failed','rejected'].includes(run.status) ? 'red' : 'neutral'}>{run.status || t('已记录','Recorded')}</Pill></header><dl className="fsi-run-meta"><div><dt>{t('回合','Run')}</dt><dd>{run.id || '—'}</dd></div><div><dt>{t('观察快照','Snapshot')}</dt><dd>{run.snapshotId || run.snapshot?.id || '—'}</dd></div><div><dt>{t('推理费用','Inference cost')}</dt><dd>{formatMoney(run.costUsd ?? run.usage?.costUsd,locale)}</dd></div></dl>
    {groups.some(group => group.steps?.length) ? groups.map((group,groupIndex) => <div className="fsi-trace-group" key={group.profileId || groupIndex}>{group.profileId && <h4>{group.profileId} · {group.model || t('独立策略','Independent strategy')}<small>{group.status || ''}</small></h4>}<ol className="fsi-trace">{(group.steps || []).map((stage,index) => <li key={stage.id || `${stage.stage || stage.name}-${index}`}><span className={`fsi-trace-marker ${['rejected','failed','blocked','error'].includes(stage.status) ? 'is-blocked' : ''}`}>{index+1}</span><div><div className="fsi-trace-title"><strong>{labels[stage.stage || stage.name] || stage.stage || stage.name || `${t('步骤','Step')} ${index+1}`}</strong><small>{stage.status || ''}</small></div><p>{stage.summary || stage.reason || stage.detail || stage.message || stage.orderId || stage.output?.summary || t('结构化结果见本回合原始记录。','See this run’s structured record for the result.')}</p></div></li>)}</ol></div>) : <p className="fsi-muted">{t('本回合没有返回分阶段记录。','No stage trace was returned for this run.')}</p>}
    <details className="fsi-raw"><summary>{t('查看本回合结构化记录','Inspect structured run record')}</summary><pre>{JSON.stringify(exportSnapshot(run),null,2)}</pre></details>
  </article>;
}

function FeedbackPanel({ data, locale, t, canWrite, pending, onAction }) {
  const feedback = data?.feedback || {};
  const count = numeric(feedback.count ?? feedback.sampleSize ?? feedback.resolvedCount ?? feedback.samples) || 0;
  const minimum = numeric(feedback.minimumRequired ?? feedback.minimumSamples ?? feedback.minSamples) || 30;
  const brier = numeric(feedback.metrics?.brier ?? feedback.brierScore ?? feedback.brier);
  const rows = Array.isArray(feedback.cohorts) ? feedback.cohorts : Array.isArray(feedback.models) ? feedback.models : [];
  const insufficient = !rows.length || rows.some(row => numeric(row.count) < (numeric(row.minimumRequired) || minimum));
  return <section className="fsi-panel fsi-feedback"><div className="fsi-panel-heading"><div><p className="fsi-eyebrow">{t('反馈闭环','FEEDBACK LOOP')}</p><h2>{t('让结果反过来检验判断。','Let outcomes test the judgment.')}</h2></div><button className="fsi-button fsi-button--subtle" disabled={!canWrite || !!pending} onClick={() => onAction('feedback',{})}>{t('更新反馈','Update feedback')}<Icon name="refresh" size={16} /></button></div><div className="fsi-feedback-metrics"><div><span>{t('已结算预测','Resolved predictions')}</span><strong>{count}</strong></div><div><span>{t('同组 Brier · 越低越好','Cohort Brier · lower is better')}</span><strong>{brier === null ? '—' : brier.toFixed(4)}</strong></div><div><span>{t('未结算预测','Pending predictions')}</span><strong>{numeric(feedback.unresolved ?? feedback.pendingCount) ?? '—'}</strong></div><div><span>{t('同组对数损失','Cohort log loss')}</span><strong>{numeric(feedback.metrics?.logLoss) === null ? '—' : Number(feedback.metrics.logLoss).toFixed(4)}</strong></div></div><div className={`fsi-feedback-note ${insufficient ? 'is-insufficient' : ''}`}><Pill tone={insufficient ? 'amber' : 'green'}>{insufficient ? t('样本不足','Insufficient sample') : t('达到观察门槛','Observation threshold met')}</Pill><p>{insufficient ? t(`共结算 ${count} 个预测；每个可比队列至少需要 ${minimum} 个。暂不据此给模型排名。`,`There are ${count} resolved forecasts; each comparable cohort requires at least ${minimum}. No model ranking is shown.`) : t('不同版本、预测期限和数据类型保持分组。样本门槛不代表统计显著性，反馈只形成待验证的新版本建议。','Versions, forecast horizons and data types remain separate. A sample threshold does not establish significance; feedback proposes a new version for future validation.')}</p></div>
    <p className="fsi-muted fsi-small">{t(`预测事件为区间内股价正收益，不含股息。超过结算窗口的预测 ${numeric(feedback.expired) ?? 0} 条；因公司行动等原因失效 ${numeric(feedback.invalidated) ?? 0} 条；这些记录不计入评分。`,`The forecast event is a positive price return over its horizon, excluding dividends. ${numeric(feedback.expired) ?? 0} forecasts expired outside the settlement window; ${numeric(feedback.invalidated) ?? 0} were invalidated, including by corporate actions. These records are excluded from scoring.`)}</p>
    {!!rows.length && <div className="fsi-table-scroll"><table><thead><tr><th>{t('模型 / 比较队列','Model / cohort')}</th><th>{t('样本','Samples')}</th><th>Brier</th><th>{t('状态','Status')}</th></tr></thead><tbody>{rows.map((row,index) => <tr key={`${row.modelId || row.id || index}-${row.cohort || ''}`}><th scope="row">{row.label || row.modelId || row.model || row.id}<small className="fsi-cohort-label">{row.modelVersion || ''}<br />{row.cohort || ''}</small></th><td>{row.count ?? row.sampleSize ?? row.samples ?? 0} / {row.minimumRequired || minimum}</td><td>{numeric(row.metrics?.brier ?? row.brierScore ?? row.brier) === null ? '—' : Number(row.metrics?.brier ?? row.brierScore ?? row.brier).toFixed(4)}</td><td>{row.status === 'ready' ? t('可观察','Ready to inspect') : t('样本不足','Insufficient')}</td></tr>)}</tbody></table></div>}
    {!!rows.length && <details className="fsi-raw"><summary>{t('查看概率分箱与观测频率','Inspect probability bins and observed frequencies')}</summary>{rows.map((row,index) => <div className="fsi-table-scroll" key={index}><table><caption>{row.modelId} · {row.cohort}</caption><thead><tr><th>{t('预测概率区间','Predicted probability')}</th><th>n</th><th>{t('平均预测','Mean forecast')}</th><th>{t('实际发生率','Observed frequency')}</th></tr></thead><tbody>{(row.reliability || []).map((bin,i) => <tr key={i}><td>{`${(bin.lower*100).toFixed(0)}–${(bin.upper*100).toFixed(0)}%`}</td><td>{bin.count}</td><td>{numeric(bin.meanProbability) === null ? '—' : `${(bin.meanProbability*100).toFixed(1)}%`}</td><td>{numeric(bin.observedFrequency) === null ? '—' : `${(bin.observedFrequency*100).toFixed(1)}%`}</td></tr>)}</tbody></table></div>)}</details>}
    {feedback.summary && <p className="fsi-prose">{feedback.summary}</p>}{Array.isArray(feedback.actions) && !!feedback.actions.length && <ul className="fsi-feedback-actions">{feedback.actions.map((action,index) => <li key={index}>{typeof action === 'string' ? action : action.description || action.action}</li>)}</ul>}
  </section>;
}

function Connections({ data, t, locale }) {
  const capabilities = data?.capabilities || {}, market = capabilities.market || {}, ai = capabilities.ai || {}, storage = capabilities.storage || {};
  const legacy = capabilities.legacy || data?.legacy || {};
  const items = [{name:t('市场数据','Market data'),ready:market.configured,detail:[market.provider,market.feed].filter(Boolean).join(' · ')},{name:t('AI 分析','AI analysis'),ready:ai.configured,detail:Array.isArray(ai.profiles) ? ai.profiles.map(profile => typeof profile === 'string' ? profile : profile.label || profile.id).join(' · ') : ''},{name:t('账本持久化','Ledger persistence'),ready:storage.persistent,detail:storage.provider || storage.kind || ''}];
  return <section className="fsi-panel"><div className="fsi-panel-heading"><div><p className="fsi-eyebrow">{t('连接与边界','CONNECTIONS & BOUNDARIES')}</p><h2>{t('每一项能力，都有明确状态。','A clear state for every capability.')}</h2></div></div><div className="fsi-connection-grid">{items.map(item => <article key={item.name}><Pill tone={item.ready ? 'green' : 'amber'}>{item.ready ? t('已配置','Configured') : t('未配置','Unconfigured')}</Pill><h3>{item.name}</h3><p>{item.detail || t('等待服务端配置','Awaiting server configuration')}</p></article>)}</div>
    <div className="fsi-connection-detail"><h3>{t('原有日线研究','Existing daily research')}</h3><p>{legacy.status || legacy.reason || legacy.research || (legacy.enabled === true ? t('已启用','Enabled') : legacy.enabled === false ? t('功能未启用','Feature disabled') : t('通过状态服务核对原有研究接口。','Check existing research routes through the status service.'))}</p><p className="fsi-muted">{t('日线、SEC 披露、估值与模型输出各有时间和来源；连接状态不会把历史数据改成实时行情。','Daily bars, SEC filings, valuations and model output keep their own dates and sources. Connection status does not turn history into real-time quotes.')}</p></div>
    {!!data?.connectors?.length && <div className="fsi-table-scroll"><table><caption>{t('研究连接器','Research connectors')}</caption><thead><tr><th>{t('连接器','Connector')}</th><th>{t('状态','State')}</th><th>{t('能力','Capability')}</th></tr></thead><tbody>{data.connectors.map((item,index) => <tr key={item.id || index}><th scope="row">{item.name || item.id}</th><td>{item.status || (item.configured ? t('已配置','Configured') : t('未配置','Unconfigured'))}</td><td>{Array.isArray(item.capabilities) ? item.capabilities.join(', ') : item.description || item.capability || '—'}</td></tr>)}</tbody></table></div>}
    <dl className="fsi-connection-meta"><div><dt>{t('服务时间','Service time')}</dt><dd>{displayTime(data?.serverTime,locale,true)}</dd></div><div><dt>{t('行情日历','Market calendar')}</dt><dd>{typeof data?.snapshot?.calendarStatus === 'string' ? data.snapshot.calendarStatus : data?.snapshot?.calendarStatus?.status || '—'}</dd></div><div><dt>{t('快照 ID','Snapshot ID')}</dt><dd>{data?.snapshot?.id || '—'}</dd></div></dl>
  </section>;
}

export default function ArenaFsi({ locale: suppliedLocale, apiBase = '/api/arena-fsi', legacyResearch = null, initialState = null }) {
  const [locale,setLocale] = useState(() => suppliedLocale === 'zh' ? 'zh' : suppliedLocale === 'en' ? 'en' : typeof document !== 'undefined' && document.documentElement.lang.startsWith('zh') ? 'zh' : 'en');
  const t = useCallback((zh,en) => locale === 'zh' ? zh : en,[locale]);
  const [data,setData] = useState(() => initialState ? normalizeStatus(initialState) : null), [view,setView] = useState('status');
  const [tab,setTab] = useState('overview'), [token,setToken] = useState(''), [readToken,setReadToken] = useState(''), [error,setError] = useState(''), [notice,setNotice] = useState('');
  const [pending,setPending] = useState(''), [loading,setLoading] = useState(false), [lastSync,setLastSync] = useState(null), [legacyOpen,setLegacyOpen] = useState(false);
  const pollController = useRef(null), actionController = useRef(null), actionBusy = useRef(false), retryIdentity = useRef(null), mounted = useRef(true), viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => { if (suppliedLocale === 'en' || suppliedLocale === 'zh') setLocale(suppliedLocale); },[suppliedLocale]);
  useEffect(() => {const timer=setTimeout(() => setReadToken(token),350);return () => clearTimeout(timer);},[token]);
  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    document.documentElement.dataset.afflatusLocale = locale;
    document.title = locale === 'zh' ? 'Arena · 研究与模拟交易 · AFFLATUS' : 'Arena · Research & paper trading · AFFLATUS';
    document.querySelectorAll('#afflatus-header [data-en], .pa-footer [data-en]').forEach(element => {const value=element.dataset[locale];if(value !== undefined)element.textContent=value;});
    document.querySelectorAll('#afflatus-header [data-aria-en], .pa-footer [data-aria-en]').forEach(element => {const value=element.getAttribute(locale === 'zh' ? 'data-aria-zh' : 'data-aria-en');if(value)element.setAttribute('aria-label',value);});
    document.querySelectorAll('#afflatus-header [data-header-path]').forEach(element => {const path=element.getAttribute('data-header-path');if(path?.startsWith('/'))element.setAttribute('href',`/${locale}${path}`);});
    const toggle=document.querySelector('#afflatus-header [data-header-language]');
    if(toggle){const path=window.location.pathname.replace(/^\/(en|zh)(?=\/)/,'');toggle.textContent=locale === 'zh' ? 'EN' : '中文';toggle.setAttribute('href',`/${locale === 'zh' ? 'en' : 'zh'}${path}`);toggle.setAttribute('hreflang',locale === 'zh' ? 'en' : 'zh-CN');toggle.setAttribute('aria-label',locale === 'zh' ? 'Switch to English' : '切换至中文');}
  },[locale]);
  const refreshStatus = useCallback(async ({signal,quiet=false} = {}) => {
    if (!quiet) setLoading(true);
    const requestedView = viewRef.current, mode = requestedView === 'demo' ? 'demo' : 'live';
    try { const reply = await requestApi(apiBase,'status',{signal,token:readToken,query:{mode}}); const status = normalizeStatus(reply); if(status.mode !== mode)throw new Error('WRONG_RESPONSE_MODE'); if (mounted.current && viewRef.current === requestedView) { setData(status); setLastSync(Date.now()); setError(''); } return status; }
    catch (problem) { if (problem.name !== 'AbortError' && mounted.current && viewRef.current === requestedView) setError(problem.message); return null; }
    finally { if (mounted.current && !quiet) setLoading(false); }
  },[apiBase,readToken]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; pollController.current?.abort(); actionController.current?.abort(); };
  },[]);
  useEffect(() => {
    let active = true;
    const sync = () => { if (!active || document.hidden) return; pollController.current?.abort(); pollController.current = new AbortController(); refreshStatus({signal:pollController.current.signal,quiet:true}); };
    sync(); const timer = window.setInterval(sync,15000);
    const visibility = () => { if (document.hidden) pollController.current?.abort(); else sync(); };
    document.addEventListener('visibilitychange',visibility);
    return () => { active = false; window.clearInterval(timer); pollController.current?.abort(); document.removeEventListener('visibilitychange',visibility); };
  },[view,refreshStatus]);
  const loadDemo = async () => {
    if (actionBusy.current) return; actionBusy.current = true; setPending('demo'); setError('');
    try { const reply = await requestApi(apiBase,'demo'); const demo = normalizeStatus(reply); if (demo.mode !== 'demo') throw new Error('INVALID_DEMO_RESPONSE'); pollController.current?.abort(); viewRef.current = 'demo'; setView('demo'); setData(demo); setLastSync(Date.now()); setNotice(t('已主动载入隔离演示。','An isolated demo was explicitly loaded.')); }
    catch (problem) { setError(problem.message); } finally { actionBusy.current = false; setPending(''); }
  };
  const exitDemo = () => { viewRef.current = 'status'; setView('status'); setData(null); setNotice(''); setError(''); };
  const mutate = async (route,body = {}) => {
    if (actionBusy.current) return null;
    if (!token.trim()) { setError('ADMIN_TOKEN_REQUIRED'); setTab('connections'); return null; }
    actionBusy.current = true; setPending(route); setError(''); setNotice('');
    const mode = viewRef.current === 'demo' ? 'demo' : 'live';
    const fingerprint = JSON.stringify({route,body,mode});
    if (retryIdentity.current?.fingerprint !== fingerprint) retryIdentity.current = {fingerprint,key:globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`};
    actionController.current = new AbortController();
    try {
      const payload = {...body,mode,...(route === 'order' ? {order:{...body.order,idempotencyKey:retryIdentity.current.key}} : {})};
      const reply = await requestApi(apiBase,route,{method:'POST',token,body:payload,signal:actionController.current.signal,idempotencyKey:retryIdentity.current.key});
      retryIdentity.current = null;
      if (mounted.current) {
        const latest=await refreshStatus({quiet:true});
        if(reply?.ok === false){const reason=(reply.errors || []).map(item => item.code || item.message).filter(Boolean).join(', ');setError(`${t('模拟单已拒绝','Paper order rejected')}${reason ? `: ${reason}` : ''}`);}
        else setNotice(latest ? t('服务端已处理请求；账本与状态已重新读取。','The service processed the request; ledger and status were reloaded.') : t('服务端已处理请求，状态刷新尚未成功。','The service processed the request; the state refresh is still unavailable.'));
      }
      return reply;
    } catch (problem) { if (problem.name !== 'AbortError' && mounted.current) setError(problem.message); return null; }
    finally { actionBusy.current = false; if (mounted.current) setPending(''); }
  };
  const download = () => {
    if (!data) return;
    const payload = {schemaVersion:1,exportedAt:new Date().toISOString(),viewMode:view,disclosure:t('模拟资金与研究记录；不是账户真实收益。','Simulated funds and research records; not actual account returns.'),...exportSnapshot(data)};
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `arena-${data.mode}-${new Date().toISOString().slice(0,10)}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  };
  const demo = view === 'demo' || data?.mode === 'demo', marketReady = !!data?.capabilities?.market?.configured;
  const canWrite = !!token.trim();
  const tabs = [['overview',t('市场与模拟','Market & paper accounts')],['research',t('研究工作台','Research desk')],['audit',t('决策与反馈','Decisions & feedback')],['connections',t('连接设置','Connections')]];
  const errorLabels = {
    ADMIN_TOKEN_REQUIRED:t('管理操作需要令牌。可在“连接设置”中临时输入。','An administrator token is required for writes. Enter it temporarily in Connections.'),
    FEATURE_DISABLED:t('服务已响应，但此功能尚未启用。请查看连接状态。','The service responded, but this feature is disabled. Check its connection status.'),
    UNAUTHORIZED:t('服务未接受此令牌。请核对当前环境的管理员令牌。','The service did not accept this token. Check the administrator token for the current environment.'),
    PUBLIC_DATA_DISABLED:t('此数据源尚未启用公开展示。管理员可临时输入令牌查看已授权的数据。','Public display for this feed is disabled. An administrator can enter a token to inspect entitled data.'),
    INVALID_RESPONSE:t('服务响应未通过格式校验，已保留上一份可用快照。','The service response failed validation. The previous usable snapshot is retained.'),
    Failed_to_fetch:t('暂时无法连接服务。','The service cannot be reached right now.'),
  };
  const onTabKey = event => {
    const index = tabs.findIndex(([id]) => id === tab); let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next !== undefined) {event.preventDefault();setTab(tabs[next][0]);document.getElementById(`fsi-tab-${tabs[next][0]}`)?.focus();}
  };
  return <main className={`fsi-app ${demo ? 'fsi-app--demo' : ''}`} data-mode={demo ? 'demo' : marketReady ? 'connected' : 'unconfigured'}>
    <div className="fsi-content"><header className="fsi-hero"><div><p className="fsi-eyebrow">ARENA / {t('研究 · 决策 · 复盘','RESEARCH · DECISIONS · REVIEW')}</p><h1>{t('让判断，经得起复盘。','Research with a record.')}</h1><p className="fsi-hero-lead">{t('从市场证据到独立判断，再到每一笔可追溯的模拟交易。','From market evidence to independent judgment and every traceable paper trade.')}</p></div><div className="fsi-hero-actions"><button className="fsi-icon-button" onClick={download} disabled={!data} aria-label={t('导出当前快照与研究记录','Export current snapshot and research records')}><Icon name="download" /></button><button className="fsi-button fsi-button--subtle" onClick={() => setLocale(old => old === 'zh' ? 'en' : 'zh')} aria-label={t('切换到英文','Switch to Chinese')}>{locale === 'zh' ? 'EN' : '中文'}</button></div></header>
      <section className={`fsi-connection-banner ${demo ? 'is-demo' : !marketReady ? 'is-disconnected' : ''}`} aria-label={t('数据连接状态','Data connection status')}><div className="fsi-banner-main"><span className="fsi-status-dot" aria-hidden="true" /><div><strong>{demo ? t('演示环境 · 虚构数据与模拟资金','Demo environment · Fictional data and simulated funds') : marketReady && data?.snapshot?.redacted ? t('行情已配置 · 公开展示未启用','Market configured · Public display disabled') : marketReady ? t('数据连接已配置','Market connection configured') : t('行情尚未连接','Market data is not connected')}</strong><p>{demo ? t('由你主动载入；采用确定性规则，不调用真实大模型。演示行情与账本独立，管理操作仍需令牌。','Explicitly loaded by you. Deterministic rules run without real LLM calls. Demo observations and ledgers are isolated; writes still require an admin token.') : marketReady ? `${data?.capabilities?.market?.provider || ''} · ${data?.capabilities?.market?.feed || t('数据档位待确认','Feed entitlement unverified')} · ${t('每个报价保留实际时间与质量标记','Each quote retains its timestamp and quality')}` : t('连接可用的行情和持久化账本后开始。也可以先查看带明确标记的演示。','Connect an available market feed and persistent ledger to begin. You can also inspect a clearly labeled demo.')}</p></div></div><div className="fsi-banner-actions">{demo ? <button className="fsi-button" onClick={exitDemo} disabled={!!pending}>{t('返回连接数据','Return to connected data')}<Icon name="arrow" size={16} /></button> : <><button className="fsi-button" onClick={loadDemo} disabled={!!pending}>{t('载入演示','Load demo')}</button><button className="fsi-icon-button" onClick={() => refreshStatus()} disabled={loading || !!pending} aria-label={t('重新读取连接状态','Reload connection status')}><Icon name="refresh" /></button></>}</div></section>
      <div className="fsi-meta-bar"><span>{lastSync ? `${t('状态读取','Status read')} ${displayTime(lastSync,locale)}` : t('正在核对服务状态…','Checking service status…')}</span><span>{t('15 秒状态轮询 · 隐藏页面暂停','15-second status polling · Paused while hidden')} · {t('仅模拟交易','Paper trading only')}</span></div>
      {!!error && <div className="fsi-alert" role="alert"><strong>{t('需要处理','Attention needed')}</strong><span>{errorLabels[error] || t('请求未完成，当前观察保留。错误代码：','The request did not complete. Current observations are retained. Code: ') + error}</span><button className="fsi-icon-button" onClick={() => setError('')} aria-label={t('关闭提示','Dismiss alert')}>×</button></div>}
      <div className="fsi-status-message" role="status" aria-live="polite">{pending ? t('正在处理请求…','Processing request…') : notice}</div>
      <nav className="fsi-tabs" role="tablist" aria-label={t('Arena 工作区','Arena workspace')}>{tabs.map(([id,label]) => <button key={id} id={`fsi-tab-${id}`} role="tab" aria-selected={tab === id} aria-controls={`fsi-panel-${id}`} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)} onKeyDown={onTabKey}>{label}{id === 'audit' && !!data?.runs?.length && <span>{data.runs.length}</span>}</button>)}</nav>
      <div key={view} id={`fsi-panel-${tab}`} role="tabpanel" aria-labelledby={`fsi-tab-${tab}`} tabIndex={0} className="fsi-tab-panel">
        {tab === 'overview' && <><QuotePanel data={data} locale={locale} t={t} apiBase={apiBase} token={readToken} /><PortfolioCards portfolios={data?.portfolios || []} locale={locale} t={t} canWrite={canWrite} pending={pending} onAction={mutate} /><OrderTicket data={data} locale={locale} t={t} canWrite={canWrite} pending={pending} onAction={mutate} /><div className="fsi-management-note"><Icon name="lock" size={16} /><span>{canWrite ? t('管理令牌仅保留在本页内存，所有写操作由服务端验证。','The admin token remains in page memory; the service validates all writes.') : t('公共视图只读。管理操作可在“连接设置”中临时授权。','The public view is read-only. Management writes can be temporarily authorized in Connections.')}</span></div></>}
        {tab === 'research' && <ResearchPanel data={data} locale={locale} t={t} canWrite={canWrite} pending={pending} onAction={mutate} />}
        {tab === 'audit' && <><FeedbackPanel data={data} locale={locale} t={t} canWrite={canWrite} pending={pending} onAction={mutate} /><section className="fsi-panel"><div className="fsi-panel-heading"><div><p className="fsi-eyebrow">{t('决策链路','DECISION TRACE')}</p><h2>{t('从分析，到复核，到成交。','From analysis to review to fill.')}</h2></div><button className="fsi-button fsi-button--primary" disabled={!canWrite || !!pending} onClick={() => mutate('run',{})}>{t('运行策略回合','Run strategy round')}<Icon name="play" size={16} /></button></div>{data?.runs?.length ? <div className="fsi-runs">{data.runs.slice(0,30).map((run,index) => <TraceList key={run.id || index} run={run} t={t} locale={locale} />)}</div> : <Empty title={t('还没有决策回合','No decision rounds yet')}>{t('每次运行会记录共同快照、分析师、复核者、风控结论和模拟成交。','Each run records its shared snapshot, analyst, critic, risk decision and paper fills.')}</Empty>}</section></>}
        {tab === 'connections' && <><Connections data={data} t={t} locale={locale} /><section className="fsi-panel fsi-admin"><details open={!!token}><summary><Icon name="lock" /><span>{t('管理设置','Administrator settings')}</span><Pill tone={token ? 'green' : 'neutral'}>{token ? t('令牌已暂存于内存','Token held in memory') : t('只读','Read-only')}</Pill></summary><div className="fsi-admin-body"><p>{t('输入本服务的管理令牌后，才可刷新行情、运行研究或修改模拟账本。令牌只在本页内存中使用，刷新页面即清除。','Enter this service’s administrator token to refresh market data, run research or update the paper ledger. It is used only in page memory and cleared on reload.')}</p><label>{t('管理令牌','Administrator token')}<input type="password" autoComplete="off" value={token} onChange={event => setToken(event.target.value)} spellCheck={false} placeholder={t('仅用于当前页面','This page only')} /></label><div className="fsi-admin-actions"><button className="fsi-button fsi-button--subtle" onClick={() => {setToken('');setReadToken('');}} disabled={!token}>{t('清除令牌','Clear token')}</button><button className="fsi-button fsi-button--primary" disabled={!canWrite || !!pending} onClick={() => mutate('refresh',{})}>{t('获取新行情快照','Fetch new market snapshot')}<Icon name="refresh" size={16} /></button></div></div></details></section></>}
      </div>
      {legacyResearch && <section className="fsi-legacy"><details onToggle={event => setLegacyOpen(event.currentTarget.open)}><summary><span>{t('原有日线与专业研究工具','Existing daily and specialist research tools')}</span><Icon name="arrow" size={18} /></summary><p>{t('保留原有 Markets 研究模块及其来源校验；各接口是否启用由原服务配置决定。','The existing Markets module and its provenance checks are preserved. Its own service configuration determines which routes are enabled.')}</p>{legacyOpen && (typeof legacyResearch === 'function' ? legacyResearch(locale) : legacyResearch)}</details></section>}
      <footer className="fsi-footer"><strong>ARENA<span aria-hidden="true"> / </span>AFFLATUS</strong><p>{t('研究工具与模拟账本。模型估值、预测与模拟收益均应结合原始来源和假设理解。','Research tools and paper ledgers. Interpret model valuations, forecasts and simulated returns alongside their original sources and assumptions.')}</p></footer>
    </div>
  </main>;
}
