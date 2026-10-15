// Inline local CSS after localization: remove stylesheet dependency waterfalls
// while preserving the exact cascade and root-relative asset URLs.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
const root = resolve(process.argv[2] || 'dist');
async function files(dir) {
  const items = await readdir(dir, {withFileTypes:true});
  return (await Promise.all(items.map(x=>x.isDirectory()?files(resolve(dir,x.name)):[resolve(dir,x.name)]))).flat();
}
async function css(path, chain = new Set()) {
  if(chain.has(path))throw new Error(`Cyclic CSS import: ${path}`);
  const next = new Set([...chain,path]);
  let text=await readFile(path,'utf8');
  const imports=[...text.matchAll(/@import\s+(?:url\(["']?([^"')]+)["']?\)|["']([^"']+)["'])\s*;/g)];
  for(const match of imports) {
    const url=match[1]||match[2];
    if(/^(?:https?:|data:|\/\/)/.test(url))continue;
    const source=resolve(url.startsWith('/')?root:dirname(path),'.'+(url.startsWith('/')?url:'/'+url));
    if(!source.startsWith(root+'/'))throw new Error('CSS import outside output');
    text=text.replace(match[0],await css(source,next));
  }
  // All stylesheet assets are root-relative in this project. Explicitly
  // rebase relative URLs too, so future styles cannot change meaning in HTML.
  return text.replace(/url\((["']?)([^"')]+)\1\)/g,(all,q,url)=>{
    if(/^(?:\/|#|data:|https?:)/.test(url))return all;
    return `url(${q}/${relative(root,resolve(dirname(path),url))}${q})`;
  });
}
let count=0;
for(const file of await files(root)) {
  if(!file.endsWith('.html'))continue;
  let html=await readFile(file,'utf8');
  const links=[...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/g)];
  for(const link of links) {
    const href=link[0].match(/href=["']([^"']+)["']/)?.[1];
    if(!href?.startsWith('/')||href.startsWith('//'))continue;
    const path=resolve(root,'.'+href);
    const media=link[0].match(/media=["']([^"']+)["']/)?.[1];
    const content=(await css(path)).replace(/<\/style/gi,'<\\/style');
    html=html.replace(link[0],`<style data-static-css="${href}"${media?` media="${media}"`:''}>${content}</style>`);
  }
  const coreFonts=await readFile(resolve(root,'styles/core-fonts.css'),'utf8').catch(error=>{if(error.code==='ENOENT')return '';throw error;});
  if (coreFonts) {
    html=html.replace(/@font-face\s*\{[^}]+\}/g,face=>/font-family:\s*["']?(?:Newsreader|Anthropic Sans)["']?\s*;/.test(face)&&!/font-style:\s*italic/.test(face)?'':face);
    const serifPreload = /(?:^|\/)(?:index|signal|sectors)\.html$/.test(file)&&!/<link[^>]+href="\/assets\/fonts\/newsreader-var/.test(html)
      ? '<link rel="preload" href="/assets/fonts/newsreader-var-core.woff2" as="font" type="font/woff2" crossorigin>' : '';
    html=html.replace('</head>',`<style data-core-fonts>${coreFonts}</style>${serifPreload}</head>`);
    html=html.replaceAll('/assets/fonts/anthropic-sans-roman.woff2','/assets/fonts/anthropic-sans-roman-core.woff2')
      .replaceAll('/assets/fonts/newsreader-var.woff2','/assets/fonts/newsreader-var-core.woff2');
  }
  const modules=[...html.matchAll(/<script\b[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*><\/script>/g)];
  if(modules.length) {
    const urls=modules.map(m=>m[1]);
    for(const module of modules)html=html.replace(module[0],'');
    html=html.replace(/<link\b[^>]*rel=["']modulepreload["'][^>]*>/g,'');
    // The document already contains usable content and all its styles. Start
    // enhancement immediately after the first painted frame; do not compete
    // with that frame for bandwidth. Early button clicks are replayed.
    const boot=`<script data-progressive-boot>(function(){var ready=false,pending;function load(){return pending||(pending=Promise.all(${JSON.stringify(urls)}.map(function(url){return import(url)})).then(function(){ready=true}))}document.addEventListener('click',function(event){var button=event.target.closest('button');if(!ready&&button&&!button.disabled){event.preventDefault();event.stopImmediatePropagation();load().then(function(){if(button.isConnected)button.click()})}},true);function start(){if(typeof PerformanceObserver==='function'&&(PerformanceObserver.supportedEntryTypes||[]).includes('paint')){var observer=new PerformanceObserver(function(list){if(list.getEntries().some(function(entry){return entry.name==='first-contentful-paint'})){observer.disconnect();load()}});observer.observe({type:'paint',buffered:true})}else requestAnimationFrame(function(){requestAnimationFrame(load)})}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start()})();</script>`;
    html=html.replace('</body>',boot+'</body>');
  }
  await writeFile(file,html);count++;
}
console.log(`Inlined local stylesheets in ${count} documents`);
