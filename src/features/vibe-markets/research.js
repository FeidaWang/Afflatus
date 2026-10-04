import { applicableModules, RESEARCH_MODULES } from '../../lib/vibeResearchContract.js';
import { getResearch } from './client.js';
import { scoreText, SENTIMENT_COMMIT } from './sentiment.js';

const labels = {
  profile: ['Company profile & analyst estimates', '公司档案与分析师预期'], filings: ['SEC filings', 'SEC 披露文件'],
  financials: ['Financial statements · filed cutoff', '三张财务报表 · 提交截止日'], institutions: ['13F manager portfolio & changes', '13F 机构组合与环比'],
  etf: ['ETF disclosed holdings', 'ETF 披露持仓'], news: ['News & headline lexicon scores', '新闻与标题词典评分'],
  screener: ['US market leaders', '美股涨幅筛选'], orderbook: ['Spot order book · 10,000 USDT simulation', '现货盘口 · 10,000 USDT 冲击模拟'],
  industry: ['US sector peers · deployed basket', '美股行业比较 · 已接入标的池'], company: ['Selected company taxonomy', '所选公司的行业分类'], peers: ['Same-sector basket peers', '池内同板块公司'],
  fear_greed: ['Bitcoin Fear & Greed Index', '比特币恐惧贪婪指数'], listing: ['Listing identity', '上市标的身份'],
  earnings: ['Company earnings calendar · seven-day window', '公司财报日历 · 七天区间'], events: ['Reported or scheduled earnings dates', '已披露或计划的财报日期'],
  US_CONNECTOR_REQUIRED: ['Configure a real US OpenD quote connector before fetching the calendar.', '请先配置可用的美股 OpenD 行情连接，再读取财报日历。'],
  connector_calendar: ['US connector calendar', '美股连接器日历'],
  SELECTED_COMPANY_CALENDAR: ['Only the selected company within the requested dates.', '仅展示所选公司在指定日期内的记录。'],
  SCHEDULE_MAY_CHANGE: ['Scheduled dates may change; an event does not establish that results have been published.', '计划日期可能调整；日历事件不代表财报已经发布。'],
  key_stats: ['Valuation statistics', '估值指标'], earnings_trend: ['Earnings estimates', '盈利预期'], recommendation_trend: ['Analyst recommendations', '分析师评级'],
  balance: ['Balance sheet', '资产负债表'], income: ['Income statement', '利润表'], cashflow: ['Cash flow statement', '现金流量表'],
  filing: ['Disclosure identity', '披露身份'], positions: ['Reported positions', '披露持仓'], changes: ['Quarterly changes', '季度变化'],
  holdings: ['Reported constituents', '披露成分'], articles: ['Headlines', '新闻标题'], leaders: ['Leaders by percent change', '按涨幅排名'],
  snapshot: ['Book snapshot · price in USDT', '盘口快照 · 价格单位 USDT'], bids: ['Bids · amount in base asset', '买盘 · 数量单位基础币'],
  asks: ['Asks · amount in base asset', '卖盘 · 数量单位基础币'], impact: ['Simulated impact · quote notional in USDT', '模拟冲击 · 名义金额单位 USDT'], index: ['Bitcoin index', '比特币指数'],
  SEC_CONTACT_REQUIRED: ['Configure a real SEC operator contact before fetching.', '请先配置真实 SEC 运营联系人。'],
  SOURCE_UNAVAILABLE: ['The source is unavailable. Retry when it recovers.', '数据源暂不可用，可在恢复后重试。'],
  FEATURE_DISABLED: ['The online research service is not enabled. Data queries are unavailable.', '线上研究服务尚未启用，数据查询暂不可用。'],
  SERVICE_NOT_CONFIGURED: ['The research service is not connected. Data is unavailable.', '研究服务尚未连接，数据暂不可用。'],
  PRIVATE_RESEARCH_ONLY: ['This research data requires authorized access.', '此研究数据需要已授权的访问权限。'],
  NO_DATA: ['No data reported for this section.', '此项没有数据披露。'], CHANGES_UNAVAILABLE: ['Prior-quarter data unavailable for comparison.', '缺少上一季度数据，暂不能比较。'],
  UNSUPPORTED_FUND_STRUCTURE: ['This unit investment trust does not file N-PORT. Select IVV for the N-PORT adapter.', '此单位投资信托不提交 N-PORT；可选择 IVV 查看该数据适配。'],
  CURRENT_SNAPSHOT_NOT_POINT_IN_TIME: ['Current provider snapshot; unsuitable for historical point-in-time backtests.', '当前供应商快照，不能用于历史时点回测。'],
  DISCLOSED_HOLDINGS_NOT_LIVE: ['Disclosed holdings with reporting lag; not live holdings.', '披露持仓存在报告滞后，不是实时持仓。'],
  RANKED_SLICE: ['A capped ranked page; the full portfolio or market may contain more rows.', '仅显示有上限的排名页，完整组合或市场可能有更多项目。'],
  AMENDMENT_INCOMPLETE: ['The amendment chain is incomplete; treat totals and changes as incomplete.', '修订链不完整，合计与环比也不完整。'],
  US_UNIVERSE_ONLY: ['US universe from Eastmoney; volume and turnover units are undeclared by this adapter.', '仅筛选 Eastmoney 美股范围；该适配器未声明成交量和成交额单位。'],
  PROVIDER_TIME_UNKNOWN: ['Provider snapshot time is unknown; fetched time is shown separately.', '供应商快照时间未知；抓取时间单独显示。'],
  ENGLISH_LEXICON: ['English keyword counts only; no language model or negation understanding.', '仅统计英文关键词，不含语言模型或否定语义理解。'],
  BITCOIN_INDEX_NOT_INSTRUMENT_SENTIMENT: ['Alternative.me Bitcoin index; not a sentiment score for the selected coin or US stocks.', 'Alternative.me 比特币指数，不代表所选币种或美股的情绪。'],
  LOCAL_BOOK_TIME: ['Venue timestamp absent; timestamp is the local fetch time.', '交易所未提供时间戳，此处显示本地抓取时间。'],
  PARTIAL_DEPTH_FILL: ['The fetched depth cannot fill the entire simulated size.', '已获取的盘口深度不能覆盖全部模拟数量。'],
  RAW_REPORTED_QUARTERS_NO_SYNTHETIC_Q4: ['Raw reported quarterly spans only; no inferred fourth-quarter values.', '仅使用直接披露的季度区间，不推算第四季度值。'],
  FILED_CUTOFF_APPLIED: ['Only facts filed by the cutoff; each value retains its filing and report span.', '只取截止日之前提交的数据；每个值保留提交日期与报告区间。'],
  DEPLOYED_BASKET_NOT_SECTOR_UNIVERSE: ['Comparison covers only the deployed US stock basket sharing Yahoo’s sector label; industries may differ. It is not a sector index or fund-flow ranking.', '仅比较已接入美股中 Yahoo 板块标签相同的公司，细分行业可能不同；不代表行业指数或资金流排名。'],
  PEER_DATA_INCOMPLETE: ['Some basket peers could not be fetched; comparison is incomplete.', '部分池内公司的数据未能获取，比较不完整。'],
  provider_snapshot: ['Provider snapshot', '供应商快照'], filed_reports: ['Filed reports', '已提交报告'],
  book_snapshot: ['Order book snapshot', '盘口快照'], crypto_index: ['Crypto index', '加密指数'],
};
const columns = {
  earnings_date: '财报日期', release_at: '供应商发布时点（UTC）', publish_session: '盘前／盘后时段',
  metric: '指标', value: '值', symbol: '标的', exchange: '交易所', exchange_name: '交易所名称', quote_type: '证券类别', currency: '币种', financial_currency: '财务币种',
  period: '报告周期', end_date: '结束日期', eps_avg: 'EPS 均值', eps_low: 'EPS 下限', eps_high: 'EPS 上限', eps_analysts: 'EPS 分析师数', revenue_avg: '收入均值',
  eps_trend_7d_ago: '7 天前 EPS 预期', eps_trend_30d_ago: '30 天前 EPS 预期', eps_revisions_up_30d: '30 天上修次数', eps_revisions_down_30d: '30 天下修次数',
  strong_buy: '强烈买入', buy: '买入', hold: '持有', sell: '卖出', strong_sell: '强烈卖出', form: '文件类型', accession_number: '文件编号', filing_date: '提交日期', report_date: '报告日期',
  document_url: '原文', concept: '会计概念', unit: '单位', period_start: '区间开始', period_end: '区间结束', filed_at: '提交日期', accession: '文件编号', manager: '机构', cik: 'CIK',
  resolution: '修订处理', prior_period_end: '上一报告期', prior_accession: '上一文件编号', issuer: '发行人', cusip: 'CUSIP', put_call: '期权方向', share_type: '数量类型', shares: '数量',
  value_usd: '价值 USD', weight_pct: '权重 %', action: '变化', shares_before: '上期数量', shares_after: '本期数量', shares_change_pct: '数量变化 %', value_usd_before: '上期价值 USD', value_usd_after: '本期价值 USD',
  series_name: '基金名称', series_id: '基金系列', as_of: '数据日期', disclosure_lag_days: '披露滞后天数', holdings_in_filing: '文件中的持仓数', name: '名称', ticker: '代码', pct_of_net_assets: '净资产占比 %',
  balance: '数量', balance_units: '数量单位', title: '标题', source: '来源', published: '发布时间', url: '原文', score: '词典评分', positive: '正面词数', negative: '负面词数',
  code: '代码', price: '价格', change_pct: '涨幅 %', volume: '成交量（单位未知）', amount: '成交额（单位未知）', turnover_rate: '换手率 %', timestamp: '快照时间', timestamp_source: '时间来源',
  mid_price: '中间价 USDT', spread_quote: '价差 USDT', spread_bps: '价差 bps', imbalance: '不平衡度', notional_quote: '模拟金额 USDT', amount_base: '基础币数量', side: '方向',
  sector: '板块', industry: '行业', market_cap: '市值 USD', forward_pe: '预期市盈率', profit_margin: '利润率（比例）',
  filled_base_qty: '已填充基础币数量', filled_notional_quote: '已填充金额 USDT', avg_price: '均价 USDT', fully_filled: '是否全部填充', unfilled_base_qty: '未填充基础币数量', slippage_bps: '滑点 bps', classification: '分类', index_at: '指数时间',
};
function node(tag, text, cls) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (cls) el.className = cls; return el; }

