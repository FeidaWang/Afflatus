const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

export function validateDailyTransits(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, errors: ['top-level: must be an object'] };
  }
  if (!DATE_RE.test(String(data.date || ''))) errors.push('date: must be YYYY-MM-DD');
  if (!Number.isFinite(Date.parse(data.generatedAt))) errors.push('generatedAt: must be an ISO timestamp');
  if (!data.planets || typeof data.planets !== 'object' || Array.isArray(data.planets)) {
    errors.push('planets: must be an object');
  } else {
    for (const body of BODIES) {
      const longitude = data.planets[body];
      if (typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < 0 || longitude >= 360) {
        errors.push(`planets.${body}: must be a longitude in [0, 360)`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}
