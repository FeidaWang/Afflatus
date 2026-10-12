import { createLedger } from '../src/core/paper-engine.mjs';
import { configuration } from './config.mjs';
import { demoSnapshot, unavailableSnapshot } from './market.mjs';

export function initialState(config, mode, now) {
  return {
    schemaVersion:1,mode,createdAt:now,updatedAt:now,tick:0,
    snapshot:mode==='demo'?demoSnapshot(config.watchlist,now):unavailableSnapshot(now),
    ledgers:Object.fromEntries(config.profiles.map(p=>[p.id,createLedger({id:p.id,initialCash:config.initialCash,now})])),
    nav:Object.fromEntries(config.profiles.map(p=>[p.id,[]])),
    benchmarks:{SPY:[],SMH:[]},runs:[],forecasts:[],theses:[],catalysts:[],evidence:[],artifacts:[],brief:null,
    history:{},audit:[],operations:{},runBudget:{date:now.slice(0,10),count:0},activeRun:null
  };
}
