import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { marked } from 'marked';
import { parseFragment, serialize } from 'parse5';
import { courseBookCatalog as books } from '../src/data/courseBookCatalog.js';
import { courseGroupCopy as groups } from '../src/data/courseGroupCopy.js';
import { courseDiagrams } from '../src/data/courseDiagrams.js';
import './build-course-content.mjs';

const resources=JSON.parse(readFileSync(new URL('../src/data/courseResources.json',import.meta.url),'utf8'));
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const write=(path,content)=>writeFileSync(new URL(path,root),content);
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const portfolio=read('portfolio.html');
const header=portfolio.match(/<!-- shared-header:start -->([\s\S]*?)<!-- shared-header:end -->/)[1];
const footer=portfolio.match(/<footer class="pa-footer">[\s\S]*?<\/footer>/)[0];
function localize(html,lang,page){
 const tree=parseFragment(html), other=lang==='zh'?'en':'zh';
 function walk(n){
  if(n.attrs){
   const attr=name=>n.attrs.find(a=>a.name===name)?.value;
   const set=(name,value)=>{const a=n.attrs.find(a=>a.name===name);if(a)a.value=value;else n.attrs.push({name,value});};
   if(attr(`data-${lang}`)!=null)n.childNodes=[{nodeName:'#text',value:attr(`data-${lang}`),parentNode:n}];
   if(attr(`data-aria-${lang}`)!=null)set('aria-label',attr(`data-aria-${lang}`));
   if(attr('href')?.startsWith('/')){const path=attr('href').replace(/^\/(en|zh)(?=\/)/,'');set('href',path==='/serial.html'?'/zh/serial.html':`/${lang}${path}`);}
   if(attr('data-header-language')!=null){set('href',`/${other}/course/${page}.html`);set('hreflang',other==='zh'?'zh-CN':'en');set('aria-label',other==='zh'?'切换到中文':'Switch to English');n.childNodes=[{nodeName:'#text',value:other==='zh'?'中文':'EN',parentNode:n}];}
   if(attr('data-header-path')==='/course.html')set('aria-current','page');
   else n.attrs=n.attrs.filter(a=>a.name!=='aria-current');
  }
  n.childNodes?.forEach(walk);
 }
 walk(tree);return serialize(tree);
}
// Only manuscript anchor markers are accepted as raw HTML. Prompts remain inert code.
marked.use({renderer:{html({text}){return /^\s*<a id="[a-z0-9-]+"><\/a>\s*$/i.test(text)?text:'';},link({href,title,tokens}){if(!/^(https?:\/\/|#|[a-z][a-z0-9.-]*\.html(?:#.*)?$)/i.test(href))return esc(tokens.map(t=>t.raw).join(''));return `<a href="${esc(href)}"${title?` title="${esc(title)}"`:''}${href.startsWith('http')?' rel="noreferrer"':''}>${this.parser.parseInline(tokens)}</a>`;}}});
function md(source,lang){
 source=source.replace(/@readings\n([\s\S]*?)\n@end/g,(_,rows)=>{
  return `| ${lang==='zh'?'级别':'Priority'} | ${lang==='zh'?'来源与选读':'Source and selected sections'} | ${lang==='zh'?'阅读预算':'Budget'} |\n|---|---|---:|\n`+rows.trim().split('\n').map(row=>{const [id,kind,scope,mins]=row.split('|'),r=resources.find(r=>r.id===id);if(!r)throw Error(`Unknown resource ${id}`);return `| ${kind} | [${id} · ${r.title[lang]}](${r.url}) — ${scope} | ${mins} min |`;}).join('\n');
 });
 source=source.replace(/@curriculum/g,`| Week | Question and chapter |\n|---|---|\n`+books.map(b=>`| ${b.id} | [${b.heading[lang]}](book-${b.id}.html) |`).join('\n'));
 // Resolve standalone resource identifiers in English prose, but not code or existing links.
 const tokens=marked.lexer(source);
 function renderTokens(ts){return marked.parser(ts);}
 let html=renderTokens(tokens);
 const tree=parseFragment(html);
 function linkRefs(n,blocked=false){
  const skip=blocked||['a','code','pre'].includes(n.tagName);
  if(!skip&&n.childNodes){n.childNodes=n.childNodes.flatMap(c=>{
   if(c.nodeName==='#text'&&/\bR\d{2}\b/.test(c.value)){
    const frag=parseFragment(esc(c.value).replace(/\bR(\d{2})\b/g,(all,num)=>{const r=resources.find(r=>r.id===all);return r?`<a href="${esc(r.url)}" title="${esc(r.title[lang])}" rel="noreferrer">${all}</a>`:all;}));return frag.childNodes;
   }linkRefs(c,skip);return [c];
  });}else n.childNodes?.forEach(c=>linkRefs(c,skip));
 }
 linkRefs(tree);html=serialize(tree);
 html=html.replace(/<table>/g,`<div class="table-scroll" tabindex="0" role="region" aria-label="${lang==='zh'?'课程表格，可横向滚动':'Course table, scroll horizontally'}"><table>`).replace(/<\/table>/g,'</table></div>');
 return html;
}
function sections(html){let i=0;const toc=[];html=html.replace(/<h([23])>([\s\S]*?)<\/h\1>/g,(_,level,title)=>{const id=`section-${++i}`;toc.push({id,title:title.replace(/<[^>]+>/g,''),level});return `<h${level} id="${id}">${title}</h${level}>`;});return {html,toc};}
function flow(book,lang){const zh=lang==='zh',labels=courseDiagrams[Number(book.id)-1][zh?1:0];return `<figure class="lesson-figure"><div class="figure-top"><span>${zh?'图':'FIG.'} ${book.id}.1</span><span>${zh?'本周的思考路径':'THIS WEEK’S REASONING PATH'}</span></div><ol class="learning-flow">${labels.map((label,i)=>`<li><span>0${i+1}</span><strong>${esc(label)}</strong></li>`).join('')}</ol><figcaption>${zh?'课程示意图 · 根据本周实验步骤绘制，表示建议流程，不是实测结果。':'Teaching diagram · Derived from this week’s lab; a suggested process, not observed results.'}</figcaption></figure>`;}
function budget(lang){const zh=lang==='zh';return `<figure class="lesson-figure budget-figure"><div class="figure-top"><span>${zh?'学习节奏':'STUDY RHYTHM'}</span><span>10 + 2 ${zh?'小时 / 周':'HOURS / WEEK'}</span></div><div class="budget-bar" role="img" aria-label="${zh?'选读 2 小时，构建 5 小时，独立练习、使用和复盘各 1 小时':'Reading 2 hours; building 5; independent practice, use and review 1 each'}">${[2,5,1,1,1].map((n,i)=>`<span style="flex:${n};--segment:${['#9aaa8c','#d0977e','#b4a2bc','#91aab8','#d4c59a'][i]}">${n}h</span>`).join('')}</div><ul class="budget-key">${(zh?['选读','构建与验证','独立练习','真实使用','复盘']:['Reading','Build & verify','Independent practice','Real use','Review']).map((s,i)=>`<li><i style="background:${['#9aaa8c','#d0977e','#b4a2bc','#91aab8','#d4c59a'][i]}"></i>${s}</li>`).join('')}</ul><figcaption>${zh?'原文课程设计：10 小时核心 + 2 小时机动。阅读表中的时间为选读建议，不是整门公开课时长。':'Manuscript planning budget: 10 core hours + 2 optional hours. Reading budgets cover selections, not entire external courses.'}</figcaption></figure>`;}
function valueChart(lang){const zh=lang==='zh',labels=zh?['旧流程主动时间','新操作与复核','维护','净省时']:['Old active time','Operation & review','Maintenance','Net saved'];return `<figure class="lesson-figure value-figure"><div class="figure-top"><span>${zh?'图 23.2':'FIG. 23.2'}</span><span>${zh?'纯合成算例':'SYNTHETIC EXAMPLE'}</span></div><h3>${zh?'72 − 18 − 14 = 40 分钟':'72 − 18 − 14 = 40 minutes'}</h3>${[72,18,14,40].map((n,i)=>`<div class="value-row"><span>${labels[i]}</span><i style="width:${n/72*100}%"></i><b>${n}</b></div>`).join('')}<figcaption>${zh?'来源：课程手册“净省时的计算方式”。假设每周 12 项同等质量任务，每项原需 6 分钟；不包含现金成本、一次性建造时间与未来故障，不是收益预测。':'Source: the manuscript’s net-time example. Twelve equivalent tasks at six minutes each; excludes cash, one-time building and future faults. This is not a benefit forecast.'}</figcaption></figure>`;}
function sourceList(ids,lang){return `<ol class="source-list">${ids.map(id=>{const r=resources.find(r=>r.id===id);return `<li id="${id}"><span>${id}</span><div><a href="${esc(r.url)}" rel="noreferrer">${esc(r.title[lang])} ↗</a><p>${esc(r.note[lang])}</p></div></li>`;}).join('')}</ol>`;}
function tocMarkup(toc,lang){return `<aside class="reader-toc"><details open><summary>${lang==='zh'?'本页目录':'ON THIS PAGE'}</summary><nav aria-label="${lang==='zh'?'文章目录':'Article contents'}">${toc.map(t=>`<a href="#${t.id}" class="toc-level-${t.level}">${esc(t.title)}</a>`).join('')}</nav></details><a class="toc-back" href="/${lang}/course.html#curriculum">← ${lang==='zh'?'24 周课程':'24-week curriculum'}</a></aside>`;}
function documentPage({lang,page,title,description,hero,body,toc,adjacent=''}){
 const zh=lang==='zh',other=zh?'en':'zh',url=`https://feida.au/${lang}/course/${page}.html`;
 return `<!doctype html><html lang="${zh?'zh-CN':'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${esc(description)}"><meta name="theme-color" content="#faf9f5"><meta name="referrer" content="strict-origin-when-cross-origin"><title>${esc(title)} · AFFLATUS</title><link rel="canonical" href="${url}"><link rel="alternate" hreflang="en" href="https://feida.au/en/course/${page}.html"><link rel="alternate" hreflang="zh-CN" href="https://feida.au/zh/course/${page}.html"><link rel="icon" href="/favicons/course.svg"><link rel="stylesheet" href="/styles/responsive-primitives.css"><link rel="stylesheet" href="/styles/shared-header.css"><link rel="stylesheet" href="/styles/course-chrome.css"><link rel="stylesheet" href="/styles/course-lesson.css"><meta property="og:type" content="article"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${url}"><script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'LearningResource',name:title,description,inLanguage:zh?'zh-CN':'en',url,learningResourceType:'Self-study lesson',isAccessibleForFree:true,dateModified:'2026-09-27',isPartOf:{'@type':'Course',name:'From vibe coding to a personal FDE',url:`https://feida.au/${lang}/course.html`}}).replaceAll('<','\\u003c')}</script></head><body class="course-reading"><a class="reader-skip" href="#lesson-body">${zh?'跳到课程正文':'Skip to lesson'}</a>${localize(header,lang,page)}<div class="reading-progress" aria-hidden="true"><i></i></div><main id="mainContent"><div class="reader-breadcrumb"><a href="/${lang}/course.html#curriculum">${zh?'课程书架':'The collection'}</a><span>/</span><span>${zh?'自学公开课程':'AN OPEN STUDY ROUTE'}</span></div>${hero}<div class="reader-layout">${tocMarkup(toc,lang)}<article id="lesson-body" class="lesson-prose">${body}</article></div>${adjacent}<nav class="reader-support" aria-label="${zh?'课程资料':'Course materials'}"><a href="guide.html">${zh?'课程导读':'Start here'} ↗</a><a href="handbook.html">${zh?'手册与七张模板':'Handbook & templates'} ↗</a><a href="resources.html">${zh?'78 项来源索引':'78-source library'} ↗</a><a href="/${other}/course/${page}.html" hreflang="${other}">${zh?'Read in English':'阅读中文版'} ↗</a></nav></main>${localize(footer,lang,page)}<script type="module" src="/lib/course-reader.js"></script></body></html>`;
}
for(const lang of ['en','zh']){
 const zh=lang==='zh';mkdirSync(new URL(`public/${lang}/course/`,root),{recursive:true});
 for(const [index,book] of books.entries()){
  const source=read(`content/course/${lang}/book-${book.id}.md`),ids=[...new Set(source.match(/\bR\d{2}\b/g)||[])].sort();
  let html=md(source.replace(/^### /gm,'## '),lang);
  const marker=html.indexOf('<h2>');html=html.slice(0,marker)+flow(book,lang)+html.slice(marker);
  if(book.id==='23')html+=valueChart(lang);
  html+=`<h2>${zh?'本周来源与核对范围':'Sources and verification scope'}</h2><p class="source-baseline">${zh?'来源编号与核对说明沿用课程原文，基线为 2026-09-27。未逐一登录完成外部实验；实施前请核对最新版本与访问条件。':'Reference IDs and scope follow the supplied manuscript, baseline 2026-09-27. External authenticated labs were not all completed; recheck versions and access before implementation.'}</p>${sourceList(ids,lang)}`;
  const {html:body,toc}=sections(html);
  const hero=`<section class="reader-hero"><div class="reader-hero-copy"><p class="reader-eyebrow">${zh?'第':'WEEK'} ${book.id}${zh?' 周':''} <span>/ 24</span> · ${esc(groups[book.group][zh?1:0])}</p><h1>${esc(book.title[lang])}</h1><p class="reader-deck">${esc(book.heading[lang])}</p><div class="reader-meta"><span>${zh?'10 小时核心 + 2 小时机动':'10 core hours + 2 optional'}</span><span>${zh?'学习 · 实验 · 独立练习':'READ · BUILD · PRACTISE'}</span></div><a class="reader-start" href="#lesson-body">${zh?'开始阅读':'Begin the lesson'} ↓</a></div><div class="reader-cover"><img src="${book.covers[lang]}" width="480" height="640" alt="${esc(book.title[lang])}" fetchpriority="high"><span>${zh?'24 周个人 FDE 实践路线':'THE PERSONAL FDE FIELD LIBRARY'}</span></div></section>`;
  const neighbor=delta=>{const b=books[index+delta];return b?`<a href="book-${b.id}.html"><span>${delta<0?(zh?'上一周':'PREVIOUS WEEK'):(zh?'下一周':'NEXT WEEK')} · ${b.id}</span><strong>${esc(b.title[lang])} ${delta<0?'←':'→'}</strong></a>`:`<a href="${delta<0?'guide':'handbook'}.html"><span>${zh?'继续探索':'CONTINUE EXPLORING'}</span><strong>${delta<0?(zh?'从导读开始':'Start with the guide'):(zh?'手册与下一步':'Handbook & what comes next')} ↗</strong></a>`;};
  write(`public/${lang}/course/book-${book.id}.html`,documentPage({lang,page:`book-${book.id}`,title:book.title[lang],description:book.heading[lang],hero,body,toc,adjacent:`<nav class="reader-adjacent" aria-label="${zh?'前后课程':'Adjacent lessons'}">${neighbor(-1)}${neighbor(1)}</nav>`}));
 }
 for(const page of ['guide','handbook','resources']){
  const title=page==='guide'?(zh?'从这里开始':'Start with a useful question'):page==='handbook'?(zh?'一本随身的实践手册':'A handbook for the work ahead'):(zh?'回到原始来源':'Back to the sources');
  const description=page==='resources'?(zh?'78 项公开课、官方文档与原始研究，附核对范围。':'78 courses, official documents and original research sources, with verification scope.'):(zh?'从 Vibe Coding 到个人 FDE：24 周实践路线。':'From vibe coding to a personal FDE: a 24-week practice route.');
  let html=page==='resources'?`<p>${esc(description)}</p><p>${zh?'这是来源库，不是需要全修的任务清单。优先每周指定选段。核对说明沿用所提供原文，基线为 2026-09-27；没有逐一登录完成全部外部实验，也不保证证书、付费内容、地区权限或未来资料开放。研究条目不代表已复现。':'This is a reference library, not an all-courses completion checklist. Follow weekly selections. Scope notes come from the supplied manuscript, baseline 2026-09-27. Not every authenticated lab was completed; certificates, paid content, regional access and future materials are not guaranteed. Research links do not imply reproduction.'}</p><h2>${zh?'完整资源索引':'The complete source library'}</h2>${sourceList(resources.map(r=>r.id),lang)}`:md(read(`content/course/${lang}/${page}.md`).replace(/^# .+\n/m,''),lang);
  if(page==='guide')html=budget(lang)+html;
  if(zh&&page==='guide')html=html.replace(/href="#w(\d{2})"/g,'href="book-$1.html"');
  if(page==='resources')html+=`<h2>${zh?'让技术成为可以依赖、也可以退出的能力':'Tools you can depend on—and choose to leave behind'}</h2><p>${zh?'毕业成果不是二十四个演示，而是两三个自然进入日常的工具，以及解释、验证、接管故障和判断价值的能力。无需把所有生活自动化。':'The outcome is not 24 demonstrations. It is two or three tools that fit daily life, and the ability to explain, verify, recover and judge their value. You need not automate every part of living.'}</p>`;
  const {html:body,toc}=sections(html),hero=`<section class="reader-hero reader-hero--guide"><div class="reader-hero-copy"><p class="reader-eyebrow">AFFLATUS · ${zh?'课程资料':'FIELD COMPANION'}</p><h1>${title}</h1><p class="reader-deck">${description}</p><div class="reader-meta"><span>2026.09.27 · ${zh?'原文核对基线':'MANUSCRIPT BASELINE'}</span><span>${zh?'公开分享版 1.0':'PUBLIC EDITION 1.0'}</span></div></div></section>`;
  write(`public/${lang}/course/${page}.html`,documentPage({lang,page,title,description,hero,body,toc}));
 }
}
// Static weekly index remains readable and navigable without JavaScript.
let course=read('course.html');
const index=`<section class="course-directory" id="curriculum"><div class="directory-heading"><p data-en="THE COMPLETE ROUTE" data-zh="完整学习路线">THE COMPLETE ROUTE</p><h2 data-en="One week. One useful step." data-zh="每一周，向有用迈进一步。">One week. One useful step.</h2><p data-en="24 weeks, three continuing projects. Move on when you can explain, verify and recover the work." data-zh="24 周，三个持续项目。能够解释、验证与恢复，再进入下一周。">24 weeks, three continuing projects. Move on when you can explain, verify and recover the work.</p><nav><a href="/en/course/guide.html" data-course-companion="guide" data-en="Start here ↗" data-zh="课程导读 ↗">Start here ↗</a><a href="/en/course/handbook.html" data-course-companion="handbook" data-en="Handbook & templates ↗" data-zh="手册与模板 ↗">Handbook & templates ↗</a><a href="/en/course/resources.html" data-course-companion="resources" data-en="78 sources ↗" data-zh="78 项来源 ↗">78 sources ↗</a></nav></div>${groups.map((g,i)=>`<div class="directory-group"><div class="directory-group-heading"><span>0${i+1} / 06</span><h3 data-en="${esc(g[0])}" data-zh="${esc(g[1])}">${esc(g[0])}</h3><p data-en="${esc(g[2])}" data-zh="${esc(g[3])}">${esc(g[2])}</p></div><div class="directory-books">${books.filter(b=>b.group===i).map(b=>`<a href="/en/course/book-${b.id}.html" class="directory-book" data-book-preview="${b.id}"><img src="${b.covers.en}" data-cover-en="${b.covers.en}" data-cover-zh="${b.covers.zh}" width="240" height="320" loading="lazy" alt="${esc(b.title.en)}" data-title-en="${esc(b.title.en)}" data-title-zh="${esc(b.title.zh)}"><span data-en="WEEK ${b.id}" data-zh="第 ${b.id} 周">WEEK ${b.id}</span><h4 data-en="${esc(b.title.en)}" data-zh="${esc(b.title.zh)}">${esc(b.title.en)}</h4></a>`).join('')}</div></div>`).join('')}</section>`;
if(course.includes('<!-- course-directory:start -->'))course=course.replace(/<!-- course-directory:start -->[\s\S]*?<!-- course-directory:end -->/,`<!-- course-directory:start -->${index}<!-- course-directory:end -->`);
else course=course.replace('</main>',`<!-- course-directory:start -->${index}<!-- course-directory:end -->\n</main>`);
write('course.html',course);
console.log('Generated 48 complete weekly lessons, six companion pages, and the static 24-week index.');
