import { assessMarketSnapshot } from './marketFreshness.js';

export function zonedDate(value, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function assessPipelineOutput(pipeline, output, artifactValue, value = new Date()) {
  if (pipeline.kind === 'market-session') {
    const snapshotDate = typeof artifactValue === 'string' ? artifactValue.slice(0, 10) : artifactValue;
    const result = assessMarketSnapshot(snapshotDate, value, {
      availableFromMinutes: pipeline.availableFromMinutes,
    });
    return { ...result, detail: `expected ${result.expectedDate}` };
  }

  if (pipeline.kind === 'calendar-day') {
    const expectedDate = zonedDate(value, pipeline.timeZone);
    const stale = artifactValue !== expectedDate;
    return {
      state: stale ? 'stale' : 'fresh',
      stale,
      expectedDate,
      detail: `expected ${expectedDate}`,
    };
  }

  const timestamp = Date.parse(artifactValue);
  const ageHours = Number.isFinite(timestamp) ? (value.getTime() - timestamp) / 3_600_000 : null;
  const future = ageHours != null && ageHours < -0.25;
  const stale = ageHours == null || future || ageHours > pipeline.maxAgeHours;
  return {
    state: future ? 'future' : stale ? 'stale' : 'fresh',
    stale,
    ageHours,
    detail: ageHours == null
      ? 'invalid timestamp'
      : future
        ? `${Math.abs(ageHours).toFixed(1)}h in the future`
        : `${Math.max(0, ageHours).toFixed(1)}h / ${pipeline.maxAgeHours}h`,
  };
}
