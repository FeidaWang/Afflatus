import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolveDependencies, STEP_KEYS, TASK_IDS, taskOwners } from '../src/sectors/frontier/dependency-core.js';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const graph=read('public/sectors-ecosystem.json');
const snapshot=read('src/sectors/frontier/dependency-data.json');
describe('dated dependency identity',()=>{
 it('resolves only exact IDs and never folds Qwen into Alibaba',()=>{
  const m=resolveDependencies(graph,snapshot);
  expect(m.resolved).toHaveLength(9);
  expect(m.pending.map(r=>[r.id,r.missing])).toEqual([['rel-06',['celestica']],['rel-11',['qwen']],['rel-12',['xiaomi','mimo']]]);
  expect(m.resolved.filter(r=>r.source==='micron'&&r.target==='anthropic').map(r=>r.type)).toEqual(['memory_storage_supply','equity_investment']);
  expect(m.resolved.every(r=>r.edge_weight===null&&r.semantic&&r.effective_or_disclosed_on&&r.source_ids.every(id=>snapshot.sources.some(s=>s.id===id)))).toBe(true);
 });
 it('retains all evidence when graph is unavailable',()=>{const m=resolveDependencies(null,snapshot);expect(m.resolved).toHaveLength(0);expect(m.pending).toHaveLength(12);});
 it('conserves task IDs and human sign-off through reverse and forward transitions',()=>{
  for(const lens of ['coding','research'])for(const step of [...STEP_KEYS,...STEP_KEYS.toReversed()]){
   const state=taskOwners(step,lens);expect(state.map(t=>t.id)).toEqual(TASK_IDS);expect(state.at(-1).owner).toBe(0);
  }
  expect(taskOwners('capital','coding')[1].owner).not.toBe(taskOwners('capital','research')[1].owner);
 });
});
