import { easternTimeParts, isNyseSession } from './marketSession.js';
import { isEarlyCloseSession } from './arenaWindowGate.js';

const SOURCE_TYPES = new Set(['company-ir', 'sec']);
const STATUSES = new Set(['upcoming', 'reported']);
const TIMINGS = new Set(['before-market', 'after-market', 'time-unspecified']);
const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const isDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const itemKey = (item) => `${item.symbol}|${item.eventDate}|${item.status}|${item.url}`;

export function arenaRelevantEarningsSymbols(ledger, picks) {
  const symbols = new Set();
  for (const book of Object.values(ledger?.models || {})) {
    for (const position of book?.positions || []) {
      if (isText(position?.sym)) symbols.add(position.sym.trim().toUpperCase());
    }
  }
  for (const list of Object.values(picks?.models || {})) {
    for (const pick of Array.isArray(list) ? list : []) {
      if (isText(pick?.sym)) symbols.add(pick.sym.trim().toUpperCase());
    }
  }
  return [...symbols].sort();
}

export function validateArenaEarningsItems(items, {
  relevantSymbols = [], digestGeneratedAt, sessionDate,
} = {}) {
  const errors = [];
  if (!Array.isArray(items)) return { ok: false, errors: ['earnings: must be an array'] };
  const allowed = new Set(relevantSymbols);
  const generatedMs = Date.parse(digestGeneratedAt);
  const seen = new Set();
  items.forEach((item, index) => {
    const tag = `earnings[${index}]`;
    if (!isObject(item)) { errors.push(`${tag}: must be an object`); return; }
    if (!isText(item.symbol) || item.symbol !== item.symbol.toUpperCase()) errors.push(`${tag}.symbol: must be uppercase`);
    if (allowed.size && !allowed.has(item.symbol)) errors.push(`${tag}.symbol: is not a held or sealed-proposal symbol`);
    if (!STATUSES.has(item.status)) errors.push(`${tag}.status: must be upcoming or reported`);
    if (!isDate(item.eventDate)) errors.push(`${tag}.eventDate: must be YYYY-MM-DD`);
    if (!TIMINGS.has(item.timing)) errors.push(`${tag}.timing: unsupported release timing`);
    if (!SOURCE_TYPES.has(item.sourceType)) errors.push(`${tag}.sourceType: must be company-ir or sec`);
    if (!isText(item.source)) errors.push(`${tag}.source: missing`);
    if (!isText(item.url)) errors.push(`${tag}.url: missing`);
    else try {
      const parsed = new URL(item.url);
      if (parsed.protocol !== 'https:') errors.push(`${tag}.url: must use HTTPS`);
      const host = parsed.hostname.toLowerCase();
      if (item.sourceType === 'sec' && host !== 'sec.gov' && host !== 'www.sec.gov') errors.push(`${tag}.url: SEC evidence must use sec.gov`);
      if (item.sourceType === 'company-ir' && !(
        /^(ir|investor|investors)\./.test(host) || host.endsWith('.gcs-web.com')
      )) errors.push(`${tag}.url: company evidence must use an investor-relations host`);
    } catch { errors.push(`${tag}.url: invalid URL`); }
    for (const field of ['headline_en', 'headline_zh', 'summary_en', 'summary_zh']) {
      if (!isText(item[field])) errors.push(`${tag}.${field}: missing`);
    }
    if (item.status === 'reported') {
      const publishedMs = Date.parse(item.publishedAt);
      if (!Number.isFinite(publishedMs)) errors.push(`${tag}.publishedAt: required for reported earnings`);
      if (Number.isFinite(generatedMs) && publishedMs > generatedMs) errors.push(`${tag}.publishedAt: after digest generation`);
      if (sessionDate && item.eventDate !== sessionDate) errors.push(`${tag}.eventDate: reported earnings must match the digest session`);
    } else {
      if (item.publishedAt != null) errors.push(`${tag}.publishedAt: upcoming earnings must not claim a publication time`);
      if (sessionDate && isDate(item.eventDate)) {
        const days = (Date.parse(`${item.eventDate}T12:00:00Z`) - Date.parse(`${sessionDate}T12:00:00Z`)) / 86_400_000;
        if (days < 0 || days > 7) errors.push(`${tag}.eventDate: upcoming earnings must be within seven calendar days`);
      }
    }
    const key = itemKey(item);
    if (seen.has(key)) errors.push(`${tag}: duplicate earnings evidence`);
    seen.add(key);
  });
  return { ok: errors.length === 0, errors };
}

