import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  calculateWACC, calculateDCF, compareCompanies, analyzeEarnings, validateEvidence, validateResearch,
  createThesis, updateThesis, calibrateForecasts, evaluateStrategy, proposeFeedback, buildMorningBrief,
} from '../src/research/index.mjs';

const AS_OF = '2026-10-12T12:00:00Z';
const near = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
const errorCode = code => error => error.code === code;
const dcfInput = () => ({ asOf: AS_OF, currency: 'USD', units: 'millions', debt: 200, cash: 50,
  shares: { basic: 100_000_000, incremental: 0 }, scenarios: {
    bear: { fcff: [80, 88], wacc: 0.12, terminalGrowth: 0.01 },
    base: { fcff: [100, 110], wacc: 0.1, terminalGrowth: 0.02 },
    bull: { fcff: [120, 132], wacc: 0.08, terminalGrowth: 0.03 },
  } });
const peer = (symbol = 'ABC') => ({ symbol, currency: 'USD', units: 'millions', asOf: AS_OF,
  period: { basis: 'TTM', end: '2026-09-30', accounting: 'GAAP' }, sector: 'software',
  marketCap: 1000, enterpriseValue: 1200, revenue: 100, revenuePrior: 80, grossProfit: 70,
  ebitda: 20, netIncome: 10, fcf: 20, sourceIds: ['source-1'] });
const source = overrides => ({ id: 'source-1', kind: 'market_data', title: 'Verified test fixture',
  url: 'https://example.test/quotes/ABC', publishedAt: '2026-10-12T10:00:00Z',
  availableAt: '2026-10-12T10:00:01Z', retrievedAt: '2026-10-12T12:01:00Z', ...overrides });
const research = () => ({ snapshotAt: AS_OF, sources: [source()],
  facts: [{ id: 'f1', claim: 'The fixture reports revenue of 100 USD million.', sourceIds: ['source-1'],
    numericClaims: [{ name: 'revenue', value: 100, unit: 'USD million', sourceIds: ['source-1'] }] }],
  assumptions: [{ id: 'a1', claim: 'Forward growth assumption is 10%.', value: 0.1, unit: 'ratio', rationale: 'Explicit scenario input.' }],
  inferences: [{ id: 'i1', claim: 'Scenario forward revenue is 110.', value: 110, unit: 'USD million', basedOn: ['f1', 'a1'],
    calculation: { method: 'revenue*(1+growth)', inputIds: ['f1', 'a1'] } }],
  decision: { action: 'hold', confidence: 0.5, rationale: 'Wait for the next sourced observation.', evidenceIds: ['f1'] } });
const thesis = () => createThesis({ id: 'thesis-abc', symbol: 'abc', statement: 'Operating leverage may improve.', createdAt: '2026-10-01T12:00:00Z',
  pillars: [{ id: 'margin', expectation: 'Margin exceeds 20%.', invalidation: 'Two quarters below 15%.' }],
  risks: ['Competition reduces pricing power.'], stopTrigger: 'Invalidate when margin remains below 15%.', targetPrice: 100 });
const forecast = (id = 'forecast-1', overrides = {}) => ({ id, modelId: 'analyst', modelVersion: 'v1', cohort: 'ABC/next-session-up',
  createdAt: '2026-10-10T12:00:00Z', featureSnapshotAt: '2026-10-10T11:59:00Z',
  horizonAt: '2026-10-11T12:00:00Z', resolvedAt: '2026-10-11T12:01:00Z', probability: 0.8, outcome: 1, ...overrides });

test('WACC: market debt/equity weights, CAPM, and the tax shield are computed explicitly', () => {
  const result = calculateWACC({ marketEquity: 800, marketDebt: 200, riskFreeRate: 0.04, beta: 1.2,
    equityRiskPremium: 0.05, preTaxCostOfDebt: 0.06, taxRate: 0.25 });
  near(result.costOfEquity, 0.10); near(result.equityWeight, 0.8); near(result.debtWeight, 0.2);
  near(result.wacc, 0.1 * 0.8 + 0.06 * 0.75 * 0.2);
});

