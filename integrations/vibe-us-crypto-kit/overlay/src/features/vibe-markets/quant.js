import { applicableQuantModules, QUANT_MODULES } from '../../lib/vibeQuantContract.js';
import { createQuantJob, readQuantJob, cancelQuantJob, waitForPoll } from './quant-client.js';

const names = {
  backtest: ['Long-only daily backtest', '只做多日线回测'], options_chain: ['Market option chain', '市场期权链'],
  option_model: ['European option price & Greeks', '欧式期权定价与 Greeks'], option_payoff: ['Multi-leg expiry payoff', '多腿期权到期收益'],
  dcf: ['Discounted cash flow model', '现金流折现模型'], comps: ['Comparable valuation', '可比公司估值'],
  three_statement: ['Three-statement projection', '三表情景预测'], factors: ['Factor IC & layered returns', '因子 IC 与分层收益'],
  portfolio: ['Portfolio correlation & risk', '组合相关性与风险'], catalogue: ['Available strategies & factors', '可用策略与因子'],
  perpetual: ['Strict perpetual data requirements', '严格永续回测的数据要求'],
  initial_capital: ['Initial research capital', '初始研究资金'], commission_bps: ['Commission (basis points)', '佣金（基点）'],
  slippage_bps: ['Slippage (basis points)', '滑点（基点）'], participation: ['Prior-session volume fraction (≤ 0.1)', '上一交易日成交量比例（≤ 0.1）'],
  fast: ['Fast window (bars)', '短周期（日线数）'], slow: ['Warmup / slow window (bars)', '预热／长周期（日线数）'],
  spot: ['Assumed underlying price', '假设标的价格'], strike: ['Strike', '行权价'], years: ['Years to expiry', '距到期年数'],
  rate: ['Risk-free rate (decimal)', '无风险利率（小数）'], volatility: ['Volatility (decimal)', '波动率（小数）'], dividend_yield: ['Dividend yield (decimal)', '股息率（小数）'],
  INPUT_REQUIRED: ['Required model inputs are missing.', '缺少必需的模型输入。'], INPUT_INVALID: ['Check the supplied model inputs.', '请检查模型输入。'],
  PERPETUAL_DATA_REQUIRED: ['Historical perpetual risk inputs are required.', '需要真实永续历史风险数据。'],
  VOLUME_UNIT_REQUIRED: ['The source has not established the required volume unit.', '数据源未确定所需的成交量单位。'],
  INSUFFICIENT_HISTORY: ['There is not enough complete history.', '完整历史数据不足。'], SOURCE_UNAVAILABLE: ['The source is unavailable.', '数据源暂不可用。'],
  FEATURE_DISABLED: ['The online research service is not enabled. Calculations are unavailable.', '线上研究服务尚未启用，计算暂不可用。'],
  SERVICE_NOT_CONFIGURED: ['The research service is not connected. Calculations are unavailable.', '研究服务尚未连接，计算暂不可用。'],
  PRIVATE_RESEARCH_ONLY: ['This calculation requires authorized access.', '此计算需要已授权的访问权限。'],
  CURRENCY_MISMATCH: ['Currencies must match; no automatic USD/USDT conversion.', '币种必须相同；不自动换算 USD／USDT。'],
  CALENDAR_MISMATCH: ['Dates and source day boundaries must match.', '交易日和数据源日线边界必须一致。'],
  OWNER_REQUIRED: ['This operation requires a real owner identity.', '此操作需要真实所有者身份。'],
  WORKER_LIMIT: ['The calculation reached its time limit.', '计算已达到时间上限。'], NO_DATA: ['No data was returned.', '没有返回数据。'],
  MODEL_UNAVAILABLE: ['The model calculator is unavailable.', '模型计算暂不可用。'],
  source: ['Source', '来源'], source_url: ['Source reference', '来源说明'], quote_as_of: ['Market quote time', '市场报价时间'],
  queued: ['Queued', '排队中'], running: ['Computing', '计算中'], cancelled: ['Cancelled', '已取消'], complete: ['Complete', '已完成'],
  long_only: ['Long only', '仅做多'], no_borrowing: ['No borrowing', '无借贷'], dividends_excluded: ['Dividends excluded', '不含股息'],
  volume_is_prior_session_proxy: ['Liquidity uses prior-session volume', '流动性使用上一交易日成交量'], price_adjustment_as_declared_by_source: ['Price adjustment follows the source declaration', '复权口径按数据源声明'],
  european_model: ['European pricing model', '欧式定价模型'], american_exercise_not_modelled: ['American early exercise excluded', '不含美式提前行权'],
  caller_assumptions_not_market_quotes: ['Assumptions supplied by you; not market quotes', '使用你填写的假设值，非市场报价'],
  provider_snapshot_not_executable_quote: ['Provider snapshot; not an executable quote', '供应商快照，非可成交报价'], no_theoretical_quote_substitution: ['Missing quotes stay unavailable', '缺失报价保持不可用'],
  expiry_only: ['Expiry payoff only', '仅计算到期收益'], caller_premiums_not_market_quotes: ['Premiums supplied by you; not market quotes', '权利金由你填写，非市场报价'], american_assignment_not_modelled: ['American assignment excluded', '不含美式指派'],
  caller_assumptions: ['Caller-supplied assumptions', '使用填写的假设'], not_filed_financial_statements: ['Projection, not filed statements', '预测模型，非披露报表'],
  deployed_six_stock_cohort_not_full_market: ['Six deployed US equities; not the whole market', '仅六只已接入美股，非全市场'], purged_chronological_split: ['Chronological train/validation split with a purge', '按时间划分训练／验证并留出隔离期'], costs_are_explicit_assumptions: ['Costs are explicit assumptions', '费用为显式假设'],
  fixed_weight_daily_rebalanced_research: ['Fixed-weight daily-rebalanced research', '固定权重每日再平衡研究'], costs_and_dividends_excluded: ['Costs and dividends excluded', '不含费用及股息'], no_fx_conversion: ['No FX conversion', '不做外汇换算'],
  total_return: ['Total return', '累计回报'], max_drawdown: ['Maximum drawdown', '最大回撤'], fees: ['Fees', '费用'], final_equity: ['Final equity', '期末净值'], currency: ['Currency', '币种'], fills: ['Fill ledger', '成交账本'], equity: ['Equity ledger', '净值账本'], benchmark: ['Buy-and-hold benchmark', '买入持有基准'], provenance: ['Sources & snapshot hashes', '来源与快照哈希'], model: ['Model output', '模型结果'], assumptions: ['Your assumptions', '填写的假设'], price: ['Theoretical price', '理论价格'], greeks: ['Greeks', 'Greeks'],
};
const node = (tag, text, className) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; };

