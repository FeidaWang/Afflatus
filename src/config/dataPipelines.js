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
    ],
  },
  {
    id: 'arena-postmarket',
    kind: 'market-session',
    availableFromMinutes: 16 * 60 + 30,
    owner: 'data-orchestrator',
    publishMode: 'recoverable-build-commit-transaction',
    outputs: [
      { resource: 'arena-ledger', path: 'public/arena-ledger.json', dateField: 'updated' },
      { resource: 'arena-digest', path: 'public/arena-daily-digest.json', dateField: 'date' },
      { resource: 'arena-predlog', path: 'public/arena-predlog.json', dateField: 'checkedThrough' },
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
