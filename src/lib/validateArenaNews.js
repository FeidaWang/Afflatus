import { isSafePlainText, safeExternalUrl } from './contentSafety.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TICKER_RE = /^[A-Z]{1,5}(?:[.-][A-Z]{1,2})?$/;
export const ARENA_NEWS_FRESHNESS_POLICY = 'session-news-v1';
export const ARENA_NEWS_FRESHNESS_START_DATE = '2026-08-14';
export const ARENA_NEWS_MAX_AGE_HOURS = 72;

function plain(value, tag, errors, options) {
  if (!isSafePlainText(value, options)) errors.push(`${tag}: must be bounded plain text without markup`);
}

export function validateArenaNewsPublicationFreshness(data) {
  const errors = [];
  if (!DATE_RE.test(String(data?.date || '')) || data.date < ARENA_NEWS_FRESHNESS_START_DATE) {
    return { ok: true, errors };
  }
  if (data.freshnessPolicy !== ARENA_NEWS_FRESHNESS_POLICY) {
    errors.push(`freshnessPolicy: must be ${ARENA_NEWS_FRESHNESS_POLICY} from ${ARENA_NEWS_FRESHNESS_START_DATE}`);
  }
  if (!['complete', 'limited'].includes(data.coverageStatus)) {
    errors.push('coverageStatus: must be complete or limited');
  }
  const cutoffMs = Date.parse(data.evidenceCutoffAt);
  if (!Number.isFinite(cutoffMs)) {
    errors.push('evidenceCutoffAt: must be an ISO timestamp for freshness checks');
  }
  for (const [index, item] of (Array.isArray(data.items) ? data.items : []).entries()) {
    const publishedMs = Date.parse(item?.publishedAt);
    const tag = `items[${index}].publishedAt`;
    if (!Number.isFinite(publishedMs)) {
      errors.push(`${tag}: must preserve the source's official publication timestamp`);
      continue;
    }
    if (Number.isFinite(cutoffMs) && publishedMs > cutoffMs) {
      errors.push(`${tag}: cannot be after evidenceCutoffAt`);
    }
    if (Number.isFinite(cutoffMs) && cutoffMs - publishedMs > ARENA_NEWS_MAX_AGE_HOURS * 60 * 60 * 1000) {
      errors.push(`${tag}: source is older than the ${ARENA_NEWS_MAX_AGE_HOURS}-hour session-news limit`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export function validateArenaNews(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, errors: ['top-level: must be an object'] };
  }
  if (!DATE_RE.test(String(data.date || ''))) errors.push('date: must be YYYY-MM-DD');
  if (!Number.isFinite(Date.parse(data.generatedAt))) errors.push('generatedAt: must be an ISO timestamp');
  if (!Array.isArray(data.items)) {
    errors.push('items: must be an array');
  } else {
    data.items.forEach((item, index) => {
      const tag = `items[${index}]`;
      if (!item || typeof item !== 'object') { errors.push(`${tag}: must be an object`); return; }
      plain(item.category, `${tag}.category`, errors, { maxLength: 48 });
      plain(item.title_en, `${tag}.title_en`, errors, { maxLength: 240 });
      plain(item.title_zh, `${tag}.title_zh`, errors, { maxLength: 240 });
      plain(item.summary_en, `${tag}.summary_en`, errors, { maxLength: 1_500 });
      plain(item.summary_zh, `${tag}.summary_zh`, errors, { maxLength: 1_500 });
      plain(item.source, `${tag}.source`, errors, { maxLength: 120 });
      if (!safeExternalUrl(item.url)) errors.push(`${tag}.url: must be a valid HTTPS URL`);
      if (!Array.isArray(item.tickers) || !item.tickers.every((ticker) => TICKER_RE.test(ticker))) {
        errors.push(`${tag}.tickers: must contain valid uppercase ticker symbols`);
      }
    });
  }
  if (!data.prices || typeof data.prices !== 'object' || Array.isArray(data.prices)) {
    errors.push('prices: must be an object');
  }
  for (const field of ['disclaimer_en', 'disclaimer_zh', 'predictionNote_en', 'predictionNote_zh']) {
    if (data[field] != null) plain(data[field], field, errors, { maxLength: 2_000, allowEmpty: true });
  }
  errors.push(...validateArenaNewsPublicationFreshness(data).errors);
  return { ok: errors.length === 0, errors };
}
