import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { explore } from '../src/sectors/frontier/explorer-core.mjs';
import { rankMetric, paretoFrontier } from '../src/sectors/frontier/frontier-core.mjs';
const data=JSON.parse(readFileSync('public/data/sectors-frontier/2026-09-23.json','utf8'));
describe('P3 constrained evidence',()=>{
 it('preserves each unconstrained metric and cohort',()=>{
  for(const metric of data.metrics) expect(explore(data,{metric:metric.id}).ranked).toEqual(rankMetric(data,metric.id).ranked);
 });
 it('applies all requirements together before computing dominance',()=>{
  const options={metric:'intelligence',minScore:40,maxCost:2,context:200000,openOnly:true};
  const r=explore(data,options);
  expect(r.ranked.length).toBeGreaterThan(0);
  for(const row of r.ranked){expect(row.value).toBeGreaterThanOrEqual(40);expect(row.model.open_weights).toBe(true);expect(row.model.context_tokens).toBeGreaterThanOrEqual(200000);}
  expect(r.pareto.eligible.every(row=>row.cost<=2)).toBe(true);
  expect(r.pareto.frontier).toEqual(paretoFrontier({...data,models:r.ranked.map(row=>row.model)}).frontier);
 });
 it('never relaxes impossible score, budget or context requirements',()=>{
  for(const options of [{minScore:1e9},{maxCost:0},{context:1e9}]) expect(explore(data,options).ranked).toEqual([]);
 });
 it('distinguishes missing context and missing/provisional costs from zero',()=>{
  const d=structuredClone(data), id=d.models[0].id;
  d.models[0].context_tokens=null;
  expect(explore(d,{context:1}).excluded).toContainEqual({model:d.models[0],reason:'context_missing'});
  const cost=d.observations.find(o=>o.model_id===id&&o.metric_id==='cost_task');
  cost.evidence_status='provisional_conflict';
  expect(explore(d,{maxCost:100}).excluded).toContainEqual({model:d.models[0],reason:'cost_missing'});
  expect(explore(d).pareto.eligible.some(row=>row.model.id===id)).toBe(false);
  cost.value=null;cost.evidence_status='not_retrieved';
  expect(explore(d,{maxCost:100}).excluded).toContainEqual({model:d.models[0],reason:'cost_missing'});
 });
 it('keeps negative indices and rejects invalid constraints',()=>{
  const r=explore(data,{metric:'omniscience',minScore:-100});
  expect(r.ranked.some(row=>row.value<0)).toBe(true);
  for(const options of [{minScore:NaN},{maxCost:-1},{context:Infinity}]) expect(()=>explore(data,options)).toThrow();
 });
});
