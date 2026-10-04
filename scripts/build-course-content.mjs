import { readFileSync, writeFileSync } from 'node:fs';
import { courseBookCatalog } from '../src/data/courseBookCatalog.js';
const escape = s => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
// Keep only the concept illustration. Titles already appear in the surrounding UI.
for (const book of courseBookCatalog) {
 const original=readFileSync(`public/assets/course-covers/book-${book.id}.svg`,'utf8').replace(/<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
 for (const lang of ['en','zh']) {
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" fill="none" width="480" height="492" viewBox="0 0 240 246"><title>${escape(book.title[lang])}</title><defs><clipPath id="art-${book.id}"><rect width="240" height="246"/></clipPath></defs><g clip-path="url(#art-${book.id})">${original}</g></svg>`;
  writeFileSync(`public${book.covers[lang]}`,svg);
 }
}
console.log('Built 48 localized vector covers from the existing Figma illustrations.');
