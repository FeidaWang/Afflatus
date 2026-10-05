import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {validateObservatory} from '../src/sectors/observatory/validate.js';
import {renderPage} from '../src/sectors/observatory/render.js';
const data=JSON.parse(await readFile('src/sectors/observatory/data.json','utf8'));
const validation=validateObservatory(data);if(!validation.ok)throw Error(validation.errors.join('\n'));
const rendered=renderPage(data);
const file='sectors.html'; const html=await readFile(file,'utf8');
const start='<!-- observatory:start -->',end='<!-- observatory:end -->';
const content=`${start}\n${rendered}\n${end}`;
const changed=html.includes(start) ? html.replace(/<!-- observatory:start -->[\s\S]*?<!-- observatory:end -->/,content) : html.replace(/<main class="shell sectors">[\s\S]*?(?=<\/body>)/,content+'\n');
const snapshot=`public/data/sectors-observatory/${data.snapshot}.json`;
const json=JSON.stringify(data,null,2)+'\n';
if(process.argv.includes('--check')){
 if(html!==changed||await readFile(snapshot,'utf8').catch(()=>'')!==json) throw Error('Observatory content is stale. Run node scripts/build-sectors-observatory.mjs');
 console.log(`Observatory verified: ${data.companies.length} organizations, ${data.models.length} models, ${data.events.length} milestones.`);
}else{await mkdir('public/data/sectors-observatory',{recursive:true});await writeFile(snapshot,json);await writeFile(file,changed);console.log('Observatory content generated.');}
