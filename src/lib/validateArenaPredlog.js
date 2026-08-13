const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const AUDIT_STATUSES = new Set(['scored', 'partial', 'no-predictions', 'missed-source']);

export function validateArenaPredlog(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, errors: ['top-level: must be an object'] };
  }
  if (!Number.isFinite(Date.parse(data.updated))) errors.push('updated: must be an ISO timestamp');
  if (!DATE_RE.test(String(data.checkedThrough || ''))) errors.push('checkedThrough: must be YYYY-MM-DD');
  if (!Array.isArray(data.days)) {
    errors.push('days: must be an array');
  } else {
    const seen = new Set();
    data.days.forEach((day, index) => {
      const tag = `days[${index}]`;
      if (!DATE_RE.test(String(day?.date || ''))) errors.push(`${tag}.date: must be YYYY-MM-DD`);
      else if (seen.has(day.date)) errors.push(`${tag}.date: duplicate ${day.date}`);
      else seen.add(day.date);
      if (!day?.entries || typeof day.entries !== 'object' || Array.isArray(day.entries)) {
        errors.push(`${tag}.entries: must be an object`);
      }
      if (day?.audit != null) {
        if (!day.audit || typeof day.audit !== 'object' || Array.isArray(day.audit)) {
          errors.push(`${tag}.audit: must be an object when present`);
        } else {
          if (!AUDIT_STATUSES.has(day.audit.status)) {
            errors.push(`${tag}.audit.status: must be scored, partial, no-predictions, or missed-source`);
          }
          if (!Number.isFinite(Date.parse(day.audit.checkedAt))) {
            errors.push(`${tag}.audit.checkedAt: must be an ISO timestamp`);
          }
          if (typeof day.audit.note !== 'string' || !day.audit.note.trim()) {
            errors.push(`${tag}.audit.note: must be non-empty`);
          }
        }
      }
    });
  }
  return { ok: errors.length === 0, errors };
}
