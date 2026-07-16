// No network access in this sandbox session. Generates a synthetic but
// realistic daily OHLC series (deterministic seeded random walk) to run
// through the REAL analyzeTicker() + declutter1D()/fitExtent() pipeline
// that arenaTech.js's renderLadder uses in the browser — a pipeline/
// crash/min-gap integration check, not a claim about live market data.
import { analyzeTicker } from './src/lib/technicals.js';
import { declutter1D, fitExtent } from './src/lib/ladderLayout.js';

let seed = 42;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

let price = 195;
const candles = [];
const base = new Date('2025-08-01T00:00:00Z');
for (let i = 0; i < 260; i++) {
  const o = price;
  const drift = (rnd() - 0.5) * 6;
  const c = Math.max(1, o + drift);
  const h = Math.max(o, c) + rnd() * 2;
  const l = Math.min(o, c) - rnd() * 2;
  const v = 20000000 + rnd() * 30000000;
  const d = new Date(base.getTime() + i * 86400000);
  candles.push({ t: d.toISOString().slice(0, 10), o, h, l, c, v });
  price = c;
}

const analysis = analyzeTicker(candles);
console.log('price:', analysis.price.toFixed(2));

const LAD_H0 = 560, LAD_MIN_GAP = 16;
const rows = [];
const push = (level, cls) => { if (Number.isFinite(level)) rows.push({ level, cls }); };
Object.entries(analysis.pivots.pre).forEach(([k, v]) => push(v, k === 'pp' ? 'pp' : (k[0] === 'r' ? 'res' : 'sup')));
(analysis.swings?.support || []).forEach(s => push(s.level, 'sup'));
(analysis.swings?.resistance || []).forEach(s => push(s.level, 'res'));
(analysis.rounds?.below || []).forEach(r => push(r.level, 'round'));
(analysis.rounds?.above || []).forEach(r => push(r.level, 'round'));
(analysis.ma || []).forEach(m => { if (m.value != null) push(m.value, 'ma'); });

const p = analysis.price;
const gaps = (analysis.gaps || []).filter(g => g.status !== 'filled').slice(0, 3)
  .filter(g => Math.abs((g.top + g.bottom) / 2 - p) / p <= 0.15);

console.log('rows:', rows.length, 'gaps:', gaps.length);

const lo = Math.min(p, ...rows.map(r => r.level), ...gaps.map(g => g.bottom)) * 0.995;
const hi = Math.max(p, ...rows.map(r => r.level), ...gaps.map(g => g.top)) * 1.005;
const Y = v => ((hi - v) / (hi - lo)) * LAD_H0;

const items = [];
rows.forEach(r => items.push({ trueY: Y(r.level) }));
gaps.forEach(g => items.push({ trueY: Y(g.top) }));
items.push({ trueY: Y(p) });

const decl = declutter1D(items.map(it => it.trueY), { minGap: LAD_MIN_GAP });
const { offset, size } = fitExtent(decl, LAD_H0, { padTop: 10, padBottom: 14 });

console.log('item count:', items.length);
console.log('offset:', offset.toFixed(1), 'size:', size.toFixed(1));

const sortedY = [...decl].sort((a, b) => a - b);
let minGapSeen = Infinity;
for (let i = 1; i < sortedY.length; i++) minGapSeen = Math.min(minGapSeen, sortedY[i] - sortedY[i - 1]);
console.log('min gap between any two decluttered labels:', minGapSeen.toFixed(2), '(must be >= ~16)');
console.log('any NaN in decl?', decl.some(v => Number.isNaN(v)));
console.log('PASS:', minGapSeen >= 16 - 1e-6 && !decl.some(Number.isNaN));
