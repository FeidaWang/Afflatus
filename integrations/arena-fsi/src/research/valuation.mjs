import { requireCondition, record, finite, nonempty, currency, unitScale, iso, quantile, copy } from './core.mjs';

/** Market-value debt/equity WACC; net cash never becomes a negative debt weight. */
export function calculateWACC(input) {
  record(input);
  requireCondition(!Object.hasOwn(input, 'netDebt') && !Object.hasOwn(input, 'cash'), 'INVALID_WACC_CAPITAL_BASE',
    'Use marketEquity and gross marketDebt for this WACC model. Handle eligible cash separately in the DCF equity bridge.');
  const marketEquity = finite(input.marketEquity, 'marketEquity', { min: 0, exclusiveMin: true });
  const marketDebt = finite(input.marketDebt, 'marketDebt', { min: 0 });
  const preTaxCostOfDebt = finite(input.preTaxCostOfDebt, 'preTaxCostOfDebt', { min: 0 });
  const taxRate = finite(input.taxRate, 'taxRate', { min: 0, max: 1 });
  const equityFields = ['riskFreeRate', 'beta', 'equityRiskPremium'];
  let costOfEquity; let equityMethod;
  if (Object.hasOwn(input, 'costOfEquity')) {
    requireCondition(!equityFields.some(field => Object.hasOwn(input, field)), 'AMBIGUOUS_COST_OF_EQUITY',
      'Use an explicit costOfEquity OR the CAPM inputs, never both.');
    costOfEquity = finite(input.costOfEquity, 'costOfEquity', { min: 0 }); equityMethod = 'explicit';
  } else {
    const riskFreeRate = finite(input.riskFreeRate, 'riskFreeRate');
    const beta = finite(input.beta, 'beta');
    const premium = finite(input.equityRiskPremium, 'equityRiskPremium', { min: 0 });
    costOfEquity = finite(riskFreeRate + beta * premium, 'computedCostOfEquity', { min: 0 }); equityMethod = 'CAPM';
  }
  const capital = finite(marketEquity + marketDebt, 'capital', { min: 0, exclusiveMin: true });
  const equityWeight = marketEquity / capital; const debtWeight = marketDebt / capital;
  const afterTaxCostOfDebt = preTaxCostOfDebt * (1 - taxRate);
  const wacc = costOfEquity * equityWeight + afterTaxCostOfDebt * debtWeight;
  return { wacc, costOfEquity, equityMethod, preTaxCostOfDebt, afterTaxCostOfDebt, taxRate,
    equityWeight, debtWeight, marketEquity, marketDebt,
    capitalPolicy: 'Caller-supplied market values of equity and gross interest-bearing debt in consistent units.' };
}

function equityBridge(input) {
  let netDebt;
  if (Object.hasOwn(input, 'netDebt')) {
    requireCondition(!Object.hasOwn(input, 'debt') && !Object.hasOwn(input, 'cash'), 'AMBIGUOUS_NET_DEBT',
      'Provide netDebt OR debt and cash; a second cash adjustment would double count cash.');
    requireCondition(input.cashIncludedInNetDebt === true, 'NET_DEBT_CASH_UNDECLARED',
      'Set cashIncludedInNetDebt=true to confirm netDebt already deducts eligible non-operating cash.');
    netDebt = finite(input.netDebt, 'netDebt');
  } else {
    requireCondition(!Object.hasOwn(input, 'cashIncludedInNetDebt'), 'AMBIGUOUS_NET_DEBT',
      'cashIncludedInNetDebt is only valid with an explicit netDebt.');
    netDebt = finite(input.debt, 'debt', { min: 0 }) - finite(input.cash, 'cash', { min: 0 });
  }
  const preferredEquity = finite(input.preferredEquity ?? 0, 'preferredEquity', { min: 0 });
  const nonControllingInterest = finite(input.nonControllingInterest ?? 0, 'nonControllingInterest', { min: 0 });
  const otherNonOperatingAssets = finite(input.otherNonOperatingAssets ?? 0, 'otherNonOperatingAssets', { min: 0 });
  return { netDebt, preferredEquity, nonControllingInterest, otherNonOperatingAssets };
}

