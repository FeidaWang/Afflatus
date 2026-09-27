import { readFileSync, writeFileSync } from 'node:fs';
import { courseBookCatalog } from '../src/data/courseBookCatalog.js';
const escape = s => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
// Retain the original Figma vector studies, replacing their old editorial title band.
for (const book of courseBookCatalog) {
 const original=readFileSync(`public/assets/course-covers/book-${book.id}.svg`,'utf8').replace(/<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
 for (const lang of ['en','zh']) {
  const title=book.title[lang], words=lang==='zh'?Array.from(title):title.split(' '), lines=[''];
  for(const word of words){const last=lines.length-1, next=lines[last]+(lang==='en'&&lines[last]?' ':'')+word;if(next.length>(lang==='zh'?10:25)&&lines[last])lines.push(word);else lines[last]=next;}
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" fill="none" width="480" height="640" viewBox="0 0 240 320"><title>${escape(title)}</title><defs><clipPath id="art-${book.id}"><rect width="240" height="246"/></clipPath></defs><g clip-path="url(#art-${book.id})">${original}</g><rect y="246" width="240" height="74" fill="#f2eee4"/><path d="M15 255H225" stroke="#33392e" stroke-width=".5"/><text x="15" y="269" fill="#545b50" font-family="Arial,sans-serif" font-size="7" letter-spacing="1.2">${lang==='zh'?'第 '+book.id+' 周':'WEEK '+book.id} · AFFLATUS</text>${lines.map((line,i)=>`<text x="15" y="${289+i*17}" fill="#22291f" font-family="${lang==='zh'?'Noto Serif SC, Songti SC, SimSun, serif':'Georgia,serif'}" font-size="${lang==='zh'?15:16}">${escape(line)}</text>`).join('')}</svg>`;
  writeFileSync(`public${book.covers[lang]}`,svg);
 }
}
console.log('Built 48 localized vector covers from the existing Figma illustrations.');
