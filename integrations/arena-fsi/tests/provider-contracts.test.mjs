import test from 'node:test';
import assert from 'node:assert/strict';
import { AIProvider, frozenContext } from '../server/ai.mjs';
import { configuration } from '../server/config.mjs';
import { demoSnapshot } from '../server/market.mjs';
import { fetchJSON } from '../server/common.mjs';
import { NeonAdapter } from '../server/store.mjs';
const now='2026-10-12T15:00:00Z';
const context=frozenContext(demoSnapshot(['AAPL'],now),{}, {},now);
const intent={action:'hold',symbol:'AAPL',quantity:0,confidence:.5,horizonHours:24,rationale:'Evidence insufficient',counterargument:'A quote alone is insufficient',sourceIds:[],invalidation:'New evidence is required'};
test('OpenAI Responses uses strict JSON schema, explicit model, no server tools or retention',async()=>{
  let recorded;
  const config=configuration({ARENA_P_MODEL:'configured-model',OPENAI_API_KEY:'test-fixture'});
  const fetcher=async(url,options)=>{recorded={url,...options};return Response.json({id:'response-fixture',status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(intent)}]}],usage:{input_tokens:20,output_tokens:30}});};
  const out=await new AIProvider(config,{OPENAI_API_KEY:'test-fixture'},fetcher).analyze(config.profiles[1],context);
  const payload=JSON.parse(recorded.body);assert.equal(recorded.url,'https://api.openai.com/v1/responses');assert.equal(payload.model,'configured-model');assert.equal(payload.store,false);assert.equal(payload.text.format.strict,true);assert.equal(payload.tools,undefined);assert.equal(out.value.action,'hold');
});
test('Anthropic Messages preserves bounded text JSON and rejects truncated completion',async()=>{
  const config=configuration({ARENA_S_MODEL:'configured-model',ANTHROPIC_API_KEY:'fixture'});let count=0;
  const fetcher=async()=>Response.json({stop_reason:count++?'max_tokens':'end_turn',content:[{type:'text',text:JSON.stringify(intent)}],usage:{input_tokens:20,output_tokens:30}});
  const ai=new AIProvider(config,{ANTHROPIC_API_KEY:'fixture'},fetcher);assert.equal((await ai.analyze(config.profiles[0],context)).value.action,'hold');
  await assert.rejects(()=>ai.analyze(config.profiles[0],context),{code:'AI_INCOMPLETE'});
});
test('LLM refusal, malformed JSON, and HTTP error cannot become a trade',async()=>{
  const config=configuration({ARENA_P_MODEL:'configured-model',OPENAI_API_KEY:'fixture'});
  for(const response of [{status:'incomplete',output:[]},{status:'completed',output:[{content:[{type:'refusal',refusal:'No'}]}]},{status:'completed',output:[{content:[{type:'output_text',text:'execute this code'}]}]}]){
    const ai=new AIProvider(config,{OPENAI_API_KEY:'fixture'},async()=>Response.json(response));await assert.rejects(()=>ai.analyze(config.profiles[1],context));
  }
  const ai=new AIProvider(config,{OPENAI_API_KEY:'fixture'},async()=>new Response('private details',{status:429}));
  await assert.rejects(()=>ai.analyze(config.profiles[1],context),error=>error.code==='PROVIDER_HTTP_ERROR'&&!error.message.includes('private'));
});
test('provider responses are size bounded even without Content-Length',async()=>{
  await assert.rejects(()=>fetchJSON('https://example.com',{maxBytes:20,fetcher:async()=>new Response('x'.repeat(200))}),{code:'PROVIDER_RESPONSE_TOO_LARGE'});
});
test('Neon adapter uses a versioned CAS and parameter binding for all user-derived data',async()=>{
  const calls=[];const sql=async(strings,...values)=>{calls.push({text:strings.join('?'),values});return [{version:2,document:{ledger:'fixture'}}];};
  const db=new NeonAdapter(sql);await db.read('safe-key');await db.cas('safe-key',1,{text:"';drop table anything;--"});await db.cas('fresh',null,{});
  assert(calls[0].text.includes('WHERE id=?'));assert(calls[1].text.includes('AND version=?'));assert.equal(calls[1].values[0],JSON.stringify({text:"';drop table anything;--"}));
  assert(calls[2].text.includes('ON CONFLICT DO NOTHING'));
});