test('WACC: net-cash/duplicate cost-of-equity inputs cannot produce a false capital weight', () => {
  const base = { marketEquity: 800, marketDebt: 200, costOfEquity: 0.1, preTaxCostOfDebt: 0.06, taxRate: 0.25 };
  assert.throws(() => calculateWACC({ ...base, netDebt: -50 }), errorCode('INVALID_WACC_CAPITAL_BASE'));
  assert.throws(() => calculateWACC({ ...base, beta: 1.2 }), errorCode('AMBIGUOUS_COST_OF_EQUITY'));
  near(calculateWACC({ ...base, marketDebt: 0 }).wacc, 0.1);
});

test('DCF: analytical FCFF valuation and equity bridge', () => {
  const result = calculateDCF(dcfInput());
  const expectedEV = 100 / 1.1 + 110 / 1.1 ** 2 + (110 * 1.02 / (0.1 - 0.02)) / 1.1 ** 2;
  near(result.scenarios.base.enterpriseValue, expectedEV);
  near(result.scenarios.base.equityValue, expectedEV - 150);
  near(result.scenarios.base.pricePerShare, (expectedEV - 150) / 100);
  assert.ok(result.scenarios.bear.pricePerShare < result.scenarios.base.pricePerShare);
  assert.ok(result.scenarios.bull.pricePerShare > result.scenarios.base.pricePerShare);
});

test('DCF: all 25 sensitivity cells recalculate full PV and match the base center', () => {
  const result = calculateDCF(dcfInput());
  assert.equal(result.sensitivity.grid.flat().length, 25);
  assert.equal(result.sensitivity.centerMatchesBase, true);
  for (const cell of result.sensitivity.grid.flat()) {
    const expected = (100 / (1 + cell.wacc) + 110 / (1 + cell.wacc) ** 2
      + 110 * (1 + cell.terminalGrowth) / (cell.wacc - cell.terminalGrowth) / (1 + cell.wacc) ** 2 - 150) / 100;
    near(cell.pricePerShare, expected);
  }
});

test('DCF: units and dilution are explicit and preserve economics', () => {
  const input = dcfInput(); const before = structuredClone(input);
  const baseline = calculateDCF(input).scenarios.base.pricePerShare;
  input.shares.incremental = 10_000_000;
  near(calculateDCF(input).scenarios.base.pricePerShare, baseline / 1.1);
  const scaled = structuredClone(before); scaled.units = 'ones'; scaled.debt *= 1e6; scaled.cash *= 1e6;
  for (const scenario of Object.values(scaled.scenarios)) scenario.fcff = scenario.fcff.map(value => value * 1e6);
  near(calculateDCF(scaled).scenarios.base.pricePerShare, baseline);
  assert.deepEqual(before, dcfInput());
});

test('DCF: net debt deducts cash once, including net-cash businesses', () => {
  const input = dcfInput(); const baseline = calculateDCF(input);
  delete input.debt; delete input.cash; input.netDebt = 150; input.cashIncludedInNetDebt = true;
  near(calculateDCF(input).scenarios.base.pricePerShare, baseline.scenarios.base.pricePerShare);
  input.netDebt = -50;
  near(calculateDCF(input).scenarios.base.pricePerShare, baseline.scenarios.base.pricePerShare + 2);
  input.cash = 50;
  assert.throws(() => calculateDCF(input), errorCode('AMBIGUOUS_NET_DEBT'));
});

test('DCF: reject ambiguous dilution, undeclared net debt, and invalid perpetuities', () => {
  const input = dcfInput(); input.shares.diluted = 100_000_000;
  assert.throws(() => calculateDCF(input), errorCode('AMBIGUOUS_DILUTION'));
  const net = dcfInput(); delete net.debt; delete net.cash; net.netDebt = 150;
  assert.throws(() => calculateDCF(net), errorCode('NET_DEBT_CASH_UNDECLARED'));
  const g = dcfInput(); g.scenarios.base.terminalGrowth = g.scenarios.base.wacc;
  assert.throws(() => calculateDCF(g), errorCode('WACC_NOT_ABOVE_GROWTH'));
  const loss = dcfInput(); loss.scenarios.base.fcff[1] = -1;
  assert.throws(() => calculateDCF(loss), errorCode('NON_POSITIVE_TERMINAL_FCFF'));
});

