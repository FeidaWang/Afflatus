import { normalizeBirthToCST } from '../lib/bazi.js';

// Calendar validation precedes normalization; Date must not roll bad dates forward.
export function parseBirthDetails(date, hour = '', timezone = '', dst = false) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  const h = hour === '' ? null : Number(hour);
  const offset = timezone === '' || timezone == null ? null : Number(timezone);
  if (y < 1900 || y > 2100 || day.getUTCFullYear() !== y || day.getUTCMonth() + 1 !== m || day.getUTCDate() !== d
    || (h !== null && (!Number.isInteger(h) || h < 0 || h > 23))
    || (offset !== null && (!Number.isFinite(offset) || offset < -12 || offset > 14))) return null;
  return normalizeBirthToCST({ y, m, d, hour: h }, offset === null ? null : { utcOffset: offset, dst });
}

export function birthAssumptions({ hour = '', timezone = '', dst = false, restored = false }, lang = 'en') {
  const T = (en, zh) => lang === 'zh' ? zh : en;
  const time = restored
    ? T('Saved values are already in Beijing standard time (UTC+8); no second conversion.', '恢复的是已换算的北京时间（UTC+8），不会再次换算。')
    : timezone === ''
      ? T('Default: China civil time (UTC+8); the built-in 1986–1991 China daylight-saving dates are corrected when an hour is known.', '默认按中国当地时间（UTC+8）；已知时辰时，按内置的 1986–1991 年中国夏令时日期校正。')
      : T(`Selected city: standard UTC${Number(timezone) >= 0 ? '+' : ''}${timezone}; daylight saving ${dst ? 'on (+1 hour)' : 'off'}. Overseas historical DST is not detected automatically.`, `所选城市：标准时区 UTC${Number(timezone) >= 0 ? '+' : ''}${timezone}；夏令时${dst ? '已开启（+1 小时）' : '未开启'}。海外历史夏令时不会自动判断。`);
  const precision = hour === ''
    ? T('Hour unknown: three pillars; date stays unchanged without timezone conversion. Moon uses a noon approximation; ascendant and Ziwei are unavailable.', '时辰未知：排三柱盘，日期保持不变，不进行时区换算；月亮按正午近似，上升与紫微不可用。')
    : restored ? T('The saved hour is used as shown. Calculations use Beijing time; 23:00 advances the pillar date to the next day.', '采用表单显示的已保存小时；推算采用北京时间，23 点的柱历日期按次日处理。')
    : T('The selected time slot uses its starting hour, not exact birth minutes. Calculations use Beijing time; 23:00 advances the pillar date to the next day.', '时段按起始小时计算，并非精确出生分钟；推算采用北京时间，23 点的柱历日期按次日处理。');
  return `${time} ${precision}`;
}

export function clearHoroscopeStorage(storage) {
  Object.keys(storage).filter(key => key.startsWith('afflatus-horo:')).forEach(key => storage.removeItem(key));
  if (Object.keys(storage).some(key => key.startsWith('afflatus-horo:'))) throw new Error('Storage deletion incomplete');
}
