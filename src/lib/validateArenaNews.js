import { isSafePlainText, safeExternalUrl } from './contentSafety.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TICKER_RE = /^[A-Z]{1,5}(?:[.-][A-Z]{1,2})?$/;

function plain(value, tag, errors, options) {
  if (!isSafePlainText(value, options)) errors.push(`${tag}: must be bounded plain text without markup`);
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
  return { ok: errors.length === 0, errors };
}