test('DCF: invalid edge cells are NM and never fabricated', () => {
  const input = dcfInput(); input.scenarios.base.wacc = 0.03; input.scenarios.base.terminalGrowth = 0.029;
  const result = calculateDCF(input);
  assert.ok(result.sensitivity.grid.flat().some(cell => !cell.valid && cell.pricePerShare === null));
  assert.equal(result.sensitivity.centerMatchesBase, true);
});

test('DCF: preferred/minority/other-asset bridge is independent of net debt', () => {
  const baseline = calculateDCF(dcfInput()).scenarios.base.equityValue;
  const result = calculateDCF({ ...dcfInput(), preferredEquity: 20, nonControllingInterest: 10, otherNonOperatingAssets: 5 });
  near(result.scenarios.base.equityValue, baseline - 25);
});

test('Comps: normalize money units and compute ratios/statistics from inputs', () => {
  const a = peer('A'); const b = peer('B'); b.units = 'billions';
  for (const key of ['marketCap', 'enterpriseValue', 'revenue', 'revenuePrior', 'grossProfit', 'ebitda', 'netIncome', 'fcf']) b[key] /= 1000;
  const result = compareCompanies([a, b]);
  near(result.rows[0].metrics.evRevenue.value, 12);
  near(result.rows[1].metrics.evRevenue.value, 12);
  near(result.rows[0].metrics.ruleOf40.value, 0.45);
  near(result.statistics.pe.median, 100);
  assert.equal(result.units, 'ones');
});

test('Comps: losses and zero denominators are NM while negative cash yield is meaningful', () => {
  const input = peer(); input.ebitda = -10; input.netIncome = 0; input.fcf = -5;
  const result = compareCompanies([input]);
  assert.equal(result.rows[0].metrics.evEbitda.value, null);
  assert.equal(result.rows[0].metrics.pe.status, 'NM');
  near(result.rows[0].metrics.fcfYield.value, -0.005);
  near(result.rows[0].metrics.ebitdaMargin.value, -0.1);
  assert.equal(result.statistics.evEbitda.count, 0);
});

test('Comps: reject mixed currency, period, accounting basis, and duplicate symbols', () => {
  for (const b of [{ ...peer('B'), currency: 'AUD' }, { ...peer('B'), period: { ...peer().period, basis: 'NTM' } },
    { ...peer('B'), period: { ...peer().period, accounting: 'ADJUSTED' } }, { ...peer('B'), asOf: '2026-10-11T12:00:00Z' }]) {
    assert.throws(() => compareCompanies([peer('A'), b]), errorCode('INCOMPARABLE_PEERS'));
  }
  assert.throws(() => compareCompanies([peer(), peer()]), errorCode('DUPLICATE_PEER'));
});

test('Comps: derive EV once and flag statistical outliers without dropping them', () => {
  const a = peer('A'); delete a.enterpriseValue; a.debt = 300; a.cash = 100;
  near(compareCompanies([a]).rows[0].enterpriseValue, 1200e6);
  const result = compareCompanies([1, 2, 3, 100].map((multiple, i) => ({ ...peer(`P${i}`), enterpriseValue: multiple * 100 })));
  assert.ok(result.rows[3].outliers.includes('evRevenue'));
  assert.equal(result.statistics.evRevenue.count, 4);
  near(result.statistics.evRevenue.median, 2.5);
});

test('Earnings: loss improvements, zero consensus, and lower-is-better metrics', () => {
  const result = analyzeEarnings({ actual: { eps: -0.1, revenue: 0, costs: 90 }, consensus: { eps: -0.3, revenue: 0, costs: 100 },
    prior: { eps: -0.2 }, directions: { costs: 'lower' } });
  const eps = result.rows.find(row => row.metric === 'eps');
  near(eps.versusConsensus.percent, 2 / 3); assert.equal(eps.versusConsensus.result, 'beat');
  assert.equal(result.rows.find(row => row.metric === 'revenue').versusConsensus.percent, null);
  assert.equal(result.rows.find(row => row.metric === 'costs').versusConsensus.result, 'beat');
});

test('Earnings: accounting/unit mismatches are incomparable, missing data stays missing', () => {
  const result = analyzeEarnings({ actual: { eps: { value: 1, basis: 'GAAP' }, revenue: 100 },
    consensus: { eps: { value: 1.2, basis: 'ADJUSTED' } } });
  assert.equal(result.rows[0].versusConsensus.result, 'incomparable');
  assert.equal(result.rows[1].versusConsensus.result, 'missing');
});

