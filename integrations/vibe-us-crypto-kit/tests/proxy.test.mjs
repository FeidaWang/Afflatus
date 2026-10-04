// Offline fixtures only. These tests do not call any market or cloud service.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const host = process.env.VIBE_TEST_HOST_ROOT;
const { createHandler, parseQuery, secretEqual, validateSeries, INSTRUMENT_IDS } = await import(host
  ? pathToFileURL(`${host}/src/lib/vibeBridgeProxy.mjs`).href : '../overlay/src/lib/vibeBridgeProxy.mjs');

const key = 'offline-private-quota-key-xxxxxxxxxxxxxxxxxxxxxxxx';
const bridgeToken = 'offline-server-token-xxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const NOW = Date.parse('2026-02-01T12:00:00Z');
const query = { instrument: 'US:AAPL', start: '2026-01-01', end: '2026-01-10' };
const env = { NODE_ENV:'production', VIBE_FEATURE_ENABLED:'true', ARENA_ADMIN_KEY:key, VIBE_BRIDGE_URL:'https://private.example.invalid', VIBE_BRIDGE_TOKEN:bridgeToken };
const fixture = () => ({
  schema_version:1, instrument:{ id:'US:AAPL', market:'us_equity', quote_currency:'USD' },
  bars:[{ date:'2026-01-02',open:100,high:105,low:99,close:103,volume:1000 }],
  provenance:{ source:'yahoo',quote_currency:'USD',is_realtime_quote:false,fallback_used:false,interval:'1D',last_bar_date:'2026-01-02',observed_at:'2026-02-01T12:00:00Z' },
});
function response() {
  return { statusCode:0, headers:{}, payload:null,
    setHeader(k,v) { this.headers[k.toLowerCase()]=v; },
    status(n) { this.statusCode=n;return this; },
    json(value) { this.payload=value;return this; },
  };
}
async function invoke({ config=env, req={}, fetcher=async()=>Response.json(fixture()), handler=null }={}) {
  const res=response();
  await (handler??createHandler({env:config,fetchImpl:fetcher,now:()=>NOW}))({method:'GET',query,headers:{'x-arena-key':key},...req},res);
  assert.equal(res.headers['cache-control'],'private, no-store');
  assert.equal(res.headers['vercel-cdn-cache-control'],'no-store');
  return res;
}

test('registries agree across Python and JS',()=>{
  const instruments=JSON.parse(readFileSync(host ? `${host}/services/vibe-bridge/bridge/instruments.json` : new URL('../overlay/services/vibe-bridge/bridge/instruments.json',import.meta.url),'utf8'));
  assert.deepEqual([...INSTRUMENT_IDS].sort(),instruments.map(x=>x.id).sort());
});
test('secret comparison is type-safe and refuses short configured keys',()=>{
  assert.equal(secretEqual(key,key),true);assert.equal(secretEqual(key,key+'x'),false);
  assert.equal(secretEqual(['a'],key),false);assert.equal(secretEqual('a','a'),false);assert.equal(secretEqual('汉字',key),false);
});
test('valid query creates only fixed daily schema',()=>{
  assert.deepEqual(parseQuery(query,NOW),{instrument_id:'US:AAPL',start_date:'2026-01-01',end_date:'2026-01-10',interval:'1D'});
});
for(const [name,patch] of Object.entries({
  extra:{url:'https://evil.invalid'},array:{instrument:['US:AAPL']},unsupported:{instrument:'HK:0700'},
  perp:{instrument:'CRYPTO:OKX:BTC-USDT:PERP'},reverse:{end:'2025-12-01'},future:{end:'2030-01-01'},
  tooLong:{start:'2024-01-01'},impossibleDate:{end:'2026-02-30'},badDate:{start:'yesterday'},
})) test('query rejects '+name,()=>assert.throws(()=>parseQuery({...query,...patch},NOW)));

