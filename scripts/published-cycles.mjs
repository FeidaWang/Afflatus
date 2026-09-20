// Portfolio's public HTML remains the data owner; the homepage consumes this projection.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import { chartNumber } from '../src/ui/portfolioChartGeometry.js';

const attr = (node, name) => node.attrs?.find(item => item.name === name)?.value;
const hasClass = (node, name) => attr(node, 'class')?.split(/\s+/).includes(name);
const text = node => node?.nodeName === '#text' ? node.value : (node?.childNodes || []).map(text).join('');
function find(node, predicate) {
  return [ ...(predicate(node) ? [node] : []), ...(node.childNodes || []).flatMap(child => find(child, predicate)) ];
}
export function readPublishedCycles(html) {
  const rows = find(parse(html), node => hasClass(node, 'trade-route'));
  if (!rows.length) throw new Error('No published cycles found');
  return rows.map(row => {
    const header = find(row, node => node.tagName === 'header')[0];
    const value = className => chartNumber(text(find(find(row, node => hasClass(node, className))[0], node => attr(node, 'data-chart-value') !== undefined)[0]));
    const cycle = { id: attr(row, 'data-rank'), asset: text(find(header, node => node.tagName === 'span')[0]), holdingDays: value('route-track'), efficiencyPercent: value('route-efficiency') };
    if (!cycle.id || !cycle.asset || !Number.isFinite(cycle.holdingDays) || cycle.holdingDays <= 0 || !Number.isFinite(cycle.efficiencyPercent)) throw new Error('Incomplete public cycle summary');
    return cycle;
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const source = new URL('../portfolio.html', import.meta.url);
  const target = new URL('../src/data/publishedCycles.generated.js', import.meta.url);
  const output = `// Generated from portfolio.html. Run: node scripts/published-cycles.mjs --write\nexport const publishedCycles = ${JSON.stringify(readPublishedCycles(readFileSync(source, 'utf8')), null, 2)};\n`;
  if (process.argv.includes('--write')) writeFileSync(target, output);
  else if (readFileSync(target, 'utf8') !== output) throw new Error('Published cycle data drift: run node scripts/published-cycles.mjs --write');
  console.log('Published cycle projection matches Portfolio');
}