export function mountResearch(root, instrument, { locale = 'en', getHeaders = () => ({}) } = {}) {
  const zh = locale === 'zh'; const text = id => labels[id]?.[zh ? 1 : 0] || id.replaceAll('_', ' ');
  let active, disposed = false;
  const controls = node('div', undefined, 'vibe-markets__controls');
  const wrapper = node('label', zh ? '研究模块' : 'Research module'); const select = node('select'); select.setAttribute('aria-label', wrapper.textContent);
  for (const module of applicableModules(instrument)) { const option = node('option', text(module)); option.value = module; select.append(option); }
  wrapper.append(select); controls.append(wrapper);
  const cadenceLabel = node('label', zh ? '报告周期' : 'Reporting cadence'); const cadence = node('select'); cadence.setAttribute('aria-label', cadenceLabel.textContent);
  for (const [value, label] of [['annual', zh ? '年度' : 'Annual'], ['quarter', zh ? '季度' : 'Quarterly']]) { const opt = node('option', label); opt.value = value; cadence.append(opt); }
  cadenceLabel.append(cadence); controls.append(cadenceLabel);
  const cutoffLabel = node('label', zh ? '提交截止日' : 'Filed cutoff'); const cutoff = node('input'); cutoff.type = 'date'; cutoff.min = '1990-01-01'; cutoff.max = new Date().toISOString().slice(0, 10); cutoff.value = cutoff.max;
  cutoff.setAttribute('aria-label', cutoffLabel.textContent); cutoffLabel.append(cutoff); controls.append(cutoffLabel);
  const managerLabel = node('label', zh ? '13F 机构（整个组合）' : '13F manager (entire portfolio)'); const manager = node('select'); manager.setAttribute('aria-label', managerLabel.textContent);
  for (const [value, label] of [['berkshire', 'Berkshire Hathaway'], ['bridgewater', 'Bridgewater Associates']]) { const opt = node('option', label); opt.value = value; manager.append(opt); }
  managerLabel.append(manager); controls.append(managerLabel);
  const beginLabel = node('label', zh ? '日历开始日' : 'Calendar start'), begin = node('input'); begin.type = 'date'; begin.value = new Date().toISOString().slice(0, 10); begin.setAttribute('aria-label', beginLabel.textContent); beginLabel.append(begin); controls.append(beginLabel);
  const endLabel = node('label', zh ? '日历结束日（最多七天）' : 'Calendar end (up to seven days)'), end = node('input'); end.type = 'date'; const nextWeek = new Date(); nextWeek.setUTCDate(nextWeek.getUTCDate() + 6); end.value = nextWeek.toISOString().slice(0, 10); end.setAttribute('aria-label', endLabel.textContent); endLabel.append(end); controls.append(endLabel);
  const button = node('button', zh ? '加载研究' : 'Load research'); button.type = 'button'; controls.append(button);
  const status = node('p', zh ? '选择模块后加载数据。' : 'Choose a module, then load its data.'); status.setAttribute('role', 'status');
  const content = node('div'); root.replaceChildren(controls, status, content);
  function reset() { active?.abort(); button.disabled = false; content.replaceChildren(); status.textContent = zh ? '选择模块后加载数据。' : 'Choose a module, then load its data.';
    cadenceLabel.hidden = cutoffLabel.hidden = select.value !== 'financials'; managerLabel.hidden = select.value !== 'institutions'; beginLabel.hidden = endLabel.hidden = select.value !== 'earnings'; }
  select.addEventListener('change', reset); cadence.addEventListener('change', reset); cutoff.addEventListener('change', reset); manager.addEventListener('change', reset); begin.addEventListener('change', reset); end.addEventListener('change', reset); reset();
  button.addEventListener('click', async () => {
    active?.abort(); const controller = active = new AbortController(); content.replaceChildren(); button.disabled = true;
    status.textContent = zh ? '正在读取数据源…' : 'Loading source data…';
    try {
      const module = select.value;
      const result = await getResearch({ instrument, module, signal: controller.signal, headers: await getHeaders(),
        ...(module === 'financials' ? { cadence: cadence.value, cutoff: cutoff.value } : {}), ...(module === 'institutions' ? { manager: manager.value } : {}), ...(module === 'earnings' ? { begin: begin.value, end: end.value } : {}) });
      if (disposed || controller !== active || controller.signal.aborted) return;
      status.textContent = result.status === 'unavailable' ? text(result.reason) : result.status === 'partial' ? (zh ? '部分数据可用' : 'Some sections are unavailable') : (zh ? '数据已加载' : 'Data loaded');
      const quality = result.status === 'unavailable' ? (zh ? '不可用' : 'unavailable') : text(result.quality);
      const meta = node('p', `${zh ? '数据时间' : 'As of'}: ${result.as_of || (zh ? '未知' : 'unknown')} · ${zh ? '抓取时间' : 'Fetched'}: ${result.observed_at} · ${zh ? '质量' : 'Quality'}: ${quality}`, 'vibe-markets__muted');
      const link = node('a', result.source === 'alternative_me' ? 'Alternative.me' : result.source); link.href = result.source_url; link.target = '_blank'; link.rel = 'noopener noreferrer';
      meta.append(' · ', link); content.append(meta);
      for (const note of result.notes) content.append(node('p', text(note), 'vibe-markets__muted'));
      for (const section of result.sections) {
        const details = node('details'); details.open = true;
        const sectionTitle = module === 'profile' && section.id === 'financials' ? (zh ? '财务快照与分析师目标价' : 'Financial snapshot & analyst targets') : text(section.id);
        details.append(node('summary', sectionTitle));
        if (section.status === 'unavailable') details.append(node('p', text(section.reason)));
        else {
          const table = node('table'); const thead = node('thead'); const head = node('tr'); const keys = Object.keys(RESEARCH_MODULES[module].sections[section.id]);
          for (const key of keys) { const th = node('th', zh ? columns[key] || key : key.replaceAll('_', ' ')); th.scope = 'col'; head.append(th); }
          thead.append(head); table.append(thead); const body = node('tbody');
          for (const row of section.rows) { const tr = node('tr'); for (const key of keys) {
            const value = row[key]; const td = node('td');
            if (['url', 'document_url'].includes(key) && value) { const a = node('a', zh ? '原文' : 'Source'); a.href = value; a.target = '_blank'; a.rel = 'noopener noreferrer'; td.append(a); }
            else td.textContent = value === null ? (zh ? '未披露' : 'not reported') : typeof value === 'boolean' ? (value ? (zh ? '是' : 'yes') : (zh ? '否' : 'no')) : typeof value === 'number' ? new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(value) : value;
            tr.append(td);
          } body.append(tr); } table.append(body); const scroll = node('div', undefined, 'vibe-markets__table');
          scroll.tabIndex = 0; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', sectionTitle); scroll.append(table); details.append(scroll);
        }
        content.append(details);
      }
    } catch (error) { if (!disposed && controller === active && !controller.signal.aborted) status.textContent = error.message === 'INVALID_DATE' ? (zh ? '请选择最多七天的有效日期区间。' : 'Choose a valid date window of at most seven days.') : text(['FEATURE_DISABLED', 'SERVICE_NOT_CONFIGURED', 'PRIVATE_RESEARCH_ONLY'].includes(error.message) ? error.message : 'SOURCE_UNAVAILABLE'); }
    finally { if (!disposed && controller === active) button.disabled = false; }
  });
  return () => { disposed = true; active?.abort(); root.replaceChildren(); };
}

