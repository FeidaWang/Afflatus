import { describe, expect, it } from 'vitest';
import { createDailyJournal, DAILY_PROMPTS, JOURNAL_KEY, localDay, shiftDay } from '../src/lib/dailyJournal.js';
import { createTextAnchor, resolveTextAnchor } from '../src/lib/readerAnchors.js';
const memory = () => { const entries = new Map(); return { getItem:k=>entries.get(k)||null, setItem:(k,v)=>entries.set(k,v) }; };

describe('daily journal persistence', () => {
  it('keeps the first draw when revisited or refreshed and separates days', () => {
    const storage=memory(), first=createDailyJournal(storage);
    const draw=first.draw('2026-10-11',0.2,'Australia/Melbourne');
    expect(draw.persisted).toBe(true);
    expect(first.draw('2026-10-11',0.9).index).toBe(draw.index);
    const revisit=createDailyJournal(storage);
    expect(revisit.draw('2026-10-11',0.99).index).toBe(draw.index);
    expect(revisit.draw('2026-10-12',0.99).index).toBe(DAILY_PROMPTS.length-1);
  });
  it('retains independent notes, edits and draws through a reload', () => {
    const storage=memory(), store=createDailyJournal(storage);
    store.draw('2026-10-11',0.2);store.saveNote('2026-10-11','今天的想法 <script>不执行</script>');
    store.saveNote('2026-10-10','昨天');store.saveNote('2026-10-11','今天的新想法');
    const restored=createDailyJournal(storage);
    expect(restored.entries().map(e=>e.day)).toEqual(['2026-10-11','2026-10-10']);
    expect(restored.get('2026-10-11')).toMatchObject({note:'今天的新想法',draw:2});
  });
  it('reports blocked storage without claiming successful saving', () => {
    const store=createDailyJournal({getItem:()=>null,setItem:()=>{throw new Error('quota');}});
    expect(store.saveNote('2026-10-11','still recoverable')).toBe(false);
    expect(store.draw('2026-10-11',0.5).persisted).toBe(false);
    expect(JSON.parse(store.export()).records['2026-10-11'].note).toBe('still recoverable');
  });
  it('ignores corrupt saved records and rejects impossible dates', () => {
    const storage=memory();storage.setItem(JOURNAL_KEY,JSON.stringify({version:1,records:{'2026-02-30':{draw:3},'2026-10-11':{draw:-1,note:42}}}));
    const store=createDailyJournal(storage);
    expect(store.entries()).toHaveLength(1);
    expect(store.get('2026-10-11').draw).toBeUndefined();
    expect(store.saveNote('2026-02-30','invalid')).toBe(false);
  });
  it('uses civil date arithmetic across month, leap-year and year boundaries', () => {
    expect(shiftDay('2026-01-01',-1)).toBe('2025-12-31');
    expect(shiftDay('2024-03-01',-1)).toBe('2024-02-29');
    expect(localDay(new Date(2026,9,11,23,59))).toBe('2026-10-11');
  });
});

describe('reader text anchors',()=>{
  it('restores the same passage after a preface is inserted',()=>{
    const text='开场。顾星辞走进旧粮仓。苏念禾停下脚步。';
    const anchor=createTextAnchor(text,4);
    const changed='新补充的序言。'+text;
    expect(resolveTextAnchor(changed,anchor)).toBe(changed.indexOf(anchor.quote));
  });
  it('keeps repeated text nearest to the original position',()=>{
    const text='甲'.repeat(100)+'同一句'+'乙'.repeat(100)+'同一句';
    expect(resolveTextAnchor(text,{offset:201,quote:'同一句'})).toBe(203);
  });
  it('clamps a missing quote after a chapter is shortened',()=>{
    expect(resolveTextAnchor('短文',{offset:100,quote:'已经删除'})).toBe(2);
  });
});
