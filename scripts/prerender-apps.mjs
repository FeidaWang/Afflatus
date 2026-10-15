// Ship the same component tree in HTML, then hydrate it instead of replacing
// the first painted hero/poster when the client bundle arrives.
import { createServer } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { parse, parseFragment, serialize } from 'parse5';
const server = await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom'});
function find(node,id){if(node.attrs?.some(a=>a.name==='id'&&a.value===id))return node;for(const c of node.childNodes||[]){const result=find(c,id);if(result)return result;}}
try {
  const {renderApp}=await server.ssrLoadModule('/scripts/prerender-apps.jsx');
  for(const [page,name] of [['home','index.html'],['arena','arena.html']]) {
    for(const prefix of ['', 'en/', 'zh/']) {
      const file=`dist/${prefix}${name}`;
      const doc=parse(await readFile(file,'utf8'));
      const root=find(doc,'root');
      const fragment=parseFragment(renderApp(page,prefix==='zh/'?'zh':'en'));
      root.childNodes=fragment.childNodes;
      for(const child of root.childNodes)child.parentNode=root;
      root.attrs.push({name:'data-prerendered-app',value:page});
      root.attrs.push({name:'data-prerendered-locale',value:prefix==='zh/'?'zh':'en'});
      await writeFile(file,serialize(doc));
    }
  }
  console.log('Prerendered six home/Arena documents from their actual components');
} finally {await server.close();}
