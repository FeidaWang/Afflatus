const DEFAULT_Z = 1.96;

export function wilsonInterval(successes, total, z = DEFAULT_Z) {
  if (!total) return [0, 0];
  const probability = successes / total;
  const denominator = 1 + (z * z) / total;
  const center = probability + (z * z) / (2 * total);
  const margin = z * Math.sqrt(
    (probability * (1 - probability)) / total + (z * z) / (4 * total * total),
  );
  return [
    Math.max(0, (center - margin) / denominator),
    Math.min(1, (center + margin) / denominator),
  ];
}

function binomialPmf(total, successes) {
  let logCoefficient = 0;
  for (let index = 0; index < successes; index++) {
    logCoefficient += Math.log((total - index) / (index + 1));
  }
  return Math.exp(logCoefficient + total * Math.log(0.5));
}

export function exactBinomialTwoSided(successes, total) {
  if (!total) return 1;
  const observed = binomialPmf(total, successes);
  let probability = 0;
  for (let count = 0; count <= total; count++) {
    const candidate = binomialPmf(total, count);
    if (candidate <= observed + 1e-12) probability += candidate;
  }
  return Math.min(1, probability);
}

export function brierScore(records) {
  if (!records.length) return null;
  return records.reduce((sum, record) => {
    const outcome = record.ok ? 1 : 0;
    return sum + (record.conf - outcome) ** 2;
  }, 0) / records.length;
}

export function summarizeRecords(records) {
  const total = records.length;
  const successes = records.filter((record) => record.ok).length;
  const exact = records.filter((record) => record.exact).length;
  const brier = brierScore(records);
  return {
    total,
    successes,
    exact,
    hitRate: total ? successes / total : 0,
    interval: wilsonInterval(successes, total),
    pValue: exactBinomialTwoSided(successes, total),
    brier,
    brierSkill: brier == null ? null : 1 - brier / 0.25,
  };
}

export function thresholdSummary(records, threshold) {
  return summarizeRecords(records.filter((record) => record.conf >= threshold));
}

export function cumulativeSeries(records) {
  let successes = 0;
  return records.map((record, index) => {
    if (record.ok) successes++;
    const total = index + 1;
    return {
      index,
      total,
      successes,
      hitRate: successes / total,
      interval: wilsonInterval(successes, total),
    };
  });
}

export function calibrationBins(records, bins = [
  { low: 0.5, high: 0.65 },
  { low: 0.65, high: 0.75 },
  { low: 0.75, high: 1.01 },
]) {
  return bins.flatMap((bin) => {
    const entries = records.filter((record) => record.conf >= bin.low && record.conf < bin.high);
    if (!entries.length) return [];
    const successes = entries.filter((record) => record.ok).length;
    return [{
      ...bin,
      total: entries.length,
      successes,
      averageConfidence: entries.reduce((sum, record) => sum + record.conf, 0) / entries.length,
      hitRate: successes / entries.length,
      interval: wilsonInterval(successes, entries.length),
    }];
  });
}

export function formatPercent(value, decimals = 0) {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function seedFrom(value) {
  if (Number.isInteger(value)) return value >>> 0;
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6D2B79F5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function countQuantile(counts, iterations, quantile) {
  const target = Math.min(iterations - 1, Math.floor(iterations * quantile));
  let seen = 0;
  for (let index = 0; index < counts.length; index++) {
    seen += counts[index];
    if (seen > target) return index;
  }
  return counts.length - 1;
}

export function bootstrapDistribution({
  outcomes,
  iterations = 2000,
  seed = 0,
}) {
  if (!Array.isArray(outcomes) || !outcomes.length) {
    throw new Error('Bootstrap requires at least one outcome');
  }
  const total = outcomes.length;
  const iterationCount = Math.max(1, Math.floor(iterations));
  const normalizedSeed = seedFrom(seed);
  const random = mulberry32(normalizedSeed);
  const counts = new Array(total + 1).fill(0);

  for (let iteration = 0; iteration < iterationCount; iteration++) {
    let successes = 0;
    for (let sample = 0; sample < total; sample++) {
      if (outcomes[Math.floor(random() * total)]) successes++;
    }
    counts[successes]++;
  }

  return {
    counts,
    total,
    iterations: iterationCount,
    seed: normalizedSeed,
    lower: countQuantile(counts, iterationCount, 0.025) / total,
    upper: countQuantile(counts, iterationCount, 0.975) / total,
  };
}
