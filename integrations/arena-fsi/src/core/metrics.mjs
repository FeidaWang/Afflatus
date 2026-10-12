/**
 * Source-neutral paper portfolio analytics. All ratio fields are fractions;
 * names ending in Pct are percentages. Missing evidence never becomes zero.
 */

const DAY_MS = 86_400_000;
const YEAR_DAYS = 365.25;
const number = (value) => typeof value === 'number' && Number.isFinite(value);
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const sampleVariance = (values) => {
  if (values.length < 2) return null;
  const average = mean(values);
  return values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
};
const toDate = (timestamp) => new Date(timestamp).toISOString().slice(0, 10);

function normalizedPoints(input, options = {}) {
  if (!Array.isArray(input)) throw new TypeError('Expected an array of dated portfolio or benchmark observations.');
  const ceiling = options.asOf === undefined ? Infinity : Date.parse(options.asOf);
  if (!Number.isFinite(ceiling) && ceiling !== Infinity) throw new TypeError('options.asOf must be a valid timestamp.');
  const byTime = new Map();
  for (const observation of input) {
    if (!observation || typeof observation !== 'object') throw new TypeError('Every observation must be an object.');
    const timestamp = Date.parse(observation.asOf ?? observation.date ?? '');
    const nav = observation.nav ?? observation.close ?? observation.value;
    const externalFlow = observation.externalFlow ?? 0;
    if (!Number.isFinite(timestamp)) throw new TypeError('Every observation needs a valid asOf or date.');
    if (timestamp > ceiling) throw new RangeError('Future observations cannot be included in an as-of performance report.');
    if (!number(nav) || nav <= 0) throw new RangeError('NAV/benchmark values must be positive and finite; incomplete marks cannot be scored.');
    if (!number(externalFlow)) throw new TypeError('externalFlow must be a finite number.');
    const normalized = {
      asOf: new Date(timestamp).toISOString(),
      date: toDate(timestamp),
      timestamp,
      nav,
      externalFlow,
      containsDemoData: observation.containsDemoData === true || observation.demo === true || observation.quality === 'demo',
    };
    if (byTime.has(timestamp)) {
      const previous = byTime.get(timestamp);
      if (previous.nav !== normalized.nav || previous.externalFlow !== normalized.externalFlow
        || previous.containsDemoData !== normalized.containsDemoData) {
        throw new RangeError('Conflicting observations have the same timestamp. Resolve them before scoring.');
      }
      continue;
    }
    byTime.set(timestamp, normalized);
  }
  return [...byTime.values()].sort((a, b) => a.timestamp - b.timestamp);
}

/** externalFlow is recognized at interval end. Dividends and trading PnL are internal, not flows. */
export function buildPortfolioCurve(observations, options = {}) {
  const points = normalizedPoints(observations, options);
  let index = 1;
  let peakIndex = 1;
  let cumulativeExternalFlow = 0;
  let previous = null;
  return points.map((point) => {
    const periodReturn = previous ? (point.nav - point.externalFlow) / previous.nav - 1 : null;
    if (periodReturn !== null && periodReturn <= -1) throw new RangeError('Cash-flow-adjusted equity must stay positive; this series cannot support linked returns.');
    if (previous) {
      index *= 1 + periodReturn;
      cumulativeExternalFlow += point.externalFlow;
    }
    peakIndex = Math.max(peakIndex, index);
    const result = {
      asOf: point.asOf,
      date: point.date,
      nav: point.nav,
      externalFlow: point.externalFlow,
      cumulativeExternalFlow,
      periodReturn,
      growthIndex: index,
      cumulativeReturn: index - 1,
      drawdown: index / peakIndex - 1,
      containsDemoData: point.containsDemoData,
    };
    previous = point;
    return result;
  });
}

function dailyCloses(curve) {
  const days = new Map();
  for (const point of curve) days.set(point.date, point);
  return [...days.values()];
}

function dailyCadenceValid(points, options = {}) {
  if (Array.isArray(options.tradingDates)) {
    const calendar = [...new Set(options.tradingDates)].sort();
    const indices = new Map(calendar.map((date, index) => [date, index]));
    return points.every((point, index) => indices.has(point.date)
      && (index === 0 || indices.get(point.date) === indices.get(points[index - 1].date) + 1));
  }
  // Without a supplied exchange calendar, reject missing weekdays (including holidays)
  // instead of silently treating a multi-session return as a one-session return.
  return points.every((point, index) => {
    const current = Date.parse(point.date);
    const weekday = new Date(current).getUTCDay();
    if (weekday === 0 || weekday === 6) return false;
    if (!index) return true;
    let next = Date.parse(points[index - 1].date) + DAY_MS;
    while ([0, 6].includes(new Date(next).getUTCDay())) next += DAY_MS;
    return current === next;
  });
}

