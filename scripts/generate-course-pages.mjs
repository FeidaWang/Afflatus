import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { courseBookCatalog } from '../src/data/courseBookCatalog.js';
import { courseGroupCopy } from '../src/data/courseGroupCopy.js';
const root=new URL('../public/',import.meta.url);
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
// Add authored lesson HTML in content/course/{en,zh}/book-01.html, etc.
// Missing content deliberately remains an honest, minimal forthcoming page.
for(const lang of ['en','zh']){
 const zh=lang==='zh',other=zh?'en':'zh';
 const dir=new URL(`${lang}/course/`,root);mkdirSync(dir,{recursive:true});
 for(const [index,book] of courseBookCatalog.entries()){
  const title=escape(book.title[lang]);
  const path=`/${lang}/course/book-${book.id}.html`;
  let content='';try{content=readFileSync(new URL(`../content/course/${lang}/book-${book.id}.html`,import.meta.url),'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
  const neighbor=(delta)=>{const b=courseBookCatalog[index+delta];return b?`<a href="book-${b.id}.html"><span>${delta<0?(zh?'上一课':'Previous'):(zh?'下一课':'Next')}</span>${escape(b.title[lang])} ${delta<0?'←':'→'}</a>`:'<span></span>';};
  writeFileSync(new URL(`book-${book.id}.html`,dir),`<!doctype html>
<html lang="${zh?'zh-CN':'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} · AFFLATUS</title><meta name="description" content="${title} — ${zh?'AFFLATUS 课程手记，内容即将更新。':'An AFFLATUS field note. Lesson coming soon.'}"><link rel="canonical" href="https://feida.au${path}"><link rel="alternate" hreflang="en" href="https://feida.au/en/course/book-${book.id}.html"><link rel="alternate" hreflang="zh-CN" href="https://feida.au/zh/course/book-${book.id}.html"><link rel="stylesheet" href="/styles/course-lesson.css"><link rel="icon" href="/favicons/course.svg"></head>
<body><header><a class="wordmark" href="/${lang}/">AFFLATUS</a><nav aria-label="${zh?'课程导航':'Lesson navigation'}"><a href="/${lang}/course.html#hopeMap">${zh?'全部课程':'All field notes'}</a><a href="/${other}/course/book-${book.id}.html" lang="${other}" hreflang="${other}">${zh?'EN':'中文'}</a></nav></header>
<main><a class="back" href="/${lang}/course.html#hopeMap">← ${zh?'返回书架':'Back to the collection'}</a><article><div class="cover"><img src="${book.cover}" alt="${title}" width="240" height="320"></div><div class="lesson"><p class="eyebrow">${zh?'课程手记':'FIELD NOTE'} ${book.id} / 36</p><p class="theme">${escape(courseGroupCopy[book.group][zh?1:0])}</p><h1>${title}</h1><div class="lesson-content">${content||`<p class="pending">${zh?'课程内容即将更新。':'This lesson is taking shape.'}</p><p class="note">${zh?'留一点空白，给接下来的思考。':'A little space for what comes next.'}</p>`}</div></div></article><nav class="adjacent" aria-label="${zh?'相邻课程':'Adjacent lessons'}">${neighbor(-1)}${neighbor(1)}</nav></main><footer>AFFLATUS · LEARN BY MAKING</footer></body></html>`);
 }
}
console.log('Generated 72 dedicated bilingual course documents.');
