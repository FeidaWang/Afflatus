import { resolveBirthTime } from '../lib/relationships/time.js';
import { validateBirthInput } from '../lib/relationships/contract.js';

const pad = (n) => String(n).padStart(2, '0');
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// A time-slot select value is the slot's start hour: 早子/晚子 last one
// hour, every other 时辰 two (REL-020 keeps the slot as a range).
export function slotRange(hour) {
  const width = hour === 0 || hour === 23 ? 1 : 2;
  const end = hour + width;
  return { kind: 'range', start: `${pad(hour)}:00`, end: `${pad(end % 24)}:00`, endDayOffset: end >= 24 ? 1 : 0 };
}

// Form values → v2 BirthInput (local civil time; nothing converted yet).
// restored: the profile is already in fixed UTC+8, so it is read as such.
export function birthInputFromForm({ date, hour = '', exactTime = '', timezone = '', dst = false, iana = '', restored = false }) {
  let time;
  if (hour === '') time = { kind: 'unknown' };
  else if (hour === 'exact') {
    if (!HHMM.test(exactTime || '')) return { error: 'time' };
    time = { kind: 'exact', localTime: exactTime, precision: 'minute' };
  } else {
    const h = Number(hour);
    if (!Number.isInteger(h) || h < 0 || h > 23) return { error: 'time' };
    time = slotRange(h);
  }
  const input = { localDate: date, calendar: 'gregorian', time };
  if (restored) input.timezone = 'Etc/GMT-8';
  else if (iana) input.timezone = iana;
  else if (timezone !== '' && timezone != null) {
    const offset = Number(timezone);
    if (!Number.isFinite(offset) || offset < -12 || offset > 14) return { error: 'date' };
    input.fixedOffset = { minutes: Math.round(offset * 60), dst: !!dst };
  }
  const errors = [];
  validateBirthInput(input, 'birth', errors);
  if (errors.length) return { error: errors.some((e) => e.field.startsWith('birth.time')) ? 'time' : 'date' };
  return { input };
}

// BirthInput → the CST birth object every pre-v2 engine takes, plus the
// time flags (DST fold/gap) the assumptions text reports.
export function parseBirthForm(fields) {
  const r = birthInputFromForm(fields);
  if (r.error) return r;
  const t = resolveBirthTime(r.input);
  return { input: r.input, birth: { ...t.legacy }, flags: t.flags, kind: t.kind };
}

// Saved profiles / relationship book entries (CST, possibly with an exact
// minute) → BirthInput, so they reach the kernel the same way.
export function birthInputFromSaved(b) {
  const localDate = `${b.y}-${pad(b.m)}-${pad(b.d)}`;
  const time = b.hour == null ? { kind: 'unknown' }
    : b.minute != null ? { kind: 'exact', localTime: `${pad(b.hour)}:${pad(b.minute)}`, precision: 'minute' }
      : slotRange(b.hour);
  return { localDate, calendar: 'gregorian', time, timezone: 'Etc/GMT-8' };
}

export function birthAssumptions({ hour = '', timezone = '', dst = false, restored = false, iana = '', flags = [] }, lang = 'en') {
  const T = (en, zh) => lang === 'zh' ? zh : en;
  const time = restored
    ? T('Saved values are already in Beijing standard time (UTC+8); no second conversion.', '恢复的是已换算的北京时间（UTC+8），不会再次换算。')
    : iana && iana !== 'Asia/Shanghai'
      ? T(`Selected city: time zone ${iana}; the offset and any daylight saving in force at that moment come from the browser's time-zone database.`, `所选城市：时区 ${iana}；当时的时差和夏令时取自浏览器内置的时区数据库。`)
      : timezone === '' || iana === 'Asia/Shanghai'
        ? T('Default: China civil time (UTC+8); the built-in 1986–1991 China daylight-saving dates are corrected when a time is known.', '默认按中国当地时间（UTC+8）；已知时间时，按内置的 1986–1991 年中国夏令时日期校正。')
        : T(`Manual timezone: standard UTC${Number(timezone) >= 0 ? '+' : ''}${timezone}; daylight saving ${dst ? 'on (+1 hour)' : 'off'}. Historical DST is not detected for a manual offset.`, `手动时区：标准时区 UTC${Number(timezone) >= 0 ? '+' : ''}${timezone}；夏令时${dst ? '已开启（+1 小时）' : '未开启'}。手动时差不会自动判断历史夏令时。`);
  const precision = hour === ''
    ? T('Time unknown: three pillars; date stays unchanged without timezone conversion. Moon uses a noon approximation; ascendant and Ziwei are unavailable.', '时间未知：排三柱盘，日期保持不变，不进行时区换算；月亮按正午近似，上升与紫微不可用。')
    : hour === 'exact'
      ? T('Exact time: calculated to the minute. Calculations use Beijing time; 23:00 advances the pillar date to the next day.', '精确时间：按分钟推算。推算采用北京时间，23 点的柱历日期按次日处理。')
      : restored ? T('The saved hour is kept as a time slot. Calculations use Beijing time; 23:00 advances the pillar date to the next day.', '已保存的小时按时段处理；推算采用北京时间，23 点的柱历日期按次日处理。')
        : T('A time slot is kept as a range, not exact minutes: pillars use its start and are flagged when a solar term falls inside it; the rising sign is shown only if it holds for the whole slot. Calculations use Beijing time; 23:00 advances the pillar date to the next day.', '时段按区间处理，并非精确分钟：四柱按时段起点排，时段内有交节时会标注；上升星座只在整个时段内不变时才显示。推算采用北京时间，23 点的柱历日期按次日处理。');
  const clock = flags.includes('dst_fold')
    ? T(' This clock time happened twice that night (clocks went back): both readings are checked, and the earlier one is shown.', '这个钟点当晚出现了两次（夏令时结束、时钟回拨）：两种读法都会检查，此处按较早的一次显示。')
    : flags.includes('dst_gap')
      ? T(' This clock time was skipped that night (clocks went forward): both nearby readings are checked, and the earlier one is shown.', '这个钟点当晚被跳过（夏令时开始、时钟拨快）：前后两种读法都会检查，此处按较早的一次显示。')
      : '';
  return `${time} ${precision}${clock}`;
}

export function clearHoroscopeStorage(storage) {
  Object.keys(storage).filter(key => key.startsWith('afflatus-horo:')).forEach(key => storage.removeItem(key));
  if (Object.keys(storage).some(key => key.startsWith('afflatus-horo:'))) throw new Error('Storage deletion incomplete');
}
