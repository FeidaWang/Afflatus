const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
    });
  }
  return { ok: errors.length === 0, errors };
}
