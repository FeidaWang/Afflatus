import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,writeFile,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

test('host installer preserves the lazy research seam with the actual default UI export and protects existing destinations',async()=>{
  const host=await mkdtemp(join(tmpdir(),'fsi-host-'));
  const installer=fileURLToPath(new URL('../scripts/install-host.mjs',import.meta.url));
  const entry="import React from 'react';\nimport { App } from '../../prototypes/us-equities-dashboard/src/App.jsx';\nimport '../../prototypes/us-equities-dashboard/src/styles.css';\nconst researchPanel = 'preserved-fixture';\nconst rendered = <App researchPanel={researchPanel} />;\n";
  const invoke=apply=>spawnSync(process.execPath,[installer,'--target',host,...(apply?['--apply']:[])],{encoding:'utf8'});
  try{
    await mkdir(join(host,'src/pages'),{recursive:true});await mkdir(join(host,'api'));
    await writeFile(join(host,'src/pages/arenaJournal.jsx'),entry);
    await writeFile(join(host,'package.json'),JSON.stringify({name:'project-afflatus',type:'module',scripts:{build:'retained'},dependencies:{react:'19.2.0'}}));
    await writeFile(join(host,'vercel.json'),JSON.stringify({headers:[{source:'/existing',headers:[]}]}));
    await writeFile(join(host,'.gitignore'),'node_modules\n');
    assert.equal(invoke(false).status,0);assert.equal(await readFile(join(host,'src/pages/arenaJournal.jsx'),'utf8'),entry);
    await writeFile(join(host,'api/arena-fsi.mjs'),'existing-user-module');assert.notEqual(invoke(true).status,0);
    assert.equal(await readFile(join(host,'api/arena-fsi.mjs'),'utf8'),'existing-user-module');
    await rm(join(host,'api/arena-fsi.mjs'));
    const result=invoke(true);assert.equal(result.status,0,result.stderr);
    const changed=await readFile(join(host,'src/pages/arenaJournal.jsx'),'utf8');
    assert.match(changed,/import App from '..\/..\/integrations\/arena-fsi\/ui\/ArenaFsi.jsx'/);
    assert.match(changed,/<App legacyResearch=\{researchPanel\} \/>/);
    assert.match(changed,/preserved-fixture/);
    assert.match(await readFile(join(host,'.gitignore'),'utf8'),/arena-fsi-install-backup/);
    assert.equal(JSON.parse(await readFile(join(host,'package.json'),'utf8')).scripts.build,'retained');
    assert.equal(JSON.parse(await readFile(join(host,'vercel.json'),'utf8')).headers[0].source,'/existing');
    assert.equal(await readFile(join(host,'integrations/arena-fsi-install-backup/arenaJournal.jsx'),'utf8'),entry);
    assert.equal(invoke(true).status,0);assert.equal(await readFile(join(host,'src/pages/arenaJournal.jsx'),'utf8'),changed);
  }finally{await rm(host,{recursive:true,force:true});}
});
