import { configuration } from '../server/config.mjs';
import { productionStore } from '../server/store.mjs';
const c=configuration();
const checks={mode:c.mode,node:process.versions.node,adminToken:process.env.ARENA_ADMIN_TOKEN?.length>=24,cronToken:process.env.CRON_SECRET?.length>=24,
  databaseConfigured:!!process.env.DATABASE_URL,marketConfigured:c.marketConfigured,feed:c.feed,publicDisplayEnabled:c.publicQuotes,
  models:c.profiles.map(p=>({id:p.id,provider:p.provider,model:p.model||'unconfigured',configured:p.configured})),
  realBrokerExecution:'not implemented by design',liveCallsMade:0};
if(process.env.DATABASE_URL){try{await (await productionStore()).read('arena:fsi:v1:live');checks.databaseReachable=true;}catch{checks.databaseReachable=false;checks.databaseHint='Check database connection and arena_state migration';}}
console.log(JSON.stringify(checks,null,2));
if(c.mode==='live'&&(!checks.adminToken||!checks.databaseReachable||!c.marketConfigured||!c.profiles.every(p=>p.configured)||!c.publicQuotes))process.exitCode=1;
