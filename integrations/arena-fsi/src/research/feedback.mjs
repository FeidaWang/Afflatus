import { record, finite, nonempty, requireCondition, time, iso, copy, errorRecord } from './core.mjs';

function wilsonInterval(successes, count) {
  if (!count) return null;
  const z = 1.959963984540054;
  const p = successes / count;
  const denominator = 1 + z * z / count;
  const middle = (p + z * z / (2 * count)) / denominator;
  const half = z * Math.sqrt(p * (1 - p) / count + z * z / (4 * count * count)) / denominator;
  return [Math.max(0, middle - half), Math.min(1, middle + half)];
}

function summarizeCalibration(samples, { minSamples, bins, epsilon }) {
  const n = samples.length;
  const reliability = Array.from({ length: bins }, (_, index) => ({ lower: index / bins, upper: (index + 1) / bins,
    count: 0, sumProbability: 0, outcomes: 0 }));
  let brier = 0; let logLoss = 0; let correct = 0; let outcomes = 0; let sumProbability = 0;
  for (const sample of samples) {
    const p = sample.probability; const y = sample.outcome;
    brier += (p - y) ** 2;
    const clipped = Math.max(epsilon, Math.min(1 - epsilon, p));
    logLoss -= y * Math.log(clipped) + (1 - y) * Math.log(1 - clipped);
    correct += Number((p >= 0.5 ? 1 : 0) === y);
    outcomes += y; sumProbability += p;
    const bin = reliability[Math.min(bins - 1, Math.floor(p * bins))];
    bin.count += 1; bin.sumProbability += p; bin.outcomes += y;
  }
  const rows = reliability.map(bin => ({ lower: bin.lower, upper: bin.upper, count: bin.count,
    meanProbability: bin.count ? bin.sumProbability / bin.count : null,
    observedFrequency: bin.count ? bin.outcomes / bin.count : null,
    wilson95: wilsonInterval(bin.outcomes, bin.count),
    gap: bin.count ? (bin.sumProbability - bin.outcomes) / bin.count : null,
    // An experiment suggestion, not an automatically applied replacement probability.
    candidateLaplaceFrequency: bin.count ? (bin.outcomes + 1) / (bin.count + 2) : null }));
  const baseRate = n ? outcomes / n : null;
  const ece = n ? rows.reduce((sum, bin) => sum + bin.count * Math.abs(bin.gap ?? 0), 0) / n : null;
  return { status: n >= minSamples ? 'ready' : 'insufficient', count: n, minimumRequired: minSamples,
    metrics: n ? { brier: brier / n, logLoss: logLoss / n, expectedCalibrationError: ece,
      accuracyAtHalf: correct / n, baseRate, meanProbability: sumProbability / n,
      inSampleClimatologyBrier: baseRate * (1 - baseRate) } : null,
    reliability: rows, methodology: { logLossEpsilon: epsilon, accuracyThreshold: 0.5, pooledDifferentCohorts: false,
      intervalCaveat: 'Wilson intervals describe bin frequency; serial dependence reduces effective sample size.' } };
}

