// Check the shared production header, replacing the obsolete persona-uniqueness rule.
import { readFileSync } from 'node:fs';
import { parse } from 'parse5';
import { headerBlockFor, headerFiles } from './shared-header.mjs';
const issues = [];
const attr = (node, name) => node.attrs?.find(item => item.name === name)?.value;
const walk = node => [node, ...(node.childNodes || []).flatMap(walk)];
for (const file of headerFiles) {
  const source = readFileSync(file, 'utf8');
  const nodes = walk(parse(source));
  const headers = nodes.filter(node => attr(node, 'data-afflatus-header') !== undefined);
  if (headers.length !== 1 || !source.includes(headerBlockFor(file))) issues.push(`${file}: shared header differs or is missing`);
  if (!source.includes('/styles/shared-header.css')) issues.push(`${file}: missing isolated header styles`);
  if (nodes.some(node => attr(node, 'data-afflatus-nav') !== undefined || attr(node, 'data-brand-persona') !== undefined)) issues.push(`${file}: competing legacy header`);
  const headerNodes = headers.flatMap(walk);
  for (const button of headerNodes.filter(node => node.tagName === 'button')) {
    const target = headerNodes.find(node => attr(node, 'id') === attr(button, 'aria-controls'));
    if (!target || attr(button, 'aria-expanded') !== 'false') issues.push(`${file}: invalid disclosure`);
  }
  if (!headerNodes.some(node => node.tagName === 'a' && attr(node, 'data-header-path') === '/')) issues.push(`${file}: missing home link`);
}
console.log(issues.length ? issues.join('\n') : `Shared header: ${headerFiles.length} source templates passed (structure, links, disclosure targets, styles).`);
if (issues.length) process.exitCode = 1;
