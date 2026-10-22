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
  // window is optional so a pre-window file still passes; once present it must be well formed.
  if (data.window !== undefined) validateWindow(data.window, data.date, errors);
  return { ok: errors.length === 0, errors };
}

const WINDOW_HALF_DAYS = 30;

function validateWindow(win, date, errors) {
  if (!win || typeof win !== 'object' || Array.isArray(win)) {
    errors.push('window: must be an object');
    return;
  }
  if (win.center !== date) errors.push('window.center: must equal date');
  if (JSON.stringify(win.bodies) !== JSON.stringify(BODIES)) errors.push('window.bodies: must list the seven bodies in order');
  if (!Array.isArray(win.days) || win.days.length !== 2 * WINDOW_HALF_DAYS + 1) {
    errors.push(`window.days: must have ${2 * WINDOW_HALF_DAYS + 1} rows`);
    return;
  }
  const start = DATE_RE.test(String(date || '')) ? Date.parse(`${date}T00:00:00Z`) - WINDOW_HALF_DAYS * 86400000 : NaN;
  win.days.forEach((row, i) => {
    const expected = Number.isFinite(start) ? new Date(start + i * 86400000).toISOString().slice(0, 10) : null;
    const ok = Array.isArray(row) && row.length === BODIES.length + 1 && row[0] === expected
      && row.slice(1).every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 360);
    if (!ok) errors.push(`window.days[${i}]: must be [${expected}, ...seven longitudes in [0, 360)]`);
  });
}