function validatedOptions(options = {}) {
  const result = {
    periodsPerYear: 252,
    minAnnualizationDays: 365,
    minAnnualizationObservations: 252,
    minSharpeObservations: 60,
    riskFreeRate: 0,
    dailyCloseSeries: false,
    ...options,
  };
  for (const key of ['periodsPerYear', 'minAnnualizationDays', 'minAnnualizationObservations', 'minSharpeObservations']) {
    if (!number(result[key]) || result[key] <= 0) throw new RangeError(`${key} must be positive.`);
  }
  if (result.minSharpeObservations < 2) throw new RangeError('minSharpeObservations must be at least two.');
  if (!number(result.riskFreeRate) || result.riskFreeRate <= -1) throw new RangeError('riskFreeRate must exceed -100%.');
  return result;
}

export function calculatePerformance(observations, options = {}) {
  const policy = validatedOptions(options);
  const curve = buildPortfolioCurve(observations, policy);
  const reasons = [];
  const empty = {
    observationCount: curve.length,
    dailyObservationCount: 0,
    returnCount: Math.max(0, curve.length - 1),
    elapsedDays: 0,
    initialNav: null,
    finalNav: null,
    netProfit: null,
    externalFlows: 0,
    totalReturn: null,
    totalReturnPct: null,
    maxDrawdown: null,
    maxDrawdownPct: null,
    annualizedReturn: null,
    annualizedReturnPct: null,
    annualizedVolatility: null,
    sharpe: null,
    sharpeRatio: null,
    containsDemoData: curve.some((point) => point.containsDemoData),
    annualizationEligible: false,
    sharpeEligible: false,
    reasons,
    curve,
  };
  if (!curve.length) return { ...empty, reasons: ['NO_OBSERVATIONS'] };
  const first = curve[0];
  const last = curve.at(-1);
  const elapsedDays = (Date.parse(last.asOf) - Date.parse(first.asOf)) / DAY_MS;
  const daily = dailyCloses(curve);
  const externalFlows = last.cumulativeExternalFlow;
  const totalReturn = last.growthIndex - 1;
  const maxDrawdown = Math.max(0, ...curve.map((point) => -point.drawdown));
  const result = {
    ...empty,
    dailyObservationCount: daily.length,
    elapsedDays,
    initialNav: first.nav,
    finalNav: last.nav,
    netProfit: last.nav - first.nav - externalFlows,
    externalFlows,
    totalReturn,
    totalReturnPct: totalReturn * 100,
    maxDrawdown,
    maxDrawdownPct: maxDrawdown * 100,
  };
  if (curve.length < 2) reasons.push('INSUFFICIENT_RETURN_OBSERVATIONS');
  if (elapsedDays >= policy.minAnnualizationDays && daily.length >= policy.minAnnualizationObservations) {
    result.annualizationEligible = true;
    result.annualizedReturn = last.growthIndex ** (YEAR_DAYS / elapsedDays) - 1;
    result.annualizedReturnPct = result.annualizedReturn * 100;
  } else reasons.push('INSUFFICIENT_ANNUALIZATION_HISTORY');
  if (!policy.dailyCloseSeries) {
    reasons.push('DAILY_CLOSE_SERIES_NOT_CONFIRMED');
    return result;
  }
  const dailyReturns = daily.slice(1).map((point, index) => point.growthIndex / daily[index].growthIndex - 1);
  if (dailyReturns.length < policy.minSharpeObservations) {
    reasons.push('INSUFFICIENT_SHARPE_OBSERVATIONS');
    return result;
  }
  if (!dailyCadenceValid(daily, policy)) {
    reasons.push('IRREGULAR_DAILY_SAMPLING');
    return result;
  }
  const standardDeviation = Math.sqrt(sampleVariance(dailyReturns));
  result.annualizedVolatility = standardDeviation * Math.sqrt(policy.periodsPerYear);
  if (standardDeviation < 1e-12) {
    reasons.push('ZERO_RETURN_VARIANCE');
    return result;
  }
  const riskFreePeriod = (1 + policy.riskFreeRate) ** (1 / policy.periodsPerYear) - 1;
  result.sharpeEligible = true;
  result.sharpe = (mean(dailyReturns) - riskFreePeriod) / standardDeviation * Math.sqrt(policy.periodsPerYear);
  result.sharpeRatio = result.sharpe;
  return result;
}

