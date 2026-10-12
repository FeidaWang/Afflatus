import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ArenaService } from '../server/service.mjs';
import { StateStore, MemoryAdapter, SQLiteAdapter } from '../server/store.mjs';
import { createHandler } from '../server/http.mjs';
import { demoSnapshot, MarketProvider, quoteStatus } from '../server/market.mjs';
import { configuration } from '../server/config.mjs';
import { validateIntent, validateCritic, frozenContext } from '../server/ai.mjs';

const NOW='2026-10-12T15:00:00.000Z';
const TOKEN='test-only-admin-token-for-automated-tests';
function setup(extra={}) {const env={ARENA_MODE:'demo',ARENA_ADMIN_TOKEN:TOKEN,...extra.env};const store=extra.store||new StateStore(new MemoryAdapter());let now=NOW;
  const service=new ArenaService({store,env,clock:()=>now,...extra});return {service,store,handler:createHandler(service,env),setNow:value=>now=value};}
function request(route,body,token=TOKEN){return new Request(`https://feida.au/api/arena-fsi?route=${route}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body)});}
test('server defaults never manufacture live quotes or advertise an AI call',async()=>{
  const {service}=setup({env:{ARENA_MODE:'live'}});const status=await service.status();
  assert.equal(status.mode,'live');assert.equal(status.snapshot.quotes.length,0);assert.equal(status.capabilities.ai.configured,false);
  const demo=await service.status('demo');assert(demo.snapshot.quotes.every(q=>q.quality==='demo'));
});
test('all writes require server authentication, not a browser flag',async()=>{
  const {handler}=setup();
  for(const route of ['refresh','run','order','pause','cancel','research','thesis','catalyst','feedback','corporate-action','export']){
    const res=await handler(request(route,{},'fake'));assert.equal(res.status,401,route);
  }
});
test('auth prevents cross-origin writes and enforces bounded JSON',async()=>{
  const {handler}=setup();const r=request('refresh',{});r.headers.set('Origin','https://evil.example');assert.equal((await handler(r)).status,403);
  const malformed=new Request('https://feida.au/api/arena-fsi?route=refresh',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${TOKEN}`},body:'{'});
  assert.equal((await handler(malformed)).status,400);
  assert.equal((await handler(request('refresh',{padding:'x'.repeat(150001)}))).status,413);
});
test('manual order idempotency survives newer market snapshots; conflicting payload fails',async()=>{
  const {service,setNow}=setup();await service.refresh('demo');
  const body={mode:'demo',ledgerId:'S',order:{symbol:'AAPL',side:'buy',type:'market',quantity:2,idempotencyKey:'manual-123'}};
  const first=await service.placeOrder(body);assert.equal(first.status,'filled',JSON.stringify(first));
  setNow('2026-10-12T15:01:00.000Z');await service.refresh('demo');
  const second=await service.placeOrder(body);assert.equal(second.replayed,true);
  await assert.rejects(()=>service.placeOrder({...body,order:{...body.order,quantity:3}}),{code:'IDEMPOTENCY_CONFLICT'});
  const state=await service.read('demo');assert.equal(state.ledgers.S.positions.AAPL.quantity,2);
});
test('concurrent requests serialize by CAS without lost cash or duplicate fills',async()=>{
  const {service}=setup();await service.refresh('demo');
  const responses=await Promise.all(Array.from({length:8},(_,i)=>service.placeOrder({mode:'demo',ledgerId:'S',order:{symbol:'AAPL',side:'buy',type:'market',quantity:1,idempotencyKey:`parallel-${i}`}})));
  assert(responses.every(r=>r.status==='filled'),JSON.stringify(responses));
  const exported=await service.export('demo');assert.equal(exported.state.ledgers.S.positions.AAPL.quantity,8);assert.equal(exported.ledgerVerification.S.valid,true);
});
test('three demo strategies freeze one context snapshot and each execute once',async()=>{
  const {service}=setup();const run=await service.run({mode:'demo',idempotencyKey:'run-three-001'});
  assert.equal(run.status,'completed');assert.equal(run.results.length,3);
  for(const result of run.results)assert.equal(result.execution?.status,'filled',JSON.stringify(result));
  const duplicate=await service.run({mode:'demo',idempotencyKey:'run-three-001'});assert.equal(duplicate.replayed,true);
  const state=await service.read('demo');assert.equal(state.runs.length,1);assert.equal(state.forecasts.length,3);
  for(const l of Object.values(state.ledgers))assert.equal(l.fills.length,1);
});
test('daily run budget is durable and duplicate runs do not consume it',async()=>{
  const {service}=setup({env:{ARENA_MODE:'demo',ARENA_MAX_RUNS_PER_DAY:'1'}});
  await service.run({mode:'demo',idempotencyKey:'budget-first'});
  await service.run({mode:'demo',idempotencyKey:'budget-first'});
  await assert.rejects(()=>service.run({mode:'demo',idempotencyKey:'budget-second'}),{code:'DAILY_RUN_BUDGET'});
});
test('forecast resolution rejects future and late horizon substitutes',async()=>{
  const {service,setNow}=setup();await service.run({mode:'demo',idempotencyKey:'forecast-first'});
  assert.equal((await service.settle('demo')).settled,0);
  setNow('2026-10-13T15:00:30.000Z');assert.equal((await service.settle('demo')).settled,3);
  const status=await service.status('demo');assert.equal(status.feedback.count,3);assert.equal(status.feedback.changesApplied,false);
  const other=setup();await other.service.run({mode:'demo',idempotencyKey:'forecast-second'});other.setNow('2026-10-14T15:00:00.000Z');assert.equal((await other.service.settle('demo')).settled,0);
});
test('SQLite state survives closing and reopening the process store',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'arena-fsi-'));let db;
  try{db=new DatabaseSync(join(dir,'db.sqlite'));let app=setup({store:new StateStore(new SQLiteAdapter(db))});await app.service.refresh('demo');
    await app.service.placeOrder({mode:'demo',ledgerId:'S',order:{symbol:'SPY',side:'buy',type:'market',quantity:1,idempotencyKey:'persist-001'}});db.close();
    db=new DatabaseSync(join(dir,'db.sqlite'));app=setup({store:new StateStore(new SQLiteAdapter(db))});const state=await app.service.read('demo');assert.equal(state.ledgers.S.positions.SPY.quantity,1);
  }finally{db?.close();await rm(dir,{recursive:true,force:true});}
});
test('market provider preserves feed entitlement, quote times, and authoritative clock',async()=>{
  const config=configuration({ARENA_WATCHLIST:'AAPL',ALPACA_API_KEY:'fixture',ALPACA_SECRET_KEY:'fixture',ALPACA_DATA_FEED:'delayed_sip'});
  const fetcher=async url=>Response.json(String(url).endsWith('/clock')?{timestamp:NOW,is_open:true,next_open:NOW,next_close:NOW}:{AAPL:{latestQuote:{bp:99,ap:101,t:NOW},prevDailyBar:{c:98}}});
  const provider=new MarketProvider(config,{ALPACA_API_KEY:'fixture',ALPACA_SECRET_KEY:'fixture'},fetcher,()=>NOW);const s=await provider.snapshot(NOW);
  assert.equal(s.quotes[0].quality,'delayed');assert.equal(s.quotes[0].source,'alpaca:delayed_sip');assert.equal(s.marketOpen,true);
  assert.equal(quoteStatus({...s.quotes[0],quality:'realtime'},'2026-10-12T15:05:00Z'),'stale');
});
test('absent calendar fails closed and malformed or crossed quotes are unavailable',async()=>{
  const config=configuration({ARENA_WATCHLIST:'AAPL',ALPACA_API_KEY:'fixture',ALPACA_SECRET_KEY:'fixture'});
  const fetcher=async url=>String(url).endsWith('/clock')?new Response('',{status:403}):Response.json({AAPL:{latestQuote:{bp:102,ap:100,t:NOW}}});
  const s=await new MarketProvider(config,{ALPACA_API_KEY:'fixture',ALPACA_SECRET_KEY:'fixture'},fetcher,()=>NOW).snapshot(NOW);
  assert.equal(s.marketOpen,false);assert.equal(s.calendarStatus,'unavailable');assert.equal(s.quotes[0].quality,'unavailable');
});
test('AI output cannot create capabilities or cite nonexistent evidence',()=>{
  const snapshot=demoSnapshot(['AAPL'],NOW);const c=frozenContext(snapshot,{}, {},NOW);
  const base={action:'buy',symbol:'AAPL',quantity:1,confidence:.6,horizonHours:24,rationale:'Synthetic example',counterargument:'It is synthetic',invalidation:'Do not use live',sourceIds:[`quote:${snapshot.id}:AAPL`]};
  assert.equal(validateIntent(base,c).action,'buy');assert.throws(()=>validateIntent({...base,executeCode:'evil'},c),{code:'UNEXPECTED_AI_FIELD'});
  assert.throws(()=>validateIntent({...base,sourceIds:['made-up']},c),{code:'UNKNOWN_EVIDENCE'});
  assert.throws(()=>validateCritic({approved:true,reasons:['ok'],sourceIds:['made-up']},c),{code:'UNKNOWN_CRITIC_EVIDENCE'});
});
test('brief includes source-backed quote data and fails no schema gate',async()=>{
  const {service}=setup();await service.refresh('demo');const out=await service.research({mode:'demo',kind:'brief'});
  assert.equal(out.result.quotes.length,11);assert.equal(out.result.evidence.valid,true);assert.equal(out.result.executionAuthorized,false);
});
test('public polling coalesces upstream quotes and cannot match resting orders',async()=>{
  const adapter=new MemoryAdapter();adapter.persistent=true;let requests=0;
  const marketProvider={snapshot:async time=>{requests++;return {...demoSnapshot(['AAPL'],time),mode:'live',calendarStatus:'provider'};}};
  const {service,handler}=setup({store:new StateStore(adapter),env:{ARENA_MODE:'live',ARENA_PUBLIC_QUOTES:'true',ALPACA_API_KEY:'fixture',ALPACA_SECRET_KEY:'fixture'},marketProvider});
  const responses=await Promise.all(Array.from({length:4},()=>handler(new Request('https://feida.au/api/arena-fsi?route=status'))));
  assert(responses.every(r=>r.status===200));assert.equal(requests,1);
  assert.equal((await service.read('live')).ledgers.S.fills.length,0);
});
