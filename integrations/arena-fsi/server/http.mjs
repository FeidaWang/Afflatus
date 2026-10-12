import { randomUUID } from 'node:crypto';
import { ArenaError, assert, secretMatches } from './common.mjs';

const READ_ROUTES=new Set(['status','demo','history','health']);
const WRITE_ROUTES=new Set(['refresh','run','order','pause','cancel','research','thesis','catalyst','feedback','corporate-action','export']);
function reply(data,status=200,requestId) {return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Request-ID':requestId,'X-Robots-Tag':'noindex'}});}
async function payload(request){
  assert(request.headers.get('Content-Type')?.split(';')[0].trim()==='application/json','JSON_REQUIRED','Use application/json',415);
  const limit=150000, declared=Number(request.headers.get('Content-Length')||0);assert(declared<=limit,'BODY_TOO_LARGE',undefined,413);
  let bytes=0,text='';const reader=request.body?.getReader();
  assert(reader,'BODY_REQUIRED');const decoder=new TextDecoder();
  try{for(;;){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;assert(bytes<=limit,'BODY_TOO_LARGE',undefined,413);text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}
  finally{await reader.cancel().catch(()=>{});}
  let result;try{result=JSON.parse(text);}catch{throw new ArenaError('INVALID_JSON');}
  assert(result&&typeof result==='object'&&!Array.isArray(result),'INVALID_PAYLOAD');return result;
}
export function createHandler(service,env={}) {
  return async function handle(request){
    const requestId=randomUUID();
    try{
      const url=new URL(request.url),route=url.searchParams.get('route')||'status';
      const authorization=request.headers.get('Authorization');const admin=secretMatches(authorization,env.ARENA_ADMIN_TOKEN);
      if(route==='cron'){
        assert(request.method==='GET','METHOD_NOT_ALLOWED',undefined,405);
        assert(secretMatches(authorization,env.CRON_SECRET),'UNAUTHORIZED',undefined,401);
        const mode=service.config.mode;
        await service.refresh(mode);
        const settled=await service.settle(mode,{refresh:false});
        const now=service.clock();let result={refreshed:true,settled:settled.settled};
        if(service.config.autorun){
          const status=await service.status(mode,{admin:true});
          if(status.snapshot.marketOpen){const bucket=now.slice(0,13);result=await service.run({mode,idempotencyKey:`cron-${bucket.replace(/[^\w]/g,'')}`});}
        }
        return reply({ok:true,result},200,requestId);
      }
      if(request.method==='GET'){
        assert(READ_ROUTES.has(route),'METHOD_NOT_ALLOWED','This route requires an authenticated POST',405);
        if(route==='health')return reply(await service.health(),200,requestId);
        const mode=route==='demo'?'demo':service.mode(url.searchParams.get('mode')||undefined);
        if(route==='history'){
          assert(mode==='demo'||admin||service.config.publicQuotes,'PUBLIC_DATA_DISABLED','Public data display has not been enabled',403);
          return reply(await service.history(url.searchParams.get('symbol'),mode),200,requestId);
        }
        if(mode==='live'&&(admin||service.config.publicQuotes))await service.ensureFreshMarket(mode);
        return reply(await service.status(mode,{admin}),200,requestId);
      }
      assert(request.method==='POST'&&WRITE_ROUTES.has(route),'METHOD_NOT_ALLOWED',undefined,405);
      assert(admin,'UNAUTHORIZED','An administrator bearer token is required',401);
      const origin=request.headers.get('Origin');
      if(origin)assert(origin===url.origin,'ORIGIN_REJECTED',undefined,403);
      const body=await payload(request);let result;
      if(route==='refresh')result=await service.refresh(body.mode);
      else if(route==='run')result=await service.run(body);
      else if(route==='order')result=await service.placeOrder(body);
      else if(route==='pause')result=await service.pause(body);
      else if(route==='cancel')result=await service.cancel(body);
      else if(route==='research')result=await service.research(body);
      else if(route==='thesis')result=await service.thesis(body);
      else if(route==='catalyst')result=await service.catalyst(body);
      else if(route==='feedback')result=await service.settle(body.mode);
      else if(route==='corporate-action')result=await service.corporateAction(body);
      else if(route==='export')result=await service.export(body.mode);
      return reply(result,200,requestId);
    }catch(error){
      const known=error.code&&/^[A-Z_0-9]+$/.test(error.code);
      const status=error.status||(known?400:500);
      // Never include provider bodies, request headers, connection strings, or stack traces in the response.
      return reply({error:{code:known?error.code:'INTERNAL_ERROR',message:known?error.message:'Operation failed',requestId}},status,requestId);
    }
  };
}
