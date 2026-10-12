#!/usr/bin/env node
import { readFile, writeFile, mkdir, readdir, cp, stat } from 'node:fs/promises';
import { resolve, dirname, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const kit=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),get=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;};
const target=get('--target');
if(!target){console.error('Usage: node scripts/install-host.mjs --target /absolute/path/to/Afflatus [--apply]');process.exit(2);}
const host=resolve(target),apply=args.includes('--apply');
if(host===kit||host.startsWith(`${kit}/`))throw new Error('The target must be the existing Afflatus checkout, outside this kit.');
const entry=join(host,'src/pages/arenaJournal.jsx'),packagePath=join(host,'package.json'),vercelPath=join(host,'vercel.json'),ignorePath=join(host,'.gitignore');
const original=await readFile(entry,'utf8');const pkg=JSON.parse(await readFile(packagePath,'utf8'));const vercel=JSON.parse(await readFile(vercelPath,'utf8'));
if(pkg.name!=='project-afflatus')throw new Error('Target package is not project-afflatus. Review the target; no files were changed.');
const marker='arena-fsi-upgrade:v1';
if(original.includes(marker)){console.log('Arena FSI is already installed. For an upgrade, compare versions and replace only the integrations/arena-fsi package.');process.exit(0);}
const appImport="import { App } from '../../prototypes/us-equities-dashboard/src/App.jsx';";
const styleImport="import '../../prototypes/us-equities-dashboard/src/styles.css';";
if(!original.includes(appImport)||!original.includes(styleImport)||!original.includes('<App researchPanel={researchPanel} />'))throw new Error('Arena entry changed from the audited structure. Review its import/render seam; do not overwrite an unknown layout.');
for(const path of [join(host,'api/arena-fsi.mjs'),join(host,'integrations/arena-fsi')]){
  try{await stat(path);throw new Error(`Destination already exists: ${path}. Review it before installation.`);}catch(e){if(e.code!=='ENOENT')throw e;}
}
const ignoreBefore=await readFile(ignorePath,'utf8').catch(e=>{if(e.code==='ENOENT')return '';throw e;});
const legacyTestPath=join(host,'tests/arenaApiAccess.test.js');
const legacyTestBefore=await readFile(legacyTestPath,'utf8').catch(e=>{if(e.code==='ENOENT')return null;throw e;});
// The audited access test omitted fields already required by the unchanged Finnhub validator.
// Repair only that exact fixture; never relax production validation or overwrite a changed test.
const legacyFixture='({ c: 123.45, pc: 122 })';
const validLegacyFixture='({ c: 123.45, pc: 122, o: 122.5, h: 124, l: 122, t: Math.floor(Date.now() / 1000) })';
const legacyTestAfter=legacyTestBefore?.includes(legacyFixture)?legacyTestBefore.replace(legacyFixture,validLegacyFixture):legacyTestBefore;
const localizedTestPath=join(host,'tests/localizedSite.test.js');
const localizedTestBefore=await readFile(localizedTestPath,'utf8').catch(e=>{if(e.code==='ENOENT')return null;throw e;});
const oldTitle='<title>竞技场 — QF-01 量化铸造舱与美股技术分析 · Afflatus</title>';
const localizedTestAfter=localizedTestBefore?.includes(oldTitle)?localizedTestBefore.replace(oldTitle,'<title>股票研究与 AI 模拟交易 · AFFLATUS</title>'):localizedTestBefore;
const backupIgnore='/integrations/arena-fsi-install-backup/';
const ignoreAfter=ignoreBefore.split('\n').includes(backupIgnore)?ignoreBefore:`${ignoreBefore.trimEnd()}\n\n# Local rollback originals created by the Arena FSI installer\n${backupIgnore}\n`;
const changed=original.replace(appImport,`// ${marker}\nimport App from '../../integrations/arena-fsi/ui/ArenaFsi.jsx';`)
  .replace(styleImport,"import '../../integrations/arena-fsi/ui/styles.css';")
  .replace('<App researchPanel={researchPanel} />','<App legacyResearch={researchPanel} />');