export function mountQuant(root, instrument, { locale = 'en', getHeaders = () => ({}), days = 365 } = {}) {
  const zh = locale === 'zh', label = key => names[key]?.[zh ? 1 : 0] || key.replaceAll('_', ' ');
  let active, jobId, authHeaders, disposed = false;
  const heading = node('h3', zh ? '量化研究' : 'Quantitative research');
  const controls = node('div', undefined, 'vibe-markets__controls');
  const selectLabel = node('label', zh ? '计算模块' : 'Calculation'), select = node('select');
  select.setAttribute('aria-label', selectLabel.textContent);
  for (const module of applicableQuantModules(instrument)) { const option = node('option', label(module)); option.value = module; select.append(option); }
  const modelsEnabled = import.meta.env.VITE_VIBE_MODELS_ENABLED === 'true';
  const instant = () => modelsEnabled && ['option_model', 'option_payoff', 'catalogue'].includes(select.value);
  if (modelsEnabled) select.value = applicableQuantModules(instrument).includes('option_model') ? 'option_model' : 'catalogue';
  selectLabel.append(select); controls.append(selectLabel);
  const fields = node('div', undefined, 'vibe-markets__controls');
  const status = node('p', '', 'vibe-markets__status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const content = node('div', undefined, 'vibe-markets__quant-result');
  const button = node('button', zh ? '运行研究计算' : 'Run research calculation'); button.type = 'submit';
  const cancel = node('button', zh ? '停止计算' : 'Stop calculation'); cancel.type = 'button'; cancel.hidden = true;
  const actions = node('div', undefined, 'vibe-markets__controls'); actions.append(button, cancel);
  const form = node('form'); form.append(controls, fields, actions);
  root.replaceChildren(heading, node('p', zh ? '仅作研究模拟。历史行情、模型假设和市场期权报价分别显示；个人现金流、策略写入和账户尚未开放。' : 'Research simulations only. Historical data, model assumptions and market option quotes are shown separately. Personal cash flows, strategy writes and accounts remain unavailable.', 'vibe-markets__muted'), form, status, content);
  if (modelsEnabled) form.before(node('p', zh ? '欧式定价、多腿到期收益和固定目录可在线计算。模型使用你填写的假设，不读取市场报价。行情回测等模块仍需研究服务。' : 'European pricing, multi-leg expiry payoff and the fixed catalogue are available online. Models use your assumptions, without market quotes. Historical research still requires the research service.', 'vibe-markets__muted'));

  async function stop() {
    active?.abort(); active = undefined;
    const identifier = jobId; jobId = undefined;
    if (identifier) { try { await cancelQuantJob({ id: identifier, headers: authHeaders }); } catch { /* Bounded server task expires independently. */ } }
  }
  function input(name, integer = false) {
    const wrapper = node('label', label(name)), field = node('input'); field.name = name; field.required = true; field.inputMode = integer ? 'numeric' : 'decimal'; field.maxLength = 30; field.setAttribute('aria-label', label(name));
    wrapper.append(field); fields.append(wrapper);
  }
  function configure() {
    stop(); fields.replaceChildren(); content.replaceChildren(); status.textContent = ''; button.disabled = false; cancel.hidden = true;
    cancel.textContent = instant() ? (zh ? '停止等待' : 'Stop waiting') : (zh ? '停止计算' : 'Stop calculation');
    if (select.value === 'backtest') {
      const wrapper = node('label', zh ? '固定策略' : 'Fixed strategy'), strategy = node('select'); strategy.name = 'strategy'; strategy.setAttribute('aria-label', wrapper.textContent);
      for (const [id, text] of [['sma_cross', zh ? '均线交叉' : 'SMA crossover'], ['buy_hold', zh ? '买入持有' : 'Buy & hold']]) { const option = node('option', text); option.value = id; strategy.append(option); }
      wrapper.append(strategy); fields.append(wrapper);
      for (const key of ['initial_capital', 'commission_bps', 'slippage_bps', 'participation', 'fast', 'slow']) input(key, ['fast', 'slow'].includes(key));
    } else if (select.value === 'option_model') {
      for (const key of ['spot', 'strike', 'years', 'rate', 'volatility', 'dividend_yield']) input(key);
      const wrapper = node('label', zh ? '期权类型' : 'Option right'), right = node('select'); right.name = 'right';
      for (const [value, text] of [['call', zh ? '看涨' : 'Call'], ['put', zh ? '看跌' : 'Put']]) { const option = node('option', text); option.value = value; right.append(option); }
      wrapper.append(right); fields.append(wrapper);
    } else if (QUANT_MODULES[select.value].parameters.length) {
      const wrapper = node('label', zh ? '模型参数（JSON；填写真实输入或有依据的假设）' : 'Model parameters (JSON; supply actual inputs or justified assumptions)'), input = node('textarea'); input.name = 'parameters'; input.rows = 8; input.maxLength = 24000; input.required = select.value !== 'options_chain'; input.setAttribute('aria-label', wrapper.textContent); wrapper.append(input); fields.append(wrapper);
      fields.append(node('p', `${zh ? '字段' : 'Fields'}: ${QUANT_MODULES[select.value].parameters.join(', ')}`, 'vibe-markets__muted'));
      if (['portfolio', 'factors', 'perpetual'].includes(select.value)) fields.append(node('p', zh ? '资金、基点和组合权重须用十进制字符串填写，例如 "0.5"；周期用整数。' : 'Supply capital, basis points and portfolio weights as decimal strings, such as "0.5"; use integers for windows.', 'vibe-markets__muted'));
    }
  }
  select.addEventListener('change', configure); configure();
  cancel.addEventListener('click', () => { stop(); status.textContent = label('cancelled'); button.disabled = false; cancel.hidden = true; content.replaceChildren(); });
  form.addEventListener('submit', async event => {
    event.preventDefault(); await stop();
    const controller = new AbortController(); active = controller;
    button.disabled = true; cancel.hidden = false; content.replaceChildren(); status.textContent = label('queued');
    const module = select.value;
    try {
      const values = new FormData(form); let parameters = {};
      if (module === 'backtest') { for (const [key, value] of values) parameters[key] = ['fast', 'slow'].includes(key) ? Number(value) : String(value); }
      else if (module === 'option_model') { for (const [key, value] of values) parameters[key] = key === 'right' ? String(value) : Number(value); }
      else if (values.get('parameters')?.trim()) parameters = JSON.parse(values.get('parameters'));
      const request = { instrument_id: instrument, module, parameters };
      if (QUANT_MODULES[module].history) { const end = new Date(), start = new Date(end); start.setUTCDate(start.getUTCDate() - days); request.start_date = start.toISOString().slice(0, 10); request.end_date = end.toISOString().slice(0, 10); }
      authHeaders = await getHeaders();
      let job = await createQuantJob({ request, headers: authHeaders, signal: controller.signal });
      if (disposed || active !== controller) { if (job.status !== 'complete') await cancelQuantJob({ id: job.id, headers: authHeaders }); return; }
      jobId = job.id;
      const deadline = Date.now() + 180000;
      while (['queued', 'running'].includes(job.status)) {
        status.textContent = label(job.status); await waitForPoll(controller.signal);
        if (Date.now() > deadline) throw new Error('WORKER_LIMIT');
        job = await readQuantJob({ id: job.id, headers: authHeaders, signal: controller.signal });
      }
      if (disposed || active !== controller) return;
      jobId = undefined;
      if (job.status !== 'complete') throw new Error(job.error || 'SOURCE_UNAVAILABLE');
      const result = job.result;
      if (result.status === 'unavailable') { status.textContent = `${label(result.reason)}${result.missing.length ? ' ' + result.missing.map(label).join(', ') : ''}`; return; }
      status.textContent = label('complete');
      render(content, result.data, label, zh);
      content.append(node('p', result.notes.map(label).join(' · '), 'vibe-markets__muted'));
      const evidence = node('details'); evidence.append(node('summary', label('provenance')), node('p', `${result.observed_at} · Vibe-Trading ${result.upstream_commit.slice(0, 7)} · ${zh ? '请求哈希' : 'Request hash'} ${result.request_hash}`, 'vibe-markets__muted'));
      render(evidence, result.provenance, label, zh); content.append(evidence);
    } catch (error) {
      if (!disposed && active === controller && !controller.signal.aborted) { status.textContent = label(names[error.message] ? error.message : error instanceof SyntaxError || error.message === 'INVALID_REQUEST' ? 'INPUT_INVALID' : 'SOURCE_UNAVAILABLE'); await stop(); }
    } finally { if (!disposed && (active === controller || active === undefined)) { button.disabled = false; cancel.hidden = true; } }
  });
  return () => { disposed = true; stop(); root.replaceChildren(); };
}

function render(root, value, label, zh, depth = 0) {
  if (depth > 12) return;
  if (Array.isArray(value)) {
    if (value.length && value.every(row => row && typeof row === 'object' && !Array.isArray(row) && Object.values(row).every(cell => cell === null || typeof cell !== 'object'))) {
      const keys = [...new Set(value.flatMap(row => Object.keys(row)))], table = node('table'), head = node('tr');
      for (const key of keys) { const cell = node('th', label(key)); cell.scope = 'col'; head.append(cell); }
      const thead = node('thead'); thead.append(head); table.append(thead); const body = node('tbody');
      for (const row of value) { const tr = node('tr'); for (const key of keys) tr.append(node('td', row[key] == null ? (zh ? '不可用' : 'unavailable') : String(row[key]))); body.append(tr); }
      table.append(body); const scroll = node('div', undefined, 'vibe-markets__table'); scroll.tabIndex = 0; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', zh ? '计算结果表' : 'Calculation result table'); scroll.append(table); root.append(scroll);
    } else for (const item of value) render(root, item, label, zh, depth + 1);
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (item && typeof item === 'object') { const details = node('details'); details.append(node('summary', label(key))); render(details, item, label, zh, depth + 1); root.append(details); }
      else root.append(node('p', `${label(key)}: ${item === null ? (zh ? '不可用' : 'unavailable') : String(item)}`));
    }
  } else root.append(node('p', value === null ? (zh ? '不可用' : 'unavailable') : String(value)));
}