test('default feature off does not fetch',async()=>{
  let fetched=false;const r=await invoke({config:{},fetcher:async()=>{fetched=true;}});
  assert.equal(r.statusCode,404);assert.equal(fetched,false);
});
test('wrong method is blocked',async()=>assert.equal((await invoke({req:{method:'POST'}})).statusCode,405));
test('anonymous is denied by default',async()=>assert.equal((await invoke({req:{headers:{}}})).statusCode,403));
test('invalid private key is not accepted',async()=>assert.equal((await invoke({req:{headers:{'x-arena-key':'bad'}}})).statusCode,403));
test('public flag alone does not establish rights',async()=>{
  const r=await invoke({config:{...env,VIBE_ENABLE_PUBLIC_MARKET_DATA:'true',VIBE_PUBLIC_INSTRUMENTS:'US:AAPL'},req:{headers:{}}});assert.equal(r.statusCode,403);
});
test('approved public allowlist can read only explicitly included id',async()=>{
  const config={...env,VIBE_ENABLE_PUBLIC_MARKET_DATA:'true',VIBE_PUBLIC_DATA_RIGHTS_ACK:'APPROVED',VIBE_PUBLIC_INSTRUMENTS:'US:AAPL'};
  assert.equal((await invoke({config,req:{headers:{}}})).statusCode,200);
  assert.equal((await invoke({config,req:{headers:{},query:{...query,instrument:'US:MSFT'}}})).statusCode,403);
});
test('server credential and fixed destination only, no caller credentials forwarded',async()=>{
  let captured;const r=await invoke({fetcher:async(url,options)=>{captured={url,options};return Response.json(fixture());}});
  assert.equal(r.statusCode,200);assert.equal(captured.url,'https://private.example.invalid/v1/bars');
  assert.equal(captured.options.headers.Authorization,'Bearer '+bridgeToken);
  assert.equal(captured.options.redirect,'error');assert.equal(captured.options.headers['x-arena-key'],undefined);
  assert.equal(JSON.stringify(r.payload).includes(bridgeToken),false);
});
for(const url of ['http://private.example.invalid','http://127.0.0.1:8765','https://user:pass@example.invalid','https://example.invalid/?x=1','https://example.invalid/#secret'])
 test('production rejects unsafe bridge URL '+url,async()=>assert.equal((await invoke({config:{...env,VIBE_BRIDGE_URL:url}})).statusCode,503));
test('local nonproduction HTTP explicitly allowed',async()=>{
  assert.equal((await invoke({config:{...env,NODE_ENV:'development',VIBE_BRIDGE_URL:'http://127.0.0.1:8765'}})).statusCode,200);
});
test('unconfigured server token is not open',async()=>assert.equal((await invoke({config:{...env,VIBE_BRIDGE_TOKEN:''}})).statusCode,503));
test('network failures return generic error without endpoint/secret',async()=>{
  const r=await invoke({fetcher:async()=>{throw new Error('secret '+bridgeToken);}});
  assert.equal(r.statusCode,502);assert.equal(JSON.stringify(r.payload).includes(bridgeToken),false);
});
test('non-JSON is refused',async()=>assert.equal((await invoke({fetcher:async()=>new Response('<html/>')})).statusCode,502));
test('oversized response is refused',async()=>assert.equal((await invoke({fetcher:async()=>new Response('x'.repeat(1_048_577),{headers:{'content-type':'application/json'}})})).statusCode,502));
for(const status of [401,403,500,503]) test('upstream '+status+' returns unavailable',async()=>assert.equal((await invoke({fetcher:async()=>new Response('',{status})})).statusCode,503));
test('busy upstream is not reported as successful data',async()=>assert.equal((await invoke({fetcher:async()=>new Response('',{status:429})})).statusCode,429));
test('quota is bounded per warm instance',async()=>{
  let calls=0;const handler=createHandler({env,now:()=>NOW,fetchImpl:async()=>{calls++;return Response.json(fixture());}});
  for(let i=0;i<30;i++)assert.equal((await invoke({handler})).statusCode,200);
  assert.equal((await invoke({handler})).statusCode,429);assert.equal(calls,30);
});
test('valid series is accepted',()=>assert.equal(validateSeries(fixture(),'US:AAPL',parseQuery(query,NOW)),true));
for(const [name,mutate] of Object.entries({
  realtime:v=>v.provenance.is_realtime_quote=true,
  currency:v=>v.provenance.quote_currency='USDT',
  source:v=>v.provenance.source='stooq',
  fallback:v=>v.provenance.fallback_used=true,
  identity:v=>v.instrument.id='US:MSFT',
  market:v=>v.instrument.market='crypto_spot',
  nan:v=>v.bars[0].close=NaN,
  boolean:v=>v.bars[0].volume=true,
  badOHLC:v=>v.bars[0].low=200,
  duplicate:v=>v.bars.push({...v.bars[0]}),
  empty:v=>v.bars=[],
  sampled:v=>v.bars={data:v.bars,truncated:true},
  badTimestamp:v=>v.provenance.observed_at='not-a-time',
  lastDate:v=>v.provenance.last_bar_date='2026-01-03',
  outOfRange:v=>{v.bars[0].date='2026-01-10';v.provenance.last_bar_date='2026-01-10';},
})) test('series rejects '+name,()=>{
  const v=fixture();mutate(v);assert.equal(validateSeries(v,'US:AAPL',parseQuery(query,NOW)),false);
});
