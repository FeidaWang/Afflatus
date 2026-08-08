/* ============================================================
   ARENA Q-FOUNDRY · QF-01

   A browser-native, dependency-free research engine inspired by the
   separation of data context, portfolio, factor risk and constraints in
   gs-quant. This is an independent implementation: it does not call
   Marquee, reproduce Goldman Sachs models, or place orders.

   All functions are pure. Daily candles are ascending and shaped as
   { t: 'YYYY-MM-DD', o, h, l, c, v }.
   ============================================================ */

const TRADING_DAYS = 252;
const EPSILON = 1e-10;

const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function orderedHistorySymbols(config = {}) {
  const benchmark = String(config.benchmark || 'SPY').trim().toUpperCase();
  const universe = Array.isArray(config.universe)
    ? config.universe.map((asset) => String(asset?.sym || '').trim().toUpperCase()).filter(Boolean)
    : [];
  return [...new Set([benchmark, ...universe])];
}

export function assessHistoryCoverage(plannedSymbols, histories, minimumHistory = 130, fetchFailures = []) {
  const planned = [...new Set((plannedSymbols || [])
    .map((symbol) => String(symbol || '').trim().toUpperCase())
    .filter(Boolean))];
  const minimum = Math.max(1, Number.parseInt(minimumHistory, 10) || 130);
  const failuresBySymbol = new Map();

  for (const failure of fetchFailures || []) {
    const symbol = String(failure?.symbol || '').trim().toUpperCase();
    if (!symbol || !planned.includes(symbol)) continue;
    failuresBySymbol.set(symbol, {
      ...failure,
      symbol,
      reason: failure.reason || 'fetch-failed',
      observations: Array.isArray(histories?.[symbol]) ? histories[symbol].length : 0,
      minimumHistory: minimum,
    });
  }

  for (const symbol of planned) {
    const observations = Array.isArray(histories?.[symbol]) ? histories[symbol].length : 0;
    if (observations >= minimum) continue;
    const existing = failuresBySymbol.get(symbol);
    failuresBySymbol.set(symbol, {
      ...existing,
      symbol,
      reason: existing?.reason || 'insufficient-history',
      observations,
      minimumHistory: minimum,
    });
  }

  const failures = planned.map((symbol) => failuresBySymbol.get(symbol)).filter(Boolean);
  const failed = new Set(failures.map((failure) => failure.symbol));
  const coveredSymbols = planned.filter((symbol) => !failed.has(symbol));
  return {
    plannedSymbols: planned,
    coveredSymbols,
    failures,
    complete: failures.length === 0 && coveredSymbols.length === planned.length,
  };
}

export function mean(values) {
  const clean = (values || []).filter(Number.isFinite);
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0;
}

export function sampleStd(values) {
  const clean = (values || []).filter(Number.isFinite);
  if (clean.length < 2) return 0;
  const avg = mean(clean);
  return Math.sqrt(clean.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / (clean.length - 1));
}

export function dailyReturns(candles) {
  const returns = [];
  for (let i = 1; i < (candles || []).length; i += 1) {
    const previous = finite(candles[i - 1]?.c);
    const current = finite(candles[i]?.c);
    if (previous > 0 && current > 0) returns.push({ t: candles[i].t, value: (current / previous) - 1 });
  }
  return returns;
}

export function maxDrawdown(values) {
  let peak = -Infinity;
  let drawdown = 0;
  for (const raw of values || []) {
    const value = finite(raw, NaN);
    if (!Number.isFinite(value)) continue;
    peak = Math.max(peak, value);
    if (peak > 0) drawdown = Math.min(drawdown, (value / peak) - 1);
  }
  return drawdown;
}

function covariance(left, right) {
  const size = Math.min(left.length, right.length);
  if (size < 2) return 0;
  const a = left.slice(-size);
  const b = right.slice(-size);
  const ma = mean(a);
  const mb = mean(b);
  return a.reduce((sum, value, index) => sum + ((value - ma) * (b[index] - mb)), 0) / (size - 1);
}

