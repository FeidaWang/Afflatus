/* ============================================================
   RELATIONSHIPS v2 · time adapter (REL-010 base, REL-020).
   BirthInput (local civil date + exact / range / unknown time + zone)
   → real UTC instants. One conversion; system day boundaries (晚子 etc.)
   are applied later by each system and never move the UTC instant.

   Zones:
   - `Asia/Shanghai` or no zone: China civil time, UTC+8 plus the repo's
     1986–1991 China DST table (bazi.js CN_DST_WINDOWS). Kept instead of
     the browser's tz data so mainland results match the existing page;
     the two differ only for 1988-04-10..16 (see SOURCES_AND_LICENSES).
   - any other IANA name: the browser's own tz database via Intl.
   - `fixedOffset`: the page's legacy manual "UTC±h + DST box".

   Unknown time: no instant. The window is the whole local day
   (00:00 and 23:59) so callers can keep only what holds all day.
   ============================================================ */
import { inCnDstWindow } from '../bazi.js';
import { minutesOf, parseLocalDate } from './contract.js';

const MIN = 60000;
const DAY = 86400000;

const formatters = new Map();
function formatterFor(zone) {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hourCycle: 'h23', era: 'short',
      year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
    });
    formatters.set(zone, f);
  }
  return f;
}

// Offset of `zone` from UTC at a UTC instant, in ms (whole seconds; LMT-era
// offsets such as +8:05:43 are kept as the tz database gives them).
export function zoneOffsetMs(zone, utcMs) {
  const parts = {};
  for (const p of formatterFor(zone).formatToParts(new Date(utcMs))) parts[p.type] = p.value;
  let y = Number(parts.year);
  if (parts.era === 'BC' || parts.era === 'B') y = 1 - y;
  const wall = Date.UTC(y, Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return wall - Math.floor(utcMs / 1000) * 1000;
}

const isChinaCivil = (b) => b.timezone == null && b.fixedOffset == null || b.timezone === 'Asia/Shanghai';

export function zoneOf(b) {
  if (b.fixedOffset) return { id: `fixed${b.fixedOffset.minutes >= 0 ? '+' : ''}${b.fixedOffset.minutes}${b.fixedOffset.dst ? '+dst' : ''}`, adapter: 'fixed-offset' };
  if (isChinaCivil(b)) return { id: 'Asia/Shanghai', adapter: 'cn-table', assumed: b.timezone == null };
  return { id: b.timezone, adapter: 'intl' };
}

// Local wall clock (ms as if UTC) → candidate UTC instants, ascending.
// One candidate normally; two when the wall time is ambiguous.
function wallToUtc(b, zone, wallMs) {
  if (zone.adapter === 'fixed-offset') {
    return { candidates: [wallMs - (b.fixedOffset.minutes + (b.fixedOffset.dst ? 60 : 0)) * MIN], flag: null };
  }
  if (zone.adapter === 'cn-table') {
    const d = new Date(wallMs);
    const dst = inCnDstWindow(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    return { candidates: [wallMs - (dst ? 9 : 8) * 3600000], flag: null };
  }
  const off = zoneOffsetMs(zone.id, wallMs - 12 * 3600000);
  return { candidates: [wallMs - off], flag: null };
}

export function cstOf(utcMs) {
  const d = new Date(utcMs + 8 * 3600000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes() };
}
export const jdOf = (utcMs) => utcMs / DAY + 2440587.5;

/**
 * @param {object} b - validated BirthInput
 * @returns {{kind:string, zone:object, points:number[], window:boolean,
 *   legacy:{y:number,m:number,d:number,hour:number|null,minute?:number}, flags:string[]}}
 *   points: UTC ms instants every time-dependent fact must hold at (one for an
 *   unambiguous exact time; start and last minute for a range or for the
 *   unknown-time day window). legacy: the CST birth object the pre-v2
 *   engines take (slot start, or the exact minute).
 */
export function resolveBirthTime(b) {
  const date = parseLocalDate(b.localDate);
  const zone = zoneOf(b);
  const dayMs = Date.UTC(date.y, date.m - 1, date.d);
  const flags = [];
  if (zone.assumed) flags.push('zone_assumed_china');
  const t = b.time;

  if (t.kind === 'unknown') {
    const first = wallToUtc(b, zone, dayMs).candidates[0];
    const last = wallToUtc(b, zone, dayMs + DAY - MIN).candidates.at(-1);
    return { kind: 'unknown', zone, points: [first, last], window: true, legacy: { y: date.y, m: date.m, d: date.d, hour: null }, flags };
  }

  if (t.kind === 'exact') {
    const r = wallToUtc(b, zone, dayMs + minutesOf(t.localTime) * MIN);
    if (r.flag) flags.push(r.flag);
    const points = r.candidates;
    const c = cstOf(points[0]);
    return { kind: 'exact', zone, points, window: points.length > 1, legacy: c, flags };
  }

  const start = wallToUtc(b, zone, dayMs + minutesOf(t.start) * MIN);
  const end = wallToUtc(b, zone, dayMs + (t.endDayOffset * 1440 + minutesOf(t.end)) * MIN);
  for (const f of [start.flag, end.flag]) if (f && !flags.includes(f)) flags.push(f);
  const s = start.candidates[0];
  const e = end.candidates.at(-1) - MIN;
  const c = cstOf(s);
  return { kind: 'range', zone, points: e > s ? [s, e] : [s], window: true, legacy: { y: c.y, m: c.m, d: c.d, hour: c.hour }, flags };
}
