import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPortfolioCurve, calculatePerformance, compareWithBenchmark } from '../src/core/metrics.mjs';

const point = (date, nav, extra = {}) => ({ date, nav, ...extra });
const near = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
function weekdaySeries(count, start = '2025-01-02') {
  let timestamp = Date.parse(start);
  let nav = 100;
  const result = [];
  while (result.length < count) {
    if (![0, 6].includes(new Date(timestamp).getUTCDay())) {
      nav *= 1 + (result.length % 2 ? 0.003 : -0.001);
      result.push(point(new Date(timestamp).toISOString().slice(0, 10), nav));
    }
    timestamp += 86_400_000;
  }
  return result;
}

test('short histories show raw return and drawdown without annualized return or Sharpe', () => {
  const result = calculatePerformance([
    point('2026-10-01', 100), point('2026-10-02', 120), point('2026-10-05', 90), point('2026-10-06', 110),
  ], { dailyCloseSeries: true });
  near(result.totalReturn, 0.1);
  near(result.totalReturnPct, 10);
  near(result.maxDrawdown, 0.25);
  near(result.maxDrawdownPct, 25);
  assert.equal(result.annualizedReturn, null);
  assert.equal(result.sharpe, null);
  assert.ok(result.reasons.includes('INSUFFICIENT_ANNUALIZATION_HISTORY'));
  assert.ok(result.reasons.includes('INSUFFICIENT_SHARPE_OBSERVATIONS'));
});

test('external deposits do not appear as investment gains or conceal drawdown', () => {
  const curve = buildPortfolioCurve([
    point('2026-10-01', 100), point('2026-10-02', 200, { externalFlow: 100 }), point('2026-10-05', 180),
  ]);
  near(curve[1].periodReturn, 0);
  near(curve[2].cumulativeReturn, -0.1);
  near(curve[2].drawdown, -0.1);
  const result = calculatePerformance([
    point('2026-10-01', 100), point('2026-10-02', 200, { externalFlow: 100 }), point('2026-10-05', 180),
  ]);
  assert.equal(result.netProfit, -20);
  assert.equal(result.externalFlows, 100);
});

test('withdrawals use the documented end-of-interval cash flow convention', () => {
  const result = calculatePerformance([
    point('2026-10-01', 100), point('2026-10-02', 60, { externalFlow: -50 }),
  ]);
  near(result.totalReturn, 0.1);
  assert.equal(result.netProfit, 10);
});

test('common-date benchmark comparison rebases both series to exactly the same window', () => {
  const result = compareWithBenchmark(
    [point('2026-10-01', 100), point('2026-10-02', 120), point('2026-10-05', 150), point('2026-10-06', 180)],
    [point('2026-10-02', 200), point('2026-10-06', 220), point('2026-10-07', 240)],
  );
  assert.deepEqual(result.commonDates, ['2026-10-02', '2026-10-06']);
  assert.equal(result.curve[0].portfolioIndex, 100);
  assert.equal(result.curve[0].benchmarkIndex, 100);
  near(result.portfolio.totalReturn, 0.5);
  near(result.benchmark.totalReturn, 0.1);
  near(result.excessReturn, 0.4);
  assert.ok(result.reasons.includes('PRICE_BENCHMARK_EXCLUDES_DIVIDENDS'));
  assert.equal(result.trackingError, null);
});

test('flows on non-common dates remain neutralized before benchmark alignment', () => {
  const result = compareWithBenchmark(
    [point('2026-10-01', 100), point('2026-10-02', 200, { externalFlow: 100 }), point('2026-10-05', 220)],
    [point('2026-10-01', 100), point('2026-10-05', 110)],
    { benchmarkType: 'total-return' },
  );
  near(result.portfolio.totalReturn, 0.1);
  near(result.excessReturn, 0);
  assert.ok(!result.reasons.includes('PRICE_BENCHMARK_EXCLUDES_DIVIDENDS'));
});

test('no overlap or a single common date does not create benchmark performance', () => {
  const result = compareWithBenchmark([point('2026-10-01', 100)], [point('2026-10-02', 100)]);
  assert.equal(result.excessReturn, null);
  assert.equal(result.portfolio, null);
  assert.equal(result.commonObservationCount, 0);
  assert.ok(result.reasons.includes('INSUFFICIENT_COMMON_DATES'));
});

