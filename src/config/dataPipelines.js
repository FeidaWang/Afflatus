/**
 * Canonical operating contract for every public data pipeline. External
 * schedulers may choose their own execution environment, but cadence,
 * expected publication time and atomic output groups live here.
 */
export const DATA_PIPELINES = Object.freeze([
  {
    id: 'arena-premarket',
    kind: 'market-session',
    availableFromMinutes: 8 * 60 + 30,
    owner: 'data-orchestrator',
    publishMode: 'recoverable-build-commit-transaction',
    outputs: [
      { resource: 'arena-news', path: 'public/arena-news.json', dateField: 'date' },
      { resource: 'arena-picks', path: 'public/arena-picks.json', dateField: 'date' },
      {
        resource: 'arena-runlog',
        path: 'public/arena-runlog.json',
        dateField: 'runs',
        valueMode: 'max-run-date',
        requiredRuns: [
          { window: 'pre-market-gather', model: 'gatherer', statuses: ['done', 'missed'] },
          { window: 'picks-publish', model: 'gatherer', statuses: ['done', 'missed'] },
        ],
      },
    ],
  },
  {
    id: 'arena-open',
    kind: 'market-session',
    availableFromMinutes: 10 * 60 + 5,
    owner: 'data-orchestrator',
    publishMode: 'recoverable-build-commit-transaction',
    outputs: [
      { resource: 'arena-ledger', path: 'public/arena-ledger.json', dateField: 'updated' },
      {
        resource: 'arena-runlog',
        path: 'public/arena-runlog.json',
        dateField: 'runs',
        valueMode: 'max-run-date',
        requiredRuns: [
          { window: 'open-window', model: 'S', statuses: ['done', 'missed'] },
          { window: 'open-window', model: 'P', statuses: ['done', 'missed'] },
        ],
      },
    ],
  },
  {
    id: 'arena-late',
    kind: 'market-session',
    availableFromMinutes: 15 * 60 + 30,
    earlyCloseAvailableFromMinutes: 12 * 60 + 30,
    owner: 'data-orchestrator',
    publishMode: 'recoverable-build-commit-transaction',
    outputs: [
      { resource: 'arena-ledger', path: 'public/arena-ledger.json', dateField: 'updated' },
      {
        resource: 'arena-runlog',
        path: 'public/arena-runlog.json',
        dateField: 'runs',
        valueMode: 'max-run-date',
        requiredRuns: [
          { window: 'late-window', model: 'S', statuses: ['done', 'missed'] },
          { window: 'late-window', model: 'P', statuses: ['done', 'missed'] },
        ],
      },
    ],
  },
  {
    id: 'arena-postmarket',
    kind: 'market-session',
    availableFromMinutes: 16 * 60 + 30,
    earlyCloseAvailableFromMinutes: 13 * 60 + 30,
    owner: 'data-orchestrator',
    publishMode: 'recoverable-build-commit-transaction',
    outputs: [
      { resource: 'arena-ledger', path: 'public/arena-ledger.json', dateField: 'updated' },
      { resource: 'arena-digest', path: 'public/arena-daily-digest.json', dateField: 'date' },
      {
        resource: 'arena-predlog',
        path: 'public/arena-predlog.json',
        dateField: 'days',
        valueMode: 'max-audit-date',
      },
      {
        resource: 'arena-runlog',
        path: 'public/arena-runlog.json',
        dateField: 'runs',
        valueMode: 'max-run-date',
        requiredRuns: [
          { window: 'post-market', model: 'S', statuses: ['done'] },
          { window: 'post-market', model: 'P', statuses: ['done'] },
          { window: 'post-market', model: 'reviewer', statuses: ['done'] },
          { window: 'post-market', model: 'T', statuses: ['done', 'missed'] },
        ],
      },
    ],
  },
  {
    id: 'signal-macro',
    kind: 'max-age',
    maxAgeHours: 7 * 24,
    owner: 'data-orchestrator',
    publishMode: 'recoverable-build-commit-transaction',
    outputs: [{ resource: 'signal', path: 'public/signal-events.json', dateField: 'updated' }],
  },
  {
    id: 'arena-earnings-digest',
    kind: 'market-session',
    availableFromMinutes: 16 * 60,
    earlyCloseAvailableFromMinutes: 13 * 60,
    owner: 'data-orchestrator',
    publishMode: 'recoverable-build-commit-transaction',
    outputs: [
      { resource: 'arena-digest', path: 'public/arena-daily-digest.json', dateField: 'date' },
    ],
  },
  {
    id: 'sectors-research',
    kind: 'max-age',
    maxAgeHours: 14 * 24,
    owner: 'data-orchestrator',
    publishMode: 'recoverable-build-commit-transaction',
    outputs: [
      { resource: 'sectors', path: 'public/sectors-data.json', dateField: 'updated' },
      { resource: 'sectors-competition', path: 'public/sectors-competition.json', dateField: 'updated' },
      { resource: 'sectors-ecosystem', path: 'public/sectors-ecosystem.json', dateField: 'updated' },
      { resource: 'sectors-rivalry', path: 'public/sectors-rivalry.json', dateField: 'updated' },
    ],
  },
  {
    id: 'horoscope-transits',
    kind: 'calendar-day',
    timeZone: 'Australia/Melbourne',
    owner: 'data-orchestrator',
    publishMode: 'recoverable-build-commit-transaction',
    sourceMode: 'deterministic-generator',
    outputs: [{ resource: 'transits', path: 'public/transits-daily.json', dateField: 'date' }],
  },
]);

/**
 * Scheduler profiles are declared beside their pipelines so freshness and
 * publication checks can share the same scope. A scoped strict check must not
 * be blocked by an unrelated profile that the caller is forbidden to repair.
 */
export const DATA_PIPELINE_PROFILES = Object.freeze({
  'morning-research': Object.freeze([
    'arena-premarket',
    'signal-macro',
    'sectors-research',
    'horoscope-transits',
  ]),
  'open-execution': Object.freeze(['arena-open']),
  'late-execution': Object.freeze(['arena-late']),
  'postmarket-settlement': Object.freeze(['arena-postmarket', 'arena-earnings-digest']),
});

/** Resolve the value that represents one output's publication date/time. */
export function dataPipelineOutputValue(output, data) {
  if (output.valueMode === 'max-audit-date') {
    const days = Array.isArray(data?.[output.dateField]) ? data[output.dateField] : [];
    const allowedStatuses = new Set(['scored', 'partial', 'no-predictions', 'missed-source']);
    return days
      .filter((day) => allowedStatuses.has(day?.audit?.status))
      .map((day) => day.date)
      .filter(Boolean)
      .reduce((latest, date) => (date > latest ? date : latest), '');
  }
  if (output.valueMode === 'max-run-date') {
    const runs = Array.isArray(data?.[output.dateField]) ? data[output.dateField] : [];
    const dates = [...new Set(runs.map((entry) => entry?.date).filter(Boolean))]
      .filter((date) => (output.requiredRuns || []).every((required) => runs.some((run) => (
        run.date === date
        && run.window === required.window
        && run.model === required.model
        && required.statuses.includes(run.status)
      ))));
    return dates.reduce((latest, date) => (date > latest ? date : latest), '');
  }
  return data?.[output.dateField];
}