function dilutedShares(spec) {
  record(spec, 'shares');
  if (Object.hasOwn(spec, 'diluted')) {
    requireCondition(!Object.hasOwn(spec, 'basic') && !Object.hasOwn(spec, 'incremental'), 'AMBIGUOUS_DILUTION',
      'Use shares.diluted OR shares.basic plus shares.incremental, never both.');
    return finite(spec.diluted, 'shares.diluted', { min: 0, exclusiveMin: true });
  }
  const basic = finite(spec.basic, 'shares.basic', { min: 0, exclusiveMin: true });
  // The incremental diluted share count must be explicit, even when zero.
  const incremental = finite(spec.incremental, 'shares.incremental', { min: 0 });
  return finite(basic + incremental, 'dilutedShares', { min: 0, exclusiveMin: true });
}

function validateScenario(spec, name) {
  record(spec, `scenarios.${name}`);
  requireCondition(Array.isArray(spec.fcff) && spec.fcff.length >= 1 && spec.fcff.length <= 30,
    'INVALID_FCFF_SCHEDULE', `scenarios.${name}.fcff must contain 1–30 annual, year-end FCFF amounts.`);
  const fcff = spec.fcff.map((value, i) => finite(value, `${name}.fcff[${i}]`));
  const wacc = finite(spec.wacc, `${name}.wacc`, { min: 0, exclusiveMin: true });
  const terminalGrowth = finite(spec.terminalGrowth, `${name}.terminalGrowth`, { min: -1, exclusiveMin: true });
  requireCondition(wacc > terminalGrowth, 'WACC_NOT_ABOVE_GROWTH', `WACC must exceed terminal growth in ${name}.`);
  requireCondition(fcff.at(-1) > 0, 'NON_POSITIVE_TERMINAL_FCFF',
    `The final FCFF must be positive for a stable perpetuity valuation (${name}).`);
  return { fcff, wacc, terminalGrowth };
}

function valueScenario(spec, bridge, shares, scale) {
  const schedule = spec.fcff.map((fcff, index) => {
    const year = index + 1;
    const discountFactor = (1 + spec.wacc) ** -year;
    return { year, fcff, discountFactor, presentValue: fcff * discountFactor };
  });
  const presentValueOfForecasts = schedule.reduce((sum, year) => sum + year.presentValue, 0);
  const terminalFcff = spec.fcff.at(-1) * (1 + spec.terminalGrowth);
  const terminalValue = terminalFcff / (spec.wacc - spec.terminalGrowth);
  const presentValueOfTerminal = terminalValue / (1 + spec.wacc) ** spec.fcff.length;
  const enterpriseValue = presentValueOfForecasts + presentValueOfTerminal;
  const equityValue = enterpriseValue - bridge.netDebt - bridge.preferredEquity
    - bridge.nonControllingInterest + bridge.otherNonOperatingAssets;
  const pricePerShare = equityValue * scale / shares;
  for (const [name, value] of Object.entries({ terminalValue, enterpriseValue, equityValue, pricePerShare })) finite(value, name);
  const terminalValueShare = enterpriseValue > 0 ? presentValueOfTerminal / enterpriseValue : null;
  const warnings = [];
  if (terminalValueShare !== null && terminalValueShare > 0.8) warnings.push('TERMINAL_VALUE_DOMINATES');
  if (equityValue < 0) warnings.push('NEGATIVE_IMPLIED_EQUITY');
  return { wacc: spec.wacc, terminalGrowth: spec.terminalGrowth, schedule, presentValueOfForecasts,
    terminalFcff, terminalValue, presentValueOfTerminal, enterpriseValue, equityValue,
    pricePerShare, terminalValueShare, warnings };
}