test('Evidence: accept historical availability even when reconstructed after the cutoff', () => {
  assert.equal(validateEvidence([source()], { asOf: AS_OF }).valid, true);
});

test('Evidence: exclude future availability/vintages, duplicate IDs, and unsafe URLs', () => {
  const future = validateEvidence([source({ availableAt: '2026-10-13T00:00:00Z' })], { asOf: AS_OF });
  assert.equal(future.valid, false); assert.equal(future.errors[0].code, 'FUTURE_EVIDENCE');
  assert.equal(validateEvidence([source({ versionAt: '2026-10-12T11:00:00Z' })], { asOf: AS_OF }).valid, false);
  assert.equal(validateEvidence([source(), source()], { asOf: AS_OF }).valid, false);
  assert.equal(validateEvidence([source({ url: 'javascript:alert(1)' })], { asOf: AS_OF }).valid, false);
  assert.equal(validateEvidence([source({ publishedAt: '2026-02-30' })], { asOf: AS_OF }).valid, false);
});

test('Research: sourced facts, explicit assumptions, and calculable inferences validate', () => {
  const result = validateResearch(research(), { asOf: AS_OF });
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(result.executionAuthorized, false);
});

test('Research: numeric facts cannot bypass source/units or hide in extra fields', () => {
  const missing = research(); missing.facts[0].numericClaims[0].sourceIds = [];
  assert.equal(validateResearch(missing, { asOf: AS_OF }).valid, false);
  const unknown = research(); unknown.facts[0].price = 100;
  assert.ok(validateResearch(unknown, { asOf: AS_OF }).errors.some(error => error.code === 'UNRECOGNIZED_RESEARCH_FIELD'));
  const uncited = research(); uncited.facts[0].sourceIds = ['no-such-source'];
  assert.equal(validateResearch(uncited, { asOf: AS_OF }).valid, false);
});

test('Research: reject future numeric facts, snapshot mismatch, and circular inference', () => {
  const future = research(); future.facts[0].numericClaims[0].availableAt = '2026-10-13T00:00:00Z';
  assert.equal(validateResearch(future, { asOf: AS_OF }).valid, false);
  const circular = research(); circular.inferences[0].basedOn = ['i1'];
  assert.equal(validateResearch(circular, { asOf: AS_OF }).valid, false);
  assert.equal(validateResearch(research(), { asOf: '2026-10-12T11:00:00Z' }).valid, false);
});

test('Research: buy/sell needs cited evidence and a falsifiable invalidation', () => {
  const input = research(); input.decision.action = 'buy';
  assert.equal(validateResearch(input, { asOf: AS_OF }).valid, false);
  input.decision.invalidation = 'Revenue declines in the next two observed periods.';
  assert.equal(validateResearch(input, { asOf: AS_OF }).valid, true);
});

test('Thesis: disconfirming evidence changes state and appends an immutable revision', () => {
  const original = thesis(); const frozen = structuredClone(original);
  const next = updateThesis(original, { id: 'e1', type: 'evidence', at: '2026-10-02T12:00:00Z',
    description: 'Margin slipped below the expectation.', pillarId: 'margin', impact: 'weakens', sourceIds: ['source-1'] }, { asOf: AS_OF });
  assert.deepEqual(original, frozen); assert.equal(next.status, 'challenged'); assert.equal(next.revision, 2);
  assert.equal(next.pillars[0].status, 'challenged');
  const reviewed = updateThesis(next, { id: 'e2', type: 'review', at: '2026-10-03T12:00:00Z',
    description: 'Reviewed the temporary charge against original evidence.', nextStatus: 'active', conviction: 'low' });
  assert.equal(reviewed.status, 'active'); assert.equal(reviewed.revision, 3);
});

test('Thesis: duplicate/out-of-order/future events are rejected', () => {
  const original = thesis(); const event = { id: 'e1', type: 'review', at: '2026-10-02T12:00:00Z', description: 'Review.' };
  const next = updateThesis(original, event);
  assert.throws(() => updateThesis(next, event), errorCode('DUPLICATE_THESIS_EVENT'));
  assert.throws(() => updateThesis(next, { ...event, id: 'e2', at: '2026-09-01T00:00:00Z' }), errorCode('OUT_OF_ORDER_THESIS_EVENT'));
  assert.throws(() => updateThesis(original, event, { asOf: '2026-10-01T12:00:00Z' }), errorCode('FUTURE_THESIS_EVENT'));
});

