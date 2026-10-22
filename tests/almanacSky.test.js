import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { skyAt, termInfo } from '../src/lib/almanacSky.js';
import { solarTermDate, dayPillar } from '../src/lib/bazi.js';
import { validateDailyTransits } from '../src/lib/validateDailyTransits.js';

const committed = JSON.parse(readFileSync('public/transits-daily.json', 'utf8'));
const dir = mkdtempSync(join(tmpdir(), 'almanac-'));
function generate(now) {
  const output = join(dir, `${now.replace(/\W/g, '')}.json`);
  execFileSync(process.execPath, ['scripts/gen-transits-daily.mjs', `--now=${now}`, `--output=${output}`], { stdio: 'ignore' });
  return JSON.parse(readFileSync(output, 'utf8'));
}
// Melbourne noon of the committed file's date, so the check survives daily refreshes.
const fresh = generate(committed.generatedAt);
const win = fresh.window;
const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

describe('transits window (data task, local --now mode)', () => {
  it('has 61 rows, centred on date, and validates', () => {
    expect(win.days).toHaveLength(61);
    expect(win.days[30][0]).toBe(fresh.date);
    expect(validateDailyTransits(fresh)).toEqual({ ok: true, errors: [] });
  });
  it('centre row matches the committed planets within 0.01°', () => {
    expect(fresh.date).toBe(committed.date);
    BODIES.forEach((b, k) => expect(Math.abs(win.days[30][k + 1] - committed.planets[b])).toBeLessThanOrEqual(0.01));
  });
  it('validator rejects a malformed window and tolerates a missing one', () => {
    const { window: _w, ...legacy } = fresh;
    expect(validateDailyTransits(legacy).ok).toBe(true);
    const bad = { ...fresh, window: { ...win, days: win.days.slice(1) } };
    expect(validateDailyTransits(bad).ok).toBe(false);
  });
});

describe('skyAt', () => {
  it('reads Venus retrograde on 2026-10-22..24 and direct Sun/Moon', () => {
    const w = generate('2026-10-23T02:00:00Z').window;
    for (const day of ['2026-10-22', '2026-10-23', '2026-10-24']) {
      const sky = skyAt(day, { window: w });
      expect(sky.planetsAvailable).toBe(true);
      expect(sky.retrograde.Venus).toBe(true);
      expect(sky.retrograde.Sun).toBe(false);
    }
  });
  it('describes 2026-10-22: moon ~81% waxing gibbous in Pisces, day pillar from bazi', () => {
    const sky = skyAt('2026-10-22', { window: generate('2026-10-22T02:00:00Z').window });
    expect(sky.phase.en).toBe('waxing gibbous');
    expect(Math.round(sky.illumination * 100)).toBe(81);
    expect(sky.moonSign.en).toBe('Pisces');
    const p = dayPillar(2026, 10, 22);
    expect(sky.dayPillar.stem).toBe(p.stem);
    expect(sky.dayPillar.branch).toBe(p.branch);
  });
  it('falls back to local Sun/Moon when the window misses the date', () => {
    const inWin = skyAt('2026-10-22', { window: generate('2026-10-22T02:00:00Z').window });
    const out = skyAt('2026-10-22', { window: { ...win, days: [] } });
    expect(out.planetsAvailable).toBe(false);
    expect(out.planets).toBeNull();
    expect(out.retrograde).toBeNull();
    expect(Math.abs(out.sun - inWin.sun)).toBeLessThan(0.1);
    expect(Math.abs(out.moon - inWin.moon)).toBeLessThan(0.3);
    expect(skyAt('2026-10-22').planetsAvailable).toBe(false);
  });
  it('names all eight phases around the cycle', () => {
    const names = new Set();
    for (let i = 0; i < 30; i++) names.add(skyAt(new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10)).phase.en);
    expect(names.size).toBe(8);
  });
});

describe('termInfo', () => {
  it('matches bazi.solarTermDate for all 24 terms of 2026 (CST day)', () => {
    const seen = new Set();
    for (const y of [2026]) {
      for (let day = 0; day < 366; day++) {
        const iso = new Date(Date.UTC(y, 0, 1 + day)).toISOString().slice(0, 10);
        if (!iso.startsWith(`${y}`)) break;
        const t = termInfo(iso).entersToday;
        if (!t || seen.has(t.at)) continue;
        seen.add(t.at);
        const cst = new Date(Date.parse(t.at) + 8 * 3600000);
        const ref = solarTermDate(2026, t.lon, cst.getUTCMonth() + 1, cst.getUTCDate());
        expect({ m: cst.getUTCMonth() + 1, d: cst.getUTCDate() }).toEqual(ref);
      }
    }
    expect(seen.size).toBe(24);
  });
  it('2026-10-23 is the 霜降 turn at ~20:38 Melbourne (±3 min)', () => {
    const t = termInfo('2026-10-23');
    expect(t.entersToday.zh).toBe('霜降');
    expect(t.current.zh).toBe('寒露');
    expect(t.next.zh).toBe('霜降');
    expect(t.daysToNext).toBe(0);
    const [h, m] = t.entersToday.melbourneTime.split(':').map(Number);
    expect(Math.abs(h * 60 + m - (20 * 60 + 38))).toBeLessThanOrEqual(3);
    expect(termInfo('2026-10-22').entersToday).toBeNull();
    expect(termInfo('2026-10-24').current.zh).toBe('霜降');
  });
});