function betaAgainst(assetCandles, benchmarkCandles, lookback = 63) {
  const asset = new Map(dailyReturns(assetCandles).map((point) => [point.t, point.value]));
  const aligned = dailyReturns(benchmarkCandles)
    .filter((point) => asset.has(point.t))
    .slice(-lookback);
  const benchmarkReturns = aligned.map((point) => point.value);
  const assetReturns = aligned.map((point) => asset.get(point.t));
  const variance = sampleStd(benchmarkReturns) ** 2;
  return variance > EPSILON ? covariance(assetReturns, benchmarkReturns) / variance : 0;
}

function clipHistory(candles, asOfDate) {
  const clean = (candles || [])
    .filter((candle) => candle && typeof candle.t === 'string' && finite(candle.c) > 0)
    .sort((a, b) => a.t.localeCompare(b.t));
  return asOfDate ? clean.filter((candle) => candle.t <= asOfDate) : clean;
}

export function robustZScores(values, limit = 3) {
  const clean = (values || []).map((value) => finite(value));
  const avg = mean(clean);
  const deviation = sampleStd(clean);
  if (deviation < EPSILON) return clean.map(() => 0);
  return clean.map((value) => clamp((value - avg) / deviation, -limit, limit));
}

export function resolveRegime(benchmarkCandles, asOfDate) {
  const candles = clipHistory(benchmarkCandles, asOfDate);
  if (candles.length < 101) return { id: 'insufficient', grossTarget: 0.55, trend: 0, volatility: 0 };
  const closes = candles.map((candle) => finite(candle.c));
  const current = closes.at(-1);
  const average100 = mean(closes.slice(-100));
  const volatility = sampleStd(dailyReturns(candles).slice(-20).map((point) => point.value)) * Math.sqrt(TRADING_DAYS);
  const trend = average100 > 0 ? (current / average100) - 1 : 0;
  if (trend < 0 && volatility > 0.22) return { id: 'defensive', grossTarget: 0.55, trend, volatility };
  if (trend < 0 || volatility > 0.28) return { id: 'guarded', grossTarget: 0.7, trend, volatility };
  if (trend > 0 && volatility < 0.22) return { id: 'expansion', grossTarget: 1, trend, volatility };
  return { id: 'balanced', grossTarget: 0.85, trend, volatility };
}

export function computeFactorRows(histories, config, asOfDate) {
  const benchmarkSymbol = config.benchmark || 'SPY';
  const benchmark = clipHistory(histories[benchmarkSymbol], asOfDate);
  const definitions = Array.isArray(config.universe) ? config.universe : [];
  const raw = definitions.map((asset) => {
    const candles = clipHistory(histories[asset.sym], asOfDate);
    if (candles.length < 101 || benchmark.length < 101) return null;
    const closes = candles.map((candle) => finite(candle.c));
    const recent = closes.at(-6);
    const anchor = closes.at(-64);
    const momentum = anchor > 0 ? (recent / anchor) - 1 : 0;
    const average20 = mean(closes.slice(-20));
    const trend = average20 > 0 ? (closes.at(-1) / average20) - 1 : 0;
    const volatility = sampleStd(dailyReturns(candles).slice(-20).map((point) => point.value)) * Math.sqrt(TRADING_DAYS);
    const window = closes.slice(-63);
    const resilience = maxDrawdown(window);
    const dollarVolume = mean(candles.slice(-20).map((candle) => finite(candle.c) * finite(candle.v)));
    return {
      sym: asset.sym,
      name: asset.name || asset.sym,
      sector: asset.sector || 'Unclassified',
      momentum,
      trend,
      resilience,
      volatility,
      beta: betaAgainst(candles, benchmark),
      dollarVolume,
      last: closes.at(-1),
      session: candles.at(-1).t,
    };
  }).filter(Boolean);

  const zMomentum = robustZScores(raw.map((row) => row.momentum));
  const zTrend = robustZScores(raw.map((row) => row.trend));
  const zResilience = robustZScores(raw.map((row) => row.resilience));
  const zVolatility = robustZScores(raw.map((row) => row.volatility));
  const weights = config.weights || {};
  const denominator = Math.max(EPSILON,
    finite(weights.momentum, 0.38)
    + finite(weights.trend, 0.27)
    + finite(weights.resilience, 0.2)
    + finite(weights.lowVol, 0.15));

  return raw.map((row, index) => ({
    ...row,
    score: (
      (zMomentum[index] * finite(weights.momentum, 0.38))
      + (zTrend[index] * finite(weights.trend, 0.27))
      + (zResilience[index] * finite(weights.resilience, 0.2))
      - (zVolatility[index] * finite(weights.lowVol, 0.15))
    ) / denominator,
    factors: {
      momentum: zMomentum[index],
      trend: zTrend[index],
      resilience: zResilience[index],
      lowVol: -zVolatility[index],
    },
  })).sort((a, b) => b.score - a.score);
}

