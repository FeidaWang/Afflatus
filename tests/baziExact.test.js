// Oracle cross-checks: the site's own calendar/bazi/ziwei math against two
// widely used reference implementations — lunar-javascript (6tail, 寿星天文历
// algorithm by 许剑伟) and iztro (紫微斗数). Both are devDependencies only:
// they never ship to the browser, they are the ruler the shipped code is
// measured against. Seeded random samples, so failures are reproducible.
import { describe, it, expect } from 'vitest';
import { Solar } from 'lunar-javascript';
import { astro } from 'iztro';
import { computeBazi, pillarName, BRANCHES } from '../src/lib/bazi.js';
import { solarToLunar } from '../src/lib/lunar.js';
import { dailyXiu, XIU28_ZH } from '../src/lib/xiu.js';
import { computeZiwei, ZW_STARS_ZH } from '../src/lib/ziwei.js';
import { computeZiweiDeep } from '../src/lib/ziweiDeep.js';
import { computeDayun } from '../src/lib/dayun.js';

function lcg(seed) { let s = seed; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; }
function sample(n, seed) {
  const rnd = lcg(seed); const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ y: 1901 + Math.floor(rnd() * 198), m: 1 + Math.floor(rnd() * 12), d: 1 + Math.floor(rnd() * 28), hour: Math.floor(rnd() * 24), g: rnd() < 0.5 ? 'M' : 'F' });
  }
  return out;
}

describe('four pillars vs lunar-javascript (sect 1: 晚子时 counts as next day)', () => {
  it('matches all four pillars for 1500 random known-hour births', () => {
    const bad = [];
    for (const b of sample(1500, 42)) {
      const ec = Solar.fromYmdHms(b.y, b.m, b.d, b.hour, 30, 0).getLunar().getEightChar(); ec.setSect(1);
      const c = computeBazi(b);
      const ours = [c.year, c.month, c.day, c.hour].map(pillarName).join(' ');
      const ref = [ec.getYear(), ec.getMonth(), ec.getDay(), ec.getTime()].join(' ');
      if (ours !== ref) bad.push(`${b.y}-${b.m}-${b.d} ${b.hour}h ${ours} ≠ ${ref}`);
    }
    // the site's sun longitude is Meeus low-precision (≤13 min vs 寿星历), so
    // a birth within minutes of a 节 may legitimately differ; allow ≤0.3%.
    expect(bad.length, bad.slice(0, 5).join('\n')).toBeLessThanOrEqual(4);
  }, 60000);

  it('solar-term day: a birth BEFORE the 立春 instant stays in the old year', () => {
    // 2007 立春 = 02-04 13:18 CST
    expect(pillarName(computeBazi({ y: 2007, m: 2, d: 4, hour: 1 }).year)).toBe('丙戌');
    expect(pillarName(computeBazi({ y: 2007, m: 2, d: 4, hour: 15 }).year)).toBe('丁亥');
    expect(computeBazi({ y: 2007, m: 2, d: 4, hour: null }).termDayAmbiguous).toBe(true);
    expect(computeBazi({ y: 2007, m: 2, d: 6, hour: null }).termDayAmbiguous).toBe(false);
  });
});

describe('lunar calendar vs lunar-javascript', () => {
  it('agrees on every day 1901-02-19 .. 2100-12-30', () => {
    const bad = [];
    for (let t = Date.UTC(1901, 1, 19); t < Date.UTC(2100, 11, 31); t += 864e5) {
      const D = new Date(t); const y = D.getUTCFullYear(), m = D.getUTCMonth() + 1, d = D.getUTCDate();
      const o = solarToLunar(y, m, d); const L = Solar.fromYmd(y, m, d).getLunar();
      if (o.lYear !== L.getYear() || o.lMonth !== Math.abs(L.getMonth()) || o.lDay !== L.getDay() || o.isLeap !== (L.getMonth() < 0)) bad.push(`${y}-${m}-${d}`);
      if (bad.length > 3) break;
    }
    expect(bad).toEqual([]);
  }, 60000);
  it('值日二十八宿 matches getXiu() on 3000 random days', () => {
    const rnd = lcg(9);
    for (let i = 0; i < 3000; i++) {
      const y = 1901 + Math.floor(rnd() * 198), m = 1 + Math.floor(rnd() * 12), d = 1 + Math.floor(rnd() * 28);
      expect(XIU28_ZH[dailyXiu(y, m, d)]).toBe(Solar.fromYmd(y, m, d).getLunar().getXiu());
    }
  }, 60000);
});

describe('大运 vs lunar-javascript getYun(sect 2)', () => {
  it('first luck pillar and its start year agree', () => {
    const bad = [];
    for (const b of sample(600, 7)) {
      const dy = computeDayun(b, b.g, 2);
      const ec = Solar.fromYmdHms(b.y, b.m, b.d, b.hour, 0, 0).getLunar().getEightChar(); ec.setSect(1);
      const ref = ec.getYun(b.g === 'M' ? 1 : 0, 2).getDaYun(2)[1];
      if (dy.pillars[0].gz !== ref.getGanZhi() || dy.startYear !== ref.getStartYear()) bad.push(`${b.y}-${b.m}-${b.d} ${b.hour} ${b.g}: ${dy.pillars[0].gz}/${dy.startYear} ≠ ${ref.getGanZhi()}/${ref.getStartYear()}`);
    }
    expect(bad.length, bad.slice(0, 5).join('\n')).toBeLessThanOrEqual(3);
  }, 60000);
});

describe('紫微斗数 vs iztro (default config)', () => {
  it('14 major + 12 aux star positions, 四化 and brightness agree', () => {
    const bad = [];
    for (const b of sample(500, 3)) {
      const z = computeZiwei(b); const dp = computeZiweiDeep(z, b.g);
      const a = astro.bySolar(`${b.y}-${b.m}-${b.d}`, b.hour === 23 ? 12 : Math.floor((b.hour + 1) / 2), b.g === 'M' ? '男' : '女', true, 'zh-CN');
      const ref = {};
      a.palaces.forEach((p) => [...p.majorStars, ...p.minorStars].forEach((s) => { ref[s.name] = { b: BRANCHES.indexOf(p.earthlyBranch), hua: s.mutagen || '', br: s.brightness || '' }; }));
      for (const p of dp.palaces) for (const s of p.stars) {
        const r = ref[s.name];
        const hua = s.transformation === 'None' ? '' : s.transformation.replace('化', '');
        if (!r || r.b !== p.branch || r.hua !== hua || (s.brightness && r.br && r.br !== s.brightness)) bad.push(`${b.y}-${b.m}-${b.d} ${b.hour} ${s.name}`);
      }
      ZW_STARS_ZH.forEach((n, i) => { if (ref[n].b !== z.starBranch[i]) bad.push(`${b.y}-${b.m}-${b.d} ${n}`); });
    }
    expect(bad.length, bad.slice(0, 5).join('\n')).toBeLessThanOrEqual(2);
  }, 60000);
});
