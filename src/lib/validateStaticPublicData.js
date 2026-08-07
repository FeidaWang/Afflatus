const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HTTPS_RE = /^https:\/\//;

function object(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateDateEntries(value, field, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${field}: must be an array`);
    return;
  }
  const seen = new Set();
  let previous = '';
  value.forEach((entry, index) => {
    const tag = `${field}[${index}]`;
    if (!object(entry)) { errors.push(`${tag}: must be an object`); return; }
    if (!DATE_RE.test(String(entry.date || ''))) errors.push(`${tag}.date: must be YYYY-MM-DD`);
    if (!text(entry.name)) errors.push(`${tag}.name: must be a non-empty string`);
    if (seen.has(entry.date)) errors.push(`${tag}.date: duplicate ${entry.date}`);
    if (previous && entry.date < previous) errors.push(`${field}: dates must be sorted ascending`);
    seen.add(entry.date);
    previous = entry.date;
  });
}

function validateDateList(value, field, errors) {
  if (!Array.isArray(value) || !value.length) {
    errors.push(`${field}: must be a non-empty date array`);
    return;
  }
  const seen = new Set();
  let previous = '';
  value.forEach((date, index) => {
    if (!DATE_RE.test(String(date || ''))) errors.push(`${field}[${index}]: must be YYYY-MM-DD`);
    if (seen.has(date)) errors.push(`${field}[${index}]: duplicate ${date}`);
    if (previous && date < previous) errors.push(`${field}: dates must be sorted ascending`);
    seen.add(date);
    previous = date;
  });
}

export function validateAudioPlaylist(data) {
  const errors = [];
  if (!object(data)) return { ok: false, errors: ['top-level: must be an object'] };
  if (!DATE_RE.test(String(data.updated || ''))) errors.push('updated: must be YYYY-MM-DD');
  if (!text(data._readme)) errors.push('_readme: must document the audio authorization');
  if (!Array.isArray(data.tracks) || !data.tracks.length) {
    errors.push('tracks: must be a non-empty array');
  } else {
    const sources = new Set();
    data.tracks.forEach((track, index) => {
      const tag = `tracks[${index}]`;
      if (!object(track)) { errors.push(`${tag}: must be an object`); return; }
      if (!text(track.title)) errors.push(`${tag}.title: must be a non-empty string`);
      if (!text(track.artist)) errors.push(`${tag}.artist: must be a non-empty string`);
      if (!/^\/audio\/[A-Za-z0-9._-]+\.mp3$/.test(String(track.src || ''))) {
        errors.push(`${tag}.src: must be a local /audio/*.mp3 path`);
      }
      if (sources.has(track.src)) errors.push(`${tag}.src: duplicate ${track.src}`);
      sources.add(track.src);
    });
  }
  return { ok: errors.length === 0, errors };
}

export function validateNyseCalendar(data) {
  const errors = [];
  if (!object(data)) return { ok: false, errors: ['top-level: must be an object'] };
  if (!DATE_RE.test(String(data.updated || ''))) errors.push('updated: must be YYYY-MM-DD');
  if (!text(data.note_en) || !text(data.note_zh)) errors.push('note_en/note_zh: bilingual provenance is required');
  validateDateEntries(data.holidays, 'holidays', errors);
  validateDateEntries(data.earlyClose_1pmET, 'earlyClose_1pmET', errors);
  const closed = new Set((data.holidays || []).map((entry) => entry.date));
  for (const entry of data.earlyClose_1pmET || []) {
    if (closed.has(entry.date)) errors.push(`earlyClose_1pmET: ${entry.date} is also a full holiday`);
  }
  return { ok: errors.length === 0, errors };
}

export function validateSignalReleaseDates(data) {
  const errors = [];
  if (!object(data)) return { ok: false, errors: ['top-level: must be an object'] };
  if (!DATE_RE.test(String(data.updated || ''))) errors.push('updated: must be YYYY-MM-DD');
  if (!Number.isInteger(data.version) || data.version < 1) errors.push('version: must be a positive integer');
  if (!text(data.note_en) || !text(data.note_zh)) errors.push('note_en/note_zh: bilingual provenance is required');
  if (!Array.isArray(data.verifiedVia) || !data.verifiedVia.length || data.verifiedVia.some((url) => !HTTPS_RE.test(url))) {
    errors.push('verifiedVia: must be a non-empty HTTPS URL array');
  }
  for (const field of ['cpi', 'nfp', 'pce']) validateDateList(data[field], field, errors);
  if (!Array.isArray(data.fomc) || !data.fomc.length) {
    errors.push('fomc: must be a non-empty array');
  } else {
    data.fomc.forEach((meeting, index) => {
      const tag = `fomc[${index}]`;
      if (!object(meeting)) { errors.push(`${tag}: must be an object`); return; }
      if (!/^\d{4}-\d{2}-\d{2}\/\d{2}$/.test(String(meeting.meetingDates || ''))) {
        errors.push(`${tag}.meetingDates: must be YYYY-MM-DD/DD`);
      }
      if (!DATE_RE.test(String(meeting.decisionDate || ''))) errors.push(`${tag}.decisionDate: must be YYYY-MM-DD`);
      if (typeof meeting.sep !== 'boolean') errors.push(`${tag}.sep: must be boolean`);
    });
  }
  return { ok: errors.length === 0, errors };
}
