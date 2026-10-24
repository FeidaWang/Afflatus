import { describe, expect, it } from 'vitest';
import { resolveBirthTime, zoneOffsetMs, cstOf } from '../src/lib/relationships/time.js';
import { DEFAULT_CONFIG, ERROR_CODES, SCHEMA_VERSION, isKnownTimeZone } from '../src/lib/relationships/contract.js';
import { computeRelationshipReport } from '../src/lib/relationships/kernel.js';
import { SCORE_MODEL_IDS } from '../src/lib/relationships/scale.js';
import { parseBirthForm, birthInputFromSaved, birthAssumptions, slotRange } from '../src/horoscope/formDetails.js';
import { normalizeBirthToCST, dayPillar } from '../src/lib/bazi.js';
import { solarToLunar } from '../src/lib/lunar.js';
import { natalXiu } from '../src/lib/xiu.js';
import { citiesInRegion, allRegions } from '../src/lib/cityPicker.js';
import { GLOBAL_CITIES } from '../src/lib/cities.js';

const exact = (hhmm) => ({ kind: 'exact', localTime: hhmm, precision: 'minute' });
const birth = (localDate, time, extra = {}) => ({ localDate, calendar: 'gregorian', time, ...extra });
const iso = (ms) => new Date(ms).toISOString();
const report = (A, B = birth('1990-06-15', exact('12:00'))) => computeRelationshipReport({
  schemaVersion: SCHEMA_VERSION, requestId: 'req-time-0001', A, B, config: structuredClone(DEFAULT_CONFIG), scoreModelId: SCORE_MODEL_IDS[0],
});
const fact = (r, id) => r.facts.find((f) => f.id === id);

describe('day boundaries: 23:00 and 00:00 never move the real instant', () => {
  it('23:30 China time: real UTC stays on the civil date; the bazi day pillar takes the next day', () => {
    const t = resolveBirthTime(birth('2000-03-10', exact('23:30')));
    expect(iso(t.points[0])).toBe('2000-03-10T15:30:00.000Z');
    const r = report(birth('2000-03-10', exact('23:30')));
    const next = dayPillar(2000, 3, 11);
    expect(fact(r, 'A.bazi.pillar.day').value).toEqual({ stem: next.stem, branch: next.branch });
    expect(fact(r, 'A.bazi.pillar.hour').value.branch).toBe(0); // 子
  });

  it('00:10 China time stays on the same bazi day', () => {
    const r = report(birth('2000-03-10', exact('00:10')));
    const same = dayPillar(2000, 3, 10);
    expect(fact(r, 'A.bazi.pillar.day').value).toEqual({ stem: same.stem, branch: same.branch });
  });

  it('the 晚子 slot is a one-hour range ending at the next midnight', () => {
    expect(slotRange(23)).toEqual({ kind: 'range', start: '23:00', end: '00:00', endDayOffset: 1 });
    const t = resolveBirthTime(birth('2000-03-10', slotRange(23)));
    expect(t.points.map(iso)).toEqual(['2000-03-10T15:00:00.000Z', '2000-03-10T15:59:00.000Z']);
  });
});

describe('solar-term boundary inside a slot', () => {
  it('2024 立春 (~16:21 CST): the 15–17 slot leaves the year pillar conflicted, an exact minute settles it', () => {
    const slot = report(birth('2024-02-04', slotRange(15)));
    expect(fact(slot, 'A.bazi.pillar.year').basis).toBe('conflicted');
    expect(fact(slot, 'A.bazi.pillar.year').value).toBeNull();
    expect(slot.modules.bazi.status).toBe('partial');
    const before = report(birth('2024-02-04', exact('15:40')));
    expect(fact(before, 'A.bazi.pillar.year').value.branch).toBe(3); // 癸卯
    const after = report(birth('2024-02-04', exact('17:00')));
    expect(fact(after, 'A.bazi.pillar.year').value.branch).toBe(4); // 甲辰
  });
});

describe('leap month and leap day', () => {
  it('a date in the 2023 leap second lunar month is computed with the host-month rule, not rejected', () => {
    const l = solarToLunar(2023, 3, 25);
    expect(l.isLeap).toBe(true);
    const r = report(birth('2023-03-25', exact('10:00')));
    expect(fact(r, 'A.xiu.natal').value).toBe(natalXiu(l.lMonth, l.lDay));
    expect(r.modules.ziwei.status).toBe('ready');
  });

  it('29 February exists only in leap years; lunar input is refused explicitly', () => {
    expect(() => report(birth('2024-02-29', exact('10:00')))).not.toThrow();
    expect(() => report(birth('2023-02-29', exact('10:00')))).toThrow(expect.objectContaining({ code: ERROR_CODES.DATE_INVALID }));
    expect(() => report({ ...birth('2023-03-25', exact('10:00')), calendar: 'chinese_lunar', isLeapLunarMonth: true })).toThrow(expect.objectContaining({ code: ERROR_CODES.CALENDAR_UNSUPPORTED }));
  });
});