pkg.dependencies={...pkg.dependencies,'@neondatabase/serverless':'1.0.2'};
pkg.scripts={...pkg.scripts,'arena:fsi:test':'node --test integrations/arena-fsi/tests/*.test.mjs',
  'arena:fsi:check':'node integrations/arena-fsi/scripts/check.mjs',
  'arena:fsi:migrate':'node --env-file-if-exists=.env.local integrations/arena-fsi/scripts/migrate.mjs',
  'arena:fsi:doctor':'node --env-file-if-exists=.env.local integrations/arena-fsi/scripts/doctor.mjs'};
vercel.functions={...vercel.functions,'api/arena-fsi.mjs':{maxDuration:180}};
const plan={target:host,apply,changes:['src/pages/arenaJournal.jsx','package.json','vercel.json','.gitignore','api/arena-fsi.mjs','integrations/arena-fsi/**'],
  preserved:'Existing shared header, locale routing, Vibe research panel, historical ledgers and all unrelated pages',
  upstream:'edec43a8698d0e17ad9400728bafeeb82602a0f7',requires:'Run npm install to update host package-lock.json; configure environment and run the additive DB migration'};
if(legacyTestAfter!==legacyTestBefore)plan.changes.push('tests/arenaApiAccess.test.js (complete its existing quote fixture)');
if(localizedTestAfter!==localizedTestBefore)plan.changes.push('tests/localizedSite.test.js (updated Arena title snapshot)');
console.log(JSON.stringify(plan,null,2));if(!apply)process.exit(0);
const receiptDir=join(host,'integrations/arena-fsi-install-backup');await mkdir(receiptDir,{recursive:true});
await writeFile(join(receiptDir,'.gitignore'),ignoreBefore);
for(const [name,path]of [['arenaJournal.jsx',entry],['package.json',packagePath],['vercel.json',vercelPath]]){
  try{await stat(join(receiptDir,name));throw new Error(`Backup already exists: ${name}. Inspect before reapplying.`);}catch(error){if(error.code!=='ENOENT')throw error;}
  await cp(path,join(receiptDir,name));
}
const destination=join(host,'integrations/arena-fsi');await mkdir(destination,{recursive:true});
for(const name of ['server','src','ui','config','fixtures','scripts','tests','docs','licenses','package.json','package-lock.json','vite.config.mjs','README.md','CODEX_START.md','NOTICE.md','.env.example','.gitignore']){
  try{await stat(join(kit,name));}catch{continue;}
  await cp(join(kit,name),join(destination,name),{recursive:true});
}
await writeFile(entry,changed);await writeFile(packagePath,JSON.stringify(pkg,null,2)+'\n');await writeFile(vercelPath,JSON.stringify(vercel,null,2)+'\n');
await writeFile(ignorePath,ignoreAfter);
if(legacyTestAfter!==legacyTestBefore){
  await mkdir(join(receiptDir,'tests'),{recursive:true});await writeFile(join(receiptDir,'tests/arenaApiAccess.test.js'),legacyTestBefore);await writeFile(legacyTestPath,legacyTestAfter);
}
if(localizedTestAfter!==localizedTestBefore){
  await mkdir(join(receiptDir,'tests'),{recursive:true});await writeFile(join(receiptDir,'tests/localizedSite.test.js'),localizedTestBefore);await writeFile(localizedTestPath,localizedTestAfter);
}
await mkdir(join(host,'api'),{recursive:true});
await writeFile(join(host,'api/arena-fsi.mjs'),"import { handleVercel } from '../integrations/arena-fsi/server/vercel.mjs';\nexport default { fetch: handleVercel };\n");
const receipt={...plan,installedAt:new Date().toISOString(),originalEntrySha256:createHash('sha256').update(original).digest('hex'),newEntrySha256:createHash('sha256').update(changed).digest('hex')};
await writeFile(join(receiptDir,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
console.log('Installed. No git commit, push, database migration or remote deployment was performed by this installer.');
