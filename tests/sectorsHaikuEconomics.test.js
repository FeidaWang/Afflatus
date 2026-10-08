import {describe,it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {workloadCost,utilizedValueRatio,economicsAnalysis,haikuEffort} from '../src/sectors/observatory/economics.js';
import {rankModels,costFrontier} from '../src/sectors/observatory/core.js';
import {validateObservatory} from '../src/sectors/observatory/validate.js';
const data=JSON.parse(readFileSync('src/sectors/observatory/data.json','utf8'));
describe('Haiku economics and model identity',()=>{
 it('keeps new observation requirements separate from immutable historical snapshots',()=>{
  expect(data.schema_version).toBe(2);
  expect(validateObservatory(data).ok).toBe(true);
  for(const date of ['2026-10-06','2026-10-07'])expect(validateObservatory(JSON.parse(readFileSync(`public/data/sectors-observatory/${date}.json`,'utf8'))).ok).toBe(true);
 });
 it('uses a frozen comparable configuration for the new family and retains five effort choices',()=>{
  expect(rankModels(data.models).find(m=>m.id==='haiku55')).toMatchObject({rank:14,score:43,cost:.21,configuration:'max'});
  expect(data.haiku.efforts.map(v=>v.id)).toEqual(['low','medium','high','xhigh','max']);
  expect(haikuEffort(data,'high')).toContain('28.01');
  expect(data.models.every(m=>m.observed===data.snapshot)).toBe(true);
 });
 it('intersects maker, origin, openness and search without dropping score ties',()=>{
  expect(rankModels(data.models,{maker:'Anthropic',query:'haiku'}).map(m=>m.id)).toEqual(['haiku55']);
  expect(rankModels(data.models,{maker:'Anthropic',open:true})).toEqual([]);
  expect(rankModels(data.models,{maker:'OpenAI',country:'CN'})).toEqual([]);
  expect(rankModels(data.models,{maker:'Anthropic',metric:'cost'})[0].id).toBe('haiku55');
 });
 it('computes the frontier in the current population, excluding dominated and retaining tied points',()=>{
  const rows=[{id:'a',name:'a',score:20,cost:1},{id:'b',name:'b',score:20,cost:2},{id:'c',name:'c',score:30,cost:3},{id:'d',name:'d',score:20,cost:1}];
  expect(costFrontier(rows).map(m=>m.id)).toEqual(['a','d','c']);
  expect(costFrontier(data.models).some(m=>m.id==='haiku55')).toBe(false);
  expect(costFrontier(rankModels(data.models,{maker:'Anthropic'}))[0].id).toBe('haiku55');
 });
 it('applies the higher price to the whole request only above 100k including cache tokens',()=>{
  const at=workloadCost(data.haiku.pricing,{prompt:100000,output:1000,cache:80});
  const above=workloadCost(data.haiku.pricing,{prompt:100001,output:1000,cache:80});
  expect(at).toMatchObject({long:false});expect(at.haiku).toBeCloseTo(.0033,8);
  expect(above).toMatchObject({long:true});expect(above.haiku).toBeCloseTo(.01650014,8);
 });
 it('separates cached reads from new input and rejects impossible assumptions',()=>{
  const r=workloadCost(data.haiku.pricing,{prompt:25000,output:1000,cache:80});
  expect(r.haiku).toBeCloseTo(.0012,8);expect(r.previous).toBeCloseTo(.012,8);expect(r.sonnet).toBeCloseTo(.022,8);
  expect(()=>workloadCost(data.haiku.pricing,{cache:101})).toThrow(RangeError);
  expect(()=>workloadCost(data.haiku.pricing,{prompt:NaN})).toThrow(RangeError);
 });
 it('makes utilization scenarios reversible and zero denominators unavailable',()=>{
  expect(utilizedValueRatio(60,80)).toBe(3.75);
  expect(utilizedValueRatio(20,100)).toBe(1);
  expect(utilizedValueRatio(0,80)).toBe(0);
  expect(utilizedValueRatio(60,0)).toBeNull();
  expect(utilizedValueRatio(101,100)).toBeNull();
 });
 it('preserves official identity and disclosed access limits for the independent interpretation',()=>{
  for(const m of data.models){const maker=data.makers[m.maker];expect(existsSync('public'+maker.logo)).toBe(true);expect(maker.sourcePage).toMatch(/^https:/);}
  const d=structuredClone(data);delete d.makers.Anthropic;
  expect(validateObservatory(d).errors.join(' ')).toContain('missing maker identity');
  expect(economicsAnalysis(data)).toContain('paid Tokenomics Dashboard');
 });
});
