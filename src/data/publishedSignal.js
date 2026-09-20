import { DATA_PIPELINES } from '../config/dataPipelines.js';

const maxAgeMs = DATA_PIPELINES.find((pipeline) => pipeline.id === 'signal-macro').maxAgeHours * 3_600_000;
function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value.slice(0, 10)) return null;
  return Number.isFinite(Date.parse(value)) ? value : null;
}

// Projection of the publication owner; loading a page never changes source time.
export function publishedSignal(data, now = Date.now()) {
  const asOf = timestamp(data?.as_of);
  const age = asOf === null ? null : now - Date.parse(asOf);
  const supported = data?.version === 2;
  const state = !supported || age === null || !Number.isFinite(age) || age < 0 ? 'unknown' : age > maxAgeMs ? 'stale' : 'fresh';
  return {
    projectionVersion: 1,
    source: '/signal-events.json',
    version: Number.isInteger(data?.version) ? data.version : null,
    asOf,
    retrievedAt: timestamp(data?.retrievedAt),
    state,
    summary: supported ? data?.pillarSummary ?? null : null,
    label: supported && data?.hawkDoveCompass ? { en: data.hawkDoveCompass.label_en, zh: data.hawkDoveCompass.label_zh } : null,
  };
}

export function signalPublicationLabel(snapshot, language = 'en') {
  const states = language === 'zh'
    ? { fresh: '已发布快照', stale: '历史快照', unknown: '未验证' }
    : { fresh: 'PUBLISHED SNAPSHOT', stale: 'ARCHIVED SNAPSHOT', unknown: 'UNVERIFIED' };
  return `${states[snapshot.state]} · ${snapshot.asOf ?? '—'} · Signal v${snapshot.version ?? '—'}`;
}
