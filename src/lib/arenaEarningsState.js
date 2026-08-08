export function earningsTimingState(reportAt, now = Date.now()) {
  const reportMs = Date.parse(reportAt);
  const nowMs = now instanceof Date ? now.getTime() : Number.isFinite(Number(now)) ? Number(now) : Date.parse(now);
  if (!Number.isFinite(reportMs) || !Number.isFinite(nowMs)) return { state: 'invalid', remainingMs: null };
  const remainingMs = reportMs - nowMs;
  return remainingMs <= 0
    ? { state: 'released', remainingMs }
    : { state: 'scheduled', remainingMs };
}
