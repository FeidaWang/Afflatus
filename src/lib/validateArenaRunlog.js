/* Pure validation for public/arena-runlog.json (Part 4 SS18.1.4) -- the
   append-only audit trail of every scheduled-task window (SS19.1) and the
   source data for offline catch-up (SS19.3). */

const WINDOWS = ['pre-market-gather', 'picks-publish', 'open-window', 'late-window', 'post-market', 'weekly-review'];
const MODELS = ['gatherer', 'S', 'P', 'T', 'reviewer'];
const STATUSES = ['done', 'missed', 'queued'];

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

/** @param {unknown} data parsed JSON (caller must JSON.parse first). */
export function validateArenaRunlog(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, errors: ['top-level: must be an object'] };
  }
  if (!Array.isArray(data.runs)) {
    errors.push('runs: must be an array');
    return { ok: false, errors };
  }
  const seen = new Set();
  data.runs.forEach((r, i) => {
    const tag = `runs[${i}]`;
    if (!r || typeof r !== 'object') { errors.push(`${tag}: not an object`); return; }
    if (!isNonEmptyString(r.date)) errors.push(`${tag}.date: missing or empty`);
    if (!WINDOWS.includes(r.window)) errors.push(`${tag}.window: must be one of ${WINDOWS.join('/')}, got ${JSON.stringify(r.window)}`);
    if (!MODELS.includes(r.model)) errors.push(`${tag}.model: must be one of ${MODELS.join('/')}, got ${JSON.stringify(r.model)}`);
    if (!STATUSES.includes(r.status)) errors.push(`${tag}.status: must be one of ${STATUSES.join('/')}, got ${JSON.stringify(r.status)}`);
    if (r.ordersProposed != null && (!Number.isInteger(r.ordersProposed) || r.ordersProposed < 0)) errors.push(`${tag}.ordersProposed: must be a non-negative integer`);
    if (r.ordersFilled != null && (!Number.isInteger(r.ordersFilled) || r.ordersFilled < 0)) errors.push(`${tag}.ordersFilled: must be a non-negative integer`);
    // run identity = (date, window, model) per SS19.3.1 -- must be unique so
    // idempotency/catch-up logic can tell "already ran" from "new window".
    if (isNonEmptyString(r.date) && WINDOWS.includes(r.window) && MODELS.includes(r.model)) {
      const key = `${r.date}|${r.window}|${r.model}`;
      if (seen.has(key)) errors.push(`${tag}: duplicate run identity (date, window, model) = ${key}`);
      else seen.add(key);
    }
  });
  return { ok: errors.length === 0, errors };
}
