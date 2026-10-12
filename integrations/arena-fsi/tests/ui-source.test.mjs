import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = await readFile(new URL('../ui/ArenaFsi.jsx', import.meta.url), 'utf8');
const helpers = source.match(/\/\* PURE_HELPERS_START[\s\S]*?\*\/([\s\S]*?)\/\* PURE_HELPERS_END \*\//)?.[1];
assert.ok(helpers, 'The pure helper block must remain available for executable contract checks.');
const ui = await import(`data:text/javascript;base64,${Buffer.from(helpers).toString('base64')}`);

test('missing and non-scalar financial values do not become zero', () => {
  for (const value of [null, undefined, '', false, true, [], {}, NaN, Infinity, 'unknown']) assert.equal(ui.numeric(value), null);
  assert.equal(ui.numeric(0), 0);
  assert.equal(ui.numeric('123.45'), 123.45);
  assert.ok(Math.abs(ui.quoteChange({price:120,previousClose:100}) - 20) < 1e-10);
  assert.equal(ui.quoteChange({price:120,previousClose:0}), null);
});

test('invalid status payloads never invent sample prices or accounts', () => {
  for (const value of [null, [], 'ok', {ok:true}]) assert.throws(() => ui.normalizeStatus(value), /INVALID_RESPONSE/);
  const empty = ui.normalizeStatus({mode:'live',capabilities:{market:{configured:false}}});
  assert.equal(empty.snapshot,null);
  assert.deepEqual(empty.portfolios,[]);
  assert.deepEqual(empty.runs,[]);
});

test('quote presentation distinguishes demo, stale, future, EOD and unverified sessions', () => {
  const now = Date.parse('2026-10-12T15:00:00Z');
  const fresh = {price:100,asOf:'2026-10-12T14:59:59Z',quality:'realtime'};
  assert.equal(ui.quoteQuality(fresh,{marketOpen:true,calendarStatus:'provider'},now),'realtime');
  assert.equal(ui.quoteQuality({...fresh,asOf:'2026-10-12T14:55:00Z'},{marketOpen:true},now),'stale');
  assert.equal(ui.quoteQuality({...fresh,asOf:'2026-10-12T15:01:00Z'},{marketOpen:true},now),'invalid');
  assert.equal(ui.quoteQuality({...fresh,quality:'eod'},{marketOpen:false,calendarStatus:'provider'},now),'eod');
  assert.equal(ui.quoteQuality(fresh,{marketOpen:false,calendarStatus:'unavailable'},now),'realtime');
  assert.equal(ui.quoteQuality(fresh,{marketOpen:false,calendarStatus:'provider'},now),'closed');
  assert.equal(ui.quoteQuality(fresh,{},now,'demo'),'demo');
  assert.equal(ui.quoteQuality({price:100},{},now),'unknown');
});

test('watchlist sorting keeps missing values last and does not mutate input', () => {
  const input = [{symbol:'MSFT',price:3},{symbol:'AAPL',price:null},{symbol:'MU',price:2}];
  assert.deepEqual(ui.filterQuotes(input,'','price','desc').map(x=>x.symbol),['MSFT','MU','AAPL']);
  assert.deepEqual(input.map(x=>x.symbol),['MSFT','AAPL','MU']);
  assert.deepEqual(ui.filterQuotes(input,'mu').map(x=>x.symbol),['MU']);
});

test('historical charts require actual timestamps and valid observations', () => {
  assert.equal(ui.historyGeometry([1,2,3]),null);
  assert.equal(ui.historyGeometry([{price:100}]),null);
  const graph=ui.historyGeometry([{asOf:'2026-10-01',close:100},{asOf:'2026-10-02',close:110},{asOf:'2026-10-02',close:110},{asOf:'2026-10-03',close:null}]);
  assert.equal(graph.count,2);
  assert.equal(graph.min,100);
  assert.equal(graph.max,110);
  assert.equal(graph.up,true);
  assert.match(graph.path,/^M.+ L/);
});

test('DCF form produces explicit actual shares, money units and three annual FCFF schedules', () => {
  const values={baseFreeCashFlow:'100',sharesOutstanding:'10',cash:'20',debt:'30',bearGrowthRate:'0',growthRate:'10',bullGrowthRate:'20',discountRate:'10',terminalGrowthRate:'2',years:'2',asOf:'2026-10-12'};
  const input=ui.buildDcfInput(values);
  assert.equal(input.units,'millions');
  assert.equal(input.shares.diluted,10000000);
  assert.equal(input.cash,20);
  assert.equal(input.debt,30);
  assert.deepEqual(input.scenarios.bear.fcff,[100,100]);
  assert.ok(Math.abs(input.scenarios.base.fcff[1]-121)<1e-9);
  assert.equal(input.scenarios.base.wacc,.1);
  assert.equal(input.scenarios.base.terminalGrowth,.02);
  assert.equal(input.asOf,'2026-10-12T00:00:00.000Z');
  assert.throws(()=>ui.buildDcfInput({...values,terminalGrowthRate:'10'}),/INVALID_DCF_INPUT/);
  assert.throws(()=>ui.buildDcfInput({...values,years:'2.5'}),/INVALID_DCF_INPUT/);
  assert.throws(()=>ui.buildDcfInput({...values,sharesOutstanding:'0'}),/INVALID_DCF_INPUT/);
});

test('API requests keep administrator credentials out of URLs and serialize paper idempotency', async () => {
  const captured=[];
  const fetcher=async (url,options)=>{captured.push({url,options});return {ok:true,status:200,json:async()=>({mode:'demo',portfolios:[]})};};
  await assert.rejects(()=>ui.requestApi('/api/arena-fsi','run',{method:'POST',fetcher}),/ADMIN_TOKEN_REQUIRED/);
  await assert.rejects(()=>ui.requestApi('https://example.com','status',{token:'private',fetcher}),/SAME_ORIGIN_REQUIRED/);
  await assert.rejects(()=>ui.requestApi('//example.com','status',{token:'private',fetcher}),/SAME_ORIGIN_REQUIRED/);
  await assert.rejects(()=>ui.requestApi('/api/arena-fsi','status',{query:{token:'private'},fetcher}),/CREDENTIAL_IN_QUERY/);
  await ui.requestApi('/api/arena-fsi','status',{token:'private',query:{mode:'live'},fetcher});
  await ui.requestApi('/api/arena-fsi','run',{method:'POST',token:'private',body:{mode:'demo',profiles:['S']},idempotencyKey:'request-0001',fetcher});
  assert.equal(captured.length,2);
  assert.equal(captured[0].options.headers.Authorization,'Bearer private');
  assert.equal(captured[0].url,'/api/arena-fsi?route=status&mode=live');
  assert.equal(captured[1].options.headers['Idempotency-Key'],'request-0001');
  assert.deepEqual(JSON.parse(captured[1].options.body),{mode:'demo',profiles:['S'],idempotencyKey:'request-0001'});
  assert.ok(captured.every(call=>!call.url.includes('private')));
});

test('business risk rejections remain structured results while transport errors stay explicit', async () => {
  const rejected={ok:false,status:'rejected',errors:[{code:'STALE_QUOTE'}]};
  const result=await ui.requestApi('/api/arena-fsi','order',{method:'POST',token:'token',body:{},fetcher:async()=>({ok:true,status:200,json:async()=>rejected})});
  assert.deepEqual(result,rejected);
  await assert.rejects(()=>ui.requestApi('/api/arena-fsi','status',{fetcher:async()=>({ok:false,status:404,json:async()=>({error:{code:'FEATURE_DISABLED'}})})}),/FEATURE_DISABLED/);
});

test('exports remove secrets but preserve measurable model token usage', () => {
  const source={token:'secret',OPENAI_API_KEY:'secret',usage:{inputTokens:120,outputTokens:30},nested:{adminToken:'secret',price:100}};
  assert.deepEqual(ui.exportSnapshot(source),{usage:{inputTokens:120,outputTokens:30},nested:{price:100}});
  assert.equal(ui.safeSourceUrl('javascript:alert(1)'),null);
  assert.equal(ui.safeSourceUrl('https://user:password@example.com'),null);
  assert.equal(ui.safeSourceUrl('https://www.sec.gov/Archives/edgar/data/1'),'https://www.sec.gov/Archives/edgar/data/1');
});

test('security and freshness wiring has no persisted token or automatic demo fallback', () => {
  assert.doesNotMatch(source,/localStorage|sessionStorage|dangerouslySetInnerHTML|document\.cookie/);
  assert.match(source,/visibilitychange/);
  assert.match(source,/setInterval\(sync,15000\)/);
  assert.match(source,/route === 'order'.+idempotencyKey/);
  assert.match(source,/query:\{mode\}/);
  assert.match(source,/quality === 'demo'\) !== \(historyMode === 'demo'/);
  const readBody=source.split('const refreshStatus = useCallback')[1].split('const loadDemo = async')[0];
  assert.doesNotMatch(readBody,/loadDemo\(|'demo',\{/);
});

test('React SSR compiles the whole UI and preserves explicit disconnected and demo states', async () => {
  const [{createServer},React,{renderToString}] = await Promise.all([import('vite'),import('react'),import('react-dom/server')]);
  const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,server:{middlewareMode:true},appType:'custom',logLevel:'error'});
  try {
    const {default:ArenaFsi}=await server.ssrLoadModule('/ui/ArenaFsi.jsx');
    const unavailable=renderToString(React.createElement(ArenaFsi,{locale:'zh',initialState:{mode:'live',capabilities:{market:{configured:false}},portfolios:[]}}));
    assert.match(unavailable,/行情尚未连接/);
    assert.match(unavailable,/载入演示/);
    assert.match(unavailable,/15 秒状态轮询/);
    assert.doesNotMatch(unavailable,/NVDA/);
    const demo=renderToString(React.createElement(ArenaFsi,{locale:'en',initialState:{mode:'demo',capabilities:{},snapshot:{id:'demo-test',asOf:'2026-10-12T15:00:00Z',marketOpen:true,calendarStatus:'demo',quotes:[{symbol:'NVDA',price:100,currency:'USD',quality:'demo',asOf:'2026-10-12T15:00:00Z'}]},portfolios:[]}}));
    assert.match(demo,/Demo environment/);
    assert.match(demo,/Deterministic rules run without real LLM calls/);
    assert.match(demo,/NVDA/);
    assert.match(demo,/>Demo</);
  } finally { await server.close(); }
});