test('Thesis: invalidated and closed states cannot silently return to active', () => {
  const invalidated = updateThesis(thesis(), { id: 'e1', type: 'transition', at: '2026-10-02T12:00:00Z', description: 'Disproved.', nextStatus: 'invalidated' });
  assert.throws(() => updateThesis(invalidated, { id: 'e2', type: 'review', at: '2026-10-03T12:00:00Z', description: 'Reopen.', nextStatus: 'active' }), errorCode('INVALID_THESIS_TRANSITION'));
  const closed = updateThesis(invalidated, { id: 'e3', type: 'transition', at: '2026-10-03T12:00:00Z', description: 'Archived.', nextStatus: 'closed' });
  assert.throws(() => updateThesis(closed, { id: 'e4', type: 'review', at: '2026-10-04T12:00:00Z', description: 'Review.' }), errorCode('THESIS_CLOSED'));
});

test('Calibration: exact Brier/log loss/reliability with insufficient-sample labeling', () => {
  const result = calibrateForecasts([forecast('a'), forecast('b', { probability: 0.2, outcome: 0 })], { asOf: AS_OF, bins: 2 });
  assert.equal(result.status, 'insufficient'); near(result.metrics.brier, 0.04); near(result.metrics.logLoss, -Math.log(0.8));
  near(result.metrics.expectedCalibrationError, 0.2);
  assert.equal(result.reliability[0].count, 1); assert.equal(result.reliability[1].count, 1);
  assert.equal(result.proposal.liveWeightsChanged, false);
});

test('Calibration: exclude future features, immature horizons, and premature/future outcomes', () => {
  const result = calibrateForecasts([forecast('good'),
    forecast('future-feature', { featureSnapshotAt: '2026-10-10T12:01:00Z' }),
    forecast('future-vintage', { maxFeatureAvailableAt: '2026-10-10T12:01:00Z' }),
    forecast('immature', { horizonAt: '2026-10-13T12:00:00Z' }),
    forecast('too-early', { resolvedAt: '2026-10-11T11:59:00Z' }),
    forecast('future-outcome', { resolvedAt: '2026-10-13T00:00:00Z' }),
    forecast('unresolved', { resolvedAt: null, outcome: null })], { asOf: AS_OF });
  assert.equal(result.count, 1); assert.equal(result.excluded.length, 6);
});

test('Calibration: mixed model versions are never pooled into headline scores', () => {
  const result = calibrateForecasts([forecast('a'), forecast('b', { modelVersion: 'v2' })], { asOf: AS_OF });
  assert.equal(result.status, 'mixed_cohorts'); assert.equal(result.metrics, null); assert.equal(result.cohorts.length, 2);
});

test('Calibration: probability endpoints have finite log loss and p=1 enters last bin', () => {
  const result = calibrateForecasts([forecast('a', { probability: 0, outcome: 0 }), forecast('b', { probability: 1, outcome: 1 })], { asOf: AS_OF, minSamples: 2 });
  assert.equal(result.status, 'ready'); near(result.metrics.brier, 0); assert.ok(Number.isFinite(result.metrics.logLoss));
  assert.equal(result.reliability.at(-1).count, 1);
  assert.throws(() => calibrateForecasts([], { asOf: AS_OF, epsilon: 1e-30 }));
});

test('Calibration: duplicate resolved forecasts do not inflate sample count', () => {
  const result = calibrateForecasts([forecast(), forecast()], { asOf: AS_OF });
  assert.equal(result.count, 1); assert.equal(result.excluded[0].code, 'DUPLICATE_FORECAST');
});

test('Strategy: time-weighted return, drawdown, and benchmark excess are independently correct', () => {
  const result = evaluateStrategy([{ at: '2026-10-01', equity: 100, benchmarkEquity: 100 },
    { at: '2026-10-02', equity: 110, benchmarkEquity: 105 }, { at: '2026-10-03', equity: 99, benchmarkEquity: 107 }],
  { asOf: AS_OF });
  near(result.metrics.totalReturn, -0.01); near(result.metrics.maxDrawdown, -0.1);
  near(result.metrics.netPnl, -1); near(result.metrics.benchmarkReturn, 0.07); near(result.metrics.excessReturn, -0.08);
  assert.equal(result.status, 'insufficient');
  assert.equal(result.metrics.cagr, null); assert.equal(result.metrics.sharpe, null); assert.equal(result.metrics.annualizedVolatility, null);
});