describe('IANA daylight saving: folds and gaps', () => {
  it.each([
    ['America/New_York', '2021-11-07', '01:30', 'dst_fold', ['2021-11-07T05:30:00.000Z', '2021-11-07T06:30:00.000Z']],
    ['America/New_York', '2021-03-14', '02:30', 'dst_gap', ['2021-03-14T06:30:00.000Z', '2021-03-14T07:30:00.000Z']],
    ['Australia/Melbourne', '2023-04-02', '02:30', 'dst_fold', ['2023-04-01T15:30:00.000Z', '2023-04-01T16:30:00.000Z']],
    ['Australia/Melbourne', '2023-10-01', '02:30', 'dst_gap', ['2023-09-30T15:30:00.000Z', '2023-09-30T16:30:00.000Z']],
  ])('%s %s %s → %s with both readings', (zone, date, time, flag, points) => {
    const t = resolveBirthTime(birth(date, exact(time), { timezone: zone }));
    expect(t.flags).toContain(flag);
    expect(t.points.map(iso)).toEqual(points);
    expect(t.legacy).toMatchObject(cstOf(t.points[0])); // the page shows the earlier reading
  });

  it('a normal time next to a transition resolves to one instant', () => {
    expect(resolveBirthTime(birth('2021-03-14', exact('03:30'), { timezone: 'America/New_York' })).points.map(iso)).toEqual(['2021-03-14T07:30:00.000Z']);
  });

  it('historical DST is detected without the manual box (London 1980 summer)', () => {
    const t = resolveBirthTime(birth('1980-07-01', exact('12:00'), { timezone: 'Europe/London' }));
    expect(iso(t.points[0])).toBe('1980-07-01T11:00:00.000Z');
  });

  it('an ambiguous time is checked at both readings: agreeing facts stay, differing ones turn conflicted', () => {
    // 01:30 in the NY fold is 13:30 or 14:30 CST — the same 未 hour either way.
    const r = report(birth('2021-11-07', exact('01:30'), { timezone: 'America/New_York' }));
    expect(r.warnings).toContain('A.dst_fold');
    expect(fact(r, 'A.bazi.pillar.hour').value.branch).toBe(7);
    // 00:30 in a Melbourne gap reads as 22:30 or 21:30 CST the previous day:
    // 亥 either way; a 23:00 boundary would have made the day pillar conflicted.
    const g = report(birth('2023-10-01', exact('02:30'), { timezone: 'Australia/Melbourne' }));
    expect(g.warnings).toContain('A.dst_gap');
    const across = report(birth('2023-04-02', exact('01:15'), { timezone: 'Australia/Melbourne' }));
    expect(across.warnings).not.toContain('A.dst_fold'); // 01:15 is before the 02:00–03:00 fold
  });

  it('a slot whose readings differ marks the pillar conflicted', () => {
    // 23:00–24:00 CST spans no 节 here, but a 22:00 exact vs 23:30 exact differ in day pillar.
    const a = report(birth('2000-03-10', exact('22:30')));
    const b = report(birth('2000-03-10', exact('23:30')));
    expect(fact(a, 'A.bazi.pillar.day').value).not.toEqual(fact(b, 'A.bazi.pillar.day').value);
    const span = report(birth('2000-03-10', { kind: 'range', start: '22:30', end: '23:45', endDayOffset: 0 }));
    expect(fact(span, 'A.bazi.pillar.day').basis).toBe('conflicted');
    expect(fact(span, 'A.bazi.pillar.hour').basis).toBe('conflicted');
  });

  it('A and B keep their own zones', () => {
    const r = report(birth('1990-01-01', exact('09:00'), { timezone: 'Asia/Tokyo' }), birth('1990-01-01', exact('09:00'), { timezone: 'America/New_York' }));
    expect(fact(r, 'A.western.Sun.sign').value).toBe(9);
    expect(r.legacy.chartA.hour.branch).not.toBe(r.legacy.chartB.hour.branch);
  });
});

describe('unknown time and ranges never fake precision', () => {
  const place = { latitude: 31.23, longitude: 121.47, precision: 'city' };
  it('unknown time: no ascendant; a slot: rising sign only, no degree; exact: sign and degree', () => {
    expect(fact(report(birth('1990-05-05', { kind: 'unknown' }, { place })), 'A.western.ascendant').value).toBeNull();
    for (let h = 1; h < 23; h += 2) {
      const a = fact(report(birth('1990-05-05', slotRange(h), { place })), 'A.western.ascendant');
      if (a.basis === 'conflicted') expect(a.value).toBeNull();
      else expect(a.value.degree).toBeNull();
    }
    const e = fact(report(birth('1990-05-05', exact('10:20'), { place })), 'A.western.ascendant').value;
    expect(Number.isFinite(e.degree)).toBe(true);
  });
});

