import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {parse} from 'parse5';
import {researchChapters,researchWall,subscriptionComparison} from '../src/sectors/observatory/research.js';
import {validateObservatory} from '../src/sectors/observatory/validate.js';
const data=JSON.parse(readFileSync('src/sectors/observatory/data.json','utf8'));
describe('consumer research evidence',()=>{
 it('retains the measurement basis and independently comparable populations',()=>{
  expect(data.research.spending.map(r=>r.value)).toEqual([19.5,16.6]);
  expect(data.research.monetization.map(r=>r.value)).toEqual([84,64,14,2]);
  const html=researchChapters(data);expect(html).toContain('August 2026');expect(html).toContain('not company revenue');
  expect(subscriptionComparison(data,'premium')).toContain('50% sub-cap');
  expect(subscriptionComparison(data,'compute')).toContain('lower-bound marker');
 });
 it('intersects source, bilingual search and topic; returns an explicit empty state',()=>{
  expect(researchWall(data,'a16z-apps','Claude','adoption')).toContain('Claude');
  expect(researchWall(data,'a16z-apps','Claude','value')).toContain('No matching evidence');
  expect(researchWall(data,'semianalysis-subscriptions','额度','value')).toContain('Limits can move');
  expect(researchWall(data,'all','unmatched 883')).toContain('No matching evidence');
 });
 it('rejects orphaned citations and malformed percentages',()=>{
  const d=structuredClone(data);d.research.cards[0].source='missing';d.research.spending[0].value=110;
  expect(validateObservatory(d).errors).toContain('research card: missing source');
  expect(validateObservatory(d).errors).toContain('research: invalid percentage');
 });
 it('renders every required interaction target exactly once with bilingual accessible labels',()=>{
  const tree=parse(researchChapters(data)),ids=[],controls=[];function walk(n){const a=Object.fromEntries((n.attrs||[]).map(v=>[v.name,v.value]));if(a.id)ids.push(a.id);if('data-expand-research'in a||'data-close-research'in a||'data-open-research'in a)controls.push(a);if(a['data-en'])expect(a['data-zh']).toBeTruthy();for(const c of n.childNodes||[])walk(c);}walk(tree);
  expect(new Set(ids).size).toBe(ids.length);expect(controls).toHaveLength(3);
  for(const c of controls.filter(c=>c['aria-label']))expect(c['data-aria-zh']).toBeTruthy();
 });
});
