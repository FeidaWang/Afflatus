import {
  ARENA_NEWS_FRESHNESS_POLICY,
  ARENA_NEWS_FRESHNESS_START_DATE,
  validateArenaNewsPublicationFreshness,
} from './validateArenaNews.js';

const MODELS = ['S', 'P', 'T'];
const RESEARCH_CATEGORIES = new Set([
  'macro-policy', 'frontier-models', 'compute', 'memory',
  'optical-networking', 'power-cooling', 'cloud-demand', 'company-earnings',
]);
const nyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
});

function newYorkDate(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(nyFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * Cross-file integrity checks for the atomic Arena pre-market group.
 * A self-consistent hash proves that a string was not edited after sealing;
 * this function additionally proves that every cited source belongs to the
 * news snapshot published in the same transaction.
 */
export function validateArenaPremarketGroup(news, picks, runlog, baselineLedger = null) {
  const errors = [];
  const missedDecision = picks?.decisionStatus === 'missed' && picks?.executable === false;
  if (news?.date !== picks?.date) {
    errors.push(`arena premarket group has mismatched dates: ${news?.date} / ${picks?.date}`);
    return { ok: false, errors };
  }
  const newsGeneratedMs = Date.parse(news?.generatedAt);
  const picksGeneratedMs = Date.parse(picks?.generatedAt);
  const cutoffMs = Date.parse(news?.evidenceCutoffAt);
  if (!Number.isFinite(newsGeneratedMs) || newYorkDate(news.generatedAt) !== news.date) {
    errors.push('arena-news.generatedAt must fall on the grouped New York session date');
  }
  if (!Number.isFinite(picksGeneratedMs) || newYorkDate(picks.generatedAt) !== picks.date) {
    errors.push('arena-picks.generatedAt must fall on the grouped New York session date');
  }
  if (Number.isFinite(newsGeneratedMs) && Number.isFinite(picksGeneratedMs) && newsGeneratedMs > picksGeneratedMs) {
    errors.push('arena-news.generatedAt cannot be after arena-picks.generatedAt');
  }
  if (!Number.isFinite(cutoffMs) || newYorkDate(news.evidenceCutoffAt) !== news.date) {
    errors.push('arena-news.evidenceCutoffAt must preserve a same-session source cutoff');
  } else if (Number.isFinite(newsGeneratedMs) && cutoffMs > newsGeneratedMs) {
    errors.push('arena-news.evidenceCutoffAt cannot be after research generation');
  }

  const items = Array.isArray(news?.items) ? news.items : [];
  const uniqueUrls = new Set(items.map((item) => item?.url).filter((url) => typeof url === 'string'));
  const uniqueCategories = new Set(items
    .map((item) => String(item?.category || '').trim().toLowerCase())
    .filter(Boolean));
  errors.push(...validateArenaNewsPublicationFreshness(news).errors);
  const freshnessPolicyRequired = news?.date >= ARENA_NEWS_FRESHNESS_START_DATE;
  const usesFreshnessPolicy = news?.freshnessPolicy === ARENA_NEWS_FRESHNESS_POLICY;
  const limitedCoverage = usesFreshnessPolicy && news?.coverageStatus === 'limited';
  if (!limitedCoverage && uniqueUrls.size < 4) errors.push('arena-news snapshot must contain at least four distinct source URLs');
  if (!limitedCoverage && uniqueCategories.size < 4) errors.push('arena-news snapshot must span at least four distinct research categories');
  if (freshnessPolicyRequired && limitedCoverage) {
    const proposals = MODELS.flatMap((model) => picks?.models?.[model] || []);
    if (proposals.length > 0) {
      errors.push('limited fresh-news coverage must publish zero trade proposals; stale context cannot authorize a trade');
    }
  }
  for (const category of uniqueCategories) {
    if (!RESEARCH_CATEGORIES.has(category)) {
      errors.push(`arena-news category ${JSON.stringify(category)} is outside the canonical research taxonomy`);
    }
  }
  const allowedRefs = new Set();
  items.forEach((item, index) => {
    if (typeof item?.url === 'string') allowedRefs.add(item.url);
    allowedRefs.add(`arena-news:${news.date}:item-${index}`);
  });

  for (const model of MODELS) {
    for (const [index, pick] of (picks?.models?.[model] || []).entries()) {
      for (const ref of pick?.sourceRefs || []) {
        if (!allowedRefs.has(ref)) {
          errors.push(`models.${model}[${index}].sourceRefs: ${JSON.stringify(ref)} is not present in the same arena-news snapshot`);
        }
      }
    }
  }
  const picksRun = (runlog?.runs || []).find((run) => (
    run.date === picks?.date && run.window === 'picks-publish' && run.model === 'gatherer'
  ));
  const gatherRun = (runlog?.runs || []).find((run) => (
    run.date === picks?.date && run.window === 'pre-market-gather' && run.model === 'gatherer'
  ));
  if (gatherRun?.status !== 'done') {
    errors.push(`pre-market-gather run must be done for archived research on ${picks?.date}`);
  }
  const expectedPicksStatus = missedDecision ? 'missed' : 'done';
  if (picksRun?.status !== expectedPicksStatus) {
    errors.push(`picks-publish run must be ${expectedPicksStatus} for ${picks?.date}`);
  }
  const allowlist = new Set(Array.isArray(picks?.quoteAllowlist) ? picks.quoteAllowlist : []);
  for (const symbol of ['SPY', 'QQQ', 'SMH']) {
    if (!allowlist.has(symbol)) errors.push(`quoteAllowlist: missing fixed execution/benchmark symbol ${symbol}`);
  }
  for (const model of MODELS) {
    for (const pick of picks?.models?.[model] || []) {
      if (pick?.sym && !allowlist.has(pick.sym)) errors.push(`quoteAllowlist: missing published proposal ${pick.sym}`);
    }
  }
  const heldSymbols = Object.values(baselineLedger?.models || {})
    .flatMap((book) => book?.positions || [])
    .map((position) => position?.sym)
    .filter(Boolean);
  for (const symbol of heldSymbols) {
    if (!allowlist.has(symbol)) errors.push(`quoteAllowlist: missing held position ${symbol}`);
  }
  return { ok: errors.length === 0, errors };
}
