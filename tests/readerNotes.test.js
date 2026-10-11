// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mountReaderNotes } from '../src/lib/readerNotes.js';
function fixture(bookId='wanjie-zhongchun',chapterId=2){
 document.body.innerHTML='<div id="chapterBody"><p>枯咬藤，是苏念禾提到的藤蔓。</p></div><dialog id="readerNoteDialog"><h2 id="readerNoteTitle"></h2><p id="readerNoteKind"></p><blockquote id="readerNoteQuote"></blockquote><p id="readerNoteSource"></p></dialog>';
 // jsdom does not implement the browser's dialog top layer.
 document.getElementById('readerNoteDialog').showModal=function(){this.open=true;};
 return mountReaderNotes({getBookId:()=>bookId,getChapter:()=>({id:chapterId,title:'第二章'})});
}
describe('source-limited reading annotations',()=>{
 it('preserves story text and quotes only the current page',()=>{
  const notes=fixture(),original=document.getElementById('chapterBody').textContent;
  notes.decorate();notes.decorate();
  expect(document.querySelectorAll('.reader-term')).toHaveLength(1);
  expect(document.getElementById('chapterBody').textContent).toBe(original);
  document.querySelector('.reader-term').click();
  expect(document.getElementById('readerNoteQuote').textContent).toBe(original);
  expect(document.getElementById('readerNoteDialog').open).toBe(true);
 });
 it('does not import a term into another novel world',()=>{
  fixture('yuxi-gongci').decorate();expect(document.querySelector('.reader-term')).toBeNull();
 });
 it('does not enable a later-chapter glossary entry early',()=>{
  fixture('wanjie-zhongchun',1).decorate();expect(document.querySelector('.reader-term')).toBeNull();
 });
});
