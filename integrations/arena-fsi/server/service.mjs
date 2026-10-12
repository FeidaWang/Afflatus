import { randomUUID } from 'node:crypto';
import { ArenaError, assert, clone, hash, record, symbol } from './common.mjs';
import { configuration } from './config.mjs';
import { initialState } from './state.mjs';
import { MarketProvider, demoSnapshot, quoteStatus, quoteEvidence } from './market.mjs';
import { AIProvider, frozenContext, demoAnalysis } from './ai.mjs';
import { connectorStatus } from './connectors.mjs';
import { submitOrder, processPendingOrders, cancelOrder, setTradingPaused, markToMarket, applyCorporateAction, verifyAuditChain } from '../src/core/paper-engine.mjs';
import { calculatePerformance, compareWithBenchmark } from '../src/core/metrics.mjs';
import * as research from '../src/research/index.mjs';

function quoteMap(snapshot) {return Object.fromEntries((snapshot.quotes||[]).map(q=>[q.symbol,q]));}
function errorCode(error) {return {code:error.code||'INTERNAL_ERROR',message:error.code?error.message:'Operation failed; inspect server logs by request ID'};}
function cleanKey(value) {assert(typeof value==='string'&&/^[\w:.-]{8,128}$/.test(value),'INVALID_IDEMPOTENCY_KEY');return value;}
function appendEvent(state,type,data,now){
  const previousHash=state.audit.at(-1)?.hash||'0'.repeat(64), sequence=state.audit.length+1;
  const entry={sequence,type,at:now,data,previousHash};entry.hash=hash(entry);state.audit.push(entry);
}
function valueOf(ledger,snapshot,now,mode){
  const v=markToMarket(ledger,quoteMap(snapshot),{now,allowDemo:mode==='demo',marketOpen:snapshot.marketOpen,quotes:quoteMap(snapshot)});
  const positions=Array.isArray(v.positions)?v.positions:Object.entries(v.positions||ledger.positions||{}).map(([s,p])=>({symbol:s,...p}));
  return {...v,positions,cash:v.cash??ledger.cash,equity:v.equity??v.nav??null,
    realizedPnl:v.realizedPnl??ledger.realizedPnl??0,fees:v.fees??ledger.feesPaid??ledger.totalFees??0};
}
function recordNav(state,now){
  for(const [id,l] of Object.entries(state.ledgers)){
    const v=valueOf(l,state.snapshot,now,state.mode);
    if(Number.isFinite(v.equity) && v.equity>0 && v.complete!==false && v.fresh!==false){
      const point={asOf:now,nav:v.equity,externalFlow:0,quality:state.mode==='demo'?'demo':'observed'};
      if(state.nav[id].at(-1)?.asOf===now)state.nav[id][state.nav[id].length-1]=point;else state.nav[id].push(point);
    }
  }
  for(const s of ['SPY','SMH']){
    const q=state.snapshot.quotes.find(q=>q.symbol===s);
    if(q&&Number.isFinite(q.price)&&['realtime','demo'].includes(quoteStatus(q,now))&&state.benchmarks[s].at(-1)?.asOf!==now)state.benchmarks[s].push({asOf:now,nav:q.price});
  }
}

