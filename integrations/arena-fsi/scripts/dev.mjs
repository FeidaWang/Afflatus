import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { ArenaService } from '../server/service.mjs';
import { StateStore, SQLiteAdapter } from '../server/store.mjs';
import { createHandler } from '../server/http.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');process.chdir(root);
try{process.loadEnvFile('.env.local');}catch(e){if(e.code!=='ENOENT')throw e;}
if(process.env.SITES_MANAGED_LINUX_CONTAINER==='1')throw new Error('In this managed workspace use the supported preview supervisor. npm run dev is for the downloaded local package.');
await mkdir('.arena-data',{recursive:true,mode:0o700});
let token=process.env.ARENA_ADMIN_TOKEN;
if(!token){try{token=(await readFile('.arena-data/admin-token','utf8')).trim();}catch{token=randomBytes(32).toString('hex');await writeFile('.arena-data/admin-token',token,{mode:0o600});}}
const env={...process.env,ARENA_MODE:process.env.ARENA_MODE||'demo',ARENA_ADMIN_TOKEN:token};
const db=new DatabaseSync('.arena-data/paper.sqlite');const service=new ArenaService({store:new StateStore(new SQLiteAdapter(db)),env});const handler=createHandler(service,env);
const api=createServer(async(req,res)=>{
  try{
    // Vite forwards the original Host. Preserve the frontend origin for same-origin POST checks.
    const host=req.headers.host;
    if(!/^(127\.0\.0\.1|localhost):\d{2,5}$/.test(host||''))throw new Error('Unexpected local host');
    const url=`http://${host}${req.url}`;
    const request=new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:req,duplex:'half'}:{})});
    const response=await handler(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500,{'Content-Type':'application/json'});res.end('{"error":{"code":"LOCAL_SERVER_ERROR"}}');}
});
await new Promise(resolve=>api.listen(4174,'127.0.0.1',resolve));
const vite=await createViteServer({configFile:resolve(root,'vite.config.mjs'),server:{host:'127.0.0.1'}});await vite.listen();vite.printUrls();
console.log('Open /arena.html. Mode: '+env.ARENA_MODE+'. Local administrator token is stored in .arena-data/admin-token (never sent to the page automatically).');
let closing=false;const close=async()=>{if(closing)return;closing=true;await vite.close();api.close();db.close();process.exit(0);};process.on('SIGINT',close);process.on('SIGTERM',close);
