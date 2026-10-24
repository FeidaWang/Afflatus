/* ============================================================
   Horoscope birth-data storage (REL-080, decision Q10).
   Default is this visit only; a profile or contact is written to the
   browser only when the person ticks "Save on this device". Existing
   `afflatus-horo:` records are read in place — same keys, same shape
   (a profile may now also carry an exact `minute`), so nothing a
   returning visitor saved, journal included, is lost or rewritten.

   Every function takes the storage object (or null when the browser
   refuses access) and never throws: refusing storage must not stop the
   calculation. Records read back are shape-checked, not trusted.
   ============================================================ */
export const PROFILE_KEY = 'afflatus-horo:me';
export const BOOK_KEY = 'afflatus-horo:book';
export const BOOK_LIMIT = 20;
const NAME_MAX = 12;

const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

// The CST birth fields every record shares. Extra fields are dropped.
function birthFields(b) {
  if (!b || typeof b !== 'object' || !isInt(b.y, 1900, 2100) || !isInt(b.m, 1, 12) || !isInt(b.d, 1, 31)) return null;
  if (b.hour != null && !isInt(b.hour, 0, 23)) return null;
  if (b.minute != null && (b.hour == null || !isInt(b.minute, 0, 59))) return null;
  return { y: b.y, m: b.m, d: b.d, hour: b.hour ?? null, ...(b.minute != null ? { minute: b.minute } : {}) };
}

function read(storage, key) {
  try { return JSON.parse(storage?.getItem(key) ?? 'null'); } catch { return null; }
}
function write(storage, key, value) {
  try { storage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

export function loadProfile(storage) {
  const raw = read(storage, PROFILE_KEY);
  const b = birthFields(raw);
  if (!b) return null;
  const coord = (v, lim) => (Number.isFinite(v) && Math.abs(v) <= lim ? v : null);
  return { ...b, gender: raw.gender === 'M' || raw.gender === 'F' ? raw.gender : null, lat: coord(raw.lat, 90), lon: coord(raw.lon, 180) };
}

export function saveProfile(storage, p) {
  const b = birthFields(p);
  if (!b) return false;
  return write(storage, PROFILE_KEY, { ...b, gender: p.gender ?? null, lat: p.lat ?? null, lon: p.lon ?? null });
}

export function forgetProfile(storage) {
  try { storage?.removeItem(PROFILE_KEY); return true; } catch { return false; }
}

export function loadBook(storage) {
  const raw = read(storage, BOOK_KEY);
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const e of raw.slice(0, BOOK_LIMIT)) {
    const b = birthFields(e);
    if (b && typeof e.name === 'string' && e.name) out.push({ name: e.name.slice(0, NAME_MAX), ...b });
  }
  return out;
}

const sameBirth = (a, b) => a.y === b.y && a.m === b.m && a.d === b.d && a.hour === b.hour && (a.minute ?? null) === (b.minute ?? null);

// Re-saving the same birth just renames it. Returns the new list, or null
// when the browser refused the write.
export function upsertBook(storage, name, birth) {
  const b = birthFields(birth);
  if (!b || !name) return null;
  const list = loadBook(storage);
  const entry = { name: String(name).slice(0, NAME_MAX), ...b };
  const idx = list.findIndex((e) => sameBirth(e, b));
  if (idx >= 0) list[idx] = entry; else list.unshift(entry);
  return write(storage, BOOK_KEY, list.slice(0, BOOK_LIMIT)) ? list.slice(0, BOOK_LIMIT) : null;
}

export function removeFromBook(storage, index) {
  const list = loadBook(storage);
  list.splice(index, 1);
  return write(storage, BOOK_KEY, list) ? list : null;
}