function constrainedWeights(rows, settings, targetGross) {
  const maxNames = clamp(Math.round(finite(settings.maxNames, 6)), 1, rows.length || 1);
  const maxWeight = clamp(finite(settings.maxWeight, 0.24), 0.05, 1);
  const sectorCap = clamp(finite(settings.sectorCap, 0.38), maxWeight, 1);
  const selected = rows.slice(0, maxNames);
  if (!selected.length) return [];
  const floor = Math.min(...selected.map((row) => row.score));
  const raw = selected.map((row) => ({
    ...row,
    rawWeight: Math.max(0.05, row.score - floor + 0.2) / Math.max(0.12, row.volatility),
    weight: 0,
  }));
  const rawTotal = raw.reduce((sum, row) => sum + row.rawWeight, 0) || 1;
  raw.forEach((row) => { row.weight = (row.rawWeight / rawTotal) * targetGross; });

  for (let pass = 0; pass < 12; pass += 1) {
    raw.forEach((row) => { row.weight = Math.min(row.weight, maxWeight); });
    const sectors = new Map();
    raw.forEach((row) => sectors.set(row.sector, (sectors.get(row.sector) || 0) + row.weight));
    raw.forEach((row) => {
      const sectorWeight = sectors.get(row.sector) || 0;
      if (sectorWeight > sectorCap) row.weight *= sectorCap / sectorWeight;
    });
    const used = raw.reduce((sum, row) => sum + row.weight, 0);
    const residual = Math.max(0, targetGross - used);
    if (residual < 1e-7) break;
    const eligible = raw.filter((row) => row.weight < maxWeight - 1e-7);
    const capacity = eligible.reduce((sum, row) => sum + Math.max(0, maxWeight - row.weight), 0);
    if (!eligible.length || capacity < 1e-7) break;
    eligible.forEach((row) => {
      const share = Math.max(0, maxWeight - row.weight) / capacity;
      row.weight += residual * share;
    });
  }
  raw.forEach((row) => { row.weight = Math.min(row.weight, maxWeight); });
  const finalSectors = new Map();
  raw.forEach((row) => finalSectors.set(row.sector, (finalSectors.get(row.sector) || 0) + row.weight));
  raw.forEach((row) => {
    const sectorWeight = finalSectors.get(row.sector) || 0;
    if (sectorWeight > sectorCap) row.weight *= sectorCap / sectorWeight;
  });
  return raw.map(({ rawWeight: _rawWeight, ...row }) => ({ ...row, weight: Math.max(0, row.weight) }));
}

export function buildPortfolioModel(histories, config, asOfDate) {
  const factorRows = computeFactorRows(histories, config, asOfDate);
  const regime = resolveRegime(histories[config.benchmark || 'SPY'], asOfDate);
  const positions = constrainedWeights(factorRows, config.settings || {}, regime.grossTarget);
  const invested = positions.reduce((sum, position) => sum + position.weight, 0);
  const portfolioBeta = positions.reduce((sum, position) => sum + (position.weight * position.beta), 0);
  return {
    asOf: positions.map((position) => position.session).sort().at(0) || asOfDate || null,
    regime,
    factorRows,
    positions,
    invested,
    cash: Math.max(0, 1 - invested),
    portfolioBeta,
    concentrationShock: positions.length ? -0.25 * Math.max(...positions.map((position) => position.weight)) : 0,
    marketShock: -0.08 * portfolioBeta,
  };
}