/** Annual year-end unlevered FCFF DCF. Money uses input units; shares are actual shares. */
export function calculateDCF(input) {
  record(input);
  const scale = unitScale(input.units);
  const money = currency(input.currency);
  const asOf = iso(input.asOf, 'asOf');
  const bridge = equityBridge(input);
  const shares = dilutedShares(input.shares);
  record(input.scenarios, 'scenarios');
  const names = ['bear', 'base', 'bull'];
  const specs = Object.fromEntries(names.map(name => [name, validateScenario(input.scenarios[name], name)]));
  requireCondition(new Set(names.map(name => specs[name].fcff.length)).size === 1,
    'MIXED_PROJECTION_HORIZONS', 'Bear, base, and bull must use the same annual projection horizon.');
  const scenarios = Object.fromEntries(names.map(name => [name, valueScenario(specs[name], bridge, shares, scale)]));
  const waccStep = finite(input.sensitivity?.waccStep ?? 0.005, 'sensitivity.waccStep', { min: 0, exclusiveMin: true });
  const growthStep = finite(input.sensitivity?.growthStep ?? 0.005, 'sensitivity.growthStep', { min: 0, exclusiveMin: true });
  const axis = (middle, step) => [-2, -1, 0, 1, 2].map(n => n === 0 ? middle : Number((middle + n * step).toPrecision(14)));
  const waccValues = axis(specs.base.wacc, waccStep);
  const growthValues = axis(specs.base.terminalGrowth, growthStep);
  const grid = waccValues.map(wacc => growthValues.map(terminalGrowth => {
    if (wacc <= 0 || terminalGrowth <= -1 || wacc <= terminalGrowth) {
      return { wacc, terminalGrowth, valid: false, pricePerShare: null, reason: 'INVALID_DISCOUNT_ASSUMPTIONS' };
    }
    // Recalculate every cash-flow discount and the perpetuity for every cell.
    const result = valueScenario({ ...specs.base, wacc, terminalGrowth }, bridge, shares, scale);
    return { wacc, terminalGrowth, valid: true, pricePerShare: result.pricePerShare,
      enterpriseValue: result.enterpriseValue, equityValue: result.equityValue };
  }));
  return { asOf, currency: money, units: input.units, discountConvention: 'annual-year-end',
    dilutedShares: shares, equityBridge: bridge, scenarios,
    sensitivity: { waccValues, growthValues, grid, center: [2, 2], centerMatchesBase: grid[2][2].pricePerShare === scenarios.base.pricePerShare },
    assumptions: { source: 'caller-supplied', ratesAreDecimals: true, sharesUseActualCount: true,
      cashPolicy: 'Eligible non-operating cash is deducted once in net debt; other assets exclude that cash.' } };
}

function metric(numerator, denominator, { positiveNumerator = false, missingReason = 'MISSING_INPUT' } = {}) {
  if (numerator == null || denominator == null) return { value: null, status: 'NM', reason: missingReason };
  if (denominator <= 0) return { value: null, status: 'NM', reason: 'NON_POSITIVE_DENOMINATOR' };
  if (positiveNumerator && numerator <= 0) return { value: null, status: 'NM', reason: 'NON_POSITIVE_NUMERATOR' };
  const value = numerator / denominator;
  return Number.isFinite(value) ? { value, status: 'OK' } : { value: null, status: 'NM', reason: 'NON_FINITE_RESULT' };
}