test('Strategy: deposits are not profits or performance', () => {
  const result = evaluateStrategy([{ at: '2026-10-01', equity: 100 }, { at: '2026-10-02', equity: 160, externalFlow: 50 },
    { at: '2026-10-03', equity: 176 }], { asOf: AS_OF, minObservations: 3 });
  near(result.metrics.totalReturn, 0.21); near(result.metrics.netPnl, 26); near(result.metrics.externalFlowTotal, 50);
  near(result.metrics.maxDrawdown, 0); assert.equal(result.metrics.sharpe, null); assert.equal(result.status, 'ready');
});

test('Strategy: future equity is excluded; duplicate dates and bankrupt restarts are rejected', () => {
  const result = evaluateStrategy([{ at: '2026-10-01', equity: 100 }, { at: '2026-10-02', equity: 105 },
    { at: '2026-10-13', equity: 1_000_000 }], { asOf: AS_OF });
  near(result.metrics.totalReturn, 0.05); assert.equal(result.excluded.length, 1);
  assert.throws(() => evaluateStrategy([{ at: '2026-10-01', equity: 100 }, { at: '2026-10-01', equity: 105 }], { asOf: AS_OF }), errorCode('DUPLICATE_EQUITY_TIMESTAMP'));
  assert.throws(() => evaluateStrategy([{ at: '2026-10-01', equity: 100 }, { at: '2026-10-02', equity: 0 },
    { at: '2026-10-03', equity: 100, externalFlow: 100 }], { asOf: AS_OF }), errorCode('ZERO_EQUITY_RESTART'));
});

test('Feedback: proposals freeze a cutoff and never change the live version', () => {
  const calibration = calibrateForecasts([forecast('a'), forecast('b')], { asOf: AS_OF, minSamples: 2 });
  const before = structuredClone(calibration);
  const result = proposeFeedback({ calibration, currentVersion: 'v1', asOf: AS_OF });
  assert.equal(result.activationAllowed, false); assert.equal(result.liveWeightsChanged, false);
  assert.equal(result.mode, 'new_version_only'); assert.equal(result.candidateVersion, 'v1-candidate');
  assert.equal(result.requiresOutOfSampleValidation, true); assert.deepEqual(calibration, before);
});

test('Strategy: annualized metrics need enough samples and explicit observation frequency', () => {
  const points = [{ at: '2025-01-01', equity: 100 }, { at: '2025-07-01', equity: 110 }, { at: '2026-07-01', equity: 108 }];
  const insufficient = evaluateStrategy(points, { asOf: AS_OF, fixedFrequencySeries: true });
  assert.equal(insufficient.metrics.cagr, null); assert.equal(insufficient.metrics.sharpe, null);
  const frequencyUnknown = evaluateStrategy(points, { asOf: AS_OF, minObservations: 3 });
  assert.ok(Number.isFinite(frequencyUnknown.metrics.cagr)); assert.equal(frequencyUnknown.metrics.sharpe, null);
  const confirmed = evaluateStrategy(points, { asOf: AS_OF, minObservations: 3, fixedFrequencySeries: true, annualizationPeriods: 2 });
  assert.ok(Number.isFinite(confirmed.metrics.sharpe)); assert.ok(Number.isFinite(confirmed.metrics.annualizedVolatility));
  const short = evaluateStrategy([{ at: '2026-10-01', equity: 100 }, { at: '2026-10-02', equity: 102 }, { at: '2026-10-03', equity: 101 }],
    { asOf: AS_OF, minObservations: 3, dailyCloseSeries: true });
  assert.equal(short.metrics.cagr, null); assert.ok(Number.isFinite(short.metrics.sharpe));
});

test('Strategy: a claimed daily-close series rejects intraday duplication', () => {
  assert.throws(() => evaluateStrategy([{ at: '2026-10-01T10:00:00Z', equity: 100 }, { at: '2026-10-01T11:00:00Z', equity: 101 }],
    { asOf: AS_OF, dailyCloseSeries: true }), errorCode('NOT_DAILY_CLOSE_SERIES'));
});

