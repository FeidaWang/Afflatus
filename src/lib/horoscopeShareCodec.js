// URL-safe, birthday-only share payload. Gender, coordinates, saved names,
// streaks and quiz results never enter the link.
export function encodeShare(a, b) {
  const value = JSON.stringify([
    a.y, a.m, a.d, a.hour ?? null,
    b.y, b.m, b.d, b.hour ?? null,
  ]);
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeShare(code) {
  try {
    const value = atob(String(code).replace(/-/g, '+').replace(/_/g, '/'));
    const fields = JSON.parse(value);
    if (!Array.isArray(fields) || fields.length !== 8) return null;
    const numberInRange = (item, low, high) => (
      typeof item === 'number' && item >= low && item <= high ? item : null
    );
    const a = {
      y: numberInRange(fields[0], 1900, 2100),
      m: numberInRange(fields[1], 1, 12),
      d: numberInRange(fields[2], 1, 31),
      hour: fields[3] == null ? null : numberInRange(fields[3], 0, 23),
    };
    const b = {
      y: numberInRange(fields[4], 1900, 2100),
      m: numberInRange(fields[5], 1, 12),
      d: numberInRange(fields[6], 1, 31),
      hour: fields[7] == null ? null : numberInRange(fields[7], 0, 23),
    };
    if (a.y == null || a.m == null || a.d == null || b.y == null || b.m == null || b.d == null) return null;
    return { a, b };
  } catch {
    return null;
  }
}