export function validateArenaEarningsInput(input, options = {}) {
  const errors = [];
  if (!isObject(input)) return { ok: false, errors: ['earnings input: must be an object'] };
  if (!isDate(input.date)) errors.push('earnings input.date: must be YYYY-MM-DD');
  if (options.sessionDate && input.date !== options.sessionDate) errors.push('earnings input.date: must match the current session');
  if (!Number.isFinite(Date.parse(input.checkedAt))) errors.push('earnings input.checkedAt: invalid');
  const items = validateArenaEarningsItems(input.items, { ...options, digestGeneratedAt: options.digestGeneratedAt || input.checkedAt });
  errors.push(...items.errors);
  return { ok: errors.length === 0, errors };
}

export function assessArenaEarningsWindow(now = new Date(), { extraHolidays = [] } = {}) {
  const et = easternTimeParts(now);
  const minute = et.minutes;
  const start = isEarlyCloseSession(et.date) ? 13 * 60 : 16 * 60;
  const end = isEarlyCloseSession(et.date) ? 18 * 60 : 21 * 60;
  const session = isNyseSession(et.date, extraHolidays);
  const due = session && minute >= start && minute <= end;
  return { date: et.date, due, session, reason: !session ? 'not-nyse-session' : minute < start ? 'before-earnings-window' : minute > end ? 'after-earnings-window' : 'due' };
}

export function mergeArenaDigestEarnings({ digest, input, ledger, picks, now = new Date() } = {}) {
  const validation = validateArenaEarningsInput(input, {
    relevantSymbols: arenaRelevantEarningsSymbols(ledger, picks),
    sessionDate: digest?.date,
    digestGeneratedAt: now.toISOString(),
  });
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  const snapshot = structuredClone(digest);
  const baseline = Array.isArray(snapshot.earnings) ? snapshot.earnings : [];
  const existing = new Set(baseline.map(itemKey));
  return { ...snapshot, generatedAt: now.toISOString(), earnings: [...baseline, ...structuredClone(input.items.filter((item) => !existing.has(itemKey(item))))] };
}

export function validateArenaEarningsDigestSupplement({ baselineDigest, candidateDigest, ledger, picks } = {}) {
  const errors = [];
  if (!isObject(baselineDigest) || !isObject(candidateDigest)) return { ok: false, errors: ['digest supplement requires baseline and candidate'] };
  for (const key of Object.keys(baselineDigest).filter((key) => !['generatedAt', 'earnings'].includes(key))) {
    if (JSON.stringify(candidateDigest[key]) !== JSON.stringify(baselineDigest[key])) errors.push(`digest.${key}: earnings supplement cannot rewrite settlement content`);
  }
  if (!(Date.parse(candidateDigest.generatedAt) > Date.parse(baselineDigest.generatedAt))) errors.push('digest.generatedAt: must advance');
  const baseline = Array.isArray(baselineDigest.earnings) ? baselineDigest.earnings : [];
  const candidate = Array.isArray(candidateDigest.earnings) ? candidateDigest.earnings : [];
  if (JSON.stringify(candidate.slice(0, baseline.length)) !== JSON.stringify(baseline)) errors.push('digest.earnings: baseline evidence must remain an exact prefix');
  const additions = candidate.slice(baseline.length);
  if (!additions.length) errors.push('digest.earnings: no new evidence to publish');
  for (const item of additions) {
    if (item.status !== 'reported') errors.push('digest.earnings: supplemental additions must be newly reported results');
    if (!(Date.parse(item.publishedAt) > Date.parse(baselineDigest.generatedAt))) errors.push('digest.earnings: reported item is not newer than the baseline digest');
  }
  errors.push(...validateArenaEarningsItems(candidate, {
    relevantSymbols: arenaRelevantEarningsSymbols(ledger, picks),
    digestGeneratedAt: candidateDigest.generatedAt,
    sessionDate: candidateDigest.date,
  }).errors);
  return { ok: errors.length === 0, errors };
}