/** Peer multiples with explicit period/accounting/currency compatibility; no FX guessing. */
export function compareCompanies(peers) {
  requireCondition(Array.isArray(peers) && peers.length > 0 && peers.length <= 200,
    'INVALID_PEER_SET', 'Supply 1–200 peers.');
  const symbols = new Set();
  let comparisonKey;
  let common;
  const rows = peers.map((peer, index) => {
    record(peer, `peers[${index}]`);
    const symbol = nonempty(peer.symbol, 'symbol', 32).toUpperCase();
    requireCondition(!symbols.has(symbol), 'DUPLICATE_PEER', `Duplicate peer ${symbol}.`);
    symbols.add(symbol);
    record(peer.period, `${symbol}.period`);
    requireCondition(['TTM', 'NTM', 'FY'].includes(peer.period.basis), 'INVALID_PERIOD_BASIS', 'period.basis must be TTM, NTM, or FY.');
    const period = { basis: peer.period.basis, end: iso(peer.period.end, 'period.end'), accounting: nonempty(peer.period.accounting, 'period.accounting', 64) };
    const money = currency(peer.currency);
    const asOf = iso(peer.asOf, 'asOf');
    const key = JSON.stringify({ currency: money, asOf, period });
    if (comparisonKey === undefined) { comparisonKey = key; common = { currency: money, asOf, period }; }
    requireCondition(key === comparisonKey, 'INCOMPARABLE_PEERS',
      'Peers must share currency, valuation snapshot, TTM/NTM/FY basis, period end, and accounting definition.', { symbol });
    const scale = unitScale(peer.units);
    const amount = name => peer[name] == null ? null : finite(finite(peer[name], `${symbol}.${name}`) * scale, `${symbol}.${name}.normalized`);
    const values = Object.fromEntries(['marketCap', 'revenue', 'revenuePrior', 'grossProfit', 'ebitda', 'netIncome', 'fcf'].map(name => [name, amount(name)]));
    if (values.marketCap !== null) requireCondition(values.marketCap > 0, 'INVALID_MARKET_CAP', `marketCap must be positive for ${symbol}.`);
    let enterpriseValue = amount('enterpriseValue');
    const debt = amount('debt'); const cash = amount('cash');
    if (debt !== null) requireCondition(debt >= 0, 'INVALID_DEBT', `debt cannot be negative for ${symbol}.`);
    if (cash !== null) requireCondition(cash >= 0, 'INVALID_CASH', `cash cannot be negative for ${symbol}.`);
    if (enterpriseValue === null && values.marketCap !== null && debt !== null && cash !== null) {
      enterpriseValue = values.marketCap + debt - cash + (amount('preferredEquity') ?? 0) + (amount('nonControllingInterest') ?? 0);
    }
    const revenueGrowth = values.revenue == null || values.revenuePrior == null ? metric(null, null)
      : metric(values.revenue - values.revenuePrior, values.revenuePrior);
    const fcfMargin = metric(values.fcf, values.revenue);
    const metrics = {
      evRevenue: metric(enterpriseValue, values.revenue, { positiveNumerator: true }),
      evEbitda: metric(enterpriseValue, values.ebitda, { positiveNumerator: true }),
      pe: metric(values.marketCap, values.netIncome, { positiveNumerator: true }),
      fcfYield: metric(values.fcf, values.marketCap), grossMargin: metric(values.grossProfit, values.revenue),
      ebitdaMargin: metric(values.ebitda, values.revenue), fcfMargin, revenueGrowth,
    };
    if (['software', 'saas'].includes(String(peer.sector).toLowerCase()) && revenueGrowth.status === 'OK' && fcfMargin.status === 'OK') {
      metrics.ruleOf40 = { value: revenueGrowth.value + fcfMargin.value, status: 'OK' };
    } else metrics.ruleOf40 = { value: null, status: 'NM', reason: 'NOT_APPLICABLE_OR_MISSING_INPUT' };
    return { symbol, ...values, enterpriseValue, metrics, sourceIds: copy(peer.sourceIds ?? []), outliers: [] };
  });
  const statistics = {};
  for (const name of Object.keys(rows[0].metrics)) {
    const values = rows.map(row => row.metrics[name].value).filter(value => value !== null);
    const q1 = quantile(values, 0.25); const q3 = quantile(values, 0.75);
    statistics[name] = { count: values.length, min: quantile(values, 0), q1, median: quantile(values, 0.5), q3, max: quantile(values, 1) };
    if (values.length >= 4 && q3 > q1) {
      const iqr = q3 - q1;
      for (const row of rows) if (row.metrics[name].value !== null && (row.metrics[name].value < q1 - 1.5 * iqr || row.metrics[name].value > q3 + 1.5 * iqr)) row.outliers.push(name);
    }
  }
  return { ...common, units: 'ones', rows, statistics, peerCount: rows.length,
    methodology: { missingOrNonMeaningful: 'NM', quantileMethod: 'linear interpolation (n-1)*p', fxConversion: 'none', invalidValuationDenominatorsExcluded: true } };
}