test('Morning brief: sourced fresh data, stale/demo labels, and point-in-time catalyst filtering', () => {
  const result = buildMorningBrief({ asOf: AS_OF, sources: [source()],
    quotes: [
      { symbol: 'ABC', price: 100, currency: 'USD', changePct: 0.01, asOf: '2026-10-12T11:59:00Z', receivedAt: '2026-10-12T11:59:01Z', mode: 'live', session: 'regular', sourceId: 'source-1' },
      { symbol: 'OLD', price: 20, currency: 'USD', asOf: '2026-10-12T10:00:00Z', receivedAt: '2026-10-12T10:00:01Z', mode: 'cached', session: 'regular', sourceId: 'source-1' },
      { symbol: 'DEMO', price: 42, currency: 'USD', asOf: '2026-10-12T11:59:00Z', receivedAt: '2026-10-12T11:59:01Z', mode: 'demo', session: 'regular', sourceId: 'source-1' },
    ], catalysts: [
      { symbol: 'ABC', title: 'Earnings', scheduledAt: '2026-10-14T20:00:00Z', availableAt: '2026-10-12T10:00:00Z', sourceIds: ['source-1'] },
      { symbol: 'ABC', title: 'Unknown future announcement', scheduledAt: '2026-10-15T20:00:00Z', availableAt: '2026-10-13T10:00:00Z', sourceIds: ['source-1'] },
    ], theses: [thesis()] });
  assert.equal(result.quotes[0].quality, 'sourced'); assert.equal(result.quotes[1].quality, 'stale'); assert.equal(result.quotes[2].quality, 'demo');
  assert.equal(result.catalysts.length, 1); assert.equal(result.excluded[0].code, 'FUTURE_CATALYST_KNOWLEDGE');
  assert.equal(result.executionAuthorized, false); assert.match(result.markdown, /source-1/);
});

test('Morning brief: cannot fabricate valid quotes from absent sources or future observations', () => {
  const result = buildMorningBrief({ asOf: AS_OF, sources: [], quotes: [
    { symbol: 'ABC', price: 100, currency: 'USD', asOf: '2026-10-12T11:59:00Z', receivedAt: '2026-10-12T11:59:01Z', mode: 'live', session: 'regular', sourceId: 'missing' },
    { symbol: 'FUTURE', price: 1, currency: 'USD', asOf: '2026-10-13T00:00:00Z', receivedAt: '2026-10-13T00:00:01Z', mode: 'live', session: 'regular', sourceId: 'missing' },
  ] });
  assert.equal(result.quotes[0].quality, 'unverified'); assert.equal(result.quotes[0].executionEligible, false);
  assert.equal(result.quotes.length, 1); assert.equal(result.excluded[0].code, 'FUTURE_QUOTE');
});

test('Synthetic research fixture executes every advertised research workflow', async () => {
  const fixture = JSON.parse(await readFile(new URL('../fixtures/research-demo.json', import.meta.url), 'utf8'));
  assert.equal(fixture.synthetic, true);
  assert.ok(fixture.sources.every(item => item.synthetic && item.title.startsWith('SYNTHETIC:')));
  assert.equal(validateResearch({ ...fixture.research, sources: fixture.sources }, { asOf: fixture.anchorAsOf }).valid, true);
  assert.equal(calculateDCF(fixture.dcf).sensitivity.grid.flat().length, 25);
  assert.equal(compareCompanies(fixture.peers).peerCount, 3);
  assert.equal(analyzeEarnings(fixture.earnings).status, 'ready');
  const initialThesis = createThesis(fixture.thesis);
  const updatedThesis = updateThesis(initialThesis, fixture.thesisUpdate, { asOf: fixture.anchorAsOf });
  assert.equal(updatedThesis.status, 'challenged');
  const brief = buildMorningBrief({ asOf: fixture.anchorAsOf, sources: fixture.sources, quotes: fixture.quotes,
    catalysts: fixture.catalysts, theses: [updatedThesis] });
  assert.equal(brief.quotes[0].quality, 'demo');
  assert.equal(brief.executionAuthorized, false);
});
