import { ArenaService } from './service.mjs';
import { productionStore, StateStore, MemoryAdapter } from './store.mjs';
import { createHandler } from './http.mjs';

let retained;
async function getHandler(){
  if(!retained)retained=(async()=>{
    if(!process.env.DATABASE_URL){
      // Read-only diagnostics and explicit demo preview work before database setup. No ephemeral production writes.
      const service=new ArenaService({store:new StateStore(new MemoryAdapter()),env:process.env});
      const handler=createHandler(service,process.env);
      return request=>request.method==='GET'&&['status','demo','health'].includes(new URL(request.url).searchParams.get('route')||'status')
        ? handler(request):Response.json({error:{code:'DATABASE_NOT_CONFIGURED',message:'Set DATABASE_URL and run the additive migration'}},{status:503,headers:{'Cache-Control':'no-store'}});
    }
    return createHandler(new ArenaService({store:await productionStore(),env:process.env}),process.env);
  })().catch(error=>{retained=undefined;throw error;});
  return retained;
}
export async function handleVercel(request){
  try{return await (await getHandler())(request);}catch{return Response.json({error:{code:'SERVICE_UNAVAILABLE',message:'Check database configuration and migration status'}},{status:503,headers:{'Cache-Control':'no-store'}});}
}
