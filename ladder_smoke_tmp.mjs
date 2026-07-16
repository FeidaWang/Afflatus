import { analyzeTicker, normalizeDaily } from './src/lib/technicals.js';
import { declutter1D, fitExtent } from './src/lib/ladderLayout.js';

const res = await fetch('https://feida.au/api/history?symbol=NVDA&interval=1day&outputsize=260');
const json = await res.json();
const candles = normalizeDaily(json.values || json.candles || json);
console.log('candles:', candles.length);

const analysis = analyzeTicker(candles, { mode: 'pre' });
console.log('price:', analysis.price);

// Mimic renderLadder's item-collection logic against REAL data to catch any
// crash/NaN in the declutter pipeline (this is what the screenshot bug hit).
const LAD_H0 = 560, LAD_MIN_GAP = 16;
const rows = [];
const push = (kind, name, level, cls, extra={}) => { if (Number.isFinite(level)) rows.push({kind,name,level,cls,...extra}); };
analysis.pivots && Object.entries(analysis.pivots).forEach(([k,v]) => push('pivot', k, v, k==='pp'?'pp':(k[0]==='r'?'res':'sup')));
(analysis.swings?.support||[]).forEach(s => push('swing', 'support', s.level, 'sup'));
(analysis.swings?.resistance||[]).forEach(s => push('swing', 'resistance', s.level, 'res'));
(analysis.round?.below||[]).forEach(r => push('round', 'round', r.level, 'round', {weight:r.weight}));
(analysis.round?.above||[]).forEach(r => push('round', 'round', r.level, 'round', {weight:r.weight}));
if (analysis.ma) Object.entries(analysis.ma).forEach(([k,v]) => push('ma', k, v, 'ma'));

const p = analysis.price;
const gaps = (analysis.gaps||[]).filter(g => g.status !== 'filled').slice(0,3)
  .filter(g => Math.abs((g.top+g.bottom)/2 - p)/p <= 0.15);

const lo = Math.min(p, ...rows.map(r=>r.level), ...gaps.map(g=>g.bottom)) * 0.995;
const hi = Math.max(p, ...rows.map(r=>r.level), ...gaps.map(g=>g.top)) * 1.005;
const Y = v => ((hi - v) / (hi - lo)) * LAD_H0;

const items = [];
rows.forEach(r => items.push({kind:'row', trueY: Y(r.level)}));
gaps.forEach(g => items.push({kind:'gap', trueY: Y(g.top)}));
items.push({kind:'price', trueY: Y(p)});

const decl = declutter1D(items.map(it=>it.trueY), {minGap: LAD_MIN_GAP});
items.forEach((it,i) => { it.y = decl[i]; });
const {offset, size} = fitExtent(decl, LAD_H0, {padTop:10, padBottom:14});

console.log('item count:', items.length);
console.log('offset:', offset.toFixed(1), 'size:', size.toFixed(1));

// Verify: no NaN, min gap respected across ALL item types together (rows+gaps+price)
const sortedY = [...decl].sort((a,b)=>a-b);
let minGapSeen = Infinity;
for (let i=1;i<sortedY.length;i++) minGapSeen = Math.min(minGapSeen, sortedY[i]-sortedY[i-1]);
console.log('min gap between any two decluttered labels:', minGapSeen.toFixed(2), '(should be >= 16 - fp epsilon)');
console.log('any NaN in decl?', decl.some(v => Number.isNaN(v)));
console.log('any NaN in trueY?', items.some(it => Number.isNaN(it.trueY)));
