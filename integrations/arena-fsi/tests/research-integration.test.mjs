import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ArenaService } from '../server/service.mjs';
import { StateStore, MemoryAdapter } from '../server/store.mjs';

const fixture=JSON.parse(await readFile(new URL('../fixtures/research-demo.json',import.meta.url),'utf8'));
const NOW='2026-10-12T15:00:00.000Z';
function service(){return new ArenaService({store:new StateStore(new MemoryAdapter()),env:{ARENA_MODE:'demo'},clock:()=>NOW});}

test('a private calculation remains unpersisted until an explicit source-backed public publication',async()=>{
  const app=service();const calculated=await app.research({mode:'demo',kind:'dcf',input:fixture.dcf});
  assert(calculated.result);assert.equal((await app.read('demo')).artifacts.length,0);
  await assert.rejects(()=>app.research({mode:'demo',kind:'dcf',input:fixture.dcf,visibility:'public',symbol:'AAPL',sourceIds:['unknown']}),{code:'UNKNOWN_EVIDENCE'});
  assert.equal((await app.read('demo')).artifacts.length,0);
  await app.research({mode:'demo',kind:'evidence',input:{visibility:'public',sources:fixture.sources}});
  const body={mode:'demo',kind:'dcf',input:fixture.dcf,visibility:'public',symbol:'AAPL',sourceIds:['synthetic-filing']};
  const published=await app.research(body);await app.research(body);
  assert.equal(published.artifact.inputOrigin,'administrator-supplied assumptions');
  assert.equal((await app.read('demo')).artifacts.length,1);
  const run=await app.run({mode:'demo',idempotencyKey:'research-archive-round'});
  assert.equal(run.frozen.research.artifacts[0].id,published.artifact.id);
  assert.equal(run.frozen.evidence.some(e=>e.id==='synthetic-filing'),true);
  const exported=await app.export('demo');
  assert(exported.frozenContextVerification[0].profiles.every(p=>p.valid));
  await app.update('demo',state=>{state.runs[0].frozen.snapshot.quotes[0].price+=1;return null;});
  assert((await app.export('demo')).frozenContextVerification[0].profiles.every(p=>!p.valid));
});

test('explicit synthetic research evidence cannot enter the live research namespace',async()=>{
  const app=service();
  await assert.rejects(()=>app.research({mode:'live',kind:'evidence',input:{visibility:'public',sources:fixture.sources}}),{code:'DEMO_DATA_REJECTED'});
  assert.equal((await app.read('live')).evidence.length,0);
  await app.research({mode:'demo',kind:'evidence',input:{visibility:'public',sources:fixture.sources}});
  assert.equal((await app.read('demo')).evidence.length,fixture.sources.length);
});

test('a declared user source without a URL remains valid live evidence under its explicit source kind',async()=>{
  const app=service();const source={id:'user-note-001',kind:'user',title:'User-supplied assumption, not a verified filing',publishedAt:NOW,availableAt:NOW};
  await app.research({mode:'live',kind:'evidence',input:{visibility:'public',sources:[source]}});
  const state=await app.read('live');assert.equal(state.evidence[0].kind,'user');assert.equal(state.evidence[0].url,undefined);
});
