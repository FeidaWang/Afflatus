// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPagedBook } from '../src/lib/pagedBook.js';
import { createReaderStore, READER_STORE_KEY } from '../src/lib/readerStore.js';

beforeEach(()=>{
  vi.stubGlobal('matchMedia',()=>({matches:true}));
  vi.stubGlobal('ResizeObserver',class{observe(){} disconnect(){}});
});
afterEach(()=>vi.unstubAllGlobals());

function setup(capacity=20) {
  document.body.innerHTML='<div id="stage" data-motion="none" tabindex="0"><div id="content"></div></div><div id="measure"></div><div id="turn"></div><div id="front"></div><div id="back"></div><span id="indicator"></span>';
  const get=id=>document.getElementById(id);
  get('content').getBoundingClientRect=()=>({width:340,height:400});
  let limit=capacity;
  Object.defineProperty(get('measure'),'clientHeight',{get:()=>limit});
  Object.defineProperty(get('measure'),'scrollHeight',{get:()=>get('measure').textContent.length});
  const book=createPagedBook({stage:get('stage'),content:get('content'),measure:get('measure'),turnLayer:get('turn'),turnFront:get('front'),turnBack:get('back'),pageIndicator:get('indicator')});
  return {book,content:get('content'),setCapacity(value){limit=value;}};
}

describe('reader pagination and restoration',()=>{
  it('fills remaining space and never drops or repeats story text',()=>{
    const {book,content}=setup(20);
    const text='第一段。'+'长'.repeat(51)+'结尾。';
    book.setContent('<p>第一段。</p><p>'+'长'.repeat(51)+'</p><p>结尾。</p>');
    expect(content.textContent.length).toBeGreaterThanOrEqual(20);
    expect(content.textContent.length).toBeLessThanOrEqual(21);
    let result=content.textContent;
    while(book.turn(1))result+=content.textContent;
    expect(result).toBe(text);
  });
  it('preserves the passage when page capacity changes',()=>{
    const {book,content,setCapacity}=setup(20);
    const text='甲'.repeat(22)+'关键句子'+'乙'.repeat(50);
    book.setContent(`<p>${text}</p>`);book.turn(1);
    const anchor=book.getState().anchor;
    setCapacity(12);book.repaginate();
    expect(book.getState().anchor.offset).toBeLessThanOrEqual(anchor.offset);
    expect(book.getState().anchor.offset+content.textContent.length).toBeGreaterThan(anchor.offset);
  });
  it('restores a saved text anchor after a chapter prefix is edited',()=>{
    const {book,content}=setup(12);
    book.setContent('<p>甲甲甲甲甲甲甲甲甲甲甲甲关键句子在这里。乙乙乙乙乙乙乙乙乙乙乙乙</p>');book.turn(1);
    const anchor=book.getState().anchor;
    book.setContent('<p>新增序言。甲甲甲甲甲甲甲甲甲甲甲甲关键句子在这里。乙乙乙乙乙乙乙乙乙乙乙乙</p>',{anchor});
    expect(content.textContent).toContain('关键句子');
  });
  it('does not walk backward through the chapter across repeated resizes',()=>{
    const {book,setCapacity}=setup(20);
    book.setContent('<p>'+'甲'.repeat(200)+'</p>');book.turn(1);book.turn(1);
    const anchor=book.getState().anchor;
    setCapacity(90);book.repaginate();
    setCapacity(12);book.repaginate();
    expect(book.getState().anchor.offset).toBe(anchor.offset);
    expect(book.getState().pageIndex).toBeGreaterThan(0);
  });
  it('keeps multiple bookmarks and v2 preferences after migration',()=>{
    const data=new Map([[READER_STORE_KEY,JSON.stringify({version:2,theme:'night',layout:'waterfall',bookId:'book',chapterId:2,offset:44,bookmarks:{book:{chapterId:1,chapterTitle:'第一章',offset:12}}})]]);
    const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
    const store=createReaderStore(storage,{migrate:false});
    expect(store.getState()).toMatchObject({theme:'night',layout:'waterfall',offset:44});
    store.setBookmark('book',{chapterId:2,chapterTitle:'第二章',offset:2,anchor:{offset:48,quote:'这里'}});
    const reloaded=createReaderStore(storage,{migrate:false});
    expect(reloaded.getState().savedBookmarks).toHaveLength(2);
    expect(reloaded.getState().savedBookmarks[1].anchor.quote).toBe('这里');
  });
});
