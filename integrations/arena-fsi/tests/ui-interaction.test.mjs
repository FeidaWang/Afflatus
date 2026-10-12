import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { ArenaService } from '../server/service.mjs';
import { StateStore, MemoryAdapter } from '../server/store.mjs';
import { createHandler } from '../server/http.mjs';

// Deliberately test-only: no environment credentials, network listeners or provider calls.
const TOKEN = 'ui-interaction-test-only-admin-token';
const ORIGIN = 'https://arena-ui.test';
const NOW = '2026-10-12T15:00:00.000Z';

test('mounted UI explicitly enters demo, authorizes and fills a paper order without polling loops or live mutations', {timeout:20000}, async () => {
  const [{JSDOM},{createServer}] = await Promise.all([import('jsdom'),import('vite')]);
  const dom = new JSDOM('<!doctype html><html lang="en"><body><div id="root"></div></body></html>', {
    url:`${ORIGIN}/arena.html`, pretendToBeVisual:true,
  });
  const env = {ARENA_MODE:'live',ARENA_ADMIN_TOKEN:TOKEN,ARENA_WATCHLIST:'AAPL,MSFT,SPY,SMH'};
  const service = new ArenaService({
    store:new StateStore(new MemoryAdapter()),env,clock:() => NOW,
    fetcher:async () => { throw new Error('This UI integration test must never contact an external provider.'); },
  });
  const handler = createHandler(service,env);
  const calls = [];
  const intervals = new Map();
  let nextInterval = 1, hidden = false, inFlight = 0;
  Object.defineProperty(dom.window.document,'hidden',{configurable:true,get:() => hidden});
  // Drive the actual UI polling callback deterministically; no 15-second sleep.
  dom.window.setInterval = (callback,milliseconds) => {
    const id = nextInterval++; intervals.set(id,{callback,milliseconds}); return id;
  };
  dom.window.clearInterval = id => intervals.delete(id);
  const sameOriginFetch = async (input,options = {}) => {
    const url = new URL(input,ORIGIN);
    assert.equal(url.origin,ORIGIN,'UI calls must stay on the configured origin.');
    assert.equal(url.pathname,'/api/arena-fsi');
    assert.ok(calls.length < 80,'A React effect produced an unbounded API request loop.');
    const request = new Request(url,options);
    if (request.method === 'POST') request.headers.set('Origin',ORIGIN);
    const call = {url:url.href,route:url.searchParams.get('route'),mode:url.searchParams.get('mode'),
      method:request.method,authorization:request.headers.get('Authorization'),
      idempotencyKey:request.headers.get('Idempotency-Key'),
      body:options.body ? JSON.parse(options.body) : null};
    calls.push(call);
    if (request.signal.aborted) throw new DOMException('Request aborted','AbortError');
    inFlight += 1;
    try {
      const response = await handler(request);
      call.status = response.status;
      call.result = await response.clone().json();
      if (request.signal.aborted) throw new DOMException('Request aborted','AbortError');
      return response;
    } finally { inFlight -= 1; }
  };
  const installedGlobals = {
    window:dom.window,document:dom.window.document,navigator:dom.window.navigator,
    HTMLElement:dom.window.HTMLElement,HTMLInputElement:dom.window.HTMLInputElement,
    Node:dom.window.Node,Event:dom.window.Event,MouseEvent:dom.window.MouseEvent,
    MutationObserver:dom.window.MutationObserver,
    getComputedStyle:dom.window.getComputedStyle.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT:true,fetch:sameOriginFetch,
  };
  const originals = new Map(Object.keys(installedGlobals).map(key => [key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for (const [key,value] of Object.entries(installedGlobals)) Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  let vite,root,act;
  try {
    // React DOM must load after the DOM globals so its native input event support is enabled.
    const [React,{createRoot}] = await Promise.all([import('react'),import('react-dom/client')]);
    act = React.act;
    vite = await createServer({
      root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,
      server:{middlewareMode:true,hmr:false,ws:false},appType:'custom',logLevel:'error',
    });
    const {default:ArenaFsi} = await vite.ssrLoadModule('/ui/ArenaFsi.jsx');
    const doc = dom.window.document;
    const flush = async () => {
      const deadline = Date.now() + 5000; let idle = 0;
      // WebCrypto and response streams complete asynchronously; wait for the actual service response,
      // not an assumed number of event-loop turns that becomes flaky during concurrent builds.
      while (idle < 2 && Date.now() < deadline) {
        await act(async () => {await delay(5);});
        idle = inFlight === 0 ? idle + 1 : 0;
      }
      assert.equal(inFlight,0,'The UI service requests should settle before state assertions.');
    };
    const button = (text,scope = doc) => {
      const match = [...scope.querySelectorAll('button')].find(item => item.textContent.trim() === text);
      assert.ok(match,`Expected a button labeled "${text}".`); return match;
    };
    const click = async element => {assert.ok(element);await act(async () => element.click());await flush();};
    const input = async (element,value) => {
      assert.ok(element,'Expected an input control.');
      await act(async () => {
        // Bypass the element's React value tracker, just as a native user input does.
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(element,value);
        element.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
      });
      await flush();
    };
    const statusCalls = () => calls.filter(call => call.route === 'status').length;
    const tick = async () => {
      assert.equal(intervals.size,1,'Exactly one status polling timer should remain active, including in StrictMode.');
      for (const interval of intervals.values()) {
        assert.equal(interval.milliseconds,15000);
        await act(async () => interval.callback());
      }
      await flush();
    };
    const quiet = async message => {
      const count = calls.length; await flush(); await act(async () => {await delay(20);}); await flush();
      assert.equal(calls.length,count,message);
    };
    root = createRoot(doc.getElementById('root'));
    await act(async () => root.render(React.createElement(React.StrictMode,null,React.createElement(ArenaFsi,{locale:'en'}))));
    await flush();

    assert.equal(doc.querySelector('.fsi-app').dataset.mode,'unconfigured');
    const initialDisconnectedBanner = doc.querySelector('.fsi-connection-banner').textContent;
    assert.equal(calls.some(call => call.route === 'demo'),false,'A disconnected page must not silently load demo data.');
    assert.equal(calls.some(call => call.method === 'POST'),false);
    assert.ok(calls.filter(call => call.route === 'status').every(call => call.mode === 'live'));
    await quiet('Rendering a status response must not trigger another status effect.');

    let before = statusCalls(); await tick();
    assert.equal(statusCalls(),before+1,'One scheduled poll makes one status request.');
    await quiet('Polling a new status must not create an effect loop.');
    hidden = true;
    await act(async () => doc.dispatchEvent(new dom.window.Event('visibilitychange')));
    before = statusCalls(); await tick();
    assert.equal(statusCalls(),before,'A hidden page must pause polling.');
    hidden = false;
    await act(async () => doc.dispatchEvent(new dom.window.Event('visibilitychange'))); await flush();
    assert.equal(statusCalls(),before+1,'Returning to a visible page reads status once.');

    await click(button('Load demo'));
    assert.equal(doc.querySelector('.fsi-app').dataset.mode,'demo');
    assert.match(doc.querySelector('.fsi-connection-banner').textContent,/Fictional data and simulated funds/);
    assert.match(doc.querySelector('.fsi-connection-banner').textContent,/Deterministic rules run without real LLM calls/);
    assert.equal(calls.filter(call => call.route === 'demo').length,1);
    assert.equal(calls.some(call => call.method === 'POST'),false,'Loading demo observations remains read-only.');
    assert.ok(calls.some(call => call.route === 'history' && call.mode === 'demo' && call.result?.executionEligible === false));
    assert.equal(button('Submit paper order').disabled,true,'Paper writes remain locked before a token is supplied.');
    const initialDemo = await service.status('demo');
    assert.equal(initialDemo.portfolios.find(item => item.id === 'S').valuation.cash,10000);

    await click(button('Connections'));
    await click(doc.querySelector('.fsi-admin summary'));
    await input(doc.querySelector('.fsi-admin input[type="password"]'),TOKEN);
    await act(async () => {await delay(390);}); await flush();
    assert.equal(button('Fetch new market snapshot').disabled,false);
    assert.ok(calls.some(call => call.route === 'status' && call.mode === 'demo' && call.authorization === `Bearer ${TOKEN}`));
    await quiet('Stabilizing the GET authorization token must not create a refresh loop.');
    before = statusCalls(); await tick();
    assert.equal(statusCalls(),before+1);
    assert.equal(calls.filter(call => call.route === 'status').at(-1).authorization,`Bearer ${TOKEN}`);

    await click(button('Market & paper accounts'));
    assert.ok(calls.some(call => call.route === 'history' && call.mode === 'demo' && call.authorization === `Bearer ${TOKEN}`));
    const orderForm = doc.querySelector('.fsi-order-form');
    await input(orderForm.querySelector('input[type="number"]'),'2');
    assert.equal(button('Submit paper order',orderForm).disabled,false);
    await click(button('Submit paper order',orderForm));

    const orders = calls.filter(call => call.route === 'order');
    assert.equal(orders.length,1,'A single user submission must create one order request.');
    assert.equal(orders[0].method,'POST');
    assert.equal(orders[0].authorization,`Bearer ${TOKEN}`);
    assert.equal(orders[0].body.mode,'demo');
    assert.equal(orders[0].body.ledgerId,'S');
    assert.equal(orders[0].body.order.symbol,'AAPL');
    assert.equal(orders[0].body.order.quantity,2);
    assert.equal(orders[0].body.order.type,'market');
    assert.ok(orders[0].idempotencyKey?.length >= 8);
    assert.equal(orders[0].body.order.idempotencyKey,orders[0].idempotencyKey);
    assert.equal(orders[0].status,200);
    assert.equal(orders[0].result.status,'filled',JSON.stringify(orders[0].result));
    const state = await service.read('demo');
    const ledger = state.ledgers.S;
    assert.equal(ledger.positions.AAPL.quantity,2);
    assert.equal(ledger.fills.length,1);
    assert.ok(ledger.cash < 10000);
    const latest = await service.status('demo');
    const valuation = latest.portfolios.find(item => item.id === 'S').valuation;
    const card = [...doc.querySelectorAll('.fsi-portfolio')].find(item => item.querySelector('h3').textContent.startsWith('S ·'));
    assert.ok(card,'The S portfolio card should be displayed after the order.');
    const cashRow = [...card.querySelectorAll('.fsi-account-metrics > div')].find(item => item.querySelector('dt').textContent === 'Cash');
    assert.equal(cashRow.querySelector('dd').textContent,new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(valuation.cash));
    const position = card.querySelector('.fsi-positions tbody tr');
    assert.equal(position.querySelector('th').textContent,'AAPL');
    assert.equal(position.querySelector('td').textContent,'2');
    assert.match(doc.querySelector('[role="status"]').textContent,/ledger and status were reloaded/);
    await quiet('Refreshing the ledger after a write must not create another write or polling loop.');

    await click(button('Return to connected data'));
    assert.equal(doc.querySelector('.fsi-app').dataset.mode,'unconfigured');
    assert.equal(doc.querySelector('.fsi-positions tbody'),null,'Demo positions must disappear on return to live.');
    const live = await service.read('live');
    assert.equal(live.ledgers.S.cash,10000);
    assert.equal(live.ledgers.S.fills.length,0);
    assert.equal(Object.keys(live.ledgers.S.positions).length,0);
    assert.ok(calls.filter(call => call.method === 'POST').every(call => call.body.mode === 'demo'));
    assert.ok(calls.every(call => !call.url.includes(TOKEN)),'Credentials must never appear in request URLs.');
    assert.equal(dom.window.localStorage.length,0);
    assert.equal(dom.window.sessionStorage.length,0);
    assert.equal(doc.cookie,'');
    await quiet('Returning from demo must settle into stable live status polling.');
    assert.match(initialDisconnectedBanner,/Market data is not connected/,'Redaction must not claim that an unconfigured provider is connected.');
  } finally {
    if (root && act) await act(async () => root.unmount());
    if (vite) await vite.close();
    dom.window.close();
    for (const [key,descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis,key,descriptor); else delete globalThis[key];
    }
  }
});
