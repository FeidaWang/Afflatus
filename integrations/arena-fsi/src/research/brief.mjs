import { record, requireCondition, finite, time, iso, copy } from './core.mjs';
import { validateEvidence, validateResearch } from './evidence.mjs';

const text = value => String(value ?? '').replace(/[\r\n]/g, ' ').replace(/[<>]/g, '').replace(/[|]/g, '\\|');

/** Deterministic summary assembly: no invented quote, catalyst, or agent opinion. */
export function buildMorningBrief(context) {
  record(context);
  const cutoff = time(context.asOf, 'asOf');
  const asOf = new Date(cutoff).toISOString();
  const maxQuoteAgeSeconds = finite(context.maxQuoteAgeSeconds ?? 120, 'maxQuoteAgeSeconds', { min: 0, exclusiveMin: true });
  const evidence = validateEvidence(context.sources ?? [], { asOf });
  const sourceIds = new Set(evidence.accepted.map(source => source.id));
  const excluded = []; const quotes = [];
  requireCondition(Array.isArray(context.quotes ?? []), 'INVALID_QUOTES', 'quotes must be an array.');
  (context.quotes ?? []).forEach((quote, index) => {
    try {
      record(quote, `quotes[${index}]`);
      const quotedAt = time(quote.asOf, 'quote.asOf');
      const receivedAt = time(quote.receivedAt, 'quote.receivedAt');
      requireCondition(quotedAt <= cutoff && receivedAt <= cutoff, 'FUTURE_QUOTE', 'Quote was not known at the snapshot.');
      requireCondition(receivedAt >= quotedAt, 'INVALID_QUOTE_ORDER', 'Quote receivedAt cannot precede asOf.');
      const price = finite(quote.price, 'quote.price', { min: 0, exclusiveMin: true });
      const ageSeconds = (cutoff - quotedAt) / 1000;
      const mode = ['live', 'delayed', 'cached', 'demo'].includes(quote.mode) ? quote.mode : 'unknown';
      let quality = sourceIds.has(quote.sourceId) ? 'sourced' : 'unverified';
      if (quote.session === 'closed' && quality === 'sourced') quality = 'market_closed';
      else if (ageSeconds > maxQuoteAgeSeconds && quality === 'sourced') quality = 'stale';
      if (mode === 'demo') quality = 'demo';
      quotes.push({ symbol: text(quote.symbol), price, currency: text(quote.currency),
        changePct: quote.changePct == null ? null : finite(quote.changePct, 'quote.changePct'),
        asOf: new Date(quotedAt).toISOString(), receivedAt: new Date(receivedAt).toISOString(),
        sourceId: quote.sourceId ?? null, ageSeconds, mode, quality,
        executionEligible: quality === 'sourced' && mode === 'live' && quote.session === 'regular' });
    } catch (error) { excluded.push({ kind: 'quote', index, code: error.code ?? 'INVALID_QUOTE', message: error.message }); }
  });
  const catalysts = [];
  requireCondition(Array.isArray(context.catalysts ?? []), 'INVALID_CATALYSTS', 'catalysts must be an array.');
  (context.catalysts ?? []).forEach((event, index) => {
    try {
      record(event, `catalysts[${index}]`);
      const knownAt = time(event.availableAt, 'catalyst.availableAt');
      requireCondition(knownAt <= cutoff, 'FUTURE_CATALYST_KNOWLEDGE', 'This event was not known at the snapshot.');
      const scheduledAt = time(event.scheduledAt, 'catalyst.scheduledAt');
      requireCondition(Array.isArray(event.sourceIds) && event.sourceIds.length > 0
        && event.sourceIds.every(id => sourceIds.has(id)), 'UNSOURCED_CATALYST', 'Catalysts require accepted sourceIds.');
      if (scheduledAt >= cutoff) catalysts.push({ ...copy(event), scheduledAt: new Date(scheduledAt).toISOString() });
    } catch (error) { excluded.push({ kind: 'catalyst', index, code: error.code ?? 'INVALID_CATALYST', message: error.message }); }
  });
  catalysts.sort((a, b) => time(a.scheduledAt) - time(b.scheduledAt));
  const thesisWatch = [];
  requireCondition(Array.isArray(context.theses ?? []), 'INVALID_THESES', 'theses must be an array.');
  (context.theses ?? []).forEach((thesis, index) => {
    try {
      requireCondition(time(thesis.updatedAt, 'thesis.updatedAt') <= cutoff, 'FUTURE_THESIS_REVISION', 'The latest thesis revision is after the snapshot.');
      thesisWatch.push({ id: thesis.id, symbol: thesis.symbol, revision: thesis.revision, status: thesis.status,
        conviction: thesis.conviction, statement: thesis.statement,
        challengedPillars: (thesis.pillars ?? []).filter(pillar => pillar.status === 'challenged').map(pillar => pillar.id) });
    } catch (error) { excluded.push({ kind: 'thesis', index, code: error.code ?? 'INVALID_THESIS', message: error.message }); }
  });
  const earnings = [];
  requireCondition(Array.isArray(context.earnings ?? []), 'INVALID_EARNINGS', 'earnings must be an array.');
  (context.earnings ?? []).forEach((event, index) => {
    try {
      requireCondition(time(event.availableAt, 'earnings.availableAt') <= cutoff, 'FUTURE_EARNINGS', 'Earnings information postdates the snapshot.');
      requireCondition(Array.isArray(event.sourceIds) && event.sourceIds.length > 0 && event.sourceIds.every(id => sourceIds.has(id)),
        'UNSOURCED_EARNINGS', 'Earnings summaries require accepted sourceIds.');
      earnings.push(copy(event));
    } catch (error) { excluded.push({ kind: 'earnings', index, code: error.code ?? 'INVALID_EARNINGS', message: error.message }); }
  });
  const research = context.research ? validateResearch(context.research, { asOf, sources: context.sources ?? context.research.sources }) : null;
  const alerts = [];
  for (const quote of quotes) if (['stale', 'unverified', 'demo'].includes(quote.quality) || quote.mode === 'unknown') alerts.push({ code: 'QUOTE_NOT_EXECUTION_GRADE', symbol: quote.symbol, quality: quote.quality });
  for (const thesis of thesisWatch) if (['challenged', 'invalidated'].includes(thesis.status)) alerts.push({ code: 'THESIS_REVIEW', symbol: thesis.symbol, status: thesis.status });
  if (research && !research.valid) alerts.push({ code: 'RESEARCH_VALIDATION_FAILED', count: research.errors.length });
  if (!evidence.valid) alerts.push({ code: 'EVIDENCE_VALIDATION_FAILED', count: evidence.errors.length });
  const lines = [`# Market & research brief`, '', `Snapshot: ${asOf}`, '', '## Watchlist', '',
    '| Symbol | Price | Change | Source mode | Data quality |', '| --- | ---: | ---: | --- | --- |'];
  for (const quote of quotes) lines.push(`| ${text(quote.symbol)} | ${text(quote.currency)} ${quote.price.toFixed(2)} | ${quote.changePct === null ? 'Unavailable' : `${(quote.changePct * 100).toFixed(2)}%`} | ${quote.mode} | ${quote.quality}; ${text(quote.sourceId)} |`);
  if (!quotes.length) lines.push('| No valid observations | — | — | — | Unavailable |');
  lines.push('', '## Upcoming catalysts', '');
  if (!catalysts.length) lines.push('No sourced future catalysts were supplied for this snapshot.');
  for (const event of catalysts) lines.push(`- ${event.scheduledAt}: ${text(event.symbol)} — ${text(event.title)} [${event.sourceIds.map(text).join(', ')}]`);
  lines.push('', '## Thesis review', '');
  if (!thesisWatch.length) lines.push('No eligible thesis revisions were supplied.');
  for (const thesis of thesisWatch) lines.push(`- ${text(thesis.symbol)}: ${text(thesis.status)}, revision ${text(thesis.revision)}; ${text(thesis.statement)}`);
  return { asOf, status: excluded.length || alerts.length || !quotes.length ? 'partial' : 'ready', mode: 'paper-research',
    quotes, catalysts, earnings, thesisWatch, alerts, excluded,
    evidence: { valid: evidence.valid, acceptedCount: evidence.accepted.length, errors: evidence.errors },
    research, markdown: lines.join('\n'), executionAuthorized: false };
}