export function mountTextSentiment(root, locale) {
  const zh = locale === 'zh'; const details = node('details'); details.append(node('summary', zh ? '本地英文情绪词典评分' : 'Local English sentiment lexicon'));
  const label = node('label', zh ? '英文文本（只在浏览器计算）' : 'English text (computed in this browser)'); const input = node('textarea'); input.maxLength = 5000; input.rows = 3; input.setAttribute('aria-label', label.textContent); label.append(input);
  const output = node('p'); output.setAttribute('role', 'status'); input.addEventListener('input', () => {
    const result = scoreText(input.value); output.textContent = `${zh ? '评分' : 'Score'}: ${result.score} · +${result.positive} / −${result.negative}`;
  });
  details.append(label, output, node('p', `${labels.ENGLISH_LEXICON[zh ? 1 : 0]} · Vibe-Trading ${SENTIMENT_COMMIT.slice(0, 7)}`, 'vibe-markets__muted')); root.append(details);
}

export function renderPatterns(root, data, locale) {
  const zh = locale === 'zh'; const details = node('details'); details.append(node('summary', zh ? '回顾性图表形态' : 'Retrospective chart patterns'));
  details.append(node('p', zh ? '峰谷形态需要后续日线确认；这些识别结果不能直接当作历史交易信号。' : 'Pivot patterns need subsequent bars for confirmation. These results are retrospective, not historical trading signals.', 'vibe-markets__muted'));
  const names = { candlestick: ['Candlesticks (hammer / engulfing)', '蜡烛形态（锤头／吞没）'], head_and_shoulders: ['Head & shoulders', '头肩顶'], double_top_bottom: ['Double top / bottom', '双顶／双底'], triangle: ['Triangle', '三角形'], broadening: ['Broadening', '扩散形态'] };
  for (const [name, item] of Object.entries(data.patterns)) {
    const label = names[name][zh ? 1 : 0];
    if (item.status === 'unavailable') details.append(node('p', `${label} · ${zh ? '需要日线数' : 'Minimum bars'}: ${item.minimum_bars}`));
    else {
      const meanings = { candlestick: event => event.value === 1 ? (zh ? '看涨形态' : 'bullish pattern') : (zh ? '看跌吞没' : 'bearish engulfing'),
        head_and_shoulders: () => zh ? '头肩顶' : 'head & shoulders top',
        double_top_bottom: event => event.value === 1 ? (zh ? '双顶' : 'double top') : (zh ? '双底' : 'double bottom'),
        triangle: event => event.value === 1 ? (zh ? '上升三角形' : 'ascending triangle') : (zh ? '下降三角形' : 'descending triangle'),
        broadening: () => zh ? '扩散' : 'broadening' };
      const events = item.events.slice(-8).map(event => `${event.date}: ${meanings[name](event)} (${zh ? '确认快照' : 'confirmation snapshot'} ${event.confirmed_at})`).join(' · ');
      details.append(node('p', `${label}: ${events || (zh ? '未识别到形态' : 'No patterns detected')}`)); }
  }
  if (data.support_resistance) details.append(node('p', `${zh ? '支撑 / 阻力' : 'Support / resistance'}: ${data.support_resistance.support.join(', ') || '—'} / ${data.support_resistance.resistance.join(', ') || '—'}`));
  if (data.trend_slope_20 !== null) details.append(node('p', `${zh ? '20 根日线趋势斜率' : '20-bar trend slope'}: ${data.trend_slope_20.toFixed(4)}`));
  details.append(node('p', `${data.source} · ${data.as_of} · ${data.bar_count} ${zh ? '根完整日线' : 'complete bars'} · Vibe-Trading ${data.upstream_commit.slice(0, 7)}`, 'vibe-markets__muted')); root.append(details);
}