describe('form adapter keeps the legacy CST conversion', () => {
  it('China default and manual offsets give the same CST birth as normalizeBirthToCST', () => {
    const offsets = ['', '-5', '0', '5.5', '9', '9.5', '-3.5', '5.75'];
    for (let i = 0; i < 200; i++) {
      const y = 1950 + (i * 7) % 60, m = 1 + (i * 5) % 12, d = 1 + (i * 3) % 28, hour = (i * 11) % 24;
      const tz = offsets[i % offsets.length], dst = i % 3 === 0 && tz !== '';
      const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const got = parseBirthForm({ date, hour: String(hour), timezone: tz, dst }).birth;
      const want = normalizeBirthToCST({ y, m, d, hour }, tz === '' ? null : { utcOffset: Number(tz), dst });
      expect(got).toEqual(want);
    }
  });

  it('exact minutes are carried, bad times rejected, saved profiles round-trip', () => {
    const r = parseBirthForm({ date: '1990-01-01', hour: 'exact', exactTime: '07:45', iana: 'Asia/Tokyo' });
    expect(r.birth).toEqual({ y: 1990, m: 1, d: 1, hour: 6, minute: 45 });
    expect(parseBirthForm({ date: '1990-01-01', hour: 'exact', exactTime: '' }).error).toBe('time');
    expect(parseBirthForm({ date: '1990-02-30', hour: '' }).error).toBe('date');
    expect(resolveBirthTime(birthInputFromSaved(r.birth)).legacy).toEqual(r.birth);
    expect(resolveBirthTime(birthInputFromSaved({ y: 1990, m: 1, d: 1, hour: 7 })).legacy).toEqual({ y: 1990, m: 1, d: 1, hour: 7 });
  });

  it('assumption text names the zone database and reports folds', () => {
    expect(birthAssumptions({ hour: 'exact', iana: 'Europe/London', flags: ['dst_fold'] }, 'en')).toMatch(/Europe\/London.*twice/s);
    expect(birthAssumptions({ hour: '1', iana: 'Europe/London' }, 'zh')).toContain('时区数据库');
  });
});

describe('city table carries IANA zones', () => {
  it('every overseas and HK/Macau/Taiwan city has a known zone whose standard offset matches the table', () => {
    const jan = Date.UTC(2026, 0, 15), jul = Date.UTC(2026, 6, 15);
    const { provinces, countries } = allRegions();
    for (const c of countries) {
      for (const city of citiesInRegion(c.key, false)) {
        expect(isKnownTimeZone(city.iana), city.en).toBe(true);
        const std = Math.min(zoneOffsetMs(city.iana, jan), zoneOffsetMs(city.iana, jul)) / 3600000;
        // Paraguay moved to permanent UTC−3 in Oct 2024; the table's offset is
        // the older standard time. The IANA zone is what the page now uses.
        if (city.en !== 'Asuncion') expect(std, city.en).toBe(city.utcOffset);
      }
    }
    for (const p of provinces) for (const city of citiesInRegion(p.key, true)) expect(isKnownTimeZone(city.iana)).toBe(true);
    expect(citiesInRegion('台湾', true)[0].iana).toBe('Asia/Taipei');
    expect(citiesInRegion('上海市', true)[0].iana).toBe('Asia/Shanghai');
    expect(GLOBAL_CITIES.length).toBe(170);
  });
});

describe('China 1988 DST start (owner ruling S1)', () => {
  // The repo table starts 1988 DST on 10 April; tzdata says 17 April. The
  // owner ruled to keep 10 April for mainland births, with or without the
  // explicit Asia/Shanghai zone a city pick writes.
  it.each([undefined, 'Asia/Shanghai'])('timezone %s: 1988-04-10 is already on DST, 04-09 is not', (timezone) => {
    const at = (date) => iso(resolveBirthTime(birth(date, exact('12:00'), timezone ? { timezone } : {})).points[0]);
    expect(at('1988-04-09')).toBe('1988-04-09T04:00:00.000Z');
    expect(at('1988-04-10')).toBe('1988-04-10T03:00:00.000Z');
    expect(at('1988-04-16')).toBe('1988-04-16T03:00:00.000Z'); // tzdata would still read +8 here
  });

  it('the legacy CST conversion agrees', () => {
    expect(normalizeBirthToCST({ y: 1988, m: 4, d: 10, hour: 12 })).toEqual({ y: 1988, m: 4, d: 10, hour: 11 });
    expect(normalizeBirthToCST({ y: 1988, m: 4, d: 9, hour: 12 })).toEqual({ y: 1988, m: 4, d: 9, hour: 12 });
  });
});
