export const QUALITY_TIERS = Object.freeze(['low', 'balanced', 'high']);

const PIXEL_BUDGETS = Object.freeze({
  mobile: Object.freeze({
    low: 1_000_000,
    balanced: 1_800_000,
    high: 2_200_000,
  }),
  desktop: Object.freeze({
    low: 1_400_000,
    balanced: 2_800_000,
    high: 3_600_000,
  }),
});

const COST_SCALE = Object.freeze({
  low: 1,
  medium: 0.9,
  high: 0.75,
});

export function normalizeQualityTier(value, fallback = 'balanced') {
  return QUALITY_TIERS.includes(value) ? value : fallback;
}

export function qualityTierIndex(value) {
  return QUALITY_TIERS.indexOf(normalizeQualityTier(value));
}

export function stepQualityTier(value, direction, ceiling = 'high') {
  const index = qualityTierIndex(value);
  const ceilingIndex = qualityTierIndex(ceiling);
  const next = Math.min(ceilingIndex, Math.max(0, index + Math.sign(direction)));
  return QUALITY_TIERS[next];
}

export function detectInitialQuality({
  viewportWidth = 1440,
  deviceMemory,
  hardwareConcurrency,
  saveData = false,
  reducedMotion = false,
} = {}) {
  if (saveData || reducedMotion) return 'low';
  if (
    (Number.isFinite(deviceMemory) && deviceMemory <= 4)
    || (Number.isFinite(hardwareConcurrency) && hardwareConcurrency <= 4)
  ) return 'low';
  return viewportWidth < 768 ? 'balanced' : 'high';
}

export function pixelBudgetFor({
  qualityTier = 'balanced',
  mobile = false,
  cost = 'medium',
} = {}) {
  const tier = normalizeQualityTier(qualityTier);
  const deviceClass = mobile ? 'mobile' : 'desktop';
  const scale = COST_SCALE[cost] || COST_SCALE.medium;
  return Math.round(PIXEL_BUDGETS[deviceClass][tier] * scale);
}

export function computeBudgetDpr({
  cssWidth,
  cssHeight,
  deviceDpr = 1,
  pixelBudget,
  minDpr = 0.6,
  maxDpr = Number.POSITIVE_INFINITY,
} = {}) {
  const width = Math.max(1, Number(cssWidth) || 1);
  const height = Math.max(1, Number(cssHeight) || 1);
  const nativeDpr = Math.max(0.1, Number(deviceDpr) || 1);
  const budget = Math.max(1, Number(pixelBudget) || 1);
  const floor = Math.max(0.1, Number(minDpr) || 0.6);
  const ceiling = Math.max(floor, Number(maxDpr) || nativeDpr);
  const budgetDpr = Math.sqrt(budget / (width * height));
  return Math.min(nativeDpr, ceiling, Math.max(floor, budgetDpr));
}

export function percentile(values, ratio) {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!clean.length) return 0;
  const index = Math.min(clean.length - 1, Math.max(0, Math.ceil(ratio * clean.length) - 1));
  return clean[index];
}

export function estimateRefreshRate(intervals) {
  const usable = intervals.filter((value) => Number.isFinite(value) && value >= 4 && value <= 50);
  if (!usable.length) return 60;
  const median = percentile(usable, 0.5);
  const measured = 1000 / median;
  const commonRates = [30, 60, 90, 120, 144, 165];
  return commonRates.reduce(
    (best, rate) => (Math.abs(rate - measured) < Math.abs(best - measured) ? rate : best),
    commonRates[0],
  );
}

export function frameBudgetMs(refreshHz = 60, targetFps = 60) {
  const refresh = Math.max(1, Number(refreshHz) || 60);
  const target = Math.max(1, Number(targetFps) || 60);
  return 1000 / Math.min(refresh, target);
}

export function evaluateFrameWindow({
  samples = [],
  refreshHz = 60,
  targetFps = 60,
} = {}) {
  const budgetMs = frameBudgetMs(refreshHz, targetFps);
  const p95Ms = percentile(samples, 0.95);
  let state = 'stable';
  if (p95Ms > budgetMs * 1.25) state = 'over-budget';
  else if (p95Ms > 0 && p95Ms < budgetMs * 0.72) state = 'headroom';
  return { budgetMs, p95Ms, state };
}