export class ArenaService {
  constructor({store,env={},fetcher=fetch,clock=()=>new Date().toISOString(),aiProvider,marketProvider}) {
    this.store=store;this.env=env;this.config=configuration(env);this.clock=clock;
    this.market=marketProvider||new MarketProvider(this.config,env,fetcher,this.clock);
    this.ai=aiProvider||new AIProvider(this.config,env,fetcher);
  }
  mode(requested){const mode=requested||this.config.mode;assert(['demo','live'].includes(mode),'INVALID_MODE');return mode;}
  key(mode){return `arena:fsi:v1:${mode}`;}
  factory(mode,now){return ()=>initialState(this.config,mode,now);}
  async read(mode,now=this.clock()){return (await this.store.read(this.key(mode)))?.document||initialState(this.config,mode,now);}
  async update(mode,mutator,now=this.clock()){return this.store.update(this.key(mode),this.factory(mode,now),mutator);}
  executionContext(state,now){return {now,allowDemo:state.mode==='demo',marketOpen:state.snapshot.marketOpen&&['provider','demo'].includes(state.snapshot.calendarStatus),quotes:quoteMap(state.snapshot)};}
  async health(){
    try{await this.store.read(this.key(this.config.mode));}catch{throw new ArenaError('DATABASE_UNAVAILABLE','The ledger database or migration is unavailable',503);}
    const persistent=!!this.store.persistent;
    const configured={admin:!!(this.env.ARENA_ADMIN_TOKEN?.length>=24),market:this.config.marketConfigured,ai:this.config.profiles.every(p=>p.configured),publicDisplay:this.config.publicQuotes};
    return {ok:true,version:'1.0.0',mode:this.config.mode,persistent,databaseReachable:true,configured,
      readyForPublicArena:this.config.mode==='live'&&persistent&&Object.values(configured).every(Boolean)};
  }
  async ensureFreshMarket(mode){
    if(mode!=='live'||!this.config.marketConfigured||!this.store.persistent)return;
    const now=this.clock(),leaseId=randomUUID();
    const acquired=await this.update(mode,state=>{
      const recent=state.snapshot.id&&Date.parse(now)-Date.parse(state.snapshot.receivedAt)<15000;
      if(recent||(state.marketRefreshLease&&Date.parse(state.marketRefreshLease.expiresAt)>Date.parse(now)))return false;
      state.marketRefreshLease={id:leaseId,expiresAt:new Date(Date.parse(now)+45000).toISOString()};return true;
    },now);
    if(!acquired.result)return;
    try{
      const snapshot=await this.market.snapshot(this.clock());
      await this.update(mode,state=>{
        if(state.marketRefreshLease?.id!==leaseId)return null;
        if(!state.snapshot.id||Date.parse(snapshot.receivedAt)>=Date.parse(state.snapshot.receivedAt))state.snapshot=snapshot;
        state.marketRefreshLease=null;state.lastError=null;return null;
      });
    }catch(error){
      const failedAt=this.clock();
      await this.update(mode,state=>{
        if(state.marketRefreshLease?.id===leaseId)state.marketRefreshLease.expiresAt=new Date(Date.parse(failedAt)+60000).toISOString();
        state.lastError=errorCode(error);return null;
      },failedAt);
    }
    // A public quote refresh never submits or matches orders.
  }
  async status(requested,{admin=false}={}) {
    const now=this.clock(),mode=this.mode(requested),state=await this.read(mode,now);
    const maySeeQuotes=mode==='demo'||admin||this.config.publicQuotes;
    const snapshot=clone(state.snapshot);snapshot.quotes=snapshot.quotes.map(q=>({...q,quality:quoteStatus(q,now)}));
    if(!maySeeQuotes){snapshot.quotes=[];snapshot.redacted=true;}
    const portfolios=this.config.profiles.map(p=>{
      const ledger=state.ledgers[p.id],valuation=valueOf(ledger,state.snapshot,now,mode);
      const initial=ledger.initialCash||this.config.initialCash;
      valuation.totalReturn=Number.isFinite(valuation.equity)?valuation.equity/initial-1:null;
      return {id:p.id,label:p.label,model:mode==='demo'?'demo-rules-v1':p.model||'Not configured',provider:mode==='demo'?'deterministic-demo':p.provider,
        paused:!!(ledger.paused||ledger.tradingPaused),valuation,metrics:calculatePerformance(state.nav[p.id]),
        benchmark:compareWithBenchmark(state.nav[p.id],state.benchmarks.SPY),
        pendingOrders:Object.values(ledger.orders||{}).filter(o=>o.status==='pending'),fills:(ledger.fills||[]).slice(-15)};
    });
    let calibration={status:'insufficient',sampleCount:0};
    if(research.calibrateForecasts)calibration=research.calibrateForecasts(this.calibrationSamples(state),{asOf:now});
    return {schemaVersion:1,mode,serverTime:now,capabilities:{
      market:{provider:'Alpaca',configured:this.config.marketConfigured,feed:this.config.feed,publicDisplayEnabled:this.config.publicQuotes,pollIntervalMs:15000},
      ai:{configured:this.config.profiles.every(p=>p.configured),profiles:this.config.profiles},storage:{persistent:!!this.store.persistent},
      legacy:{research:'Existing Vibe research remains independently gated; observed FEATURE_DISABLED on 2026-10-12'},
      adminConfigured:!!(this.env.ARENA_ADMIN_TOKEN?.length>=24),autorun:this.config.autorun
    },snapshot,portfolios:maySeeQuotes?portfolios:portfolios.map(p=>({...p,valuation:{...p.valuation,positions:[]},fills:[],pendingOrders:[]})),
    runs:maySeeQuotes?state.runs.slice(-20).reverse():state.runs.slice(-20).reverse().map(r=>({id:r.id,status:r.status,createdAt:r.createdAt,completedAt:r.completedAt})),
    feedback:{...calibration,unresolved:state.forecasts.filter(f=>f.resolvedAt===null&&!f.expiredAt&&!f.invalidatedAt).length,
      expired:state.forecasts.filter(f=>f.expiredAt).length,invalidated:state.forecasts.filter(f=>f.invalidatedAt).length,changesApplied:false},
    research:{theses:maySeeQuotes?state.theses:[],catalysts:maySeeQuotes?state.catalysts:[],brief:maySeeQuotes?state.brief:null,evidence:maySeeQuotes?state.evidence:[],artifacts:maySeeQuotes?(state.artifacts||[]):[]},
    connectors:connectorStatus(),audit:{events:state.audit.length,headHash:state.audit.at(-1)?.hash||null},lastError:state.lastError||null};
  }
  async refresh(requested){
    let now=this.clock();const mode=this.mode(requested);let snapshot;
    const before=await this.read(mode,now);
    try{snapshot=mode==='demo'?demoSnapshot(this.config.watchlist,now,before.tick+1):await this.market.snapshot(now);}
    catch(error){
      await this.update(mode,state=>{state.lastError=errorCode(error);appendEvent(state,'market-refresh-failed',{code:error.code||'NETWORK_ERROR'},now);return null;},now);
      throw error;
    }
    now=this.clock();
    await this.update(mode,async state=>{
      if(state.snapshot.receivedAt && Date.parse(snapshot.receivedAt)<Date.parse(state.snapshot.receivedAt))return {ignored:'OLDER_SNAPSHOT'};
      state.snapshot=snapshot;state.tick++;state.updatedAt=now;state.lastError=null;
      for(const ledger of Object.values(state.ledgers))await processPendingOrders(ledger,quoteMap(snapshot),this.executionContext(state,now));
      recordNav(state,now);appendEvent(state,'market-refresh',{snapshotId:snapshot.id,quotes:snapshot.quotes.length,calendarStatus:snapshot.calendarStatus},now);return null;
    },now);
    return this.status(mode,{admin:true});
  }
  async placeOrder(body){
    const now=this.clock(),mode=this.mode(body.mode);const id=body.ledgerId||'S';
    const order=record(body.order,'order');cleanKey(order.idempotencyKey);
    assert(this.config.watchlist.includes(symbol(order.symbol)),'SYMBOL_OUTSIDE_UNIVERSE');
    const result=await this.update(mode,async state=>{
      const ledger=state.ledgers[id];assert(ledger,'INVALID_LEDGER');
      const operationKey=`order:${id}:${order.idempotencyKey}`,inputHash=hash(order);
      const existing=state.operations[operationKey];
      if(existing){assert(existing.inputHash===inputHash,'IDEMPOTENCY_CONFLICT','Same key with different order inputs',409);return {...existing.output,replayed:true};}
      if(order.snapshotId)assert(order.snapshotId===state.snapshot.id,'SNAPSHOT_CHANGED','The requested snapshot is no longer current',409);
      const payload={...order,snapshotId:state.snapshot.id,strategyId:'manual-paper-v1'};
      const q=quoteMap(state.snapshot)[symbol(order.symbol)];
      const out=await submitOrder(ledger,payload,q,this.executionContext(state,now));
      state.operations[operationKey]={inputHash,output:out};recordNav(state,now);return out;
    },now);return result.result;
  }
  async pause(body){const now=this.clock(),mode=this.mode(body.mode);return (await this.update(mode,async state=>{
    const ledger=state.ledgers[body.ledgerId];assert(ledger,'INVALID_LEDGER');assert(typeof body.paused==='boolean','INVALID_PAUSE');
    return setTradingPaused(ledger,body.paused,this.executionContext(state,now));
  },now)).result;}
  async cancel(body){const now=this.clock(),mode=this.mode(body.mode);return (await this.update(mode,async state=>{
    const ledger=state.ledgers[body.ledgerId];assert(ledger,'INVALID_LEDGER');return cancelOrder(ledger,body.orderId,this.executionContext(state,now));
  },now)).result;}
  async run(body){
    let now=this.clock();const mode=this.mode(body.mode),key=cleanKey(body.idempotencyKey);
    const profiles=body.profiles||['S','P','T'];assert(Array.isArray(profiles)&&profiles.length>0&&profiles.length<=3&&new Set(profiles).size===profiles.length&&profiles.every(id=>this.config.profiles.some(p=>p.id===id)),'INVALID_PROFILES');
    const requestHash=hash({mode,profiles});
    const prior=(await this.read(mode,now)).runs.find(r=>r.id===key);
    if(prior){assert(prior.requestHash===requestHash,'IDEMPOTENCY_CONFLICT','Same key with different run inputs',409);return {...prior,replayed:true};}
    // Fetch prices before reserving the immutable run; network I/O never executes inside a retried transaction.
    await this.refresh(mode);now=this.clock();
    const reserved=await this.update(mode,state=>{
      const existing=state.runs.find(r=>r.id===key);
      if(existing){assert(existing.requestHash===requestHash,'IDEMPOTENCY_CONFLICT',undefined,409);return {existing};}
      if(state.activeRun&&Date.parse(state.activeRun.expiresAt)>Date.parse(now))throw new ArenaError('RUN_IN_PROGRESS','Another run owns the writer lease',409);
      if(state.activeRun){const abandoned=state.runs.find(r=>r.id===state.activeRun.id);if(abandoned&&abandoned.status==='running')abandoned.status='interrupted';}
      if(state.runBudget.date!==now.slice(0,10))state.runBudget={date:now.slice(0,10),count:0};
      assert(state.runBudget.count<this.config.maxRunsPerDay,'DAILY_RUN_BUDGET','Daily research run budget reached',429);state.runBudget.count++;
      assert(state.runs.length<1500,'SEASON_CAPACITY','Export and archive this season before adding more runs',507);
      const run={id:key,requestHash,mode,createdAt:now,status:'running',snapshotId:state.snapshot.id,version:'fsi-research-v1',profiles,results:[]};
      const contexts=profiles.map(id=>({id,context:frozenContext(state.snapshot,valueOf(state.ledgers[id],state.snapshot,now,mode),{evidence:state.evidence,theses:state.theses,catalysts:state.catalysts,artifacts:state.artifacts},now)}));
      const shared=contexts[0].context;
      run.frozen={schemaVersion:shared.schemaVersion,cutoff:shared.cutoff,snapshot:shared.snapshot,evidence:shared.evidence,research:shared.research,
        portfolios:contexts.map(({id,context})=>({id,portfolio:context.portfolio,contextHash:context.hash}))};
      state.runs.push(run);state.activeRun={id:key,expiresAt:new Date(Date.parse(now)+600000).toISOString()};
      appendEvent(state,'run-start',{runId:key,snapshotId:run.snapshotId,profiles},now);
      return {contexts};
    },now);
    if(reserved.result.existing)return {...reserved.result.existing,replayed:true};
    const analysis=await Promise.all(reserved.result.contexts.map(async ({id,context})=>{
      const profile=this.config.profiles.find(p=>p.id===id);
      try{
        const analyst=mode==='demo'?demoAnalysis(profile,context):await this.ai.analyze(profile,context);
        const critic=mode==='demo'?{value:{approved:true,reasons:['Demo-only structural example; hard risk checks still apply.'],sourceIds:analyst.value.sourceIds},provider:'deterministic-demo',model:'demo-critic-v1',usage:{}}:await this.ai.critique(profile,context,analyst.value);
        return {id,contextHash:context.hash,evidence:context.evidence,analyst,critic};
      }catch(error){return {id,contextHash:context.hash,error:errorCode(error)};}
    }));
    const decisionAt=this.clock();let finishedAt=decisionAt;
    // Fresh, independent execution marks must postdate the frozen signal. They do not change its evidence.
    let executionError=null;
    try{await this.refresh(mode);}catch(error){executionError=errorCode(error);}
    finishedAt=this.clock();
    const committed=await this.update(mode,async state=>{
      const run=state.runs.find(r=>r.id===key);assert(run,'RUN_NOT_FOUND',undefined,409);
      if(run.status!=='running')return {...run,replayed:true};
      assert(state.activeRun?.id===key&&Date.parse(state.activeRun.expiresAt)>=Date.parse(finishedAt),'RUN_LEASE_EXPIRED','Run lease expired before execution',409);
      for(const result of analysis){
        const trace={profileId:result.id,contextHash:result.contextHash,steps:[],error:result.error||null};
        if(result.error){trace.status='held';trace.steps.push({stage:'analyst',status:'error',detail:result.error.code});run.results.push(trace);continue;}
        const intent=result.analyst.value;trace.intent=intent;trace.model=result.analyst.model;trace.provider=result.analyst.provider;
        trace.usage={analyst:result.analyst.usage,critic:result.critic.usage};
        trace.steps.push({stage:'analyst',status:'completed',detail:intent.rationale},{stage:'critic',status:result.critic.value.approved?'approved':'rejected',detail:result.critic.value.reasons.join(' ')});
        if(intent.action==='hold'||!result.critic.value.approved||executionError){trace.status='held';trace.steps.push({stage:'risk',status:'held',detail:executionError?.code||'NO_APPROVED_INTENT'});}
        else {
          const q=quoteMap(state.snapshot)[intent.symbol];
          const order={symbol:intent.symbol,side:intent.action,type:'market',quantity:intent.quantity,idempotencyKey:`run-${hash({key,profile:result.id})}`,strategyId:`${result.id}:fsi-research-v1`,decisionId:`${key}:${result.id}`,snapshotId:state.snapshot.id,
            decisionAsOf:run.createdAt,evidence:result.evidence.filter(e=>intent.sourceIds.includes(e.id)).map(e=>({id:e.id,source:e.source||e.title,asOf:e.asOf||e.publishedAt||e.availableAt,url:e.url}))};
          const output=Date.parse(q?.asOf)>=Date.parse(decisionAt)
            ?await submitOrder(state.ledgers[result.id],order,q,this.executionContext(state,finishedAt))
            :{ok:false,status:'rejected',errors:[{code:'NO_POST_SIGNAL_QUOTE',message:'Execution requires a quote at or after completed analysis'}]};
          trace.execution=output;trace.status=output.ok?'completed':'rejected';
          trace.steps.push({stage:'risk',status:output.ok?'approved':'rejected',detail:JSON.stringify(output.errors||[])},{stage:'fill',status:output.status,orderId:output.orderId});
        }
        const entry=result.evidence.find(e=>e.symbol===intent.symbol&&e.type==='market_quote');
        if(entry?.fact?.price>0)state.forecasts.push({id:`forecast-${hash({key,profile:result.id})}`,runId:key,profileId:result.id,model:result.analyst.model,strategyVersion:run.version,symbol:intent.symbol,predictedAt:run.createdAt,
          horizonAt:new Date(Date.parse(run.createdAt)+intent.horizonHours*3600000).toISOString(),probability:intent.confidence,entryPrice:entry.fact.price,
          snapshotId:run.snapshotId,quality:mode==='demo'?'demo':entry.quality,resolvedAt:null,outcome:null});
        run.results.push(trace);
      }
      run.status=executionError?'completed-with-data-error':'completed';run.completedAt=finishedAt;run.decisionAt=decisionAt;run.executionSnapshotId=state.snapshot.id;
      state.activeRun=null;recordNav(state,finishedAt);appendEvent(state,'run-complete',{runId:key,status:run.status,resultHash:hash(run.results)},finishedAt);return run;
    },finishedAt);
    return committed.result;
  }
  calibrationSamples(state){return state.forecasts.filter(f=>!f.invalidatedAt).map(f=>({...f,modelId:f.profileId,modelVersion:`${f.model.slice(0,60)}:${f.strategyVersion}:${hash(f.model).slice(0,16)}`,
    cohort:`${state.mode}:positive-price-return:${f.quality}:${(Date.parse(f.horizonAt)-Date.parse(f.predictedAt))/3600000}h`,
    createdAt:f.predictedAt,featureSnapshotAt:f.predictedAt,outcomeAvailableAt:f.resolvedAt||undefined}));}
  async settle(requested,{refresh=true}={}){
    const mode=this.mode(requested);if(refresh)await this.refresh(mode);const now=this.clock();
    return (await this.update(mode,state=>{
      let count=0;
      for(const f of state.forecasts){
        if(f.resolvedAt!==null||f.expiredAt||f.invalidatedAt||Date.parse(f.horizonAt)>Date.parse(now))continue;
        const q=quoteMap(state.snapshot)[f.symbol];
        // No opportunistic horizon substitution: at most 5 minutes late; other forecasts expire without a scored outcome.
        if(Date.parse(now)-Date.parse(f.horizonAt)>300000){f.expiredAt=now;continue;}
        if(!q||!['realtime','demo'].includes(quoteStatus(q,now))||Date.parse(q.asOf)<Date.parse(f.horizonAt))continue;
        if((f.quality==='demo')!==(q.quality==='demo'))continue;
        f.exitPrice=q.price;f.return=q.price/f.entryPrice-1;f.outcome=f.return>0?1:0;f.resolvedAt=now;f.resolutionSnapshotId=state.snapshot.id;count++;
      }
      appendEvent(state,'forecast-settlement',{count},now);return {settled:count,feedback:research.calibrateForecasts(this.calibrationSamples(state),{asOf:now}),changesApplied:false};
    },now)).result;
  }
  async history(ticker,requested){
    const now=this.clock(),mode=this.mode(requested),s=symbol(ticker);assert(this.config.watchlist.includes(s),'SYMBOL_OUTSIDE_UNIVERSE');
    if(mode==='demo'){
      const state=await this.read(mode,now),q=quoteMap(state.snapshot)[s];
      return {symbol:s,asOf:now,source:'deterministic-demo-generator',quality:'demo',executionEligible:false,bars:Array.from({length:80},(_,i)=>{
        const close=q.price*(.96+.0005*i+.012*Math.sin(i/5));const date=new Date(Date.parse(now)-(81-i)*86400000).toISOString();
        return {asOf:date,open:close*.998,high:close*1.008,low:close*.992,close,volume:1000000+i*1000};
      })};
    }
    const cached=(await this.read(mode,now)).history[s];if(cached&&Date.parse(now)-Date.parse(cached.asOf)<3600000)return cached;
    const history=await this.market.history(s,now);
    await this.update(mode,state=>{state.history[s]=history;return null;},now);return history;
  }
  async research(body){
    const now=this.clock(),mode=this.mode(body.mode),input=body.input||{};let result;
    if(body.kind==='dcf')result=research.calculateDCF(input);
    else if(body.kind==='wacc')result=research.calculateWACC(input);
    else if(body.kind==='comps')result=research.compareCompanies(Array.isArray(input)?input:input.peers);
    else if(body.kind==='earnings')result=research.analyzeEarnings(input);
    else if(body.kind==='brief'){
      const state=await this.read(mode,now);const marketEvidence=quoteEvidence(state.snapshot);
      result=research.buildMorningBrief({...input,asOf:now,snapshotAt:now,sources:[...marketEvidence,...state.evidence],theses:state.theses,
        quotes:state.snapshot.quotes.filter(q=>Number.isFinite(q.price)).map(q=>({...q,sourceId:`quote:${state.snapshot.id}:${q.symbol}`,mode:q.quality==='demo'?'demo':q.quality==='realtime'?'live':q.quality==='delayed'?'delayed':'cached',
          session:state.snapshot.marketOpen?'regular':'closed',changePct:q.changePct===null?null:q.changePct/100})),
        catalysts:state.catalysts.map(e=>({...e,availableAt:e.createdAt,scheduledAt:e.expectedAt}))});
      await this.update(mode,state=>{state.brief=result;appendEvent(state,'brief-published',{hash:hash(result)},now);return null;},now);
    }else if(body.kind==='evidence'){
      result=research.validateEvidence(input.sources,{asOf:now});assert(result.valid,'INVALID_EVIDENCE',JSON.stringify(result.errors));
      if(mode==='live')assert(!result.accepted.some(e=>e.synthetic===true||(e.url&&/(^|\.)example\.invalid$/.test(new URL(e.url).hostname))),'DEMO_DATA_REJECTED','Explicitly synthetic evidence belongs only in demo mode');
      const entries=result.accepted.map(e=>({...e,visibility:'public',receivedAt:now}));
      assert(input.visibility==='public','PUBLIC_EVIDENCE_ONLY','Only explicitly public research may enter this public simulation');
      await this.update(mode,state=>{assert(state.evidence.length+entries.length<=200,'EVIDENCE_CAPACITY');for(const e of entries){assert(!state.evidence.some(x=>x.id===e.id),'DUPLICATE_SOURCE_ID');state.evidence.push(e);}appendEvent(state,'evidence-import',{sourceIds:entries.map(e=>e.id)},now);return null;},now);
    }else if(body.kind==='validate')result=research.validateResearch(input,{asOf:now});
    else throw new ArenaError('UNKNOWN_RESEARCH_KIND');
    let artifact=null;
    if(body.visibility==='public'&&['dcf','wacc','comps','earnings'].includes(body.kind)){
      const artifactSymbol=symbol(body.symbol);assert(this.config.watchlist.includes(artifactSymbol),'SYMBOL_OUTSIDE_UNIVERSE');
      const ids=body.sourceIds;assert(Array.isArray(ids)&&ids.length>0&&ids.length<=20,'MISSING_EVIDENCE','Publishing a calculation requires sourceIds from imported public evidence');
      artifact={id:`calculation-${hash({kind:body.kind,symbol:artifactSymbol,input,sourceIds:ids})}`,kind:body.kind,symbol:artifactSymbol,availableAt:now,visibility:'public',
        inputOrigin:'administrator-supplied assumptions',input:clone(input),sourceIds:ids,result};
      await this.update(mode,state=>{
        assert(ids.every(id=>state.evidence.some(e=>e.id===id)),'UNKNOWN_EVIDENCE');state.artifacts||=[];
        if(!state.artifacts.some(a=>a.id===artifact.id)){assert(state.artifacts.length<50,'ARTIFACT_CAPACITY');state.artifacts.push(artifact);appendEvent(state,'calculation-published',{id:artifact.id,kind:artifact.kind,sourceIds:ids},now);}
        return null;
      },now);
    }
    return {result,mode,asOf:now,...(artifact?{artifact}:{})};
  }
  async thesis(body){
    const now=this.clock(),mode=this.mode(body.mode);
    return (await this.update(mode,state=>{
      let result;
      if(body.operation==='create'){
        const input=record(body.thesis||body.input);assert(this.config.watchlist.includes(symbol(input.symbol)),'SYMBOL_OUTSIDE_UNIVERSE');
        if(input.createdAt)assert(Date.parse(input.createdAt)<=Date.parse(now),'FUTURE_THESIS');
        result=research.createThesis({...input,createdAt:now});
        assert(!state.theses.some(t=>t.id===result.id),'DUPLICATE_THESIS');state.theses.push(result);
      }else{
        const index=state.theses.findIndex(t=>t.id===body.id);assert(index>=0,'THESIS_NOT_FOUND',undefined,404);
        const update=record(body.update||body.input);
        if(update.sourceIds)assert(update.sourceIds.every(id=>state.evidence.some(e=>e.id===id)),'UNKNOWN_EVIDENCE');
        result=research.updateThesis(state.theses[index],{...update,at:update.at||now},{asOf:now});state.theses[index]=result;
      }
      appendEvent(state,'thesis-change',{id:result.id,hash:hash(result)},now);return {result};
    },now)).result;
  }
  async catalyst(body){
    const now=this.clock(),mode=this.mode(body.mode);
    return (await this.update(mode,state=>{
      if(body.operation==='create'){
        const e=record(body.event);symbol(e.symbol);assert(this.config.watchlist.includes(e.symbol),'SYMBOL_OUTSIDE_UNIVERSE');
        assert(typeof e.title==='string'&&e.title.length>=3&&e.title.length<=300,'INVALID_CATALYST');
        assert(Number.isFinite(Date.parse(e.expectedAt))&&Date.parse(e.expectedAt)>=Date.parse(now),'INVALID_CATALYST_TIME');
        assert(Array.isArray(e.sourceIds)&&e.sourceIds.length>0&&e.sourceIds.every(id=>state.evidence.some(s=>s.id===id)),'MISSING_EVIDENCE');
        const event={id:e.id||hash({symbol:e.symbol,title:e.title,expectedAt:e.expectedAt}),symbol:e.symbol,title:e.title,expectedAt:e.expectedAt,sourceIds:e.sourceIds,createdAt:now,status:'scheduled',timezone:e.timezone||'America/New_York'};
        assert(!state.catalysts.some(c=>c.id===event.id),'DUPLICATE_CATALYST');state.catalysts.push(event);appendEvent(state,'catalyst-create',event,now);return {result:event};
      }
      const e=state.catalysts.find(c=>c.id===body.id);assert(e,'CATALYST_NOT_FOUND',undefined,404);assert(e.status==='scheduled','CATALYST_ALREADY_RESOLVED');
      assert(Date.parse(e.expectedAt)<=Date.parse(now),'CATALYST_NOT_DUE');assert(typeof body.outcome==='string'&&body.outcome.length>=3&&body.outcome.length<=2000,'INVALID_OUTCOME');
      e.status='resolved';e.confirmedAt=now;e.outcome=body.outcome;appendEvent(state,'catalyst-resolve',{id:e.id,outcome:e.outcome},now);return {result:e};
    },now)).result;
  }
  async corporateAction(body){const now=this.clock(),mode=this.mode(body.mode);return (await this.update(mode,async state=>{
    const results={};
    for(const [id,ledger] of Object.entries(state.ledgers)){
      const result=await applyCorporateAction(ledger,body.action,this.executionContext(state,now));
      assert(result.ok,'CORPORATE_ACTION_REJECTED',JSON.stringify({ledgerId:id,errors:result.errors}),409);results[id]=result;
    }
    const result=results.S;
    if(Object.values(results).some(r=>!r.replayed)){
      for(const f of state.forecasts)if(f.symbol===result.symbol&&Date.parse(f.predictedAt)<=Date.parse(result.effectiveAt)&&Date.parse(f.horizonAt)>=Date.parse(result.effectiveAt)){
        f.invalidatedAt=now;f.invalidatedReason='CORPORATE_ACTION_REQUIRES_ADJUSTED_OUTCOME';
      }
      appendEvent(state,'corporate-action',{symbol:result.symbol,effectiveAt:result.effectiveAt,results},now);
    }
    recordNav(state,now);return {ok:true,status:'applied',symbol:result.symbol,effectiveAt:result.effectiveAt,results};
  },now)).result;}
  async export(requested){
    const mode=this.mode(requested),state=await this.read(mode);const ledgers={};
    for(const [id,ledger]of Object.entries(state.ledgers))ledgers[id]=await verifyAuditChain(ledger);
    const frozenContextVerification=state.runs.map(run=>({runId:run.id,profiles:(run.frozen?.portfolios||[]).map(p=>{
      const {portfolios,...shared}=run.frozen;return {id:p.id,valid:hash({...shared,portfolio:p.portfolio})===p.contextHash};
    })}));
    return {exportVersion:1,exportedAt:this.clock(),mode,sha256:hash(state),ledgerVerification:ledgers,frozenContextVerification,state};
  }
}