/** Compare only common UTC dates; do not forward-fill a missing market or strategy observation. */
export function compareWithBenchmark(portfolioObservations, benchmarkObservations, options = {}) {
  const policy = validatedOptions(options);
  const portfolioCurve = buildPortfolioCurve(portfolioObservations, policy);
  const benchmarkCurve = buildPortfolioCurve(benchmarkObservations, policy);
  const portfolioDays = new Map(dailyCloses(portfolioCurve).map((point) => [point.date, point]));
  const benchmarkDays = new Map(dailyCloses(benchmarkCurve).map((point) => [point.date, point]));
  const commonDates = [...portfolioDays.keys()].filter((date) => benchmarkDays.has(date)).sort();
  const benchmarkType = options.benchmarkType ?? 'price';
  if (!['price', 'total-return'].includes(benchmarkType)) throw new RangeError('benchmarkType must be price or total-return.');
  const reasons = [];
  if (benchmarkType === 'price') reasons.push('PRICE_BENCHMARK_EXCLUDES_DIVIDENDS');
  if (commonDates.length < 2) {
    return {
      commonDates,
      commonObservationCount: commonDates.length,
      pairedIntervalCount: 0,
      curve: [],
      portfolio: null,
      benchmark: null,
      benchmarkType,
      excessReturn: null,
      excessReturnPct: null,
      trackingError: null,
      informationRatio: null,
      reasons: [...reasons, 'INSUFFICIENT_COMMON_DATES'],
    };
  }
  const portfolioStart = portfolioDays.get(commonDates[0]).growthIndex;
  const benchmarkStart = benchmarkDays.get(commonDates[0]).growthIndex;
  const curve = commonDates.map((date) => {
    const portfolio = portfolioDays.get(date);
    const benchmark = benchmarkDays.get(date);
    return {
      date,
      portfolioAsOf: portfolio.asOf,
      benchmarkAsOf: benchmark.asOf,
      portfolioIndex: 100 * portfolio.growthIndex / portfolioStart,
      benchmarkIndex: 100 * benchmark.growthIndex / benchmarkStart,
      portfolioReturn: portfolio.growthIndex / portfolioStart - 1,
      benchmarkReturn: benchmark.growthIndex / benchmarkStart - 1,
      containsDemoData: portfolio.containsDemoData || benchmark.containsDemoData,
    };
  });
  const portfolio = calculatePerformance(curve.map((point) => ({ date: point.date, nav: point.portfolioIndex, containsDemoData: point.containsDemoData })), policy);
  const benchmark = calculatePerformance(curve.map((point) => ({ date: point.date, nav: point.benchmarkIndex, containsDemoData: point.containsDemoData })), policy);
  const activeReturns = curve.slice(1).map((point, index) => point.portfolioIndex / curve[index].portfolioIndex - point.benchmarkIndex / curve[index].benchmarkIndex);
  const excessReturn = portfolio.totalReturn - benchmark.totalReturn;
  let trackingError = null;
  let informationRatio = null;
  if (policy.dailyCloseSeries && activeReturns.length >= policy.minSharpeObservations && dailyCadenceValid(curve, policy)) {
    const deviation = Math.sqrt(sampleVariance(activeReturns));
    trackingError = deviation * Math.sqrt(policy.periodsPerYear);
    if (deviation >= 1e-12) informationRatio = mean(activeReturns) / deviation * Math.sqrt(policy.periodsPerYear);
    else reasons.push('ZERO_ACTIVE_RETURN_VARIANCE');
  } else reasons.push('INSUFFICIENT_OR_UNCONFIRMED_DAILY_ACTIVE_RETURNS');
  return {
    commonDates,
    commonObservationCount: commonDates.length,
    pairedIntervalCount: commonDates.length - 1,
    from: commonDates[0],
    to: commonDates.at(-1),
    curve,
    portfolio,
    benchmark,
    benchmarkType,
    excessReturn,
    excessReturnPct: excessReturn * 100,
    trackingError,
    informationRatio,
    reasons,
  };
}

// Readable aliases for consumers migrating from an existing dashboard.
export const computeMetrics = calculatePerformance;
export const equityCurve = buildPortfolioCurve;