/** Only already-matured, resolved forecasts known by asOf enter a cohort's calibration. */
export function calibrateForecasts(samples, { asOf, minSamples = 30, bins = 10, epsilon = 1e-15 } = {}) {
  const cutoff = time(asOf, 'asOf');
  requireCondition(Array.isArray(samples), 'INVALID_SAMPLES', 'samples must be an array.');
  finite(minSamples, 'minSamples', { min: 1 }); finite(bins, 'bins', { min: 2, max: 50 });
  requireCondition(Number.isInteger(minSamples) && Number.isInteger(bins), 'INVALID_CALIBRATION_SETTINGS', 'minSamples and bins must be integers.');
  finite(epsilon, 'epsilon', { min: Number.EPSILON, max: 0.01 });
  const groups = new Map(); const excluded = []; const seen = new Set();
  samples.forEach((sample, index) => {
    try {
      record(sample, `samples[${index}]`);
      const id = nonempty(sample.id, 'sample.id', 128);
      requireCondition(!seen.has(id), 'DUPLICATE_FORECAST', `Duplicate sample ${id}.`); seen.add(id);
      const modelId = nonempty(sample.modelId, 'modelId', 128);
      const modelVersion = nonempty(sample.modelVersion, 'modelVersion', 128);
      const cohort = nonempty(sample.cohort, 'cohort', 256);
      const createdAt = time(sample.createdAt, 'createdAt');
      const featureSnapshotAt = time(sample.featureSnapshotAt, 'featureSnapshotAt');
      const horizonAt = time(sample.horizonAt, 'horizonAt');
      requireCondition(featureSnapshotAt <= createdAt, 'FUTURE_FEATURES', 'Feature snapshot is after the prediction.');
      if (sample.maxFeatureAvailableAt !== undefined) requireCondition(time(sample.maxFeatureAvailableAt, 'maxFeatureAvailableAt') <= featureSnapshotAt,
        'FUTURE_FEATURES', 'One or more features were unavailable at the feature snapshot.');
      requireCondition(horizonAt > createdAt, 'INVALID_FORECAST_HORIZON', 'horizonAt must be strictly after createdAt.');
      requireCondition(createdAt <= cutoff && horizonAt <= cutoff, 'IMMATURE_FORECAST', 'Forecast horizon has not elapsed by asOf.');
      requireCondition(sample.resolvedAt != null && sample.outcome != null, 'UNRESOLVED_FORECAST', 'Forecast outcome is not resolved.');
      const resolvedAt = time(sample.resolvedAt, 'resolvedAt');
      requireCondition(resolvedAt >= horizonAt && resolvedAt <= cutoff, 'OUTCOME_NOT_AVAILABLE', 'Outcome resolution must follow the horizon and precede asOf.');
      if (sample.outcomeAvailableAt !== undefined) requireCondition(time(sample.outcomeAvailableAt, 'outcomeAvailableAt') <= resolvedAt
        && time(sample.outcomeAvailableAt, 'outcomeAvailableAt') >= horizonAt, 'INVALID_OUTCOME_AVAILABILITY', 'Outcome availability must fall between horizon and resolution.');
      const probability = finite(sample.probability, 'probability', { min: 0, max: 1 });
      requireCondition(sample.outcome === 0 || sample.outcome === 1, 'INVALID_BINARY_OUTCOME', 'outcome must be 0 or 1.');
      const key = JSON.stringify([modelId, modelVersion, cohort]);
      if (!groups.has(key)) groups.set(key, { modelId, modelVersion, cohort, samples: [] });
      groups.get(key).samples.push({ probability, outcome: sample.outcome, id });
    } catch (error) { excluded.push({ id: sample?.id ?? null, ...errorRecord(error, `samples[${index}]`) }); }
  });
  const cohorts = [...groups.values()].map(group => ({ modelId: group.modelId, modelVersion: group.modelVersion, cohort: group.cohort,
    ...summarizeCalibration(group.samples, { minSamples, bins, epsilon }),
    proposal: { mode: 'new_version_only', candidateVersion: `${group.modelVersion}-calibration-candidate`,
      action: group.samples.length >= minSamples ? 'test_calibration_on_future_holdout' : 'collect_more_resolved_samples',
      frozenTrainingCutoff: new Date(cutoff).toISOString(), requiresOutOfSampleValidation: true, liveWeightsChanged: false } }));
  const single = cohorts.length === 1 ? cohorts[0] : null;
  return { asOf: new Date(cutoff).toISOString(), status: cohorts.length > 1 ? 'mixed_cohorts' : single?.status ?? 'insufficient',
    count: cohorts.reduce((sum, group) => sum + group.count, 0), excluded, cohorts,
    metrics: single?.metrics ?? null, reliability: single?.reliability ?? [], proposal: single?.proposal ?? null,
    minimumRequired: minSamples, liveWeightsChanged: false };
}

function sampleStd(values) {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1));
}

