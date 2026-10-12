import { assert, fetchJSON, hash, symbol, ArenaError } from './common.mjs';
import { SECTORS } from './config.mjs';

const PRICES={AAPL:200,MSFT:400,NVDA:150,AMZN:210,GOOGL:180,META:560,TSLA:250,MU:125,AVGO:220,SPY:550,SMH:240};
export function demoSnapshot(symbols, now, tick=0) {
  const quotes=symbols.map((s,i)=>{
    const base=PRICES[s] || 100+i*7;
    const price=Math.round(base*(1+Math.sin((tick+i)/3)*.006)*100)/100;
    return {symbol:s,name:s,price,bid:price-.01,ask:price+.01,previousClose:base,changePct:(price/base-1)*100,
      asOf:now,receivedAt:now,source:'deterministic-demo-generator',quality:'demo',currency:'USD',sector:SECTORS[s] || 'Unclassified',feed:'synthetic',marketCoverage:'fictional',unit:'USD/share'};
  });
  const snapshot={asOf:now,receivedAt:now,quotes,marketOpen:true,calendarStatus:'demo',mode:'demo',tick};
  snapshot.id=hash(snapshot); snapshot.quotes.forEach(q=>q.snapshotId=snapshot.id); return snapshot;
}
export function quoteStatus(q, now, maxAge=90000) {
  if(!q || !Number.isFinite(q.price) || q.price<=0) return 'unavailable';
  const age=Date.parse(now)-Date.parse(q.asOf);
  if(!Number.isFinite(age) || age < 0) return 'unavailable';
  if(q.quality==='demo') return 'demo';
  if(q.quality==='unavailable') return 'unavailable';
  if(q.quality==='delayed' || q.quality==='eod') return q.quality;
  return age>maxAge ? 'stale' : q.quality;
}
export function quoteEvidence(snapshot) {
  return snapshot.quotes.filter(q=>Number.isFinite(q.price)).map(q=>({id:`quote:${snapshot.id}:${q.symbol}`,type:'market_quote',kind:'market_data',title:`${q.symbol} ${q.quality} quote`,symbol:q.symbol,
    source:q.source,url:snapshot.mode==='demo'?'https://example.invalid/arena-demo':`https://data.alpaca.markets/v2/stocks/${q.symbol}/snapshot`,
    asOf:q.asOf,publishedAt:q.asOf,receivedAt:q.receivedAt,retrievedAt:q.receivedAt,availableAt:q.receivedAt,currency:q.currency,unit:'USD/share',quality:q.quality,
    fact:{price:q.price,bid:q.bid,ask:q.ask,previousClose:q.previousClose},visibility:'public'}));
}
export class MarketProvider {
  constructor(config, env={}, fetcher=fetch, clock=()=>new Date().toISOString()) { this.config=config; this.env=env; this.fetcher=fetcher; this.clock=clock; }
  headers(){return {'APCA-API-KEY-ID':this.env.ALPACA_API_KEY,'APCA-API-SECRET-KEY':this.env.ALPACA_SECRET_KEY};}
  async snapshot(now) {
    assert(this.config.marketConfigured,'MARKET_NOT_CONFIGURED','Market data credentials are not configured',503);
    const symbols=this.config.watchlist;
    const data=await fetchJSON(`https://data.alpaca.markets/v2/stocks/snapshots?symbols=${encodeURIComponent(symbols.join(','))}&feed=${this.config.feed}`,{headers:this.headers(),fetcher:this.fetcher});
    const dataReceivedAt=this.clock();
    let clock=null;
    try {clock=await fetchJSON('https://paper-api.alpaca.markets/v2/clock',{headers:this.headers(),fetcher:this.fetcher});} catch { /* Missing authoritative session clock blocks fills, but not quote display. */ }
    const receivedAt=this.clock();
    const clockValid=clock && typeof clock.is_open==='boolean' && Number.isFinite(Date.parse(clock.timestamp)) && Math.abs(Date.parse(receivedAt)-Date.parse(clock.timestamp))<=120000;
    const quotes=symbols.map(s=>{
      const row=data[s], q=row?.latestQuote, bid=Number(q?.bp), ask=Number(q?.ap);
      const valid=Number.isFinite(bid)&&Number.isFinite(ask)&&bid>0&&ask>=bid&&Number.isFinite(Date.parse(q?.t));
      if(!valid) return {symbol:s,price:null,asOf:null,receivedAt:dataReceivedAt,source:`alpaca:${this.config.feed}`,quality:'unavailable',currency:'USD',sector:SECTORS[s]||'Unclassified',feed:this.config.feed};
      const price=(bid+ask)/2, previous=Number(row.prevDailyBar?.c);
      const quote={symbol:s,price,bid,ask,asOf:q.t,receivedAt:dataReceivedAt,source:`alpaca:${this.config.feed}`,quality:this.config.feed==='delayed_sip'?'delayed':'realtime',currency:'USD',sector:SECTORS[s]||'Unclassified',feed:this.config.feed,
        marketCoverage:this.config.feed==='iex'?'IEX single exchange':this.config.feed==='sip'?'US consolidated SIP':'15-minute delayed SIP',
        previousClose:Number.isFinite(previous)&&previous>0?previous:null,changePct:Number.isFinite(previous)&&previous>0?(price/previous-1)*100:null,unit:'USD/share'};
      quote.quality=quoteStatus(quote,dataReceivedAt);return quote;
    });
    const snapshot={mode:'live',asOf:dataReceivedAt,receivedAt,quotes,marketOpen:!!(clockValid&&clock.is_open),calendarStatus:clockValid?'provider':'unavailable',
      clock:clockValid?{asOf:clock.timestamp,nextOpen:clock.next_open,nextClose:clock.next_close}:null};
    snapshot.id=hash(snapshot);snapshot.quotes.forEach(q=>q.snapshotId=snapshot.id);return snapshot;
  }
  async history(ticker, now, days=180) {
    const s=symbol(ticker); assert(this.config.watchlist.includes(s),'SYMBOL_OUTSIDE_UNIVERSE');
    assert(this.config.marketConfigured,'MARKET_NOT_CONFIGURED','Market data credentials are not configured',503);
    // Exclude the current New York calendar date, even after close. Conservatively completed sessions only.
    const cutoff=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
    const start=new Date(Date.parse(now)-days*86400000).toISOString().slice(0,10);
    const url=`https://data.alpaca.markets/v2/stocks/${s}/bars?timeframe=1Day&start=${start}&end=${cutoff}T00:00:00Z&limit=1000&adjustment=all&feed=${this.config.feed}`;
    const raw=await fetchJSON(url,{headers:this.headers(),fetcher:this.fetcher});
    assert(!raw.next_page_token,'HISTORY_TRUNCATED','Historical response needs pagination; refusing a partial series',502);
    const bars=(raw.bars||[]).map(b=>({asOf:b.t,open:b.o,high:b.h,low:b.l,close:b.c,volume:b.v})).filter(b=>Number.isFinite(b.close)&&b.close>0&&Date.parse(b.asOf)<Date.parse(`${cutoff}T00:00:00Z`)).sort((a,b)=>a.asOf.localeCompare(b.asOf));
    return {symbol:s,bars,cutoff,asOf:now,quality:'eod',source:`alpaca:${this.config.feed}`,adjustment:'all',executionEligible:false};
  }
}

export function unavailableSnapshot(now, error=null) {
  return {id:null,asOf:null,receivedAt:now,mode:'live',quotes:[],marketOpen:false,calendarStatus:'unavailable',error:error?.code||error||'NOT_REFRESHED'};
}
