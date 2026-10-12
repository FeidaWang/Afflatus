import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const ignored=new Set(['node_modules','dist','.git','.arena-data']);let checked=0;const failures=[];
async function walk(dir){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    if(ignored.has(entry.name))continue;const path=join(dir,entry.name);
    if(entry.isDirectory()){await walk(path);continue;}
    if(entry.name.endsWith('.json')){try{JSON.parse(await readFile(path,'utf8'));checked++;}catch(e){failures.push(`${path}: ${e.message}`);}}
    if(entry.name.endsWith('.mjs')){const r=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});if(r.status!==0)failures.push(r.stderr);checked++;}
  }
}
await walk(root);
console.log(JSON.stringify({checked,failures},null,2));if(failures.length)process.exitCode=1;