function performanceMetrics(curve, daily, turnovers) {
  const values = curve.map((point) => point.portfolio);
  const totalReturn = values.length ? values.at(-1) - 1 : 0;
  const observations = daily.length;
  const annualized = observations > 0 ? ((1 + totalReturn) ** (TRADING_DAYS / observations)) - 1 : 0;
  const annualVolatility = sampleStd(daily) * Math.sqrt(TRADING_DAYS);
  const sharpe = sampleStd(daily) > EPSILON ? (mean(daily) / sampleStd(daily)) * Math.sqrt(TRADING_DAYS) : 0;
  return {
    totalReturn,
    annualized,
    annualVolatility,
    sharpe,
    maxDrawdown: maxDrawdown(values),
    hitRate: observations ? daily.filter((value) => value > 0).length / observations : 0,
    averageTurnover: mean(turnovers),
    observations,
    rebalances: turnovers.length,
  };
}

export function walkForwardBacktest(histories, config) {
  const benchmarkSymbol = config.benchmark || 'SPY';
  const benchmark = clipHistory(histories[benchmarkSymbol]);
  if (benchmark.length < 130) throw new Error('Benchmark history needs at least 130 completed sessions.');
  const assetMaps = new Map((config.universe || []).map((asset) => [
    asset.sym,
    new Map(clipHistory(histories[asset.sym]).map((candle) => [candle.t, finite(candle.c)])),
  ]));
  const rebalanceDays = clamp(Math.round(finite(config.settings?.rebalanceDays, 20)), 5, 63);
  const costRate = Math.max(0, finite(config.settings?.transactionCostBps, 10)) / 10000;
  const startIndex = 101;
  let portfolioEquity = 1;
  let benchmarkEquity = 1;
  let weights = new Map();
  const curve = [];
  const daily = [];
  const turnovers = [];

  for (let index = startIndex; index < benchmark.length; index += 1) {
    const date = benchmark[index].t;
    const previousDate = benchmark[index - 1].t;
    let transactionCost = 0;
    if (index === startIndex || ((index - startIndex) % rebalanceDays === 0)) {
      const model = buildPortfolioModel(histories, config, previousDate);
      const nextWeights = new Map(model.positions.map((position) => [position.sym, position.weight]));
      const symbols = new Set([...weights.keys(), ...nextWeights.keys()]);
      const turnover = [...symbols].reduce((sum, symbol) => sum + Math.abs((nextWeights.get(symbol) || 0) - (weights.get(symbol) || 0)), 0);
      turnovers.push(turnover);
      transactionCost = turnover * costRate;
      weights = nextWeights;
    }

    let portfolioReturn = 0;
    for (const [symbol, weight] of weights.entries()) {
      const map = assetMaps.get(symbol);
      const previous = map?.get(previousDate);
      const current = map?.get(date);
      if (previous > 0 && current > 0) portfolioReturn += weight * ((current / previous) - 1);
    }
    portfolioReturn -= transactionCost;
    const benchmarkPrevious = finite(benchmark[index - 1].c);
    const benchmarkReturn = benchmarkPrevious > 0 ? (finite(benchmark[index].c) / benchmarkPrevious) - 1 : 0;
    portfolioEquity *= Math.max(0.001, 1 + portfolioReturn);
    benchmarkEquity *= Math.max(0.001, 1 + benchmarkReturn);
    daily.push(portfolioReturn);
    curve.push({ t: date, portfolio: portfolioEquity, benchmark: benchmarkEquity });
  }

  return {
    curve,
    metrics: performanceMetrics(curve, daily, turnovers),
    benchmarkReturn: curve.length ? curve.at(-1).benchmark - 1 : 0,
    firstSession: curve[0]?.t || null,
    lastSession: curve.at(-1)?.t || null,
  };
}

export function runQuantExperiment(histories, config) {
  const model = buildPortfolioModel(histories, config);
  if (model.positions.length < 2) throw new Error('At least two assets with sufficient history are required.');
  const backtest = walkForwardBacktest(histories, config);
  return { model, backtest };
}