test('invalid, missing, ambiguous duplicate, and future observations cannot silently alter scoring', () => {
  assert.throws(() => calculatePerformance([point('2026-10-01', null)]), /positive/);
  assert.throws(() => calculatePerformance([point('2026-10-01', NaN)]), /positive/);
  assert.throws(() => calculatePerformance([point('bad', 100)]), /valid asOf/);
  assert.throws(() => calculatePerformance([point('2026-10-01', 100), point('2026-10-01', 110)]), /Conflicting/);
  assert.throws(() => calculatePerformance([point('2026-10-03', 100)], { asOf: '2026-10-02' }), /Future/);
  assert.throws(() => buildPortfolioCurve([point('2026-10-01', 100), point('2026-10-02', 10, { externalFlow: 100 })]), /positive/);
});

test('out-of-order observations are sorted and exact duplicates are counted once', () => {
  const result = calculatePerformance([point('2026-10-02', 110), point('2026-10-01', 100), point('2026-10-02', 110)]);
  assert.equal(result.observationCount, 2);
  near(result.totalReturn, 0.1);
});

test('intraday polling never masquerades as many daily Sharpe observations', () => {
  const points = Array.from({ length: 1000 }, (_, index) => ({ asOf: new Date(Date.parse('2026-10-01T14:00:00Z') + index * 1_000).toISOString(), nav: 100 + index / 100 }));
  const result = calculatePerformance(points, { dailyCloseSeries: true });
  assert.equal(result.observationCount, 1000);
  assert.equal(result.dailyObservationCount, 1);
  assert.equal(result.sharpe, null);
  assert.equal(result.annualizedReturn, null);
});

test('enough confirmed consecutive daily closes produce volatility and finite Sharpe but not premature CAGR', () => {
  const points = weekdaySeries(80);
  const result = calculatePerformance(points, { dailyCloseSeries: true });
  assert.equal(result.sharpeEligible, true);
  assert.ok(Number.isFinite(result.sharpe));
  assert.ok(result.annualizedVolatility > 0);
  assert.equal(result.annualizedReturn, null);
  const unconfirmed = calculatePerformance(points);
  assert.equal(unconfirmed.sharpe, null);
  assert.ok(unconfirmed.reasons.includes('DAILY_CLOSE_SERIES_NOT_CONFIRMED'));
});

test('a complete year and enough distinct daily observations permit annualized linked return', () => {
  const result = calculatePerformance(weekdaySeries(300), { dailyCloseSeries: true });
  assert.equal(result.annualizationEligible, true);
  near(result.annualizedReturn, (1 + result.totalReturn) ** (365.25 / result.elapsedDays) - 1);
  assert.ok(Number.isFinite(result.sharpe));
});

test('constant daily returns have undefined Sharpe rather than Infinity', () => {
  const points = weekdaySeries(80).map((entry, index) => ({ ...entry, nav: 100 * 1.001 ** index }));
  const result = calculatePerformance(points, { dailyCloseSeries: true });
  assert.equal(result.sharpe, null);
  assert.ok(result.reasons.includes('ZERO_RETURN_VARIANCE'));
});

test('unexplained missing weekdays prevent daily annualization; an explicit exchange calendar can account for closures', () => {
  const points = weekdaySeries(80);
  points.splice(20, 1);
  const incomplete = calculatePerformance(points, { dailyCloseSeries: true });
  assert.equal(incomplete.sharpe, null);
  assert.ok(incomplete.reasons.includes('IRREGULAR_DAILY_SAMPLING'));
  const calendar = points.map((entry) => entry.date);
  const explained = calculatePerformance(points, { dailyCloseSeries: true, tradingDates: calendar });
  assert.ok(Number.isFinite(explained.sharpe));
});

test('benchmarks accept closing values, label return type, and carry demo contamination', () => {
  const result = compareWithBenchmark(
    [point('2026-10-01', 100, { containsDemoData: true }), point('2026-10-02', 110, { containsDemoData: true })],
    [{ date: '2026-10-01', close: 50 }, { date: '2026-10-02', value: 55 }],
  );
  assert.equal(result.portfolio.containsDemoData, true);
  assert.equal(result.curve[0].containsDemoData, true);
  near(result.excessReturn, 0);
});

test('empty and single observations return explicit insufficient-sample metrics', () => {
  const empty = calculatePerformance([]);
  assert.equal(empty.totalReturn, null);
  assert.ok(empty.reasons.includes('NO_OBSERVATIONS'));
  const one = calculatePerformance([point('2026-10-01', 100)]);
  assert.equal(one.totalReturn, 0);
  assert.equal(one.sharpe, null);
  assert.equal(one.annualizedReturn, null);
  assert.ok(one.reasons.includes('INSUFFICIENT_RETURN_OBSERVATIONS'));
});