/** Time-weighted portfolio evaluation with end-of-period external cash flows. */
export function evaluateStrategy(points, { asOf, minObservations = 20, annualizationPeriods = 252, riskFreeRate = 0,
  dailyCloseSeries = false, fixedFrequencySeries = false } = {}) {
  const cutoff = time(asOf, 'asOf');
  requireCondition(Array.isArray(points), 'INVALID_EQUITY_SERIES', 'points must be an array.');
  finite(minObservations, 'minObservations', { min: 2 }); finite(annualizationPeriods, 'annualizationPeriods', { min: 1 });
  requireCondition(Number.isInteger(minObservations), 'INVALID_MIN_OBSERVATIONS', 'minObservations must be an integer.');
  finite(riskFreeRate, 'riskFreeRate', { min: -1, exclusiveMin: true });
  requireCondition(typeof dailyCloseSeries === 'boolean' && typeof fixedFrequencySeries === 'boolean',
    'INVALID_OBSERVATION_FREQUENCY', 'Frequency confirmations must be booleans.');
  const excluded = []; const accepted = [];
  points.forEach((point, index) => {
    record(point, `points[${index}]`);
    const at = time(point.at, 'point.at');
    if (at > cutoff || (point.availableAt !== undefined && time(point.availableAt, 'availableAt') > cutoff)
      || (point.resolvedAt !== undefined && time(point.resolvedAt, 'resolvedAt') > cutoff)) {
      excluded.push({ index, code: 'FUTURE_EQUITY_OBSERVATION' }); return;
    }
    if (point.availableAt !== undefined) requireCondition(time(point.availableAt, 'availableAt') >= at, 'INVALID_EQUITY_AVAILABILITY', 'availableAt cannot precede the equity observation.');
    const equity = finite(point.equity, 'equity', { min: 0 });
    const externalFlow = finite(point.externalFlow ?? 0, 'externalFlow');
    const benchmarkEquity = point.benchmarkEquity == null ? null : finite(point.benchmarkEquity, 'benchmarkEquity', { min: 0, exclusiveMin: true });
    accepted.push({ at, equity, externalFlow, benchmarkEquity });
  });
  accepted.sort((a, b) => a.at - b.at);
  for (let i = 1; i < accepted.length; i += 1) requireCondition(accepted[i].at !== accepted[i - 1].at, 'DUPLICATE_EQUITY_TIMESTAMP', 'Two equity values cannot share a timestamp.');
  if (dailyCloseSeries) {
    const days = accepted.map(point => new Date(point.at).toISOString().slice(0, 10));
    requireCondition(new Set(days).size === days.length, 'NOT_DAILY_CLOSE_SERIES', 'dailyCloseSeries cannot contain multiple observations on one UTC date.');
  }
  if (accepted.length < 2) return { status: 'insufficient', asOf: iso(asOf), count: accepted.length, minimumRequired: minObservations, excluded, metrics: null, periods: [] };
  requireCondition(accepted[0].equity > 0 && accepted[0].externalFlow === 0, 'INVALID_OPENING_EQUITY', 'Opening equity must be positive; opening externalFlow must be zero.');
  const hasBenchmark = accepted.every(point => point.benchmarkEquity !== null);
  const warnings = [];
  if (!hasBenchmark && accepted.some(point => point.benchmarkEquity !== null)) warnings.push('INCOMPLETE_BENCHMARK');
  const returns = []; const periods = []; let wealth = 1; let peak = 1; let maxDrawdown = 0; let flowTotal = 0;
  for (let i = 1; i < accepted.length; i += 1) {
    const current = accepted[i]; const previous = accepted[i - 1];
    const flowAdjustedEquity = current.equity - current.externalFlow;
    requireCondition(flowAdjustedEquity >= 0, 'INVALID_EXTERNAL_FLOW', 'A period-end flow cannot imply negative pre-flow equity.');
    requireCondition(previous.equity > 0 || current.equity === 0, 'ZERO_EQUITY_RESTART', 'Start a new series after a bankrupt/zero-equity account restarts.');
    const periodReturn = previous.equity === 0 ? 0 : flowAdjustedEquity / previous.equity - 1;
    returns.push(periodReturn); wealth *= 1 + periodReturn; peak = Math.max(peak, wealth);
    const drawdown = wealth / peak - 1; maxDrawdown = Math.min(maxDrawdown, drawdown); flowTotal += current.externalFlow;
    periods.push({ at: new Date(current.at).toISOString(), return: periodReturn, wealthIndex: wealth, drawdown });
  }
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const std = sampleStd(returns);
  const riskFreePerPeriod = (1 + riskFreeRate) ** (1 / annualizationPeriods) - 1;
  const downside = Math.sqrt(returns.reduce((sum, value) => sum + Math.min(value - riskFreePerPeriod, 0) ** 2, 0) / returns.length);
  const elapsedDays = (accepted.at(-1).at - accepted[0].at) / 86_400_000;
  const totalReturn = wealth - 1;
  const enoughObservations = accepted.length >= minObservations;
  const frequencyConfirmed = dailyCloseSeries || fixedFrequencySeries;
  const annualizationEligible = enoughObservations && frequencyConfirmed;
  const cagrEligible = enoughObservations && elapsedDays >= 365;
  const cagrRaw = cagrEligible ? (wealth > 0 ? wealth ** (365.25 / elapsedDays) - 1 : -1) : null;
  const cagr = cagrRaw !== null && Number.isFinite(cagrRaw) ? cagrRaw : null;
  if (!enoughObservations) warnings.push('INSUFFICIENT_OBSERVATIONS_FOR_ANNUALIZED_METRICS');
  if (!frequencyConfirmed) warnings.push('ANNUALIZATION_FREQUENCY_UNCONFIRMED');
  if (elapsedDays < 365) warnings.push('CAGR_REQUIRES_AT_LEAST_365_DAYS');
  const negligibleVariance = std !== null && std <= 1e-12;
  if (negligibleVariance) warnings.push('ZERO_RETURN_VARIANCE');
  const benchmarkReturn = hasBenchmark ? accepted.at(-1).benchmarkEquity / accepted[0].benchmarkEquity - 1 : null;
  return { status: accepted.length >= minObservations ? 'ready' : 'insufficient', asOf: iso(asOf), count: accepted.length,
    minimumRequired: minObservations, excluded, periods, warnings,
    metrics: { totalReturn, netPnl: accepted.at(-1).equity - accepted[0].equity - flowTotal,
      externalFlowTotal: flowTotal, maxDrawdown, annualizedVolatility: !annualizationEligible || std === null ? null : std * Math.sqrt(annualizationPeriods),
      sharpe: !annualizationEligible || std === null || negligibleVariance ? null : (mean - riskFreePerPeriod) / std * Math.sqrt(annualizationPeriods),
      sortino: !annualizationEligible || downside <= 1e-12 ? null : (mean - riskFreePerPeriod) / downside * Math.sqrt(annualizationPeriods),
      cagr, elapsedDays, benchmarkReturn, excessReturn: benchmarkReturn === null ? null : totalReturn - benchmarkReturn },
    methodology: { returns: 'time-weighted; external cash flows occur at period end', drawdown: 'flow-adjusted wealth index',
      variance: 'sample variance (n-1)', annualizationPeriods, riskFreeRate, dailyCloseSeries, fixedFrequencySeries,
      annualizationEligible, cagrEligible,
      costPolicy: 'Equity inputs must already include all fees, spread, slippage, dividends, and other posted events.',
      frequencyCaveat: 'Sharpe/volatility assume equally spaced return observations at the supplied annualization frequency.' } };
}

