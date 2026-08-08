import { isSafePlainText, safeExternalUrl } from './contentSafety.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TICKER_RE = /^[A-Z]{1,5}(?:[.-][A-Z]{1,2})?$/;
const DAY_MS = 86_400_000;

function plain(value, tag, errors, options) {
  if (!isSafePlainText(value, options)) errors.push(`${tag}: must be bounded plain text without markup`);
}

function dateOnlyMs(value) {
  return DATE_RE.test(String(value || '')) ? Date.parse(`${value}T00:00:00Z`) : NaN;
}

function sourceHostname(value) {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
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
    if (data.items.length < 4) errors.push('items: every session briefing requires at least four sourced research items');
    data.items.forEach((item, index) => {
      const tag = `items[${index}]`;
      if (!item || typeof item !== 'object') { errors.push(`${tag}: must be an object`); return; }
      plain(item.category, `${tag}.category`, errors, { maxLength: 48 });
      plain(item.category_zh, `${tag}.category_zh`, errors, { maxLength: 48 });
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
    const categories = new Set(data.items.map((item) => String(item?.category || '').trim().toLowerCase()).filter(Boolean));
    const sources = new Set(data.items.map((item) => safeExternalUrl(item?.url)).filter(Boolean));
    if (categories.size < 3) errors.push('items: research must cover at least three distinct industry or macro lanes');
    if (sources.size < 4) errors.push('items: research must preserve at least four distinct source URLs');
  }
  if (!data.prices || typeof data.prices !== 'object' || Array.isArray(data.prices)) {
    errors.push('prices: must be an object');
  }
  for (const field of ['disclaimer_en', 'disclaimer_zh', 'predictionNote_en', 'predictionNote_zh']) {
    if (data[field] != null) plain(data[field], field, errors, { maxLength: 2_000, allowEmpty: true });
  }

  const coverage = data.researchCoverage;
  if (!coverage || typeof coverage !== 'object' || Array.isArray(coverage)) {
    errors.push('researchCoverage: daily research coverage is required');
  } else {
    if (!Number.isFinite(Date.parse(coverage.cutoff))) errors.push('researchCoverage.cutoff: must be an ISO timestamp');
    if (!Array.isArray(coverage.lanes) || coverage.lanes.length < 4) {
      errors.push('researchCoverage.lanes: at least four research lanes are required');
    } else {
      coverage.lanes.forEach((lane, index) => plain(lane, `researchCoverage.lanes[${index}]`, errors, { maxLength: 80 }));
    }
    plain(coverage.method_en, 'researchCoverage.method_en', errors, { maxLength: 1_000 });
    plain(coverage.method_zh, 'researchCoverage.method_zh', errors, { maxLength: 1_000 });
  }

  const watch = data.earningsWatch;
  if (!watch || typeof watch !== 'object' || Array.isArray(watch)) {
    errors.push('earningsWatch: a verified forward earnings watch is required');
  } else {
    if (!DATE_RE.test(String(watch.asOf || ''))) errors.push('earningsWatch.asOf: must be YYYY-MM-DD');
    const snapshotMs = dateOnlyMs(data.date);
    const asOfMs = dateOnlyMs(watch.asOf);
    if (Number.isFinite(snapshotMs) && Number.isFinite(asOfMs)) {
      if (asOfMs < snapshotMs) errors.push('earningsWatch.asOf: cannot predate the briefing snapshot');
      if (asOfMs > snapshotMs + (7 * DAY_MS)) errors.push('earningsWatch.asOf: must remain within seven days of the briefing snapshot');
    }
    plain(watch.methodology_en, 'earningsWatch.methodology_en', errors, { maxLength: 2_000 });
    plain(watch.methodology_zh, 'earningsWatch.methodology_zh', errors, { maxLength: 2_000 });
    const watchSourceUrls = new Set();
    if (!Array.isArray(watch.events) || watch.events.length < 1 || watch.events.length > 8) {
      errors.push('earningsWatch.events: must contain 1-8 verified events');
    } else {
      watch.events.forEach((event, index) => {
        const tag = `earningsWatch.events[${index}]`;
        if (!event || typeof event !== 'object' || Array.isArray(event)) { errors.push(`${tag}: must be an object`); return; }
        if (!TICKER_RE.test(String(event.sym || ''))) errors.push(`${tag}.sym: must be a valid ticker`);
        if (!['scheduled', 'released'].includes(event.status)) errors.push(`${tag}.status: must be scheduled or released`);
        for (const field of ['company_en', 'company_zh', 'period_en', 'period_zh', 'timing_en', 'timing_zh', 'formula_en', 'formula_zh', 'thesis_en', 'thesis_zh', 'risk_en', 'risk_zh']) {
          plain(event[field], `${tag}.${field}`, errors, { maxLength: field.includes('thesis') || field.includes('risk') || field.includes('formula') ? 1_000 : 180 });
        }
        const reportMs = Date.parse(event.reportAt);
        if (!Number.isFinite(reportMs)) errors.push(`${tag}.reportAt: must be an ISO timestamp`);
        else if (Number.isFinite(asOfMs)) {
          if (event.status === 'scheduled' && reportMs < asOfMs) errors.push(`${tag}.reportAt: a scheduled event cannot predate earningsWatch.asOf`);
          if (event.status === 'released' && reportMs > asOfMs + DAY_MS) errors.push(`${tag}.reportAt: a released event cannot be later than earningsWatch.asOf`);
          if (reportMs > asOfMs + (370 * DAY_MS)) errors.push(`${tag}.reportAt: exceeds the reasonable forward calendar horizon`);
        }
        for (const [name, metric] of [['revenue', event.revenue], ['adjustedEbitda', event.adjustedEbitda]]) {
          const metricTag = `${tag}.${name}`;
          if (!metric || typeof metric !== 'object' || Array.isArray(metric)) { errors.push(`${metricTag}: must be an object`); continue; }
          if (!Number.isFinite(Number(metric.baseline)) || Number(metric.baseline) <= 0) errors.push(`${metricTag}.baseline: must be positive`);
          if (!Number.isFinite(Number(metric.estimate)) || Number(metric.estimate) <= 0) errors.push(`${metricTag}.estimate: must be positive`);
          plain(metric.unit, `${metricTag}.unit`, errors, { maxLength: 24 });
          for (const field of ['baseline_en', 'baseline_zh', 'estimate_en', 'estimate_zh']) {
            plain(metric[field], `${metricTag}.${field}`, errors, { maxLength: 120 });
          }
        }
        if (!Array.isArray(event.sources) || event.sources.length < 2) {
          errors.push(`${tag}.sources: at least two primary sources are required`);
        } else {
          const eventUrls = new Set();
          const primaryHosts = new Set();
          let primaryCount = 0;
          event.sources.forEach((source, sourceIndex) => {
            const sourceTag = `${tag}.sources[${sourceIndex}]`;
            plain(source?.label_en, `${sourceTag}.label_en`, errors, { maxLength: 120 });
            plain(source?.label_zh, `${sourceTag}.label_zh`, errors, { maxLength: 120 });
            const safeUrl = safeExternalUrl(source?.url);
            if (!safeUrl) errors.push(`${sourceTag}.url: must be a valid HTTPS URL`);
            else {
              if (eventUrls.has(safeUrl) || watchSourceUrls.has(safeUrl)) errors.push(`${sourceTag}.url: source URLs must be unique`);
              eventUrls.add(safeUrl);
              watchSourceUrls.add(safeUrl);
              if (source?.primary === true) {
                primaryCount += 1;
                primaryHosts.add(sourceHostname(safeUrl));
              }
            }
            if (source?.primary !== true) errors.push(`${sourceTag}.primary: must explicitly identify a first-party or official source`);
          });
          if (primaryCount < 2) errors.push(`${tag}.sources: at least two sources must be explicitly primary`);
          if (primaryHosts.size < 2) errors.push(`${tag}.sources: primary evidence must span at least two distinct official hostnames`);
        }
      });
    }
  }
  return { ok: errors.length === 0, errors };
}