/** Produce an immutable experiment proposal. This function has no live-model write capability. */
export function proposeFeedback({ calibration, performance, currentVersion, asOf }) {
  nonempty(currentVersion, 'currentVersion', 128); const cutoff = iso(asOf, 'asOf');
  if (calibration?.asOf) requireCondition(time(calibration.asOf) <= time(cutoff), 'FUTURE_CALIBRATION', 'Calibration extends beyond the proposal cutoff.');
  if (performance?.asOf) requireCondition(time(performance.asOf) <= time(cutoff), 'FUTURE_PERFORMANCE', 'Performance extends beyond the proposal cutoff.');
  const experiments = [];
  if (calibration?.status === 'ready') experiments.push({ kind: 'probability-calibration',
    hypothesis: 'A separately trained probability calibration may improve out-of-sample Brier/log loss.',
    requiredValidation: 'Use only forecasts created after the frozen training cutoff; compare the same cohort and costs.' });
  if (performance?.metrics?.maxDrawdown < -0.2) experiments.push({ kind: 'risk-budget-review',
    hypothesis: 'A lower exposure cap may reduce drawdown; test the return/cost tradeoff on unseen periods.',
    requiredValidation: 'Replay the frozen execution/risk engine with all costs and identical quote snapshots.' });
  if (!experiments.length) experiments.push({ kind: 'collect-evidence', hypothesis: 'There is insufficient comparable evidence for a parameter change.', requiredValidation: 'Accumulate matured forecasts and cost-inclusive equity observations.' });
  return { mode: 'new_version_only', currentVersion, candidateVersion: `${currentVersion}-candidate`,
    frozenTrainingCutoff: cutoff, experiments, liveWeightsChanged: false, activationAllowed: false,
    requiresOutOfSampleValidation: true, inputSummary: { calibrationStatus: calibration?.status ?? 'missing', performanceStatus: performance?.status ?? 'missing' } };
}
